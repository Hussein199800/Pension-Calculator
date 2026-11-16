// اختبارات محرك الحساب مقابل الأمثلة الواردة حرفياً في تعاميم خزانة التقاعد
// التشغيل: node tests/calc.test.js
'use strict';
const assert = require('assert');
const C = require('../js/calc.js');
const S = C.settingsWith();
let passed = 0;
function t(name, fn) { try { fn(); passed++; console.log('✔ ' + name); } catch (e) { console.error('✘ ' + name + '\n  ' + e.message); process.exitCode = 1; } }
const net = (y, m = 0, d = 0) => ({ net: { y, m, d } });

// ---------- التقاعد العادي
t('عادي: 30 سنة = 16000', () => assert.strictEqual(C.ordinaryPension(16000, 30, S).amount, 16000));
t('عادي: 20 سنة = 10666', () => assert.strictEqual(C.ordinaryPension(16000, 20, S).amount, 10666));
t('عادي: 36 سنة = 19200', () => assert.strictEqual(C.ordinaryPension(16000, 36, S).amount, 19200));
t('عادي: سقف 45 سنة = 24000 (= 2,400,000 ل.س قديمة)', () => {
  assert.strictEqual(C.ordinaryPension(16000, 45, S).amount, 24000);
  assert.strictEqual(C.ordinaryPension(16000, 50, S).amount, 24000);
});

// ---------- التقاعد الصحي
t('صحي: الشرائح 15/12/7/4', () => {
  assert.strictEqual(C.bracketPension(16000, 15).amount, 16000);
  assert.strictEqual(C.bracketPension(16000, 12).amount, 12000);
  assert.strictEqual(C.bracketPension(16000, 7).amount, 8000);
  assert.strictEqual(C.bracketPension(16000, 4).amount, 4000);
  assert.strictEqual(C.bracketPension(16000, 2, true).amount, 16000);
});
t('صحي: الشهر الأول الجزئي', () => {
  assert.strictEqual(C.prorate(16000, C.parseDate('2026-09-06')).amount, 13333);
  assert.strictEqual(C.prorate(12000, C.parseDate('2026-10-10')).amount, 8800);
  assert.strictEqual(C.prorate(8000, C.parseDate('2026-01-01')).amount, 8000);
  assert.strictEqual(C.prorate(4000, C.parseDate('2026-10-27')).amount, 666);
});
t('صحي: حالة كاملة 15 سنة خبرة طبية 2026/9/6', () => {
  const r = C.computeCase({ type: 'health', medicalDate: '2026-09-06', untilMonth: '2026-10',
    service: { mode: 'manual', manual: { y: 15 } } });
  assert.deepStrictEqual(r.errors, []);
  assert.strictEqual(r.schedule.periods[0].amount, 13333);
  assert.strictEqual(r.schedule.periods[1].total, 16000);
  assert.strictEqual(r.schedule.total, 29333);
});

// ---------- معاش الورثة
t('ورثة متقاعد: زوجة فقط 25 سنة، وفاة 2025/7/3', () => {
  const r = C.computeCase({ type: 'heirs', status: 'retired', originalType: 'ordinary', deathDate: '2025-07-03', untilMonth: '2026-10',
    service: { mode: 'manual', manual: { y: 25 } }, heirs: [{ relation: 'spouse', name: 'الزوجة' }] });
  assert.deepStrictEqual(r.errors, []);
  const p = r.schedule.periods;
  assert.strictEqual(r.baseStart.amount, 3333);
  assert.strictEqual(p[0].monthly, 2499);           // حصة الزوجة الشهرية
  assert.strictEqual(p[0].days, 28);                // من 7/4 حتى 7/31 (المثال كتب 25 يوماً سهواً)
  assert.strictEqual(p[0].amount, 2332);
  assert.strictEqual(p[1].from, '2025-08-01'); assert.strictEqual(p[1].to, '2026-06-30');
  assert.strictEqual(p[1].months, 11); assert.strictEqual(p[1].total, 12495 + 14994);
  assert.strictEqual(p[2].monthly, 9999); assert.strictEqual(p[2].months, 4); assert.strictEqual(p[2].total, 39996);
});
t('ورثة على رأس عمله: 12 سنة، زوجة وبنت', () => {
  const r = C.computeCase({ type: 'heirs', status: 'inService', deathDate: '2026-07-31', untilMonth: '2026-08',
    service: { mode: 'manual', manual: { y: 12 } },
    heirs: [{ relation: 'spouse', name: 'ز' }, { relation: 'daughter', name: 'ب' }] });
  assert.strictEqual(r.baseNow.amount, 12000);
  assert.strictEqual(r.distNow.unit, 2400);
  assert.strictEqual(r.distNow.perHeir[0], 7200);
  assert.strictEqual(r.distNow.perHeir[1], 2400);
});
t('ورثة على رأس عمله: الشرائح 16/12/9/4', () => {
  assert.strictEqual(C.bracketPension(16000, 16).amount, 16000);
  assert.strictEqual(C.bracketPension(16000, 9).amount, 8000);
});
t('أهلية الورثة', () => {
  const ref = '2026-10-31';
  assert.ok(C.heirPensionEligibility({ relation: 'son', birth: '2010-01-01' }, ref).ok);
  assert.ok(!C.heirPensionEligibility({ relation: 'son', birth: '2000-01-01' }, ref).ok);
  assert.ok(C.heirPensionEligibility({ relation: 'son', birth: '2002-01-01', student: true }, ref).ok);
  assert.ok(!C.heirPensionEligibility({ relation: 'son', birth: '1998-01-01', student: true }, ref).ok);
  assert.ok(C.heirPensionEligibility({ relation: 'son', birth: '1980-01-01', disabled: true }, ref).ok);
  assert.ok(!C.heirPensionEligibility({ relation: 'daughter', married: true }, ref).ok);
  assert.ok(!C.heirPensionEligibility({ relation: 'mother' }, ref).ok);
  assert.ok(C.heirPensionEligibility({ relation: 'mother', dependent: true }, ref).ok);
});

// ---------- معونة التقاعد
t('معونة تقاعد بعد 2014: صحي 17 سنة = 113333', () => {
  const r = C.retirementAid({ type: 'health', joinDate: '2015-01-01', retirementDate: '2026-10-01', birthDate: '1980-01-01' }, net(17), S);
  assert.strictEqual(r.amount, 113333);
});
t('معونة تقاعد بعد 2014: 17 سنة و5 أشهر = 18 جزءاً = 120000', () => {
  const r = C.retirementAid({ type: 'health', joinDate: '2015-01-01', retirementDate: '2026-10-01', birthDate: '1980-01-01' }, net(17, 5), S);
  assert.strictEqual(r.amount, 120000);
});
t('معونة تقاعد بعد 2014: صحي بحد أدنى 5 أجزاء', () => {
  const r = C.retirementAid({ type: 'health', joinDate: '2020-01-01', retirementDate: '2026-10-01', birthDate: '1980-01-01' }, net(2), S);
  assert.strictEqual(r.amount, Math.floor(200000 * 5 / 30));
});
t('معونة تقاعد قبل 2014: نصف المعونة 100000', () => {
  const r = C.retirementAid({ type: 'ordinary', joinDate: '1990-01-01', retirementDate: '2026-10-01', birthDate: '1960-01-01', requestedHalfAid: true }, net(36), S);
  assert.strictEqual(r.amount, 100000);
});
t('استبعاد من صندوق المعونة لمن قُيد بعمر فوق 45', () => {
  const r = C.retirementAid({ type: 'ordinary', joinDate: '2016-01-01', registrationDecisionDate: '2016-01-01', retirementDate: '2026-10-01', birthDate: '1960-01-01' }, net(10), S);
  assert.strictEqual(r.amount, 0);
});

// ---------- معونة الوفاة
const sp = [{ relation: 'spouse', name: 'ز' }];
t('وفاة: منتسب 1995 متوفى 2010 = 20000', () => assert.strictEqual(C.deathAid({ status: 'inService', joinDate: '1995-01-01', deathDate: '2010-06-01', heirs: sp }, net(15), S).amount, 20000));
t('وفاة: منتسب 1990 متوفى 2025 = 100000', () => assert.strictEqual(C.deathAid({ status: 'inService', joinDate: '1990-01-01', deathDate: '2025-06-01', heirs: sp }, net(35), S).amount, 100000));
t('وفاة: منتسب 2015 متوفى 2026/4، 7 سنوات = 23333', () => assert.strictEqual(C.deathAid({ status: 'inService', joinDate: '2015-01-01', deathDate: '2026-04-15', heirs: sp }, net(7), S).amount, 23333));
t('وفاة: منتسب 2016 متوفى 2026/10، 8 سنوات وشهران = 9 → 60000', () => assert.strictEqual(C.deathAid({ status: 'inService', joinDate: '2016-01-01', deathDate: '2026-10-15', heirs: sp }, net(8, 2), S).amount, 60000));
t('وفاة: قبض نصف المعونة عند التقاعد → النصف الثاني', () => assert.strictEqual(C.deathAid({ status: 'retired', receivedHalfAid: true, joinDate: '1990-01-01', deathDate: '2026-10-15', heirs: sp }, net(35), S).amount, 100000));
t('وفاة: لا مستحقين أساسيين ولا حصر = 0', () => assert.strictEqual(C.deathAid({ status: 'inService', joinDate: '1990-01-01', deathDate: '2026-10-15', heirs: [{ relation: 'brother' }] }, net(35), S).amount, 0));
t('وفاة: توزيع متساوٍ زوجتان + ولدان + والدان', () => {
  const r = C.deathAid({ status: 'inService', joinDate: '1990-01-01', deathDate: '2026-10-15', heirs: [
    { relation: 'spouse' }, { relation: 'spouse' }, { relation: 'son' }, { relation: 'daughter' }, { relation: 'father' }, { relation: 'mother' }] }, net(35), S);
  assert.strictEqual(r.distribution.length, 4);
  assert.strictEqual(r.distribution[0].amount, 50000);
  assert.strictEqual(r.distribution[0].each, 25000);
});

// ---------- مدة الممارسة
t('مدة الممارسة بالتواريخ مع استبعاد', () => {
  const r = C.computeService({ mode: 'dates', start: '1996-01-01', end: '2025-12-31', exclusions: [{ from: '2000-01-01', to: '2000-12-31', reason: 'منع' }] });
  assert.deepStrictEqual(r.gross, { y: 30, m: 0, d: 0 });
  assert.deepStrictEqual(r.net, { y: 29, m: 0, d: 0 });
});

// ---------- التفقيط
t('تفقيط', () => {
  assert.strictEqual(C.tafqit(16000), 'ستة عشر ألفاً');
  assert.strictEqual(C.tafqit(2499), 'ألفان وأربعمئة وتسعة وتسعون');
  assert.strictEqual(C.tafqit(200000), 'مئتا ألف');
  assert.strictEqual(C.tafqit(2400000), 'مليونان وأربعمئة ألف');
  assert.strictEqual(C.tafqit(13333), 'ثلاثة عشر ألفاً وثلاثمئة وثلاثة وثلاثون');
});

console.log('\n' + passed + ' اختبار ناجح');
