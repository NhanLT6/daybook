import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  openFile: (extensions: string[]) => ipcRenderer.invoke('dialog:openFile', extensions),

  saveFile: (options: { name: string; extensions: string[] }[]) => ipcRenderer.invoke('dialog:saveFile', options),

  readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),

  writeFile: (filePath: string, content: string) => ipcRenderer.invoke('fs:writeFile', filePath, content),
});
