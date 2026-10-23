"use strict";
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../dist');
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.wasm':'application/wasm'};
const server = http.createServer((req,res) => {
  let requested;
  try { requested = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400).end('URL inválida'); return; }
  const target = path.resolve(root, '.' + (requested === '/' ? '/index.html' : requested));
  if (!target.startsWith(root + path.sep)) { res.writeHead(403).end('Acesso negado'); return; }
  fs.readFile(target, (error, data) => {
    if (error) { res.writeHead(404).end('Arquivo não encontrado'); return; }
    res.writeHead(200, {'Content-Type':types[path.extname(target)] || 'application/octet-stream','Cache-Control':'no-store'}).end(data);
  });
});
const port = Number(process.env.PORT || 8080);
server.on('error', error => { console.error(error.message); process.exitCode=1; });
server.listen(port, '127.0.0.1', () => console.log(`Finança dos Rapazes: http://localhost:${server.address().port}`));
