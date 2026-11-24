/* توليد التقرير المفصل القابل للطباعة والحفظ في الإضبارة */
(function (root) {
  'use strict';
  var C = root.PensionCalc;

  var REPORT_CSS = [
    '.rpt{background:#fff;color:#111;font-family:"Readex Pro","IBM Plex Sans Arabic","Segoe UI",Tahoma,sans-serif;font-size:14.5px;line-height:1.75;max-width:900px;margin:0 auto;padding:28px 34px;border:1px solid #ddd;direction:rtl;text-align:right}',
    '.rpt *{box-sizing:border-box}',
    '.rpt-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:3px double #1f2318;padding-bottom:12px;margin-bottom:16px}',
    '.rpt-head .org{font-weight:700;color:#1f2318;font-size:15px}',
    '.rpt-head h1{margin:6px 0 2px;font-size:22px;color:#1f2318;font-family:"Readex Pro","IBM Plex Sans Arabic",sans-serif}',
    '.rpt-head .meta{font-size:13px;color:#444;text-align:left;white-space:nowrap}',
    '.rpt h2{font-family:"Readex Pro","IBM Plex Sans Arabic",sans-serif;font-size:16.5px;color:#fff;background:#1f2318;padding:5px 12px;border-radius:6px;margin:22px 0 10px;break-after:avoid}',
    '.rpt h3{font-family:"Readex Pro","IBM Plex Sans Arabic",sans-serif;font-size:15px;color:#1f2318;margin:14px 0 6px}',
    '.rpt table{width:100%;border-collapse:collapse;margin:6px 0 10px;break-inside:auto}',
    '.rpt th,.rpt td{white-space:normal;color:#111;background:#fff;border:1px solid #bbb;padding:5px 8px;vertical-align:top;text-align:right}',
    '.rpt th{background:#eef1df;color:#1f2318;font-family:"Readex Pro","IBM Plex Sans Arabic",sans-serif;font-size:13px}',
    '.rpt tr{break-inside:avoid}',
    '.rpt tbody tr:nth-child(even) td{background:#fff}.rpt h1,.rpt h2,.rpt h3{line-height:1.5}',
    '.rpt td.n,.rpt th.n{text-align:left;direction:ltr;white-space:nowrap;font-variant-numeric:tabular-nums}',
    '.rpt .rkv td:first-child{width:32%;background:#f5f3e9;font-weight:700}',
    '.rpt .sum{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin:8px 0}',
    '.rpt .box{border:2px solid #1f2318;border-radius:10px;padding:10px 12px;break-inside:avoid}',
    '.rpt .box .l{font-size:13px;color:#333;font-weight:700}',
    '.rpt .box .v{font-size:22px;font-weight:800;color:#1f2318;font-family:"Readex Pro","IBM Plex Sans Arabic",sans-serif}',
    '.rpt .box .w{font-size:12.5px;color:#444}',
    '.rpt .box.gold{border-color:#ad7012}.rpt .box.gold .v{color:#865409}',
    '.rpt ol.steps{margin:4px 0 8px;padding-right:22px}.rpt ol.steps li{margin:3px 0}',
    '.rpt .formula{background:#f5f3e9;border-right:4px solid #ad7012;padding:8px 12px;margin:8px 0;border-radius:4px}',
    '.rpt .note{background:#fff7e0;border:1px solid #e8d49a;padding:8px 12px;border-radius:6px;margin:6px 0}',
    '.rpt .warn{background:#fdecea;border:1px solid #f0b8b3;padding:8px 12px;border-radius:6px;margin:6px 0}',
    '.rpt .yes{color:#1d7a46;font-weight:700}.rpt .no{color:#b3261e;font-weight:700}',
    '.rpt .total td{font-weight:800;background:#eef1df}',
    '.rpt .sign{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:30px;text-align:center;break-inside:avoid}',
    '.rpt .sign div{border-top:1px solid #333;padding-top:6px;min-height:70px}',
    '.rpt .foot{margin-top:20px;font-size:12px;color:#555;border-top:1px solid #ccc;padding-top:8px}',
    '.rpt dl.gl{margin:0}.rpt dl.gl dt{font-weight:700;color:#1f2318}.rpt dl.gl dd{margin:0 0 6px 0;padding-right:14px}',
    '@media (max-width:640px){.rpt{padding:16px 12px}.rpt-head{flex-direction:column}.rpt-head .meta{text-align:right}.rpt .sign{grid-template-columns:1fr}}',
    '@media print{@page{size:A4;margin:14mm 12mm}.rpt{border:0;padding:0;max-width:none;font-size:13px}.rpt h2{-webkit-print-color-adjust:exact;print-color-adjust:exact}.rpt th,.rpt .box,.rpt .formula,.rpt .note,.rpt .warn,.rpt .rkv td:first-child,.rpt .total td{-webkit-print-color-adjust:exact;print-color-adjust:exact}}'
  ].join('\n');

  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var f = C.fmt, d = C.fmtDate;
  function money(n) { return '<span dir="ltr">' + f(n) + '</span> ل.س'; }
  function li(arr) { return '<ol class="steps">' + arr.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>'; }
  function kv(rows) { return '<table class="rkv">' + rows.filter(function (r) { return r[1] !== '' && r[1] !== undefined && r[1] !== null; }).map(function (r) { return '<tr><td>' + esc(r[0]) + '</td><td>' + (r[2] ? r[1] : esc(r[1])) + '</td></tr>'; }).join('') + '</table>'; }
  function box(label, value, words, cls) { return '<div class="box ' + (cls || '') + '"><div class="l">' + esc(label) + '</div><div class="v">' + f(value) + ' <small>ل.س</small></div><div class="w">' + esc(C.amountWords(value)) + ' فقط لا غير</div></div>'; }
  function ym(iso) { var p = C.parseDate(iso); return p ? p.m + '/' + p.y : ''; }
  function monthsTxt(n) { return n === 1 ? 'شهر واحد' : n === 2 ? 'شهران' : n <= 10 ? n + ' أشهر' : n + ' شهراً'; }

  var TYPE_LABEL = { ordinary: 'تقاعد عادي', health: 'تقاعد صحي', heirs: 'معاش الورثة' };

  function render(c, R, meta) {
    meta = meta || {};
    var S = R.settings, h = [];
    var today = new Date();
    var todayISO = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
    var heirs = c.heirs || [];
    var eligible = R.shares ? R.shares.list.filter(function (x) { return x.eligible; }) : [];

    h.push('<article class="rpt">');
    // ---------- الرأس
    h.push('<header class="rpt-head"><div><div class="org">' + esc(meta.org || 'خزانة تقاعد المحامين') + '</div>' +
      '<h1>تقرير حساب الراتب التقاعدي</h1><div>' + esc(R.label) + '</div></div>' +
      '<div class="meta">تاريخ التقرير: ' + d(todayISO) + '<br>رقم الإضبارة: ' + esc(c.fileNo || '—') + '<br>الفرع: ' + esc(c.branch || '—') + '</div></header>');

    // ---------- 1. بيانات المحامي
    h.push('<h2>أولاً: بيانات المحامي</h2>');
    var age = C.ageAt(c.birthDate, c.type === 'heirs' ? c.deathDate : c.retirementDate || c.medicalDate);
    h.push(kv([
      ['الاسم الكامل', c.name], ['اسم الأب', c.fatherName], ['اسم الأم', c.motherName],
      ['تاريخ ومكان الميلاد', [c.birthDate ? d(c.birthDate) : '', c.birthPlace].filter(Boolean).join(' – ')],
      ['الرقم الوطني', c.nationalId], ['رقم العضوية', c.memberNo], ['الفرع', c.branch], ['رقم الإضبارة', c.fileNo],
      ['الهاتف', c.phone], ['العنوان', c.address],
      ['تاريخ الانتساب للنقابة', c.joinDate ? d(c.joinDate) + (C.parseDate(c.joinDate) && c.joinDate < S.cutoffDate ? ' (قبل ' + d(S.cutoffDate) + ')' : ' (بعد ' + d(S.cutoffDate) + ')') : ''],
      ['نوع الحالة', R.label],
      ['تاريخ الإحالة على التقاعد', (c.type !== 'heirs' || c.status === 'retired') && c.retirementDate ? d(c.retirementDate) : ''],
      ['تاريخ الخبرة الطبية', c.type === 'health' ? d(c.medicalDate) : ''],
      ['تاريخ الوفاة', c.type === 'heirs' ? d(c.deathDate) : ''],
      [c.type === 'heirs' ? 'العمر عند الوفاة' : 'العمر عند الإحالة', age !== null ? age + ' سنة' : '']
    ]));

    // ---------- 2. الخلاصة
    h.push('<h2>ثانياً: خلاصة النتيجة</h2>');
    h.push('<div class="sum">');
    if (c.type === 'heirs') {
      var monthlyHeirs = R.distNow ? Object.keys(R.distNow.perHeir).reduce(function (a, k) { return a + R.distNow.perHeir[k]; }, 0) : 0;
      h.push(box('مجموع المعاش الشهري للورثة المستحقين (بقيمة ' + ym(R.refDate) + ')', monthlyHeirs));
    } else {
      h.push(box('الراتب التقاعدي الشهري (بقيمة ' + ym(R.refDate) + ')', R.baseNow.amount));
    }
    if (R.schedule && R.schedule.periods.length) h.push(box('مجموع المستحقات من ' + d(R.startDate) + ' حتى ' + d(R.schedule.periods[R.schedule.periods.length - 1].to), R.schedule.total, null, 'gold'));
    if (R.retirementAid) h.push(box(R.retirementAid.full ? 'معونة التقاعد المصروفة الآن (نصف المعونة)' : 'معونة التقاعد المستحقة', R.retirementAid.amount, null, 'gold'));
    if (R.deathAid) h.push(box('معونة الوفاة المستحقة للورثة', R.deathAid.amount, null, 'gold'));
    h.push('</div>');
    var simple = [];
    var usesYears = c.type === 'ordinary' || (c.type === 'heirs' && c.status === 'retired' && c.originalType !== 'health');
    simple.push(usesYears ? 'سنوات الممارسة المعتمدة: ' + R.years.years + ' سنة (المدة الصافية ' + C.fmtYMD(R.service.net) + ').' : 'مدة الممارسة الصافية: ' + C.fmtYMD(R.service.net) + '.');
    simple.push('نوع المعاش: ' + R.baseNow.category + '.');
    simple.push('يبدأ صرف المعاش اعتباراً من: ' + d(R.startDate) + '.');
    h.push('<div class="note"><b>بكلمات بسيطة:</b> ' + esc(simple.join(' ')) + '</div>');

    // ---------- 3. مدة الممارسة
    h.push('<h2>ثالثاً: كيف حُسبت مدة الممارسة</h2>');
    h.push('<p>مدة الممارسة هي عدد السنوات التي مارس فيها المحامي المهنة فعلياً وهو مسجل في جدول النقابة. لا تُحسب منها المدد التي كان فيها مشطوباً أو مرقّن القيد أو مستبعداً من الجدول لعدم دفع الرسوم أو ممنوعاً من مزاولة المهنة، ولا السنوات التي لم تُثبت ممارسته عنها.</p>');
    if (!R.service.manual) {
      var sv = c.service;
      var rows = '<tr><th>البند</th><th>من</th><th>إلى</th><th>المدة</th></tr>';
      rows += '<tr><td>المدة الإجمالية من حلف اليمين</td><td>' + d(sv.start) + '</td><td>' + d(sv.end) + '</td><td>' + esc(C.fmtYMD(R.service.gross)) + '</td></tr>';
      R.service.exclusions.forEach(function (x) { rows += '<tr><td>يُطرح: ' + esc(x.reason) + '</td><td>' + d(x.from) + '</td><td>' + d(x.to) + '</td><td>− ' + esc(C.fmtYMD(x.span)) + '</td></tr>'; });
      rows += '<tr class="total"><td colspan="3">مدة الممارسة الصافية</td><td>' + esc(C.fmtYMD(R.service.net)) + '</td></tr>';
      h.push('<table>' + rows + '</table>');
    }
    h.push(li(usesYears ? R.service.steps.concat([R.years.text]) : R.service.steps));
    var bracketNote = S.bracketBoundary === 'upper'
      ? 'في شرائح التقاعد الصحي ومعاش الورثة يُعتمد بلوغ الحد نفسه: من بلغ 5 أو 10 أو 15 سنة ينتقل إلى الشريحة الأعلى.'
      : 'في شرائح التقاعد الصحي ومعاش الورثة تُقارن المدة كاملة بالسنوات والأشهر والأيام بحدود الشرائح: الحد نفسه يبقى في الشريحة الأدنى، وأي زيادة عليه ولو بيوم تنقل إلى الشريحة الأعلى.';
    h.push('<p class="note">طريقة الحساب: تُحسب المدد بالتقويم الفعلي (سنوات وأشهر وأيام) من تاريخ حلف اليمين، ويُطرح طول كل مدة مستبعدة كما هو في التقويم. ' + esc(usesYears ? modeText(S.pensionYearMode, 'التقاعد العادي') : bracketNote) + ' (قسمة الراتب على 30 تخص الشهر الجزئي في الصرف فقط.)</p>');

    // ---------- 4. القاعدة والمعادلة
    h.push('<h2>رابعاً: القاعدة المطبقة وطريقة حساب الراتب</h2>');
    h.push(li(R.basis));
    h.push('<h3>الحساب بالقيمة الحالية للراتب الكامل (' + money(R.Pnow) + ' – نافذة في ' + ym(R.refDate) + ')</h3>');
    h.push('<div class="formula">' + li(R.baseNow.steps) + '</div>');
    if (R.Pstart !== R.Pnow) {
      h.push('<h3>الحساب بقيمة الراتب الكامل عند بدء الصرف (' + money(R.Pstart) + ')</h3>');
      h.push('<p>قيمة الراتب الكامل ليست ثابتة، فقد تغيرت خلال فترة الحساب، لذلك يُحسب كل شهر بالقيمة النافذة فيه:</p>');
      h.push('<div class="formula">' + li(R.baseStart.steps) + '</div>');
    }

    // ---------- 5. الورثة
    var sec = 5;
    if (c.type === 'heirs') {
      h.push('<h2>' + ord(sec++) + ': الورثة المستحقون وتوزيع الحصص</h2>');
      h.push('<p>يُوزع المعاش بالحصص: <b>3 حصص</b> للزوجة أو الزوجات أو الزوج، <b>حصة واحدة</b> لكل ولد مستحق (ذكراً أو أنثى)، <b>حصة واحدة</b> للوالدين، <b>حصة واحدة</b> للأخوات مهما بلغ عددهن' + (S.treasuryShare ? '، و<b>حصة واحدة لخزانة التقاعد</b> دائماً مهما كان عدد الورثة' : '') + '.</p>');
      h.push('<p>تُقدَّر الأهلية عند بدء الصرف (' + d(R.startDate) + ')، ثم تُراجع في أول كل سنة عند تقديم الوثائق السنوية. من فقد أهليته (بلوغ الابن 18 سنة، أو 27 لمن يتابع دراسته، أو زواج البنت، أو حصولها على عمل…) <b>تتوقف حصته من أول السنة التالية وتعود لخزانة التقاعد</b>، ولا تُوزَّع على باقي الورثة، لأنها قد تُعاد له لاحقاً بطلب (مثل بنت تطلّقت أو ترمّلت وليس لها مورد).</p>');
      var t = '<tr><th>#</th><th>الاسم</th><th>الصلة</th><th>العمر عند بدء الصرف</th><th>يستحق؟</th><th>السبب</th><th>تتوقف حصته من</th></tr>';
      R.shares.list.forEach(function (x, i) {
        var a = C.ageAt(x.heir.birth, R.startDate);
        t += '<tr><td>' + (i + 1) + '</td><td>' + esc(x.heir.name || '—') + '</td><td>' + esc(C.REL[x.heir.relation] || '') + '</td><td>' + (a === null ? '—' : a) + '</td><td class="' + (x.eligible ? 'yes">نعم' : 'no">لا') + '</td><td>' + esc(x.reason) + '</td><td>' + (x.stopFrom ? d(x.stopFrom) + '<br><small>' + esc(x.stopReason) + '</small>' : (x.eligible ? 'مستمرة' : '—')) + '</td></tr>';
      });
      h.push('<table>' + t + '</table>');
      if (!R.shares.totalShares) h.push('<div class="warn">لا يوجد وارث مستحق لمعاش الورثة عند بدء الصرف، فلا يُوزَّع معاش ولا تُحسب حصص (ولا حصة للخزانة لأنها تُحسب مع حصص الورثة).</div>');
      if (R.shares.totalShares) {
        var D = R.distNow;
        h.push('<div class="formula"><ol class="steps">' +
          '<li>مجموع حصص الورثة = ' + R.shares.heirShares + (R.shares.treasury ? ' + حصة الخزانة 1 = ' + R.shares.totalShares : '') + ' ' + (R.shares.totalShares >= 3 && R.shares.totalShares <= 10 ? 'حصص' : 'حصة') + '.</li>' +
          '<li>قيمة الحصة الواحدة = المعاش ÷ عدد الحصص = ' + f(R.baseNow.amount) + ' ÷ ' + R.shares.totalShares + ' = ' + f(D.unit) + ' ل.س (يُهمل الكسر).</li>' +
          '<li>الجدول التالي بقيمة ' + d(R.refDate) + '.</li></ol></div>');
        var g = '<tr><th>الجهة</th><th class="n">عدد الحصص</th><th class="n">المبلغ الشهري</th><th>ملاحظة</th></tr>';
        D.perGroup.forEach(function (x) {
          var nt = [], active = x.count - (x.stopped || 0);
          if (x.stopped === x.count) nt.push('الحصة متوقفة وتعود للخزانة');
          else if (x.stopped) nt.push('يُصرف حالياً لـ ' + active + ' من ' + x.count + ': لكل واحد ' + f(x.each) + ' ل.س، وحصة ' + x.stopped + ' منهم (' + f(x.each * x.stopped) + ' ل.س) متوقفة وتعود للخزانة');
          else if (x.count > 1) nt.push('تقسم بالتساوي على ' + x.count + ': لكل واحد ' + f(x.each) + ' ل.س');
          g += '<tr><td>' + esc(x.label) + '</td><td class="n">' + x.shares + '</td><td class="n">' + f(x.amount) + '</td><td>' + nt.join('، ') + '</td></tr>';
        });
        if (R.shares.treasury) g += '<tr><td>خزانة التقاعد</td><td class="n">1</td><td class="n">' + f(D.treasury) + '</td><td>لا تُصرف للورثة' + (D.forfeit ? '، وتشمل ' + f(D.forfeit) + ' ل.س حصصاً متوقفة' : '') + '</td></tr>';
        h.push('<table>' + g + '</table>');
        var stopped = R.shares.list.filter(function (x) { return x.stopFrom; });
        if (stopped.length) h.push('<div class="note">' + stopped.map(function (x) { return 'حصة <b>' + esc(x.heir.name || C.REL[x.heir.relation]) + '</b> تتوقف اعتباراً من ' + d(x.stopFrom) + ' وتعود للخزانة.'; }).join('<br>') + ' الجدول أعلاه بقيمة ' + d(R.refDate) + ' بعد تطبيق ما توقف حتى ذلك التاريخ، وجدول المستحقات يطبّق التوقف شهراً بشهر.</div>');
      }
    }

    // ---------- 6. جدول المستحقات
    h.push('<h2>' + ord(sec++) + ': جدول المستحقات الشهرية</h2>');
    h.push('<p>يبدأ الحساب من ' + d(R.startDate) + '. إذا لم يبدأ الصرف في أول الشهر يُحسب الشهر الأول جزئياً: <b>المبلغ الشهري × عدد الأيام المتبقية من الشهر ÷ 30</b>. وتُجمع الأشهر المتتالية ذات المبلغ نفسه في سطر واحد.</p>');
    if (R.schedule && R.schedule.periods.length) {
      var heirIdx = eligible.map(function (x) { return x.idx; });
      var st = '<tr><th>من</th><th>إلى</th><th>المدة</th><th class="n">الراتب الكامل النافذ</th><th class="n">المبلغ الشهري</th><th>طريقة الحساب</th><th class="n">المجموع</th></tr>';
      R.schedule.periods.forEach(function (p) {
        var how = p.partial ? f(p.monthly) + ' × ' + p.days + ' ÷ 30' : p.months + ' × ' + f(p.monthly);
        if (p.partial && p.monthlyHeirs) how = heirIdx.map(function (k) { return esc(heirs[k].name || C.REL[heirs[k].relation]) + ': ' + f(p.monthlyHeirs[k]) + ' × ' + p.days + ' ÷ 30 = ' + f(p.amountHeirs[k]); }).join('<br>');
        else if (p.monthlyHeirs) how = heirIdx.map(function (k) { return esc(heirs[k].name || C.REL[heirs[k].relation]) + ': ' + p.months + ' × ' + f(p.monthlyHeirs[k]) + ' = ' + f(p.totalHeirs[k]); }).join('<br>');
        st += '<tr><td>' + d(p.from) + '</td><td>' + d(p.to) + '</td><td>' + (p.partial ? p.days + ' يوماً (شهر جزئي)' : monthsTxt(p.months)) + '</td><td class="n">' + f(p.P) + '</td><td class="n">' + f(p.monthly) + '</td><td>' + how + '</td><td class="n">' + f(p.total) + '</td></tr>';
      });
      st += '<tr class="total"><td colspan="6">المجموع الكلي للمستحقات</td><td class="n">' + f(R.schedule.total) + '</td></tr>';
      h.push('<div style="overflow-x:auto"><table>' + st + '</table></div>');
      h.push('<p>المجموع كتابةً: <b>' + esc(C.amountWords(R.schedule.total)) + ' فقط لا غير</b>.</p>');
      if (c.type === 'heirs' && heirIdx.length) {
        var pt = '<tr><th>الوارث</th><th>الصلة</th><th class="n">الحصة الشهرية الحالية</th><th class="n">مجموع مستحقاته</th></tr>', gt = 0;
        heirIdx.forEach(function (k) {
          var tot = R.schedule.periods.reduce(function (a, p) { return a + (p.totalHeirs ? p.totalHeirs[k] : 0); }, 0); gt += tot;
          pt += '<tr><td>' + esc(heirs[k].name || '—') + '</td><td>' + esc(C.REL[heirs[k].relation]) + '</td><td class="n">' + f(R.distNow.perHeir[k]) + '</td><td class="n">' + f(tot) + '</td></tr>';
        });
        pt += '<tr class="total"><td colspan="3">المجموع</td><td class="n">' + f(gt) + '</td></tr>';
        h.push('<h3>مستحقات كل وارث</h3><table>' + pt + '</table>');
      }
    }

    // ---------- 7. المعونة
    if (R.retirementAid || R.deathAid) {
      var A = R.retirementAid || R.deathAid;
      h.push('<h2>' + ord(sec++) + ': ' + (R.retirementAid ? 'معونة التقاعد' : 'معونة الوفاة للورثة') + '</h2>');
      h.push(li(A.steps));
      if (A.distribution && A.distribution.length) {
        var at = '<tr><th>المستحق</th><th>الأسماء</th><th class="n">قيمة الحصة</th><th class="n">لكل فرد</th></tr>';
        A.distribution.forEach(function (x) { at += '<tr><td>' + esc(x.label) + '</td><td>' + esc(x.names.join('، ')) + '</td><td class="n">' + f(x.amount) + '</td><td class="n">' + f(x.each) + '</td></tr>'; });
        h.push('<table>' + at + '</table>');
      }
      h.push('<p>المبلغ كتابةً: <b>' + esc(C.amountWords(A.amount)) + ' فقط لا غير</b>.</p>');
    }

    // ---------- 8. ملاحظات
    var notes = (R.warnings || []).slice();
    if (c.type === 'heirs' && heirs.some(function (x) { return x.relation === 'son' && x.student; })) notes.push('يجب إرفاق وثيقة دوام دراسي سنوية للأبناء الذين تجاوزوا 18 سنة ويتابعون دراستهم.');
    h.push('<h2>' + ord(sec++) + ': ملاحظات وتنبيهات</h2>');
    if (notes.length) h.push(notes.map(function (n) { return '<div class="warn">' + esc(n) + '</div>'; }).join(''));
    h.push('<div class="note">جميع المبالغ بالليرة السورية الجديدة، وتُهمل الكسور (يُقرّب لأسفل) في كل خطوة كما في أمثلة التعميم. مقدار الراتب التقاعدي غير ثابت وقد تطرأ عليه زيادات لاحقة.</div>');
    if (c.notes) h.push('<div class="note"><b>ملاحظات المنظم:</b> ' + esc(c.notes) + '</div>');

    // ---------- 9. الأساس القانوني
    h.push('<h2>' + ord(sec++) + ': الأساس القانوني</h2><ol class="steps">' +
      '<li>قانون تنظيم مهنة المحاماة رقم 30 لعام 2010 – المادة 21: لا تُحسب مدة الاستبعاد من الجدول (لعدم دفع الرسوم) في حساب التقاعد.</li>' +
      '<li>المادة 86/ج من القانون نفسه: لا تدخل فترة المنع من مزاولة المهنة في حساب مدة التقاعد؛ والمادة 86/هـ: لا يترتب على الشطب النهائي المساس بالحقوق التقاعدية المكتسبة.</li>' +
      '<li>تعميم "التقاعد العادي": المعاش الكامل عن 30 سنة، والجزئي بنسبة السنوات، والعلاوة عن السنوات الزائدة بسقف ' + S.maxYears + ' سنة.</li>' +
      '<li>تعميم "التقاعد الصحي": شرائح الربع والنصف وثلاثة الأرباع والكامل، والصرف من تاريخ الخبرة الطبية.</li>' +
      '<li>تعميم "معاش تقاعدي للورثة": المستحقون وطريقة توزيع الحصص وبدء الصرف من اليوم التالي للوفاة.</li>' +
      '<li>تعميما "معونة التقاعد والوفاة" و"معونة وفاة للورثة": نصف المعونة للمنتسبين قبل ' + d(S.cutoffDate) + '، والمعونة النسبية للمنتسبين بعده، وجدول قيم المعونة عبر السنوات.</li>' +
      '<li>رأي المختص في نقابة المحامين (19/11/2026): رفع المعونة إلى 200,000 من 1/7/2026؛ عدّ أيام الشهر الأول من اليوم التالي للوفاة؛ إهمال كسر السنة في التقاعد العادي؛ دخول حد الشريحة في الشريحة الأدنى؛ نصف المعونة النسبية عند التقاعد ونصفها للورثة بقيمة سنة الوفاة؛ حساب الممارسة من حلف اليمين مع 3 سنوات تمرين كحد أقصى؛ حصة دائمة للخزانة؛ وقف حصة من فقد أهليته من أول السنة التالية وعودتها للخزانة؛ وبدء الصرف من اكتساب قرار الإحالة الدرجة القطعية.</li></ol>');

    // ---------- 10. مصطلحات
    h.push('<h2>' + ord(sec++) + ': شرح مبسط للمصطلحات</h2><dl class="gl">' +
      '<dt>الراتب الكامل</dt><dd>المعاش الذي يأخذه المحامي إذا مارس المهنة 30 سنة كاملة، وقيمته الحالية ' + money(R.Pnow) + '.</dd>' +
      '<dt>المعاش الجزئي</dt><dd>إذا مارس أقل من 30 سنة يأخذ جزءاً من الراتب الكامل بنسبة سنواته؛ مثلاً 20 سنة = 20 من 30 جزءاً.</dd>' +
      '<dt>العلاوة</dt><dd>مبلغ إضافي فوق الراتب الكامل لمن مارس أكثر من 30 سنة، عن كل سنة زائدة جزء من 30 جزءاً، حتى ' + S.maxYears + ' سنة كحد أقصى.</dd>' +
      '<dt>الخبرة الطبية</dt><dd>تقرير اللجنة الطبية الصادر عن الفرع أو النقابة المركزية الذي يثبت عدم القدرة على العمل، ومن تاريخه يبدأ صرف التقاعد الصحي.</dd>' +
      '<dt>الحصة</dt><dd>جزء متساوٍ من المعاش يُقسم على الورثة؛ الزوجة تأخذ 3 حصص وكل ولد حصة واحدة.</dd>' +
      '<dt>الشهر الجزئي</dt><dd>إذا بدأ الاستحقاق في منتصف الشهر يُدفع عن الأيام المتبقية فقط: المبلغ × عدد الأيام ÷ 30.</dd>' +
      '<dt>المعونة</dt><dd>مبلغ يُدفع مرة واحدة فقط (ليس شهرياً) عند التقاعد أو للورثة عند الوفاة.</dd>' +
      '<dt>حلف اليمين</dt><dd>اليمين التي يؤديها المحامي عند تسجيله أول مرة، ومن تاريخها تبدأ مدة الممارسة.</dd>' +
      '<dt>الدرجة القطعية</dt><dd>يصبح قرار الإحالة نهائياً بعد مشاهدة مراقب الخزانة له وانقضاء مدة الطعن (شهر)، أو فوراً إذا أُسقط حق الطعن، ومن تاريخها يبدأ صرف الراتب.</dd>' +
      '<dt>الشطب / ترقين القيد / المنع</dt><dd>حالات يتوقف فيها المحامي عن ممارسة المهنة رسمياً، ولا تُحسب مدتها من سنوات الممارسة.</dd></dl>');

    // ---------- التوقيع
    h.push('<div class="sign"><div>منظم التقرير<br><b>' + esc(c.preparer || '') + '</b></div><div>المدقق<br><b>' + esc(c.reviewer || '') + '</b></div><div>يعتمد<br>رئيس الفرع / مدير الخزانة</div></div>');
    h.push('<div class="foot">أُعدّ هذا التقرير بواسطة حاسبة المحامي (قسم الراتب التقاعدي) بناءً على البيانات المدخلة والقيم المعتمدة في الإعدادات، ويُعتمد بعد تدقيق الوثائق الأصلية في إضبارة المحامي.</div>');
    h.push('</article>');
    return h.join('\n');
  }

  function ord(n) { return ['', 'أولاً', 'ثانياً', 'ثالثاً', 'رابعاً', 'خامساً', 'سادساً', 'سابعاً', 'ثامناً', 'تاسعاً', 'عاشراً', 'حادي عشر', 'ثاني عشر'][n] || String(n); }
  function modeText(m, what) {
    if (m === 'ceil') return 'في ' + what + ' يُحسب جزء السنة سنة كاملة.';
    if (m === 'exact') return 'في ' + what + ' تُحسب كسور السنة نسبياً.';
    return 'في ' + what + ' تُعتمد السنوات الكاملة فقط ويُهمل كسر السنة.';
  }

  function standalone(html, title) {
    return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + esc(title) + '</title>' +
      '<link href="https://fonts.googleapis.com/css2?family=Readex+Pro:wght@400;600;700&display=swap" rel="stylesheet">' +
      '<style>body{margin:0;background:#fff;padding:16px}' + REPORT_CSS + '</style></head><body>' + html + '</body></html>';
  }

  root.PensionReport = { render: render, standalone: standalone, CSS: REPORT_CSS, esc: esc };
})(typeof self !== 'undefined' ? self : this);
