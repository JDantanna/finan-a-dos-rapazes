"use strict";
function summarizeExpenses(occurrences, accounts) {
  const registry = new Map(accounts.map(a => [a.name, a]));
  const groups = new Map();
  for (const {entry} of occurrences) {
    if (entry.kind !== 'expense') continue;
    const name = entry.source;
    const account = registry.get(name);
    const group = groups.get(name) || {name, type: account?.type || 'unclassified', cents: 0};
    group.cents += entry.cents;
    groups.set(name, group);
  }
  const items = [...groups.values()].sort((a,b) => b.cents-a.cents);
  const totals = Object.create(null);
  for (const item of items) totals[item.type] = (totals[item.type] || 0) + item.cents;
  return {items, totals};
}
if (typeof module !== 'undefined') module.exports = {summarizeExpenses};
