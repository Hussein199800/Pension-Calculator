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
                    '<input data-ef="reason" placeholder="سبب الإعفاء" value="' + esc(e.reason || "") + '"' + (e.central || e.branch ? "" : " hidden") + "></div>";
            }).join("");
    }
    function readExempt() {
        $$("#exemptBox [data-ek]").forEach(function (row) {
            const k = row.dataset.ek, c = row.querySelector("[data-ef=central]"), b = row.querySelector("[data-ef=branch]"), r = row.querySelector("[data-ef=reason]"), bf = row.querySelector("[data-ef=brfee]");
            if (bf) { const v = toLatin(bf.value.trim()); if (v) brFee[k] = v; else delete brFee[k]; }
            const e = { central: c ? c.checked : !!(exempt[k] || {}).central, branch: b ? b.checked : !!(exempt[k] || {}).branch, reason: r.value.trim() };
            if (e.central || e.branch) exempt[k] = e; else delete exempt[k];
            r.hidden = !(e.central || e.branch);
        });
    }
    function fcollect() {
        const ks = kinds();
        const c = {
            name: fval("name"), fatherName: fval("fatherName"), motherName: fval("motherName"), birthDate: fval("birthDate"),
            nationalId: fval("nationalId"), memberNo: fval("memberNo"), branch: fval("branch"), fileNo: fval("fileNo"), phone: fval("phone"),
            kinds: ks, kind: ks[0] || "", scope: scope(),
            joinDate: fval("joinDate"), status: fval("status") || "active", statusYear: toLatin(fval("statusYear")),
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
            bp_on: (c.branchPrints || {}).on, bp_amount: (c.branchPrints || {}).amount
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
        itemState = JSON.parse(JSON.stringify(c.itemState || {}));
        opPaid = JSON.parse(JSON.stringify(c.opPaid || {}));
        brFee = Object.assign({}, c.brFee || {});
        if (c.brMasterAmount && !brFee.traineeToMaster) brFee.traineeToMaster = c.brMasterAmount; /* حقل قديم */
        /* التقرير المعروض يخص الحساب السابق: يُفرَّغ عند فتح حساب آخر أو بدء حساب جديد */
        clearReport();
        excludeDup = (c.excludeDup || []).slice();
        exempt = JSON.parse(JSON.stringify(c.exempt || {}));
        /* الخيار القديم «إعفاء المشطوب الأمني من رسم الفرع» يبقى كما حُفظ */
        legacyWaive = !!c.secBranchWaived;
        fCurrentId = c.id || null;
        renderExempt();
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
            box.innerHTML = '<h3><i class="ti ti-calculator"></i>النتيجة</h3><p class="muted">' + R.errors.map(esc).join("<br>") + "</p>";
            return;
        }
        let h = '<div class="card-head"><h3><i class="ti ti-calculator"></i>النتيجة <small class="muted">(' + esc(R.scopeName) + ")</small></h3>" +
            '<span class="fee-total">' + fmt(R.total) + " <small>ل.س</small></span></div>";
        if (R.scope === "both") h += '<div class="fund-sums"><span>' + FUNDTAG("central") + " " + fmt(R.centralTotal) + "</span><span>" + FUNDTAG("branch") + " " + fmt(R.branchTotal) + "</span></div>";
        if (R.warnings.length) h += R.warnings.map(function (w) { return '<div class="field-warn"><i class="ti ti-alert-triangle"></i>' + esc(w) + "</div>"; }).join("");
        R.ops.forEach(function (op) {
            if (!op.items.length) return;
            const funds = ["central", "branch"].filter(function (f) { return op.items.some(function (i) { return i.fund === f && !i.exempt; }); });
            const op_ = opPaid[op.kind] || {};
            const toggles = funds.map(function (f) {
                return '<label class="op-paid' + (op_[f] ? " on" : "") + '"><input type="checkbox" data-opp="' + op.kind + "|" + f + '"' + (op_[f] ? " checked" : "") + "> " + (f === "central" ? "المركزية مدفوعة" : "الفرع مدفوع") + "</label>";
            }).join("");
            h += '<div class="op-head"><p class="fee-sub">' + esc(op.name) + "</p>" + (toggles ? '<div class="op-toggles">' + toggles + "</div>" : "") + "</div>" +
                '<div class="table-wrap"><table class="fee-tbl ops-tbl"><thead><tr><th>الجهة</th><th>البند</th><th>الحالة</th><th class="n">المبلغ</th></tr></thead><tbody>' +
                op.items.map(function (i) {
                    const dup = i.dup ? '<label class="dup-chk" title="بند مكرر مع «' + esc(i.dupOf) + '»"><input type="checkbox" data-dup="' + esc(i.key) + '"' + (i.excluded && !i.exempt ? "" : " checked") + "> مكرر: يُحتسب</label>" : "";
                    const exm = i.exempt ? ' <span class="ex-tag">معفى</span>' : "";
                    let st = "";
                    if (!i.excluded) {
                        st = '<select class="it-state st-' + i.state + '" data-is="' + esc(i.key) + '"><option value="due"' + (i.state === "due" ? " selected" : "") + '>مستحق</option><option value="paid"' + (i.state === "paid" ? " selected" : "") + '>مدفوع</option><option value="cancel"' + (i.state === "cancel" ? " selected" : "") + ">مُلغى</option></select>";
                        if (i.state === "paid") st += '<input type="date" class="yr-date" data-isd="' + esc(i.key) + '" value="' + esc(i.paidDate || "") + '" title="تاريخ الدفع (اختياري)">';
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
            h += '<p class="fee-sub">الرسوم السنوية <small class="muted">— علّم ما دفعه المحامي لكل طرف، ويمكن كتابة تاريخ الدفع</small></p>' +
                '<div class="table-wrap"><table class="fee-tbl yr-tbl"><thead><tr><th>السنة</th>' + (showC ? "<th>مركزية</th>" : "") + (showB ? "<th>فرع</th>" : "") + '<th class="n">المستحق</th></tr></thead><tbody>' +
                R.years.map(function (y) {
                    return "<tr><td><b>" + y.year + "</b>" + (y.over45 ? ' <small class="muted">فوق 45</small>' : "") + "</td>" + (showC ? cell(y, "central") : "") + (showB ? cell(y, "branch") : "") + '<td class="n"><b>' + fmt(y.due) + "</b></td></tr>";
                }).join("") + '</tbody><tfoot><tr><td colspan="' + (1 + (showC ? 1 : 0) + (showB ? 1 : 0)) + '">مجموع الرسوم السنوية المستحقة</td><td class="n">' + fmt(R.yearsTotal) + "</td></tr></tfoot></table></div>";
        }
        h += '<details class="how"' + (box.querySelector("details.how[open]") ? " open" : "") + '><summary><i class="ti ti-info-circle"></i>كيف حُسب؟</summary><ol>' + R.steps.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ol></details>";
        const ae = document.activeElement, keep = ae && box.contains(ae) ? ["data-pf", "data-pd", "data-dup", "data-is", "data-isd", "data-isr", "data-opp"].filter(function (a) { return ae.hasAttribute(a); }).map(function (a) { return "[" + a + '="' + ae.getAttribute(a) + '"]'; })[0] : null;
        box.innerHTML = h;
        if (keep) { const el = box.querySelector(keep); if (el) el.focus(); }
    }
    $("#feeLive").addEventListener("change", function (e) {
        const is = e.target.closest("[data-is]"), isd = e.target.closest("[data-isd]"), isr = e.target.closest("[data-isr]"), opp = e.target.closest("[data-opp]");
        if (is) {
            const k = is.dataset.is, prev = itemState[k] || {};
            itemState[k] = is.value === "paid" ? { s: "paid", date: prev.date || "" } : is.value === "cancel" ? { s: "cancel", reason: prev.reason || "" } : { s: "due" };
            renderLive(); fsaveDraft(); return;
        }
        if (isd) { const k = isd.dataset.isd; itemState[k] = { s: "paid", date: isd.value || "" }; renderLive(); fsaveDraft(); return; }
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
        const op = [["العمليات", R.ops.map(function (o, i) { return (i + 1) + ". " + esc(o.name); }).join("<br>")],
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
        if (has("traineeToMaster")) op.push(["تاريخ الانتقال لجدول الأساتذة", c.masterDate ? d(c.masterDate) : "لم يُدخل (اعتُمد تاريخ اليوم)"]);
        if (has("transfer")) op.push(["براءة الذمة", c.clearance ? '<span class="yes">بريء الذمة</span>' : '<span class="no">لم يُؤكَّد</span>']);
        const exl = [];
        Object.keys(R.exempt || {}).filter(has).forEach(function (k) {
            const e = R.exempt[k], parts = [e.central && R.scope !== "branch" ? "المركزية" : "", e.branch && R.scope !== "central" ? "الفرع" : ""].filter(Boolean);
            if (parts.length) exl.push(esc(F.KINDS[k]) + ": معفى من " + parts.join(" و") + (e.reason ? " — السبب: " + esc(e.reason) : ""));
        });
        if (c.secBranchWaived && has("secStruck") && R.scope !== "central") exl.push("المشطوب الأمني: معفى من رسم إعادة القيد للفرع");
        if (exl.length) op.push(["الإعفاءات", exl.join("<br>")]);
        h.push("<h2>الحالة</h2>" + kv(op));
        if (R.warnings.length) h.push(R.warnings.map(function (w) { return '<div class="warn">' + esc(w) + "</div>"; }).join(""));
        /* الرسوم لكل عملية، والجهة لكل بند، ولماذا */
        R.ops.forEach(function (o, idx) {
            if (!o.items.length && !o.steps.length) return;
            h.push("<h2>" + (idx + 1) + ". " + esc(o.name) + "</h2>");
            if (o.steps.length) h.push('<div class="formula"><b>لماذا وكيف:</b><ol class="steps">' + o.steps.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ol></div>");
            if (o.items.length) h.push('<table><thead><tr><th>الجهة</th><th>البند</th><th>ملاحظة</th><th class="n">المبلغ (ل.س)</th></tr></thead><tbody>' +
                o.items.map(function (i) {
                    const stTxt = i.state === "paid" ? "مدفوع سابقاً" + (i.paidDate ? " " + F.fmtDate(i.paidDate) : "") : i.state === "cancel" ? "مُلغى" + (i.cancelReason ? ": " + i.cancelReason : "") : "";
                    const note = [i.exempt ? "معفى" : "", stTxt, i.note, i.dup ? (i.excluded ? "مكرر مع «" + i.dupOf + "» — أُلغي تكراره" : "مكرر مع «" + i.dupOf + "» — يُحتسب مرة ثانية بصفته في هذه العملية") : ""].filter(Boolean).join(" · ");
                    const off = i.excluded || i.state !== "due";
                    return "<tr><td>" + fundTxt(i.fund) + "</td><td>" + esc(i.label) + "</td><td>" + (i.state === "paid" ? '<span class="yes">' + esc(note) + "</span>" : esc(note)) + '</td><td class="n">' + (off ? "<s>" + fmt(i.amount) + "</s>" : fmt(i.amount)) + "</td></tr>";
                }).join("") + '<tr class="total"><td colspan="3">المطلوب من «' + esc(o.name) + '»' + (o.original !== o.total ? " (الأصل " + fmt(o.original) + ")" : "") + '</td><td class="n">' + fmt(o.total) + "</td></tr></tbody></table>");
        });
        if (R.years.length) {
            const C = R.scope !== "branch", B = R.scope !== "central";
            const fc = function (y, f) {
                const amt = y[f], paid = y[f === "central" ? "paidC" : "paidB"], st = y[f === "central" ? "cStatus" : "bStatus"], dt = y[f === "central" ? "paidDateC" : "paidDateB"];
                if (!amt) return '<td class="n">' + (st === "missing" ? "غير محدد" : (y.exempt === f || y.exempt === "both") ? "معفى" : "—") + "</td>";
                return '<td class="n">' + (paid ? "<s>" + fmt(amt) + '</s><br><span class="yes">مدفوع' + (dt ? " " + F.fmtDate(dt) : "") + "</span>" : fmt(amt) + (st === "estimate" ? "<br>تقديري" : "")) + "</td>";
            };
            h.push("<h2>الرسوم السنوية</h2><table><thead><tr><th>السنة</th>" + (C ? '<th class="n">مركزية</th>' : "") + (B ? '<th class="n">فرع</th>' : "") + '<th class="n">المستحق (ل.س)</th></tr></thead><tbody>' +
                R.years.map(function (y) {
                    return "<tr><td>" + y.year + (y.over45 ? "<br><small>رسم من انتسب فوق 45</small>" : "") + "</td>" + (C ? fc(y, "central") : "") + (B ? fc(y, "branch") : "") + '<td class="n">' + fmt(y.due) + "</td></tr>";
                }).join("") + '<tr class="total"><td colspan="' + (1 + (C ? 1 : 0) + (B ? 1 : 0)) + '">مجموع الرسوم السنوية المستحقة</td><td class="n">' + fmt(R.yearsTotal) + "</td></tr></tbody></table>");
        }
        const SM = R.summary || {}, sf = ["central", "branch"].filter(function (f) { return (f === "central" ? R.scope !== "branch" : R.scope !== "central") && SM[f]; });
        const anyOff = sf.some(function (f) { return SM[f].paid || SM[f].cancelled || SM[f].exempt; });
        if (anyOff) h.push('<h2>الخلاصة لكل طرف</h2><table><thead><tr><th></th>' + sf.map(function (f) { return '<th class="n">' + (f === "central" ? "النقابة المركزية" : "الفرع") + "</th>"; }).join("") + (sf.length > 1 ? '<th class="n">المجموع</th>' : "") + "</tr></thead><tbody>" +
            [["original", "الأصل (كل الرسوم)"], ["paid", "مدفوع سابقاً"], ["cancelled", "مُلغى"], ["exempt", "معفى"], ["due", "المطلوب الآن"]].map(function (r) {
                const vals = sf.map(function (f) { return SM[f][r[0]]; }), tot = vals.reduce(function (a, b) { return a + b; }, 0);
                if (r[0] !== "original" && r[0] !== "due" && !tot) return "";
                return "<tr" + (r[0] === "due" ? ' class="total"' : "") + "><td>" + r[1] + "</td>" + vals.map(function (v) { return '<td class="n">' + fmt(v) + "</td>"; }).join("") + (sf.length > 1 ? '<td class="n">' + fmt(tot) + "</td>" : "") + "</tr>";
            }).join("") + "</tbody></table>");
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
