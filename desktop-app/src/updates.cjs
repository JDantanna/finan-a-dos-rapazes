'use strict';
// Only packaged GitHub Releases are executable updates. Never run repository scripts.
class Updates{
 constructor({updater,dialog,app,window,isBusy}){
  Object.assign(this,{updater,dialog,app,window,isBusy});this.busy=false;
  updater.autoDownload=false;updater.autoInstallOnAppQuit=false;updater.allowPrerelease=false;updater.allowDowngrade=false;
  // electron-updater verifies the SHA-512 supplied by the GitHub release manifest.
  updater.on('error',()=>{}); // Errors are surfaced by the awaited IPC operation.
 }
 async check(){
  if(!this.app.isPackaged)return {message:'A consulta de atualização estará disponível na versão instalada. Versão '+this.app.getVersion()+'.'};
  if(this.busy)return {message:'Já existe uma consulta de atualização em andamento.'};
  this.busy=true;try{
   const result=await this.updater.checkForUpdates();
   if(!result?.isUpdateAvailable)return{message:'Você está na versão mais recente: '+this.app.getVersion()+'.'};
   const answer=await this.dialog.showMessageBox(this.window(),{type:'info',buttons:['Baixar atualização','Agora não'],cancelId:1,defaultId:1,title:'Atualização disponível',message:'Versão '+result.updateInfo.version+' disponível no GitHub.',detail:'A atualização substitui o programa. Seus dados permanecem no Google Drive.'});
   if(answer.response!==0)return{message:'Atualização disponível. Você pode baixá-la depois.'};
   await this.updater.downloadUpdate();
   if(this.isBusy())return{message:'Atualização baixada. Aguarde o salvamento e clique em Checar atualização novamente para instalar.'};
   const install=await this.dialog.showMessageBox(this.window(),{type:'question',buttons:['Reiniciar e instalar','Depois'],cancelId:1,defaultId:1,message:'Atualização pronta para instalar.',detail:'Finalize os formulários abertos antes de continuar. O programa será fechado e reiniciado.'});
   if(install.response===0&&!this.isBusy()){this.updater.quitAndInstall(false,true);return{message:'Instalando atualização…'};}
   return{message:'Atualização baixada. Instalação adiada.'};
  }catch(e){throw Error('Não foi possível consultar ou baixar a atualização. Verifique a internet e se existe uma versão publicada no GitHub.');}
  finally{this.busy=false;}
 }
}
module.exports={Updates};
