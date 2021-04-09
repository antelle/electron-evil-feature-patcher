# Electron evil feature patcher

![CI Checks](https://github.com/antelle/electron-evil-feature-patcher/workflows/CI%20Checks/badge.svg)

Patches Electron to remove certain features from it, such as debugging flags, that can be used for evil.

Before:
```sh
% test-app.app/Contents/MacOS/test-app --inspect
Debugger listening on ws://127.0.0.1:9229/71e61f6e-c559-48a1-9b73-1530f5fd111a
For help, see: https://nodejs.org/en/docs/inspector
Test app started
```

After:
```sh
% test-app.app/Contents/MacOS/test-app --inspect
Test app started
```

More info about removed options can be found [below](#removed-capabilities).

## Motivation

Electron has great debugging support! Unfortunately this can be used not only while developing an app, but also after you have already built and packaged it. This way your app can be started in an unexpected way, for example, an attacker may want to pass `--inspect-brk` and execute code as if it was done by your app.

Is this a concern in Electron? Yes and no. If your app is not dealing with secrets or if it's not codesigned, it's not an issue at all. However, if you would like to limit the code run under the identity of your app, it can be an issue.

This is being addressed in Electron in form of so-called "fuses", run-time toggles that can be switched on and off: https://www.electronjs.org/docs/tutorial/fuses. These features should be eventually "fuses" but I'm too lazy to contribute to Electron because the patches we need are located in interesting, hard-to-reach pieces of code, for example in node.js or Chromium. This is not fun to change! In this sense, this solution, or should I say this dirty hack, is a short-lived thing.

## Goals

- disable all debugging features
- test on supported operating systems
- have it right now
- minimize patching time
- keep it simple

## Non-goals

- do it all in a nice way
- support other features
- patch old Electron versions
- protect from [physically local attacks](https://chromium.googlesource.com/chromium/src/+/master/docs/security/faq.md#Why-arent-physically_local-attacks-in-Chromes-threat-model)

## Removed capabilities

- [`--inspect-brk`](https://www.electronjs.org/docs/api/command-line-switches#--inspect-brkhostport)
- [`--inspect-brk-node`](https://github.com/nodejs/node/blob/master/src/node_options.cc#L263)
- [`--inspect-port`](https://www.electronjs.org/docs/api/command-line-switches#--inspect-porthostport)
- [`--inspect`](https://www.electronjs.org/docs/api/command-line-switches#--inspecthostport)
- [`--inspect-publish-uid`](https://www.electronjs.org/docs/api/command-line-switches#--inspect-publish-uidstderrhttp)
- [`--remote-debugging-pipe`](https://github.com/electron/electron/blob/4588a411610ee4095ab2a47e086f23fa4730e50e/shell/browser/electron_browser_main_parts.cc#L464)
- [`--remote-debugging-port`](https://www.electronjs.org/docs/api/command-line-switches#--remote-debugging-portport)
- [`--js-flags`](https://www.electronjs.org/docs/api/command-line-switches#--js-flagsflags)
- [`SIGUSR1`](https://nodejs.org/fr/docs/guides/debugging-getting-started/#enable-inspector)
- [`ELECTRON_RUN_AS_NODE`](https://www.electronjs.org/docs/api/environment-variables#electron_run_as_node)

## Usage

Using the command line:
```sh
npx electron-evil-feature-patcher your-app-path
```

Without `npx`:
```sh
node electron-evil-feature-patcher/cli your-app-path
```

Using node.js:
```js
const patch = require('electron-evil-feature-patcher');
patch({ path: 'your-app-path' });
```

`your-app-path` is executable path, for macOS this is a packaged `.app`.

Patching is done in-place, no backup is made. Second attempt to patch is a no-op.

## Version support

Supported Electron versions are 12 and above.

## Internals

How does the patching work? Now the implemented solution is pretty naive, all it does is replacing strings used as command-line options, variable names, etc... When testing the changes I made sure replaced options are not understood by the parser, for example, if `--inspect` is changed to `[space][space]inspect`, it's discarded, so that not possible to use the second variant in the patched version.

This works good enough and doesn't require disassembly. However, this may change and maybe I'll switch to patching via assembly analysis in future. But for now the approach seems to solve our problem quite well.

Detailed information about all replacements:

- command-line option dashes removal: `--inspect` => `[space][space]inspect`  
  Good enough for the node.js option parser, it just discards such options. 
    - `--inspect`
    - `--inspect-brk`
    - `--inspect-brk-node`
    - `--inspect-port`
    - `--inspect-publish-uid`
    - `--debug`
    - `--debug-brk`
    - `--debug-port`
- command-line option shadowing: `something` => `xxx` + `another` => `xxx`  
    Used in cases when the Electron option parser is applied, this parser can't be fooled with the variant above, but it adds options to a hashmap, so here we pass the same string twice and the evil option is erased.
    - `--js-flags`
    - `--remote-debugging-pipe`
    - `--remote-debugging-port`
- format message breakage: `something` => `some%sing`  
    Causes segmentation fault when it's passed to `printf`, so even if we reach this place, the process crashes instead of starting debugging. It's the way we prevent initiating debugging with `SIGUSR1`.
    - `DevTools listening on ...`
    - `Debugger listening on ...`
- Electron fuses:  
    See more about them [here](https://www.electronjs.org/docs/tutorial/fuses), this is the only officially supported, sustainable way of patching Electron.
    - `ELECTRON_RUN_AS_NODE`

## Testing

To run tests:
```sh
npm test
```

They will build a test app, test non-patched and patched versions.

## Future

In future, as it's mentioned before, it will be done using electron "fuses". One of them is already in use here for `ELECTRON_RUN_AS_NODE`, and I hope others will be added as well! Then this project will be as small as flipping a couple of flags. But that's future.

## Known issues

You won't be able to use `fork` because it's built on `ELECTRON_RUN_AS_NODE`. Instead, I recommend the following:

1. start a new process from the main process, not renderer
2. come up with a suitable name of the command-line argument, for example, let it be `--my-worker`
3. handle this argument in your main.js (application entry point), so that it runs the desired logic instead of creating windows
4. don't forget to handle `disconnect` event that will happen when your app is terminated:
    ```js
    process.on('disconnect', () => process.exit(0));
    ```
5. spawn a helper process like this:
    ```js
    spawn(process.helperExecPath, [
        '--my-worker',
        '--in-process-gpu',
        '--disable-gpu'
    ], {
        env: process.env,
        stdio: ['ignore', 'ignore', 'ignore', 'ipc']
    });
    ```

Pay attention to `process.helperExecPath` and not `process.execPath` used here. If you use `execPath`, it will start another instance of your app, which is not what you would expect from `fork`.

After this you can communicate with the process as usual via IPC: `process.send(...)`, `process.on('message', ...)`, etc...

There are extra flags here: `--in-process-gpu` and `--disable-gpu`. They're added to prevent another GPU helper from starting because it's unlikely you will need GPU there. You can remove them, however your app will spawn two processes instead of one. This may be seen by users as strange behavior.

## Questions

Do you know another option to execute code in Electron?  
Is there a way to use one of disabled capabilities in a patched app?  

Please [let me know](https://github.com/antelle/electron-evil-feature-patcher/issues/new)!

Are you using this project in your app? I'd be interested to hear from you, [drop me a line](mailto:antelle.net@gmail.com?subject=electron-evil-feature-patcher)!

This project fixed a vulnerability in your product? Consider [donating](https://github.com/sponsors/antelle): although the fixes here are very simple, the research, testing, and bringing it to you took time!

## License

MIT
