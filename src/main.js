const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const Store = require('electron-store');

const store = new Store();

let mainWindow = null;
let pythonProcess = null;

// Electron penceresini oluşturur
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1250,
    height: 850,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'frontend', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Python FastAPI backend'i başlatır
function startPythonBackend() {
  const isPackaged = app.isPackaged;

  if (isPackaged) {
    // Paketlenmiş exe içinde:
    // resources/backend/app.exe
    const pythonExePath = path.join(process.resourcesPath, 'backend', 'app.exe');

    console.log("Paketlenmiş Python backend başlatılıyor:");
    console.log(pythonExePath);

    pythonProcess = spawn(pythonExePath, [], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } else {
    // Geliştirme modunda:
    // src/backend/app.py
    const pythonScriptPath = path.join(__dirname, 'backend', 'app.py');

    console.log("Geliştirme modunda Python backend başlatılıyor:");
    console.log(pythonScriptPath);

    pythonProcess = spawn('python', [pythonScriptPath], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
  }

  pythonProcess.stdout.on('data', (data) => {
    console.log(`[PYTHON]: ${data.toString()}`);
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error(`[PYTHON ERROR]: ${data.toString()}`);
  });

  pythonProcess.on('error', (err) => {
    console.error("Python backend başlatılamadı:", err);

    if (mainWindow) {
      mainWindow.webContents.send(
        'backend-error',
        'Python backend başlatılamadı. Python kurulumunu veya paketlenmiş app.exe dosyasını kontrol edin.'
      );
    }
  });

  pythonProcess.on('close', (code) => {
    console.log(`Python backend kapandı. Çıkış kodu: ${code}`);
    pythonProcess = null;
  });
}

// Python backend'i güvenli şekilde kapatır
function stopPythonBackend() {
  if (!pythonProcess) {
    return;
  }

  const pid = pythonProcess.pid;

  console.log(`Python backend kapatılıyor. PID: ${pid}`);

  if (process.platform === 'win32') {
    exec(`taskkill /pid ${pid} /T /F`, (err) => {
      if (err) {
        console.error("Python backend taskkill ile kapatılamadı:", err);
      }
    });
  } else {
    pythonProcess.kill();
  }

  pythonProcess = null;
}

// Uygulama hazır olduğunda
app.whenReady().then(() => {
  startPythonBackend();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// BYOK için API anahtarı işlemleri
// BYOK için API anahtarı işlemleri
ipcMain.handle('get-api-key', () => {
  return store.get('gemini_api_key', '');
});

ipcMain.handle('save-api-key', (event, key) => {
  store.set('gemini_api_key', key);
  return { success: true };
});

ipcMain.handle('clear-api-key', () => {
  store.delete('gemini_api_key');
  return { success: true };
});

// Tüm pencereler kapanınca
app.on('window-all-closed', () => {
  stopPythonBackend();

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Uygulama tamamen çıkmadan önce backend'i kapat
app.on('before-quit', () => {
  stopPythonBackend();
});