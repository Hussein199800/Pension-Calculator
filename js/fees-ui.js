/* =========================================================
   حاسبة المحامي — قسم «الانتساب والرسوم» (الواجهة والحفظ والتقرير)
   ---------------------------------------------------------
   - منفصل تماماً عن قسم التقاعد: نموذج مستقل (#feeForm)، وحالات مستقلة
     (pc.fees.v1)، ومسودة مستقلة (pc.feesDraft.v1)، وتقرير مستقل.
   - الحساب كله في fees.js (FeesCalc). يستعمل أدوات app.js العامة فقط
     ($ و $$ و load و store و toast و confirmBox و esc و go و download).
   ========================================================= */
"use strict";
(function () {
    const F = window.FeesCalc;
    const fform = $("#feeForm");
    const fmt = F.fmt;
    let fCurrentId = null, fLastInput = null, fLastResult = null, paidYears = [];
    /* إعدادات قسم الرسوم (pc.feeSettings.v1): الجهة والطباعة والجداول المعدّلة. الغائب = المعتمد */
    const FEES_SIGNS = [{ title: "منظم التقرير", src: "preparer" }, { title: "المدقق", src: "reviewer" }, { title: "الخازن / المحاسب", src: "fixed", name: "" }];
    function feeSettings() { return load(KEY_FSET, null) || {}; }

    /* ---------- الجمع والتعبئة ---------- */
    function fval(n) { const el = fform.elements[n]; if (!el) return ""; if (el.type === "checkbox") return el.checked; return (el.value || "").trim(); }
    function kind() { const el = fform.querySelector("input[name=kind]:checked"); return el ? el.value : "new"; }
    function toLatin(s) { return String(s || "").replace(/[٠-٩]/g, function (c) { return "٠١٢٣٤٥٦٧٨٩".indexOf(c); }); }
    function fcollect() {
        const c = {
            name: fval("name"), fatherName: fval("fatherName"), motherName: fval("motherName"), birthDate: fval("birthDate"),
            nationalId: fval("nationalId"), memberNo: fval("memberNo"), branch: fval("branch"), fileNo: fval("fileNo"), phone: fval("phone"),
            kind: kind(), joinDate: fval("joinDate"), status: fval("status") || "active", statusYear: toLatin(fval("statusYear")),
            eventDate: fval("eventDate"), decisionDate: fval("decisionDate"), gapYears: toLatin(fval("gapYears")), lastPaidYear: toLatin(fval("lastPaidYear")),
            clearance: fval("clearance"), optional: { id: fval("opt_id"), license: fval("opt_license"), badge: fval("opt_badge") },
            paidYears: paidYears.slice(), preparer: fval("preparer"), reviewer: fval("reviewer"), notes: fval("notes")
        };
        if (fCurrentId) c.id = fCurrentId;
        return c;
    }
    function ffill(c) {
        fform.reset();
        Array.prototype.forEach.call(fform.elements, function (el) {
            if (!el.name || el.type === "radio") return;
            let v = el.name.indexOf("opt_") === 0 ? (c.optional || {})[el.name.slice(4)] : c[el.name];
            if (v === undefined || v === null) return;
            if (el.type === "checkbox") el.checked = !!v; else el.value = v;
        });
        const r = fform.querySelector('input[name=kind][value="' + (c.kind || "new") + '"]');
        if (r && !r.disabled) r.checked = true;
        paidYears = (c.paidYears || []).map(Number);
        fCurrentId = c.id || null;
        $("#feeBadge").textContent = fCurrentId ? "حساب محفوظ: " + (c.name || "") : "حساب جديد";
        frefresh();
    }

    /* إظهار الحقول حسب نوع العملية والوضع */
    function frefresh() {
        const k = kind(), st = fval("status");
        $$("#feeForm [data-fk]").forEach(function (el) { el.hidden = el.getAttribute("data-fk").split(" ").indexOf(k) < 0; });
        $$("#feeForm [data-fstatus]").forEach(function (el) { if (el.hidden) return; el.hidden = el.getAttribute("data-fstatus").split(" ").indexOf(st) < 0; });
        renderLive();
    }

    /* ---------- النتيجة الحية تحت النموذج ---------- */
    function compute(c) { return F.compute(c, { data: feeSettings().data }); }
    /* أوصاف أنواع العملية تُكتب من الجداول النافذة، فتبقى صحيحة بعد أي تعديل في الإعدادات */
    function updateHints() {
        const X = F.dataWith(feeSettings().data).flat, n = fmt;
        const hints = {
            secStruck: "الرسوم السنوية من " + X.securityFrom + " حتى سنة القرار",
            admStruck: "نقابة " + n(X.admUnion) + " + تقاعد " + n(X.admPension) + " + سنوات الانقطاع",
            reCancel: "نقابة " + n(X.reUnion) + " + تقاعد " + n(X.rePension) + " + سنوات الانقطاع",
            omitted: "نقابة " + n(X.omUnion) + " + تقاعد " + n(X.omPension) + " + الرسوم المترتبة",
            transfer: "نقابة " + n(X.trfUnion) + " + تقاعد " + n(X.trfPension),
            traineeToMaster: n(X.tmUnion + X.tmPension + X.tmLicenseFee + X.tmId + X.tmLicensePrice) + " ثابتة"
        };
        Object.keys(hints).forEach(function (k) { const el = fform.querySelector('input[name=kind][value="' + k + '"] + span small'); if (el) el.textContent = hints[k]; });
        $$("#feeForm .opt-row .check").forEach(function (l) {
            const nm = l.querySelector("input").name, v = { opt_id: X.optId, opt_license: X.optLicense, opt_badge: X.optBadge }[nm];
            l.lastChild.textContent = " " + { opt_id: "الهوية", opt_license: "إجازة المحاماة", opt_badge: "شارة الصدر" }[nm] + " (" + n(v) + ")";
        });
    }
    function renderLive() {
        const c = fcollect(), R = compute(c), box = $("#feeLive");
        if (R.errors.length) {
            box.innerHTML = '<h3><i class="ti ti-calculator"></i>النتيجة</h3><p class="muted">' + R.errors.map(esc).join("<br>") + "</p>";
            return;
        }
        let h = '<div class="card-head"><h3><i class="ti ti-calculator"></i>النتيجة</h3><span class="fee-total">' + fmt(R.total) + " <small>ل.س</small></span></div>";
        if (R.warnings.length) h += R.warnings.map(function (w) { return '<div class="field-warn"><i class="ti ti-alert-triangle"></i>' + esc(w) + "</div>"; }).join("");
        if (R.items.length) {
            h += '<div class="table-wrap"><table class="fee-tbl"><thead><tr><th>البند</th><th class="n">المبلغ</th></tr></thead><tbody>' +
                R.items.map(function (i) { return "<tr><td>" + esc(i.label) + (i.note ? ' <small class="muted">(' + esc(i.note) + ")</small>" : "") + '</td><td class="n">' + fmt(i.amount) + "</td></tr>"; }).join("") +
                '</tbody><tfoot><tr><td>مجموع البنود</td><td class="n">' + fmt(R.itemsTotal) + "</td></tr></tfoot></table></div>";
        }
        if (R.years.length) {
            h += '<p class="fee-sub">الرسوم السنوية <small class="muted">— علّم السنة التي دفعها المحامي فتُطرح من المجموع</small></p>' +
                '<div class="year-grid">' + R.years.map(function (y) {
                    return '<label class="year-chip' + (y.paid ? " paid" : "") + '"><input type="checkbox" data-paid="' + y.year + '"' + (y.paid ? " checked" : "") + ">" +
                        "<b>" + y.year + "</b><span>" + fmt(y.amount) + "</span><small>" + (y.paid ? "مدفوع" : "مستحق") + "</small></label>";
                }).join("") + "</div>" +
                '<p class="muted" style="margin:8px 0 0">مجموع الرسوم السنوية المستحقة: <b>' + fmt(R.yearsTotal) + "</b>" + (R.paidCount ? " (طُرحت " + R.paidCount + " سنة مدفوعة)" : "") + "</p>";
        }
        h += '<details class="how"><summary><i class="ti ti-info-circle"></i>كيف حُسب؟</summary><ol>' + R.steps.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ol></details>";
        box.innerHTML = h;
    }
    $("#feeLive").addEventListener("change", function (e) {
        const cb = e.target.closest("[data-paid]"); if (!cb) return;
        const y = +cb.dataset.paid;
        paidYears = paidYears.filter(function (x) { return x !== y; });
        if (cb.checked) paidYears.push(y);
        renderLive(); fsaveDraft();
    });

    fform.addEventListener("change", function (e) { if (e.target.closest("#feeLive")) return; frefresh(); fsaveDraft(); });
    fform.addEventListener("input", function (e) {
        if (e.target.classList.contains("num-in")) { const v = toLatin(e.target.value); if (v !== e.target.value) e.target.value = v; }
        clearTimeout(fform._t); fform._t = setTimeout(function () { renderLive(); fsaveDraft(); }, 300);
    });

    /* ---------- التحقق والتقرير ---------- */
    function fvalidate(c) {
        const e = [];
        if (!c.name) e.push("أدخل اسم المحامي.");
        return e.concat(compute(c).errors);
    }
    function showErrs(list) {
        const box = $("#feeErrors");
        if (!list.length) { box.classList.add("hidden"); return; }
        box.innerHTML = "<b>يرجى استكمال ما يلي:</b><ul style=\"margin:6px 20px 0 0\">" + list.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>";
        box.classList.remove("hidden"); box.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    function buildReport(c, R) {
        const fs = feeSettings();
        const org = fs.org || "نقابة المحامين";
        const kv = function (rows) {
            return '<table class="rkv"><tbody>' + rows.filter(function (r) { return r[1] !== "" && r[1] !== undefined && r[1] !== null; })
                .map(function (r) { return "<tr><td>" + esc(r[0]) + "</td><td>" + r[1] + "</td></tr>"; }).join("") + "</tbody></table>";
        };
        const d = function (s) { return s ? F.fmtDate(s) : ""; };
        const now = new Date();
        const h = [];
        h.push('<div class="rpt' + Rp.sizeClass(fs.fontSize) + '"><div class="rpt-head"><div><div class="org">' + esc(org) + "</div><h1>تقرير رسوم: " + esc(R.kindName) + "</h1></div>" +
            '<div class="meta">تاريخ التقرير: ' + now.getDate() + "/" + (now.getMonth() + 1) + "/" + now.getFullYear() + (c.fileNo ? "<br>رقم الإضبارة: " + esc(c.fileNo) : "") + (c.memberNo ? "<br>رقم العضوية: " + esc(c.memberNo) : "") + "</div></div>");
        h.push("<h2>بيانات المحامي</h2>" + kv([
            ["الاسم", esc(c.name)], ["اسم الأب", esc(c.fatherName)], ["اسم الأم", esc(c.motherName)], ["تاريخ الميلاد", d(c.birthDate)],
            ["الرقم الوطني", esc(c.nationalId)], ["الفرع", esc(c.branch)], ["رقم الهاتف", esc(c.phone)]
        ]));
        const op = [["نوع العملية", esc(R.kindName)]];
        if (c.joinDate) op.push([c.kind === "new" ? "تاريخ الانتساب" : "تاريخ الانتساب الأصلي", d(c.joinDate)]);
        if (R.age) op.push(["العمر المعتمد", R.age.raw + " سنة (" + esc(F.fmtYMD(R.age.ymd)) + ")" + (R.age.row !== R.age.raw ? " ← سطر " + R.age.row : "")]);
        if (R.table) op.push(["جدول الرسوم المعتمد", "جدول " + R.table]);
        if (c.kind === "new") op.push(["وضع المحامي", esc(F.STATUS[c.status] || "") + (c.status !== "active" ? " — سنة " + esc(c.statusYear) : "")]);
        if (c.eventDate) op.push([c.kind === "admStruck" ? "تاريخ الشطب" : "تاريخ الترقين", d(c.eventDate)]);
        if (c.decisionDate) op.push(["تاريخ قرار إعادة القيد", d(c.decisionDate)]);
        if (R.gapYears !== undefined) op.push(["سنوات الانقطاع", R.gapYears + " سنة"]);
        if (c.lastPaidYear) op.push(["آخر سنة مدفوعة", esc(c.lastPaidYear)]);
        if (c.kind === "transfer") op.push(["براءة الذمة", c.clearance ? '<span class="yes">بريء الذمة</span>' : '<span class="no">لم يُؤكَّد</span>']);
        h.push("<h2>بيانات العملية</h2>" + kv(op));
        if (R.warnings.length) h.push(R.warnings.map(function (w) { return '<div class="warn">' + esc(w) + "</div>"; }).join(""));
        if (R.items.length) {
            h.push("<h2>الرسوم</h2><table><thead><tr><th>البند</th><th>ملاحظة</th><th class=\"n\">المبلغ (ل.س)</th></tr></thead><tbody>" +
                R.items.map(function (i) { return "<tr><td>" + esc(i.label) + "</td><td>" + esc(i.note) + '</td><td class="n">' + fmt(i.amount) + "</td></tr>"; }).join("") +
                '<tr class="total"><td colspan="2">مجموع البنود</td><td class="n">' + fmt(R.itemsTotal) + "</td></tr></tbody></table>");
        }
        if (R.years.length) {
            h.push("<h2>الرسوم السنوية</h2><table><thead><tr><th>السنة</th><th>الحالة</th><th class=\"n\">الرسم (ل.س)</th></tr></thead><tbody>" +
                R.years.map(function (y) { return "<tr><td>" + y.year + "</td><td>" + (y.paid ? '<span class="yes">مدفوع</span>' : "مستحق") + (y.over45 ? " · رسم من انتسب فوق 45" : "") + '</td><td class="n">' + (y.paid ? "<s>" + fmt(y.amount) + "</s>" : fmt(y.amount)) + "</td></tr>"; }).join("") +
                '<tr class="total"><td colspan="2">مجموع الرسوم السنوية المستحقة</td><td class="n">' + fmt(R.yearsTotal) + "</td></tr></tbody></table>");
        }
        h.push('<div class="sum"><div class="box gold"><div class="l">المجموع المطلوب دفعه</div><div class="v">' + fmt(R.total) + ' ل.س</div><div class="w">' +
            (R.items.length ? "البنود " + fmt(R.itemsTotal) : "") + (R.items.length && R.years.length ? " + " : "") + (R.years.length ? "الرسوم السنوية " + fmt(R.yearsTotal) : "") + "</div></div></div>");
        h.push('<h2>كيف حُسب؟</h2><ol class="steps">' + R.steps.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ol>");
        if (c.notes) h.push('<h2>ملاحظات</h2><div class="note">' + esc(c.notes).replace(/\n/g, "<br>") + "</div>");
        h.push(Rp.signBlock(fs.signs || FEES_SIGNS, c));
        h.push('<div class="foot">' + (fs.footer ? esc(fs.footer).replace(/\n/g, "<br>") : "أُعدّ هذا التقرير بواسطة حاسبة المحامي وفق جداول رسوم الانتساب والرسوم السنوية المعتمدة في النقابة (المبالغ بالعملة الجديدة)، ويُعتمد بعد تدقيق الإيصالات والوثائق في إضبارة المحامي.") + "</div></div>");
        return h.join("");
    }
    function showReport(c, R) {
        fLastInput = c; fLastResult = R;
        $("#feeReport").innerHTML = buildReport(c, R);
        $("#feeReportEmpty").hidden = true; $("#feeReportBox").hidden = false;
    }
    fform.addEventListener("submit", function (e) {
        e.preventDefault();
        const c = fcollect(), errs = fvalidate(c);
        if (errs.length) { showErrs(errs); return; }
        showErrs([]);
        showReport(c, compute(c));
        go("freport"); toast("أُنشئ تقرير الرسوم", "ok", 2500);
    });

    /* ---------- الحفظ (إضافي: لا يُحذف شيء إلا بطلب صريح) ---------- */
    function fsaveDraft() { store(KEY_FDRAFT, fcollect()); }
    function fsave() {
        const c = current === "freport" && fLastInput ? fLastInput : fcollect();
        if (!c.name) { toast("أدخل اسم المحامي قبل الحفظ.", "bad"); return; }
        const R = compute(c);
        const list = load(KEY_FEES, []);
        c.id = c.id || ("f" + Date.now());
        c.savedAt = new Date().toISOString();
        c.savedBy = me ? me.username : "";
        c.savedTotal = R.errors.length ? null : R.total; /* النتيجة كما كانت وقت الحفظ */
        const next = list.filter(function (x) { return x.id !== c.id; }); next.unshift(c);
        if (store(KEY_FEES, next)) {
            fCurrentId = c.id; if (fLastInput) fLastInput.id = c.id;
            $("#feeBadge").textContent = "حساب محفوظ: " + c.name;
            toast("حُفظ حساب الرسوم: " + esc(c.name), "ok");
        } else toast("تعذر الحفظ في هذا المتصفح؛ حمّل نسخة احتياطية.", "bad");
    }
    function fileName(ext) { const c = fLastInput || fcollect(); return ("تقرير رسوم - " + (c.name || "بدون اسم") + (c.fileNo ? " - " + c.fileNo : "")).replace(/[\\/:*?"<>|]/g, "-") + "." + ext; }
    document.addEventListener("click", async function (e) {
        const b = e.target.closest("[data-fact]"); if (!b) return;
        const a = b.dataset.fact;
        if (a === "save") fsave();
        if (a === "print" && fLastInput) { $("#printArea").innerHTML = $("#feeReport").innerHTML; window.print(); }
        if (a === "download" && fLastInput) download(fileName("html"), Rp.standalone($("#feeReport").innerHTML, "تقرير رسوم - " + (fLastInput.name || "")), "text/html");
        if (a === "new") {
            if (!await confirmBox("حساب رسوم جديد", "ستُفرَّغ حاسبة الرسوم. الحسابات المحفوظة لا تتأثر.", "بدء حساب جديد")) return;
            ffill({ kind: "new", status: "active" });
            fLastInput = null; fLastResult = null; $("#feeReportEmpty").hidden = false; $("#feeReportBox").hidden = true; fsaveDraft();
            go("fcalc");
        }
    });

    /* ---------- قائمة الحسابات المحفوظة ---------- */
    function norm(s) { return toLatin(String(s || "")).toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي"); }
    function renderList() {
        const q = norm($("#feeSearch").value.trim());
        const list = load(KEY_FEES, []).filter(function (c) { return !q || [c.name, c.fileNo, c.memberNo].some(function (x) { return norm(x).indexOf(q) >= 0; }); });
        const box = $("#feeCasesList");
        if (!list.length) { box.innerHTML = '<p class="empty">' + (q ? "لا نتائج مطابقة." : "لا توجد حسابات رسوم محفوظة بعد.") + "</p>"; return; }
        box.innerHTML = list.map(function (c) {
            return '<div class="case-row"><div><b>' + esc(c.name) + "</b><small>" + esc(F.KINDS[c.kind] || "") + (c.savedTotal != null ? " · " + fmt(c.savedTotal) + " ل.س" : "") +
                " · إضبارة " + esc(c.fileNo || "—") + (c.branch ? " · " + esc(c.branch) : "") +
                " · حُفظ " + (c.savedAt ? new Date(c.savedAt).toLocaleString("ar-SY", { dateStyle: "medium", timeStyle: "short" }) : "") + "</small></div>" +
                '<div class="row"><button class="btn sm primary" data-fopen="' + esc(c.id) + '"><i class="ti ti-folder-open"></i>فتح</button>' +
                '<button class="btn sm" data-frep="' + esc(c.id) + '"><i class="ti ti-file-invoice"></i>التقرير</button>' +
                '<button class="btn sm danger" data-fdel="' + esc(c.id) + '" aria-label="حذف"><i class="ti ti-trash"></i></button></div></div>';
        }).join("");
    }
    $("#feeSearch").addEventListener("input", renderList);
    function totalChanged(c) {
        const R = compute(c);
        if (c.savedTotal != null && !R.errors.length && R.total !== c.savedTotal)
            toast("تنبيه: المجموع المحفوظ " + fmt(c.savedTotal) + " ل.س، وبالجداول الحالية " + fmt(R.total) + " ل.س.", "warn", 7000);
    }
    $("#feeCasesList").addEventListener("click", async function (e) {
        const all = load(KEY_FEES, []);
        const find = function (id) { return all.find(function (x) { return x.id === id; }); };
        const o = e.target.closest("[data-fopen]"), r = e.target.closest("[data-frep]"), d = e.target.closest("[data-fdel]");
        if (o) { const c = find(o.dataset.fopen); ffill(c); fsaveDraft(); go("fcalc"); toast("فُتح الحساب", "ok", 2000); totalChanged(c); }
        if (r) {
            const c = find(r.dataset.frep); ffill(c); fsaveDraft();
            const cc = fcollect(), errs = fvalidate(cc);
            if (errs.length) { go("fcalc"); showErrs(errs); return; }
            showReport(cc, compute(cc)); go("freport"); totalChanged(c);
        }
        if (d) {
            const c = find(d.dataset.fdel);
            if (!await confirmBox("حذف حساب", "هل تريد حذف حساب الرسوم لـ <b>" + esc(c.name) + "</b> نهائياً من هذا الجهاز؟ يُنصح بتحميل نسخة احتياطية أولاً.", "حذف", true)) return;
            store(KEY_FEES, load(KEY_FEES, []).filter(function (x) { return x.id !== c.id; }));
            if (fCurrentId === c.id) { fCurrentId = null; $("#feeBadge").textContent = "حساب جديد"; }
            renderList(); toast("حُذف الحساب", "ok");
        }
    });

    /* ---------- الربط مع التنقل ---------- */
    window.FeesUI = {
        onPage: function (sec) {
            if (sec === "fcases") renderList();
            if (sec === "fcalc") { updateHints(); renderLive(); }
            if (sec === "fsettings" && window.FeeSettingsUI) window.FeeSettingsUI.fill();
            if (sec === "help" && window.HelpUI) window.HelpUI.render();
        },
        settings: feeSettings,
        signs: FEES_SIGNS,
        /* بعد حفظ الإعدادات: تحديث الأوصاف والنتيجة الحية والتقرير المفتوح */
        refresh: function () { updateHints(); renderLive(); if (fLastInput) showReport(fLastInput, compute(fLastInput)); }
    };
    updateHints();
    const draft = load(KEY_FDRAFT, null);
    ffill(draft && draft.kind ? draft : { kind: "new", status: "active" });
})();
