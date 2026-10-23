const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),DueReminders=require('../apps-script/reminders.js');
(async()=>{
let shown=0,otherDialog=false,calls=0;const nodes=new Map();function node(id){if(!nodes.has(id))nodes.set(id,{textContent:'',innerHTML:'',hidden:false,addEventListener(){},showModal(){shown++}});return nodes.get(id)}
const item={date:'2026-10-23',entry:{id:'r',description:'Aluguel',kind:'expense',cents:10000,source:'Conta',frequency:'monthly'}};
const ctx={DueReminders,Set,Date,document:{querySelector:s=>s==='dialog[open]'?(otherDialog?{}:null):node(s)},$:node,state:{preferences:{},reminders:{dismissed:[]}},scriptRecord:{profile:{sub:'a'},revision:'1'},report:{},saving:false,scriptBusy:false,today:()=> '2026-10-23',iso:d=>d.toISOString().slice(0,10),esc:String,money:String,human:String,frequencies:{monthly:'Mensal'},rustReport:async()=>{calls++;return{occurrences:[item]}},updatePaymentFields(){}};
vm.createContext(ctx);const source=fs.readFileSync('apps-script/reminder-view.js','utf8').split('const dueDialog=')[0];vm.runInContext(source,ctx);
await vm.runInContext('checkDueDates()',ctx);assert.equal(shown,1);await vm.runInContext("dueCheckKey='';checkDueDates()",ctx);assert.equal(shown,1);
ctx.state.reminders.dismissed=[DueReminders.key(item)];await vm.runInContext("dueCheckKey='';checkDueDates()",ctx);assert.equal(node('#due-banner').hidden,true);
ctx.state.reminders.dismissed=[];ctx.state.preferences.reminderEnabled=false;await vm.runInContext("dueCheckKey='';checkDueDates()",ctx);assert.equal(node('#due-banner').hidden,true);
ctx.state.preferences.reminderEnabled=true;ctx.saving=true;const before=calls;await vm.runInContext("dueCheckKey='';checkDueDates()",ctx);assert.equal(calls,before);ctx.saving=false;
vm.runInContext('dueSeen.clear()',ctx);otherDialog=true;await vm.runInContext("dueCheckKey='';checkDueDates()",ctx);assert.equal(shown,1);otherDialog=false;await vm.runInContext("dueCheckKey='';checkDueDates()",ctx);assert.equal(shown,2);
console.log('Popup: vencimento de hoje, uma abertura por sessão, dispensar, desativar, aguardar salvamento e respeitar outro diálogo passaram.');
})().catch(e=>{console.error(e);process.exitCode=1});
