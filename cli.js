#!/usr/bin/env node

const patch = require('./patch');
const { version } = require('./package.json');

console.log(`Electron feature patcher v${version}`);
const [packagePath] = process.argv.slice(2);
if (!packagePath) {
    console.log('Usage: node patch path-to-your-electron-package');
    process.exit(1);
}

patch({ path: packagePath });
