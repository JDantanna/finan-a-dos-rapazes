'use strict';
const {app,BrowserWindow,ipcMain,shell,dialog,safeStorage,session}=require('electron');
const fs=require('node:fs/promises');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {GoogleAuth,Vault,validateClient}=require('./oauth.cjs');
const {FinanceDrive}=require('./drive.cjs');
const {LocalFinance,CacheFile}=require('./local-cache.cjs');
const {Updates}=require('./updates.cjs');
const {pdfHtml}=require('../generated/shared.cjs');
const {autoUpdater}=require('electron-updater');
const ROOT=path.resolve(__dirname,'..');
let win,auth,drive,local,updates,loggingIn=false,closing=false,closePending=false,bootError='';
const page=name=>path.join(ROOT,name);
const clientFile=()=>path.join(app.getPath('userData'),'oauth-client.json');
async function config(){for(const file of [clientFile(),page('oauth-client.json')]){try{return validateClient(JSON.parse(await fs.readFile(file,'utf8')))}catch(e){if(e.code!=='ENOENT')throw e;}}return null;}
function trusted(event){
 if(event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame)throw Error('Origem não autorizada.');
 const url=event.senderFrame.url;
 if(![page('ui/login.html'),page('generated/index.html')].map(p=>pathToFileURL(p).href).includes(url))throw Error('Página não autorizada.');
}
async function login(interactive){
 if(loggingIn)throw Error('Aguarde a autorização atual.');loggingIn=true;
 try{const client=await config();if(!client)throw Error('O cliente Google para computador ainda não foi configurado.');
 auth=new GoogleAuth({client,vault:new Vault(app.getPath('userData'),safeStorage),openExternal:url=>shell.openExternal(url)});
 const identity=interactive?await auth.login():await auth.vault.read();const account=identity.sub;if(!account)throw Error('Conecte sua conta Google para criar a cópia local.');
 drive=new FinanceDrive(auth);local=new LocalFinance({cloud:drive,storage:new CacheFile(app.getPath('userData'),account,safeStorage),account});await local.open();local.start();await win.loadFile(page('generated/index.html'));setImmediate(()=>local?.synchronize().catch(()=>{}));
 }finally{loggingIn=false;}
}
function external(url){try{const u=new URL(url);return u.protocol==='https:'&&u.hostname==='drive.google.com'&&/^\/drive\/folders\/[\w-]+$/.test(u.pathname)}catch{return false;}}
async function exportPDF(payload,account){
 local.guard(account);const data=await local.loadFinance();
 const html=pdfHtml(payload,data.state.preferences?.userName||data.profile.name).replace('<head>','<head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; base-uri \'none\'">');
 const print=new BrowserWindow({show:false,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,javascript:false}});
 try{print.webContents.setWindowOpenHandler(()=>({action:'deny'}));await print.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(html));const bytes=await print.webContents.printToPDF({printBackground:true,pageSize:'A4',preferCSSPageSize:true});return{name:'relatorio-'+payload.start+'-'+payload.end+'.pdf',base64:bytes.toString('base64')};}finally{print.destroy();}
}
function installIPC(){
 const handle=(name,fn)=>ipcMain.handle('desktop:'+name,async(event,...args)=>{trusted(event);if(closePending)throw Error('O aplicativo está finalizando o salvamento local.');return fn(...args)});
 handle('status',async()=>({configured:!!await config(),version:app.getVersion(),error:bootError}));
 handle('login',()=>login(true));
 handle('logout',async()=>{if(local?.syncTask||local?.localWrites||loggingIn)throw Error('Aguarde a operação terminar.');local?.stop();await local?.flushLocal();await auth?.logout();local=null;drive=null;auth=null;await win.loadFile(page('ui/login.html'));});
 handle('import-client',async()=>{
  if(drive)throw Error('Saia da conta antes de configurar.');
  const result=await dialog.showOpenDialog(win,{title:'Cliente OAuth Google — App para computador',properties:['openFile'],filters:[{name:'JSON',extensions:['json']}]});
  if(result.canceled)return;const content=await fs.readFile(result.filePaths[0],'utf8');if(Buffer.byteLength(content)>20_000)throw Error('Configuração muito grande.');const client=validateClient(JSON.parse(content));await fs.mkdir(app.getPath('userData'),{recursive:true});await fs.writeFile(clientFile(),JSON.stringify({installed:client}),{mode:0o600});
 });
 handle('update',(action='check')=>{switch(action){case 'status':return updates.status();case 'check':return updates.check();case 'download':return updates.download();case 'install':return updates.install();default:throw Error('Operação de atualização não permitida.');}});
 handle('rpc',async(method,args)=>{
  if(!local)throw Error('Conecte sua conta Google.');if(!Array.isArray(args)||Buffer.byteLength(JSON.stringify(args))>4_100_000)throw Error('Dados excedem o limite.');
  switch(method){case'loadFinance':return local.loadFinance();case'saveFinance':return local.saveFinance(...args);case'listFinanceBackups':return local.listFinanceBackups(...args);case'restoreFinanceBackup':return local.restoreFinanceBackup(...args);case'openLocalFolder':{const directory=path.dirname(local.storage.file);await fs.mkdir(directory,{recursive:true});const error=await shell.openPath(directory);if(error)throw Error('Não foi possível abrir a pasta local.');return{ok:true};}case'syncStatus':return local.status();case'syncNow':return local.synchronize();case'resolveConflict':return local.resolveConflict(...args);case'exportFinancePdf':return exportPDF(...args);default:throw Error('Operação não permitida.');}
 });
}
if(!app.requestSingleInstanceLock())app.quit();
else {
 app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.focus();}});
 app.whenReady().then(async()=>{
  win=new BrowserWindow({icon:page('assets/icon.ico'),width:1360,height:900,minWidth:860,minHeight:650,show:false,autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}});
  win.webContents.setWindowOpenHandler(({url})=>{if(external(url))shell.openExternal(url);return{action:'deny'}});
  win.webContents.on('will-navigate',(event,url)=>{if(url!==win.webContents.getURL()){event.preventDefault();if(external(url))shell.openExternal(url);}});
  win.webContents.on('will-attach-webview',event=>event.preventDefault());
  session.defaultSession.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  session.defaultSession.on('will-download',(_event,item)=>{item.setSaveDialogOptions({defaultPath:path.join(app.getPath('downloads'),path.basename(item.getFilename()))});});
  win.on('close',event=>{if(closing)return;event.preventDefault();if(closePending)return;closePending=true;local?.stop();(local?.flushLocal()||Promise.resolve()).then(()=>{closing=true;win.close();}).catch(()=>{closePending=false;local?.start();dialog.showErrorBox('Salvamento local','Não foi possível finalizar a gravação. Mantenha o programa aberto e exporte uma cópia JSON.');});});
  updates=new Updates({updater:autoUpdater,app,isBusy:()=>!!local?.localWrites||!!local?.syncTask||loggingIn});installIPC();
  await win.loadFile(page('ui/login.html'));win.show();
  if(await config())try{await login(false)}catch(error){bootError=error.message;}
 }).catch(()=>{dialog.showErrorBox('Não foi possível iniciar','Verifique a configuração do aplicativo e tente novamente.');app.quit();});
 app.on('window-all-closed',()=>app.quit());
}
module.exports={external};
