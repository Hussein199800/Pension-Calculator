// اختبارات حاسبة رسوم الانتساب وإعادة القيد
// التشغيل: node tests/fees.test.js
'use strict';
const assert = require('assert');
const F = require('../js/fees.js');
const SRC = require('./fees.source.json'); // منسوخ حرفياً من fees_2026.xlsx
let passed = 0;
function t(name, fn) { try { fn(); passed++; console.log('✔ ' + name); } catch (e) { console.error('✘ ' + name + '\n  ' + e.message); process.exitCode = 1; } }
const TODAY = { today: '2026-11-24' };
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);

// ---------- البيانات مطابقة لملف Excel خانة بخانة
t('الرسم السنوي 2011–2026 مطابق للملف', () => {
  for (const y in SRC.annual) assert.strictEqual(F.ANNUAL[y], SRC.annual[y], 'سنة ' + y);
});
t('جداول الانتساب 2020–2026 مطابقة للملف (كل الأعمار وكل البنود)', () => {
  for (const ty in SRC.tables) for (const age in SRC.tables[ty]) {
    const want = SRC.tables[ty][age], got = F.tableRow(+ty, +age);
    for (const k in want) assert.strictEqual(got[k], want[k], 'جدول ' + ty + ' عمر ' + age + ' ' + k);
    if (!('exam' in want)) assert.strictEqual(got.exam, 0);
  }
});
t('مجاميع جدول 2026 مطابقة للصورة المعلقة', () => {
  const total = (age) => sum(F.tableRow(2026, age));
  assert.strictEqual(total(30), 35000);
  assert.strictEqual(total(31), 36750);
  assert.strictEqual(total(45), 64250);
  assert.strictEqual(total(46), 58000);
  assert.strictEqual(total(50), 68000);
});

// ---------- اختيار الجدول
t('الجدول: السنة نفسها أو الذي بعدها', () => {
  assert.strictEqual(F.pickTable(2015).year, 2020);
  assert.strictEqual(F.pickTable(2019).year, 2020);
  assert.strictEqual(F.pickTable(2020).year, 2020);
  assert.strictEqual(F.pickTable(2023).year, 2023);
  assert.strictEqual(F.pickTable(2025).year, 2026);
  assert.strictEqual(F.pickTable(2026).year, 2026);
});

// ---------- العمر
t('العمر: أي كسر يرفعه، دون 30 = 30، فوق 50 = 50', () => {
  assert.strictEqual(F.ageRow('1994-01-01', '2024-01-01').row, 30);   // 30 تماماً
  assert.strictEqual(F.ageRow('1994-01-01', '2024-01-02').row, 31);   // 30 ويوم
  assert.strictEqual(F.ageRow('1994-01-01', '2024-05-02').row, 31);   // مثال الملف
  assert.strictEqual(F.ageRow('2000-01-01', '2024-05-02').row, 30);   // 24 سنة
  const o = F.ageRow('1970-01-01', '2020-01-02'); assert.strictEqual(o.row, 50); assert.ok(o.over50);
  assert.ok(!F.ageRow('1970-01-01', '2020-01-01').over50);            // 50 تماماً
});

// ---------- الانتساب الجديد
const newCase = (o) => F.compute(Object.assign({ kind: 'new', status: 'active' }, o), TODAY);
t('انتساب 2026 بعمر 30: 35,000', () => {
  const R = newCase({ birthDate: '1996-03-01', joinDate: '2026-03-01' });
  assert.deepStrictEqual(R.errors, []);
  assert.strictEqual(R.table, 2026);
  assert.strictEqual(R.years.length, 1);
  assert.strictEqual(R.total, 35000);
});
t('انتساب 2026 بعمر 46: 58,000 بلا معونة وفاة، ورسم سنوي 4,000', () => {
  const R = newCase({ birthDate: '1980-01-01', joinDate: '2026-01-02' }); // 46 سنة ويوم ← سطر 47
  assert.strictEqual(R.age.row, 47);
  const R2 = newCase({ birthDate: '1980-01-02', joinDate: '2026-01-02' }); // 46 تماماً
  assert.strictEqual(R2.age.row, 46);
  assert.ok(!R2.items.some(i => i.label === 'معونة الوفاة'));
  assert.strictEqual(R2.years[0].amount, 4000);
  assert.strictEqual(R2.total, 58000);
});
t('مثال المالك: منتسب 2019 ← جدول 2020 بلا سنويه + سنوي 2019..2026', () => {
  const R = newCase({ birthDate: '1985-06-01', joinDate: '2019-03-10' }); // 33 سنة و9 أشهر ← 34
  assert.strictEqual(R.table, 2020);
  assert.strictEqual(R.age.row, 34);
  const row = F.tableRow(2020, 34);
  const regNoAnnual = sum(row) - row.annual;
  assert.strictEqual(R.itemsTotal, regNoAnnual);
  assert.deepStrictEqual(R.years.map(y => y.year), [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]);
  assert.deepStrictEqual(R.years.map(y => y.amount), [145, 155, 400, 650, 750, 750, 750, 5000]);
  assert.strictEqual(R.total, regNoAnnual + 145 + 155 + 400 + 650 + 750 + 750 + 750 + 5000);
});
t('منتسب 2022: جدول 2022، والسنوي 2022 مرة واحدة', () => {
  const R = newCase({ birthDate: '1990-01-01', joinDate: '2022-01-01' }); // 32 تماماً
  const row = F.tableRow(2022, 32);
  assert.strictEqual(R.total, sum(row) + 750 + 750 + 750 + 5000); // 2023..2026 بعد سطر 2022 (السنوي 650 من الجدول = الورقة)
});
t('منتسب فوق 45: الرسوم السنوية المخفّضة حيث يوجد جدول، و2011–2019 مثل غيره', () => {
  const R = newCase({ birthDate: '1966-01-01', joinDate: '2015-06-01' });
  assert.ok(R.over45);
  assert.deepStrictEqual(R.years.map(y => y.amount), [135, 135, 135, 145, 145, 130, 300, 500, 600, 600, 600, 4000]);
});
t('السنوات المدفوعة تُطرح', () => {
  const a = newCase({ birthDate: '1985-06-01', joinDate: '2019-03-10' });
  const b = newCase({ birthDate: '1985-06-01', joinDate: '2019-03-10', paidYears: [2019, 2020] });
  assert.strictEqual(a.total - b.total, 145 + 155);
  assert.strictEqual(b.paidCount, 2);
});
t('سنة النهاية حسب الوضع: مرقّن 2025 / متوفى 2024', () => {
  const c = newCase({ birthDate: '1985-06-01', joinDate: '2019-03-10', status: 'cancelled', statusYear: '2025' });
  assert.strictEqual(c.years[c.years.length - 1].year, 2025);
  const d = newCase({ birthDate: '1985-06-01', joinDate: '2019-03-10', status: 'deceased', statusYear: '2024' });
  assert.strictEqual(d.years[d.years.length - 1].year, 2024);
  assert.ok(newCase({ birthDate: '1985-06-01', joinDate: '2019-03-10', status: 'other' }).errors.length);
});
t('فوق 50: سطر 50 مع تنبيه، والحساب يمضي', () => {
  const R = newCase({ birthDate: '1970-01-01', joinDate: '2026-02-01' });
  assert.strictEqual(R.age.row, 50);
  assert.ok(R.warnings.some(w => w.indexOf('الخمسين') >= 0));
  assert.strictEqual(R.total, 68000);
});

// ---------- إعادة القيد والحالات الأخرى
t('مشطوب أمني: سنوي من 2011 حتى سنة القرار', () => {
  const R = F.compute({ kind: 'secStruck', decisionDate: '2026-05-01' }, TODAY);
  assert.strictEqual(R.years[0].year, 2011);
  assert.strictEqual(R.years.length, 16);
  assert.strictEqual(R.total, sum(F.ANNUAL));
});
t('مشطوب إداري بعمر 40 وانقطاع 3 سنوات وشهر ← 4 سنوات', () => {
  const R = F.compute({ kind: 'admStruck', birthDate: '1986-01-01', eventDate: '2022-01-01', decisionDate: '2025-02-01', optional: { id: true } }, TODAY);
  assert.deepStrictEqual(R.errors, []);
  assert.strictEqual(R.gapYears, 4);
  assert.strictEqual(R.total, 20000 + 20000 + 2500 + 4 * 2500 + 1000 + 1000 + 1000);
});
t('مشطوب إداري فوق 45: بلا معونة وفاة، والانقطاع يدوي', () => {
  const R = F.compute({ kind: 'admStruck', birthDate: '1970-01-01', decisionDate: '2026-01-01', gapYears: '2' }, TODAY);
  assert.strictEqual(R.total, 20000 + 20000 + 2 * 2500 + 1000 + 1000);
});
t('إعادة قيد بعد الترقين', () => {
  const R = F.compute({ kind: 'reCancel', birthDate: '1990-01-01', eventDate: '2023-06-01', decisionDate: '2026-06-01' }, TODAY);
  assert.strictEqual(R.gapYears, 3);
  assert.strictEqual(R.total, 10000 + 10000 + 2500 + 3 * 2500 + 1000 + 1000);
});
t('مُغفَل: 10,000 + السنوات غير المدفوعة', () => {
  const R = F.compute({ kind: 'omitted', decisionDate: '2026-03-01', lastPaidYear: '2023' }, TODAY);
  assert.deepStrictEqual(R.years.map(y => y.year), [2024, 2025, 2026]);
  assert.strictEqual(R.total, 3000 + 7000 + 750 + 750 + 5000);
});
t('ترقين بطلبه: سنة الترقين والسابق غير المدفوع', () => {
  const R = F.compute({ kind: 'cancelSelf', eventDate: '2025-04-01', lastPaidYear: '2024' }, TODAY);
  assert.strictEqual(R.total, 750);
});
t('النقل 10,000 مع تنبيه براءة الذمة', () => {
  const R = F.compute({ kind: 'transfer' }, TODAY);
  assert.strictEqual(R.total, 10000);
  assert.ok(R.warnings.length);
  assert.ok(!F.compute({ kind: 'transfer', clearance: true }, TODAY).warnings.length);
});
t('نقل المتمرن إلى الأساتذة 5,050', () => assert.strictEqual(F.compute({ kind: 'traineeToMaster' }, TODAY).total, 5050));
t('المعفى من التمرين: قيد الدراسة', () => assert.ok(F.compute({ kind: 'exempt' }, TODAY).errors.length));

console.log('\n' + passed + ' اختباراً ناجحاً');
