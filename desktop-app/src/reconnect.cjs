'use strict';
// Reauthorize the same profile without replacing its local state or sync journal.
async function reconnectGoogle({local,drive,createAuth}){
 if(!local||!drive||local.status().localMode)throw Error('Abra o perfil Google anterior para reconectar.');
 if(local.syncTask||local.localWrites)throw Error('Aguarde a gravação ou sincronização terminar antes de reconectar.');
 local.stop();
 try{
  await local.flushLocal();
  const nextAuth=createAuth();
  const profile=await nextAuth.login({expectedAccount:local.account});
  local.guard(profile.sub);
  drive.auth=nextAuth;
  return nextAuth;
 }finally{local.start();}
}
module.exports={reconnectGoogle};
