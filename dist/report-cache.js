'use strict';
const ReportCache=(()=>{
 function create(calculate,limit=3){
  let currentState;const cache=new Map();
  return function(state,start,end,day){
   if(currentState!==state){currentState=state;cache.clear();}
   const key=JSON.stringify([start,end,day]);
   if(cache.has(key))return cache.get(key);
   // The Rust financial core only consumes these fields. Account metadata stays outside WASM.
   const task=Promise.resolve().then(()=>calculate({state:{entries:state.entries,goals:state.goals,demo:state.demo},start,end,today:day}));
   cache.set(key,task);if(cache.size>limit)cache.delete(cache.keys().next().value);
   task.catch(()=>{if(cache.get(key)===task)cache.delete(key);});return task;
  };
 }
 return {create};
})();
if(typeof module!=='undefined')module.exports=ReportCache;
