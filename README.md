# Electron evil feature patcher

![CI Checks](https://github.com/antelle/electron-evil-feature-patcher/workflows/CI%20Checks/badge.svg)

Patches Electron to remove certain features from it, such as debugging flags, that can be used for evil.

## Motivation

Electron has great debugging support! Unfortunately this can be used not only while developing an app, but also after you built and packaged it. This way your app can be started in an unexpected way, for example, an attacker may want to pass `--inspect-brk` and execute code as if it was done by your app.

Is this a concern in Electron? Yes and no. If your app is not dealing with secrets or if it's not codesigned, it's not an issue at all. However, if you would like to limit the code run under the identity of your app, it can be an issue.

This is being addressed in Electron in form of so-called "fuses", run-time toggles that can be switched on and off: https://github.com/electron/electron/pull/24241. These features should be eventually "fuses" but I'm too lazy to contribute to Electron because the patches we need are located in interesting, hard-to-reach pieces of code, for example in node.js or Chromium. This is not fun to change! In this sense this solution, or should I say this dirty hack, is a short-lived thing.

## Goals

- disable certain feature flags
- test on all supported operating systems
- have it right now, not in a year

## Non-goals

- do it all in a nice way
- support other features
- provide a long-term solution
- patch old Electron versions

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
node electron-evil-feature-patcher your-app-path
```

Using node.js:
```js
const patch = require('electron-evil-feature-patcher');
patch({ path: 'your-app-path' });
```

`your-app-path` is executable path, for macOS this is a packaged `.app`.

Patching is done in-place, no backup is made. Second attempt to patch will result in an error.

## Future

Let's admit that this is a big and terrible hack, a project like this shouldn't have been created. But that's where we are, we're patching a framework because it's so complicated to build that it's easier to do weird stuff and mess with a binary. Sadness. Disappointment. Disenchantment. Misery.

In future, as it's mentioned before, it will be done using electron "fuses". One of them is already in use here for `ELECTRON_RUN_AS_NODE`, and I hope others will be added as well! Then this project will be as small as flipping a couple of flags. But that's future.

## License

MIT
