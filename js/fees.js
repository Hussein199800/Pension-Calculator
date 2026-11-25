/* =========================================================
 * محرك حساب رسوم الانتساب وإعادة القيد والرسوم السنوية
 * ---------------------------------------------------------
 * مستقل تماماً عن حاسبة التقاعد (calc.js): لا يقرأ منها ولا تقرأ منه.
 * يعمل في المتصفح (window.FeesCalc) وفي Node (module.exports) للاختبار.
 * كل المبالغ بالعملة الجديدة كما في ملف fees_2026.xlsx والجداول المعلقة.
 * قرارات المالك: docs/superpowers/specs/2026-11-24-fees-calculator-design.md
 * ========================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FeesCalc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- البيانات الافتراضية (بالعملة الجديدة) ----------
     يستطيع المستخدم تعديلها من «إعدادات الرسوم» (pc.feeSettings.v1)، والمحفوظ يُدمج فوق هذه القيم
     بدالة dataWith. لا تُعدَّل هذه القيم في الكود إلا بطلب صريح من المالك يذكر الرقم ومصدره. */

  /* الرسم السنوي لكل سنة (الورقة السنوية) */
  var DEF_ANNUAL = { 2011: 60, 2012: 60, 2013: 105, 2014: 105, 2015: 135, 2016: 135, 2017: 135, 2018: 145, 2019: 145, 2020: 155, 2021: 400, 2022: 650, 2023: 750, 2024: 750, 2025: 750, 2026: 5000 };
  /* الرسم السنوي لمن انتسب بعمر فوق 45 (لا يستفيد من معونة الوفاة): من سطور 46–50 في جدول السنة.
     2025 = 600 (قرار المالك)، و2011–2019 مثل غيره (المبلغ نفسه، فلا سطر لها هنا). */
  var DEF_OVER45 = { 2020: 130, 2021: 300, 2022: 500, 2023: 600, 2024: 600, 2025: 600, 2026: 4000 };

  /* بنود جدول الانتساب بالترتيب */
  var COLS = [
    ['union', 'قيد النقابة'], ['pension', 'قيد التقاعد'], ['annual', 'الرسم السنوي'], ['practice', 'دفتر أو تثبيت ممارسة'],
    ['id', 'الهوية'], ['badge', 'الشارة'], ['prints', 'المطبوعات'], ['death', 'معونة الوفاة'], ['exam', 'رسم الامتحان']
  ];
  var AGES = []; for (var _a = 30; _a <= 50; _a++) AGES.push(_a);
  function ramp(parts) { /* parts: [[startValue, step, count], ...] متتابعة */
    var out = []; parts.forEach(function (p) { for (var i = 0; i < p[2]; i++) out.push(p[0] + p[1] * i); }); return out;
  }
  /* كل جدول يُبنى سطراً سطراً (العمر 30..50 × البنود)، ومعونة الوفاة صفر فوق 45 */
  function build(from, k, pension, death) {
    var rows = {};
    AGES.forEach(function (age, i) {
      rows[age] = { union: k.union, pension: pension[i], annual: k.annual[age > 45 ? 1 : 0], practice: k.practice, id: k.id, badge: k.badge, prints: k.prints, death: age <= 45 ? death[i] : 0, exam: k.exam };
    });
    return { from: from, rows: rows };
  }
  var DEF_TABLES = {
    2020: build('2020-07-01', { union: 150, annual: [155, 130], practice: 50, id: 50, badge: 10, prints: 10, exam: 0 },
      ramp([[250, 50, 11], [900, 150, 5], [1750, 250, 5]]), ramp([[200, 30, 11], [550, 50, 5]])),
    2021: build('2021-01-01', { union: 250, annual: [400, 300], practice: 50, id: 50, badge: 20, prints: 20, exam: 0 },
      ramp([[300, 100, 11], [1500, 200, 5], [2800, 500, 5]]), ramp([[350, 100, 11], [1500, 150, 5]])),
    2022: build('2022-01-01', { union: 250, annual: [650, 500], practice: 50, id: 100, badge: 50, prints: 50, exam: 0 },
      ramp([[400, 150, 11], [2150, 250, 5], [3650, 500, 5]]), ramp([[450, 150, 11], [2150, 200, 5]])),
    2023: build('2023-09-17', { union: 250, annual: [750, 600], practice: 50, id: 250, badge: 250, prints: 50, exam: 100 },
      ramp([[400, 150, 11], [2150, 250, 5], [3650, 500, 5]]), ramp([[450, 150, 11], [2150, 200, 5]])),
    2024: build('2024-09-01', { union: 500, annual: [750, 600], practice: 250, id: 250, badge: 500, prints: 250, exam: 250 },
      ramp([[750, 250, 11], [3650, 400, 4], [5600, 750, 6]]), ramp([[750, 250, 11], [3650, 400, 4], [5250, 0, 1]])),
    2026: build('2026-01-01', { union: 5000, annual: [5000, 4000], practice: 1000, id: 1000, badge: 1000, prints: 1000, exam: 2000 },
      ramp([[15000, 1500, 11], [32000, 2000, 4], [40500, 2500, 6]]), ramp([[4000, 250, 16]]))
  };

  /* رسوم ثابتة لحالات إعادة القيد والنقل (مسطّحة ليسهل تعديلها من الإعدادات) */
  var FIXED_FIELDS = [
    ['admUnion', 'مشطوب إداري: رسم النقابة', 20000], ['admPension', 'مشطوب إداري: رسم التقاعد', 20000],
    ['reUnion', 'إعادة قيد بعد الترقين: رسم النقابة', 10000], ['rePension', 'إعادة قيد بعد الترقين: رسم التقاعد', 10000],
    ['omUnion', 'مُغفَل: رسم النقابة', 3000], ['omPension', 'مُغفَل: رسم التقاعد', 7000],
    ['trfUnion', 'النقل من فرع لآخر: رسم النقابة', 5000], ['trfPension', 'النقل من فرع لآخر: رسم التقاعد', 5000],
    ['deathAid', 'رسم معونة الوفاة عند إعادة القيد', 2500], ['gapYear', 'عن كل سنة انقطاع', 2500],
    ['prints', 'المطبوعات (إعادة القيد)', 1000], ['practice', 'تثبيت ممارسة (إعادة القيد)', 1000],
    ['optId', 'اختياري: الهوية', 1000], ['optLicense', 'اختياري: إجازة المحاماة', 1000], ['optBadge', 'اختياري: شارة الصدر', 1000],
    ['tmUnion', 'متمرن إلى الأساتذة: قيد النقابة', 1000], ['tmPension', 'متمرن إلى الأساتذة: قيد التقاعد', 2000],
    ['tmLicenseFee', 'متمرن إلى الأساتذة: رسم إجازة المحاماة', 1000], ['tmId', 'متمرن إلى الأساتذة: الهوية', 1000],
    ['tmLicensePrice', 'متمرن إلى الأساتذة: ثمن إجازة المحاماة', 50],
    ['tmOld', 'متمرن إلى الأساتذة قبل 1/3/2026: الرسم المركزي (إجمالي)', 950],
    ['securityFrom', 'المشطوب الأمني يدفع الرسوم السنوية اعتباراً من سنة', 2011]
  ];


  /* ---------- رسوم الفروع (2026) ----------
     جدول «رسوم الانتساب للفروع 2026» حسب العمر، و«رسوم الفروع» الثابتة. كل ما سبق رسوم مركزية.
     «مطبوعات + مفكرة» في جدول الفرع «حسب المطبوعات الموجودة»: مبلغ يكتبه الموظف (قرار المالك). */
  var BCOLS = [
    ['reg', 'رسم قيد منتسب'], ['ambulance', 'رسم الانتساب لصندوق الإسعاف'], ['annual', 'الرسم السنوي للفرع (الفرع + التعاون + الإسعاف + التكافل)'],
    ['coop', 'رسم الانتساب لصندوق التعاون'], ['training', 'الرسم السنوي لمتطلبات التمرين'], ['file', 'إضبارة وروب'], ['takaful', 'رسم الانتساب لصندوق التكافل']
  ];
  function buildBranch(from, reg, fund, training) {
    var rows = {};
    AGES.forEach(function (age, i) {
      rows[age] = { reg: reg[i], ambulance: fund[i], annual: 3000, coop: fund[i], training: training(age), file: 3000, takaful: fund[i] - 1000 };
    });
    return { from: from, rows: rows };
  }
  var DEF_BRANCH_TABLES = {
    2026: buildBranch('2026-01-01',
      ramp([[10000, 1000, 11], [21500, 1500, 5], [29500, 2000, 5]]),
      ramp([[2000, 500, 21]]),
      function (age) { return age <= 41 ? 5000 : 2000; })
  };
  /* رسم الفرع السنوي: من 2026 فقط (قرار المالك)، ولا رسم للفرع قبلها */
  var DEF_BRANCH_ANNUAL = { 2026: 3000 };
  var BRANCH_FIELDS = [
    ['brMaster', 'الفرع: رسم الأستذة', 5000], ['brTransfer', 'الفرع: رسم النقل من فرع إلى آخر', 5000],
    ['brOmitted', 'الفرع: رسم إعادة قيد المُغفَل', 5000], ['brReCancel', 'الفرع: رسم إعادة قيد المرقّن', 10000],
    ['brStruck', 'الفرع: رسم إعادة قيد المشطوب', 20000]
  ];
  FIXED_FIELDS = FIXED_FIELDS.concat(BRANCH_FIELDS);

  function isAmount(v) { return typeof v === 'number' && isFinite(v) && v >= 0; }
  /* يدمج إعدادات المستخدم فوق القيم الافتراضية، ويتجاهل أي قيمة غير صالحة (فيبقى الافتراضي) */
  function dataWith(over) {
    over = over || {};
    var annual = {}, over45 = {}, tables = {}, flat = {}, k;
    for (k in DEF_ANNUAL) annual[k] = DEF_ANNUAL[k];
    for (k in DEF_OVER45) over45[k] = DEF_OVER45[k];
    if (over.annual) for (k in over.annual) { if (/^\d{4}$/.test(k)) { if (over.annual[k] === null) delete annual[k]; else if (isAmount(over.annual[k])) annual[k] = over.annual[k]; } }
    if (over.over45) for (k in over.over45) { if (/^\d{4}$/.test(k)) { if (over.over45[k] === null) delete over45[k]; else if (isAmount(over.over45[k])) over45[k] = over.over45[k]; } }
    for (k in DEF_TABLES) tables[k] = DEF_TABLES[k];
    if (over.tables) for (k in over.tables) {
      var t = over.tables[k];
      if (!/^\d{4}$/.test(k)) continue;
      if (t === null) { delete tables[k]; continue; }
      var ok = t && t.rows && AGES.every(function (a) { var r = t.rows[a]; return r && COLS.every(function (c) { return isAmount(r[c[0]]); }); });
      if (ok) tables[k] = t;
    }
    if (!Object.keys(tables).length) tables = DEF_TABLES;
    /* الفرع: الجداول والرسم السنوي بالطريقة نفسها */
    var btables = {}, bannual = {};
    for (k in DEF_BRANCH_TABLES) btables[k] = DEF_BRANCH_TABLES[k];
    if (over.branchTables) for (k in over.branchTables) {
      var bt = over.branchTables[k];
      if (!/^\d{4}$/.test(k)) continue;
      if (bt === null) { delete btables[k]; continue; }
      if (bt && bt.rows && AGES.every(function (a) { var r = bt.rows[a]; return r && BCOLS.every(function (c) { return isAmount(r[c[0]]); }); })) btables[k] = bt;
    }
    if (!Object.keys(btables).length) btables = DEF_BRANCH_TABLES;
    for (k in DEF_BRANCH_ANNUAL) bannual[k] = DEF_BRANCH_ANNUAL[k];
    if (over.branchAnnual) for (k in over.branchAnnual) { if (/^\d{4}$/.test(k)) { if (over.branchAnnual[k] === null) delete bannual[k]; else if (isAmount(over.branchAnnual[k])) bannual[k] = over.branchAnnual[k]; } }
    var byears = Object.keys(bannual).map(Number).sort(function (a, b) { return a - b; });
    if (!Object.keys(annual).length) annual = DEF_ANNUAL;
    FIXED_FIELDS.forEach(function (f) { var v = over.fixed && over.fixed[f[0]]; flat[f[0]] = isAmount(v) ? v : f[2]; });
    var years = Object.keys(annual).map(Number).sort(function (a, b) { return a - b; });
    return {
      ANNUAL: annual, ANNUAL_OVER45: over45, TABLES: tables, flat: flat,
      TABLE_YEARS: Object.keys(tables).map(Number).sort(function (a, b) { return a - b; }),
      FIRST: years[0], LAST: years[years.length - 1],
      BRANCH_TABLES: btables, BRANCH_YEARS: Object.keys(btables).map(Number).sort(function (a, b) { return a - b; }),
      BRANCH_ANNUAL: bannual, BRANCH_FIRST: byears[0], BRANCH_LAST: byears[byears.length - 1],
      FIXED: {
        admStruck: { union: flat.admUnion, pension: flat.admPension },
        reCancel: { union: flat.reUnion, pension: flat.rePension },
        omitted: { union: flat.omUnion, pension: flat.omPension },
        transfer: { union: flat.trfUnion, pension: flat.trfPension },
        deathAid: flat.deathAid, gapYear: flat.gapYear, prints: flat.prints, practice: flat.practice,
        optional: { id: ['الهوية', flat.optId], license: ['إجازة المحاماة', flat.optLicense], badge: ['شارة الصدر', flat.optBadge] },
        trainee: [['قيد النقابة', flat.tmUnion], ['قيد التقاعد', flat.tmPension], ['رسم إجازة المحاماة', flat.tmLicenseFee], ['الهوية', flat.tmId], ['ثمن إجازة المحاماة', flat.tmLicensePrice]],
        securityFrom: flat.securityFrom
      }
    };
  }
  var DEF = dataWith(null);
  var D = DEF; /* البيانات النافذة أثناء الحساب الجاري (الحساب متزامن، فتُعاد إلى الافتراضي بعده) */
  function using(data, fn) { var prev = D; D = data ? dataWith(data) : DEF; try { return fn(); } finally { D = prev; } }

  var KINDS = {
    new: 'انتساب جديد',
    secStruck: 'إعادة قيد مشطوب أمني',
    admStruck: 'إعادة قيد مشطوب إداري',
    cancelSelf: 'ترقين القيد بطلب المحامي',
    reCancel: 'إعادة القيد بعد الترقين',
    omitted: 'إعادة قيد المُغفَل',
    transfer: 'النقل من فرع إلى آخر',
    traineeToMaster: 'الأستذة (نقل المتمرن إلى جدول الأساتذة)',
    exempt: 'قيد المعفى من التمرين'
  };
  var STATUS = { active: 'قيده سارٍ', cancelled: 'مرقّن القيد', deceased: 'متوفى', other: 'وضع آخر' };

  /* ---------- أدوات ---------- */
  function parseDate(s) {
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(s || '').trim());
    if (!m) return null;
    var d = { y: +m[1], m: +m[2], d: +m[3] };
    var t = new Date(Date.UTC(d.y, d.m - 1, d.d));
    return t.getUTCMonth() === d.m - 1 ? d : null;
  }
  function fmtDate(d) { d = typeof d === 'string' ? parseDate(d) : d; return d ? d.d + '/' + d.m + '/' + d.y : '—'; }
  function dim(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
  /* الفرق بالسنوات والأشهر والأيام من a إلى b */
  function addMonthsD(a, n) { var t = a.y * 12 + (a.m - 1) + n, y = Math.floor(t / 12), m = t % 12 + 1; return { y: y, m: m, d: Math.min(a.d, dim(y, m)) }; }
  function dayNum(d) { return Date.UTC(d.y, d.m - 1, d.d) / 86400000; }
  /* الأشهر المكتملة من a (يُقصّ اليوم إلى آخر الشهر: 29/2 + 12 شهراً = 28/2)، ثم الأيام التقويمية الباقية */
  function diffYMD(a, b) {
    var months = (b.y - a.y) * 12 + (b.m - a.m), c = addMonthsD(a, months);
    if (cmpD(c, b) > 0) { months--; c = addMonthsD(a, months); }
    if (months < 0) return { y: 0, m: 0, d: 0 };
    return { y: Math.floor(months / 12), m: months % 12, d: Math.round(dayNum(b) - dayNum(c)) };
  }
  /* أي كسر يرفع للسنة التالية */
  function ceilYears(p) { return p.y + (p.m || p.d ? 1 : 0); }
  function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function fmtYMD(p) {
    var parts = [];
    if (p.y) parts.push(p.y + ' سنة'); if (p.m) parts.push(p.m + ' شهر'); if (p.d) parts.push(p.d + ' يوم');
    return parts.length ? parts.join(' و') : 'صفر';
  }
  /* الأرقام: تُقبل العربية والفارسية، والمبلغ يقبل فواصل الآلاف. الفارغ = null، وغير الصالح = NaN */
  function digits(v) { return String(v === undefined || v === null ? '' : v).trim().replace(/[٠-٩]/g, function (c) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(c); }).replace(/[۰-۹]/g, function (c) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(c); }); }
  function intOf(v) { var t = digits(v); if (t === '') return null; return /^\d+$/.test(t) ? +t : NaN; }
  function amountOf(v) { if (typeof v === 'number') return isFinite(v) && v >= 0 && v % 1 === 0 ? v : NaN; var t = digits(v).replace(/[,،٬\s]/g, ''); if (t === '') return null; return /^\d+$/.test(t) ? +t : NaN; }
  var YEAR_MIN = 1990, YEAR_MAX = 2099;
  function yearOf(v) { var n = intOf(v); return n === null ? null : (n >= YEAR_MIN && n <= YEAR_MAX ? n : NaN); }
  function num(v) { return intOf(v); }

  /* الجدول: جدول السنة نفسها، وإلا الجدول الذي بعدها (لا الذي قبلها) */
  function pickTable(year) {
    var Y = D.TABLE_YEARS;
    for (var i = 0; i < Y.length; i++) if (Y[i] >= year) return { year: Y[i], exact: Y[i] === year, beyond: false };
    return { year: Y[Y.length - 1], exact: false, beyond: true };
  }
  /* سطر العمر: أي كسر يرفعه لسنة، ودون 30 = 30، وفوق 50 = 50 مع تنبيه */
  function ageRow(birth, at) {
    var b = parseDate(birth), a = parseDate(at);
    if (!b || !a) return null;
    var p = diffYMD(b, a), raw = ceilYears(p);
    return { ymd: p, raw: raw, row: Math.min(50, Math.max(30, raw)), over50: raw > 50, under30: raw < 30 };
  }
  function tableRow(year, row) {
    var src = D.TABLES[year].rows[row], r = {};
    COLS.forEach(function (c) { r[c[0]] = src[c[0]]; });
    if (row > 45) r.death = 0;
    return r;
  }
  function annualFee(year, over45) {
    var y = year > D.LAST ? D.LAST : year;
    if (!(y in D.ANNUAL)) return null;
    return over45 && (y in D.ANNUAL_OVER45) ? D.ANNUAL_OVER45[y] : D.ANNUAL[y];
  }
  /* رسم سنة لطرف واحد: { amount, status } — status: '' معتمد، 'estimate' بعد آخر سنة (برسم آخر سنة)، 'missing' غير محدد، 'none' لا رسم */
  function centralYear(y, over45) {
    if (!D.LAST || y < D.FIRST) return { amount: 0, status: 'missing' };
    if (y > D.LAST) return { amount: annualFee(D.LAST, over45) || 0, status: 'estimate', base: D.LAST };
    var a = annualFee(y, over45);
    return a === null ? { amount: 0, status: 'missing' } : { amount: a, status: '' };
  }
  function branchYear(y) {
    if (!D.BRANCH_FIRST || y < D.BRANCH_FIRST) return { amount: 0, status: 'none' };
    if (y > D.BRANCH_LAST) return { amount: D.BRANCH_ANNUAL[D.BRANCH_LAST] || 0, status: 'estimate', base: D.BRANCH_LAST };
    return y in D.BRANCH_ANNUAL ? { amount: D.BRANCH_ANNUAL[y], status: '' } : { amount: 0, status: 'missing' };
  }

  /* قائمة سنوات الرسم السنوي من..إلى، مع خانة «مدفوع» */
  function yearsList(from, to, over45, paid, warnings) {
    var out = [], paidSet = {};
    (paid || []).forEach(function (y) { paidSet[+y] = true; });
    if (from < D.FIRST) { warnings.push('لا يوجد رسم سنوي معتمد قبل ' + D.FIRST + '؛ بدأ الحساب من ' + D.FIRST + '.'); from = D.FIRST; }
    var warnedBeyond = false, warnedGap = false;
    for (var y = from; y <= to; y++) {
      var a = annualFee(y, over45);
      if (y > D.LAST && !warnedBeyond) { warnings.push('لا يوجد رسم سنوي معتمد بعد ' + D.LAST + '؛ حُسبت السنوات اللاحقة برسم ' + D.LAST + '. أضف رسم السنة الجديدة من «إعدادات الرسوم».'); warnedBeyond = true; }
      if (a === null && !warnedGap) { warnings.push('لا يوجد رسم سنوي لسنة ' + y + ' في الإعدادات؛ حُسبت صفراً.'); warnedGap = true; }
      out.push({ year: y, amount: a || 0, paid: !!paidSet[y], over45: !!(over45 && ((y > D.LAST ? D.LAST : y) in D.ANNUAL_OVER45)) });
    }
    return out;
  }

  function endYearOf(inp, today) {
    var st = inp.status || 'active';
    if (st === 'active') return { year: today.y, why: 'قيده سارٍ: حتى السنة الحالية ' + today.y };
    var y = yearOf(inp.statusYear);
    if (y === null) return { error: st === 'cancelled' ? 'أدخل سنة الترقين.' : st === 'deceased' ? 'أدخل سنة الوفاة.' : 'أدخل سنة نهاية الحساب.' };
    if (isNaN(y)) return { error: 'سنة النهاية «' + inp.statusYear + '» غير صالحة: اكتب سنة من 4 أرقام بين ' + YEAR_MIN + ' و' + YEAR_MAX + '.' };
    return { year: y, why: STATUS[st] + ': حتى سنة ' + y + ' (محسوبة)' };
  }

  /* ---------- الحساب ----------
     inp.kinds: عملية أو أكثر معاً (مثل إعادة قيد + أستذة). inp.kind القديم مقبول (عملية واحدة).
     inp.scope: both = مركزية + فرع، central = مركزية فقط، branch = فرع فقط.
       الحسابات المحفوظة قبل إضافة الفرع ليس فيها scope، فتبقى «مركزية فقط» ومجموعها كما حُفظ.
     البند المكرر بين عمليتين (الصندوق نفسه والاسم نفسه) يُحسب في كل عملية (متمرن ثم أستاذ)،
     ويمكن إلغاء تكراره بمفتاحه في inp.excludeDup.
     الرسم السنوي للسنة الواحدة يُحسب مرة واحدة مهما تعددت العمليات. */
  function compute(inp, opts) {
    opts = opts || {};
    return using(opts.data, function () { return computeIn(inp || {}, opts); });
  }
  var FUND = { central: 'مركزية', branch: 'فرع' };
  var TM_CUTOFF = { y: 2026, m: 3, d: 1 }; /* بداية رسم الأستذة المركزي الجديد */
  var SCOPE = { both: 'مركزية + فرع', central: 'مركزية فقط', branch: 'فرع فقط' };
  var KIND_ORDER = ['new', 'secStruck', 'admStruck', 'cancelSelf', 'reCancel', 'omitted', 'transfer', 'traineeToMaster', 'exempt'];

  function kindsOf(inp) {
    var k = Array.isArray(inp.kinds) && inp.kinds.length ? inp.kinds : (inp.kind ? [inp.kind] : []);
    var seen = {};
    return k.filter(function (x) { if (seen[x]) return false; seen[x] = 1; return true; })
      .sort(function (a, b) { return KIND_ORDER.indexOf(a) - KIND_ORDER.indexOf(b); });
  }
  function pickBranchTable(year) {
    var Y = D.BRANCH_YEARS;
    for (var i = 0; i < Y.length; i++) if (Y[i] >= year) return { year: Y[i], exact: Y[i] === year, beyond: false };
    return { year: Y[Y.length - 1], exact: false, beyond: true };
  }
  function branchAnnual(year) {
    if (!D.BRANCH_FIRST || year < D.BRANCH_FIRST) return 0;
    var y = year > D.BRANCH_LAST ? D.BRANCH_LAST : year;
    return D.BRANCH_ANNUAL[y] || 0;
  }

  function computeIn(inp, opts) {
    var today = parseDate(opts.today) || (function () { var t = new Date(); return { y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate() }; })();
    var kinds = kindsOf(inp);
    var scope = SCOPE[inp.scope] ? inp.scope : 'central';
    var useC = scope !== 'branch', useB = scope !== 'central';
    var R = {
      kind: kinds[0] || 'new', kinds: kinds, kindName: kinds.map(function (k) { return KINDS[k] || k; }).join(' + '),
      scope: scope, scopeName: SCOPE[scope], ops: [], items: [], years: [], warnings: [], errors: [], steps: [], total: 0
    };
    if (!kinds.length) { R.errors.push('اختر نوع عملية واحدة على الأقل.'); return R; }
    kinds.forEach(function (k) { if (!KINDS[k]) R.errors.push('نوع العملية غير معروف.'); });
    if (kinds.indexOf('exempt') >= 0) R.errors.push('قيد المعفى من التمرين ما زال قيد الدراسة، ولم تُعتمد قواعده بعد.');
    if (R.errors.length) return R;
    var paid = inp.paidYears || [];
    var regKinds = kinds.filter(function (k) { return ['new', 'secStruck', 'admStruck', 'cancelSelf', 'reCancel', 'omitted'].indexOf(k) >= 0; });
    if (regKinds.length > 1) R.warnings.push('اخترت أكثر من عملية قيد معاً (' + regKinds.map(function (k) { return KINDS[k]; }).join(' و') + '). تأكد أن هذا مقصود.');

    /* هل انتسب بعمر فوق 45؟ (يحدد الرسم السنوي المخفّض وعدم الاستفادة من معونة الوفاة) */
    var joinAge = inp.joinDate && inp.birthDate ? ageRow(inp.birthDate, inp.joinDate) : null;
    var over45 = !!(joinAge && joinAge.raw > 45);
    var ranges = [];
    /* الإعفاءات: لكل عملية ولكل طرف (مركزية / فرع) مع سببها. secBranchWaived القديم = إعفاء المشطوب الأمني من الفرع */
    var EX = {};
    Object.keys(inp.exempt || {}).forEach(function (k) { var e = inp.exempt[k] || {}; if (e.central || e.branch) EX[k] = { central: !!e.central, branch: !!e.branch, reason: String(e.reason || '').trim() }; });
    /* (الإعفاء يشمل كل رسوم ذلك الطرف في العملية، ومنها رسومها السنوية) */
    function exempted(kind, fund) { return !!(EX[kind] && EX[kind][fund]); }
    /* رسم الفرع لعملية: مبلغ مكتوب لهذا الحساب (inp.brFee[kind]) أو القيمة الافتراضية من الإعدادات */
    function brFee(kind, def, legacy) {
      var raw = inp.brFee && inp.brFee[kind] !== undefined && inp.brFee[kind] !== '' ? inp.brFee[kind] : legacy;
      var v = amountOf(raw);
      if (isNaN(v)) { R.errors.push('رسم الفرع لـ«' + KINDS[kind] + '» غير صالح: اكتب مبلغاً صحيحاً (مثل 5,500).'); return null; }
      return v === null ? { v: def, manual: false, note: '' } : { v: v, manual: true, note: 'مبلغ معدّل في هذا الحساب' };
    }

    R.steps.push('نطاق الحساب: ' + SCOPE[scope] + (scope === 'both' ? ' — رسوم النقابة المركزية ورسوم الفرع معاً.' : scope === 'central' ? ' — رسوم النقابة المركزية وحدها.' : ' — رسوم الفرع وحدها.'));

    kinds.forEach(function (kind) {
      var op = { kind: kind, name: KINDS[kind], items: [], steps: [] };
      R.ops.push(op);
      function item(fund, label, amount, note) { op.items.push({ fund: fund, label: label, amount: amount, note: note || '' }); }
      function step(s) { op.steps.push(s); }

      if (kind === 'new') {
        if (!parseDate(inp.birthDate)) R.errors.push('أدخل تاريخ الميلاد.');
        if (!parseDate(inp.joinDate)) R.errors.push('أدخل تاريخ الانتساب.');
        var end = endYearOf(inp, today);
        if (end.error) R.errors.push(end.error);
        if (R.errors.length) return;
        var jd = parseDate(inp.joinDate);
        if (cmpD(parseDate(inp.birthDate), jd) >= 0) { R.errors.push('تاريخ الميلاد بعد تاريخ الانتساب.'); return; }
        if (end.year < jd.y) { R.errors.push('سنة النهاية (' + end.year + ') قبل سنة الانتساب (' + jd.y + ').'); return; }
        var ag = joinAge, pt = pickTable(jd.y);
        R.age = ag; R.table = pt.year; R.joinYear = jd.y; R.endYear = end.year; R.over45 = over45;
        step('العمر بتاريخ الانتساب = ' + fmtDate(jd) + ' − ' + fmtDate(inp.birthDate) + ' = ' + fmtYMD(ag.ymd) + '.');
        step(ag.ymd.m || ag.ymd.d ? 'أي كسر من سنة يُحسب سنة كاملة، فالعمر المعتمد ' + ag.raw + ' سنة.' : 'العمر سنوات كاملة: ' + ag.raw + ' سنة.');
        if (ag.under30) step('العمر دون 30 سنة، فيُعتمد سطر 30 (أول سطر في الجدول).');
        if (ag.over50) { step('العمر فوق 50 سنة، فيُعتمد سطر 50.'); R.warnings.push('تجاوز سن الخمسين (' + ag.raw + ' سنة)، ولا يحق له التسجيل إلا بظرف خاص.'); }
        if (useC) {
          step(pt.exact ? 'المركزية: يُعتمد جدول رسوم الانتساب لسنة ' + pt.year + ' (سنة الانتساب نفسها).' :
            pt.beyond ? 'المركزية: لا يوجد جدول بعد سنة ' + jd.y + '، فيُعتمد آخر جدول متوفر (' + pt.year + ').' :
            'المركزية: لا يوجد جدول لسنة ' + jd.y + '، فيُعتمد الجدول الذي بعدها: جدول ' + pt.year + '.');
          if (pt.beyond) R.warnings.push('لا يوجد جدول انتساب مركزي لسنة ' + jd.y + '؛ استُعمل جدول ' + pt.year + '.');
          var row = tableRow(pt.year, ag.row);
          COLS.forEach(function (c) {
            if (c[0] === 'annual') return;
            if (c[0] === 'death') { if (ag.row <= 45) item('central', c[1], row.death, 'لمن عمره 45 فما دون'); return; }
            if (c[0] === 'exam' && !row.exam) return;
            item('central', c[1], row[c[0]]);
          });
          if (ag.row > 45) step('عمره فوق 45، فلا يدفع رسم معونة الوفاة ولا يستفيد منها، ورسمه السنوي المركزي أقل.');
          step('المركزية: بنود الجدول (سطر العمر ' + ag.row + ') ما عدا الرسم السنوي، ثم الرسم السنوي لكل سنة من ' + jd.y + ' حتى ' + end.year + ' (' + end.why + ').');
        }
        if (useB) {
          var bt = pickBranchTable(jd.y);
          R.branchTable = bt.year;
          step(bt.exact ? 'الفرع: يُعتمد جدول رسوم الانتساب للفروع ' + bt.year + '.' :
            bt.beyond ? 'الفرع: لا يوجد جدول فرع بعد ' + jd.y + '، فيُعتمد آخر جدول (' + bt.year + ').' :
            'الفرع: جدول رسوم الانتساب للفروع المتوفر هو جدول ' + bt.year + '، وهو الجدول الذي بعد سنة الانتساب ' + jd.y + '.');
          var br = D.BRANCH_TABLES[bt.year].rows[ag.row];
          BCOLS.forEach(function (c) {
            if (c[0] === 'annual') return;
            item('branch', c[1], br[c[0]], c[0] === 'training' ? 'يُدفع مرة عند الانتساب' : '');
          });
          var bp = inp.branchPrints || {};
          if (bp.on) {
            var pa = amountOf(bp.amount);
            if (isNaN(pa)) { R.errors.push('مبلغ «مطبوعات + مفكرة» غير صالح: اكتب رقماً صحيحاً (مثل 1,500).'); return; }
            pa = pa || 0;
            item('branch', 'مطبوعات + مفكرة', pa, 'حسب المطبوعات الموجودة');
            if (!pa) R.warnings.push('فُعّلت «مطبوعات + مفكرة» للفرع دون مبلغ.');
          }
          step(D.BRANCH_FIRST ? 'الفرع: بنود سطر العمر ' + ag.row + ' ما عدا الرسم السنوي للفرع، ثم الرسم السنوي للفرع لكل سنة من ' + Math.max(jd.y, D.BRANCH_FIRST) + ' حتى ' + end.year + ' (لا رسم سنوي للفرع قبل ' + D.BRANCH_FIRST + ').'
            : 'الفرع: بنود سطر العمر ' + ag.row + ' ما عدا الرسم السنوي للفرع. لا يوجد رسم سنوي للفرع في الإعدادات.');
        }
        ranges.push({ from: jd.y, to: end.year, kind: kind });
      }

      else if (kind === 'secStruck') {
        var dd = parseDate(inp.decisionDate);
        if (!dd) { R.errors.push('أدخل تاريخ قرار إعادة القيد.'); return; }
        step('المشطوب الأمني يدفع الرسم السنوي لكل سنة من ' + D.FIXED.securityFrom + ' حتى سنة القرار ' + dd.y + ' (السنتان محسوبتان).');
        if (over45) step('انتسب بعمر فوق 45، فيُعتمد الرسم السنوي المركزي المخفّض في السنوات التي لها جدول.');
        if (useB) {
          var bs = brFee(kind, D.flat.brStruck); if (bs === null) return;
          item('branch', 'رسم إعادة قيد المشطوب', bs.v, bs.note);
          /* حسابات محفوظة بالخيار القديم: إعفاء من رسم إعادة القيد للفرع وحده (لا من الرسوم السنوية) */
          if (inp.secBranchWaived) { var lw = op.items[op.items.length - 1]; lw.exempt = true; lw.excluded = true; lw.note = 'معفى (المشطوب الأمني معفى أحياناً)'; step('الفرع: أُعفي من رسم إعادة قيد المشطوب.'); }
          else step('الفرع: رسم إعادة قيد المشطوب ' + fmt(bs.v) + (bs.manual ? ' (عُدّل في هذا الحساب)' : '') + '.');
        }
        optional(item);
        ranges.push({ from: D.FIXED.securityFrom, to: dd.y, kind: kind });
      }

      else if (kind === 'admStruck' || kind === 'reCancel') {
        var d2 = parseDate(inp.decisionDate), ev = parseDate(inp.eventDate);
        if (!d2) R.errors.push('أدخل تاريخ قرار إعادة القيد.');
        if (useC && !parseDate(inp.birthDate)) R.errors.push('أدخل تاريخ الميلاد (لشرط العمر في معونة الوفاة المركزية).');
        if (R.errors.length) return;
        var FX = D.FIXED[kind], word = kind === 'admStruck' ? 'الشطب' : 'الترقين';
        var ad = parseDate(inp.birthDate) ? ageRow(inp.birthDate, inp.decisionDate) : null;
        if (ad && !R.age) R.age = ad;
        if (ad) step('العمر بتاريخ قرار إعادة القيد = ' + fmtYMD(ad.ymd) + ' ← ' + ad.raw + ' سنة.');
        var gap = null, manual = intOf(inp.gapYears);
        if (isNaN(manual)) { R.errors.push('عدد سنوات الانقطاع «' + inp.gapYears + '» غير صالح: اكتب عدداً صحيحاً (0 أو أكثر).'); return; }
        if (ev && cmpD(ev, d2) < 0) {
          var gp = diffYMD(ev, d2); gap = ceilYears(gp);
          step('مدة الانقطاع من تاريخ ' + word + ' ' + fmtDate(ev) + ' حتى القرار ' + fmtDate(d2) + ' = ' + fmtYMD(gp) + '، وأي جزء من سنة = سنة، فهي ' + gap + ' سنة.');
        } else if (ev && manual === null) { R.errors.push('تاريخ ' + word + ' (' + fmtDate(ev) + ') ليس قبل تاريخ القرار (' + fmtDate(d2) + '): صحّح التاريخين أو اكتب عدد سنوات الانقطاع.'); return; }
        if (manual !== null && manual !== gap) { step('عدد سنوات الانقطاع مكتوب يدوياً: ' + manual + '.'); gap = manual; }
        if (gap === null) { R.errors.push('أدخل تاريخ ' + word + ' أو عدد سنوات الانقطاع (الصفر مقبول).'); return; }
        R.gapYears = gap;
        if (useC) {
          item('central', 'رسم النقابة', FX.union); item('central', 'رسم التقاعد', FX.pension);
          if (ad && ad.raw <= 45) { item('central', 'رسم معونة الوفاة', D.FIXED.deathAid, 'عمره 45 فما دون'); step('عمره 45 فما دون، فيدفع رسم معونة الوفاة ويستفيد منها.'); }
          else step('عمره فوق 45، فلا يدفع رسم معونة الوفاة ولا يستفيد منها.');
          if (gap) item('central', 'سنوات الانقطاع', gap * D.FIXED.gapYear, gap + ' × ' + fmt(D.FIXED.gapYear));
          item('central', 'المطبوعات', D.FIXED.prints); item('central', 'تثبيت ممارسة', D.FIXED.practice);
        }
        if (useB) {
          var bf = brFee(kind, kind === 'admStruck' ? D.flat.brStruck : D.flat.brReCancel); if (bf === null) return;
          item('branch', kind === 'admStruck' ? 'رسم إعادة قيد المشطوب' : 'رسم إعادة قيد المرقّن', bf.v, bf.note);
          step('الفرع: ' + (kind === 'admStruck' ? 'رسم إعادة قيد المشطوب ' : 'رسم إعادة قيد المرقّن ') + fmt(bf.v) + (bf.manual ? ' (عُدّل في هذا الحساب)' : '') + '.');
        }
        optional(item);
      }

      else if (kind === 'cancelSelf' || kind === 'omitted') {
        var refDate = kind === 'cancelSelf' ? parseDate(inp.eventDate) : parseDate(inp.decisionDate);
        if (!refDate) { R.errors.push(kind === 'cancelSelf' ? 'أدخل تاريخ الترقين.' : 'أدخل تاريخ قرار إعادة القيد.'); return; }
        var lp = yearOf(inp.lastPaidYear), jy = parseDate(inp.joinDate);
        if (isNaN(lp)) { R.errors.push('«آخر سنة دفع رسمها» غير صالحة: اكتب سنة من 4 أرقام.'); return; }
        var from = lp ? lp + 1 : (jy ? jy.y : null);
        if (!from) { R.errors.push('أدخل آخر سنة دفع رسمها، أو تاريخ الانتساب.'); return; }
        if (kind === 'omitted') {
          if (useC) { item('central', 'رسم النقابة', D.FIXED.omitted.union); item('central', 'رسم التقاعد', D.FIXED.omitted.pension); }
          var bo = useB ? brFee(kind, D.flat.brOmitted) : { v: 0 }; if (bo === null) return;
          if (useB) item('branch', 'رسم إعادة قيد المُغفَل', bo.v, bo.note);
          step('المُغفَل يدفع رسوم استعادة القيد' + (useC ? ' (مركزية: نقابة ' + fmt(D.FIXED.omitted.union) + ' + تقاعد ' + fmt(D.FIXED.omitted.pension) + ')' : '') + (useB ? ' (فرع: ' + fmt(bo.v) + ')' : '') + '، إضافة إلى كل الرسوم السنوية المترتبة عليه.');
        } else {
          step('الترقين بطلب المحامي: يدفع رسم سنة الترقين ' + refDate.y + '، وكل رسم سابق غير مدفوع، لأنه يجب أن يكون بريء الذمة وقت الترقين.');
        }
        step(lp ? 'آخر سنة مدفوعة ' + lp + '، فتُحسب الرسوم من ' + from + ' حتى ' + refDate.y + '.' : 'لم تُحدد آخر سنة مدفوعة، فتُحسب من سنة الانتساب ' + from + ' حتى ' + refDate.y + '.');
        if (from > refDate.y) step('لا رسوم سنوية مترتبة.');
        else ranges.push({ from: from, to: refDate.y, kind: kind });
      }

      else if (kind === 'transfer') {
        if (useC) { item('central', 'رسم النقابة', D.FIXED.transfer.union); item('central', 'رسم التقاعد', D.FIXED.transfer.pension); }
        var bt2 = useB ? brFee(kind, D.flat.brTransfer) : { v: 0 }; if (bt2 === null) return;
        if (useB) item('branch', 'رسم النقل من فرع إلى آخر', bt2.v, bt2.note);
        step('رسم النقل من فرع إلى آخر ثابت' + (useC ? ': مركزية (نقابة ' + fmt(D.FIXED.transfer.union) + ' + تقاعد ' + fmt(D.FIXED.transfer.pension) + ')' : '') + (useB ? (useC ? ' + ' : ': ') + 'فرع ' + fmt(bt2.v) : '') + '.');
        if (!inp.clearance) R.warnings.push('النقل مشروط بأن يكون المحامي بريء الذمة. تأكد من ذلك قبل القبض.');
      }

      else if (kind === 'traineeToMaster') {
        /* الرسم المركزي حسب تاريخ الانتقال إلى جدول الأساتذة: قبل 1/3/2026 = 950 إجمالاً، ومنه = 5,050 مفصّلاً (قرار المالك).
           رسم الفرع: 5,000 افتراضياً (قبل 1/3/2026 غير محدد)، ويمكن تغييره لكل حساب أو من الإعدادات. */
        var md = parseDate(inp.masterDate), mdUsed = md || today, before = cmpD(mdUsed, TM_CUTOFF) < 0;
        if (!md) R.warnings.push('لم يُدخل تاريخ الانتقال إلى جدول الأساتذة؛ اعتُمد تاريخ اليوم ' + fmtDate(today) + ' لاختيار الرسم.');
        R.masterDate = md ? inp.masterDate : '';
        step('تاريخ الانتقال إلى جدول الأساتذة ' + fmtDate(mdUsed) + (md ? '' : ' (تاريخ اليوم)') + '، فيُطبَّق رسم ' + (before ? 'ما قبل' : 'ما بعد') + ' 1/3/2026.');
        if (useC) {
          if (before) { item('central', 'رسم نقل المتمرن إلى جدول الأساتذة', D.flat.tmOld, 'قبل 1/3/2026'); step('المركزية: الرسم قبل 1/3/2026 = ' + fmt(D.flat.tmOld) + '.'); }
          else { D.FIXED.trainee.forEach(function (t) { item('central', t[0], t[1]); }); step('المركزية: الرسم من 1/3/2026 = ' + fmt(D.FIXED.trainee.reduce(function (s, t) { return s + t[1]; }, 0)) + ' (مفصّلاً).'); }
        }
        if (useB) {
          var bmf = brFee(kind, D.flat.brMaster, inp.brMasterAmount); if (bmf === null) return;
          item('branch', 'رسم الأستذة', bmf.v, bmf.manual ? bmf.note : (before ? 'غير محدد قبل 1/3/2026، القيمة الافتراضية' : ''));
          step('الفرع: رسم الأستذة ' + fmt(bmf.v) + (bmf.manual ? ' (عُدّل في هذا الحساب)' : before ? ' (رسم الفرع قبل 1/3/2026 غير محدد، فاعتُمدت القيمة الافتراضية)' : '') + '.');
        }
      }
    });

    function optional(item) {
      if (!useC) return;
      var o = inp.optional || {};
      Object.keys(D.FIXED.optional).forEach(function (k) {
        if (o[k]) item('central', D.FIXED.optional[k][0], D.FIXED.optional[k][1], 'اختياري');
      });
    }
    if (R.errors.length) return R;

    /* «نفقات إدارية» و«متطلبات تمرين» من «رسوم الفروع» ليست من هذه العمليات (قرار المالك): لا تُحسب هنا.
       الحسابات المحفوظة التي فيها branchExtra تُتجاهل فيها هذه البنود. */

    /* تطبيق الإعفاءات على بنود العمليات */
    R.exempt = EX;
    R.ops.forEach(function (op) {
      var e = EX[op.kind]; if (!e) return;
      var funds = ['central', 'branch'].filter(function (f) { return e[f] && (f === 'central' ? useC : useB); });
      if (!funds.length) return;
      op.items.forEach(function (it) { if (e[it.fund]) { it.exempt = true; it.excluded = true; } });
      var txt = 'أُعفي من رسوم ' + funds.map(function (f) { return f === 'central' ? 'النقابة المركزية' : 'الفرع'; }).join(' و') + ' في هذه العملية' + (e.reason ? ' (السبب: ' + e.reason + ')' : '') + '.';
      op.steps.push(txt);
    });

    /* البنود المكررة بين العمليات: تُحسب في كل عملية، ويمكن إلغاء التكرار من inp.excludeDup */
    var seen = {}, excl = {};
    (inp.excludeDup || []).forEach(function (k) { excl[k] = true; });
    R.ops.forEach(function (op) {
      op.items.forEach(function (it) {
        var sig = it.fund + '|' + it.label;
        it.op = op.kind; it.key = op.kind + '|' + sig;
        if (it.exempt) { R.items.push(it); return; }
        if (seen[sig]) {
          it.dup = true; it.dupOf = seen[sig];
          if (excl[it.key]) it.excluded = true;
        } else seen[sig] = op.name;
        R.items.push(it);
      });
    });
    var dups = R.items.filter(function (x) { return x.dup; });
    if (dups.length) R.steps.push('بنود تتكرر بين العمليات (' + dups.map(function (x) { return x.label; }).join('، ') + '): تُحسب في كل عملية لأن المحامي يدفعها مرة بصفته في كل عملية' +
      (dups.some(function (x) { return x.excluded; }) ? '، وأُلغي تكرار: ' + dups.filter(function (x) { return x.excluded; }).map(function (x) { return x.label; }).join('، ') : '') + '.');

    /* الرسوم السنوية: كل سنة مرة واحدة، مركزية و/أو فرع */
    if (ranges.length) {
      var yset = {}, paidSet = {}, lo = Infinity, hi = -Infinity;
      paid.forEach(function (y) { paidSet[+y] = true; });
      var payC = {}, payB = {};
      ranges.forEach(function (r) {
        for (var y = r.from; y <= r.to; y++) { yset[y] = true; if (!exempted(r.kind, 'central')) payC[y] = true; if (!exempted(r.kind, 'branch')) payB[y] = true; }
        lo = Math.min(lo, r.from); hi = Math.max(hi, r.to);
      });
      if (ranges.length > 1) R.steps.push('السنوات المشتركة بين العمليات يُحسب رسمها السنوي مرة واحدة.');
      /* كل طرف يُحسب وحده: السنة مستحقة لطرف إذا غطّتها عملية واحدة على الأقل غير معفاة من ذلك الطرف */
      var paidC = {}, paidB = {}, dates = inp.paidDates || {};
      (inp.paidC || []).forEach(function (y) { paidC[+y] = true; });
      (inp.paidB || []).forEach(function (y) { paidB[+y] = true; });
      var est = { central: null, branch: null }, missing = { central: [], branch: [] };
      Object.keys(yset).map(Number).sort(function (a, b) { return a - b; }).forEach(function (y) {
        var cy = useC ? centralYear(y, over45) : { amount: 0, status: 'none' };
        var by = useB ? branchYear(y) : { amount: 0, status: 'none' };
        if (useC && y < D.FIRST) { if (!est.before) { R.warnings.push('لا يوجد رسم سنوي مركزي قبل ' + D.FIRST + '؛ لم تُحسب السنوات التي قبلها.'); est.before = true; } cy = { amount: 0, status: 'none' }; }
        var c = useC && payC[y] ? cy.amount : 0, b = useB && payB[y] ? by.amount : 0;
        var exC = useC && !payC[y] && cy.status !== 'none', exB = useB && !payB[y] && by.status !== 'none';
        if (!c && !b && !exC && !exB && cy.status !== 'missing' && by.status !== 'missing') return;
        if (cy.status === 'estimate' && payC[y]) est.central = cy.base;
        if (by.status === 'estimate' && payB[y]) est.branch = by.base;
        if (cy.status === 'missing' && payC[y] && useC) missing.central.push(y);
        if (by.status === 'missing' && payB[y] && useB) missing.branch.push(y);
        var legacy = !!paidSet[y];
        var pc = legacy || !!paidC[y] || !c, pb = legacy || !!paidB[y] || !b;
        R.years.push({
          year: y, central: c, branch: b, amount: c + b,
          paidC: !!(legacy || paidC[y]) && c > 0, paidB: !!(legacy || paidB[y]) && b > 0,
          paidDateC: dates['c' + y] || '', paidDateB: dates['b' + y] || '',
          paid: pc && pb && (c + b) > 0, due: (pc ? 0 : c) + (pb ? 0 : b),
          cStatus: useC && payC[y] ? cy.status : '', bStatus: useB && payB[y] ? by.status : '',
          over45: !!(useC && over45 && ((y > D.LAST ? D.LAST : y) in D.ANNUAL_OVER45)),
          exempt: exC && exB ? 'both' : exC ? 'central' : exB ? 'branch' : ''
        });
      });
      if (est.central) R.warnings.push('لا يوجد رسم سنوي مركزي معتمد بعد ' + est.central + '؛ حُسبت السنوات اللاحقة تقديرياً برسم ' + est.central + '. أضف رسم السنة الجديدة من «إعدادات الرسوم».');
      if (est.branch) R.warnings.push('لا يوجد رسم سنوي معتمد للفرع بعد ' + est.branch + '؛ حُسبت السنوات اللاحقة تقديرياً برسم ' + est.branch + '.');
      if (missing.central.length) R.warnings.push('الرسم السنوي المركزي غير محدد في الإعدادات لسنة: ' + missing.central.join('، ') + '؛ حُسب صفراً.');
      if (missing.branch.length) R.warnings.push('الرسم السنوي للفرع غير محدد في الإعدادات لسنة: ' + missing.branch.join('، ') + '؛ حُسب صفراً.');
      if (useB && !D.BRANCH_FIRST) R.steps.push('لا يوجد رسم سنوي للفرع في الإعدادات، فلم يُحسب للفرع رسم سنوي.');
      else if (useB && R.years.some(function (x) { return x.year < D.BRANCH_FIRST; })) R.steps.push('الرسم السنوي للفرع يبدأ من ' + D.BRANCH_FIRST + '، فلا رسم فرع على السنوات التي قبلها.');
    }
    if (over45 && R.years.length) R.over45 = true;

    /* المجاميع */
    function sumItems(f) { return R.items.reduce(function (s, x) { return s + (x.excluded || (f && x.fund !== f) ? 0 : x.amount); }, 0); }
    function sumYears(f) { return R.years.reduce(function (s, x) { return s + (f === 'central' ? (x.paidC ? 0 : x.central) : f === 'branch' ? (x.paidB ? 0 : x.branch) : x.due); }, 0); }
    R.itemsTotal = sumItems();
    R.yearsTotal = sumYears();
    R.paidCount = R.years.filter(function (x) { return x.paid; }).length;
    R.paidPartCount = R.years.filter(function (x) { return !x.paid && (x.paidC || x.paidB); }).length;
    R.centralTotal = sumItems('central') + sumYears('central');
    R.branchTotal = sumItems('branch') + sumYears('branch');
    R.total = R.itemsTotal + R.yearsTotal;
    R.ops.forEach(function (op) { op.total = op.items.reduce(function (s, x) { return s + (x.excluded ? 0 : x.amount); }, 0); });
    if (R.paidCount) R.steps.push('طُرحت ' + R.paidCount + ' سنة مدفوعة كاملة من المجموع.');
    if (R.paidPartCount) R.steps.push('وطُرح رسم أحد الطرفين لـ' + R.paidPartCount + ' سنة دُفع فيها طرف دون الآخر.');
    /* «كيف حُسب» مجمّعة: خطوات عامة ثم خطوات كل عملية */
    var all = R.steps.slice(0, 1);
    R.ops.forEach(function (op) { op.steps.forEach(function (s) { all.push((R.ops.length > 1 ? op.name + ': ' : '') + s); }); });
    R.steps = all.concat(R.steps.slice(1));
    return R;
  }
  function cmpD(a, b) { return (a.y - b.y) || (a.m - b.m) || (a.d - b.d); }

  return {
    compute: compute, ageRow: ageRow, dataWith: dataWith,
    pickTable: function (year, data) { return using(data, function () { return pickTable(year); }); },
    tableRow: function (year, row, data) { return using(data, function () { return tableRow(year, row); }); },
    annualFee: function (year, over45, data) { return using(data, function () { return annualFee(year, over45); }); },
    DEFAULTS: DEF, TABLE_YEARS: DEF.TABLE_YEARS, ANNUAL: DEF_ANNUAL, ANNUAL_OVER45: DEF_OVER45, COLS: COLS, AGES: AGES, FIXED_FIELDS: FIXED_FIELDS,
    BCOLS: BCOLS, BRANCH_FIELDS: BRANCH_FIELDS, FUND: FUND, SCOPE: SCOPE, KIND_ORDER: KIND_ORDER,
    KINDS: KINDS, STATUS: STATUS, amountOf: amountOf, yearOf: yearOf, intOf: intOf, YEAR_MIN: YEAR_MIN, YEAR_MAX: YEAR_MAX, fmt: fmt, fmtDate: fmtDate, fmtYMD: fmtYMD, parseDate: parseDate, diffYMD: diffYMD
  };
});
