// الاختبار الذهبي: نتائج الراتب التقاعدي يجب أن تبقى متطابقة حرفياً مع النتائج المحفوظة.
// التشغيل: node tests/golden.test.js — وإنشاء اللقطة لأول مرة فقط: node tests/golden.test.js --write
'use strict';
const fs = require('fs'), path = require('path');
const C = require('../js/calc.js');
const cases = require('./golden.cases.js');
const FILE = path.join(__dirname, 'golden.expected.json');
const run = () => cases.map(([name, c]) => { const R = C.computeCase(JSON.parse(JSON.stringify(c)), {}); delete R.settings; return { name, R }; });
const out = run();
if (process.argv.includes('--write')) {
  if (fs.existsSync(FILE)) { console.error('اللقطة موجودة. لا تُعاد كتابتها إلا بطلب صريح من المالك.'); process.exit(1); }
  fs.writeFileSync(FILE, JSON.stringify(out, null, 1)); console.log('كُتبت ' + out.length + ' حالة'); process.exit(0);
}
const expected = JSON.parse(fs.readFileSync(FILE, 'utf8'));
let bad = 0;
if (expected.length !== out.length) { console.error('✘ عدد الحالات تغيّر'); bad++; }
expected.forEach((e, i) => {
  const a = JSON.stringify(out[i]), b = JSON.stringify(e);
  if (a !== b) { bad++; console.error('✘ تغيّرت نتيجة: ' + e.name); } else console.log('✔ ' + e.name);
});
if (bad) { console.error(bad + ' حالة تغيّرت — أوقف العمل وأخبر المالك'); process.exitCode = 1; }
else console.log('\nالاختبار الذهبي: ' + expected.length + ' حالة متطابقة');
