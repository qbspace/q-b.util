const { app, BrowserWindow, ipcMain, clipboard, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let win;

/* ---------------- один экземпляр ---------------- */
// Два окна делили бы одно хранилище и перетирали данные друг друга
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });
}

/* ---------------- хранилище ---------------- */
// Данные пишутся в JSON-файл сразу, а не в localStorage, который сбрасывается на диск лениво
const dataFile = path.join(app.getPath('userData'), 'qb-data.json');
let data = {};
try {
  data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
} catch {
  data = {};
}

function writeData() {
  const tmp = dataFile + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, dataFile);
}

ipcMain.on('store:all', (e) => { e.returnValue = data; });
ipcMain.on('store:set', (e, key, value) => {
  if (value === undefined) delete data[key];
  else data[key] = value;
  try {
    writeData();
    e.returnValue = true;
  } catch {
    e.returnValue = false;
  }
});

/* ---------------- окно ---------------- */
function createWindow() {
  win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1080,
    minHeight: 720,
    frame: false,
    backgroundColor: '#121212',
    title: 'q-b.util',
    icon: path.join(__dirname, 'src', 'assets', 'icon.png'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  win.once('ready-to-show', () => win.show());
  win.on('maximize', () => win.webContents.send('win:state', true));
  win.on('unmaximize', () => win.webContents.send('win:state', false));
  win.on('closed', () => { win = null; });
}

ipcMain.on('win:minimize', () => win.minimize());
ipcMain.on('win:maximize', () => (win.isMaximized() ? win.unmaximize() : win.maximize()));
ipcMain.on('win:close', () => win.close());

ipcMain.handle('clipboard:write', (_e, text) => {
  clipboard.writeText(String(text));
  return true;
});

ipcMain.handle('file:save', async (_e, { name, content }) => {
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    defaultPath: name,
    filters: [{ name: 'Text', extensions: ['txt', 'csv', 'json'] }],
  });
  if (canceled || !filePath) return false;
  fs.writeFileSync(filePath, content, 'utf8');
  return true;
});

/* ---------------- обновления ---------------- */
const RELEASES_URL = 'https://github.com/quenixxx/q-b.util/releases';
let updater = null;
let updState = { state: 'idle', current: app.getVersion() };

function sendUpdate(patch) {
  updState = { ...updState, ...patch };
  if (win) win.webContents.send('upd:status', updState);
}

function setupUpdater() {
  if (!app.isPackaged) {
    updState.state = 'dev';
    return;
  }
  ({ autoUpdater: updater } = require('electron-updater'));
  updater.autoDownload = true;
  updater.autoInstallOnAppQuit = true;

  updater.on('checking-for-update', () => sendUpdate({ state: 'checking' }));
  updater.on('update-not-available', () => sendUpdate({ state: 'latest', checkedAt: Date.now() }));
  updater.on('update-available', (info) => sendUpdate({
    state: 'downloading', version: info.version, percent: 0,
    notes: typeof info.releaseNotes === 'string' ? info.releaseNotes : '',
  }));
  updater.on('download-progress', (p) => sendUpdate({ state: 'downloading', percent: Math.round(p.percent) }));
  updater.on('update-downloaded', (info) => sendUpdate({ state: 'ready', version: info.version, percent: 100 }));
  updater.on('error', (err) => sendUpdate({ state: 'error', error: String(err?.message || err).split('\n')[0] }));

  const check = () => updater.checkForUpdates().catch(() => {});
  setTimeout(check, 4000);
  setInterval(check, 4 * 60 * 60 * 1000);
}

ipcMain.handle('upd:get', () => updState);
ipcMain.handle('upd:check', () => {
  if (!updater) return updState;
  updater.checkForUpdates().catch(() => {});
  return updState;
});
ipcMain.on('upd:install', () => {
  if (updater && updState.state === 'ready') updater.quitAndInstall(false, true);
});
ipcMain.on('upd:releases', () => shell.openExternal(RELEASES_URL));

app.setAppUserModelId('util.qb.app');
app.whenReady().then(() => {
  if (!gotLock) return;
  createWindow();
  setupUpdater();
});
app.on('window-all-closed', () => app.quit());
