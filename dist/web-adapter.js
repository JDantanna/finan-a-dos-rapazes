'use strict';
// Online test adapter. Financial validation and reports run in the desktop Rust core.
const storageKey='financa-dos-rapazes:test:v1';
const wasmReady=WebAssembly.instantiateStreaming(fetch('./finance.wasm')).then(r=>r.instance.exports);
function readState(){const raw=localStorage.getItem(storageKey);if(raw===null)return{entries:[],goals:[],demo:false};try{const s=JSON.parse(raw);if(!Array.isArray(s.entries)||!Array.isArray(s.goals))throw Error();return s}catch{throw Error('Dados locais inválidos. Restaure uma cópia de segurança.')}}
async function rustRequest(input){const wasm=await wasmReady;const bytes=new TextEncoder().encode(JSON.stringify(input));const ptr=wasm.allocate(bytes.length);new Uint8Array(wasm.memory.buffer,ptr,bytes.length).set(bytes);const result=wasm.calculate(ptr,bytes.length),resultPtr=Number(result>>32n),length=Number(result&0xffffffffn);let response;try{response=JSON.parse(new TextDecoder().decode(new Uint8Array(wasm.memory.buffer,resultPtr,length)))}finally{wasm.release(resultPtr,length)}if(response.error)throw Error(response.error);return response.ok}
function rustReport(state,start,end){return rustRequest({state,start,end,today:today()})}
async function webApi(route,body){if(route==='/api/state'){if(body===undefined)return readState();await rustReport(body,today(),today());try{localStorage.setItem(storageKey,JSON.stringify(body))}catch{throw Error('Não foi possível salvar no navegador. Exporte um backup e verifique o espaço disponível.')}return{ok:true}}if(route.startsWith('/api/report?')){const params=new URLSearchParams(route.split('?')[1]);return rustReport(readState(),params.get('start'),params.get('end'))}throw Error('Recurso indisponível')}

function newId(){if(typeof crypto.randomUUID==='function')return crypto.randomUUID();return Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('')}
