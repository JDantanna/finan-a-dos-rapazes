"use strict";
const IncomeSources = (() => {
 const key = name => name.trim().normalize('NFC').toLocaleLowerCase('pt-BR');
 function validate(items = []) {
  if (!Array.isArray(items) || items.length > 1000) throw Error('Cadastro de fontes de receita inválido.');
  const ids = new Set(), names = new Set();
  for (const source of items) {
   if (!source || typeof source.id !== 'string' || !source.id.trim() || source.id.length > 200 || typeof source.name !== 'string' || !source.name.trim() || new TextEncoder().encode(source.name).length > 120 || ids.has(source.id) || names.has(key(source.name))) throw Error('Informe um nome de fonte válido, sem duplicar uma fonte já cadastrada.');
   ids.add(source.id); names.add(key(source.name));
  }
  return items;
 }
 function upsert(state, source) {
  const next = structuredClone(state), old = (next.incomeSources || []).find(s => s.id === source.id);
  source = {...source, name: source.name.trim()};
  next.incomeSources = (next.incomeSources || []).filter(s => s.id !== source.id);
  next.incomeSources.push(source); validate(next.incomeSources);
  if (old && old.name !== source.name) for (const entry of next.entries) if (entry.kind === 'income' && key(entry.source) === key(old.name)) entry.source = source.name;
  return next;
 }
 function remove(state, id) { const next = structuredClone(state); next.incomeSources = (next.incomeSources || []).filter(s => s.id !== id); return next; }
 function options(state) {
  const names = new Map();
  for (const source of state.incomeSources || []) names.set(key(source.name), source.name);
  for (const entry of state.entries) if (entry.kind === 'income' && !names.has(key(entry.source))) names.set(key(entry.source), entry.source);
  return [...names.values()].sort((a,b) => a.localeCompare(b, 'pt-BR'));
 }
 return {validate, upsert, remove, options};
})();
if (typeof module !== 'undefined') module.exports = IncomeSources;
