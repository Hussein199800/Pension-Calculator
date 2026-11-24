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
    function kinds() { return $$("#feeForm input[name=kinds]:checked").map(function (el) { return el.value; }); }
    function scope() { const el = fform.querySelector("input[name=scope]:checked"); return el ? el.value : "both"; }
    function toLatin(s) { return String(s || "").replace(/[٠-٩]/g, function (c) { return "٠١٢٣٤٥٦٧٨٩".indexOf(c); }); }
    let excludeDup = [];
    function fcollect() {
        const ks = kinds();
        const c = {
            name: fval("name"), fatherName: fval("fatherName"), motherName: fval("motherName"), birthDate: fval("birthDate"),
            nationalId: fval("nationalId"), memberNo: fval("memberNo"), branch: fval("branch"), fileNo: fval("fileNo"), phone: fval("phone"),
            kinds: ks, kind: ks[0] || "", scope: scope(),
            joinDate: fval("joinDate"), status: fval("status") || "active", statusYear: toLatin(fval("statusYear")),
            eventDate: fval("eventDate"), decisionDate: fval("decisionDate"), gapYears: toLatin(fval("gapYears")), lastPaidYear: toLatin(fval("lastPaidYear")),
            clearance: fval("clearance"), optional: { id: fval("opt_id"), license: fval("opt_license"), badge: fval("opt_badge") },
            branchPrints: { on: fval("bp_on"), amount: toLatin(fval("bp_amount")) }, secBranchWaived: fval("secBranchWaived"),
            branchExtra: { admin: fval("bx_admin"), training: fval("bx_training") }, excludeDup: excludeDup.slice(),
            paidYears: paidYears.slice(), preparer: fval("preparer"), reviewer: fval("reviewer"), notes: fval("notes")
        };
        if (fCurrentId) c.id = fCurrentId;
        return c;
    }
    function ffill(c) {
        fform.reset();
        const map = {
            opt_id: (c.optional || {}).id, opt_license: (c.optional || {}).license, opt_badge: (c.optional || {}).badge,
            bp_on: (c.branchPrints || {}).on, bp_amount: (c.branchPrints || {}).amount,
            bx_admin: (c.branchExtra || {}).admin, bx_training: (c.branchExtra || {}).training
        };
        Array.prototype.forEach.call(fform.elements, function (el) {
            if (!el.name || el.type === "radio" || el.name === "kinds") return;
            const v = el.name in map ? map[el.name] : c[el.name];
            if (v === undefined || v === null) return;
            if (el.type === "checkbox") el.checked = !!v; else el.value = v;
        });
        /* الحساب المحفوظ قبل العمليات المتعددة فيه kind واحد، وقبل الفرع ليس فيه scope (= مركزية فقط) */
        const ks = Array.isArray(c.kinds) && c.kinds.length ? c.kinds : [c.kind || "new"];
        $$("#feeForm input[name=kinds]").forEach(function (el) { el.checked = !el.disabled && ks.indexOf(el.value) >= 0; });
        const sc = fform.querySelector('input[name=scope][value="' + (c.scope || (c.id ? "central" : "both")) + '"]');
        if (sc) sc.checked = true;
        paidYears = (c.paidYears || []).map(Number);
        excludeDup = (c.excludeDup || []).slice();
        fCurrentId = c.id || null;
        $("#feeBadge").textContent = fCurrentId ? "حساب محفوظ: " + (c.name || "") : "حساب جديد";
        frefresh();
    }

    /* إظهار الحقول حسب العمليات المختارة والنطاق والوضع */
    function frefresh() {
        const ks = kinds(), st = fval("status"), sc = scope();
        $$("#feeForm [data-fk]").forEach(function (el) { el.hidden = !el.getAttribute("data-fk").split(" ").some(function (k) { return ks.indexOf(k) >= 0; }); });
        $$("#feeForm [data-fstatus]").forEach(function (el) { if (el.hidden) return; el.hidden = el.getAttribute("data-fstatus").split(" ").indexOf(st) < 0; });
        $("#branchBox").hidden = sc === "central";
        $$("#feeForm .opt-row").forEach(function (el) { if (sc === "branch") el.hidden = true; });
        $$("#feeForm .bp-amount").forEach(function (el) { if (!el.hidden) el.hidden = !fval("bp_on"); });
        $$("#feeForm .ftypes .type").forEach(function (l) { const i = l.querySelector("input"); l.classList.toggle("on", i.checked); });
        renderLive();
    }

    /* ---------- النتيجة الحية تحت النموذج ---------- */
    function compute(c) { return F.compute(c, { data: feeSettings().data }); }
    /* أوصاف أنواع العملية تُكتب من الجداول النافذة، فتبقى صحيحة بعد أي تعديل في الإعدادات */
    function updateHints() {
        const X = F.dataWith(feeSettings().data).flat, n = fmt, sc = scope();
        const C = sc !== "branch", B = sc !== "central";
        const both = function (c, b) { return (C ? c : "") + (C && B ? " · " : "") + (B ? "فرع " + b : ""); };
        const hints = {
            new: (C ? "مركزية: جدول سنة الانتساب حسب العمر + الرسوم السنوية" : "") + (C && B ? " · " : "") + (B ? "فرع: جدول الفروع حسب العمر" : ""),
            secStruck: (C ? "الرسوم السنوية من " + X.securityFrom + " حتى سنة القرار" : "") + (C && B ? " · " : "") + (B ? "فرع " + n(X.brStruck) + " (يمكن الإعفاء) + رسم الفرع السنوي" : ""),
            admStruck: both("نقابة " + n(X.admUnion) + " + تقاعد " + n(X.admPension) + " + سنوات الانقطاع", n(X.brStruck)),
            reCancel: both("نقابة " + n(X.reUnion) + " + تقاعد " + n(X.rePension) + " + سنوات الانقطاع", n(X.brReCancel)),
            cancelSelf: "رسم سنة الترقين وما سبقه غير مدفوع",
            omitted: both("نقابة " + n(X.omUnion) + " + تقاعد " + n(X.omPension) + " + الرسوم المترتبة", n(X.brOmitted)),
            transfer: both("نقابة " + n(X.trfUnion) + " + تقاعد " + n(X.trfPension), n(X.brTransfer)),
            traineeToMaster: both("مركزية " + n(X.tmUnion + X.tmPension + X.tmLicenseFee + X.tmId + X.tmLicensePrice), n(X.brMaster))
        };
        Object.keys(hints).forEach(function (k) { const el = fform.querySelector('input[name=kinds][value="' + k + '"] + span small'); if (el) el.textContent = hints[k]; });
        $$("#feeForm .opt-row .check").forEach(function (l) {
            const nm = l.querySelector("input").name, v = { opt_id: X.optId, opt_license: X.optLicense, opt_badge: X.optBadge }[nm];
            l.lastChild.textContent = " " + { opt_id: "الهوية", opt_license: "إجازة المحاماة", opt_badge: "شارة الصدر" }[nm] + " (" + n(v) + ")";
        });
        const bx = { bx_admin: ["رسم نفقات إدارية", X.brAdmin], bx_training: ["متطلبات تمرين", X.brTraining] };
        Object.keys(bx).forEach(function (k) { const i = fform.elements[k]; if (i) i.parentNode.lastChild.textContent = " " + bx[k][0] + " (" + n(bx[k][1]) + "، اختياري)"; });
        const w = fform.elements.secBranchWaived; if (w) w.parentNode.lastChild.textContent = " إعفاء المشطوب الأمني من رسم إعادة القيد للفرع (" + n(X.brStruck) + ")";
    }
    const FUNDTAG = function (f) { return '<span class="fund-tag ' + f + '">' + F.FUND[f] + "</span>"; };
    function renderLive() {
        const c = fcollect(), R = compute(c), box = $("#feeLive");
        if (R.errors.length) {
            box.innerHTML = '<h3><i class="ti ti-calculator"></i>النتيجة</h3><p class="muted">' + R.errors.map(esc).join("<br>") + "</p>";
            return;
        }
        let h = '<div class="card-head"><h3><i class="ti ti-calculator"></i>النتيجة <small class="muted">(' + esc(R.scopeName) + ")</small></h3>" +
            '<span class="fee-total">' + fmt(R.total) + " <small>ل.س</small></span></div>";
        if (R.scope === "both") h += '<div class="fund-sums"><span>' + FUNDTAG("central") + " " + fmt(R.centralTotal) + "</span><span>" + FUNDTAG("branch") + " " + fmt(R.branchTotal) + "</span></div>";
        if (R.warnings.length) h += R.warnings.map(function (w) { return '<div class="field-warn"><i class="ti ti-alert-triangle"></i>' + esc(w) + "</div>"; }).join("");
        R.ops.forEach(function (op) {
            if (!op.items.length) return;
            h += '<p class="fee-sub">' + esc(op.name) + "</p>" +
                '<div class="table-wrap"><table class="fee-tbl"><thead><tr><th>الجهة</th><th>البند</th><th class="n">المبلغ</th></tr></thead><tbody>' +
                op.items.map(function (i) {
                    const dup = i.dup ? '<label class="dup-chk" title="بند مكرر مع «' + esc(i.dupOf) + '»"><input type="checkbox" data-dup="' + esc(i.key) + '"' + (i.excluded ? "" : " checked") + "> مكرر: يُحتسب</label>" : "";
                    return '<tr class="' + (i.excluded ? "is-excluded" : "") + '"><td>' + FUNDTAG(i.fund) + "</td><td>" + esc(i.label) + (i.note ? ' <small class="muted">(' + esc(i.note) + ")</small>" : "") + dup +
                        '</td><td class="n">' + (i.excluded ? "<s>" + fmt(i.amount) + "</s>" : fmt(i.amount)) + "</td></tr>";
                }).join("") + '</tbody><tfoot><tr><td colspan="2">مجموع «' + esc(op.name) + '»</td><td class="n">' + fmt(op.total) + "</td></tr></tfoot></table></div>";
        });
        if (R.years.length) {
            const showB = R.scope !== "central", showC = R.scope !== "branch";
            h += '<p class="fee-sub">الرسوم السنوية <small class="muted">— علّم السنة التي دفعها المحامي فتُطرح من المجموع</small></p>' +
                '<div class="year-grid">' + R.years.map(function (y) {
                    const parts = (showC && showB) ? '<small class="yr-split">م ' + fmt(y.central) + (y.branch ? " + ف " + fmt(y.branch) : "") + "</small>" : "";
                    return '<label class="year-chip' + (y.paid ? " paid" : "") + '"><input type="checkbox" data-paid="' + y.year + '"' + (y.paid ? " checked" : "") + ">" +
                        "<b>" + y.year + "</b><span>" + fmt(y.amount) + "</span>" + parts + "<small>" + (y.paid ? "مدفوع" : "مستحق") + "</small></label>";
                }).join("") + "</div>" +
                '<p class="muted" style="margin:8px 0 0">مجموع الرسوم السنوية المستحقة: <b>' + fmt(R.yearsTotal) + "</b>" + (R.paidCount ? " (طُرحت " + R.paidCount + " سنة مدفوعة)" : "") + "</p>";
        }
        h += '<details class="how"><summary><i class="ti ti-info-circle"></i>كيف حُسب؟</summary><ol>' + R.steps.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ol></details>";
        box.innerHTML = h;
    }
    $("#feeLive").addEventListener("change", function (e) {
        const cb = e.target.closest("[data-paid]"), dp = e.target.closest("[data-dup]");
        if (cb) {
            const y = +cb.dataset.paid;
            paidYears = paidYears.filter(function (x) { return x !== y; });
            if (cb.checked) paidYears.push(y);
        }
        if (dp) {
            excludeDup = excludeDup.filter(function (k) { return k !== dp.dataset.dup; });
            if (!dp.checked) excludeDup.push(dp.dataset.dup);
        }
        if (cb || dp) { renderLive(); fsaveDraft(); }
    });

    fform.addEventListener("change", function (e) {
        if (e.target.closest("#feeLive")) return;
        if (e.target.name === "scope") updateHints();
        frefresh(); fsaveDraft();
    });
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
        const has = function (k) { return R.kinds.indexOf(k) >= 0; };
        const fundTxt = function (f) { return f === "central" ? "مركزية" : "فرع"; };
        const now = new Date();
        const h = [];
        h.push('<div class="rpt' + Rp.sizeClass(fs.fontSize) + '"><div class="rpt-head"><div><div class="org">' + esc(org) + "</div><h1>تقرير رسوم: " + esc(R.kindName) + "</h1><div>" + esc(R.scopeName) + "</div></div>" +
            '<div class="meta">تاريخ التقرير: ' + now.getDate() + "/" + (now.getMonth() + 1) + "/" + now.getFullYear() + (c.fileNo ? "<br>رقم الإضبارة: " + esc(c.fileNo) : "") + (c.memberNo ? "<br>رقم العضوية: " + esc(c.memberNo) : "") + (c.branch ? "<br>الفرع: " + esc(c.branch) : "") + "</div></div>");
        h.push("<h2>بيانات المحامي</h2>" + kv([
            ["الاسم", esc(c.name)], ["اسم الأب", esc(c.fatherName)], ["اسم الأم", esc(c.motherName)], ["تاريخ الميلاد", d(c.birthDate)],
            ["الرقم الوطني", esc(c.nationalId)], ["الفرع", esc(c.branch)], ["رقم الهاتف", esc(c.phone)]
        ]));
        /* الحالة: ما العمليات، وعلى أي نطاق، وبأي تواريخ */
        const op = [["العمليات", R.ops.filter(function (o) { return o.kind !== "branchExtra"; }).map(function (o, i) { return (i + 1) + ". " + esc(o.name); }).join("<br>")],
            ["نطاق الحساب", esc(R.scopeName) + (R.scope === "both" ? " (رسوم النقابة المركزية + رسوم الفرع)" : "")]];
        if (c.joinDate) op.push([has("new") ? "تاريخ الانتساب" : "تاريخ الانتساب الأصلي", d(c.joinDate)]);
        if (R.age) op.push(["العمر المعتمد", R.age.raw + " سنة (" + esc(F.fmtYMD(R.age.ymd)) + ")" + (R.age.row !== R.age.raw ? " ← سطر " + R.age.row : "")]);
        if (R.table && R.scope !== "branch") op.push(["جدول الرسوم المركزي", "جدول " + R.table]);
        if (R.branchTable && R.scope !== "central") op.push(["جدول رسوم الفرع", "جدول الفروع " + R.branchTable]);
        if (has("new")) op.push(["وضع المحامي", esc(F.STATUS[c.status] || "") + (c.status !== "active" ? " — سنة " + esc(c.statusYear) : "")]);
        if (c.eventDate && (has("admStruck") || has("reCancel") || has("cancelSelf"))) op.push([has("admStruck") ? "تاريخ الشطب" : "تاريخ الترقين", d(c.eventDate)]);
        if (c.decisionDate && ["secStruck", "admStruck", "reCancel", "omitted"].some(has)) op.push(["تاريخ قرار إعادة القيد", d(c.decisionDate)]);
        if (R.gapYears !== undefined) op.push(["سنوات الانقطاع", R.gapYears + " سنة"]);
        if (c.lastPaidYear && (has("cancelSelf") || has("omitted"))) op.push(["آخر سنة مدفوعة", esc(c.lastPaidYear)]);
        if (has("transfer")) op.push(["براءة الذمة", c.clearance ? '<span class="yes">بريء الذمة</span>' : '<span class="no">لم يُؤكَّد</span>']);
        if (has("secStruck") && R.scope !== "central") op.push(["رسم الفرع للمشطوب الأمني", c.secBranchWaived ? '<span class="yes">معفى</span>' : "مستحق"]);
        h.push("<h2>الحالة</h2>" + kv(op));
        if (R.warnings.length) h.push(R.warnings.map(function (w) { return '<div class="warn">' + esc(w) + "</div>"; }).join(""));
        /* الرسوم لكل عملية، والجهة لكل بند، ولماذا */
        R.ops.forEach(function (o, idx) {
            if (!o.items.length && !o.steps.length) return;
            h.push("<h2>" + (o.kind === "branchExtra" ? "" : (idx + 1) + ". ") + esc(o.name) + "</h2>");
            if (o.steps.length) h.push('<div class="formula"><b>لماذا وكيف:</b><ol class="steps">' + o.steps.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ol></div>");
            if (o.items.length) h.push('<table><thead><tr><th>الجهة</th><th>البند</th><th>ملاحظة</th><th class="n">المبلغ (ل.س)</th></tr></thead><tbody>' +
                o.items.map(function (i) {
                    const note = [i.note, i.dup ? (i.excluded ? "مكرر مع «" + i.dupOf + "» — أُلغي تكراره" : "مكرر مع «" + i.dupOf + "» — يُحتسب مرة ثانية بصفته في هذه العملية") : ""].filter(Boolean).join(" · ");
                    return "<tr><td>" + fundTxt(i.fund) + "</td><td>" + esc(i.label) + "</td><td>" + esc(note) + '</td><td class="n">' + (i.excluded ? "<s>" + fmt(i.amount) + "</s>" : fmt(i.amount)) + "</td></tr>";
                }).join("") + '<tr class="total"><td colspan="3">مجموع «' + esc(o.name) + '»</td><td class="n">' + fmt(o.total) + "</td></tr></tbody></table>");
        });
        if (R.years.length) {
            const C = R.scope !== "branch", B = R.scope !== "central";
            h.push("<h2>الرسوم السنوية</h2><table><thead><tr><th>السنة</th><th>الحالة</th>" + (C ? '<th class="n">مركزية</th>' : "") + (B ? '<th class="n">فرع</th>' : "") + '<th class="n">المجموع (ل.س)</th></tr></thead><tbody>' +
                R.years.map(function (y) {
                    const v = function (x) { return y.paid ? "<s>" + fmt(x) + "</s>" : fmt(x); };
                    return "<tr><td>" + y.year + "</td><td>" + (y.paid ? '<span class="yes">مدفوع</span>' : "مستحق") + (y.over45 ? " · رسم من انتسب فوق 45" : "") + "</td>" +
                        (C ? '<td class="n">' + v(y.central) + "</td>" : "") + (B ? '<td class="n">' + v(y.branch) + "</td>" : "") + '<td class="n">' + v(y.amount) + "</td></tr>";
                }).join("") + '<tr class="total"><td colspan="' + (2 + (C ? 1 : 0) + (B ? 1 : 0)) + '">مجموع الرسوم السنوية المستحقة</td><td class="n">' + fmt(R.yearsTotal) + "</td></tr></tbody></table>");
        }
        h.push('<h2>الخلاصة</h2><div class="sum">' +
            (R.scope !== "branch" ? '<div class="box"><div class="l">رسوم النقابة المركزية</div><div class="v">' + fmt(R.centralTotal) + " ل.س</div></div>" : "") +
            (R.scope !== "central" ? '<div class="box"><div class="l">رسوم الفرع</div><div class="v">' + fmt(R.branchTotal) + " ل.س</div></div>" : "") +
            '<div class="box gold"><div class="l">المجموع المطلوب دفعه</div><div class="v">' + fmt(R.total) + ' ل.س</div><div class="w">' +
            (R.items.length ? "البنود " + fmt(R.itemsTotal) : "") + (R.items.length && R.years.length ? " + " : "") + (R.years.length ? "الرسوم السنوية " + fmt(R.yearsTotal) : "") + "</div></div></div>");
        h.push('<h2>كيف حُسب؟ (كامل)</h2><ol class="steps">' + R.steps.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ol>");
        if (c.notes) h.push('<h2>ملاحظات</h2><div class="note">' + esc(c.notes).replace(/\n/g, "<br>") + "</div>");
        h.push(Rp.signBlock(fs.signs || FEES_SIGNS, c));
        h.push('<div class="foot">' + (fs.footer ? esc(fs.footer).replace(/\n/g, "<br>") : "أُعدّ هذا التقرير بواسطة حاسبة المحامي وفق جداول رسوم الانتساب والرسوم السنوية المعتمدة في النقابة المركزية والفروع (المبالغ بالعملة الجديدة)، ويُعتمد بعد تدقيق الإيصالات والوثائق في إضبارة المحامي.") + "</div></div>");
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
            ffill({ kinds: ["new"], scope: "both", status: "active" });
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
            return '<div class="case-row"><div><b>' + esc(c.name) + "</b><small>" + esc((Array.isArray(c.kinds) && c.kinds.length ? c.kinds : [c.kind]).map(function (k) { return F.KINDS[k] || ""; }).join(" + ")) + " · " + esc(F.SCOPE[c.scope] || F.SCOPE.central) + (c.savedTotal != null ? " · " + fmt(c.savedTotal) + " ل.س" : "") +
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
    ffill(draft && (draft.kind || (draft.kinds && draft.kinds.length)) ? draft : { kinds: ["new"], scope: "both", status: "active" });
})();
