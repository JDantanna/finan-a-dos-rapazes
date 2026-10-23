const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
function input(){return{value:'',selectionStart:0,events:{},validity:'',addEventListener(k,f){this.events[k]=f},setCustomValidity(s){this.validity=s},setSelectionRange(a){this.selectionStart=a},reportValidity(){},type(text){this.value=text;this.selectionStart=text.length;this.events.input()},paste(text){this.events.paste({preventDefault(){},clipboardData:{getData(){return text}}})}}}
const fields=[input(),input(),input()];const context=vm.createContext({Intl,document:{querySelectorAll(){return fields}}});vm.runInContext(fs.readFileSync('dist/currency-input.js','utf8')+'\nthis.money=MoneyInput;',context);const money=context.money;
// 1: typing digits, thousands, cents.
fields[0].type('123456');assert.equal(money.parse(fields[0].value),123456);assert.equal(fields[0].value.replace(/\s/g,' '),'R$ 1.234,56');
// 2: paste BRL, decimal and integer reais; negatives rejected.
for(const[s,n]of [['R$ 1.234,56',123456],['1234,56',123456],['1234.56',123456],['20',2000]]){fields[0].paste(s);assert.equal(money.parse(fields[0].value),n)}fields[0].paste('-50');assert.ok(fields[0].validity);fields[0].type('100');assert.equal(fields[0].validity,'');
// 3: deletion, blur and resetting validation for new form.
fields[0].type('');assert.equal(fields[0].value,'');fields[0].events.blur();assert.equal(money.parse(fields[0].value),0);fields[0].type('100000000001');assert.ok(fields[0].validity);money.reset({querySelectorAll(){return fields}});assert.equal(fields[0].validity,'');
// 4: saved cents render without conversion errors; goal fields use same mask.
for(const n of [0,1,123456,100000000000])assert.equal(money.parse(money.format(n)),n);fields[1].type('6000000');fields[2].type('1850000');assert.equal(money.parse(fields[1].value),6000000);assert.equal(money.parse(fields[2].value),1850000);
// 5: invalid values and limit cannot silently turn positive or overflow.
for(const value of ['-1','1,234','abc','1e9','1.000.000.000,01'])assert.throws(()=>money.parse(value));fields[0].type('-100');assert.ok(fields[0].validity);
console.log('5 grupos de testes monetários passaram: digitação, colagem, exclusão/reset, edição/metas, limites e entradas inválidas.');
