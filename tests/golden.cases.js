// حالات الاختبار الذهبي للراتب التقاعدي: مدخلات ثابتة تُحفظ نتائجها كما هي.
// لا تُعدَّل هذه الحالات ولا نتائجها إلا بطلب صريح من المالك.
'use strict';
const base = { birthDate: '1960-03-15', joinDate: '1990-05-01', includeAid: true, untilMonth: '2026-10' };
const svc = (start, end, extra) => Object.assign({ mode: 'dates', start, end, exclusions: [] }, extra || {});
const H = (relation, birth, flags) => Object.assign({ name: relation, relation, birth }, flags || {});
module.exports = [
  // ---- عادي
  ['عادي 30 سنة كاملة', Object.assign({}, base, { type: 'ordinary', retirementDate: '2020-05-01', service: svc('1990-05-01', '2020-05-01') })],
  ['عادي 20 سنة', Object.assign({}, base, { type: 'ordinary', retirementDate: '2024-01-01', joinDate: '2004-01-01', service: svc('2004-01-01', '2024-01-01') })],
  ['عادي 36 سنة مع علاوة', Object.assign({}, base, { type: 'ordinary', retirementDate: '2025-06-30', joinDate: '1989-06-01', service: svc('1989-06-01', '2025-06-30') })],
  ['عادي 46 سنة فوق السقف', Object.assign({}, base, { type: 'ordinary', retirementDate: '2026-01-15', joinDate: '1980-01-01', service: svc('1980-01-01', '2026-01-15') })],
  ['عادي مع مشاهدة مراقب وإسقاط طعن', Object.assign({}, base, { type: 'ordinary', retirementDate: '2026-02-10', reviewDate: '2026-03-01', appealWaived: true, service: svc('1995-02-10', '2026-02-10') })],
  ['عادي مع مشاهدة دون إسقاط طعن', Object.assign({}, base, { type: 'ordinary', retirementDate: '2026-02-10', reviewDate: '2026-03-01', service: svc('1995-02-10', '2026-02-10') })],
  ['عادي مع تمرين طويل (سقف 3 سنوات)', Object.assign({}, base, { type: 'ordinary', retirementDate: '2026-07-01', joinDate: '1990-01-01', service: svc('1990-01-01', '2026-07-01', { masterDate: '1996-01-01' }) })],
  ['عادي مع استبعادات متداخلة', Object.assign({}, base, { type: 'ordinary', retirementDate: '2026-04-01', service: svc('1992-04-01', '2026-04-01', { exclusions: [{ reason: 'شطب', from: '2000-01-01', to: '2002-12-31' }, { reason: 'أخرى', from: '2002-06-01', to: '2003-06-30' }] }) })],
  ['عادي انتسب بعد 2014 (نصف المعونة)', Object.assign({}, base, { type: 'ordinary', birthDate: '1975-01-01', joinDate: '2015-03-01', retirementDate: '2026-05-01', service: svc('2015-03-01', '2026-05-01') })],
  ['عادي انتسب بعد 45', Object.assign({}, base, { type: 'ordinary', birthDate: '1950-01-01', joinDate: '1998-01-01', retirementDate: '2026-01-01', service: svc('1998-01-01', '2026-01-01') })],
  ['عادي إعادة قيد', Object.assign({}, base, { type: 'ordinary', reRegistration: true, priorPracticeYears: '3', retirementDate: '2026-03-01', service: svc('2000-03-01', '2026-03-01') })],
  ['عادي بدون معونة', Object.assign({}, base, { type: 'ordinary', includeAid: false, retirementDate: '2023-09-01', service: svc('1993-09-01', '2023-09-01') })],
  ['عادي مدة يدوية', Object.assign({}, base, { type: 'ordinary', retirementDate: '2026-01-01', service: { mode: 'manual', manual: { y: '27', m: '5', d: '10' } } })],
  ['عادي حلف يمين 29 شباط', Object.assign({}, base, { type: 'ordinary', retirementDate: '2025-02-28', joinDate: '2000-02-29', service: svc('2000-02-29', '2025-02-28') })],
  // ---- صحي
  ['صحي 5 سنوات بالضبط', Object.assign({}, base, { type: 'health', medicalDate: '2026-06-01', joinDate: '2021-06-01', service: svc('2021-06-01', '2026-05-31') })],
  ['صحي 5 سنوات ويوم', Object.assign({}, base, { type: 'health', medicalDate: '2026-06-02', joinDate: '2021-06-01', service: svc('2021-06-01', '2026-06-01') })],
  ['صحي 12 سنة', Object.assign({}, base, { type: 'health', medicalDate: '2026-09-06', joinDate: '2014-01-01', service: svc('2014-01-01', '2026-01-01') })],
  ['صحي 15 بالضبط', Object.assign({}, base, { type: 'health', medicalDate: '2026-02-01', joinDate: '2011-01-31', service: svc('2011-01-31', '2026-01-30') })],
  ['صحي ناتج عن المهنة', Object.assign({}, base, { type: 'health', occupational: true, medicalDate: '2026-10-10', joinDate: '2023-01-01', service: svc('2023-01-01', '2026-10-10') })],
  ['صحي 20 سنة', Object.assign({}, base, { type: 'health', medicalDate: '2025-12-20', joinDate: '2005-01-01', service: svc('2005-01-01', '2025-12-20') })],
  // ---- ورثة
  ['ورثة على رأس عمله: زوجة وابنان', Object.assign({}, base, { type: 'heirs', status: 'inService', deathDate: '2026-07-04', joinDate: '2000-01-01', service: svc('2000-01-01', '2026-07-04'), heirs: [H('spouse', '1970-01-01'), H('son', '2005-01-01', { student: true }), H('daughter', '2008-05-05')] })],
  ['ورثة على رأس عمله 8 سنوات', Object.assign({}, base, { type: 'heirs', status: 'inService', deathDate: '2026-03-15', joinDate: '2018-01-01', service: svc('2018-01-01', '2026-03-15'), heirs: [H('spouse', '1980-01-01'), H('daughter', '2010-01-01')] })],
  ['ورثة متقاعد عادي', Object.assign({}, base, { type: 'heirs', status: 'retired', originalType: 'ordinary', retirementDate: '2015-01-01', deathDate: '2025-11-20', joinDate: '1985-01-01', service: svc('1985-01-01', '2015-01-01'), heirs: [H('spouse', '1955-01-01'), H('mother', '1930-01-01', { dependent: true })] })],
  ['ورثة متقاعد قبض نصف المعونة', Object.assign({}, base, { type: 'heirs', status: 'retired', originalType: 'ordinary', joinDate: '2014-06-01', birthDate: '1970-01-01', retirementDate: '2024-06-01', receivedHalfRetirementAid: true, deathDate: '2026-02-02', service: svc('2014-06-01', '2024-06-01'), heirs: [H('spouse', '1972-01-01')] })],
  ['ورثة متقاعد قبض المعونة كاملة', Object.assign({}, base, { type: 'heirs', status: 'retired', originalType: 'ordinary', retirementDate: '2010-01-01', receivedRetirementAid: true, deathDate: '2026-01-10', service: svc('1980-01-01', '2010-01-01'), heirs: [H('spouse', '1950-01-01')] })],
  ['ورثة متقاعد صحي', Object.assign({}, base, { type: 'heirs', status: 'retired', originalType: 'health', retirementDate: '2022-01-01', deathDate: '2026-08-08', joinDate: '2012-01-01', service: svc('2012-01-01', '2022-01-01'), heirs: [H('spouse', '1975-01-01'), H('son', '2010-01-01')] })],
  ['ورثة: بنت تزوجت أثناء الصرف', Object.assign({}, base, { type: 'heirs', status: 'inService', deathDate: '2024-04-04', joinDate: '2000-01-01', service: svc('2000-01-01', '2024-04-04'), heirs: [H('spouse', '1970-01-01'), H('daughter', '2000-01-01', { married: true, stopDate: '2025-06-01', stopReason: 'married' })] })],
  ['ورثة: بلا مستحق', Object.assign({}, base, { type: 'heirs', status: 'inService', deathDate: '2026-01-01', joinDate: '2000-01-01', service: svc('2000-01-01', '2026-01-01'), heirs: [H('brother', '1965-01-01')] })],
  ['ورثة: وفاة أثناء العمل ناتجة عن المهنة', Object.assign({}, base, { type: 'heirs', status: 'inService', occupational: true, deathDate: '2026-05-05', joinDate: '2024-01-01', service: svc('2024-01-01', '2026-05-05'), heirs: [H('spouse', '1990-01-01'), H('son', '2015-01-01')] })],
  ['ورثة: أب وأم معالان', Object.assign({}, base, { type: 'heirs', status: 'inService', deathDate: '2025-09-09', joinDate: '2010-01-01', birthDate: '1985-01-01', service: svc('2010-01-01', '2025-09-09'), heirs: [H('father', '1955-01-01', { dependent: true }), H('mother', '1958-01-01', { dependent: true })] })]
];
