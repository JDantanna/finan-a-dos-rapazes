'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createHash,webcrypto}=require('node:crypto');
const {spawnSync}=require('node:child_process');
const os=require('node:os');
const {JSDOM}=require('jsdom');
const Nu=require('../ui/nubank-import.js');
const Pdf=require('../ui/nubank-pdf.js');
const {validate}=require('../generated/shared.cjs');
const card={id:'card-nu',name:'Cartão Nubank',type:'credit'},empty={entries:[],goals:[],accounts:[card],incomeSources:[]};
const hash=async value=>createHash('sha256').update(value).digest('hex');
const lines=['Nubank','Fatura de cartão de crédito','TRANSAÇÕES DE 01 OUT A 31 OUT','23 OUT Supermercado R$ 120,50','24 OUT Loja - Parcela 2/4 R$ 99,90','25 OUT Estorno de compra -R$ 20,00','26 OUT Pagamento recebido -R$ 200,40','Total da fatura R$ 0,00','Resumo de encargos','27 OUT Não deve ser importado R$ 300,00'];
test('Fatura PDF: compras, parcela, estorno e pagamento com mês do vencimento e data original',async()=>{
 const p=Nu.parsePdfLines(lines,{dueDate:'2026-11-10'});assert.equal(p.type,'credit');assert.equal(p.rows.length,4);assert.equal(p.rows[0].date,'2026-11-10');assert.equal(p.rows[0].originalDate,'2026-10-23');assert.deepEqual(p.rows.map(r=>[r.kind,r.cents,r.selected]),[['expense',12050,true],['expense',9990,true],['income',2000,true],['income',20040,false]]);
 const prepared=await Nu.prepare(p,empty,card,hash),entries=Nu.entries(prepared,card);assert.equal(entries.length,3);assert.equal(entries[0].importOriginalDate,'2026-10-23');assert.equal(entries[0].importStatementDueDate,'2026-11-10');assert(entries.every(e=>e.frequency==='once'));assert.doesNotThrow(()=>validate({...empty,entries}));
 const second=await Nu.prepare(p,{...empty,entries},card,hash);assert(second.slice(0,3).every(r=>r.duplicate));
});
test('Fatura PDF: virada do ano, linhas quebradas e compra de outra fatura não bloqueada',async()=>{
 const p=Nu.parsePdfLines(['Nubank fatura cartão de crédito','COMPRAS','23 DEZ Loja parcelada','R$ 99,90','02 JAN Outra R$ 1.000,01'],{dueDate:'2027-01-10'});assert.equal(p.rows[0].originalDate,'2026-12-23');assert.equal(p.rows[1].originalDate,'2027-01-02');assert.equal(p.rows[1].cents,100001);const split=Nu.parsePdfLines(['Nubank fatura','COMPRAS','2 JAN','Loja R$ 10,00'],{dueDate:'2027-01-10'});assert.equal(split.rows[0].originalDate,'2027-01-02');
 const one=await Nu.prepare(p,empty,card,hash),entries=Nu.entries(one,card),next=Nu.parsePdfLines(['Nubank fatura cartão de crédito','COMPRAS','23 DEZ Loja parcelada R$ 99,90'],{dueDate:'2027-02-10'});assert(!(await Nu.prepare(next,{...empty,entries},card,hash))[0].duplicate);
});
test('Fatura PDF: falha fechada para documento desconhecido, linha não interpretada ou data inválida',()=>{
 for(const [l,opts] of [[lines,{}],[['Outro banco','Fatura','COMPRAS','23 OUT Loja R$ 10,00'],{dueDate:'2026-11-10'}],[['Nubank fatura','COMPRAS','23 OUT Loja sem valor'],{dueDate:'2026-11-10'}],[['Nubank fatura','COMPRAS','31 FEV Loja R$ 10,00'],{dueDate:'2026-11-10'}],[['Nubank fatura sem texto de compras'],{dueDate:'2026-11-10'}],[['Nubank fatura','COMPRAS','23 OUT Loja R$ 10,00','2026-10-24 Outra R$ 1,00'],{dueDate:'2026-11-10'}]])assert.throws(()=>Nu.parsePdfLines(l,opts));
});
test('Fatura CSV em português: seleção explícita corrige sinal e distingue conta de cartão',()=>{
 const csv='Data;Descrição;Valor\n23/10/2026;Loja;120,50\n24/10/2026;Estorno;-20,00';const p=Nu.parse(csv,{type:'credit',dueDate:'2026-11-10'});assert.equal(p.type,'credit');assert.equal(p.rows[0].kind,'expense');assert.equal(p.rows[1].kind,'income');assert.equal(p.rows[0].date,'2026-11-10');assert.equal(Nu.parse(csv,{type:'checking'}).rows[0].kind,'income');assert.throws(()=>Nu.parse(csv,{type:'checking',dueDate:'2026-11-10'}));
 assert.equal(Nu.parse('Data;Categoria;Descrição;Valor\n23/10/2026;Outros;Loja;120,50').type,'credit');assert.throws(()=>Nu.parse('<OFX><STMTRS><STMTTRN><DTPOSTED>20261023<TRNAMT>-1<FITID>a<MEMO>Loja</STMTTRN></STMTRS></OFX>',{type:'credit'}));
});
test('Coordenadas PDF: texto reordenado em linhas sem depender da ordem dos objetos',()=>{
 const items=[{str:'R$ 10,00',transform:[1,0,0,1,400,500]},{str:'Loja',transform:[1,0,0,1,90,500.5]},{str:'23 OUT',transform:[1,0,0,1,20,500]},{str:'Nubank',transform:[1,0,0,1,20,700]}];assert.deepEqual(Pdf.linesFromItems(items),['Nubank','23 OUT Loja R$ 10,00']);
});
// Tiny in-memory PDF with text at actual coordinates: tests the real PDF.js extractor.
function fixture(){
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
 const lines=['Nubank','Fatura de cartao de credito','COMPRAS','23 OUT Supermercado R$ 120,50','24 OUT Loja - Parcela 2/4 R$ 99,90','25 OUT Estorno -R$ 20,00'];
 const content=lines.map((line,i)=>`BT /F1 12 Tf 30 ${780-i*25} Td (${line}) Tj ET`).join('\n');objects.push(`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`);
 let output='%PDF-1.4\n',offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(output));output+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}const offset=Buffer.byteLength(output);output+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Root 1 0 R /Size ${objects.length+1} >>\nstartxref\n${offset}\n%%EOF\n`;return new Uint8Array(Buffer.from(output));
}
test('PDF real em memória: PDF.js extrai compras e os valores esperados',async()=>{
 const pdf=await import('pdfjs-dist/legacy/build/pdf.mjs'),task=pdf.getDocument({data:fixture(),isEvalSupported:false,disableFontFace:true,useSystemFonts:false,verbosity:0});
 try{const doc=await task.promise,content=await(await doc.getPage(1)).getTextContent(),parsed=Nu.parsePdfLines(Pdf.linesFromItems(content.items),{dueDate:'2026-11-10'});assert.equal(parsed.rows.length,3);assert.equal(parsed.rows.reduce((sum,r)=>sum+(r.kind==='expense'?r.cents:-r.cents),0),20040);}finally{await task.destroy();}
});
async function until(check){for(let i=0;i<150;i++){if(check())return;await new Promise(r=>setTimeout(r,5));}throw Error('Interface não concluiu');}
test('Interface de cartão: vencimento, categoria editável, salvamento local e reimportação',async()=>{
 const root=path.join(__dirname,'../generated/'),dom=new JSDOM(fs.readFileSync(root+'index.html','utf8'),{runScripts:'outside-only',url:'https://test.invalid'}),w=dom.window;let state=structuredClone(empty),revision=0,saves=0;const record=()=>({state:structuredClone(state),profile:{sub:'local-test',name:'Teste',email:''},revision:String(revision),localSync:{localMode:true,revision:String(revision),message:'Salvo'}});
 try{w.WebAssembly=WebAssembly;w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;w.structuredClone=structuredClone;Object.defineProperty(w.crypto,'subtle',{value:webcrypto.subtle});w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};w.HTMLElement.prototype.scrollIntoView=function(){};w.desktop={rpc:async(m,...a)=>{if(m==='loadFinance')return record();if(m==='saveFinance'){state=a[0];revision++;saves++;return record();}if(m==='syncStatus')return record().localSync;throw Error(m);}};
 w.eval(fs.readFileSync(root+'app.js','utf8')+'\nNubankPdf.extract=async()=>'+JSON.stringify(lines)+';');await until(()=>w.document.querySelector('.stats'));const d=w.document;
 async function choosePDF(){const input=d.querySelector('#nu-file');Object.defineProperty(input,'files',{value:[{name:'fatura.pdf',size:20,arrayBuffer:async()=>new TextEncoder().encode('%PDF-1.7 test').buffer}],configurable:true});input.dispatchEvent(new w.Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,10));}
 d.querySelector('[data-view="entries"]').click();d.querySelector('[data-nubank-open="credit"]').click();assert.equal(d.querySelector('#nu-kind').value,'credit');await choosePDF();assert(d.querySelector('.form-message').textContent.includes('vencimento'));assert.equal(saves,0);d.querySelector('#nu-due').value='2026-11-10';await choosePDF();await until(()=>d.querySelector('[data-nu-preview]'));d.querySelector('[data-nu-preview]').click();await until(()=>d.querySelector('[data-nu-save]'));assert(d.querySelector('#nu-summary').textContent.includes('3 selecionado'));assert.equal(d.querySelector('[data-nu-field="date"]').value,'2026-11-10');const category=d.querySelector('[data-nu-field="category"]');category.value='Saúde';category.dispatchEvent(new w.Event('change',{bubbles:true}));d.querySelector('[data-nu-save]').click();await until(()=>saves===1&&!d.querySelector('#nubank-dialog').open);assert.equal(state.entries[0].category,'Saúde');assert.equal(state.entries[0].source,card.name);assert.equal(state.entries[0].importOriginalDate,'2026-10-23');assert.equal(d.querySelector('#nubank-dialog').childElementCount,0);
 d.querySelector('[data-nubank-open="credit"]').click();d.querySelector('#nu-due').value='2026-11-10';await choosePDF();await until(()=>d.querySelector('[data-nu-preview]'));d.querySelector('[data-nu-preview]').click();await until(()=>d.querySelector('[data-nu-save]'));assert(d.querySelector('[data-nu-save]').disabled);assert.equal(saves,1);d.querySelector('[data-nu-close]').click();assert.equal(d.querySelector('#nubank-dialog').childElementCount,0);
 }finally{w.close();}
});
test('Limpeza Rust remove somente builds dos crates do projeto e preserva dados',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'financa-rust-clean-')),script=path.resolve(__dirname,'../../scripts/clean-rust-builds.py');
 try{for(const crate of ['rust-core','desktop']){fs.mkdirSync(path.join(root,crate,'target','debug'),{recursive:true});fs.writeFileSync(path.join(root,crate,'Cargo.toml'),'[package]');fs.writeFileSync(path.join(root,crate,'target','debug','temp'),'build');}fs.mkdirSync(path.join(root,'finance-cache'));fs.writeFileSync(path.join(root,'finance-cache','profile.enc'),'saved');fs.mkdirSync(path.join(root,'dist'));fs.writeFileSync(path.join(root,'dist','finance.wasm'),'wasm');
 const code='import runpy; module=runpy.run_path('+JSON.stringify(script)+'); print(module["clean"]('+JSON.stringify(root)+'))';const result=spawnSync('python',['-c',code],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);assert(!fs.existsSync(path.join(root,'rust-core','target')));assert(!fs.existsSync(path.join(root,'desktop','target')));assert.equal(fs.readFileSync(path.join(root,'finance-cache','profile.enc'),'utf8'),'saved');assert.equal(fs.readFileSync(path.join(root,'dist','finance.wasm'),'utf8'),'wasm');assert(fs.existsSync(path.join(root,'rust-core','Cargo.toml')));
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
