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
    let legacyWaive = false;
    let fCurrentId = null, fLastInput = null, fLastResult = null;
    /* «مدفوع» لكل طرف مع تاريخ اختياري. الحسابات القديمة (paidYears) = الطرفان مدفوعان */
    let paidC = [], paidB = [], paidDates = {}, brFee = {};
    /* حالة كل بند (مستحق / مدفوع / مُلغى) و«الطرف مدفوع» لكل عملية */
    let itemState = {}, opPaid = {};
    /* إعدادات قسم الرسوم (pc.feeSettings.v1): الجهة والطباعة والجداول المعدّلة. الغائب = المعتمد */
    const FEES_SIGNS = [{ title: "منظم التقرير", src: "preparer" }, { title: "المدقق", src: "reviewer" }, { title: "الخازن / المحاسب", src: "fixed", name: "" }];
    function feeSettings() { return load(KEY_FSET, null) || {}; }

    /* ---------- الجمع والتعبئة ---------- */
    function fval(n) { const el = fform.elements[n]; if (!el) return ""; if (el.type === "checkbox") return el.checked; return (el.value || "").trim(); }
    function kinds() { return $$("#feeForm input[name=kinds]:checked").map(function (el) { return el.value; }); }
    function scope() { const el = fform.querySelector("input[name=scope]:checked"); return el ? el.value : "both"; }
    function toLatin(s) { return String(s || "").replace(/[٠-٩]/g, function (c) { return "٠١٢٣٤٥٦٧٨٩".indexOf(c); }); }
    let excludeDup = [], exempt = {};
    /* الإعفاءات: لكل عملية مختارة خانتان (مركزية / فرع) وسبب */
    function renderExempt() {
        const ks = kinds().filter(function (k) { return k !== "exempt"; }), sc = scope(), box = $("#exemptBox");
        if (!ks.length) { box.innerHTML = ""; return; }
        const X = F.dataWith(feeSettings().data).flat;
        const BR = { secStruck: X.brStruck, admStruck: X.brStruck, reCancel: X.brReCancel, omitted: X.brOmitted, transfer: X.brTransfer, traineeToMaster: X.brMaster };
        box.innerHTML = '<p class="fee-sub"><i class="ti ti-discount-check"></i> لكل عملية: رسم الفرع والإعفاء <small class="muted">— رسم الفرع يختلف من فرع لفرع: اكتبه إن اختلف (فارغ = الافتراضي من الإعدادات). وإن كان المحامي معفى علّم الطرف واكتب السبب</small></p>' +
            ks.map(function (k) {
                const e = exempt[k] || {};
                const fee = sc !== "central" && (k in BR) ? '<label class="ex-fee"><span>رسم الفرع</span><input data-ef="brfee" inputmode="numeric" class="num-in" placeholder="' + fmt(BR[k]) + '" value="' + esc(brFee[k] || "") + '"></label>' : "";
                return '<div class="ex-row" data-ek="' + k + '"><b>' + esc(F.KINDS[k]) + "</b>" + fee +
                    (sc !== "branch" ? '<label class="check"><input type="checkbox" data-ef="central"' + (e.central ? " checked" : "") + "> معفى من المركزية</label>" : "") +
                    (sc !== "central" ? '<label class="check"><input type="checkbox" data-ef="branch"' + (e.branch ? " checked" : "") + "> معفى من الفرع</label>" : "") +
                    '<label class="check" data-efa' + (e.central || e.branch ? "" : " hidden") + '><input type="checkbox" data-ef="annual"' + (e.annual ? " checked" : "") + "> يشمل الرسوم السنوية</label>" +
                    '<input data-ef="reason" placeholder="سبب الإعفاء" value="' + esc(e.reason || "") + '"' + (e.central || e.branch ? "" : " hidden") + "></div>";
            }).join("");
    }
    function readExempt() {
        $$("#exemptBox [data-ek]").forEach(function (row) {
            const k = row.dataset.ek, c = row.querySelector("[data-ef=central]"), b = row.querySelector("[data-ef=branch]"), r = row.querySelector("[data-ef=reason]"), bf = row.querySelector("[data-ef=brfee]");
            if (bf) { const v = toLatin(bf.value.trim()); if (v) brFee[k] = v; else delete brFee[k]; }
            const an = row.querySelector("[data-ef=annual]");
            const e = { central: c ? c.checked : !!(exempt[k] || {}).central, branch: b ? b.checked : !!(exempt[k] || {}).branch, reason: r.value.trim() };
            if (an && an.checked) e.annual = true;
            if (e.central || e.branch) exempt[k] = e; else delete exempt[k];
            r.hidden = !(e.central || e.branch);
            row.querySelector("[data-efa]").hidden = r.hidden;
        });
    }
    function fcollect() {
        const ks = kinds();
        const c = {
            name: fval("name"), fatherName: fval("fatherName"), regStatus: fval("regStatus"), motherName: fval("motherName"), birthDate: fval("birthDate"),
            nationalId: fval("nationalId"), memberNo: fval("memberNo"), branch: fval("branch"), fileNo: fval("fileNo"), phone: fval("phone"),
            kinds: ks, kind: ks[0] || "", scope: scope(),
            joinDate: fval("joinDate"), status: fval("status") || "active", statusYear: toLatin(fval("statusYear")),
            ageMode: fval("ageDirectOn") ? "direct" : "", ageDirect: toLatin(fval("ageDirect")),
            masterDate: fval("masterDate"), brFee: (function () { const o = {}; ks.forEach(function (k) { if (brFee[k]) o[k] = toLatin(brFee[k]); }); return o; })(),
            eventDate: fval("eventDate"), decisionDate: fval("decisionDate"), gapYears: toLatin(fval("gapYears")), lastPaidYear: toLatin(fval("lastPaidYear")),
            clearance: fval("clearance"), optional: { id: fval("opt_id"), license: fval("opt_license"), badge: fval("opt_badge") },
            branchPrints: { on: fval("bp_on"), amount: toLatin(fval("bp_amount")) },
            excludeDup: excludeDup.slice(),
            exempt: (function () { const o = {}; ks.forEach(function (k) { if (exempt[k]) o[k] = Object.assign({}, exempt[k]); }); return o; })(),
            paidC: paidC.slice(), paidB: paidB.slice(), paidDates: Object.assign({}, paidDates),
            itemState: JSON.parse(JSON.stringify(itemState)), opPaid: JSON.parse(JSON.stringify(opPaid)), preparer: fval("preparer"), reviewer: fval("reviewer"), notes: fval("notes")
        };
        if (legacyWaive) c.secBranchWaived = true;
        if (fCurrentId) c.id = fCurrentId;
        return c;
    }
    function ffill(c) {
        fform.reset();
        const map = {
            opt_id: (c.optional || {}).id, opt_license: (c.optional || {}).license, opt_badge: (c.optional || {}).badge,
            bp_on: (c.branchPrints || {}).on, bp_amount: (c.branchPrints || {}).amount,
            ageDirectOn: c.ageMode === "direct"
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
        const sc = fform.querySelector('input[name=scope][value="' + (c.scope || "central") + '"]');
        if (sc) sc.checked = true;
        const legacyPaid = (c.paidYears || []).map(Number);
        paidC = uniq((c.paidC || []).map(Number).concat(legacyPaid));
        paidB = uniq((c.paidB || []).map(Number).concat(legacyPaid));
        paidDates = Object.assign({}, c.paidDates || {});
        itemState = {};
        Object.keys(c.itemState || {}).forEach(function (k) { itemState[k.replace("|رسم الأستذة", "|رسم النقل إلى جدول الأساتذة")] = c.itemState[k]; });
        excludeDup = (c.excludeDup || []).map(function (k) { return k.replace("|رسم الأستذة", "|رسم النقل إلى جدول الأساتذة"); });
        /* اقتراحات «وضع القيد» من الحسابات المحفوظة */
        const regs = {}; ["أحرار"].concat(load(KEY_FEES, []).map(function (x) { return x.regStatus; })).forEach(function (v) { if (v) regs[v] = 1; });
        $("#regStatusList").innerHTML = Object.keys(regs).map(function (v) { return '<option value="' + esc(v) + '"></option>'; }).join("");
        opPaid = JSON.parse(JSON.stringify(c.opPaid || {}));
        brFee = Object.assign({}, c.brFee || {});
        if (c.brMasterAmount && !brFee.traineeToMaster) brFee.traineeToMaster = c.brMasterAmount; /* حقل قديم */
        /* التقرير المعروض يخص الحساب السابق: يُفرَّغ عند فتح حساب آخر أو بدء حساب جديد */
        clearReport();
        exempt = JSON.parse(JSON.stringify(c.exempt || {}));
        /* الخيار القديم «إعفاء المشطوب الأمني من رسم الفرع» يبقى كما حُفظ */
        legacyWaive = !!c.secBranchWaived;
        fCurrentId = c.id || null;
        renderExempt();
        $("#moreInfo").open = ["motherName", "nationalId", "memberNo", "branch", "fileNo", "phone"].some(function (n) { return !!c[n]; });
        $("#rptInfo").open = !!(c.preparer || c.reviewer || c.notes);
        if (typeof checkSame === "function") setTimeout(checkSame, 0);
        $("#feeBadge").textContent = fCurrentId ? "حساب محفوظ: " + (c.name || "") : "حساب جديد";
        frefresh();
    }

    /* إظهار الحقول حسب العمليات المختارة والنطاق والوضع */
    function frefresh() {
        const ks = kinds(), st = fval("status"), sc = scope();
        $$("#feeForm [data-fk]").forEach(function (el) { el.hidden = !el.getAttribute("data-fk").split(" ").some(function (k) { return ks.indexOf(k) >= 0; }); });
        $$("#feeForm [data-fstatus]").forEach(function (el) {
            const byFk = el.hasAttribute("data-fk") && el.hidden;
            el.hidden = byFk || el.getAttribute("data-fstatus").split(" ").indexOf(st) < 0;
        });
        $("#branchBox").hidden = sc === "central" || ks.indexOf("new") < 0;
        const direct = fval("ageDirectOn") && ks.indexOf("new") >= 0;
        $$("#feeForm [data-agedirect]").forEach(function (el) { if (!el.hidden) el.hidden = !fval("ageDirectOn"); });
        /* العمر المباشر يخص الانتساب: يُخفي تاريخ الميلاد إلا إذا احتاجته عملية أخرى (إعادة القيد) */
        $("#feeForm [data-birth]").hidden = direct && !ks.some(function (k) { return k === "admStruck" || k === "reCancel"; });
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
            traineeToMaster: both("مركزية " + n(X.tmUnion + X.tmPension + X.tmLicenseFee + X.tmId + X.tmLicensePrice) + " من 1/3/2026 (" + n(X.tmOld) + " قبلها)", n(X.brMaster))
        };
        Object.keys(hints).forEach(function (k) { const el = fform.querySelector('input[name=kinds][value="' + k + '"] + span small'); if (el) el.textContent = hints[k]; });
        $$("#feeForm .opt-row .check").forEach(function (l) {
            const nm = l.querySelector("input").name, v = { opt_id: X.optId, opt_license: X.optLicense, opt_badge: X.optBadge }[nm];
            l.lastChild.textContent = " " + { opt_id: "الهوية", opt_license: "إجازة المحاماة", opt_badge: "شارة الصدر" }[nm] + " (" + n(v) + ")";
        });
        const w = fform.elements.secBranchWaived; if (w) w.parentNode.lastChild.textContent = " إعفاء المشطوب الأمني من رسم إعادة القيد للفرع (" + n(X.brStruck) + ")";
    }
    const FUNDTAG = function (f) { return '<span class="fund-tag ' + f + '">' + F.FUND[f] + "</span>"; };
    function renderLive() {
        const c = fcollect(), R = compute(c), box = $("#feeLive");
        if (R.errors.length) {
            box.innerHTML = '<div class="res-head"><h3><i class="ti ti-calculator"></i>النتيجة</h3></div><p class="muted">' + R.errors.map(esc).join("<br>") + "</p>";
            return;
        }
        const wasOpen = !!box.querySelector("details.res-more[open]"), howOpen = !!box.querySelector("details.how[open]");
        let h = '<div class="res-head"><h3><i class="ti ti-calculator"></i>النتيجة <small>(' + esc(R.scopeName) + ')</small></h3><span class="res-total">' + fmt(R.total) + " <small>ل.س</small></span></div>";
        if (R.warnings.length) h += R.warnings.map(function (w) { return '<div class="field-warn"><i class="ti ti-alert-triangle"></i>' + esc(w) + "</div>"; }).join("");

        /* الخلاصة البسيطة: أولاً المركزية، ثانياً الفرع (كل الرسوم)، ثم المحسوم وسببه، ثم المتبقي */
        const many = R.ops.length > 1, ORD = ["أولاً", "ثانياً"];
        const parties = ["central", "branch"].filter(function (f) { return f === "central" ? R.scope !== "branch" : R.scope !== "central"; });
        const yrRange = function (f) {
            const ys = R.years.filter(function (y) { return y[f] > 0 || (y.exempt === f || y.exempt === "both"); });
            return ys.length ? ys[0].year + (ys.length > 1 ? "–" + ys[ys.length - 1].year : "") : "";
        };
        let sum = '<div class="res-sum">';
        parties.forEach(function (f, n) {
            const rows = R.items.filter(function (i) { return i.fund === f && !(i.excluded && !i.exempt); });
            const yGross = R.years.reduce(function (a, y) { return a + y[f]; }, 0), yCount = R.years.filter(function (y) { return y[f] > 0; }).length;
            const gross = (R.summary && R.summary[f]) ? R.summary[f].original : 0;
            sum += '<div class="res-party ' + f + '"><p class="res-title">' + ORD[n] + ": " + (f === "central" ? "النقابة المركزية" : "الفرع") + "</p><ul>" +
                rows.map(function (i) { return "<li><span>" + esc(i.label) + (many ? ' <small class="muted">— ' + esc(F.KINDS[i.op] || "") + "</small>" : "") + '</span><b class="n">' + fmt(i.amount) + "</b></li>"; }).join("") +
                (yCount ? "<li><span>الرسم السنوي " + yrRange(f) + ' <small class="muted">(' + yCount + " سنة)</small></span><b class=\"n\">" + fmt(yGross) + "</b></li>" : "") +
                (!rows.length && !yCount ? '<li class="muted"><span>لا رسوم</span><b></b></li>' : "") +
                '</ul><p class="res-sub"><span>مجموع ' + (f === "central" ? "المركزية" : "الفرع") + '</span><b class="n">' + fmt(gross) + "</b></p></div>";
        });
        const ded = [];
        R.items.forEach(function (i) {
            if (i.exempt) ded.push({ t: i.label, f: i.fund, a: i.amount, why: "معفى" + (R.exempt && R.exempt[i.op] && R.exempt[i.op].reason ? ": " + R.exempt[i.op].reason : "") });
            else if (!i.excluded && i.state === "paid") ded.push({ t: i.label, f: i.fund, a: i.amount, why: "مدفوع سابقاً" + (i.paidNote ? " — " + i.paidNote : "") + (i.paidDate ? " (" + F.fmtDate(i.paidDate) + ")" : "") });
            else if (!i.excluded && i.state === "cancel") ded.push({ t: i.label, f: i.fund, a: i.amount, why: "مُلغى" + (i.cancelReason ? ": " + i.cancelReason : "") });
        });
        R.years.forEach(function (y) {
            [["central", "paidC", "c"], ["branch", "paidB", "b"]].forEach(function (p) {
                if (y[p[1]] && y[p[0]]) ded.push({ t: "الرسم السنوي " + y.year, f: p[0], a: y[p[0]], why: "مدفوع سابقاً" + (paidDates[p[2] + y.year] ? " (" + F.fmtDate(paidDates[p[2] + y.year]) + ")" : "") });
            });
        });
        if (ded.length) {
            const dTot = ded.reduce(function (a, d) { return a + d.a; }, 0);
            sum += '<div class="res-party ded"><p class="res-title">' + (parties.length > 1 ? "ثالثاً" : "ثانياً") + ": المحسوم (لا يُطلب)</p><ul>" +
                ded.map(function (d) { return "<li><span>" + esc(d.t) + " " + FUNDTAG(d.f) + '<br><small class="muted">' + esc(d.why) + '</small></span><b class="n">− ' + fmt(d.a) + "</b></li>"; }).join("") +
                '</ul><p class="res-sub"><span>مجموع المحسوم</span><b class="n">− ' + fmt(dTot) + "</b></p></div>";
        }
        sum += "</div>";
        sum += '<div class="res-final"><span>المجموع المتبقي المطلوب دفعه</span><b>' + fmt(R.total) + " ل.س</b>" +
            (R.scope === "both" ? '<small>المركزية ' + fmt(R.centralTotal) + " · الفرع " + fmt(R.branchTotal) + "</small>" : "") + "</div>";
        h += sum;

        /* التفاصيل: البنود بحالاتها (مستحق / مدفوع / مُلغى) والرسوم السنوية وكيف حُسب */
        let det = "";
        R.ops.forEach(function (op) {
            if (!op.items.length) return;
            const funds = ["central", "branch"].filter(function (f) { return op.items.some(function (i) { return i.fund === f && !i.exempt; }); });
            const op_ = opPaid[op.kind] || {};
            const toggles = funds.map(function (f) {
                return '<label class="op-paid' + (op_[f] ? " on" : "") + '"><input type="checkbox" data-opp="' + op.kind + "|" + f + '"' + (op_[f] ? " checked" : "") + "> " + (f === "central" ? "المركزية مدفوعة" : "الفرع مدفوع") + "</label>";
            }).join("");
            det += '<div class="op-head"><p class="fee-sub">' + esc(op.name) + "</p>" + (toggles ? '<div class="op-toggles">' + toggles + "</div>" : "") + "</div>" +
                '<div class="table-wrap"><table class="fee-tbl ops-tbl"><thead><tr><th>الجهة</th><th>البند</th><th>الحالة</th><th class="n">المبلغ</th></tr></thead><tbody>' +
                op.items.map(function (i) {
                    const dup = i.dup ? '<label class="dup-chk" title="بند مكرر مع «' + esc(i.dupOf) + '»"><input type="checkbox" data-dup="' + esc(i.key) + '"' + (i.excluded && !i.exempt ? "" : " checked") + "> مكرر: يُحتسب</label>" : "";
                    const exm = i.exempt ? ' <span class="ex-tag">معفى</span>' : "";
                    let st = "";
                    if (!i.excluded) {
                        st = '<select class="it-state st-' + i.state + '" data-is="' + esc(i.key) + '"><option value="due"' + (i.state === "due" ? " selected" : "") + '>مستحق</option><option value="paid"' + (i.state === "paid" ? " selected" : "") + '>مدفوع</option><option value="cancel"' + (i.state === "cancel" ? " selected" : "") + ">مُلغى</option></select>";
                        if (i.state === "paid") st += '<input type="date" class="yr-date" data-isd="' + esc(i.key) + '" value="' + esc(i.paidDate || "") + '" title="تاريخ الدفع (اختياري)"><input class="it-reason" data-isn="' + esc(i.key) + '" placeholder="ملاحظة: مثلاً دُفع في الفرع" value="' + esc(i.paidNote || "") + '">';
                        if (i.state === "cancel") st += '<input class="it-reason" data-isr="' + esc(i.key) + '" placeholder="سبب الإلغاء" value="' + esc(i.cancelReason || "") + '">';
                    } else st = '<span class="muted">' + (i.exempt ? "معفى" : "تكرار ملغى") + "</span>";
                    const off = i.excluded || i.state !== "due";
                    return '<tr class="' + (off ? "is-excluded" : "") + '"><td>' + FUNDTAG(i.fund) + "</td><td>" + esc(i.label) + exm + (i.note ? ' <small class="muted">(' + esc(i.note) + ")</small>" : "") + dup +
                        '</td><td class="it-st">' + st + '</td><td class="n">' + (off ? "<s>" + fmt(i.amount) + "</s>" : fmt(i.amount)) + "</td></tr>";
                }).join("") + '</tbody><tfoot><tr><td colspan="3">المطلوب من «' + esc(op.name) + '»' + (op.original !== op.total ? ' <small>(الأصل ' + fmt(op.original) + ")</small>" : "") + '</td><td class="n">' + fmt(op.total) + "</td></tr></tfoot></table></div>";
        });
        if (R.years.length) {
            const showB = R.scope !== "central", showC = R.scope !== "branch";
            const cell = function (y, f) {
                const amt = y[f], st = y[f === "central" ? "cStatus" : "bStatus"], paid = y[f === "central" ? "paidC" : "paidB"], k = (f === "central" ? "c" : "b") + y.year;
                if (!amt) return '<td class="n muted">' + (st === "missing" ? "غير محدد" : y.exempt === f || y.exempt === "both" ? "معفى" : "—") + "</td>";
                return '<td><div class="yr-cell' + (paid ? " paid" : "") + '"><span class="n">' + fmt(amt) + (st === "estimate" ? ' <small class="muted">تقديري</small>' : "") + "</span>" +
                    '<label class="yr-paid"><input type="checkbox" data-pf="' + k + '"' + (paid ? " checked" : "") + "> مدفوع</label>" +
                    (paid ? '<input type="date" class="yr-date" data-pd="' + k + '" value="' + esc(paidDates[k] || "") + '" title="تاريخ الدفع (اختياري)">' : "") + "</div></td>";
            };
            det += '<p class="fee-sub">الرسوم السنوية <small class="muted">— علّم ما دفعه المحامي لكل طرف، ويمكن كتابة تاريخ الدفع</small></p>' +
                '<div class="table-wrap"><table class="fee-tbl yr-tbl"><thead><tr><th>السنة</th>' + (showC ? "<th>مركزية</th>" : "") + (showB ? "<th>فرع</th>" : "") + '<th class="n">المستحق</th></tr></thead><tbody>' +
                R.years.map(function (y) {
                    return "<tr><td><b>" + y.year + "</b>" + (y.over45 ? ' <small class="muted">فوق 45</small>' : "") + "</td>" + (showC ? cell(y, "central") : "") + (showB ? cell(y, "branch") : "") + '<td class="n"><b>' + fmt(y.due) + "</b></td></tr>";
                }).join("") + '</tbody><tfoot><tr><td colspan="' + (1 + (showC ? 1 : 0) + (showB ? 1 : 0)) + '">مجموع الرسوم السنوية المستحقة</td><td class="n">' + fmt(R.yearsTotal) + "</td></tr></tfoot></table></div>";
        }
        det += '<details class="how"' + (howOpen ? " open" : "") + '><summary><i class="ti ti-info-circle"></i>كيف حُسب؟</summary><ol>' + R.steps.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ol></details>";
        h += '<details class="res-more"' + (wasOpen ? " open" : "") + '><summary><i class="ti ti-list-details"></i>التفاصيل: تعليم المدفوع والملغى لكل بند وسنة، و«الطرف مدفوع»، وكيف حُسب</summary>' + det + "</details>";
        const ae = document.activeElement, keep = ae && box.contains(ae) ? ["data-pf", "data-pd", "data-dup", "data-is", "data-isd", "data-isr", "data-isn", "data-opp"].filter(function (a) { return ae.hasAttribute(a); }).map(function (a) { return "[" + a + '="' + ae.getAttribute(a) + '"]'; })[0] : null;
        box.innerHTML = h;
        if (keep) { const el = box.querySelector(keep); if (el) el.focus(); }
    }
    $("#feeLive").addEventListener("change", function (e) {
        const is = e.target.closest("[data-is]"), isd = e.target.closest("[data-isd]"), isr = e.target.closest("[data-isr]"), opp = e.target.closest("[data-opp]");
        if (is) {
            const k = is.dataset.is, prev = itemState[k] || {};
            itemState[k] = is.value === "paid" ? { s: "paid", date: prev.date || "", note: prev.note || "" } : is.value === "cancel" ? { s: "cancel", reason: prev.reason || "" } : { s: "due" };
            const md = $("#feeLive details.res-more"); if (md) md.open = true;
            renderLive(); fsaveDraft(); return;
        }
        const isn = e.target.closest("[data-isn]");
        if (isd) { const k = isd.dataset.isd; itemState[k] = Object.assign({}, itemState[k], { s: "paid", date: isd.value || "" }); renderLive(); fsaveDraft(); return; }
        if (isn) { const k = isn.dataset.isn; itemState[k] = Object.assign({}, itemState[k], { s: "paid", note: isn.value.trim() }); renderLive(); fsaveDraft(); return; }
        if (isr) { const k = isr.dataset.isr; itemState[k] = { s: "cancel", reason: isr.value.trim() }; renderLive(); fsaveDraft(); return; }
        if (opp) {
            const pr = opp.dataset.opp.split("|"), o = opPaid[pr[0]] || {};
            o[pr[1]] = opp.checked; if (!o.central && !o.branch) delete opPaid[pr[0]]; else opPaid[pr[0]] = o;
            /* الزر يحكم بنود الطرف كلها: تُمسح الحالات الفردية لبنود ذلك الطرف في العملية */
            Object.keys(itemState).forEach(function (k) { if (k.indexOf(pr[0] + "|" + pr[1] + "|") === 0) delete itemState[k]; });
            renderLive(); fsaveDraft(); return;
        }
        const cb = e.target.closest("[data-pf]"), dp = e.target.closest("[data-dup]"), pd = e.target.closest("[data-pd]");
        if (pd) { if (pd.value) paidDates[pd.dataset.pd] = pd.value; else delete paidDates[pd.dataset.pd]; fsaveDraft(); return; }
        if (cb) {
            const k = cb.dataset.pf, y = +k.slice(1), isC = k[0] === "c";
            if (isC) { paidC = paidC.filter(function (x) { return x !== y; }); if (cb.checked) paidC.push(y); }
            else { paidB = paidB.filter(function (x) { return x !== y; }); if (cb.checked) paidB.push(y); }
            if (!cb.checked) delete paidDates[k];
        }
        if (dp) {
            excludeDup = excludeDup.filter(function (k) { return k !== dp.dataset.dup; });
            if (!dp.checked) excludeDup.push(dp.dataset.dup);
        }
        if (cb || dp) { renderLive(); fsaveDraft(); }
    });

    fform.addEventListener("change", function (e) {
        if (e.target.closest("#feeLive")) return;
        if (e.target.closest("#exemptBox")) { readExempt(); renderLive(); fsaveDraft(); return; }
        if (e.target.name === "scope") updateHints();
        if (e.target.name === "scope" || e.target.name === "kinds") renderExempt();
        frefresh(); fsaveDraft();
    });
    fform.addEventListener("input", function (e) {
        if (e.target.classList.contains("num-in")) { const v = toLatin(e.target.value); if (v !== e.target.value) e.target.value = v; }
        if (e.target.closest("#exemptBox")) readExempt();
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
    /* ---------- بيان الرسوم الرسمي (قرار المالك 2026-11-27): مختصر، صفحتان تقريباً ----------
       الترويسة ← بيانات المحامي ووضع القيد ← أولاً المركزية ← ثانياً الفرع ← الرسوم السنوية ← الإجمالي ← التوقيع */
    function buildReport(c, R) {
        const fs = feeSettings();
        const d = function (s) { return s ? F.fmtDate(s) : ""; };
        const has = function (k) { return R.kinds.indexOf(k) >= 0; };
        const now = new Date();
        const C = R.scope !== "branch", B = R.scope !== "central";
        const many = R.ops.length > 1;
        const h = [];
        h.push('<div class="rpt rpt-official' + Rp.sizeClass(fs.fontSize) + '">');
        if (window.Letterhead) h.push(Letterhead.html(fs));
        h.push('<div class="doc-title"><h1>بيان رسوم</h1><div class="sub">' + esc(R.kindName) + "</div>" +
            '<div class="meta">التاريخ: ' + now.getDate() + "/" + (now.getMonth() + 1) + "/" + now.getFullYear() +
            (c.fileNo ? " · رقم الإضبارة: " + esc(c.fileNo) : "") + (c.memberNo ? " · رقم العضوية: " + esc(c.memberNo) : "") + " · " + esc(R.scopeName) + "</div></div>");
        if (fs.org) h.push('<p class="brief" style="text-align:center"><b>' + esc(fs.org) + "</b></p>");

        /* بيانات المحامي: سطران بأربعة أعمدة، ووضع القيد مميز */
        const age = R.age ? R.age.raw + " سنة" + (R.age.direct ? "" : " (" + esc(F.fmtYMD(R.age.ymd)) + ")") + (R.age.row !== R.age.raw ? " ← سطر " + R.age.row : "") : "";
        const pairs = [
            ["الاسم", esc(c.name)], ["اسم الأب", esc(c.fatherName)],
            ["وضع القيد", c.regStatus ? '<span class="reg-badge">' + esc(c.regStatus) + "</span>" : ""],
            [R.age && R.age.direct ? "العمر" : "تاريخ الميلاد", R.age && R.age.direct ? age : d(c.birthDate)],
            ["العمر المعتمد", R.age && !R.age.direct ? age : ""],
            ["اسم الأم", esc(c.motherName)], ["الرقم الوطني", esc(c.nationalId)], ["الفرع", esc(c.branch)],
            [has("new") ? "تاريخ الانتساب" : "تاريخ الانتساب الأصلي", d(c.joinDate)],
            ["وضع المحامي", has("new") ? esc(F.STATUS[c.status] || "") + (c.status !== "active" ? " — " + esc(c.statusYear) : "") : ""],
            ["تاريخ القرار", ["secStruck", "admStruck", "reCancel", "omitted"].some(has) ? d(c.decisionDate) : ""],
            [has("admStruck") ? "تاريخ الشطب" : "تاريخ الترقين", (has("admStruck") || has("reCancel") || has("cancelSelf")) ? d(c.eventDate) : ""],
            ["تاريخ النقل إلى جدول الأساتذة", has("traineeToMaster") ? (c.masterDate ? d(c.masterDate) : "اليوم") : ""],
            ["براءة الذمة", has("transfer") ? (c.clearance ? '<span class="yes">بريء الذمة</span>' : '<span class="no">لم تُؤكَّد</span>') : ""]
        ].filter(function (p) { return p[1]; });
        let rows = "";
        for (let i = 0; i < pairs.length; i += 2) {
            const a = pairs[i], b = pairs[i + 1];
            rows += '<tr><td class="k">' + a[0] + "</td><td>" + a[1] + "</td>" + (b ? '<td class="k">' + b[0] + "</td><td>" + b[1] + "</td>" : '<td class="k"></td><td></td>') + "</tr>";
        }
        h.push('<table class="info"><tbody>' + rows + "</tbody></table>");

        /* شرح خفيف لكل قسم: سطر لكل عملية */
        const brief = function (op, f) {
            const k = op.kind;
            if (k === "new") return f === "central" ? "جدول رسوم الانتساب لعام " + R.table + "، سطر العمر " + (R.age ? R.age.row : "") + " (البنود ما عدا الرسم السنوي)."
                : "جدول رسوم الانتساب للفروع لعام " + R.branchTable + "، سطر العمر " + (R.age ? R.age.row : "") + ".";
            if (k === "traineeToMaster") return f === "central" ? "رسم النقل إلى جدول الأساتذة " + (op.items.some(function (i) { return i.note === "قبل 1/3/2026"; }) ? "قبل 1/3/2026." : "من 1/3/2026.") : "رسم الفرع للنقل إلى جدول الأساتذة.";
            if (k === "admStruck" || k === "reCancel") return f === "central" ? "رسوم إعادة القيد" + (R.gapYears ? " مع " + R.gapYears + " سنة انقطاع" : "") + "." : "رسم الفرع لإعادة القيد.";
            if (k === "omitted") return f === "central" ? "رسم استعادة القيد، والرسوم السنوية غير المدفوعة في قسمها." : "رسم الفرع لإعادة قيد المُغفَل.";
            if (k === "transfer") return f === "central" ? "رسم النقل من فرع إلى آخر." : "رسم الفرع للنقل.";
            if (k === "secStruck") return f === "central" ? "رسومه السنوية فقط (في قسمها)." : "رسم الفرع لإعادة قيد المشطوب.";
            return "";
        };
        const section = function (f, ord) {
            const ops = R.ops.filter(function (op) { return op.items.some(function (i) { return i.fund === f; }); });
            const title = ord + ": " + (f === "central" ? "رسوم النقابة المركزية" : "رسوم الفرع");
            const cls = f === "central" ? "c" : "b";
            if (!ops.length) return '<h2 class="sec-' + cls + '">' + title + '</h2><p class="brief">لا رسوم ' + (f === "central" ? "مركزية" : "للفرع") + " في هذه العمليات" + (R.years.some(function (y) { return y[f]; }) ? " عدا الرسوم السنوية." : ".") + "</p>";
            let t = '<h2 class="sec-' + cls + '">' + title + "</h2>";
            const br = ops.map(function (op) { const x = brief(op, f); return x ? (many ? "<b>" + esc(op.name) + ":</b> " : "") + esc(x) : ""; }).filter(Boolean);
            if (br.length) t += '<p class="brief">' + br.join("<br>") + "</p>";
            let sum = 0, body = "";
            const exNotes = [];
            ops.forEach(function (op) {
                if (many) body += '<tr class="grp"><td colspan="3">' + esc(op.name) + "</td></tr>";
                op.items.filter(function (i) { return i.fund === f && !(i.excluded && !i.exempt); }).forEach(function (i) {
                    const off = i.exempt || i.state !== "due";
                    const st = i.exempt ? "معفى" : i.state === "paid" ? "مدفوع سابقاً" + (i.paidNote ? " — " + i.paidNote : "") + (i.paidDate ? " " + F.fmtDate(i.paidDate) : "") : i.state === "cancel" ? "مُلغى" + (i.cancelReason ? ": " + i.cancelReason : "") : (i.dup ? "مكرر مع «" + i.dupOf + "»" : "");
                    sum += i.amount;
                    body += "<tr" + (off ? ' class="off"' : "") + "><td>" + esc(i.label) + '</td><td class="n">' + (off ? "<s>" + fmt(i.amount) + "</s>" : fmt(i.amount)) + '</td><td class="st">' + esc(st) + "</td></tr>";
                });
                const e = R.exempt && R.exempt[op.kind];
                if (e && e[f]) exNotes.push((many ? op.name + ": " : "") + "معفى من " + (f === "central" ? "رسوم النقابة المركزية" : "رسوم الفرع") + (e.annual ? " مع الرسوم السنوية" : "") + (e.reason ? " — السبب: " + e.reason : ""));
            });
            t += '<table class="t' + cls + '"><thead><tr><th>البند</th><th class="n">المبلغ (ل.س)</th><th>ملاحظة</th></tr></thead><tbody>' + body +
                '<tr class="total"><td>مجموع ' + (f === "central" ? "رسوم المركزية" : "رسوم الفرع") + '</td><td class="n">' + fmt(sum) + "</td><td></td></tr></tbody></table>";
            if (exNotes.length) t += exNotes.map(function (x) { return '<div class="ex-note">' + esc(x) + "</div>"; }).join("");
            return t;
        };
        const ords = ["أولاً", "ثانياً", "ثالثاً", "رابعاً"];
        let n = 0;
        if (C) h.push(section("central", ords[n++]));
        if (B) h.push(section("branch", ords[n++]));

        /* الرسوم السنوية: الجهة ولماذا */
        if (R.years.length) {
            const first = R.years[0].year, last = R.years[R.years.length - 1].year;
            const why = has("new") ? "عن كل سنة من سنة الانتساب " + first + " حتى " + last + (has("new") && c.status !== "active" ? " (" + (F.STATUS[c.status] || "") + ")" : " (قيده سارٍ)") + "."
                : has("secStruck") ? "المشطوب يدفع الرسم السنوي لكل سنة من " + first + " حتى سنة القرار " + last + "."
                : "الرسوم السنوية غير المدفوعة من " + first + " حتى " + last + ".";
            const parts = (C ? "المركزية" + (R.over45 ? " (رسم من انتسب فوق 45)" : "") : "") + (C && B ? "، و" : "") + (B ? "الفرع (من 2026 فقط)" : "");
            let yb = "";
            R.years.forEach(function (y) {
                const notes = [];
                if (y.paidC) notes.push("المركزية مدفوعة" + (y.paidDateC ? " " + F.fmtDate(y.paidDateC) : ""));
                if (y.paidB) notes.push("الفرع مدفوع" + (y.paidDateB ? " " + F.fmtDate(y.paidDateB) : ""));
                if (y.exempt) notes.push("معفى" + (y.exempt === "both" ? "" : y.exempt === "central" ? " من المركزية" : " من الفرع"));
                if (y.cStatus === "estimate" || y.bStatus === "estimate") notes.push("تقديري");
                if (y.cStatus === "missing" || y.bStatus === "missing") notes.push("غير محدد");
                const v = function (a, p) { return a ? (p ? "<s>" + fmt(a) + "</s>" : fmt(a)) : "—"; };
                yb += "<tr" + (y.paid ? ' class="off"' : "") + "><td>" + y.year + "</td>" + (C ? '<td class="n">' + v(y.central, y.paidC) + "</td>" : "") + (B ? '<td class="n">' + v(y.branch, y.paidB) + "</td>" : "") + '<td class="st">' + esc(notes.join(" · ")) + "</td></tr>";
            });
            h.push('<h2 class="sec-y">' + ords[n++] + ": الرسوم السنوية</h2>" + '<p class="brief">' + esc(why) + " الجهة: " + esc(parts) + ".</p>" +
                '<table class="ty"><thead><tr><th>السنة</th>' + (C ? '<th class="n">المركزية</th>' : "") + (B ? '<th class="n">الفرع</th>' : "") + "<th>ملاحظة</th></tr></thead><tbody>" + yb +
                '<tr class="total"><td>المستحق من الرسوم السنوية</td>' + (C ? '<td class="n">' + fmt(R.years.reduce(function (a, y) { return a + (y.paidC ? 0 : y.central); }, 0)) + "</td>" : "") +
                (B ? '<td class="n">' + fmt(R.years.reduce(function (a, y) { return a + (y.paidB ? 0 : y.branch); }, 0)) + "</td>" : "") + "<td></td></tr></tbody></table>");
        }

        /* الإجمالي: الرسوم، المحسوم بأنواعه، المطلوب */
        const SM = R.summary || {}, sf = ["central", "branch"].filter(function (f) { return (f === "central" ? C : B) && SM[f]; });
        const line = function (key, label, neg, cls) {
            const vals = sf.map(function (f) { return SM[f][key]; }), tot = vals.reduce(function (a, b) { return a + b; }, 0);
            if (neg && !tot) return "";
            return "<tr" + (cls ? ' class="' + cls + '"' : "") + "><td>" + label + "</td>" + vals.map(function (v) { return '<td class="n">' + (neg && v ? "− " : "") + fmt(v) + "</td>"; }).join("") + (sf.length > 1 ? '<td class="n">' + (neg && tot ? "− " : "") + fmt(tot) + "</td>" : "") + "</tr>";
        };
        h.push('<h2 class="sec-t">الإجمالي</h2><table class="tt"><thead><tr><th>البيان</th>' + sf.map(function (f) { return '<th class="n">' + (f === "central" ? "النقابة المركزية" : "الفرع") + "</th>"; }).join("") + (sf.length > 1 ? '<th class="n">المجموع</th>' : "") + "</tr></thead><tbody>" +
            line("original", "مجموع الرسوم") + line("paid", "المدفوع سابقاً", true) + line("cancelled", "المُلغى", true) + line("exempt", "المعفى منه", true) + line("due", "المطلوب دفعه", false, "total") + "</tbody></table>");
        h.push('<div class="final"><div class="l">المبلغ المطلوب دفعه</div><div class="v">' + fmt(R.total) + ' ل.س</div>' +
            (sf.length > 1 ? '<div class="w">النقابة المركزية ' + fmt(R.centralTotal) + " · الفرع " + fmt(R.branchTotal) + "</div>" : "") + "</div>");
        if (R.warnings.length) h.push('<div class="note"><b>تنبيه:</b> ' + R.warnings.map(esc).join("<br>") + "</div>");
        if (c.notes) h.push('<div class="note"><b>ملاحظات:</b> ' + esc(c.notes).replace(/\n/g, "<br>") + "</div>");
        h.push(Rp.signBlock(fs.signs || FEES_SIGNS, c));
        h.push('<div class="foot">' + (fs.footer ? esc(fs.footer).replace(/\n/g, "<br>") : "أُعدّ هذا البيان وفق جداول الرسوم المعتمدة في النقابة المركزية والفروع (المبالغ بالعملة الجديدة)، ويُعتمد بعد تدقيق الإيصالات في إضبارة المحامي.") + "</div></div>");
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
            /* التقرير يُفرَّغ عند فتح أي حساب آخر، فهو والنموذج للسجل نفسه دائماً */
            fCurrentId = c.id;
            $("#feeBadge").textContent = "حساب محفوظ: " + c.name;
            fsaveDraft(); checkSame();
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
            fsaveDraft();
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
            if (!store(KEY_FEES, load(KEY_FEES, []).filter(function (x) { return x.id !== c.id; }))) { toast("تعذر الحذف في هذا المتصفح.", "bad"); return; }
            if (fCurrentId === c.id) { fCurrentId = null; $("#feeBadge").textContent = "حساب جديد"; fsaveDraft(); }
            if (fLastInput && fLastInput.id === c.id) clearReport();
            renderList(); checkSame(); toast("حُذف الحساب", "ok");
        }
    });

    function uniq(a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); }
    function clearReport() {
        fLastInput = null; fLastResult = null;
        $("#feeReport").innerHTML = ""; $("#feeReportEmpty").hidden = false; $("#feeReportBox").hidden = true;
    }

    /* ---------- الشخص نفسه في حسابات محفوظة: تنبيه بما دفعه سابقاً ---------- */
    function key(s) { return norm(String(s || "").trim()).replace(/[\u064B-\u0652\u0640]/g, "").replace(/\s+/g, " "); }
    function samePerson(a, b) {
        if (key(a.fileNo) && key(a.fileNo) === key(b.fileNo)) return true;
        return !!(key(a.name) && key(a.fatherName) && key(a.motherName) && key(a.name) === key(b.name) && key(a.fatherName) === key(b.fatherName) && key(a.motherName) === key(b.motherName));
    }
    function paidOf(c) {
        const legacy = (c.paidYears || []).map(Number), d = c.paidDates || {};
        const list = function (arr, p) { return uniq(arr.map(Number).concat(legacy)).sort().map(function (y) { return y + (d[p + y] ? " (" + F.fmtDate(d[p + y]) + ")" : ""); }); };
        return { c: list(c.paidC || [], "c"), b: list(c.paidB || [], "b") };
    }
    let sameMatches = [];
    function checkSame() {
        const cur = { name: fval("name"), fatherName: fval("fatherName"), motherName: fval("motherName"), fileNo: fval("fileNo") }, box = $("#samePerson");
        sameMatches = load(KEY_FEES, []).filter(function (x) { return x.id !== fCurrentId && samePerson(cur, x); });
        if (!sameMatches.length) { box.classList.add("hidden"); box.innerHTML = ""; return; }
        box.classList.remove("hidden");
        box.innerHTML = '<div class="alert warn"><b><i class="ti ti-user-search"></i> يوجد حساب محفوظ للشخص نفسه (' + sameMatches.length + ')</b><ul class="imp-list">' +
            sameMatches.map(function (x) {
                const p = paidOf(x);
                return "<li><b>" + esc(x.name) + "</b> · " + esc((x.kinds && x.kinds.length ? x.kinds : [x.kind]).map(function (k) { return F.KINDS[k] || ""; }).join(" + ")) +
                    (x.savedAt ? " · حُفظ " + new Date(x.savedAt).toLocaleDateString("ar-SY") : "") +
                    "<br>دفع مركزية: " + (p.c.length ? esc(p.c.join("، ")) : "لا شيء مسجل") + " — دفع فرع: " + (p.b.length ? esc(p.b.join("، ")) : "لا شيء مسجل") + "</li>";
            }).join("") + "</ul>" +
            '<button type="button" class="btn sm" data-same-apply><i class="ti ti-checks"></i>اعتبر ما دفعه هناك مدفوعاً هنا</button></div>';
    }
    $("#samePerson").addEventListener("click", function (e) {
        if (!e.target.closest("[data-same-apply]")) return;
        let n = 0;
        sameMatches.forEach(function (x) {
            const legacy = (x.paidYears || []).map(Number), d = x.paidDates || {};
            (x.paidC || []).map(Number).concat(legacy).forEach(function (y) { if (paidC.indexOf(y) < 0) { paidC.push(y); n++; } if (d["c" + y] && !paidDates["c" + y]) paidDates["c" + y] = d["c" + y]; });
            (x.paidB || []).map(Number).concat(legacy).forEach(function (y) { if (paidB.indexOf(y) < 0) { paidB.push(y); n++; } if (d["b" + y] && !paidDates["b" + y]) paidDates["b" + y] = d["b" + y]; });
        });
        renderLive(); fsaveDraft();
        toast(n ? "عُلّمت " + n + " دفعة سابقة مدفوعةً في هذا الحساب." : "لا دفعات جديدة لتعليمها.", n ? "ok" : "warn");
    });
    ["name", "fatherName", "motherName", "fileNo"].forEach(function (n) { fform.elements[n].addEventListener("input", function () { clearTimeout(checkSame._t); checkSame._t = setTimeout(checkSame, 350); }); });

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
