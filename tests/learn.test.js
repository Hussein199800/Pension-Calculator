// اختبارات «تعلّم» جداول الرسوم من Excel: القارئ، والقالب، والتعرف على الأعمدة، والمعاينة
// التشغيل: node tests/learn.test.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const X = require('../js/xlsx-io.js'), L = require('../js/fees-learn.js'), F = require('../js/fees.js');
let passed = 0;
async function t(name, fn) { try { await fn(); passed++; console.log('✔ ' + name); } catch (e) { console.error('✘ ' + name + '\n  ' + e.message); process.exitCode = 1; } }
const bufOf = (sheets) => Buffer.concat(X.build(sheets).map((b) => Buffer.from(b)));
const TODAY = { today: '2027-05-01' };

(async () => {
  await t('ملف المالك fees_2026.xlsx يُفهم كاملاً ولا يغيّر شيئاً (الجداول مطابقة لما في البرنامج)', async () => {
    const P = L.learn(await X.read(fs.readFileSync(__dirname + '/fixtures/fees_2026.xlsx')));
    assert.deepStrictEqual(Object.keys(P.central).map(Number), [2020, 2021, 2022, 2023, 2024, 2026]);
    assert.strictEqual(P.problems.length, 0);
    assert.strictEqual(L.apply(P), null); // لا فرق عن المعتمد
  });
  await t('القالب يُقرأ كما كُتب، ويضيف سنة 2027 مركزية وفرعاً', async () => {
    const T = L.template({ data: null });
    assert.strictEqual(T.year, 2027);
    const P = L.learn(await X.read(bufOf(T.sheets)));
    assert.strictEqual(P.problems.length, 0);
    assert.ok(P.central[2027] && P.branch[2027]);
    const ov = L.apply(P);
    const R = F.compute({ kinds: ['new'], scope: 'both', status: 'active', birthDate: '1997-03-01', joinDate: '2027-03-01' }, Object.assign({ data: ov }, TODAY));
    assert.strictEqual(R.table, 2027); assert.strictEqual(R.branchTable, 2027);
    assert.strictEqual(R.total, 61000);
  });
  await t('تعديل خانة في القالب يظهر في المعاينة ويُطبَّق، ومجموع غير مطابق يُنبَّه عليه', async () => {
    const T = L.template({ data: null });
    const c = T.sheets[0].rows; c[4][1] = 6000; // مركزية 2027، عمر 30، قيد النقابة
    const P = L.learn(await X.read(bufOf(T.sheets)));
    assert.strictEqual(P.central[2027].rows[30].union, 6000);
    assert.ok(P.problems.some((p) => p.indexOf('المجموع لا يطابق') >= 0));
    const R = F.compute({ kinds: ['new'], scope: 'central', status: 'active', birthDate: '1997-03-01', joinDate: '2027-03-01' }, Object.assign({ data: L.apply(P) }, TODAY));
    assert.strictEqual(R.total, 36000);
  });
  await t('ملف بترتيب أعمدة مختلف وأرقام عربية وورقة فرع بلا مجموع', async () => {
    const rows = [['جدول رسوم الفرع 2028'], [], ['العمر', 'التكافل', 'رسم قيد منتسب', 'الاسعاف', 'التعاون', 'رسم سنوي', 'متطلبات التمرين', 'اضبارة وروب']];
    F.AGES.forEach((a) => rows.push([String(a).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]), '١٬٠٠٠', 10000, 2000, 2000, 3000, 5000, 3000]));
    const P = L.learn(await X.read(bufOf([{ name: 'Sheet1', rows }])));
    assert.ok(P.branch[2028], JSON.stringify(P.problems));
    assert.deepStrictEqual(P.branch[2028].rows[40], { reg: 10000, ambulance: 2000, annual: 3000, coop: 2000, training: 5000, file: 3000, takaful: 1000 });
  });
  await t('الرسوم الثابتة تُعرف بالمفتاح أو باسم البند', async () => {
    const P = L.learn(await X.read(bufOf([{ name: 'ثابتة', rows: [['البند', 'المبلغ'], ['الفرع: رسم الأستذة', 6000], ['شيء غريب', 1]] }])));
    assert.strictEqual(P.fixed.brMaster, 6000);
    assert.ok(P.problems.some((p) => p.indexOf('شيء غريب') >= 0));
  });
  await t('ورقة جدول ناقصة الأعمار لا تُعتمد', async () => {
    const P = L.learn(await X.read(bufOf([{ name: 'مركزية 2029', rows: [['العمر', 'قيد النقابة'], [30, 1]] }])));
    assert.ok(!P.central[2029]); assert.ok(P.problems.length);
  });
  // ---------- إصلاحات مراجعة الدمج 6
  await t('خلية فارغة في جدول موجود تُبقي القيمة السابقة (لا تصبح صفراً)، وتُذكر في المعاينة', async () => {
    const T = L.template({ data: null, year: 2026 });
    T.sheets[0].rows[4][1] = ''; // مركزية 2026 عمر 30 قيد النقابة
    const P = L.learn(await X.read(bufOf(T.sheets)));
    assert.strictEqual(P.central[2026].rows[30].union, 5000);
    assert.ok(P.notes.some((n) => n.indexOf('فارغة') >= 0));
    assert.strictEqual(L.apply(P), null);
  });
  await t('الصفر الصريح يُعتمد ويظهر في المعاينة خانةً خانة', async () => {
    const T = L.template({ data: null, year: 2026 });
    T.sheets[0].rows[4][1] = 0;
    const P = L.learn(await X.read(bufOf(T.sheets)));
    assert.strictEqual(P.central[2026].rows[30].union, 0);
    assert.ok(P.cells.some((c) => c.indexOf('عمر 30') >= 0 && c.indexOf('5,000 ← 0') >= 0));
  });
  await t('السالب والكسر مرفوضان، والقيمة الحالية (المخصصة) تبقى', async () => {
    const data = { fixed: { brTransfer: 6000 } };
    const rows = [['المفتاح', 'البند', 'المبلغ'], ['brTransfer', 'x', -100], ['brMaster', 'y', '٣٬٠٠٠٫٥'], ['brOmitted', 'z', '']];
    const P = L.learn(await X.read(bufOf([{ name: 'ثابتة', rows }])), { data });
    assert.ok(!('brTransfer' in P.fixed) && !('brMaster' in P.fixed) && !('brOmitted' in P.fixed));
    assert.strictEqual(P.problems.length, 2);
    assert.deepStrictEqual(L.apply(P, data), data);
  });
  await t('سنة كسرية أو خارج النطاق في ورقة السنوي مرفوضة، و2100 خارج النطاق', async () => {
    const rows = [['السنة', 'مركزية حتى 45'], [2027.5, 6000], [2100, 6000], [2028, 6500]];
    const P = L.learn(await X.read(bufOf([{ name: 'سنوي', rows }])));
    assert.deepStrictEqual(P.annual, { 2028: 6500 });
    assert.strictEqual(P.problems.length, 2);
    const T = L.template({ data: { annual: { 2099: 5000 } } });
    assert.ok(T.year <= 2099);
  });
  await t('المعاينة تطابق الحفظ: بعد الاعتماد لا يبقى فرق عند رفع الملف نفسه', async () => {
    const T = L.template({ data: null });
    T.sheets[1].rows[4][1] = 12345;
    const buf = bufOf(T.sheets);
    const ov = L.apply(L.learn(await X.read(buf)));
    const again = L.learn(await X.read(buf), { data: ov });
    assert.strictEqual(again.changes.filter((c) => c.indexOf('لا تغيير') < 0).length, 0);
  });

  await t('ملف تالف أو ليس Excel يُرفض برسالة واضحة', async () => {
    await assert.rejects(() => X.read(Buffer.from('ليس ملفاً مضغوطاً')), /Excel|تالف/);
    const parts = X.build([{ name: 'a', rows: [[1]] }]); const buf = Buffer.concat(parts.map((b) => Buffer.from(b)));
    await assert.rejects(() => X.read(buf.subarray(0, buf.length - 30)), /Excel|تالف/);
  });
  console.log('\n' + passed + ' اختبارات ناجحة');
})();
