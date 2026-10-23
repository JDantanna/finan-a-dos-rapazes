'use strict';
const MoneyInput=(()=>{
 const MAX=100_000_000_000;
 const formatter=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
 const format=n=>formatter.format(n/100);
 function parse(text){let s=String(text).trim().replace(/^R\$\s*/,'').replace(/\u00a0/g,'');if(!s||s.includes('-'))throw Error('Informe um valor monetário válido.');if(s.includes(',')){if(!/^(?:\d+|\d{1,3}(?:\.\d{3})+),\d{1,2}$/.test(s))throw Error('Informe um valor como R$ 1.234,56.');s=s.replaceAll('.','').replace(',','.')}if(!/^\d+(?:\.\d{1,2})?$/.test(s))throw Error('Informe um valor monetário válido.');const[a,b='']=s.split('.');const n=Number(a)*100+Number(b.padEnd(2,'0'));if(!Number.isSafeInteger(n)||n>MAX)throw Error('Valor acima do limite.');return n;}
 function bind(input){
  input.addEventListener('input',()=>{
   const raw=input.value,position=input.selectionStart??raw.length,right=(raw.slice(position).match(/\d/g)||[]).length;
   if(/[^\dR$\s.,]/i.test(raw)||raw.includes('-')){input.setCustomValidity('Digite somente um valor positivo.');return}
   const digits=raw.replace(/\D/g,'');const amount=Number(digits||0);
   if(!Number.isSafeInteger(amount)||amount>MAX){input.setCustomValidity('Valor acima do limite.');return}
   input.setCustomValidity('');input.value=digits?format(amount):'';
   let caret=input.value.length,remaining=right;while(caret>0&&remaining>0){caret--;if(/\d/.test(input.value[caret]))remaining--}input.setSelectionRange(caret,caret);
  });
  input.addEventListener('paste',event=>{event.preventDefault();try{input.value=format(parse(event.clipboardData.getData('text')));input.setCustomValidity('');input.setSelectionRange(input.value.length,input.value.length)}catch(e){input.setCustomValidity(e.message);input.reportValidity()}});
  input.addEventListener('blur',()=>{if(!input.value){input.value=format(0);input.setCustomValidity('')}});
 }
 function reset(form){form.querySelectorAll('[data-money]').forEach(input=>{input.setCustomValidity('');input.value=format(0)})}
 document.querySelectorAll('[data-money]').forEach(bind);
 return{format,parse,reset};
})();
