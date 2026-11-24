/* =========================================================
   «تعلّم» جداول الرسوم من ملف Excel
   ---------------------------------------------------------
   يفهم القالب الذي ينزّله البرنامج، ويفهم الملفات المشابهة (مثل fees_2026.xlsx):
   - ورقة فيها عمود «العمر» = جدول انتساب حسب العمر. إن كان في اسمها أو عنوانها «فرع» فهي للفروع،
     وإلا فهي مركزية. السنة من اسم الورقة أو من أسطرها الأولى.
   - ورقة فيها عمود «السنة» = الرسم السنوي (مركزية حتى 45 / فوق 45 / الفرع).
   - ورقة فيها عمود «البند» أو «المفتاح» و«المبلغ» = الرسوم الثابتة (إعادة القيد والنقل والأستذة).
   الأعمدة تُعرف من أسمائها لا من ترتيبها، و«المجموع» إن وُجد يُستعمل للتحقق فقط.
   لا يحفظ شيئاً: يُرجع «اقتراحاً» يعرضه البرنامج للمعاينة، ولا يُعتمد إلا بموافقة المستخدم.
   يعمل في المتصفح (window.FeesLearn) وفي Node للاختبار.
   ========================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./fees.js'));
  else root.FeesLearn = factory(root.FeesCalc);
})(typeof self !== 'undefined' ? self : this, function (F) {
  'use strict';

  function norm(s) {
    return String(s === null || s === undefined ? '' : s).trim().replace(/[ً-ْـ]/g, '')
      .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[٠-٩]/g, function (c) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(c); })
      .replace(/\s+/g, ' ');
  }
  /* رقم من خلية: يقبل الأرقام العربية والفواصل، و«—» أو الفارغ = صفر، والنص الآخر = null */
  function cellNum(v) {
    if (typeof v === 'number') return isFinite(v) ? v : null;
    const t = norm(v).replace(/[,،٬\s]/g, '');
    if (t === '' || /^[-—–]+$/.test(t)) return 0;
    return /^\d+(\.\d+)?$/.test(t) ? +t : null;
  }
  function yearIn(s) { const m = /(20\d{2})/.exec(norm(s)); return m ? +m[1] : null; }

  /* قواعد التعرف على الأعمدة (بالترتيب: الأدق أولاً) */
  const CENTRAL_RULES = [['total', /مجموع/], ['exam', /امتحان/], ['death', /وفاه/], ['annual', /سنوي/], ['practice', /دفتر|ممارسه/],
    ['pension', /تقاعد/], ['union', /نقابه/], ['id', /هويه/], ['badge', /شاره/], ['prints', /مطبوعات/]];
  const BRANCH_RULES = [['total', /مجموع/], ['training', /تمرين/], ['annual', /سنوي/], ['reg', /قيد/], ['ambulance', /اسعاف/],
    ['coop', /تعاون/], ['takaful', /تكافل/], ['file', /اضباره|روب/], ['prints', /مطبوعات|مفكره/]];
  function mapCols(header, rules) {
    const m = {};
    header.forEach(function (h, i) {
      const t = norm(h); if (!t || /^العمر$/.test(t)) return;
      for (let r = 0; r < rules.length; r++) if (rules[r][1].test(t) && !(rules[r][0] in m)) { m[rules[r][0]] = i; break; }
    });
    return m;
  }
  function findHeader(rows, re) {
    for (let r = 0; r < Math.min(rows.length, 15); r++) {
      const row = rows[r] || [];
      for (let c = 0; c < row.length; c++) if (re.test(norm(row[c]))) return { row: r, col: c };
    }
    return null;
  }

  function learn(wb, opts) {
    opts = opts || {};
    const D = F.dataWith(opts.data || null);
    const P = { central: {}, branch: {}, annual: {}, over45: {}, branchAnnual: {}, fixed: {}, notes: [], problems: [], sheets: [] };
    (wb.sheets || []).forEach(function (sh) {
      const rows = sh.rows || [], title = rows.slice(0, 3).map(function (r) { return (r || []).join(' '); }).join(' ');
      const ageH = findHeader(rows, /^العمر$/), yearH = findHeader(rows, /^السنه$/), itemH = findHeader(rows, /^(البند|المفتاح)$/);
      if (ageH) return ageSheet(sh, rows, ageH, title);
      if (yearH) return annualSheet(sh, rows, yearH);
      if (itemH) return fixedSheet(sh, rows, itemH);
      P.sheets.push({ name: sh.name, kind: 'ignored', note: 'لم أجد فيها عمود «العمر» أو «السنة» أو «البند»، فتجاهلتها.' });
    });

    function ageSheet(sh, rows, h, title) {
      const isBranch = /فرع|فروع/.test(norm(sh.name + ' ' + title));
      const fund = isBranch ? 'branch' : 'central', cols = isBranch ? F.BCOLS : F.COLS;
      const year = yearIn(sh.name) || yearIn(title);
      const label = (isBranch ? 'جدول الفروع' : 'الجدول المركزي') + ' (ورقة «' + sh.name + '»)';
      if (!year) { P.problems.push(label + ': لم أعرف السنة. اكتبها في اسم الورقة (مثل «' + (isBranch ? 'فرع ' : 'مركزية ') + '2027»).'); P.sheets.push({ name: sh.name, kind: 'ignored', note: 'بلا سنة' }); return; }
      const m = mapCols(rows[h.row], isBranch ? BRANCH_RULES : CENTRAL_RULES);
      const latestY = (isBranch ? D.BRANCH_YEARS : D.TABLE_YEARS).filter(function (y) { return y !== year; });
      const base = (isBranch ? D.BRANCH_TABLES : D.TABLES)[year] || (isBranch ? D.BRANCH_TABLES : D.TABLES)[latestY[latestY.length - 1]];
      const missing = cols.filter(function (c) { return !(c[0] in m) && !(c[0] === 'exam' || c[0] === 'death'); });
      const t = { from: (base && base.from && (isBranch ? D.BRANCH_TABLES : D.TABLES)[year] ? base.from : year + '-01-01'), rows: {} };
      const seen = {}, bad = [], sumBad = [];
      for (let r = h.row + 1; r < rows.length; r++) {
        const row = rows[r] || [], age = cellNum(row[h.col]);
        if (age === null || age < 30 || age > 50 || age % 1) continue;
        const o = {};
        let s = 0;
        cols.forEach(function (c) {
          let v;
          if (c[0] in m) { v = cellNum(row[m[c[0]]]); if (v === null) { bad.push(age + ': ' + c[1]); v = base ? base.rows[age][c[0]] : 0; } }
          else v = c[0] === 'exam' || (c[0] === 'death' && age > 45) ? 0 : (base ? base.rows[age][c[0]] : 0);
          if (!isBranch && c[0] === 'death' && age > 45) v = 0;
          o[c[0]] = v; s += v;
        });
        if ('total' in m) {
          const tv = cellNum(row[m.total]);
          /* المجموع في جدول الفرع لا يشمل «مطبوعات + مفكرة» (متغيرة) */
          if (tv !== null && tv !== 0 && tv !== s) sumBad.push('عمر ' + age + ': المجموع في الملف ' + F.fmt(tv) + ' والمحسوب ' + F.fmt(s));
        }
        t.rows[age] = o; seen[age] = 1;
      }
      const lack = F.AGES.filter(function (a) { return !seen[a]; });
      if (lack.length) { P.problems.push(label + ': تنقصه أعمار: ' + lack.join('، ') + '. لم يُعتمد.'); P.sheets.push({ name: sh.name, kind: 'ignored', note: 'أعمار ناقصة' }); return; }
      if (missing.length) P.notes.push(label + ': لم أجد عمود ' + missing.map(function (c) { return '«' + c[1] + '»'; }).join(' و') + '، فأخذت قيمه من ' + (base ? 'الجدول الحالي' : 'صفر') + '.');
      if (bad.length) P.problems.push(label + ': خانات غير رقمية أُخذت من الجدول الحالي: ' + bad.slice(0, 6).join('، ') + (bad.length > 6 ? '…' : ''));
      if (sumBad.length) P.problems.push(label + ': المجموع لا يطابق البنود في ' + sumBad.length + ' سطراً (' + sumBad.slice(0, 3).join('؛ ') + (sumBad.length > 3 ? '…' : '') + ').');
      else if ('total' in m) P.notes.push(label + ': كل المجاميع مطابقة للبنود ✓');
      P[fund][year] = t;
      P.sheets.push({ name: sh.name, kind: fund, year: year });
    }

    function annualSheet(sh, rows, h) {
      const header = rows[h.row];
      let cC = -1, cO = -1, cB = -1;
      header.forEach(function (x, i) {
        const t = norm(x); if (i === h.col || !t) return;
        if (/فوق ?45/.test(t)) cO = i;
        else if (/فرع/.test(t)) cB = i;
        else if (cC < 0 && /رسم|سنوي|مركزي|حتي ?45/.test(t)) cC = i;
      });
      let n = 0;
      for (let r = h.row + 1; r < rows.length; r++) {
        const row = rows[r] || [], y = cellNum(row[h.col]);
        if (!y || y < 1990 || y > 2100) continue;
        const put = function (key, col) { if (col < 0) return; const v = cellNum(row[col]); if (v !== null && !(v === 0 && (row[col] === null || row[col] === undefined || row[col] === ''))) P[key][y] = v; };
        put('annual', cC); put('over45', cO); put('branchAnnual', cB); n++;
      }
      P.sheets.push({ name: sh.name, kind: 'annual', count: n });
    }

    function fixedSheet(sh, rows, h) {
      const header = rows[h.row];
      let cKey = -1, cLabel = -1, cVal = -1;
      header.forEach(function (x, i) { const t = norm(x); if (/^المفتاح$/.test(t)) cKey = i; else if (/^البند$/.test(t)) cLabel = i; else if (/مبلغ|قيمه/.test(t)) cVal = i; });
      if (cVal < 0) { P.problems.push('ورقة «' + sh.name + '»: لم أجد عمود «المبلغ».'); return; }
      const byLabel = {}; F.FIXED_FIELDS.forEach(function (f) { byLabel[norm(f[1])] = f[0]; });
      const unknown = [];
      for (let r = h.row + 1; r < rows.length; r++) {
        const row = rows[r] || [];
        const key = cKey >= 0 && row[cKey] ? String(row[cKey]).trim() : (cLabel >= 0 ? byLabel[norm(row[cLabel])] : null);
        const v = cellNum(row[cVal]);
        if (!key && !(cLabel >= 0 && row[cLabel])) continue;
        if (!key || !F.FIXED_FIELDS.some(function (f) { return f[0] === key; })) { unknown.push(String(row[cLabel] || row[cKey])); continue; }
        if (v === null) { P.problems.push('«' + row[cLabel] + '»: المبلغ ليس رقماً.'); continue; }
        P.fixed[key] = v;
      }
      if (unknown.length) P.problems.push('بنود لم أتعرف عليها في «' + sh.name + '» وتجاهلتها: ' + unknown.slice(0, 5).join('، ') + (unknown.length > 5 ? '…' : '') + '. استعمل أسماء القالب.');
      P.sheets.push({ name: sh.name, kind: 'fixed' });
    }

    /* الفرق عن البيانات الحالية (للمعاينة) */
    P.changes = [];
    const fmtv = function (v) { return v === undefined ? '—' : F.fmt(v); };
    Object.keys(P.central).forEach(function (y) { P.changes.push((D.TABLES[y] ? 'تحديث' : 'إضافة') + ' الجدول المركزي ' + y + (D.TABLES[y] && JSON.stringify(D.TABLES[y].rows) === JSON.stringify(P.central[y].rows) ? ' (مطابق للحالي، لا تغيير)' : '')); });
    Object.keys(P.branch).forEach(function (y) { P.changes.push((D.BRANCH_TABLES[y] ? 'تحديث' : 'إضافة') + ' جدول الفروع ' + y + (D.BRANCH_TABLES[y] && JSON.stringify(D.BRANCH_TABLES[y].rows) === JSON.stringify(P.branch[y].rows) ? ' (مطابق للحالي، لا تغيير)' : '')); });
    [['annual', 'ANNUAL', 'الرسم السنوي المركزي'], ['over45', 'ANNUAL_OVER45', 'رسم فوق 45'], ['branchAnnual', 'BRANCH_ANNUAL', 'رسم الفرع السنوي']].forEach(function (k) {
      Object.keys(P[k[0]]).forEach(function (y) { if (D[k[1]][y] !== P[k[0]][y]) P.changes.push(k[2] + ' ' + y + ': ' + fmtv(D[k[1]][y]) + ' ← ' + F.fmt(P[k[0]][y])); });
    });
    F.FIXED_FIELDS.forEach(function (f) { if (f[0] in P.fixed && P.fixed[f[0]] !== D.flat[f[0]]) P.changes.push(f[1] + ': ' + F.fmt(D.flat[f[0]]) + ' ← ' + F.fmt(P.fixed[f[0]])); });
    P.empty = !Object.keys(P.central).length && !Object.keys(P.branch).length && !Object.keys(P.annual).length && !Object.keys(P.over45).length && !Object.keys(P.branchAnnual).length && !Object.keys(P.fixed).length;
    return P;
  }

  /* القالب: الجداول الحالية لسنة جديدة (للتعديل)، والرسم السنوي، والرسوم الثابتة */
  function template(opts) {
    opts = opts || {};
    const D = F.dataWith(opts.data || null);
    const lastC = D.TABLE_YEARS[D.TABLE_YEARS.length - 1], lastB = D.BRANCH_YEARS[D.BRANCH_YEARS.length - 1];
    const year = opts.year || Math.max(lastC, lastB, D.LAST) + 1;
    function ageSheet(name, title, cols, T) {
      const rows = [[title], ['انسخ قيم السنة الجديدة فوق هذه القيم (منسوخة من آخر جدول). لا تغيّر أسماء الأعمدة ولا عمود العمر.'], [],
        ['العمر'].concat(cols.map(function (c) { return c[1]; })).concat(['المجموع'])];
      F.AGES.forEach(function (a) { let s = 0; const r = [a]; cols.forEach(function (c) { r.push(T.rows[a][c[0]]); s += T.rows[a][c[0]]; }); r.push(s); rows.push(r); });
      return { name: name, rows: rows, headerRows: [0, 3], widths: [8].concat(cols.map(function () { return 16; })).concat([12]) };
    }
    const ys = {}; Object.keys(D.ANNUAL).concat(Object.keys(D.BRANCH_ANNUAL)).forEach(function (y) { ys[y] = 1; }); ys[year] = 1;
    const annual = [['الرسم السنوي لكل سنة'], ['فارغ = لا رسم. «فوق 45» فارغ = مثل «حتى 45».'], [], ['السنة', 'مركزية حتى 45', 'مركزية فوق 45', 'الفرع']];
    Object.keys(ys).map(Number).sort(function (a, b) { return a - b; }).forEach(function (y) {
      annual.push([y, y in D.ANNUAL ? D.ANNUAL[y] : (y === year ? D.ANNUAL[D.LAST] : ''), y in D.ANNUAL_OVER45 ? D.ANNUAL_OVER45[y] : (y === year && D.LAST in D.ANNUAL_OVER45 ? D.ANNUAL_OVER45[D.LAST] : ''),
        y in D.BRANCH_ANNUAL ? D.BRANCH_ANNUAL[y] : (y === year && D.BRANCH_LAST ? D.BRANCH_ANNUAL[D.BRANCH_LAST] : '')]);
    });
    const fixed = [['الرسوم الثابتة (إعادة القيد والنقل والأستذة) — مركزية وفرع'], ['عدّل عمود «المبلغ» فقط.'], [], ['المفتاح', 'البند', 'المبلغ']];
    F.FIXED_FIELDS.forEach(function (f) { fixed.push([f[0], f[1], D.flat[f[0]]]); });
    return {
      year: year,
      sheets: [
        ageSheet('مركزية ' + year, 'جدول رسوم الانتساب المركزي حسب العمر — ' + year, F.COLS, D.TABLES[lastC]),
        ageSheet('فرع ' + year, 'جدول رسوم الانتساب للفروع حسب العمر — ' + year, F.BCOLS, D.BRANCH_TABLES[lastB]),
        { name: 'الرسم السنوي', rows: annual, headerRows: [0, 3], widths: [10, 16, 16, 12] },
        { name: 'الرسوم الثابتة', rows: fixed, headerRows: [0, 3], widths: [14, 48, 12] }
      ]
    };
  }

  /* اعتماد الاقتراح: يدمجه فوق البيانات الحالية ويُرجع إعدادات «الفرق عن المعتمد» الجديدة */
  function apply(P, data) {
    const D = F.dataWith(data || null), DEF = F.DEFAULTS;
    const cp = function (o) { return JSON.parse(JSON.stringify(o)); };
    const full = { annual: cp(D.ANNUAL), over45: cp(D.ANNUAL_OVER45), tables: cp(D.TABLES), branchTables: cp(D.BRANCH_TABLES), branchAnnual: cp(D.BRANCH_ANNUAL), fixed: cp(D.flat) };
    Object.assign(full.tables, P.central); Object.assign(full.branchTables, P.branch);
    Object.assign(full.annual, P.annual); Object.assign(full.over45, P.over45); Object.assign(full.branchAnnual, P.branchAnnual); Object.assign(full.fixed, P.fixed);
    return diff(full, DEF);
  }
  function diff(full, DEF) {
    const out = {};
    const keys = function (a, b) { const k = {}; Object.keys(a).concat(Object.keys(b)).forEach(function (x) { k[x] = 1; }); return Object.keys(k); };
    [['annual', 'ANNUAL'], ['over45', 'ANNUAL_OVER45'], ['branchAnnual', 'BRANCH_ANNUAL'], ['tables', 'TABLES'], ['branchTables', 'BRANCH_TABLES']].forEach(function (p) {
      const o = {};
      keys(DEF[p[1]], full[p[0]]).forEach(function (y) {
        if (!(y in full[p[0]])) o[y] = null;
        else if (JSON.stringify(full[p[0]][y]) !== JSON.stringify(DEF[p[1]][y])) o[y] = full[p[0]][y];
      });
      if (Object.keys(o).length) out[p[0]] = o;
    });
    const fx = {}; Object.keys(full.fixed).forEach(function (k) { if (full.fixed[k] !== DEF.flat[k]) fx[k] = full.fixed[k]; });
    if (Object.keys(fx).length) out.fixed = fx;
    return Object.keys(out).length ? out : null;
  }

  return { learn: learn, template: template, apply: apply, diff: diff, norm: norm };
});
