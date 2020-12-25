const path = require('path');
const fs = require('fs');

const FuseConst = {
    Sentinel: 'dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX',
    ExpectedFuseVersion: 1,
    EnabledByte: 0x31,
    DisabledByte: 0x30,
    RemovedByte: 0x72,
    RunAsNode: 1
};

const replacements = [
    {
        name: 'Command-line option: --inspect',
        search: /\0--inspect\0/g,
        replace: '\0  inspect\0'
    },
    {
        name: 'Command-line option: --inspect-brk',
        search: /\0--inspect-brk\0/g,
        replace: '\0  inspect-brk\0'
    },
    {
        name: 'Command-line option: --inspect-port',
        search: /\0--inspect-port\0/g,
        replace: '\0  inspect-port\0'
    },
    {
        name: 'Command-line option: --debug',
        search: /\0--debug\0/g,
        replace: '\0  debug\0'
    },
    {
        name: 'Command-line option: --debug-brk',
        search: /\0--debug-brk\0/g,
        replace: '\0  debug-brk\0'
    },
    {
        name: 'Command-line option: --debug-port',
        search: /\0--debug-port\0/g,
        replace: '\0  debug-port\0'
    },
    {
        name: 'Command-line option: --inspect-brk-node',
        search: /\0--inspect-brk-node\0/g,
        replace: '\0  inspect-brk-node\0'
    },
    {
        name: 'Command-line option: --inspect-publish-uid',
        search: /\0--inspect-publish-uid\0/g,
        replace: '\0  inspect-publish-uid\0'
    },
    {
        name: 'Remote debugging options',
        search: /\0remote-debugging-port\0/g,
        replace: '\r\n ote\0-debugging-port\0'
    },
    {
        name: 'DevTools listening message',
        search: /\0\nDevTools listening on ws:\/\/%s%s\n\0/g,
        replace: '\0%s%s%s%s%s%s%s%s%s%s%s%s%s%s%s%s\n\0'
    },
    {
        name: 'Debugger listening message',
        search: /\0Debugger listening on %s\n\0/g,
        replace: '\0%s%s%s%s%s%s%s%s%s%s%s%s\n\0'
    },
    {
        name: 'JS flags option',
        search: /\0js-flags\0/g,
        replace: '\r\n -\0\x01\b\'"\0'
    }
];

function patch(options) {
    const binary = findBinary(options);
    if (!fs.existsSync(binary)) {
        throw new Error(`Binary not found: ${binary}`);
    }
    let data = fs.readFileSync(binary, 'latin1');
    const [, electronVersion] = data.match(/Electron\/(\d+\.\d+\.\d+)/);
    if (electronVersion.split('.')[0] < 12) {
        throw new Error(`Minimal supported Electron version is 12, found ${electronVersion}`);
    }
    data = setFuseWireStatus(data, FuseConst.RunAsNode, false);
    for (const replacement of replacements) {
        let replaced = false;
        data = data.replace(replacement.search, (match) => {
            if (replaced) {
                throw new Error(`Multiple matches found for ${replacement.name}`);
            }
            if (replacement.replace.length !== match.length) {
                throw new Error(
                    `Length mismatch for ${replacement.name}: ` +
                        `${replacement.replace.length} <> ${match.length}`
                );
            }
            replaced = true;
            return replacement.replace;
        });
        if (!replaced) {
            throw new Error(`Not found: ${replacement.name}`);
        }
    }
    fs.writeFileSync(binary, Buffer.from(data, 'latin1'));
}

function findBinary(options) {
    if (options.path.endsWith('.app')) {
        return path.join(
            options.path,
            'Contents',
            'Frameworks',
            'Electron Framework.framework',
            'Versions',
            'A',
            'Electron Framework'
        );
    }
    return options.path;
}

function setFuseWireStatus(data, wireId, enabled) {
    let ix = data.indexOf(FuseConst.Sentinel);
    if (ix === -1) {
        throw new Error('Fuse sentinel not found');
    }
    ix += FuseConst.Sentinel.length;
    const foundVersion = data.charCodeAt(ix);
    if (foundVersion !== FuseConst.ExpectedFuseVersion) {
        throw new Error(
            `Bad fuse version: ${foundVersion}, expected ${FuseConst.ExpectedFuseVersion}`
        );
    }
    const fuseLength = data.charCodeAt(++ix);
    if (fuseLength < wireId) {
        throw new Error(`Fuse is too short: ${fuseLength} bytes, expected at least ${wireId}`);
    }
    let wireByte = data.charCodeAt(ix + wireId);
    if (wireByte === FuseConst.DisabledByte) {
        throw new Error(`Fuse wire ${wireId} is marked as removed`);
    }
    wireByte = String.fromCharCode(enabled ? FuseConst.EnabledByte : FuseConst.DisabledByte);
    data = data.substr(0, ix + wireId) + wireByte + data.substr(ix + wireId + 1);
    return data;
}

module.exports = patch;
