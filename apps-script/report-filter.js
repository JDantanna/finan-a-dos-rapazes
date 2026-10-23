'use strict';
const ReportFilter=(()=>{
 function select(occurrences,kind='all',source=''){
  const items=occurrences.filter(o=>(kind!=='expense'||o.entry.kind==='expense')&&(!source||(o.entry.kind==='expense'&&o.entry.source===source)));
  let income=0,expense=0;for(const o of items){if(o.entry.kind==='income')income+=o.entry.cents;else expense+=o.entry.cents;}
  return {occurrences:items,income,expense,balance:income-expense};
 }
 function sources(state){return [...new Set([...(state.accounts||[]).map(a=>a.name),...state.entries.filter(e=>e.kind==='expense').map(e=>e.source)])].sort((a,b)=>a.localeCompare(b,'pt-BR'));}
 return {select,sources};
})();
if(typeof module!=='undefined')module.exports=ReportFilter;
