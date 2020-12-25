const { app, BrowserWindow } = require('electron');

let win;

function createWindow() {
    win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            contextIsolation: false
        }
    });
}

app.whenReady().then(() => {
    console.log('Test app started');
    setTimeout(() => process.exit(0), 5000);
    //process.stdin.on('data', () => process.exit(0));

    createWindow();
});

app.on('window-all-closed', () => {
    if (win) {
        win = null;
    }
    app.quit();
});
