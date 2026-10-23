'use strict';
// Only packaged GitHub Releases are executable updates. Never run repository scripts.
class Updates{
 constructor({updater,app,isBusy}){
  Object.assign(this,{updater,app,isBusy});this.busy=false;
  this.state={phase:'idle',version:app.getVersion(),nextVersion:'',percent:0,message:'Consulte as atualizações do aplicativo.'};
  updater.autoDownload=false;updater.autoInstallOnAppQuit=false;updater.allowPrerelease=false;updater.allowDowngrade=false;
  updater.on('error',()=>{if(this.state.phase==='installing')this.set({phase:'ready',message:'Não foi possível iniciar a instalação. Tente reiniciar e atualizar novamente.'});}); // Awaited operations surface errors inside the application.
  updater.on('download-progress',p=>{if(this.state.phase==='downloading')this.set({percent:Math.max(0,Math.min(100,Number(p.percent)||0))});});
 }
 status(){return {...this.state};}
 set(change){Object.assign(this.state,change);return this.status();}
 async check(){
  if(this.busy||['ready','installing'].includes(this.state.phase))return this.status();
  if(!this.app.isPackaged)return this.set({phase:'current',message:'A consulta estará disponível na versão instalada. Versão '+this.app.getVersion()+'.'});
  this.busy=true;this.set({phase:'checking',message:'Consultando o GitHub…'});
  try{const result=await this.updater.checkForUpdates();return this.set(result?.isUpdateAvailable?{phase:'available',nextVersion:result.updateInfo.version,percent:0,message:'Versão '+result.updateInfo.version+' disponível.'}:{phase:'current',nextVersion:'',message:'Você está na versão mais recente: '+this.app.getVersion()+'.'});}
  catch{return this.set({phase:'error',message:'Não foi possível consultar a atualização. Verifique a conexão e tente novamente.'});}
  finally{this.busy=false;}
 }
 async download(){
  if(this.busy||this.state.phase!=='available')return this.status();
  this.busy=true;this.set({phase:'downloading',percent:0,message:'Baixando a atualização. Você pode continuar usando o aplicativo.'});
  try{await this.updater.downloadUpdate();return this.set({phase:'ready',percent:100,message:'Atualização pronta. Salve os formulários abertos antes de reiniciar. Seus dados locais e do Drive serão preservados.'});}
  catch{return this.set({phase:'available',percent:0,message:'O download falhou. Sua versão continua funcionando. Tente baixar novamente.'});}
  finally{this.busy=false;}
 }
 install(){
  if(this.busy||this.state.phase!=='ready')return this.status();
  if(this.isBusy())return this.set({message:'Aguarde o salvamento ou a sincronização terminar e tente reiniciar novamente.'});
  this.set({phase:'installing',message:'Reiniciando para concluir a atualização…'});
  // electron-updater 6: silent NSIS install, then reopen the app. No installer wizard.
  try{this.updater.quitAndInstall(true,true);}catch{this.set({phase:'ready',message:'Não foi possível iniciar a instalação. Tente novamente.'});}return this.status();
 }
}
module.exports={Updates};
