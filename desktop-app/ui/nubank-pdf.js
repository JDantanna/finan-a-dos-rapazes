'use strict';
// PDF.js is bundled locally and loaded only when a PDF is selected.
const NubankPdf=(()=>{
 let library;
 async function load(){
  if(!library)library=import('../assets/pdfjs/pdf.mjs').then(pdf=>{
   pdf.GlobalWorkerOptions.workerSrc=new URL('../assets/pdfjs/pdf.worker.mjs',location.href).href;return pdf;
  }).catch(error=>{library=null;throw error;});
  return library;
 }
 function linesFromItems(items){
  const sorted=items.filter(item=>typeof item.str==='string'&&item.str.trim()).sort((a,b)=>b.transform[5]-a.transform[5]||a.transform[4]-b.transform[4]);
  const groups=[];let group;
  for(const item of sorted){const y=item.transform[5];if(!group||Math.abs(group.y-y)>2){group={y,items:[]};groups.push(group);}group.items.push(item);}
  return groups.map(g=>g.items.sort((a,b)=>a.transform[4]-b.transform[4]).map(item=>item.str).join(' ').replace(/\s+/g,' ').trim());
 }
 async function extract(buffer,{timeoutMs=30000}={}){
  if(!(buffer instanceof ArrayBuffer)||buffer.byteLength>5_000_000)throw Error('Selecione um PDF de até 5 MB.');
  const pdf=await load();let task,timer;
  const reading=(async()=>{
   task=pdf.getDocument({data:new Uint8Array(buffer),isEvalSupported:false,disableFontFace:true,useSystemFonts:false,enableXfa:false,stopAtErrors:true,verbosity:0,useWorkerFetch:false,isImageDecoderSupported:false,isOffscreenCanvasSupported:false});
   const doc=await task.promise;if(doc.numPages>60)throw Error('Fatura muito longa. Importe até 60 páginas por arquivo.');
   const lines=[];let length=0;
   for(let i=1;i<=doc.numPages;i++){
    const page=await doc.getPage(i);const content=await page.getTextContent();
    if(content.items.length>50000)throw Error('Página PDF muito complexa. Use CSV/OFX.');
    for(const line of linesFromItems(content.items)){length+=line.length;if(length>1_000_000)throw Error('Texto da fatura excede o limite.');lines.push(line);}
    page.cleanup();
   }
   if(!lines.length)throw Error('PDF sem texto selecionável. Exporte a fatura em CSV/OFX.');return lines;
  })();
  try{return await Promise.race([reading,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Leitura do PDF demorou demais. Use CSV/OFX.')),timeoutMs);})]);}
  catch(error){if(error.name==='PasswordException')throw Error('PDF protegido por senha. Exporte uma cópia sem senha ou use CSV/OFX.');throw error;}
  finally{clearTimeout(timer);await task?.destroy();}
 }
 return{extract,linesFromItems};
})();
if(typeof module!=='undefined')module.exports=NubankPdf;
