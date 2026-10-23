'use strict';
const Categories=(()=>{
 const defaults=[['Moradia','🏠','#4876b8'],['Alimentação','🍽️','#da7b2b'],['Transporte','🚗','#7461b8'],['Saúde','❤️','#cd5268'],['Lazer','🎮','#26938c'],['Salário','💼','#40834d'],['Trabalho extra','🛠️','#976c39'],['Outros','📦','#737d89']].map(([name,symbol,color],i)=>({id:'category-default-'+i,name,symbol,color}));
 const key=s=>s.trim().normalize('NFC').toLocaleLowerCase('pt-BR');
 const bytes=s=>encodeURIComponent(s).replace(/%[0-9A-F]{2}|[^%]/g,'x').length;
 function validate(items){
  if(items==null)return defaults.map(x=>({...x}));
  if(!Array.isArray(items)||items.length>1000)throw Error('Cadastro de categorias inválido.');
  const ids=new Set(),names=new Set();
  return items.map(c=>{
   if(!c||typeof c.id!=='string'||!c.id.trim()||c.id.length>200||ids.has(c.id)||typeof c.name!=='string'||!c.name.trim()||bytes(c.name.trim().normalize('NFC'))>80||names.has(key(c.name))||typeof c.symbol!=='string'||!c.symbol.trim()||Array.from(c.symbol.trim()).length>16||bytes(c.symbol.trim())>48||typeof c.color!=='string'||!/^#[a-f0-9]{6}$/i.test(c.color))throw Error('Informe um nome curto e único, um símbolo curto e uma cor válida.');
   ids.add(c.id);names.add(key(c.name));return{id:c.id,name:c.name.trim().normalize('NFC'),symbol:c.symbol.trim(),color:c.color.toLowerCase()};
  });
 }
 function upsert(state,item){const next=structuredClone(state),items=validate(next.categories),old=items.find(x=>x.id===item.id);next.categories=validate([...items.filter(x=>x.id!==item.id),item]);const saved=next.categories.find(x=>x.id===item.id);if(old&&old.name!==saved.name)for(const e of next.entries)if(key(e.category)===key(old.name))e.category=saved.name;return next;}
 function remove(state,id){const next=structuredClone(state);next.categories=validate(next.categories).filter(c=>c.id!==id);return next;}
 const indexes=new WeakMap();
 function index(state){const items=state.categories??defaults;let map=indexes.get(items);if(!map){map=new Map(validate(items).map(c=>[key(c.name),c]));indexes.set(items,map);}return map;}
 function appearance(state,name){const found=index(state).get(key(name));if(found)return found;let hash=0;for(const char of name)hash=(hash*31+char.codePointAt(0))>>>0;return{name,symbol:'●',color:defaults[hash%defaults.length].color};}
 function options(state,query=''){const map=new Map(validate(state.categories).map(c=>[key(c.name),c]));for(const e of state.entries||[])if(!map.has(key(e.category)))map.set(key(e.category),appearance(state,e.category));return [...map.values()].filter(c=>key(c.name).includes(key(query))).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));}
 return{validate,upsert,remove,appearance,options,key};
})();
if(typeof module!=='undefined')module.exports=Categories;
