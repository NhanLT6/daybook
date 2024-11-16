# Add Electron

## Install required packages

```bash
  yarn add -D electron vite-plugin-electron electron-builder
```
See [electron](https://www.electronjs.org/docs/latest/tutorial/installation) for more information.

## Add Electron configuration

Follow instructions from [vite-plugin-electron](https://github.com/electron-vite/vite-plugin-electron) which contains these steps:

* Create `electron` folder in the root of the project.
* In `electron` folder, add following files: `main.ts`, `preload.ts`
* Update `vite.config.ts` to include the Electron plugin.
* Update `package.json` to add `main` entry point for electron.

## Add Electron Builder

In project root, add `electron-builder.json` file. This file defines the build configuration for the Electron app.

In `package.json`, add following scripts to build the Electron app.
