'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('desktop',Object.freeze({
 status:()=>ipcRenderer.invoke('desktop:status'),
 login:()=>ipcRenderer.invoke('desktop:login'),
 logout:()=>ipcRenderer.invoke('desktop:logout'),
 importClient:()=>ipcRenderer.invoke('desktop:import-client'),
 rpc:(method,...args)=>ipcRenderer.invoke('desktop:rpc',method,args),
 checkUpdate:()=>ipcRenderer.invoke('desktop:update')
}));
