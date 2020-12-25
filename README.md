# Electron evil feature patcher

![CI Checks](https://github.com/antelle/electron-evil-feature-patcher/workflows/CI%20Checks/badge.svg)

Patches Electron to remove certain features from it, such as debugging flags, that can be used for evil.

<img src="img/electron-evil-feature-patcher.png" alt="logo" width="384" />

## Motivation

Electron has great debugging support! Unfortunately this can be used not only while developing an app, but also after you have already built and packaged it. This way your app can be started in an unexpected way, for example, an attacker may want to pass `--inspect-brk` and execute code as if it was done by your app.

Is this a concern in Electron? Yes and no. If your app is not dealing with secrets or if it's not codesigned, it's not an issue at all. However, if you would like to limit the code run under the identity of your app, it can be an issue.

This is being addressed in Electron in form of so-called "fuses", run-time toggles that can be switched on and off: https://www.electronjs.org/docs/tutorial/fuses. These features should be eventually "fuses" but I'm too lazy to contribute to Electron because the patches we need are located in interesting, hard-to-reach pieces of code, for example in node.js or Chromium. This is not fun to change! In this sense, this solution, or should I say this dirty hack, is a short-lived thing.

## Goals

- disable certain feature flags
- test on all supported operating systems
- have it right now, not in a year
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

## Internals

How does the patching work? Now the implemented solution is pretty naive, all it does is replacing strings used as command-line options, variable names, etc... When testing the changes I made sure replaced options are not understood by the parser, for example, if `--inspect` is changed to `[space][space]inspect`, it's discarded, so that not possible to use the second variant in the patched version.

This works good enough and doesn't require disassembly. However, this may change and maybe I'll switch to patching via assembly analysis in future. But for now the approach seems to be good enough.

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
- special characters option replace: `something` => `\n\r\0...`  
    Used in cases when the JS option parser is applied, this parser can't be fooled with the variant above so it's smart enough to recognize spaces in passed option, but it can't accept other special characters.
    - `--remote-debugging-port`
    - `--js-flags`
- format message breakage: `something` => `some%sing`  
    This causes segmentation fault when it's passed to `printf`, so even if we reach this place, the process crashes instead of starting debugging.
    - `DevTools listening on ...`
    - `Debugger listening on...`
- Electron fuses:  
    See more about them [here](https://www.electronjs.org/docs/tutorial/fuses), this is the only officially supported, sustainable way of patching Electron.
    - `ELECTRON_RUN_AS_NODE`

## Future

In future, as it's mentioned before, it will be done using electron "fuses". One of them is already in use here for `ELECTRON_RUN_AS_NODE`, and I hope others will be added as well! Then this project will be as small as flipping a couple of flags. But that's future.

## Questions

Do you know another option to execute code in Electron?  
Is there a way to use one of disabled capabilities in a patched app?  

Please [let me know](https://github.com/antelle/electron-evil-feature-patcher/issues/new)!

Are you using this project in your app? I'd be interested to hear from you, [drop me a line](mailto:antelle.net@gmail.com?subject=electron-evil-feature-patcher)!

This project fixed a vulnerability in your product? Consider [donating](https://github.com/sponsors/antelle): although the fixes here are very simple, the research, testing, and bringing it to you took time!

## License

MIT
