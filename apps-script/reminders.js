'use strict';
const DueReminders=(()=>{
 const key=o=>JSON.stringify([o.entry.id,o.date]);
 function select(occurrences,today,end,dismissed=[]){const ignored=new Set(dismissed);return occurrences.filter(o=>o.entry.frequency!=='once'&&o.date>=today&&o.date<=end&&!ignored.has(key(o))).sort((a,b)=>a.date.localeCompare(b.date)||a.entry.description.localeCompare(b.entry.description,'pt-BR'));}
 return {key,select};
})();
if(typeof module!=='undefined')module.exports=DueReminders;
