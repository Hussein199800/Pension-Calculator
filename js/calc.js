/*
 * محرك حساب المعاش التقاعدي ومعونات التقاعد والوفاة للمحامين
 * مبني حرفياً على تعاميم/شروحات خزانة التقاعد المرفقة وقانون تنظيم مهنة المحاماة 30 لعام 2010.
 * كل دالة تعيد النتيجة مع "خطوات" مكتوبة بلغة بسيطة لتُعرض في التقرير.
 * يعمل في المتصفح (window.PensionCalc) وفي Node (module.exports) للاختبار.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PensionCalc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------------------------------------------------------------- الإعدادات الافتراضية
  var DEFAULTS = {
    // قيمة المعاش التقاعدي الكامل (30 سنة) عبر الزمن – بالليرة السورية الجديدة
    pensionTable: [
      { from: '1900-01-01', value: 4000, note: 'قبل زيادة 300% (حسب مثال معاش الورثة)' },
      { from: '2026-07-01', value: 16000, note: 'بعد تطبيق زيادة 300% اعتباراً من 1/7/2026' }
    ],
    // قيمة معونة التقاعد والوفاة الكاملة عبر الزمن
    aidTable: [
      { from: '1900-01-01', value: 20000, note: 'عام 2020 وما قبل' },
      { from: '2021-01-01', value: 24000, note: 'عام 2021' },
      { from: '2022-01-01', value: 28000, note: 'عام 2022' },
      { from: '2023-01-01', value: 35000, note: 'عام 2023' },
      { from: '2024-01-01', value: 50000, note: 'عام 2024 من الشهر 1 حتى الشهر 8' },
      { from: '2024-09-01', value: 100000, note: 'من الشهر 9 لعام 2024 حتى 2026' },
      { from: '2026-07-01', value: 200000, note: 'من 1/7/2026 (تأكيد المختص 19/11/2026)' }
    ],
    cutoffDate: '2014-02-04',   // تاريخ الفصل بين نظامي المعونة
    fullYears: 30,              // سنوات المعاش الكامل
    maxYears: 45,               // سقف سنوات الممارسة المحسوبة في المعاش
    pensionYearMode: 'floor',   // كسور السنة في المعاش العادي: floor = تهمل (رأي المختص)، ceil = تحسب سنة كاملة، exact = نسبياً
    bracketBoundary: 'lower',   // شرائح الصحي والورثة: lower = الحد يدخل في الشريحة الأدنى (رأي المختص)، upper = في الأعلى
    trainingMaxYears: 3,        // أقصى ما يُحسب من مدة التمرين (من حلف اليمين حتى القيد أستاذاً)
    appealMonths: 1,            // مدة الطعن بقرار الإحالة قبل اكتسابه الدرجة القطعية
    aidYearMode: 'ceil',        // كسور السنة في المعونة: تحسب سنة كاملة (نص التعميم)
    treasuryShare: true,        // حصة لخزانة التقاعد عند توزيع معاش الورثة (حسب أمثلة التعميم)
    healthAidMinParts: 5,       // الحد الأدنى لأجزاء معونة التقاعد الصحي (بعد 2014/2/4)
    maxAidAgeAtRegistration: 45 // من تجاوز هذا العمر عند القيد لا يستفيد من صندوق المعونة
  };

  // ---------------------------------------------------------------- أدوات عامة
  function fl(x) { return Math.floor(x + 1e-9); }           // تقريب لأسفل (إهمال الكسور) كما في أمثلة التعميم
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function settingsWith(s) {
    var out = clone(DEFAULTS);
    if (s) for (var k in s) if (Object.prototype.hasOwnProperty.call(s, k) && s[k] !== undefined && s[k] !== null && s[k] !== '') out[k] = s[k];
    out.pensionTable = sortTable(out.pensionTable);
    out.aidTable = sortTable(out.aidTable);
    out.treasuryShare = true; // رأي المختص: حصة الخزانة دائماً (لا تُعطَّل حتى لو حُفظت قيمة قديمة)
    out.trainingMaxYears = sanitizeYears(out.trainingMaxYears, DEFAULTS.trainingMaxYears);
    return out;
  }
  function sanitizeYears(v, def) {
    var n = +v;
    return isFinite(n) && n >= 0 && Math.floor(n) === n ? n : def;
  }
  function sortTable(t) { return (t || []).slice().filter(function (r) { return r && r.from && isFinite(+r.value); }).sort(function (a, b) { return a.from < b.from ? -1 : a.from > b.from ? 1 : 0; }); }

  function fmt(n) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    var neg = n < 0; n = Math.abs(n);
    var s = (Math.round(n * 100) / 100).toString();
    var parts = s.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '-' : '') + parts.join('.');
  }

  // ---------------------------------------------------------------- التواريخ
  function parseDate(s) {
    if (!s) return null;
    if (typeof s === 'object' && s.y) return s;
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(s).trim());
    if (!m) return null;
    var d = { y: +m[1], m: +m[2], d: +m[3] };
    if (d.m < 1 || d.m > 12 || d.d < 1 || d.d > daysInMonth(d.y, d.m)) return null;
    return d;
  }
  function daysInMonth(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
  function toISO(d) { return d.y + '-' + pad(d.m) + '-' + pad(d.d); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmtDate(d) { d = parseDate(d); return d ? d.y + '/' + d.m + '/' + d.d : '—'; }
  function cmp(a, b) { return (a.y - b.y) || (a.m - b.m) || (a.d - b.d); }
  function addDays(d, n) {
    var t = new Date(Date.UTC(d.y, d.m - 1, d.d) + n * 86400000);
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
  }
  function endOfMonth(y, m) { return { y: y, m: m, d: daysInMonth(y, m) }; }
  function addYears(d, n) { var y = d.y + n; return { y: y, m: d.m, d: Math.min(d.d, daysInMonth(y, d.m)) }; }
  function addMonths(d, n) { var t = d.y * 12 + (d.m - 1) + n, y = Math.floor(t / 12), m = t % 12 + 1; return { y: y, m: m, d: Math.min(d.d, daysInMonth(y, m)) }; }

  /**
   * الفرق بين تاريخين (end غير مشمول) بالسنوات والأشهر والأيام بالتقويم الفعلي:
   * تُضاف السنوات والأشهر الكاملة إلى تاريخ البداية، ثم تُعدّ الأيام المتبقية فعلياً
   * (فمن 31/1/2011 حتى 31/1/2026 شاملاً = 15 سنة ويوم).
   */
  function diffYMD(a, b) {
    if (cmp(b, a) <= 0) return { y: 0, m: 0, d: 0 };
    var months = (b.y - a.y) * 12 + (b.m - a.m);
    if (b.d < a.d) months -= 1;
    if (months < 0) months = 0;
    var anchor = addMonths(a, months);
    while (months > 0 && cmp(anchor, b) > 0) { months -= 1; anchor = addMonths(a, months); }
    var days = Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(anchor.y, anchor.m - 1, anchor.d)) / 86400000);
    return { y: Math.floor(months / 12), m: months % 12, d: days };
  }
  /** المدة من تاريخ إلى تاريخ شاملة اليومين */
  function spanInclusive(from, to) { return diffYMD(from, addDays(to, 1)); }
  function ymdToDays(p) { return p.y * 360 + p.m * 30 + p.d; }
  function daysToYmd(n) { n = Math.max(0, n); return { y: Math.floor(n / 360), m: Math.floor((n % 360) / 30), d: n % 30 }; }
  function unit(n, one, two, few, many) {
    if (n === 1) return one;
    if (n === 2) return two;
    if (n >= 3 && n <= 10) return n + ' ' + few;
    return n + ' ' + many;
  }
  function fmtYMD(p) {
    if (!p) return '—';
    var parts = [];
    if (p.y) parts.push(unit(p.y, 'سنة واحدة', 'سنتان', 'سنوات', 'سنة'));
    if (p.m) parts.push(unit(p.m, 'شهر واحد', 'شهران', 'أشهر', 'شهراً'));
    if (p.d) parts.push(unit(p.d, 'يوم واحد', 'يومان', 'أيام', 'يوماً'));
    return parts.length ? parts.join(' و') : 'لا شيء';
  }
  /** العمر الحقيقي بالتقويم في تاريخ معين */
  function ageAt(birth, at) {
    birth = parseDate(birth); at = parseDate(at);
    if (!birth || !at) return null;
    var y = at.y - birth.y;
    if (at.m < birth.m || (at.m === birth.m && at.d < birth.d)) y -= 1;
    return y;
  }

  function valueAt(table, date) {
    date = parseDate(date);
    var v = null, row = null;
    for (var i = 0; i < table.length; i++) {
      var f = parseDate(table[i].from);
      if (f && cmp(f, date) <= 0) { v = +table[i].value; row = table[i]; }
    }
    return { value: v, row: row };
  }

  // ---------------------------------------------------------------- مدة الممارسة
  /**
   * service = { mode:'dates'|'manual', start, end, exclusions:[{from,to,reason}], manual:{y,m,d} }
   */
  function computeService(service) {
    var steps = [], warnings = [];
    if (!service) return { error: 'لم تُدخل مدة الممارسة' };
    if (service.mode === 'manual') {
      var p = { y: +service.manual.y || 0, m: +service.manual.m || 0, d: +service.manual.d || 0 };
      var net = daysToYmd(ymdToDays(p));
      steps.push('أُدخلت مدة الممارسة الصافية يدوياً: ' + fmtYMD(net) + '.');
      return { gross: net, excluded: { y: 0, m: 0, d: 0 }, net: net, exclusions: [], steps: steps, warnings: warnings, manual: true };
    }
    var s = parseDate(service.start), e = parseDate(service.end);
    if (!s || !e) return { error: 'تاريخ بدء الممارسة أو تاريخ نهايتها غير صحيح' };
    if (cmp(e, s) < 0) return { error: 'تاريخ نهاية الممارسة قبل تاريخ بدايتها' };
    var gross = spanInclusive(s, e);
    steps.push('المدة الإجمالية من تاريخ حلف اليمين ' + fmtDate(s) + ' حتى ' + fmtDate(e) + ' = ' + fmtYMD(gross) + '.');
    var rows = [], extra = [];
    // مدة التمرين: من حلف اليمين حتى القيد في جدول الأساتذة، ولا يُحسب منها أكثر من 3 سنوات (رأي المختص).
    // من بقي متمرناً حتى نهاية الممارسة يُعامل كأن تمرينه امتد حتى نهايتها.
    var maxT = sanitizeYears(service.trainingMaxYears, 3);
    var master = parseDate(service.masterDate), trainEnd = null;
    if (master && service.stillTrainee) return { error: 'لا يمكن الجمع بين «تاريخ القيد في جدول الأساتذة» و«بقي متمرناً حتى نهاية الممارسة»: اختر أحدهما.' };
    if (master && cmp(master, s) > 0) trainEnd = addDays(master, -1);
    else if (!master && service.stillTrainee) trainEnd = e;
    if (trainEnd) {
      var capEnd = addYears(s, maxT);
      steps.push(master
        ? 'مدة التمرين من ' + fmtDate(s) + ' حتى القيد أستاذاً في ' + fmtDate(master) + ' = ' + fmtYMD(spanInclusive(s, trainEnd)) + '.'
        : 'بقي المحامي متمرناً حتى نهاية الممارسة، فمدة تمرينه = ' + fmtYMD(spanInclusive(s, trainEnd)) + '.');
      if (cmp(trainEnd, capEnd) >= 0) {
        extra.push({ from: toISO(capEnd), to: toISO(trainEnd), reason: 'مدة التمرين الزائدة عن ' + maxT + ' سنوات', auto: true });
        steps.push('لا يُحسب من مدة التمرين إلا ' + maxT + ' سنوات، فيُطرح ما زاد عنها.');
      } else steps.push('مدة التمرين لا تزيد عن ' + maxT + ' سنوات، فتُحسب كاملة.');
    }
    var iv = [];
    extra.concat(service.exclusions || []).forEach(function (x, i) {
      var n = x.auto ? 'المحسوبة تلقائياً' : 'رقم ' + (i + 1 - extra.length);
      var f = parseDate(x.from), t = parseDate(x.to);
      if (!f || !t) { warnings.push('فترة الاستبعاد ' + n + ' تواريخها غير مكتملة فتم تجاهلها.'); return; }
      if (cmp(t, f) < 0) { warnings.push('فترة الاستبعاد ' + n + ' تاريخ نهايتها قبل بدايتها فتم تجاهلها.'); return; }
      // قص الفترة ضمن مدة الممارسة
      var ff = cmp(f, s) < 0 ? s : f, tt = cmp(t, e) > 0 ? e : t;
      if (cmp(tt, ff) < 0) { warnings.push('فترة الاستبعاد ' + n + ' تقع خارج مدة الممارسة فتم تجاهلها.'); return; }
      var span = spanInclusive(ff, tt);
      rows.push({ from: toISO(ff), to: toISO(tt), reason: x.reason || 'استبعاد', span: span });
      iv.push([ff, tt]);
      steps.push('تُطرح فترة "' + (x.reason || 'استبعاد') + '" من ' + fmtDate(ff) + ' حتى ' + fmtDate(tt) + ' = ' + fmtYMD(span) + '.');
    });
    // اتحاد الفترات: المدة المشتركة بين فترتين تُطرح مرة واحدة فقط
    iv.sort(function (a, b) { return cmp(a[0], b[0]); });
    var merged = [];
    iv.forEach(function (x) {
      var last = merged[merged.length - 1];
      if (last && cmp(x[0], addDays(last[1], 1)) <= 0) { if (cmp(x[1], last[1]) > 0) last[1] = x[1]; }
      else merged.push([x[0], x[1]]);
    });
    // المدة الصافية بالتقويم الفعلي: تُزاح بداية الممارسة بعدد الأيام المستبعدة فعلياً ثم تُحسب المدة حتى النهاية
    var exActual = merged.reduce(function (a, x) { return a + Math.round((Date.UTC(x[1].y, x[1].m - 1, x[1].d) - Date.UTC(x[0].y, x[0].m - 1, x[0].d)) / 86400000) + 1; }, 0);
    var sumRows = rows.reduce(function (a, r) { return a + Math.round((Date.UTC(+r.to.slice(0, 4), +r.to.slice(5, 7) - 1, +r.to.slice(8, 10)) - Date.UTC(+r.from.slice(0, 4), +r.from.slice(5, 7) - 1, +r.from.slice(8, 10))) / 86400000) + 1; }, 0);
    if (sumRows > exActual) steps.push('بعض الفترات المستبعدة متداخلة، فطُرحت المدة المشتركة مرة واحدة فقط (' + (sumRows - exActual) + ' يوماً).');
    // تُزاح بداية الممارسة بطول كل فترة مستبعدة بالتقويم (سنوات وأشهر ثم أيام)، فاستبعاد سنتين كاملتين يطرح سنتين بالضبط
    var effStart = s, endX = addDays(e, 1);
    merged.forEach(function (x) {
      var sp = diffYMD(x[0], addDays(x[1], 1));
      effStart = addDays(addMonths(effStart, sp.y * 12 + sp.m), sp.d);
    });
    var net = cmp(effStart, endX) >= 0 ? { y: 0, m: 0, d: 0 } : diffYMD(effStart, endX);
    if (cmp(effStart, endX) > 0) warnings.push('مجموع فترات الاستبعاد أكبر من مدة الممارسة.');
    var excludedYmd = diffYMD(s, effStart);
    if (rows.length) steps.push('مجموع المدد المستبعدة = ' + exActual + ' يوماً (' + fmtYMD(excludedYmd) + ')، فتكون مدة الممارسة الصافية = ' + fmtYMD(net) + '.');
    else steps.push('لا توجد مدد مستبعدة، فمدة الممارسة الصافية = ' + fmtYMD(net) + '.');
    return { gross: gross, excluded: excludedYmd, net: net, exclusions: rows, steps: steps, warnings: warnings };
  }

  /** تحويل المدة إلى عدد سنوات معتمد حسب طريقة معالجة الكسور */
  function adoptYears(net, mode) {
    var hasFraction = net.m > 0 || net.d > 0;
    if (mode === 'ceil') return { years: net.y + (hasFraction ? 1 : 0), text: hasFraction ? 'جزء السنة يُحسب سنة كاملة، فتُعتمد ' + (net.y + 1) + ' سنة.' : 'المدة سنوات كاملة: ' + net.y + ' سنة.' };
    if (mode === 'exact') {
      var v = Math.round((net.y + net.m / 12 + net.d / 360) * 10000) / 10000;
      return { years: v, text: 'تُحسب المدة نسبياً بالأشهر والأيام: ' + v + ' سنة.' };
    }
    return { years: net.y, text: hasFraction ? 'تُعتمد السنوات الكاملة فقط ويُهمل الكسر (' + fmtYMD({ y: 0, m: net.m, d: net.d }) + ')، فتُعتمد ' + net.y + ' سنة.' : 'المدة سنوات كاملة: ' + net.y + ' سنة.' };
  }

  // ---------------------------------------------------------------- قواعد المعاش
  /** المعاش العادي: كامل/جزئي/كامل مع علاوة، بسقف 45 سنة */
  function ordinaryPension(P, Y, s) {
    s = s || DEFAULTS;
    var F = s.fullYears, MAX = s.maxYears, steps = [], amount, category;
    if (Y < F) {
      amount = fl(P * Y / F);
      category = 'معاش تقاعدي جزئي';
      steps.push('سنوات الممارسة (' + Y + ') أقل من ' + F + ' سنة، فيستحق معاشاً جزئياً بنسبة سنوات ممارسته.');
      steps.push('المعاش = الراتب الكامل × سنوات الممارسة ÷ ' + F + ' = ' + fmt(P) + ' × ' + Y + ' ÷ ' + F + ' = ' + fmt(amount) + ' ل.س.');
    } else if (Y === F) {
      amount = P;
      category = 'معاش تقاعدي كامل';
      steps.push('سنوات الممارسة ' + F + ' سنة كاملة، فيستحق المعاش الكامل = ' + fmt(P) + ' ل.س.');
    } else {
      var capped = Math.min(Y, MAX);
      var extra = Math.round((capped - F) * 10000) / 10000;
      var bonus = fl(P * extra / F);
      amount = P + bonus;
      category = 'معاش تقاعدي كامل مع علاوة';
      steps.push('سنوات الممارسة (' + Y + ') أكثر من ' + F + ' سنة، فيستحق المعاش الكامل مضافاً إليه علاوة عن السنوات الزائدة.');
      if (Y > MAX) steps.push('سقف السنوات المحسوبة ' + MAX + ' سنة فقط، فتُحسب العلاوة عن ' + extra + ' سنة بدلاً من ' + Math.round((Y - F) * 10000) / 10000 + '.');
      steps.push('العلاوة = الراتب الكامل × سنوات العلاوة ÷ ' + F + ' = ' + fmt(P) + ' × ' + extra + ' ÷ ' + F + ' = ' + fmt(bonus) + ' ل.س.');
      steps.push('المعاش = الراتب الكامل + العلاوة = ' + fmt(P) + ' + ' + fmt(bonus) + ' = ' + fmt(amount) + ' ل.س.');
    }
    return { amount: amount, category: category, steps: steps };
  }

  /**
   * شرائح التقاعد الصحي ومعاش الورثة (المتوفى على رأس عمله).
   * رأي المختص (19/11/2026): الحد يدخل في الشريحة الأدنى، وكسر السنة يُحسب عند الحدود فقط:
   * حتى 5 سنوات = الربع، أكثر من 5 حتى 10 = النصف، أكثر من 10 حتى 15 = ثلاثة الأرباع، أكثر من 15 (ولو بيوم) = الكامل.
   * Y: مدة الممارسة {y,m,d} (أو عدد سنوات).
   */
  function bracketPension(P, Y, occupational, label, s) {
    s = s || DEFAULTS;
    var steps = [], amount, category, fraction;
    if (occupational) {
      amount = P; fraction = 'كامل'; category = 'كامل المعاش (الحالة ناتجة عن المهنة)';
      steps.push('بما أن ' + (label || 'الحالة') + ' ناتجة عن المهنة، يُستحق كامل المعاش مهما بلغت سنوات الممارسة = ' + fmt(P) + ' ل.س.');
      return { amount: amount, category: category, fraction: fraction, steps: steps };
    }
    var dur = typeof Y === 'number' ? daysToYmd(Math.round(Y * 360)) : Y;
    var upper = s.bracketBoundary === 'upper';
    // مقارنة تقويمية (سنوات، ثم أشهر، ثم أيام) دون تحويل الأشهر إلى أيام
    function past(n) { return upper ? dur.y >= n : (dur.y > n || (dur.y === n && (dur.m > 0 || dur.d > 0))); }
    if (past(15)) { amount = P; fraction = 'كامل'; category = upper ? 'كامل المعاش (15 سنة فأكثر)' : 'كامل المعاش (أكثر من 15 سنة)'; }
    else if (past(10)) { amount = fl(P * 3 / 4); fraction = '3/4'; category = upper ? 'ثلاثة أرباع المعاش (من 10 إلى أقل من 15 سنة)' : 'ثلاثة أرباع المعاش (أكثر من 10 سنوات حتى 15 سنة)'; }
    else if (past(5)) { amount = fl(P / 2); fraction = '1/2'; category = upper ? 'نصف المعاش (من 5 إلى أقل من 10 سنوات)' : 'نصف المعاش (أكثر من 5 سنوات حتى 10 سنوات)'; }
    else { amount = fl(P / 4); fraction = '1/4'; category = upper ? 'ربع المعاش (أقل من 5 سنوات)' : 'ربع المعاش (حتى 5 سنوات)'; }
    steps.push('مدة الممارسة = ' + fmtYMD(dur) + '، وتقع ضمن شريحة: ' + category + '.');
    if (!upper) steps.push('في الشرائح يدخل الحد في الشريحة الأدنى، وأي زيادة عليه ولو بيوم تنقل إلى الشريحة الأعلى.');
    if (fraction === 'كامل') steps.push('المعاش المستحق = الراتب الكامل = ' + fmt(P) + ' ل.س.');
    else steps.push('المعاش المستحق = ' + fmt(P) + ' × ' + fraction + ' = ' + fmt(amount) + ' ل.س.');
    return { amount: amount, category: category, fraction: fraction, steps: steps };
  }

  /** حساب الشهر الأول الجزئي: الراتب × عدد الأيام ÷ 30 */
  function prorate(amount, start) {
    if (start.d === 1) return { amount: amount, days: 30, partial: false };
    var days = daysInMonth(start.y, start.m) - start.d + 1;
    var v = Math.min(amount, fl(amount * days / 30));
    return { amount: v, days: days, partial: v < amount };
  }

  // ---------------------------------------------------------------- الورثة
  var REL = {
    spouse: 'زوج/زوجة', son: 'ابن', daughter: 'ابنة', father: 'أب', mother: 'أم', sister: 'أخت', brother: 'أخ', other: 'قريب آخر'
  };

  var STOP_FLAGS = { married: 1, hasIncome: 1, remarried: 1 };
  /**
   * أهلية الوارث في تاريخ معين مع «تاريخ توقف الاستحقاق» (زواج، عمل، انتهاء دراسة…):
   * قبل هذا التاريخ تُهمل علامات الزواج/المورد، ومن بعده لا يستحق.
   */
  function heirEligibleAt(h, refDate) {
    var stop = parseDate(h.stopDate), at = parseDate(refDate);
    if (stop && at && cmp(at, stop) >= 0) return { ok: false, reason: 'توقف استحقاقه بتاريخ ' + fmtDate(stop) + '.' };
    // قبل تاريخ التوقف يُهمل الشرط الذي سبّب التوقف فقط (زواج، عمل/مورد، زواج الأرمل/ة)؛ بقية الشروط تبقى كما هي
    if (stop && STOP_FLAGS[h.stopReason]) { var hh = clone(h); hh[h.stopReason] = false; return heirPensionEligibility(hh, refDate); }
    return heirPensionEligibility(h, refDate);
  }

  /**
   * الأهلية سنة بسنة (رأي المختص): تُقدَّر عند بدء الصرف، ثم في أول كل سنة عند تقديم الوثائق السنوية؛
   * من فقد أهليته تتوقف حصته من أول السنة التالية وتعود حصته لخزانة التقاعد (لا تُوزَّع على الباقين).
   */
  function heirYearEligible(h, year, startISO) {
    var st = parseDate(startISO);
    // من فقد أهليته خلال سنة (حتى لو في 1/1) تتوقف حصته من 1/1 للسنة التي تليها، فيُفحص آخر يوم من السنة السابقة
    return heirEligibleAt(h, year <= st.y ? startISO : (year - 1) + '-12-31');
  }
  function heirStopFrom(h, startISO, untilYear) {
    var st = parseDate(startISO);
    for (var y = st.y + 1; y <= untilYear; y++) {
      var e = heirYearEligible(h, y, startISO);
      if (!e.ok) return { from: y + '-01-01', reason: e.reason };
    }
    return null;
  }

  /** أهلية الوارث لمعاش الورثة في تاريخ معين */
  function heirPensionEligibility(h, refDate) {
    var age = ageAt(h.birth, refDate);
    var ageTxt = age === null ? 'العمر غير مدخل' : 'العمر ' + age + ' سنة';
    switch (h.relation) {
      case 'spouse':
        if (h.remarried) return { ok: false, reason: 'زوج/زوجة تزوج بعد الوفاة (يُرجى التحقق من النظام النافذ).' };
        return { ok: true, reason: 'الزوجة أو الزوج من المستحقين الأساسيين.' };
      case 'son':
        if (h.disabled) return { ok: true, reason: 'ابن عاجز (' + ageTxt + ').' };
        if (age === null) return { ok: false, reason: 'لا يمكن تحديد الأهلية: أدخل تاريخ الميلاد.' };
        if (age < 18) return { ok: true, reason: 'ابن لم يكمل الثامنة عشرة (' + ageTxt + ').' };
        if (h.student && age < 27) return { ok: true, reason: 'ابن أكمل 18 ويتابع دراسته ولم يبلغ 27 (' + ageTxt + ').' };
        return { ok: false, reason: 'ابن تجاوز 18 سنة ' + (h.student ? 'وبلغ 27' : 'ولا يتابع دراسته') + ' وغير عاجز (' + ageTxt + ').' };
      case 'daughter':
        if (h.married) return { ok: false, reason: 'ابنة متزوجة.' };
        if (h.hasIncome) return { ok: false, reason: 'ابنة لها عمل أو مورد يكفي لإعالتها.' };
        return { ok: true, reason: 'ابنة غير متزوجة (أو أرملة/مطلقة) ليس لها عمل أو مورد يكفي.' };
      case 'father': case 'mother':
        if (!h.dependent) return { ok: false, reason: 'يستحق الوالدان بصورة استثنائية فقط عند ثبوت الإعالة وحرمانهما من موارد الرزق.' };
        return { ok: true, reason: 'استحقاق استثنائي: ثبتت الإعالة والحرمان من موارد الرزق.' };
      case 'sister':
        if (h.married) return { ok: false, reason: 'أخت متزوجة.' };
        if (!h.dependent) return { ok: false, reason: 'تستحق الأخت غير المتزوجة استثنائياً فقط عند ثبوت الإعالة والحرمان من موارد الرزق.' };
        return { ok: true, reason: 'استحقاق استثنائي: أخت غير متزوجة محرومة من موارد الرزق وثبتت الإعالة.' };
      default:
        return { ok: false, reason: 'ليس من فئات المستحقين لمعاش الورثة.' };
    }
  }

  /** حصص معاش الورثة: 3 حصص للزوجات، حصة لكل ولد، حصة للوالدين، حصة للأخوات + حصة لخزانة التقاعد */
  function pensionShares(heirs, refDate, s, untilYear) {
    s = s || DEFAULTS;
    var list = (heirs || []).map(function (h, i) {
      var e = heirEligibleAt(h, refDate);
      var stop = e.ok && untilYear ? heirStopFrom(h, refDate, untilYear) : null;
      return { idx: i, heir: h, eligible: e.ok, reason: e.reason, stopFrom: stop ? stop.from : null, stopReason: stop ? stop.reason : '' };
    });
    var elig = list.filter(function (x) { return x.eligible; });
    var spouses = elig.filter(function (x) { return x.heir.relation === 'spouse'; });
    var children = elig.filter(function (x) { return x.heir.relation === 'son' || x.heir.relation === 'daughter'; });
    var parents = elig.filter(function (x) { return x.heir.relation === 'father' || x.heir.relation === 'mother'; });
    var sisters = elig.filter(function (x) { return x.heir.relation === 'sister'; });
    var groups = [];
    if (spouses.length) groups.push({ key: 'spouses', label: 'الزوجة/الزوجات أو الزوج', shares: 3, members: spouses });
    children.forEach(function (c) { groups.push({ key: 'child' + c.idx, label: REL[c.heir.relation] + ': ' + (c.heir.name || ''), shares: 1, members: [c] }); });
    if (parents.length) groups.push({ key: 'parents', label: 'الوالدان', shares: 1, members: parents });
    if (sisters.length) groups.push({ key: 'sisters', label: 'الأخوات', shares: 1, members: sisters });
    var heirShares = groups.reduce(function (a, g) { return a + g.shares; }, 0);
    var treasury = heirShares > 0 && s.treasuryShare ? 1 : 0;
    return { list: list, groups: groups, heirShares: heirShares, treasury: treasury, totalShares: heirShares + treasury };
  }

  /** توزيع مبلغ شهري على الحصص مع التقريب لأسفل في كل خطوة كما في الأمثلة */
  function distribute(amount, shares) {
    if (!shares.totalShares) return { unit: 0, perGroup: [], perHeir: {}, treasury: 0 };
    var unit = fl(amount / shares.totalShares);
    var perHeir = {};
    var perGroup = shares.groups.map(function (g) {
      var gAmount = unit * g.shares;
      var each = fl(gAmount / g.members.length);
      g.members.forEach(function (m) { perHeir[m.idx] = each; });
      return { key: g.key, label: g.label, shares: g.shares, amount: gAmount, each: each, count: g.members.length, idx: g.members.map(function (m) { return m.idx; }) };
    });
    return { unit: unit, perGroup: perGroup, perHeir: perHeir, treasury: unit * shares.treasury };
  }

  // ---------------------------------------------------------------- جدول الاستحقاق الشهري
  /**
   * يبني الفترات من تاريخ بدء الصرف حتى نهاية الشهر المحدد،
   * مع إعادة حساب المعاش عند تغير قيمة الراتب الكامل، ودمج الأشهر المتماثلة.
   * monthlyFn(P, date) => { total, perHeir? }
   */
  function buildSchedule(startISO, untilYM, s, monthlyFn) {
    var start = parseDate(startISO);
    var um = /^(\d{4})-(\d{1,2})$/.exec(untilYM || '');
    if (!start || !um) return { periods: [], total: 0, error: 'تاريخ بدء الصرف أو شهر نهاية الحساب غير صحيح' };
    var until = { y: +um[1], m: +um[2] };
    if (until.y < start.y || (until.y === start.y && until.m < start.m)) return { periods: [], total: 0, error: 'شهر نهاية الحساب قبل تاريخ بدء الصرف' };
    var periods = [], y = start.y, m = start.m, first = true, guard = 0;
    while ((y < until.y || (y === until.y && m <= until.m)) && guard++ < 1200) {
      var dayFrom = first ? start : { y: y, m: m, d: 1 };
      var pv = valueAt(s.pensionTable, dayFrom);
      var calc = monthlyFn(pv.value, dayFrom);
      var row;
      if (first && start.d !== 1) {
        var pr = prorate(calc.total, start), perHeir = {};
        if (calc.perHeir) for (var k in calc.perHeir) perHeir[k] = prorate(calc.perHeir[k], start).amount;
        var tot = calc.perHeir ? sumObj(perHeir) : pr.amount;
        row = { from: toISO(start), to: toISO(endOfMonth(y, m)), months: 0, days: pr.days, partial: true, P: pv.value,
          monthly: calc.total, monthlyHeirs: calc.perHeir || null, amount: tot, amountHeirs: calc.perHeir ? perHeir : null, total: tot, totalHeirs: calc.perHeir ? perHeir : null };
        periods.push(row);
      } else {
        var last = periods[periods.length - 1];
        if (last && !last.partial && last.P === pv.value && last.monthly === calc.total && JSON.stringify(last.monthlyHeirs) === JSON.stringify(calc.perHeir || null)) {
          last.months += 1; last.to = toISO(endOfMonth(y, m)); last.total += calc.total;
          if (calc.perHeir) for (var k2 in calc.perHeir) last.totalHeirs[k2] += calc.perHeir[k2];
        } else {
          row = { from: toISO(dayFrom), to: toISO(endOfMonth(y, m)), months: 1, days: null, partial: false, P: pv.value,
            monthly: calc.total, monthlyHeirs: calc.perHeir || null, amount: calc.total, total: calc.total, totalHeirs: calc.perHeir ? clone(calc.perHeir) : null };
          periods.push(row);
        }
      }
      first = false;
      m += 1; if (m > 12) { m = 1; y += 1; }
    }
    var total = periods.reduce(function (a, p) { return a + p.total; }, 0);
    return { periods: periods, total: total };
  }
  function sumObj(o) { var t = 0; for (var k in o) t += o[k]; return t; }

  // ---------------------------------------------------------------- المعونات
  function aidExclusion(c, s) {
    // طالبو القيد بعمر يتجاوز 45 / إعادة القيد بعمر يتجاوز 45 مع ممارسة سابقة أقل من 5 سنوات
    var age = ageAt(c.birthDate, c.registrationDecisionDate || c.joinDate);
    if (age === null) return null;
    if (!c.reRegistration && age > s.maxAidAgeAtRegistration)
      return 'عمر المحامي بتاريخ صدور قرار قيده كان ' + age + ' سنة، أي تجاوز الخامسة والأربعين، فلا يستفيد من خدمات صندوق معونة التقاعد والوفاة.';
    if (c.reRegistration && age > s.maxAidAgeAtRegistration && (+c.priorPracticeYears || 0) < 5)
      return 'عمر المحامي بتاريخ قرار إعادة القيد كان ' + age + ' سنة (أكثر من 45) ومدة ممارسته الفعلية السابقة أقل من 5 سنوات كاملة، فلا يستفيد من صندوق المعونة.';
    return null;
  }

  function retirementAid(c, svc, s) {
    var steps = [], notes = [];
    var join = parseDate(c.joinDate), ret = parseDate(c.retirementDate), cutoff = parseDate(s.cutoffDate);
    if (!join || !ret) return { amount: 0, eligible: false, steps: ['لا يمكن حساب المعونة: أدخل تاريخ الانتساب وتاريخ الإحالة على التقاعد.'] };
    var ex = aidExclusion(c, s);
    if (ex) return { amount: 0, eligible: false, steps: [ex] };
    var aid = valueAt(s.aidTable, ret).value;
    var age = ageAt(c.birthDate, ret);
    var isHealth = c.type === 'health';
    var yrs = adoptYears(svc.net, s.aidYearMode);
    steps.push('مقدار معونة التقاعد والوفاة الكاملة بتاريخ الإحالة (' + fmtDate(ret) + ') = ' + fmt(aid) + ' ل.س.');
    if (age !== null) steps.push('عمر المحامي بتاريخ الإحالة = ' + age + ' سنة.');
    if (cmp(join, cutoff) < 0) {
      steps.push('المحامي منتسب قبل تاريخ ' + fmtDate(cutoff) + '، فيُطبق نظام "نصف المعونة" عند التقاعد دون النظر لسنوات الممارسة.');
      var cond = [];
      if (age !== null && age >= 65) cond.push('أتم الخامسة والستين');
      if (age !== null && age >= 60 && svc.net.y >= 30) cond.push('أكمل 30 سنة ممارسة وأتم الستين معاً');
      if (isHealth) cond.push('أحيل على التقاعد لأسباب صحية');
      if (!cond.length) { steps.push('لم يتحقق أي شرط من شروط نصف المعونة (إتمام 65 سنة، أو 30 سنة ممارسة مع إتمام 60 سنة، أو التقاعد الصحي).'); return { amount: 0, eligible: false, steps: steps, regime: 'pre' }; }
      steps.push('الشرط المتحقق: ' + cond.join('، ') + '.');
      if (!c.requestedHalfAid) {
        steps.push('لم يُبدِ المحامي رغبته بقبض نصف المعونة عند تقديم طلب الإحالة، فلا يُصرف له شيء الآن، ويستحق ورثته كامل معونة الوفاة عند الوفاة.');
        return { amount: 0, eligible: true, steps: steps, regime: 'pre' };
      }
      var half = fl(aid / 2);
      steps.push('أبدى رغبته بقبض نصف المعونة، فيستحق = ' + fmt(aid) + ' ÷ 2 = ' + fmt(half) + ' ل.س، ويستحق ورثته النصف الثاني عند الوفاة.');
      return { amount: half, eligible: true, steps: steps, regime: 'pre' };
    }
    steps.push('المحامي منتسب بتاريخ ' + fmtDate(join) + ' أي بعد ' + fmtDate(cutoff) + '، فيُطبق نظام المعونة النسبية.');
    steps.push('مدة الممارسة الصافية ' + fmtYMD(svc.net) + '، و' + yrs.text);
    var Y = Math.min(yrs.years, 30), full;
    if (isHealth) {
      var parts = Math.max(Y, s.healthAidMinParts);
      full = fl(aid * parts / 30);
      steps.push('بما أنه أحيل لأسباب صحية: يستحق معونة نسبية بعدد سنوات ممارسته على ألا تقل عن ' + s.healthAidMinParts + ' أجزاء من 30.' + (parts !== Y ? ' سنواته أقل من الحد الأدنى فتُعتمد ' + parts + ' أجزاء.' : ''));
      steps.push('المعونة النسبية المستحقة = ' + parts + ' × ' + fmt(aid) + ' ÷ 30 = ' + fmt(full) + ' ل.س.');
    } else {
      if (age === null || age < 65) {
        steps.push('لم يتم الخامسة والستين من العمر ولم يُحل لأسباب صحية، فلا يستحق معونة التقاعد حسب التعميم.');
        return { amount: 0, eligible: false, steps: steps, regime: 'post' };
      }
      if (Y >= 30) { full = aid; steps.push('أتم 65 سنة ومارس 30 سنة فأكثر، فالمعونة المستحقة كاملة = ' + fmt(aid) + ' ل.س.'); }
      else { full = fl(aid * Y / 30); steps.push('أتم 65 سنة ومدة ممارسته أقل من 30 سنة، فالمعونة المستحقة ' + Y + ' جزءاً من 30: ' + Y + ' × ' + fmt(aid) + ' ÷ 30 = ' + fmt(full) + ' ل.س.'); }
    }
    var amount = fl(full / 2);
    steps.push('يُصرف للمحامي عند التقاعد نصف هذه المعونة = ' + fmt(full) + ' ÷ 2 = ' + fmt(amount) + ' ل.س، ويستحق ورثته النصف الثاني عند الوفاة بقيمة المعونة في سنة الوفاة (رأي المختص).');
    return { amount: amount, full: full, eligible: true, steps: steps, regime: 'post' };
  }

  function deathAidBeneficiaries(c) {
    var heirs = c.heirs || [];
    var primary = heirs.map(function (h, i) { return { idx: i, heir: h }; }).filter(function (x) { return ['spouse', 'son', 'daughter', 'father', 'mother'].indexOf(x.heir.relation) >= 0; });
    var designated = heirs.map(function (h, i) { return { idx: i, heir: h }; }).filter(function (x) { return x.heir.designated; });
    var steps = [], groups = [];
    if (primary.length) {
      var dPrim = designated.filter(function (x) { return primary.some(function (p) { return p.idx === x.idx; }); });
      if (dPrim.length) {
        steps.push('خصّص المحامي معونة الوفاة لـ: ' + dPrim.map(function (x) { return x.heir.name || REL[x.heir.relation]; }).join('، ') + '، فتُصرف لهم وحدهم.');
        groups.push({ label: 'المخصَّص لهم من المحامي', shares: 1, members: dPrim });
      } else {
        var sp = primary.filter(function (x) { return x.heir.relation === 'spouse'; });
        var ch = primary.filter(function (x) { return x.heir.relation === 'son' || x.heir.relation === 'daughter'; });
        var pa = primary.filter(function (x) { return x.heir.relation === 'father' || x.heir.relation === 'mother'; });
        if (sp.length) groups.push({ label: 'الزوجة/الزوجات أو الزوج (حصة واحدة مهما بلغ العدد)', shares: 1, members: sp });
        ch.forEach(function (x) { groups.push({ label: REL[x.heir.relation] + ': ' + (x.heir.name || ''), shares: 1, members: [x] }); });
        if (pa.length) groups.push({ label: 'الوالدان (حصة واحدة مناصفة)', shares: 1, members: pa });
        steps.push('توزع المعونة حصصاً متساوية: حصة للزوجة/الزوجات، حصة لكل ولد، حصة للوالدين مناصفة. عدد الحصص = ' + groups.length + '.');
      }
    } else {
      var dRel = designated.filter(function (x) { return ['sister', 'brother', 'other'].indexOf(x.heir.relation) >= 0; });
      if (dRel.length) {
        steps.push('لا يوجد مستحقون أساسيون، وقد حصر المحامي المعونة بكتاب منظم في الفرع بـ: ' + dRel.map(function (x) { return x.heir.name || REL[x.heir.relation]; }).join('، ') + '.');
        groups.push({ label: 'المحصورة بهم المعونة بكتاب المحامي', shares: 1, members: dRel });
      } else {
        steps.push('لا يوجد مستحقون أساسيون (زوج/زوجة، أولاد، والدان) ولم يحصر المحامي المعونة بأحد أقربائه، فلا تترتب معونة الوفاة.');
      }
    }
    return { groups: groups, steps: steps };
  }

  function deathAid(c, svc, s) {
    var steps = [];
    var join = parseDate(c.joinDate), death = parseDate(c.deathDate), cutoff = parseDate(s.cutoffDate);
    if (!join || !death) return { amount: 0, steps: ['لا يمكن حساب معونة الوفاة: أدخل تاريخ الانتساب وتاريخ الوفاة.'], distribution: [] };
    var ex = aidExclusion(c, s);
    if (ex) return { amount: 0, steps: [ex], distribution: [] };
    var aid = valueAt(s.aidTable, death).value, amount;
    steps.push('مقدار المعونة المحدد بتاريخ الوفاة (' + fmtDate(death) + ') = ' + fmt(aid) + ' ل.س (تُعتمد قيمة المعونة بتاريخ الوفاة لا بتاريخ الصرف).');
    if (cmp(join, cutoff) < 0) {
      steps.push('المحامي منتسب قبل ' + fmtDate(cutoff) + '.');
      if (c.status === 'retired' && c.receivedHalfAid) {
        amount = fl(aid / 2);
        steps.push('قبض المحامي نصف المعونة عند تقاعده، فيستحق ورثته النصف الثاني = ' + fmt(aid) + ' ÷ 2 = ' + fmt(amount) + ' ل.س.');
      } else {
        amount = aid;
        steps.push((c.status === 'retired' ? 'لم يقبض نصف المعونة عند تقاعده' : 'توفي على رأس عمله') + '، فيستحق ورثته كامل معونة الوفاة دون النظر لسنوات ممارسته = ' + fmt(amount) + ' ل.س.');
      }
    } else {
      steps.push('المحامي منتسب بعد ' + fmtDate(cutoff) + '، فيستحق ورثته معونة نسبية تعادل سنوات ممارسته.');
      if (c.status === 'retired' && c.receivedRetirementAid) {
        // سجل من الإصدار السابق: «قبض معونة التقاعد كاملة» — لا تُصرف معونة وفاة إضافية
        steps.push('سُجّل أن المحامي قبض معونة التقاعد والوفاة كاملة عند تقاعده، فلا تُصرف معونة وفاة إضافية.');
        return { amount: 0, steps: steps, distribution: [] };
      }
      var yrs = adoptYears(svc.net, s.aidYearMode);
      var Y = Math.min(yrs.years, 30);
      steps.push('مدة الممارسة الصافية ' + fmtYMD(svc.net) + '، و' + yrs.text);
      var halfCase = c.status === 'retired' && c.receivedHalfRetirementAid;
      var parts = Y;
      if (halfCase && c.originalType === 'health' && Y < s.healthAidMinParts) {
        parts = s.healthAidMinParts;
        steps.push('أُحيل المحامي على التقاعد لأسباب صحية، فأساس معونته ' + parts + ' أجزاء على الأقل كما حُسبت عند تقاعده.');
      }
      var fullD = fl(parts * aid / 30);
      steps.push('المعونة النسبية = ' + (parts === Y ? 'سنوات الممارسة' : 'عدد الأجزاء') + ' × مقدار المعونة ÷ 30 = ' + parts + ' × ' + fmt(aid) + ' ÷ 30 = ' + fmt(fullD) + ' ل.س.');
      if (halfCase) {
        amount = fl(fullD / 2);
        steps.push('قبض المحامي نصف المعونة عند تقاعده، فيستحق ورثته النصف الثاني بقيمة المعونة في سنة الوفاة = ' + fmt(fullD) + ' ÷ 2 = ' + fmt(amount) + ' ل.س (رأي المختص).');
      } else amount = fullD;
    }
    var ben = deathAidBeneficiaries(c);
    steps = steps.concat(ben.steps);
    var distribution = [];
    if (ben.groups.length) {
      var share = fl(amount / ben.groups.length);
      ben.groups.forEach(function (g) {
        var each = fl(share / g.members.length);
        distribution.push({ label: g.label, amount: share, each: each, names: g.members.map(function (m) { return m.heir.name || REL[m.heir.relation]; }) });
      });
      steps.push('قيمة الحصة الواحدة = ' + fmt(amount) + ' ÷ ' + ben.groups.length + ' = ' + fmt(share) + ' ل.س.');
    } else amount = 0;
    return { amount: amount, steps: steps, distribution: distribution };
  }

  function BRACKET_TXT(s) {
    return s.bracketBoundary === 'upper'
      ? '15 سنة فأكثر = كامل المعاش، من 10 إلى أقل من 15 = ثلاثة أرباع، من 5 إلى أقل من 10 = النصف، أقل من 5 = الربع'
      : 'حتى 5 سنوات = الربع، أكثر من 5 حتى 10 = النصف، أكثر من 10 حتى 15 = ثلاثة الأرباع، أكثر من 15 (ولو بيوم) = كامل المعاش';
  }

  // ---------------------------------------------------------------- الحساب الكامل لحالة
  /**
   * c = {
   *   type: 'ordinary'|'health'|'heirs',
   *   status (heirs): 'retired'|'inService', originalType (heirs+retired): 'ordinary'|'health',
   *   birthDate, joinDate, registrationDecisionDate, reRegistration, priorPracticeYears,
   *   retirementDate, paymentStartDate, medicalDate, occupational, deathDate, deathDuringWork,
   *   service: {...}, heirs: [...], untilMonth: 'YYYY-MM',
   *   includeAid, requestedHalfAid, receivedHalfAid (قبل 2014), receivedHalfRetirementAid (بعد 2014),
   *   receivedRetirementAid (سجل قديم: قبض المعونة كاملة), reviewDate, appealWaived, service.masterDate, service.stillTrainee
   * }
   */
  function computeCase(c, settings) {
    var s = settingsWith(settings);
    var R = { type: c.type, warnings: [], errors: [], settings: s };
    var svcIn = clone(c.service || {}); svcIn.trainingMaxYears = s.trainingMaxYears;
    var svc = computeService(svcIn);
    if (svc.error) { R.errors.push(svc.error); return R; }
    R.service = svc;
    R.warnings = R.warnings.concat(svc.warnings);
    var yrs = adoptYears(svc.net, s.pensionYearMode);
    R.years = yrs;

    var startISO, baseFn, basis = [], label;
    if (c.type === 'ordinary') {
      label = 'تقاعد عادي';
      baseFn = function (P) { return ordinaryPension(P, yrs.years, s); };
      basis.push('المعاش العادي: 30 سنة = معاش كامل، أقل من 30 = معاش جزئي بنسبة السنوات، أكثر من 30 = معاش كامل مع علاوة عن السنوات الزائدة، وسقف السنوات المحسوبة ' + s.maxYears + ' سنة. ' + (s.pensionYearMode === 'ceil' ? 'ويُحسب جزء السنة سنة كاملة (حسب الإعدادات).' : s.pensionYearMode === 'exact' ? 'وتُحسب كسور السنة نسبياً بالأشهر والأيام (حسب الإعدادات).' : 'ويُهمل كسر السنة وتُعتمد السنوات الكاملة.'));
      var rv = parseDate(c.reviewDate), rd = parseDate(c.retirementDate);
      if (rv && rd && cmp(rv, rd) < 0) { R.errors.push('تاريخ مشاهدة مراقب الخزانة (' + fmtDate(rv) + ') يسبق تاريخ قرار الإحالة على التقاعد (' + fmtDate(rd) + ').'); return R; }
      if (rv) {
        var fin = c.appealWaived ? rv : addMonths(rv, s.appealMonths);
        startISO = toISO(fin);
        basis.push('يُصرف المعاش من تاريخ اكتساب قرار الإحالة الدرجة القطعية، لا من تاريخ صدوره. شاهد مراقب الخزانة القرار في ' + fmtDate(rv) +
          (c.appealWaived ? ' وأُسقط حق الطعن، فاكتسب القرار الدرجة القطعية في التاريخ نفسه ' + fmtDate(fin) + '.' : '، ولم يُسقط حق الطعن، فيكتسب الدرجة القطعية بعد مدة الطعن (' + s.appealMonths + ' شهر) في ' + fmtDate(fin) + '.'));
      } else {
        startISO = c.paymentStartDate || c.retirementDate;
        basis.push('لم يُدخل تاريخ مشاهدة مراقب الخزانة للقرار، فيُعتمد ' + (c.paymentStartDate ? 'تاريخ بدء الصرف المدخل ' : 'تاريخ الإحالة ') + fmtDate(startISO) + ' لبدء الصرف.');
      }
    } else if (c.type === 'health') {
      label = 'تقاعد صحي';
      startISO = c.medicalDate;
      baseFn = function (P) { return bracketPension(P, svc.net, !!c.occupational, 'الإصابة أو الحالة الصحية', s); };
      basis.push('التقاعد الصحي: ' + BRACKET_TXT(s) + '، وإذا كانت الحالة ناتجة عن المهنة = كامل المعاش.');
      basis.push('يُصرف المعاش اعتباراً من تاريخ الخبرة الطبية الصادرة عن الفرع أو النقابة المركزية.');
    } else if (c.type === 'heirs') {
      var death = parseDate(c.deathDate);
      if (!death) { R.errors.push('أدخل تاريخ الوفاة.'); return R; }
      startISO = toISO(addDays(death, 1));
      if (c.status === 'retired') {
        label = 'معاش ورثة محامٍ متقاعد';
        if (c.originalType === 'health') baseFn = function (P) { return bracketPension(P, svc.net, !!c.occupational, 'الحالة الصحية للمورث', s); };
        else baseFn = function (P) { return ordinaryPension(P, yrs.years, s); };
        basis.push('معاش ورثة المتقاعد: يوزع معاش المحامي المتقاعد نفسه على المستحقين من ورثته.');
      } else {
        label = 'معاش ورثة محامٍ متوفى على رأس عمله';
        baseFn = function (P) { return bracketPension(P, svc.net, !!c.deathDuringWork, 'الوفاة (أثناء المرافعة أو بسبب المهنة)', s); };
        basis.push('معاش ورثة المتوفى على رأس عمله: ' + BRACKET_TXT(s) + '، وإذا حدثت الوفاة أثناء المرافعة أو بسبب المهنة = كامل المعاش.');
      }
      basis.push('يبدأ صرف معاش الورثة من اليوم التالي للوفاة. التوزيع: 3 حصص للزوجة/الزوجات أو الزوج، حصة لكل ولد مستحق، حصة للوالدين، حصة للأخوات' + '، وحصة واحدة لخزانة التقاعد دائماً مهما كان عدد الورثة.');
      basis.push('تُراجع أهلية الورثة سنوياً عند تقديم الوثائق: من فقد أهليته تتوقف حصته من أول السنة التالية وتعود حصته لخزانة التقاعد ولا تُوزَّع على الباقين.');
    } else { R.errors.push('نوع الحالة غير معروف'); return R; }
    R.label = label;
    R.basis = basis;
    if (!parseDate(startISO)) { R.errors.push('تاريخ بدء صرف المعاش غير صحيح أو غير مدخل.'); return R; }
    R.startDate = startISO;

    // القيمة الحالية (عند آخر شهر في الحساب)
    var um = /^(\d{4})-(\d{1,2})$/.exec(c.untilMonth || '');
    var refDate = um ? toISO(endOfMonth(+um[1], +um[2])) : startISO;
    R.refDate = refDate;
    var Pnow = valueAt(s.pensionTable, refDate).value;
    var Pstart = valueAt(s.pensionTable, startISO).value;
    R.Pnow = Pnow; R.Pstart = Pstart;
    R.baseNow = baseFn(Pnow);
    R.baseStart = baseFn(Pstart);

    if (c.type === 'heirs') {
      var untilY = parseDate(refDate).y;
      var sh = pensionShares(c.heirs, startISO, s, untilY);
      R.shares = sh;
      if (!sh.heirShares) R.warnings.push('لا يوجد ورثة مستحقون لمعاش الورثة حسب البيانات المدخلة.');
      var yearCache = {};
      var heirsInYear = function (year) {
        if (!yearCache[year]) {
          var ok = {};
          sh.list.forEach(function (x) { ok[x.idx] = x.eligible && heirYearEligible(x.heir, year, startISO).ok; });
          yearCache[year] = ok;
        }
        return yearCache[year];
      };
      var distAt = function (amount, year) {
        var d = distribute(amount, sh), ok = heirsInYear(year), per = {}, forfeit = 0;
        for (var k in d.perHeir) { if (ok[k]) per[k] = d.perHeir[k]; else { per[k] = 0; forfeit += d.perHeir[k]; } }
        d.perHeir = per; d.forfeit = forfeit; d.treasury += forfeit;
        // لقطة واحدة: مبلغ كل مجموعة بعد التوقف، والحصص المتوقفة تظهر في الخزانة فقط
        d.perGroup.forEach(function (g) {
          g.stopped = g.idx.filter(function (k) { return !ok[k]; }).length;
          g.amount = g.idx.reduce(function (a, k) { return a + per[k]; }, 0);
        });
        return d;
      };
      R.distNow = distAt(R.baseNow.amount, untilY);
      R.distStart = distAt(R.baseStart.amount, parseDate(startISO).y);
      R.schedule = buildSchedule(startISO, c.untilMonth, s, function (P, d) {
        var dd = distAt(baseFn(P).amount, d.y);
        return { total: sumObj(dd.perHeir), perHeir: dd.perHeir };
      });
    } else {
      R.schedule = buildSchedule(startISO, c.untilMonth, s, function (P) { return { total: baseFn(P).amount }; });
    }
    if (R.schedule.error) R.errors.push(R.schedule.error);

    // المعونات
    if (c.includeAid) {
      if (c.type === 'heirs') R.deathAid = deathAid(c, svc, s);
      else R.retirementAid = retirementAid(c, svc, s);
    }
    return R;
  }

  // ---------------------------------------------------------------- تفقيط المبالغ
  var ONES = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
  var TENS = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  var HUNDS = ['', 'مئة', 'مئتان', 'ثلاثمئة', 'أربعمئة', 'خمسمئة', 'ستمئة', 'سبعمئة', 'ثمانمئة', 'تسعمئة'];
  function below1000(n) {
    var h = Math.floor(n / 100), r = n % 100, parts = [];
    if (h) parts.push(HUNDS[h]);
    if (r) {
      if (r < 20) parts.push(ONES[r]);
      else { var o = r % 10, t = Math.floor(r / 10); parts.push(o ? ONES[o] + ' و' + TENS[t] : TENS[t]); }
    }
    return parts.join(' و');
  }
  function scale(n, one, two, plural, single) {
    if (n === 0) return '';
    if (n === 1) return one;
    if (n === 2) return two;
    if (n >= 3 && n <= 10) return below1000(n) + ' ' + plural;
    var r = n % 100;
    return below1000(n).replace(/مئتان$/, 'مئتا') + ' ' + single + (r >= 11 ? 'اً' : '');
  }
  function tafqit(n) {
    n = Math.floor(Math.abs(+n || 0));
    if (n === 0) return 'صفر';
    var b = Math.floor(n / 1e9), mi = Math.floor((n % 1e9) / 1e6), th = Math.floor((n % 1e6) / 1000), r = n % 1000, parts = [];
    if (b) parts.push(scale(b, 'مليار', 'ملياران', 'مليارات', 'مليار'));
    if (mi) parts.push(scale(mi, 'مليون', 'مليونان', 'ملايين', 'مليون'));
    if (th) parts.push(scale(th, 'ألف', 'ألفان', 'آلاف', 'ألف'));
    if (r) parts.push(below1000(r));
    return parts.join(' و');
  }
  function amountWords(n) { return tafqit(n) + ' ليرة سورية'; }

  return {
    DEFAULTS: DEFAULTS, REL: REL,
    settingsWith: settingsWith, parseDate: parseDate, toISO: toISO, fmtDate: fmtDate, fmt: fmt, fmtYMD: fmtYMD,
    ageAt: ageAt, valueAt: valueAt, diffYMD: diffYMD, spanInclusive: spanInclusive,
    computeService: computeService, adoptYears: adoptYears,
    ordinaryPension: ordinaryPension, bracketPension: bracketPension, prorate: prorate,
    heirPensionEligibility: heirPensionEligibility, heirEligibleAt: heirEligibleAt, heirYearEligible: heirYearEligible, addMonths: addMonths, addYears: addYears, pensionShares: pensionShares, distribute: distribute,
    buildSchedule: buildSchedule, retirementAid: retirementAid, deathAid: deathAid,
    computeCase: computeCase, tafqit: tafqit, amountWords: amountWords
  };
});
