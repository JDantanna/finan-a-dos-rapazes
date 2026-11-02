'use strict';
// Deterministic, dependency-free interpretation. No network or bank credentials.
const NubankImport=(()=>{
 const MAX_BYTES=5_000_000,MAX_ROWS=10000;
 const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
 const encoder=new TextEncoder(),bytes=s=>encoder.encode(s).length;
 function date(value){let s=String(value).trim(),m;if((m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s)))s=`${m[3]}-${m[2]}-${m[1]}`;else if((m=/^(\d{4})(\d{2})(\d{2})(?:\d{6}(?:\.\d+)?(?:\[[^\]]+\])?)?$/.exec(s)))s=`${m[1]}-${m[2]}-${m[3]}`;if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||s<'1900-01-01'||s>'2200-12-31'||!Number.isFinite(Date.parse(s+'T12:00:00Z'))||new Date(s+'T12:00:00Z').toISOString().slice(0,10)!==s)throw Error('data inválida');return s;}
 function amount(value){let s=String(value).trim().replace(/^R\$\s*/,'');if(s.includes(',')){if(!/^[+-]?(?:\d+|\d{1,3}(?:\.\d{3})+),\d{2}$/.test(s))throw Error('valor inválido');s=s.replaceAll('.','').replace(',','.');}if(!/^[+-]?\d+(?:\.\d{1,2})?$/.test(s))throw Error('valor inválido');const negative=s[0]==='-',parts=s.replace(/^[+-]/,'').split('.'),n=Number(parts[0])*100+Number((parts[1]||'').padEnd(2,'0'));if(!Number.isSafeInteger(n)||n>100000000000)throw Error('valor fora do limite');return negative?-n:n;}
 function csv(text){const rows=[];let row=[],cell='',quoted=false,closed=false;const first=text.split(/\r?\n/,1)[0],sep=first.split(';').length>first.split(',').length?';':',';
  for(let i=0;i<=text.length;i++){const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else if(c===undefined)throw Error('CSV com aspas não fechadas.');else cell+=c;continue;}if(c==='"'&&!cell&&!closed){quoted=true;continue;}if(c===sep||c==='\n'||c==='\r'||c===undefined){row.push(cell);cell='';closed=false;if(c!==sep){if(row.some(x=>x.trim()))rows.push(row);row=[];if(c==='\r'&&text[i+1]==='\n')i++;if(rows.length>MAX_ROWS+1)throw Error('Limite de 10.000 movimentos por arquivo.');}}else{if(closed)throw Error('CSV inválido após fechamento de aspas.');cell+=c;}}
  return rows;
 }
 const decode=s=>s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&#(x[0-9a-f]+|\d+);/gi,(_,v)=>{const n=v[0].toLowerCase()==='x'?parseInt(v.slice(1),16):+v;return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';}).replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&quot;/gi,'"').replace(/&apos;/gi,"'").replace(/&amp;/gi,'&');
 function shorten(text,max){let result='',length=0;for(const char of text){const size=bytes(char);if(length+size>max)break;result+=char;length+=size;}return result.trim();}
 function parse(text,options={}){
  if(options.type&&!['checking','credit'].includes(options.type))throw Error('Tipo de extrato inválido.');if(typeof text!=='string'||bytes(text)>MAX_BYTES)throw Error('Selecione um arquivo de até 5 MB.');text=text.replace(/^\uFEFF/,'').trim();if(!text)throw Error('O arquivo está vazio.');if(text.startsWith('%PDF'))throw Error('Use o leitor de fatura PDF do aplicativo.');let type,raw=[];
  if(/<OFX[>\s]/i.test(text)){if(/<!DOCTYPE|<!ENTITY/i.test(text))throw Error('OFX com declaração externa não é aceito.');const card=/<CCSTMTRS[>\s]/i.test(text),bank=/<STMTRS[>\s]/i.test(text);if(card===bank)throw Error('OFX deve conter somente uma conta ou um cartão.');type=card?'credit':'checking';if((text.match(/<(?:CCSTMTRS|STMTRS)[>\s]/gi)||[]).length!==1)throw Error('Importe uma conta por arquivo.');
   const blocks=text.split(/<STMTTRN\s*>/i).slice(1);if(blocks.length>MAX_ROWS)throw Error('Limite de 10.000 movimentos por arquivo.');raw=blocks.map((block,i)=>{block=block.split(/<\/STMTTRN>|<\/BANKTRANLIST>/i)[0];const tag=name=>{const m=new RegExp('<'+name+'\\s*>\\s*([^<]*)','i').exec(block);return m?decode(m[1].trim()):'';};return{date:tag('DTPOSTED'),amount:tag('TRNAMT'),description:[tag('NAME'),tag('MEMO')].filter((s,i,a)=>s&&a.indexOf(s)===i).join(' · '),external:tag('FITID'),line:i+1,ofx:true};});
  }else{const rows=csv(text),header=(rows.shift()||[]).map(norm),at=(...names)=>header.findIndex(h=>names.includes(h)),d=at('data','date'),v=at('valor','amount'),desc=at('descricao','description','title','titulo'),id=at('identificador','identifier','id');if(d<0||v<0||desc<0)throw Error('CSV não reconhecido. Use o arquivo original do Nubank (Data, Valor, Descrição ou date, title, amount).');type=options.type||(id>=0?'checking':header.some(h=>['categoria','category','title','titulo'].includes(h))?'credit':header.includes('descricao')?'checking':'credit');raw=rows.map((r,i)=>{if(r.length!==header.length)throw Error(`Linha ${i+2}: quantidade de colunas inválida.`);return{date:r[d],amount:r[v],description:r[desc],external:id>=0?r[id]:'',line:i+2};});}
  if(options.type&&type!==options.type)throw Error('O tipo selecionado não corresponde ao OFX. Escolha a fonte correta.');
  const dueDate=options.dueDate?date(options.dueDate):null;if(dueDate&&type!=='credit')throw Error('Vencimento só se aplica à fatura de cartão.');
  let zeros=0;const rows=raw.map(r=>{try{const signed=amount(r.amount),originalDescription=String(r.description).trim().normalize('NFC'),description=shorten(originalDescription,200);if(!description||bytes(originalDescription)>2000)throw Error('descrição vazia ou acima de 2.000 bytes');if(r.external.length>200)throw Error('identificador muito longo');const when=date(r.date);if(!signed){zeros++;return null;}const kind=type==='credit'&&!r.ofx?(signed>0?'expense':'income'):(signed<0?'expense':'income');const text=norm(originalDescription),payment=/(pagamento|pagt[o.]?|debito).*(fatura)|pagamento recebido/.test(text),transfer=/(transferencia entre|entre (minhas|suas) contas|aplicacao|resgate|caixinha|rdb|investimento)/.test(text),refund=type==='credit'&&kind==='income'&&!payment;return{date:dueDate||when,...(dueDate?{originalDate:when,statementDueDate:dueDate}:{}),cents:Math.abs(signed),description,originalDescription,external:r.external,kind,line:r.line,selected:!payment&&!transfer,warning:payment?'Pagamento de fatura: excluído para evitar dupla contagem.':transfer?'Possível transferência ou investimento: revise antes de incluir.':refund?'Crédito/estorno: será registrado como receita; revise.':'',category:'Outros'};}catch(e){throw Error(`Movimento ${r.line}: ${e.message}. Nenhum dado foi importado.`);}}).filter(Boolean);
  if(!rows.length)throw Error('O arquivo não contém movimentos com valor diferente de zero.');return{type,rows,zeros};
 }
 function signature(e,account){return JSON.stringify([e.date,e.kind,e.cents,norm(e.description),norm(account)]);}
 async function prepare(parsed,state,account,hash){if(!account||account.type!==parsed.type)throw Error('Escolha uma fonte do tipo correto.');const accountName=norm(account.name),ids=new Set(state.entries.map(e=>e.id)),existing=new Map(),counts=new Map();for(const e of state.entries){const source=e.kind==='income'?e.account:e.source;if(norm(source)!==accountName)continue;const key=signature(e,source);existing.set(key,(existing.get(key)||0)+1);}const external=new Map();const result=[];
  for(const row of parsed.rows){const identity=row.external?JSON.stringify(['id',row.external]):JSON.stringify(['row',row.originalDate||row.date,row.kind,row.cents,norm(row.originalDescription||row.description)]),ordinal=(counts.get(identity)||0)+1;counts.set(identity,ordinal);const sourceKey=account.id;const baseKey=row.external?identity:identity+'#'+ordinal;const key=row.statementDueDate?JSON.stringify([baseKey,'bill',row.statementDueDate]):baseKey;const id='nu-'+await hash(JSON.stringify([parsed.type,sourceKey,key]));const fingerprint=signature(row,account.name);let duplicate=ids.has(id),reason=duplicate?'Já importado.':'';
   if(row.external&&external.has(row.external)){if(external.get(row.external)!==signature(row,''))throw Error('O arquivo repete um identificador com valores diferentes.');duplicate=true;reason='Identificador repetido no arquivo.';}external.set(row.external,signature(row,''));
   if(duplicate&&(existing.get(fingerprint)||0)>0)existing.set(fingerprint,existing.get(fingerprint)-1);
   if(!duplicate&&(existing.get(fingerprint)||0)>0){duplicate=true;reason='Possível duplicata de um lançamento existente.';existing.set(fingerprint,existing.get(fingerprint)-1);}
   result.push({...row,id,duplicate,reason,selected:row.selected&&!duplicate});
  }return result;
 }
 function entries(rows,account){return rows.filter(r=>r.selected&&!r.duplicate).map(r=>({id:r.id,description:r.description,kind:r.kind,cents:r.cents,category:r.category,source:r.kind==='income'?(account.type==='credit'?'Estorno Nubank':'Recebimentos Nubank'):account.name,account:r.kind==='income'?account.name:'',date:date(r.date),frequency:'once',end_date:null,...(r.originalDate?{importOriginalDate:r.originalDate}:{}),...(r.statementDueDate?{importStatementDueDate:r.statementDueDate}:{}),...(r.originalDescription&&r.originalDescription!==r.description?{importOriginalDescription:r.originalDescription}:{})}));}

 // PDF transactions are reconstructed from their text coordinates by nubank-pdf.js.
 // A due date supplied by the user resolves year boundaries and the reporting month.
 function parsePdfLines(lines,{dueDate}={}){
  const due=date(dueDate),text=lines.join('\n');
  if(!/nubank|nu pagamentos/i.test(text)||!/fatura|cart[aã]o de cr[eé]dito/i.test(text))throw Error('PDF não reconhecido como fatura de cartão Nubank. Use o CSV ou OFX original.');
  if(!/transa[cç][oõ]es|compras/i.test(text))throw Error('Não foi encontrada a seção de compras da fatura.');
  const months=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  const prefix=/^(\d{1,2})(?:\s*[/.-]\s*(\d{2})(?:\s*[/.-]\s*(\d{4}))?|\s+([a-zç]{3,9})(?:\s+(\d{4}))?)\s+(.+)$/i;
  const money=/(?:[-−–]\s*)?(?:R\$\s*)?[-−–]?\s*(?:\d{1,3}(?:\.\d{3})*|\d+),\d{2}\s*$/;
  const data=[],errors=[];let pending=null,section=false;
  const flush=()=>{if(pending)errors.push(pending);pending=null;};
  function consume(line){const m=prefix.exec(line);if(!m){errors.push(line);return false;}const match=money.exec(m[6]);if(!match||match.index===0){pending=line;return true;}const description=m[6].slice(0,match.index).trim();if(!description){errors.push(line);return true;}
   const month=m[2]?Number(m[2]):months.indexOf(norm(m[4]).slice(0,3))+1;
   if(!month||month>12)throw Error('Mês não reconhecido em um movimento do PDF.');
   const year=Number(m[3]||m[5])||(Number(due.slice(0,4))-(month>Number(due.slice(5,7))?1:0));
   const original=date(`${year}-${String(month).padStart(2,'0')}-${m[1].padStart(2,'0')}`);
   data.push([original,description,match[0].replace(/[−–]/g,'-').replace(/R\$\s*/,'').replace(/\s+/g,'')]);
   if(data.length>MAX_ROWS)throw Error('Limite de 10.000 movimentos por arquivo.');return true;
  }
  for(const raw of lines){const line=raw.replace(/\s+/g,' ').trim();if(!line)continue;
   if(/^(transa[cç][oõ]es|compras)(?:\s|$)/i.test(line)){flush();section=true;continue;}
   if(/^(resumo|limites? dispon[ií]ve|op[cç][oõ]es de pagamento|encargos|juros|pr[oó]xima fatura|total (?:a pagar|da fatura)|pagamento m[ií]nimo)/i.test(line)){flush();section=false;continue;}
   if(!section)continue;
   if(prefix.test(line)){flush();consume(line);continue;}
   if(/^\d{1,2}(?:\s*[/.-]\s*\d|\s+[a-zç]{3,9}(?:\s|$))|^\d{4}-\d{2}-\d{2}/i.test(line)){flush();pending=line;continue;}
   if(pending){const combined=pending+' '+line;pending=null;consume(combined);}
  }
  flush();if(errors.length)throw Error(`Não foi possível interpretar ${errors.length} linha(s) datada(s) do PDF. Nenhum movimento foi importado; use CSV/OFX para evitar omissões.`);
  if(!data.length)throw Error('Nenhuma compra legível encontrada. PDF digitalizado ou layout não reconhecido: use CSV/OFX.');
  const cell=s=>'"'+String(s).replaceAll('"','""')+'"';
  return parse('date,title,amount\n'+data.map(row=>row.map(cell).join(',')).join('\n'),{type:'credit',dueDate:due});
 }

 return{parse,parsePdfLines,prepare,entries,date,amount,MAX_BYTES,MAX_ROWS};
})();
if(typeof module!=='undefined')module.exports=NubankImport;
