/* واجهة الحاسبة: جمع البيانات، الحفظ، الإعدادات، العرض والطباعة */
(function () {
  'use strict';
  var C = window.PensionCalc, Rp = window.PensionReport;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var form = $('#caseForm');
  var KEY_CASES = 'pc.cases.v1', KEY_SET = 'pc.settings.v1', KEY_DRAFT = 'pc.draft.v1';
  var lastCase = null, lastResult = null;

  // ---------------------------------------------------------------- تخزين آمن
  function load(k, def) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } }
  function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function toast(msg) { var t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2600); }

  var style = document.createElement('style'); style.textContent = Rp.CSS; document.head.appendChild(style);

  // ---------------------------------------------------------------- الإعدادات
  function getSettings() { var s = load(KEY_SET, null); return s ? s : { org: '' }; }
  function effSettings() { var s = getSettings(); var o = {}; for (var k in s) if (k !== 'org') o[k] = s[k]; return o; }

  function fillValTable(id, rows) {
    var tb = $('#' + id + ' tbody'); tb.innerHTML = '';
    rows.forEach(function (r) { addValRow(id, r); });
  }
  function addValRow(id, r) {
    var tr = $('#valRow').content.firstElementChild.cloneNode(true);
    if (r) { $('[data-k=from]', tr).value = r.from || ''; $('[data-k=value]', tr).value = r.value; $('[data-k=note]', tr).value = r.note || ''; }
    $('.x', tr).onclick = function () { tr.remove(); };
    $('#' + id + ' tbody').appendChild(tr);
  }
  function readValTable(id) {
    return $$('#' + id + ' tbody tr').map(function (tr) { return { from: $('[data-k=from]', tr).value, value: +$('[data-k=value]', tr).value, note: $('[data-k=note]', tr).value }; })
      .filter(function (r) { return r.from && isFinite(r.value); });
  }
  function openSettings() {
    var s = C.settingsWith(effSettings()), raw = getSettings();
    $('#setOrg').value = raw.org || '';
    fillValTable('pensionTbl', s.pensionTable);
    fillValTable('aidTbl', s.aidTable);
    $('#setCutoff').value = s.cutoffDate; $('#setMax').value = s.maxYears;
    $('#setPYM').value = s.pensionYearMode; $('#setAYM').value = s.aidYearMode; $('#setTreasury').checked = !!s.treasuryShare;
    $('#settingsDlg').showModal();
  }
  $('#btnSettings').onclick = openSettings;
  $$('[data-addrow]').forEach(function (b) { b.onclick = function () { addValRow(b.getAttribute('data-addrow')); }; });
  $('#saveSettings').onclick = function () {
    var s = {
      org: $('#setOrg').value.trim(),
      pensionTable: readValTable('pensionTbl'), aidTable: readValTable('aidTbl'),
      cutoffDate: $('#setCutoff').value || C.DEFAULTS.cutoffDate, maxYears: +$('#setMax').value || C.DEFAULTS.maxYears,
      pensionYearMode: $('#setPYM').value, aidYearMode: $('#setAYM').value, treasuryShare: $('#setTreasury').checked
    };
    if (!s.pensionTable.length || !s.aidTable.length) { alert('يجب إدخال قيمة واحدة على الأقل للمعاش وللمعونة.'); return; }
    store(KEY_SET, s) ? toast('حُفظت الإعدادات') : alert('تعذر الحفظ في هذا المتصفح.');
    $('#settingsDlg').close();
    if (!$('#reportArea').hidden) run();
  };
  $('#resetSettings').onclick = function () { if (confirm('استعادة القيم الافتراضية الواردة في التعاميم؟')) { var org = getSettings().org; store(KEY_SET, { org: org }); $('#settingsDlg').close(); openSettings(); } };
  $$('[data-close]').forEach(function (b) { b.onclick = function () { b.closest('dialog').close(); }; });

  // ---------------------------------------------------------------- الجداول الديناميكية
  function addEx(r) {
    var tr = $('#exRow').content.firstElementChild.cloneNode(true);
    if (r) { $('[data-k=reason]', tr).value = r.reason || 'أخرى'; $('[data-k=from]', tr).value = r.from || ''; $('[data-k=to]', tr).value = r.to || ''; }
    $('.x', tr).onclick = function () { tr.remove(); liveService(); };
    $('#exTable tbody').appendChild(tr);
  }
  function addHeir(r) {
    var tr = $('#heirRow').content.firstElementChild.cloneNode(true);
    if (r) $$('[data-k]', tr).forEach(function (el) { var k = el.getAttribute('data-k'); if (el.type === 'checkbox') el.checked = !!r[k]; else if (r[k] !== undefined) el.value = r[k]; });
    var sel = $('[data-k=relation]', tr);
    function upd() { $$('[data-rel]', tr).forEach(function (l) { l.hidden = l.getAttribute('data-rel').split(' ').indexOf(sel.value) < 0; }); }
    sel.onchange = upd; upd();
    $('.x', tr).onclick = function () { tr.remove(); };
    $('#heirTable tbody').appendChild(tr);
  }
  $('#addEx').onclick = function () { addEx(); };
  $('#addHeir').onclick = function () { addHeir(); };

  // ---------------------------------------------------------------- جمع البيانات
  function val(n) { var el = form.elements[n]; if (!el) return ''; if (el.type === 'checkbox') return el.checked; return (el.value || '').trim(); }
  function radio(n) { var el = form.querySelector('input[name=' + n + ']:checked'); return el ? el.value : ''; }

  function collect() {
    var type = radio('type'), status = val('status');
    var c = {
      name: val('name'), fatherName: val('fatherName'), motherName: val('motherName'), birthDate: val('birthDate'), birthPlace: val('birthPlace'),
      nationalId: val('nationalId'), memberNo: val('memberNo'), branch: val('branch'), fileNo: val('fileNo'), phone: val('phone'), address: val('address'),
      type: type, status: status, originalType: val('originalType'),
      joinDate: val('joinDate'), registrationDecisionDate: val('registrationDecisionDate') || val('joinDate'),
      reRegistration: val('reRegistration'), priorPracticeYears: val('priorPracticeYears'),
      retirementDate: val('retirementDate'), paymentStartDate: val('paymentStartDate'), medicalDate: val('medicalDate'),
      occupational: type === 'heirs' ? val('occupationalHeirs') : val('occupational'),
      deathDate: val('deathDate'), deathDuringWork: val('deathDuringWork'),
      includeAid: val('includeAid'), requestedHalfAid: val('requestedHalfAid'), receivedHalfAid: val('receivedHalfAid'), receivedRetirementAid: val('receivedRetirementAid'),
      untilMonth: val('untilMonth'), preparer: val('preparer'), reviewer: val('reviewer'), notes: val('notes'),
      service: {
        mode: radio('serviceMode'), start: val('serviceStart'), end: val('serviceEnd'),
        exclusions: $$('#exTable tbody tr').map(function (tr) { return { reason: $('[data-k=reason]', tr).value, from: $('[data-k=from]', tr).value, to: $('[data-k=to]', tr).value }; }),
        manual: { y: val('manY'), m: val('manM'), d: val('manD') }
      },
      heirs: type === 'heirs' ? $$('#heirTable tbody tr').map(function (tr) {
        var h = {}; $$('[data-k]', tr).forEach(function (el) { if (el.closest('[hidden]')) return; var k = el.getAttribute('data-k'); h[k] = el.type === 'checkbox' ? el.checked : el.value.trim(); }); return h;
      }) : []
    };
    if (type === 'health' && !c.retirementDate) c.retirementDate = c.medicalDate;
    if (!c.service.end) c.service.end = defaultServiceEnd(c);
    return c;
  }
  function defaultServiceEnd(c) {
    if (c.type === 'heirs') return c.status === 'inService' ? c.deathDate : c.retirementDate;
    return c.retirementDate || c.medicalDate;
  }

  function validate(c) {
    var e = [];
    if (!c.name) e.push('أدخل اسم المحامي.');
    if (c.type === 'ordinary' && !c.retirementDate) e.push('أدخل تاريخ الإحالة على التقاعد.');
    if (c.type === 'health' && !c.medicalDate) e.push('أدخل تاريخ الخبرة الطبية.');
    if (c.type === 'heirs') {
      if (!c.deathDate) e.push('أدخل تاريخ الوفاة.');
      if (c.status === 'retired' && !c.retirementDate) e.push('أدخل تاريخ إحالة المورث على التقاعد.');
      if (!c.heirs.length) e.push('أضف أفراد الأسرة/الورثة.');
      if (c.retirementDate && c.deathDate && c.status === 'retired' && c.deathDate < c.retirementDate) e.push('تاريخ الوفاة قبل تاريخ الإحالة على التقاعد.');
    }
    if (c.service.mode === 'dates' && !c.service.start) e.push('أدخل تاريخ بدء الممارسة.');
    if (c.service.mode === 'manual' && !c.service.manual.y && !c.service.manual.m) e.push('أدخل مدة الممارسة الصافية.');
    if (!c.untilMonth) e.push('حدد الشهر الذي تُحسب المستحقات حتى نهايته.');
    if (c.includeAid && !c.joinDate) e.push('أدخل تاريخ الانتساب للنقابة لحساب المعونة.');
    if (c.includeAid && !c.birthDate) e.push('أدخل تاريخ ميلاد المحامي (لازم لشروط العمر في المعونة).');
    return e;
  }

  function showErrors(list) {
    var box = $('#errors');
    if (!list.length) { box.hidden = true; return; }
    box.innerHTML = '<b>يرجى استكمال ما يلي:</b><ul>' + list.map(function (x) { return '<li>' + Rp.esc(x) + '</li>'; }).join('') + '</ul>';
    box.hidden = false; box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function run() {
    var c = collect();
    var errs = validate(c);
    if (errs.length) { showErrors(errs); return; }
    var R = C.computeCase(c, effSettings());
    if (R.errors.length) { showErrors(R.errors); return; }
    showErrors([]);
    lastCase = c; lastResult = R;
    $('#report').innerHTML = Rp.render(c, R, { org: getSettings().org });
    $('#formArea').hidden = true; $('#reportArea').hidden = false;
    window.scrollTo(0, 0);
  }
  form.addEventListener('submit', function (e) { e.preventDefault(); run(); });
  $('#btnBack').onclick = function () { $('#reportArea').hidden = true; $('#formArea').hidden = false; };
  $('#btnPrint').onclick = function () { window.print(); };
  $('#btnDownload').onclick = function () {
    if (!lastCase) return;
    var title = 'تقرير تقاعد - ' + (lastCase.name || '');
    download(fileName('تقرير', 'html'), Rp.standalone($('#report').innerHTML, title), 'text/html');
  };

  // ---------------------------------------------------------------- إظهار/إخفاء الحقول
  function refresh() {
    var type = radio('type'), status = val('status'), orig = val('originalType');
    $$('[data-types]').forEach(function (el) {
      var types = el.getAttribute('data-types').split(' ');
      var show = types.indexOf(type) >= 0;
      var also = el.getAttribute('data-also');
      if (!show && also) { var p = also.split(':'); show = type === p[0] && status === p[1]; }
      var st = el.getAttribute('data-status'); if (show && st && type === 'heirs') show = st === status;
      var og = el.getAttribute('data-orig'); if (show && og) show = og === orig;
      el.hidden = !show;
    });
    $$('[data-when]').forEach(function (el) { el.hidden = !val(el.getAttribute('data-when')); });
    var mode = radio('serviceMode');
    $$('[data-mode]').forEach(function (el) { el.hidden = el.getAttribute('data-mode') !== mode; });
    $('#aidNum').textContent = type === 'heirs' ? '5' : '4';
    $('#lastNum').textContent = type === 'heirs' ? '6' : '5';
    $('#serviceEndHint').textContent = 'إن تُرك فارغاً: ' + (type === 'heirs' ? (status === 'inService' ? 'تاريخ الوفاة' : 'تاريخ الإحالة على التقاعد') : type === 'health' ? 'تاريخ الإحالة أو الخبرة الطبية' : 'تاريخ الإحالة على التقاعد');
    liveService();
  }
  function liveService() {
    var c = collect(), out = $('#serviceLive');
    if (c.service.mode === 'dates' && (!c.service.start || !c.service.end)) { out.textContent = ''; return; }
    var s = C.computeService(c.service);
    if (s.error) { out.textContent = s.error; return; }
    var S = C.settingsWith(effSettings());
    out.textContent = 'مدة الممارسة الصافية: ' + C.fmtYMD(s.net) + ' ← ' + C.adoptYears(s.net, S.pensionYearMode).text;
  }
  form.addEventListener('change', function () { refresh(); saveDraft(); });
  form.addEventListener('input', debounce(function () { liveService(); saveDraft(); }, 400));
  function debounce(fn, ms) { var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }

  // ---------------------------------------------------------------- تعبئة النموذج
  function fill(c) {
    form.reset();
    $('#exTable tbody').innerHTML = ''; $('#heirTable tbody').innerHTML = '';
    var map = { occupationalHeirs: c.type === 'heirs' ? c.occupational : false, occupational: c.type !== 'heirs' ? c.occupational : false,
      serviceStart: c.service && c.service.start, serviceEnd: c.service && c.service.end,
      manY: c.service && c.service.manual && c.service.manual.y, manM: c.service && c.service.manual && c.service.manual.m, manD: c.service && c.service.manual && c.service.manual.d };
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.type === 'radio' || el.type === 'file') return;
      var v = el.name in map ? map[el.name] : c[el.name];
      if (v === undefined || v === null) return;
      if (el.type === 'checkbox') el.checked = !!v; else el.value = v;
    });
    if (c.registrationDecisionDate === c.joinDate) form.elements.registrationDecisionDate.value = '';
    var tr = form.querySelector('input[name=type][value="' + (c.type || 'ordinary') + '"]'); if (tr) tr.checked = true;
    var sm = form.querySelector('input[name=serviceMode][value="' + ((c.service && c.service.mode) || 'dates') + '"]'); if (sm) sm.checked = true;
    ((c.service && c.service.exclusions) || []).forEach(addEx);
    (c.heirs || []).forEach(addHeir);
    if (!form.elements.untilMonth.value) form.elements.untilMonth.value = thisMonth();
    refresh();
  }
  function thisMonth() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() < 9 ? '0' : '') + (d.getMonth() + 1); }

  // ---------------------------------------------------------------- الحفظ والاستيراد
  function saveDraft() { store(KEY_DRAFT, collect()); }
  function saveCase() {
    var c = lastCase && !$('#reportArea').hidden ? lastCase : collect();
    if (!c.name) { alert('أدخل اسم المحامي قبل الحفظ.'); return; }
    var list = load(KEY_CASES, []);
    var id = c.id || ('c' + Date.now());
    c.id = id; c.savedAt = new Date().toISOString();
    list = list.filter(function (x) { return x.id !== id; }); list.unshift(c);
    if (store(KEY_CASES, list)) { toast('حُفظت حالة: ' + c.name); currentId = id; } else alert('تعذر الحفظ في هذا المتصفح؛ استخدم "تصدير الحالة".');
  }
  var currentId = null;
  var _collect = collect;
  collect = function () { var c = _collect(); if (currentId) c.id = currentId; return c; };
  $('#btnSave').onclick = saveCase; $('#btnSave2').onclick = saveCase;
  $('#btnCases').onclick = function () {
    var list = load(KEY_CASES, []), box = $('#casesList');
    if (!list.length) box.innerHTML = '<p class="hint">لا توجد حالات محفوظة بعد.</p>';
    else box.innerHTML = list.map(function (c, i) {
      return '<div class="case-item"><div><b>' + Rp.esc(c.name) + '</b><small>' + Rp.esc({ ordinary: 'تقاعد عادي', health: 'تقاعد صحي', heirs: 'معاش ورثة' }[c.type] || '') + ' – إضبارة ' + Rp.esc(c.fileNo || '—') + ' – حُفظت ' + new Date(c.savedAt).toLocaleString('ar-SY') + '</small></div>' +
        '<div class="actions" style="margin:0"><button class="btn small" data-open="' + i + '">فتح</button><button class="btn small ghost" data-del="' + i + '">حذف</button></div></div>';
    }).join('');
    $$('[data-open]', box).forEach(function (b) { b.onclick = function () { var c = list[+b.getAttribute('data-open')]; currentId = c.id; fill(c); $('#casesDlg').close(); $('#reportArea').hidden = true; $('#formArea').hidden = false; toast('فُتحت حالة: ' + c.name); }; });
    $$('[data-del]', box).forEach(function (b) { b.onclick = function () { var c = list[+b.getAttribute('data-del')]; if (!confirm('حذف حالة ' + c.name + '؟')) return; store(KEY_CASES, list.filter(function (x) { return x.id !== c.id; })); $('#casesDlg').close(); $('#btnCases').click(); }; });
    $('#casesDlg').showModal();
  };
  $('#btnNew').onclick = function () { if (!confirm('بدء حالة جديدة؟ ستُمسح البيانات غير المحفوظة.')) return; currentId = null; fill({ type: 'ordinary', includeAid: true, untilMonth: thisMonth() }); $('#reportArea').hidden = true; $('#formArea').hidden = false; };
  $('#btnExport').onclick = function () { var c = collect(); download(fileName('حالة', 'json'), JSON.stringify({ app: 'pension-calculator', version: 1, case: c, settings: getSettings() }, null, 2), 'application/json'); };
  $('#importFile').onchange = function (e) {
    var file = e.target.files[0]; if (!file) return;
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var data = JSON.parse(rd.result); var c = data.case || data;
        if (!c || typeof c !== 'object' || !c.type) throw new Error();
        currentId = c.id || null; fill(c); toast('استُوردت حالة: ' + (c.name || ''));
      } catch (err) { alert('الملف غير صالح.'); }
      e.target.value = '';
    };
    rd.readAsText(file);
  };
  function fileName(kind, ext) { var c = lastCase || collect(); return (kind + ' - ' + (c.name || 'بدون اسم') + (c.fileNo ? ' - ' + c.fileNo : '')).replace(/[\\/:*?"<>|]/g, '-') + '.' + ext; }
  function download(name, text, type) {
    var blob = new Blob([text], { type: type + ';charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  // ---------------------------------------------------------------- البدء
  var draft = load(KEY_DRAFT, null);
  fill(draft && draft.type ? draft : { type: 'ordinary', includeAid: true, untilMonth: thisMonth() });
})();
