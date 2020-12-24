const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const makeTestPackage = require('./make-test-package');

const patch = require('./patch');

jest.setTimeout(20000);
jest.retryTimes(0);

const DefaultDebuggerPort = 9229;
const AlternativeDebuggerPort = 9666;

const Timeouts = {
    PollInterval: 100,
    BeforeSendingSigUsr1: 2000,
    DebuggerConnect: 3000,
    SelfExit: 6000
};

let env;
let appPath;
let ps;
let stdoutData;
let stderrData;

beforeAll(async () => {
    try {
        appPath = await makeTestPackage();
    } catch (e) {
        console.error('Error making test package', e);
        throw e;
    }
});

beforeEach(() => {
    if (process.platform === 'linux') {
        env = {
            // ELECTRON_ENABLE_LOGGING: 'true',
            // to prevent SIGABRT, see https://github.com/electron/electron/issues/24211
            // this doesn't seem to work anyway, see another hack below
            DISPLAY: ':0'
        };
    } else {
        env = {};
    }
});

afterEach(() => {
    if (ps) {
        try {
            ps.kill();
        } catch {
            // phew
        }
        ps = undefined;
    }
});

test('default', async () => {
    runTestApp();
    await assertCannotConnectTcpDebugger(DefaultDebuggerPort);
    await assertExitsItself();
    assertContainsOnlyAppOutputInStdOut();
    assertStdErrIsEmpty();
});

xdescribe('original', () => {
    test('no args', async () => {
        runTestApp();
        await assertCannotConnectTcpDebugger(DefaultDebuggerPort);
        await assertExitsItself();
        assertContainsOnlyAppOutputInStdOut();
        assertStdErrIsEmpty();
    });

    test('--inspect', async () => {
        runTestApp('--inspect');
        await assertCanConnectTcpDebugger(DefaultDebuggerPort);
        await assertExitsItself();
        assertContainsOnlyAppOutputInStdOut();
        assertContainsDebuggerMessageInStdErr(DefaultDebuggerPort);
    });

    test('--inspect --inspect-port', async () => {
        runTestApp('--inspect', `--inspect-port=${AlternativeDebuggerPort}`);
        await assertCanConnectTcpDebugger(AlternativeDebuggerPort);
        await assertExitsItself();
        assertContainsOnlyAppOutputInStdOut();
        assertContainsDebuggerMessageInStdErr(AlternativeDebuggerPort);
    });

    test('--inspect --inspect-publish-uid', async () => {
        runTestApp('--inspect', '--inspect-publish-uid=http');
        await assertCanConnectTcpDebugger(DefaultDebuggerPort);
        await assertExitsItself();
        assertContainsOnlyAppOutputInStdOut();
        assertStdErrIsEmpty();
    });

    test('--inspect-brk', async () => {
        runTestApp('--inspect-brk');
        await assertCanConnectTcpDebugger(DefaultDebuggerPort);
        assertStdOutIsEmpty();
    });

    test('--inspect-brk --inspect-port', async () => {
        runTestApp('--inspect-brk', `--inspect-port=${AlternativeDebuggerPort}`);
        await assertCanConnectTcpDebugger(AlternativeDebuggerPort);
        assertStdOutIsEmpty();
    });

    test('--inspect-brk --inspect-publish-uid', async () => {
        runTestApp('--inspect-brk', '--inspect-publish-uid=http');
        await assertCanConnectTcpDebugger(DefaultDebuggerPort);
        assertStdOutIsEmpty();
    });

    test('--remote-debugging-port', async () => {
        runTestApp(`--remote-debugging-port=${AlternativeDebuggerPort}`);
        await assertCanConnectTcpDebugger(AlternativeDebuggerPort);
        await assertExitsItself();
        assertContainsOnlyAppOutputInStdOut();
        assertContainsRemoteDebuggerMessageInStdErr(AlternativeDebuggerPort);
    });

    if (process.platform !== 'win32') {
        test('SIGUSR1', async () => {
            runTestApp();
            await sleep(Timeouts.BeforeSendingSigUsr1);
            ps.kill('SIGUSR1');
            await assertCanConnectTcpDebugger(DefaultDebuggerPort);
            await assertExitsItself();
            assertContainsOnlyAppOutputInStdOut();
            assertContainsDebuggerMessageInStdErr(DefaultDebuggerPort);
        });
    }

    test('ELECTRON_RUN_AS_NODE', async () => {
        env.ELECTRON_RUN_AS_NODE = '1';
        runTestApp('not-found.js');
        await assertExitsWithStatusCode(1);
        assertStdOutIsEmpty();
        const stderrStr = Buffer.concat(stderrData).toString('utf8').trim();
        expect(stderrStr).toMatch(/Cannot find module .*not-found.js/);
    });
});

xdescribe('patched', () => {
    beforeAll(async () => {
        let packagePath;
        switch (process.platform) {
            case 'darwin':
                packagePath = path.join(appPath, 'test-app.app');
                break;
            case 'linux':
                packagePath = path.join(appPath, 'test-app');
                break;
            case 'win32':
                packagePath = path.join(appPath, 'test-app.exe');
                break;
            default:
                throw new Error(`Platform ${process.platform} is not supported`);
        }
        return patch({ path: packagePath });
    });

    test('no args', async () => {
        runTestApp();
        await assertCannotConnectTcpDebugger(DefaultDebuggerPort);
        await assertExitsItself();
        assertContainsOnlyAppOutputInStdOut();
        assertStdErrIsEmpty();
    });

    test('--inspect', async () => {
        runTestApp('--inspect');
        await assertCannotConnectTcpDebugger(DefaultDebuggerPort);
        await assertExitsItself();
        assertContainsOnlyAppOutputInStdOut();
        assertStdErrIsEmpty();
    });

    test('--inspect --inspect-port', async () => {
        runTestApp('--inspect', `--inspect-port=${AlternativeDebuggerPort}`);
        await assertCannotConnectTcpDebugger(AlternativeDebuggerPort);
        await assertExitsItself();
        assertContainsOnlyAppOutputInStdOut();
        assertStdErrIsEmpty();
    });

    test('--inspect --inspect-publish-uid', async () => {
        runTestApp('--inspect', '--inspect-publish-uid=http');
        await assertCannotConnectTcpDebugger(DefaultDebuggerPort);
        await assertExitsItself();
        assertContainsOnlyAppOutputInStdOut();
        assertStdErrIsEmpty();
    });

    test('--inspect-brk', async () => {
        runTestApp('--inspect-brk');
        await assertCannotConnectTcpDebugger(DefaultDebuggerPort);
        await assertExitsItself();
        assertContainsOnlyAppOutputInStdOut();
        assertStdErrIsEmpty();
    });

    test('[space][space]inspect-brk', async () => {
        runTestApp('  inspect-brk');
        await assertCannotConnectTcpDebugger(DefaultDebuggerPort);
        await assertExitsItself();
        assertContainsOnlyAppOutputInStdOut();
        assertStdErrIsEmpty();
    });

    test('--inspect-brk --inspect-port', async () => {
        runTestApp('--inspect-brk', `--inspect-port=${AlternativeDebuggerPort}`);
        await assertCannotConnectTcpDebugger(DefaultDebuggerPort);
        await assertExitsItself();
        assertContainsOnlyAppOutputInStdOut();
        assertStdErrIsEmpty();
    });

    test('--inspect-brk --inspect-publish-uid', async () => {
        runTestApp('--inspect-brk', '--inspect-publish-uid=http');
        await assertCannotConnectTcpDebugger(DefaultDebuggerPort);
        await assertExitsItself();
        assertContainsOnlyAppOutputInStdOut();
        assertStdErrIsEmpty();
    });

    test('--remote-debugging-port', async () => {
        runTestApp(`--remote-debugging-port=${AlternativeDebuggerPort}`);
        await assertCannotConnectTcpDebugger(DefaultDebuggerPort);
        await assertExitsItself();
        assertContainsOnlyAppOutputInStdOut();
        assertStdErrIsEmpty();
    });

    if (process.platform !== 'win32') {
        test('SIGUSR1', async () => {
            runTestApp();
            await sleep(Timeouts.BeforeSendingSigUsr1);
            ps.kill('SIGUSR1');
            await assertCannotConnectTcpDebugger(DefaultDebuggerPort);
            assertCrashed();
            assertStdErrIsEmpty();
        });
    }

    test('ELECTRON_RUN_AS_NODE', async () => {
        env.ELECTRON_RUN_AS_NODE = '1';
        runTestApp('not-found.js');
        await assertExitsItself();
        assertContainsOnlyAppOutputInStdOut();
        assertStdErrIsEmpty();
    });
});

async function assertExitsItself() {
    await waitForExit(ps);
    expect(ps.exitCode).toBe(0);
}

async function assertExitsWithStatusCode(statusCode) {
    await waitForExit(ps);
    expect(ps.exitCode).toBe(statusCode);
}

function assertCrashed() {
    expect(ps.signalCode).toMatch(/^SIG(SEGV|ABRT)/);
    expect(ps.connected).toBe(false);
}

function assertContainsOnlyAppOutputInStdOut() {
    const stdoutStr = Buffer.concat(stdoutData).toString('utf8').trim();
    expect(stdoutStr).toBe('Test app started');
}

function assertContainsDebuggerMessageInStdErr(port) {
    const stderrStr = Buffer.concat(stderrData).toString('utf8').trim();
    expect(stderrStr).toMatch(
        new RegExp(
            `^Debugger listening on ws://127\\.0\\.0\\.1:${port}/[\\w-]{36}\\r?\\n` +
                'For help, see: https://nodejs.org/en/docs/inspector$'
        )
    );
}

function assertContainsRemoteDebuggerMessageInStdErr(port) {
    const stderrStr = Buffer.concat(stderrData).toString('utf8').trim();
    expect(stderrStr.trim()).toMatch(
        new RegExp(
            `^DevTools listening on ws://127\\.0\\.0\\.1:${port}/devtools/browser/[\\w-]{36}$`
        )
    );
}

function assertStdErrIsEmpty() {
    expect(stdioToStr(stderrData)).toBe('');
}

function assertStdOutIsEmpty() {
    expect(stdioToStr(stdoutData)).toBe('');
}

function stdioToStr(stdio) {
    return Buffer.from(stdio).toString('utf8').trim().replace(/\0/g, '');
}

async function assertCanConnectTcpDebugger(port) {
    expect(await waitCheckCanConnectTcpDebugger(port)).toBe(true);
}

async function assertCannotConnectTcpDebugger(port) {
    expect(await waitCheckCanConnectTcpDebugger(port)).toBe(false);
}

async function waitCheckCanConnectTcpDebugger(port) {
    const maxDate = Date.now() + Timeouts.DebuggerConnect;
    while (Date.now() < maxDate) {
        await sleep(Timeouts.PollInterval);
        if (await canConnectTcpDebugger(port)) {
            return true;
        }
    }
    return false;
}

async function canConnectTcpDebugger(port) {
    return new Promise((resolve) => {
        http.get(`http://127.0.0.1:${port}/`, (res) => {
            expect(typeof res.statusCode).toBe('number');
            resolve(true);
        }).on('error', () => resolve(false));
    });
}

function runTestApp(...flags) {
    let binPath;
    switch (process.platform) {
        case 'darwin':
            binPath = path.join(appPath, 'test-app.app/Contents/MacOS/test-app');
            break;
        case 'linux':
            binPath = path.join(appPath, 'test-app');
            break;
        case 'win32':
            binPath = path.join(appPath, 'test-app.exe');
            break;
        default:
            throw new Error(`Platform ${process.platform} is not supported`);
    }
    ps = spawn(binPath, [...flags], { env });

    stdoutData = [];
    ps.stdout.on('data', (data) => {
        stdoutData.push(data);
    });

    stderrData = [];
    ps.stderr.on('data', (data) => {
        stderrData.push(data);
    });

    return ps;
}

async function waitForExit() {
    ps.stdin.write('exit\n');
    const maxDate = Date.now() + Timeouts.SelfExit;
    while (Date.now() < maxDate) {
        await sleep(Timeouts.PollInterval);
        if (typeof ps.exitCode === 'number') {
            return;
        }
        if (ps.signalCode) {
            if (
                process.platform === 'linux' &&
                Buffer.concat(stdoutData).toString('utf8').trim() === 'Test app started' &&
                Buffer.concat(stderrData).toString('utf8').includes('Unable to open X display')
            ) {
                // workaround for https://github.com/electron/electron/issues/24211
                ps.exitCode = 0;
                return;
            }
            throw new Error(
                `App crashed with signal ${ps.signalCode}\n` +
                    `STDOUT: ${Buffer.concat(stdoutData).toString('utf8')}\n` +
                    `STDERR: ${Buffer.concat(stderrData).toString('utf8')}`
            );
        }
    }
    throw new Error(`The app didn't exit after ${Timeouts.SelfExit}ms`);
}

function sleep(time) {
    return new Promise((resolve) => setTimeout(resolve, time));
}
