'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Theme=require('../../dist/app-theme.js');
test('Paleta deriva todos os tons e mantém contraste com primárias claras, escuras e saturadas',()=>{
 for(const primary of ['#ffffff','#000000','#ffff00','#00ffff','#ff00ff','#f5b8da','#210043','#287560','#ff0000']){
  const p=Theme.palette(primary);assert.equal(p['--accent'],primary);
  assert(Theme.contrast(p['--accent'],p['--accent-contrast'])>=4.5,primary);
  assert(Theme.contrast(p['--green'],p['--mint'])>=4.5,primary);
  assert(Theme.contrast(p['--muted'],p['--mint'])>=4.5,primary);
  assert(Theme.contrast(p['--ink'],p['--white'])>=4.5,primary);
 }
 const a=Theme.palette('#1b4fbb'),b=Theme.palette('#ac248e');for(const name of ['--bg','--white','--line','--mint','--green','--muted','--surface-soft','--surface-hover','--focus','--shadow'])assert.notEqual(a[name],b[name],name);
});
