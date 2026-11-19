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
t('صحي: الشرائح (رأي المختص: الحد في الشريحة الأدنى)', () => {
  const Y = (y, m = 0, d = 0) => ({ y, m, d });
  assert.strictEqual(C.bracketPension(16000, Y(5)).amount, 4000);          // 5 بالضبط = ربع
  assert.strictEqual(C.bracketPension(16000, Y(5, 0, 1)).amount, 8000);    // 5 ويوم = نصف
  assert.strictEqual(C.bracketPension(16000, Y(10)).amount, 8000);         // 10 بالضبط = نصف
  assert.strictEqual(C.bracketPension(16000, Y(10, 1)).amount, 12000);     // 10 وشهر = ثلاثة أرباع
  assert.strictEqual(C.bracketPension(16000, Y(14, 8)).amount, 12000);
  assert.strictEqual(C.bracketPension(16000, Y(15)).amount, 12000);        // 15 بالضبط = ثلاثة أرباع
  assert.strictEqual(C.bracketPension(16000, Y(15, 1)).amount, 16000);     // 15 وشهر = كامل
  assert.strictEqual(C.bracketPension(16000, Y(15), false, '', C.settingsWith({ bracketBoundary: 'upper' })).amount, 16000);
});
t('صحي: أمثلة التعميم الأخرى 12/7/4', () => {
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
t('صحي: حالة كاملة أكثر من 15 سنة، خبرة طبية 2026/9/6 (مثال التعميم)', () => {
  const r = C.computeCase({ type: 'health', medicalDate: '2026-09-06', untilMonth: '2026-10',
    service: { mode: 'manual', manual: { y: 15, m: 2 } } });
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
t('معونة تقاعد بعد 2014: صحي 17 سنة = 113333، يُصرف نصفها 56666', () => {
  const r = C.retirementAid({ type: 'health', joinDate: '2015-01-01', retirementDate: '2026-10-01', birthDate: '1980-01-01' }, net(17), S);
  assert.strictEqual(r.full, 113333); assert.strictEqual(r.amount, 56666);
});
t('معونة تقاعد بعد 2014: 17 سنة و5 أشهر = 18 جزءاً = 120000، نصفها 60000', () => {
  const r = C.retirementAid({ type: 'health', joinDate: '2015-01-01', retirementDate: '2026-10-01', birthDate: '1980-01-01' }, net(17, 5), S);
  assert.strictEqual(r.full, 120000); assert.strictEqual(r.amount, 60000);
});
t('معونة تقاعد بعد 2014: صحي بحد أدنى 5 أجزاء', () => {
  const r = C.retirementAid({ type: 'health', joinDate: '2020-01-01', retirementDate: '2026-10-01', birthDate: '1980-01-01' }, net(2), S);
  assert.strictEqual(r.full, Math.floor(200000 * 5 / 30)); assert.strictEqual(r.amount, Math.floor(Math.floor(200000 * 5 / 30) / 2));
});
t('معونة تقاعد بعد 2014: 20 سنة عمر 65 → 133333، يُصرف 66666', () => {
  const r = C.retirementAid({ type: 'ordinary', joinDate: '2015-01-01', retirementDate: '2040-06-01', birthDate: '1975-01-01' }, net(20), S);
  assert.strictEqual(r.full, 133333); assert.strictEqual(r.amount, 66666);
});
t('معونة وفاة بعد 2014 بعد قبض معونة التقاعد: النصف الثاني بقيمة سنة الوفاة', () => {
  const r = C.deathAid({ status: 'retired', receivedHalfRetirementAid: true, joinDate: '2015-01-01', deathDate: '2026-10-15', heirs: [{ relation: 'spouse' }] }, net(20), S);
  assert.strictEqual(r.amount, 66666);
});
t('مراجعة: سجل قديم «قبض المعونة كاملة» يبقى بلا معونة وفاة', () => {
  const r = C.deathAid({ status: 'retired', receivedRetirementAid: true, joinDate: '2015-01-01', deathDate: '2026-10-15', heirs: [{ relation: 'spouse' }] }, net(20), S);
  assert.strictEqual(r.amount, 0);
});
t('مراجعة: النصف الثاني لمتقاعد صحي بسنتين يُحسب على 5 أجزاء', () => {
  const r = C.deathAid({ status: 'retired', originalType: 'health', receivedHalfRetirementAid: true, joinDate: '2020-01-01', deathDate: '2026-10-15', heirs: [{ relation: 'spouse' }] }, net(2), S);
  assert.strictEqual(r.amount, Math.floor(Math.floor(5 * 200000 / 30) / 2));
});
t('مراجعة: فترات الاستبعاد المتداخلة تُطرح مرة واحدة', () => {
  // تمرين 5 سنوات (يُطرح سنتان) + منع يدوي في السنة الخامسة (داخل الفترة نفسها)
  const base = { mode: 'dates', start: '1995-01-01', masterDate: '2000-01-01', end: '2025-12-31', trainingMaxYears: 3 };
  const r = C.computeService(Object.assign({}, base, { exclusions: [{ from: '1999-01-01', to: '1999-12-31', reason: 'منع' }] }));
  const r0 = C.computeService(Object.assign({}, base, { exclusions: [] }));
  assert.deepStrictEqual(r.net, r0.net);                      // المنع داخل التمرين الزائد لا يُطرح مرتين
  assert.strictEqual(r.net.y, 29);
});
t('مراجعة: سقف التمرين لمن بقي متمرناً حتى النهاية', () => {
  const r = C.computeService({ mode: 'dates', start: '2020-01-01', stillTrainee: true, end: '2025-12-31', trainingMaxYears: 3, exclusions: [] });
  assert.deepStrictEqual(r.net, { y: 3, m: 0, d: 0 });
});
t('مراجعة: حصة الخزانة إلزامية حتى لو حُفظ تعطيلها', () => {
  const S2 = C.settingsWith({ treasuryShare: false });
  const sh = C.pensionShares([{ relation: 'spouse' }], '2026-10-01', S2);
  assert.strictEqual(sh.totalShares, 4);
});
t('مراجعة: سقف تمرين غير صحيح يعود للافتراضي', () => {
  assert.strictEqual(C.settingsWith({ trainingMaxYears: 2.5 }).trainingMaxYears, 3);
  assert.strictEqual(C.settingsWith({ trainingMaxYears: -1 }).trainingMaxYears, 3);
  assert.strictEqual(C.settingsWith({ trainingMaxYears: 4 }).trainingMaxYears, 4);
});
t('مراجعة: تاريخ مشاهدة قبل قرار الإحالة مرفوض', () => {
  const r = C.computeCase({ type: 'ordinary', retirementDate: '2026-10-05', reviewDate: '2026-10-01', appealWaived: true, untilMonth: '2026-12', service: { mode: 'manual', manual: { y: 30 } } });
  assert.ok(r.errors.length && /يسبق/.test(r.errors[0]));
});
t('مراجعة: توزيع الورثة بلقطة واحدة (الحصة المتوقفة في الخزانة فقط)', () => {
  const r = C.computeCase({ type: 'heirs', status: 'inService', deathDate: '2025-12-31', untilMonth: '2027-02',
    service: { mode: 'manual', manual: { y: 20 } },
    heirs: [{ relation: 'spouse', name: 'ز' }, { relation: 'son', name: 'ا', birth: '2008-03-15' }] });
  const D = r.distNow, son = D.perGroup.find(g => g.key.indexOf('child') === 0);
  assert.strictEqual(son.amount, 0);
  const sumGroups = D.perGroup.reduce((a, g) => a + g.amount, 0);
  assert.strictEqual(sumGroups + D.treasury, D.unit * 5);
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

// ---------- قرارات المختص 19/11/2026
t('المختص 1: 9 سنوات = 60000، و9 سنوات وشهر = 10 سنوات', () => {
  assert.strictEqual(C.deathAid({ status: 'inService', joinDate: '2015-01-01', deathDate: '2026-08-10', heirs: sp }, net(9), S).amount, 60000);
  assert.strictEqual(C.deathAid({ status: 'inService', joinDate: '2015-01-01', deathDate: '2026-08-10', heirs: sp }, net(9, 1), S).amount, Math.floor(10 * 200000 / 30));
});
t('المختص 2: وفاة 4/7/2026 → من 5/7 حتى 31/7 = 27 يوماً', () => {
  const p = C.prorate(9999, C.parseDate('2026-07-05'));
  assert.strictEqual(p.days, 27); assert.strictEqual(p.amount, Math.floor(9999 * 27 / 30));
});
t('المختص 6: التمرين يُحسب 3 سنوات بحد أقصى', () => {
  const r = C.computeService({ mode: 'dates', start: '1995-01-01', masterDate: '2000-01-01', end: '2025-12-31', trainingMaxYears: 3, exclusions: [] });
  assert.deepStrictEqual(r.gross, { y: 31, m: 0, d: 0 });
  assert.strictEqual(r.net.y, 29); assert.strictEqual(r.net.m, 0); // يُطرح سنتان تمرين زائدتان (أيام فعلية)
  const r2 = C.computeService({ mode: 'dates', start: '1995-01-01', masterDate: '1997-01-01', end: '2025-12-31', trainingMaxYears: 3, exclusions: [] });
  assert.deepStrictEqual(r2.net, { y: 31, m: 0, d: 0 });    // تمرين سنتان يُحسب كاملاً
});
t('المختص 7: حصة الخزانة دائماً (5 حصص ورثة ÷ 6)', () => {
  const sh = C.pensionShares([{ relation: 'spouse' }, { relation: 'daughter' }, { relation: 'son', birth: '2015-01-01' }], '2026-10-01', S);
  assert.strictEqual(sh.heirShares, 5); assert.strictEqual(sh.totalShares, 6);
});
t('المختص 8: ابن يبلغ 18 في 15/3/2026 → حصته حتى 31/12/2026 ثم تعود للخزانة', () => {
  const r = C.computeCase({ type: 'heirs', status: 'inService', deathDate: '2025-12-31', untilMonth: '2027-02',
    service: { mode: 'manual', manual: { y: 20 } },
    heirs: [{ relation: 'spouse', name: 'ز' }, { relation: 'son', name: 'ا', birth: '2008-03-15' }] });
  assert.deepStrictEqual(r.errors, []);
  const ps = r.schedule.periods;
  // 2026: الراتب 4000 حتى 6 ثم 16000؛ الحصة = ÷5
  const y2027 = ps.find(p => p.from === '2027-01-01');
  assert.ok(y2027, 'period from 2027-01-01');
  assert.strictEqual(y2027.monthlyHeirs[1], 0);                         // توقفت حصة الابن
  assert.strictEqual(y2027.monthlyHeirs[0], Math.floor(16000 / 5) * 3); // الزوجة لا تزيد (لا إعادة توزيع)
  const dec26 = ps.find(p => p.to === '2026-12-31');
  assert.strictEqual(dec26.monthlyHeirs[1], Math.floor(16000 / 5));     // كان يستحق طوال 2026
  assert.strictEqual(r.shares.list[1].stopFrom, '2027-01-01');
});
t('المختص 8: ابنة تزوجت (تاريخ توقف) → تتوقف من أول السنة التالية', () => {
  const S2 = C.settingsWith();
  const h = { relation: 'daughter', married: true, stopDate: '2026-05-10', stopReason: 'married' };
  assert.ok(C.heirYearEligible(h, 2026, '2026-01-15').ok);
  assert.ok(!C.heirYearEligible(h, 2027, '2026-01-15').ok);
});
t('بدء الصرف: مشاهدة 19/10/2026 مع إسقاط الطعن → 19/10، وبدونه → 19/11', () => {
  const base = { type: 'ordinary', retirementDate: '2026-10-05', reviewDate: '2026-10-19', untilMonth: '2026-12', service: { mode: 'manual', manual: { y: 30 } } };
  assert.strictEqual(C.computeCase(Object.assign({}, base, { appealWaived: true })).startDate, '2026-10-19');
  assert.strictEqual(C.computeCase(base).startDate, '2026-11-19');
  assert.strictEqual(C.computeCase(Object.assign({}, base, { reviewDate: '' })).startDate, '2026-10-05');
});

t('مراجعة 2: يوم 31 يُحسب عند حد الشريحة (15 سنة ويوم = كامل)', () => {
  const r = C.computeCase({ type: 'health', medicalDate: '2026-02-01', untilMonth: '2026-02',
    service: { mode: 'dates', start: '2011-01-31', end: '2026-01-31', exclusions: [] } });
  assert.deepStrictEqual(r.service.net, { y: 15, m: 0, d: 1 });
  assert.strictEqual(r.baseNow.amount, 4000);   // كامل الراتب النافذ في 2/2026 (قبل زيادة 7/2026)
  const r2 = C.computeCase({ type: 'health', medicalDate: '2026-02-01', untilMonth: '2026-02',
    service: { mode: 'dates', start: '2011-02-01', end: '2026-01-31', exclusions: [] } });
  assert.deepStrictEqual(r2.service.net, { y: 15, m: 0, d: 0 });
  assert.strictEqual(r2.baseNow.amount, 3000);  // ثلاثة أرباع 4000
});
t('مراجعة 3: المدة الصافية بالتقويم (أمثلة Codex)', () => {
  const ex = { mode: 'dates', start: '2011-02-01', end: '2026-02-28', exclusions: [{ from: '2011-03-01', to: '2011-03-28', reason: 'منع' }] };
  assert.deepStrictEqual(C.computeService(ex).net, { y: 15, m: 0, d: 0 });
  const r = C.computeCase({ type: 'health', medicalDate: '2026-03-01', untilMonth: '2026-03', service: ex });
  assert.strictEqual(r.baseNow.amount, 3000);                       // ثلاثة أرباع 4000 لا الكامل
  const r2 = C.computeService({ mode: 'dates', start: '2011-01-31', end: '2026-01-29', exclusions: [] });
  assert.ok(r2.net.y === 14, JSON.stringify(r2.net));               // أقل من 15 سنة بيوم
});
t('مراجعة 4: سقف التمرين لا يضيف يوماً (حلف 2/1/2015، متمرن حتى 28/2/2019)', () => {
  const r = C.computeService({ mode: 'dates', start: '2015-01-02', stillTrainee: true, end: '2019-02-28', trainingMaxYears: 3, exclusions: [] });
  assert.deepStrictEqual(r.net, { y: 3, m: 0, d: 0 });
  assert.strictEqual(C.adoptYears(r.net, 'ceil').years, 3);
});
t('مراجعة 5: تمرين حتى نهاية الممارسة عند نهاية الشهر (31/1/2020 → 27/2/2023) = 3 سنوات', () => {
  const r = C.computeService({ mode: 'dates', start: '2020-01-31', stillTrainee: true, end: '2023-02-27', trainingMaxYears: 3, exclusions: [] });
  assert.deepStrictEqual(r.net, { y: 3, m: 0, d: 0 });
  assert.strictEqual(C.adoptYears(r.net, 'floor').years, 3);
});
t('مراجعة 5: استبعاد ملاصق لبداية الممارسة يُقص بتاريخه', () => {
  const r = C.computeService({ mode: 'dates', start: '2020-01-31', end: '2025-01-30', exclusions: [{ from: '2020-01-31', to: '2020-02-29', reason: 'منع' }] });
  assert.deepStrictEqual(r.net, C.diffYMD(C.parseDate('2020-03-01'), C.parseDate('2025-01-31')));
});
t('مراجعة 5: تحديد الخيارين معاً يُعتمد فيه النصف الصريح', () => {
  const r = C.deathAid({ status: 'retired', receivedRetirementAid: true, receivedHalfRetirementAid: true, joinDate: '2015-01-01', deathDate: '2026-10-15', heirs: [{ relation: 'spouse' }] }, net(20), S);
  assert.strictEqual(r.amount, 66666);
});
t('مراجعة 6: استبعاد سنة كاملة مع نهاية 28/2 في سنة كبيسة لا يُضيع يوماً', () => {
  const r = C.computeService({ mode: 'dates', start: '2008-02-28', end: '2024-02-28', exclusions: [{ from: '2015-01-01', to: '2015-12-31', reason: 'منع' }] });
  assert.deepStrictEqual(r.gross, { y: 16, m: 0, d: 1 });
  assert.deepStrictEqual(r.net, { y: 15, m: 0, d: 1 });
});
t('مراجعة 7: حلف في 29/2 واستبعاد سنة كاملة = 15 سنة بالضبط', () => {
  const r = C.computeService({ mode: 'dates', start: '2008-02-29', end: '2024-02-28', exclusions: [{ from: '2015-01-01', to: '2015-12-31', reason: 'منع' }] });
  assert.deepStrictEqual(r.gross, { y: 16, m: 0, d: 0 });
  assert.deepStrictEqual(r.net, { y: 15, m: 0, d: 0 });
});
t('مراجعة 7: إجمالي الاستبعاد يُعرض بالأيام دون تناقض', () => {
  const r = C.computeService({ mode: 'dates', start: '2020-01-31', end: '2020-03-30', exclusions: [{ from: '2020-01-31', to: '2020-01-31', reason: 'منع' }] });
  assert.strictEqual(r.excludedDays, 1);
  assert.ok(r.steps.some(x => /= 1 يوماً،/.test(x)) && !r.steps.some(x => /لا شيء/.test(x)));
});
t('مراجعة 4: نهاية الشهر (29/2/2020 حتى 27/2/2025 شاملاً = 5 سنوات)', () => {
  assert.deepStrictEqual(C.spanInclusive(C.parseDate('2020-02-29'), C.parseDate('2025-02-27')), { y: 5, m: 0, d: 0 });
  assert.deepStrictEqual(C.computeService({ mode: 'dates', start: '2020-02-29', end: '2025-02-27', exclusions: [] }).net, { y: 5, m: 0, d: 0 });
});
t('مراجعة 3: من فقد أهليته في 1/1 تتوقف حصته من 1/1 للسنة التالية', () => {
  const h = { relation: 'daughter', married: true, stopDate: '2027-01-01', stopReason: 'married' };
  assert.ok(C.heirYearEligible(h, 2027, '2026-03-01').ok);
  assert.ok(!C.heirYearEligible(h, 2028, '2026-03-01').ok);
  const son = { relation: 'son', birth: '2009-01-01' };             // يبلغ 18 في 1/1/2027
  assert.ok(C.heirYearEligible(son, 2027, '2026-03-01').ok);
  assert.ok(!C.heirYearEligible(son, 2028, '2026-03-01').ok);
});
t('مراجعة 3: لا يُجمع تاريخ القيد أستاذاً مع «بقي متمرناً»', () => {
  const r = C.computeService({ mode: 'dates', start: '2020-01-01', masterDate: '2022-01-01', stillTrainee: true, end: '2025-12-31', exclusions: [] });
  assert.ok(r.error);
});
t('مراجعة 3: لا NaN في الخزانة عند انعدام الورثة المستحقين', () => {
  const r = C.computeCase({ type: 'heirs', status: 'inService', deathDate: '2026-01-10', untilMonth: '2026-03',
    service: { mode: 'manual', manual: { y: 20 } }, heirs: [{ relation: 'brother', name: 'أخ' }] });
  assert.strictEqual(r.distNow.treasury, 0);
});
t('مراجعة 2: تاريخ التوقف لا يخفي شرطاً مستقلاً (ابنة لها مورد ثم تزوجت)', () => {
  const h = { relation: 'daughter', hasIncome: true, married: true, stopDate: '2027-05-10', stopReason: 'married' };
  assert.ok(!C.heirEligibleAt(h, '2026-01-15').ok);
  const h2 = { relation: 'daughter', married: true, stopDate: '2027-05-10', stopReason: 'married' };
  assert.ok(C.heirEligibleAt(h2, '2026-01-15').ok);
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
