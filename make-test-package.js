const packager = require('electron-packager');

if (require.main === module) {
    makeTestPackage();
}

async function makeTestPackage() {
    const [appPath] = await packager({
        dir: 'test-app',
        out: 'tmp',
        overwrite: true,
        name: 'test-app',
        quiet: true
    });
    return appPath;
}

module.exports = makeTestPackage;
