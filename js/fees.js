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

  /* ---------- البيانات ---------- */

  /* الرسم السنوي لكل سنة (الورقة السنوية) */
  var ANNUAL = { 2011: 60, 2012: 60, 2013: 105, 2014: 105, 2015: 135, 2016: 135, 2017: 135, 2018: 145, 2019: 145, 2020: 155, 2021: 400, 2022: 650, 2023: 750, 2024: 750, 2025: 750, 2026: 5000 };
  /* الرسم السنوي لمن انتسب بعمر فوق 45 (لا يستفيد من معونة الوفاة): من سطور 46–50 في جدول السنة.
     2025 = 600 (قرار المالك)، و2011–2019 مثل غيره (المبلغ نفسه). */
  var ANNUAL_OVER45 = { 2020: 130, 2021: 300, 2022: 500, 2023: 600, 2024: 600, 2025: 600, 2026: 4000 };

  /* بنود جدول الانتساب بالترتيب */
  var COLS = [
    ['union', 'قيد النقابة'], ['pension', 'قيد التقاعد'], ['annual', 'الرسم السنوي'], ['practice', 'دفتر أو تثبيت ممارسة'],
    ['id', 'الهوية'], ['badge', 'الشارة'], ['prints', 'المطبوعات'], ['death', 'معونة الوفاة'], ['exam', 'رسم الامتحان']
  ];
  function ramp(parts) { /* parts: [[startValue, step, count], ...] متتابعة */
    var out = []; parts.forEach(function (p) { for (var i = 0; i < p[2]; i++) out.push(p[0] + p[1] * i); }); return out;
  }
  /* لكل جدول: from = بداية النفاذ (للعرض)، والقيم الثابتة، وعمود قيد التقاعد والوفاة حسب العمر 30..50 */
  var TABLES = {
    2020: { from: '2020-07-01', union: 150, annual: [155, 130], practice: 50, id: 50, badge: 10, prints: 10, exam: 0,
      pension: ramp([[250, 50, 11], [900, 150, 5], [1750, 250, 5]]), death: ramp([[200, 30, 11], [550, 50, 5]]) },
    2021: { from: '2021-01-01', union: 250, annual: [400, 300], practice: 50, id: 50, badge: 20, prints: 20, exam: 0,
      pension: ramp([[300, 100, 11], [1500, 200, 5], [2800, 500, 5]]), death: ramp([[350, 100, 11], [1500, 150, 5]]) },
    2022: { from: '2022-01-01', union: 250, annual: [650, 500], practice: 50, id: 100, badge: 50, prints: 50, exam: 0,
      pension: ramp([[400, 150, 11], [2150, 250, 5], [3650, 500, 5]]), death: ramp([[450, 150, 11], [2150, 200, 5]]) },
    2023: { from: '2023-09-17', union: 250, annual: [750, 600], practice: 50, id: 250, badge: 250, prints: 50, exam: 100,
      pension: ramp([[400, 150, 11], [2150, 250, 5], [3650, 500, 5]]), death: ramp([[450, 150, 11], [2150, 200, 5]]) },
    2024: { from: '2024-09-01', union: 500, annual: [750, 600], practice: 250, id: 250, badge: 500, prints: 250, exam: 250,
      pension: ramp([[750, 250, 11], [3650, 400, 4], [5600, 750, 6]]), death: ramp([[750, 250, 11], [3650, 400, 4], [5250, 0, 1]]) },
    2026: { from: '2026-01-01', union: 5000, annual: [5000, 4000], practice: 1000, id: 1000, badge: 1000, prints: 1000, exam: 2000,
      pension: ramp([[15000, 1500, 11], [32000, 2000, 4], [40500, 2500, 6]]), death: ramp([[4000, 250, 16]]) }
  };
  var TABLE_YEARS = Object.keys(TABLES).map(Number).sort();

  /* رسوم ثابتة لحالات إعادة القيد والنقل */
  var FIXED = {
    admStruck: { union: 20000, pension: 20000 },
    reCancel: { union: 10000, pension: 10000 },
    omitted: { union: 3000, pension: 7000 },
    transfer: { union: 5000, pension: 5000 },
    deathAid: 2500, gapYear: 2500, prints: 1000, practice: 1000,
    optional: { id: ['الهوية', 1000], license: ['إجازة المحاماة', 1000], badge: ['شارة الصدر', 1000] },
    trainee: [['قيد النقابة', 1000], ['قيد التقاعد', 2000], ['رسم إجازة المحاماة', 1000], ['الهوية', 1000], ['ثمن إجازة المحاماة', 50]],
    securityFrom: 2011
  };

  var KINDS = {
    new: 'انتساب جديد',
    secStruck: 'إعادة قيد مشطوب أمني',
    admStruck: 'إعادة قيد مشطوب إداري',
    cancelSelf: 'ترقين القيد بطلب المحامي',
    reCancel: 'إعادة القيد بعد الترقين',
    omitted: 'إعادة قيد المُغفَل',
    transfer: 'النقل من فرع إلى آخر',
    traineeToMaster: 'نقل المتمرن إلى جدول الأساتذة',
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
  function diffYMD(a, b) {
    var y = b.y - a.y, m = b.m - a.m, d = b.d - a.d;
    if (d < 0) { m--; var pm = b.m - 1 < 1 ? 12 : b.m - 1, py = b.m - 1 < 1 ? b.y - 1 : b.y; d += dim(py, pm); }
    if (m < 0) { y--; m += 12; }
    return { y: y, m: m, d: d };
  }
  /* أي كسر يرفع للسنة التالية */
  function ceilYears(p) { return p.y + (p.m || p.d ? 1 : 0); }
  function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function fmtYMD(p) {
    var parts = [];
    if (p.y) parts.push(p.y + ' سنة'); if (p.m) parts.push(p.m + ' شهر'); if (p.d) parts.push(p.d + ' يوم');
    return parts.length ? parts.join(' و') : 'صفر';
  }
  function num(v) { var n = parseInt(String(v === undefined || v === null ? '' : v).replace(/[٠-٩]/g, function (c) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(c); }), 10); return isFinite(n) ? n : null; }

  /* الجدول: جدول السنة نفسها، وإلا الجدول الذي بعدها (لا الذي قبلها) */
  function pickTable(year) {
    for (var i = 0; i < TABLE_YEARS.length; i++) if (TABLE_YEARS[i] >= year) return { year: TABLE_YEARS[i], exact: TABLE_YEARS[i] === year, beyond: false };
    return { year: TABLE_YEARS[TABLE_YEARS.length - 1], exact: false, beyond: true };
  }
  /* سطر العمر: أي كسر يرفعه لسنة، ودون 30 = 30، وفوق 50 = 50 مع تنبيه */
  function ageRow(birth, at) {
    var b = parseDate(birth), a = parseDate(at);
    if (!b || !a) return null;
    var p = diffYMD(b, a), raw = ceilYears(p);
    return { ymd: p, raw: raw, row: Math.min(50, Math.max(30, raw)), over50: raw > 50, under30: raw < 30 };
  }
  function tableRow(year, row) {
    var T = TABLES[year], i = row - 30, r = {};
    r.union = T.union; r.pension = T.pension[i]; r.annual = T.annual[row > 45 ? 1 : 0]; r.practice = T.practice;
    r.id = T.id; r.badge = T.badge; r.prints = T.prints; r.death = row <= 45 ? T.death[i] : 0; r.exam = T.exam;
    return r;
  }
  function annualFee(year, over45) {
    var last = 2026;
    var y = year > last ? last : year;
    if (!(y in ANNUAL)) return null;
    return over45 && (y in ANNUAL_OVER45) ? ANNUAL_OVER45[y] : ANNUAL[y];
  }

  /* قائمة سنوات الرسم السنوي من..إلى، مع خانة «مدفوع» */
  function yearsList(from, to, over45, paid, warnings) {
    var out = [], paidSet = {};
    (paid || []).forEach(function (y) { paidSet[+y] = true; });
    if (from < 2011) { warnings.push('لا يوجد رسم سنوي معتمد قبل 2011؛ بدأ الحساب من 2011.'); from = 2011; }
    var warnedBeyond = false;
    for (var y = from; y <= to; y++) {
      var a = annualFee(y, over45);
      if (y > 2026 && !warnedBeyond) { warnings.push('لا يوجد رسم سنوي معتمد بعد 2026؛ حُسبت السنوات اللاحقة برسم 2026. أضف الجدول الجديد عند صدوره.'); warnedBeyond = true; }
      out.push({ year: y, amount: a || 0, paid: !!paidSet[y], over45: !!(over45 && ((y > 2026 ? 2026 : y) in ANNUAL_OVER45)) });
    }
    return out;
  }

  function endYearOf(inp, today) {
    var st = inp.status || 'active';
    if (st === 'active') return { year: today.y, why: 'قيده سارٍ: حتى السنة الحالية ' + today.y };
    var y = num(inp.statusYear);
    if (!y) return { error: st === 'cancelled' ? 'أدخل سنة الترقين.' : st === 'deceased' ? 'أدخل سنة الوفاة.' : 'أدخل سنة نهاية الحساب.' };
    return { year: y, why: STATUS[st] + ': حتى سنة ' + y + ' (محسوبة)' };
  }

  /* ---------- الحساب ---------- */
  function compute(inp, opts) {
    inp = inp || {}; opts = opts || {};
    var today = parseDate(opts.today) || (function () { var t = new Date(); return { y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate() }; })();
    var R = { kind: inp.kind || 'new', kindName: KINDS[inp.kind || 'new'] || '', items: [], years: [], warnings: [], errors: [], steps: [], total: 0 };
    var kind = R.kind;
    if (!KINDS[kind]) { R.errors.push('نوع العملية غير معروف.'); return R; }
    if (kind === 'exempt') { R.errors.push('قيد المعفى من التمرين ما زال قيد الدراسة، ولم تُعتمد قواعده بعد.'); return R; }

    var paid = inp.paidYears || [];
    function item(label, amount, note, group) { R.items.push({ label: label, amount: amount, note: note || '', group: group || '' }); }

    /* هل انتسب بعمر فوق 45؟ (يحدد الرسم السنوي المخفّض وعدم الاستفادة من معونة الوفاة) */
    var joinAge = inp.joinDate && inp.birthDate ? ageRow(inp.birthDate, inp.joinDate) : null;
    var over45 = !!(joinAge && joinAge.raw > 45);

    if (kind === 'new') {
      if (!parseDate(inp.birthDate)) R.errors.push('أدخل تاريخ الميلاد.');
      if (!parseDate(inp.joinDate)) R.errors.push('أدخل تاريخ الانتساب.');
      var end = endYearOf(inp, today);
      if (end.error) R.errors.push(end.error);
      if (R.errors.length) return R;
      var jd = parseDate(inp.joinDate);
      if (cmpD(parseDate(inp.birthDate), jd) >= 0) { R.errors.push('تاريخ الميلاد بعد تاريخ الانتساب.'); return R; }
      if (end.year < jd.y) { R.errors.push('سنة النهاية (' + end.year + ') قبل سنة الانتساب (' + jd.y + ').'); return R; }
      var ag = joinAge, pt = pickTable(jd.y);
      R.age = ag; R.table = pt.year; R.joinYear = jd.y; R.endYear = end.year; R.over45 = over45;
      R.steps.push('العمر بتاريخ الانتساب = ' + fmtDate(jd) + ' − ' + fmtDate(inp.birthDate) + ' = ' + fmtYMD(ag.ymd) + '.');
      R.steps.push(ag.ymd.m || ag.ymd.d ? 'أي كسر من سنة يُحسب سنة كاملة، فالعمر المعتمد ' + ag.raw + ' سنة.' : 'العمر سنوات كاملة: ' + ag.raw + ' سنة.');
      if (ag.under30) R.steps.push('العمر دون 30 سنة، فيُعتمد سطر 30 (أول سطر في الجدول).');
      if (ag.over50) { R.steps.push('العمر فوق 50 سنة، فيُعتمد سطر 50.'); R.warnings.push('تجاوز سن الخمسين (' + ag.raw + ' سنة)، ولا يحق له التسجيل إلا بظرف خاص.'); }
      R.steps.push(pt.exact ? 'يُعتمد جدول رسوم الانتساب لسنة ' + pt.year + ' (سنة الانتساب نفسها).' :
        pt.beyond ? 'لا يوجد جدول بعد سنة ' + jd.y + '، فيُعتمد آخر جدول متوفر (' + pt.year + ').' :
        'لا يوجد جدول لسنة ' + jd.y + '، فيُعتمد الجدول الذي بعدها: جدول ' + pt.year + '.');
      if (pt.beyond) R.warnings.push('لا يوجد جدول انتساب لسنة ' + jd.y + '؛ استُعمل جدول ' + pt.year + '.');
      var row = tableRow(pt.year, ag.row);
      COLS.forEach(function (c) {
        if (c[0] === 'annual') return;
        if (c[0] === 'death') { if (ag.row <= 45) item(c[1], row.death, 'لمن عمره 45 فما دون', 'reg'); return; }
        if (c[0] === 'exam' && !row.exam) return;
        item(c[1], row[c[0]], '', 'reg');
      });
      if (ag.row > 45) R.steps.push('عمره فوق 45، فلا يدفع رسم معونة الوفاة ولا يستفيد منها، ورسمه السنوي أقل.');
      R.steps.push('بنود الجدول (سطر العمر ' + ag.row + ') ما عدا الرسم السنوي، ثم الرسم السنوي لكل سنة من ' + jd.y + ' حتى ' + end.year + ' (' + end.why + ').');
      R.years = yearsList(jd.y, end.year, over45, paid, R.warnings);
    }

    else if (kind === 'secStruck') {
      var dd = parseDate(inp.decisionDate);
      if (!dd) { R.errors.push('أدخل تاريخ قرار إعادة القيد.'); return R; }
      R.steps.push('المشطوب الأمني يدفع الرسم السنوي لكل سنة من ' + FIXED.securityFrom + ' حتى سنة القرار ' + dd.y + ' (السنتان محسوبتان).');
      if (over45) R.steps.push('انتسب بعمر فوق 45، فيُعتمد الرسم السنوي المخفّض في السنوات التي لها جدول.');
      R.years = yearsList(FIXED.securityFrom, dd.y, over45, paid, R.warnings);
      optional();
    }

    else if (kind === 'admStruck' || kind === 'reCancel') {
      var d2 = parseDate(inp.decisionDate), ev = parseDate(inp.eventDate);
      if (!d2) R.errors.push('أدخل تاريخ قرار إعادة القيد.');
      if (!parseDate(inp.birthDate)) R.errors.push('أدخل تاريخ الميلاد (لشرط العمر في معونة الوفاة).');
      if (R.errors.length) return R;
      var F = FIXED[kind], word = kind === 'admStruck' ? 'الشطب' : 'الترقين';
      item('رسم النقابة', F.union, '', 'fix'); item('رسم التقاعد', F.pension, '', 'fix');
      var ad = ageRow(inp.birthDate, inp.decisionDate);
      R.age = ad;
      R.steps.push('العمر بتاريخ قرار إعادة القيد = ' + fmtYMD(ad.ymd) + ' ← ' + ad.raw + ' سنة.');
      if (ad.raw <= 45) { item('رسم معونة الوفاة', FIXED.deathAid, 'عمره 45 فما دون', 'fix'); R.steps.push('عمره 45 فما دون، فيدفع رسم معونة الوفاة ويستفيد منها.'); }
      else R.steps.push('عمره فوق 45، فلا يدفع رسم معونة الوفاة ولا يستفيد منها.');
      var gap = null, manual = num(inp.gapYears);
      if (ev && cmpD(ev, d2) < 0) {
        var gp = diffYMD(ev, d2); gap = ceilYears(gp);
        R.steps.push('مدة الانقطاع من تاريخ ' + word + ' ' + fmtDate(ev) + ' حتى القرار ' + fmtDate(d2) + ' = ' + fmtYMD(gp) + '، وأي جزء من سنة = سنة، فهي ' + gap + ' سنة.');
      } else if (ev) R.warnings.push('تاريخ ' + word + ' ليس قبل تاريخ القرار؛ أدخل عدد سنوات الانقطاع يدوياً.');
      if (manual !== null && manual >= 0 && manual !== gap) { R.steps.push('عُدّل عدد سنوات الانقطاع يدوياً إلى ' + manual + '.'); gap = manual; }
      if (gap === null) { gap = 0; R.warnings.push('لم تُحسب سنوات الانقطاع: أدخل تاريخ ' + word + ' أو العدد يدوياً.'); }
      R.gapYears = gap;
      if (gap) item('سنوات الانقطاع', gap * FIXED.gapYear, gap + ' × ' + fmt(FIXED.gapYear), 'fix');
      item('المطبوعات', FIXED.prints, '', 'fix'); item('تثبيت ممارسة', FIXED.practice, '', 'fix');
      optional();
    }

    else if (kind === 'cancelSelf' || kind === 'omitted') {
      var refDate = kind === 'cancelSelf' ? parseDate(inp.eventDate) : parseDate(inp.decisionDate);
      if (!refDate) { R.errors.push(kind === 'cancelSelf' ? 'أدخل تاريخ الترقين.' : 'أدخل تاريخ قرار إعادة القيد.'); return R; }
      var lp = num(inp.lastPaidYear), jy = parseDate(inp.joinDate);
      var from = lp ? lp + 1 : (jy ? jy.y : null);
      if (!from) { R.errors.push('أدخل آخر سنة دفع رسمها، أو تاريخ الانتساب.'); return R; }
      if (kind === 'omitted') {
        item('رسم النقابة', FIXED.omitted.union, '', 'fix'); item('رسم التقاعد', FIXED.omitted.pension, '', 'fix');
        R.steps.push('المُغفَل يدفع رسوم استعادة القيد (نقابة ' + fmt(FIXED.omitted.union) + ' + تقاعد ' + fmt(FIXED.omitted.pension) + ')، إضافة إلى كل الرسوم السنوية المترتبة عليه.');
      } else {
        R.steps.push('الترقين بطلب المحامي: يدفع رسم سنة الترقين ' + refDate.y + '، وكل رسم سابق غير مدفوع، لأنه يجب أن يكون بريء الذمة وقت الترقين.');
      }
      R.steps.push(lp ? 'آخر سنة مدفوعة ' + lp + '، فتُحسب الرسوم من ' + from + ' حتى ' + refDate.y + '.' : 'لم تُحدد آخر سنة مدفوعة، فتُحسب من سنة الانتساب ' + from + ' حتى ' + refDate.y + '.');
      if (from > refDate.y) R.steps.push('لا رسوم سنوية مترتبة.');
      R.years = from <= refDate.y ? yearsList(from, refDate.y, over45, paid, R.warnings) : [];
    }

    else if (kind === 'transfer') {
      item('رسم النقابة', FIXED.transfer.union, '', 'fix'); item('رسم التقاعد', FIXED.transfer.pension, '', 'fix');
      R.steps.push('رسم النقل من فرع إلى آخر ثابت: نقابة ' + fmt(FIXED.transfer.union) + ' + تقاعد ' + fmt(FIXED.transfer.pension) + '.');
      if (!inp.clearance) R.warnings.push('النقل مشروط بأن يكون المحامي بريء الذمة. تأكد من ذلك قبل القبض.');
    }

    else if (kind === 'traineeToMaster') {
      FIXED.trainee.forEach(function (t) { item(t[0], t[1], '', 'fix'); });
      R.steps.push('رسم نقل المتمرن إلى جدول الأساتذة ثابت حسب الجدول المعتمد.');
    }

    function optional() {
      var o = inp.optional || {};
      Object.keys(FIXED.optional).forEach(function (k) {
        if (o[k]) item(FIXED.optional[k][0], FIXED.optional[k][1], 'اختياري', 'opt');
      });
    }

    if (over45 && R.years.length && kind !== 'new') R.over45 = true;
    if (joinAge && joinAge.raw > 45 && kind === 'new') R.over45 = true;

    /* المجاميع */
    R.itemsTotal = R.items.reduce(function (s, x) { return s + x.amount; }, 0);
    R.yearsTotal = R.years.reduce(function (s, x) { return s + (x.paid ? 0 : x.amount); }, 0);
    R.paidCount = R.years.filter(function (x) { return x.paid; }).length;
    R.total = R.itemsTotal + R.yearsTotal;
    if (R.paidCount) R.steps.push('طُرحت ' + R.paidCount + ' سنة مدفوعة من المجموع.');
    return R;
  }
  function cmpD(a, b) { return (a.y - b.y) || (a.m - b.m) || (a.d - b.d); }

  return {
    compute: compute, pickTable: pickTable, ageRow: ageRow, tableRow: tableRow, annualFee: annualFee,
    TABLES: TABLES, TABLE_YEARS: TABLE_YEARS, ANNUAL: ANNUAL, ANNUAL_OVER45: ANNUAL_OVER45, COLS: COLS, FIXED: FIXED,
    KINDS: KINDS, STATUS: STATUS, fmt: fmt, fmtDate: fmtDate, fmtYMD: fmtYMD, parseDate: parseDate, diffYMD: diffYMD
  };
});
