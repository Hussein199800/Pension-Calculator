/* =========================================================
   حاسبة المحامي — «إعدادات الرسوم» (خاصة بقسم الانتساب والرسوم فقط)
   ---------------------------------------------------------
   - تُحفظ في pc.feeSettings.v1: { org, fontSize, footer, signs, data: { annual, over45, tables, fixed } }.
   - data تُدمج فوق الجداول المعتمدة في fees.js (FeesCalc.dataWith). السنة المحذوفة من الجداول
     المعتمدة تُحفظ null، فلا تعود عند الدمج.
   - لا تمس إعدادات التقاعد (pc.settings.v1 / pc.pensionPrint.v1).
   ========================================================= */
"use strict";
(function () {
    const F = window.FeesCalc, fmt = F.fmt;
    let work = null, curYear = null, curFund = "central";
    const TKEY = { central: "tables", branch: "branchTables" };
    function cols() { return curFund === "central" ? F.COLS : F.BCOLS; }

    /* القراءة نفسها التي يستعملها المحرك والاستيراد: عدد صحيح ≥ 0، الفارغ = null، غير الصالح = NaN */
    function toNum(v) { return F.amountOf(v); }
    function inp(val, attrs) { return '<input class="num-in" inputmode="numeric" ' + (attrs || "") + ' value="' + (val === null || val === undefined ? "" : val) + '">'; }

    /* نسخة عمل من البيانات النافذة (المعتمد + تعديلات المستخدم) */
    function load_() {
        const fs = window.FeesUI.settings();
        const D = F.dataWith(fs.data);
        work = {
            annual: JSON.parse(JSON.stringify(D.ANNUAL)), over45: JSON.parse(JSON.stringify(D.ANNUAL_OVER45)),
            tables: JSON.parse(JSON.stringify(D.TABLES)), fixed: JSON.parse(JSON.stringify(D.flat)),
            branchAnnual: JSON.parse(JSON.stringify(D.BRANCH_ANNUAL)), branchTables: JSON.parse(JSON.stringify(D.BRANCH_TABLES))
        };
        curFund = "central";
        curYear = D.TABLE_YEARS[D.TABLE_YEARS.length - 1];
        $$("#fsFund button").forEach(function (b) { b.classList.toggle("on", b.dataset.fund === "central"); });
        return fs;
    }

    function fill() {
        const fs = load_();
        $("#fsOrg").value = fs.org || ""; $("#fsFont").value = fs.fontSize || ""; $("#fsFooter").value = fs.footer || "";
        signEditor($("#fsSigns"), fs.signs || window.FeesUI.signs);
        Letterhead.editor($("#fsLh"), fs);
        renderAnnual(); renderYears(); renderGrid(); renderFixed();
    }

    /* ---------- الرسم السنوي ---------- */
    function renderAnnual() {
        const ys = {}; Object.keys(work.annual).concat(Object.keys(work.branchAnnual)).forEach(function (y) { ys[y] = 1; });
        const years = Object.keys(ys).map(Number).sort(function (a, b) { return a - b; });
        $("#fsAnnual tbody").innerHTML = years.map(function (y) {
            return '<tr data-y="' + y + '"><td><b>' + y + "</b></td><td>" + inp(y in work.annual ? work.annual[y] : "", 'data-a="n" placeholder="لا رسم"') + "</td><td>" + inp(y in work.over45 ? work.over45[y] : "", 'data-a="o" placeholder="مثل حتى 45"') + "</td>" +
                "<td>" + inp(y in work.branchAnnual ? work.branchAnnual[y] : "", 'data-a="b" placeholder="لا رسم فرع"') + "</td>" +
                '<td><button type="button" class="x" aria-label="حذف السنة" data-a-del><i class="ti ti-trash"></i></button></td></tr>';
        }).join("");
    }
    function readAnnual() {
        const bad = [];
        const annual = {}, over45 = {}, bann = {};
        $$("#fsAnnual tbody tr").forEach(function (tr) {
            const y = tr.dataset.y, n = toNum($("[data-a=n]", tr).value), o = toNum($("[data-a=o]", tr).value), b = toNum($("[data-a=b]", tr).value);
            if (isNaN(n)) bad.push("الرسم السنوي لسنة " + y); else if (n !== null) annual[y] = n;
            if (isNaN(o)) bad.push("رسم فوق 45 لسنة " + y); else if (o !== null) over45[y] = o;
            if (isNaN(b)) bad.push("رسم الفرع لسنة " + y); else if (b !== null) bann[y] = b;
        });
        work.annual = annual; work.over45 = over45; work.branchAnnual = bann;
        if (!Object.keys(annual).length) bad.push("يجب أن يبقى رسم سنوي مركزي لسنة واحدة على الأقل");
        return bad;
    }
    $("#fsAnnual").addEventListener("click", async function (e) {
        const b = e.target.closest("[data-a-del]"); if (!b) return;
        const tr = b.closest("tr");
        if (await confirmBox("حذف سنة", "حذف الرسم السنوي لسنة <b>" + tr.dataset.y + "</b> (المركزي والفرع)؟ لن يُحسب لها رسم حتى تُضاف من جديد.", "حذف", true)) { readAnnual(); delete work.annual[tr.dataset.y]; delete work.over45[tr.dataset.y]; delete work.branchAnnual[tr.dataset.y]; renderAnnual(); }
    });
    /* إضافة سنة (جديدة أو سبق حذفها): تُنسخ قيم أقرب سنة قبلها، ثم تُعدَّل */
    $("#fsAddYear").onclick = async function () {
        if (readAnnual().length) { toast("صحّح قيم الجدول أولاً (أرقام صحيحة فقط).", "bad"); return; }
        const ys = Object.keys(work.annual).concat(Object.keys(work.branchAnnual)).map(Number), def = Math.min(F.YEAR_MAX, Math.max.apply(null, ys) + 1);
        const y = await modal('<h3>إضافة سنة</h3><label class="field"><span>السنة</span><input id="newAY" class="num-in" inputmode="numeric" value="' + def + '"></label><p class="hint-line">يمكن إعادة سنة حذفتها سابقاً. تُنسخ قيم أقرب سنة قبلها.</p><p class="error-text" id="newAYErr"></p>' +
            '<div class="actions"><button class="btn primary" data-modal="ok">إضافة</button><button class="btn" data-modal="cancel">إلغاء</button></div>', {
            collect: function (box) {
                const v = F.yearOf(box.querySelector("#newAY").value);
                if (!v || isNaN(v)) { box.querySelector("#newAYErr").textContent = "اكتب سنة صحيحة بين " + F.YEAR_MIN + " و" + F.YEAR_MAX + "."; return false; }
                if (v in work.annual && v in work.branchAnnual) { box.querySelector("#newAYErr").textContent = "السنة موجودة في الجدول."; return false; }
                return v;
            }
        });
        if (!y) return;
        const prevOf = function (o) { const k = Object.keys(o).map(Number).filter(function (x) { return x < y; }); return k.length ? Math.max.apply(null, k) : null; };
        const pc = prevOf(work.annual), po = prevOf(work.over45), pb = prevOf(work.branchAnnual);
        if (!(y in work.annual) && pc !== null) work.annual[y] = work.annual[pc];
        if (!(y in work.over45) && po !== null && po === pc) work.over45[y] = work.over45[po];
        if (!(y in work.branchAnnual) && pb !== null) work.branchAnnual[y] = work.branchAnnual[pb];
        renderAnnual();
        toast("أُضيفت سنة " + y + (pc !== null ? " بقيم سنة " + pc : "") + "؛ عدّلها ثم احفظ.", "ok");
    };

    /* ---------- جداول الانتساب ---------- */
    function tableYears() { return Object.keys(work[TKEY[curFund]]).map(Number).sort(function (a, b) { return a - b; }); }
    function renderYears() {
        $("#fsYears").innerHTML = tableYears().map(function (y) { return '<button type="button" data-ty="' + y + '"' + (y === curYear ? ' class="on"' : "") + ">" + y + "</button>"; }).join("");
        $("#fsFrom").value = (work[TKEY[curFund]][curYear] && work[TKEY[curFund]][curYear].from) || "";
    }
    function renderGrid() {
        const T = work[TKEY[curFund]][curYear];
        let h = "<thead><tr><th>العمر</th>" + cols().map(function (c) { return "<th>" + c[1] + "</th>"; }).join("") + "<th>المجموع</th></tr></thead><tbody>";
        F.AGES.forEach(function (a) {
            const r = T.rows[a];
            h += '<tr data-age="' + a + '"><td><b>' + a + "</b></td>" + cols().map(function (c) {
                if (curFund === "central" && c[0] === "death" && a > 45) return '<td class="muted">—</td>';
                return "<td>" + inp(r[c[0]], 'data-c="' + c[0] + '"') + "</td>";
            }).join("") + '<td class="n sum-cell"></td></tr>';
        });
        $("#fsGrid").innerHTML = h + "</tbody>";
        sums();
    }
    function sums() {
        $$("#fsGrid tbody tr").forEach(function (tr) {
            let s = 0, ok = true;
            $$("[data-c]", tr).forEach(function (i) { const v = toNum(i.value); if (v === null || isNaN(v)) ok = false; else s += v; i.classList.toggle("bad", v === null || isNaN(v)); });
            $(".sum-cell", tr).textContent = ok ? fmt(s) : "—";
        });
    }
    function readGrid() {
        const bad = [];
        if (!work[TKEY[curFund]][curYear]) return bad;
        const T = JSON.parse(JSON.stringify(work[TKEY[curFund]][curYear]));
        T.from = $("#fsFrom").value || T.from || "";
        $$("#fsGrid tbody tr").forEach(function (tr) {
            const a = +tr.dataset.age;
            $$("[data-c]", tr).forEach(function (i) {
                const v = toNum(i.value);
                if (v === null || isNaN(v)) bad.push("جدول " + curYear + " عمر " + a); else T.rows[a][i.dataset.c] = v;
            });
            if (curFund === "central" && a > 45) T.rows[a].death = 0;
        });
        work[TKEY[curFund]][curYear] = T;
        return bad;
    }
    $("#fsGrid").addEventListener("input", function (e) {
        if (e.target.classList.contains("num-in")) { const v = e.target.value.replace(/[٠-٩]/g, function (c) { return "٠١٢٣٤٥٦٧٨٩".indexOf(c); }); if (v !== e.target.value) e.target.value = v; }
        sums();
    });
    $("#fsFund").addEventListener("click", function (e) {
        const b = e.target.closest("[data-fund]"); if (!b || b.dataset.fund === curFund) return;
        if (readGrid().length) { toast("أكمل خانات الجدول الحالي أولاً (أرقام فقط).", "bad"); return; }
        curFund = b.dataset.fund;
        $$("#fsFund button").forEach(function (x) { x.classList.toggle("on", x === b); });
        const ys = tableYears(); curYear = ys[ys.length - 1]; renderYears(); renderGrid();
    });
    $("#fsYears").addEventListener("click", function (e) {
        const b = e.target.closest("[data-ty]"); if (!b) return;
        const bad = readGrid();
        if (bad.length) { toast("أكمل خانات جدول " + curYear + " أولاً (أرقام فقط).", "bad"); return; }
        curYear = +b.dataset.ty; renderYears(); renderGrid();
    });
    $("#fsAddTable").onclick = async function () {
        if (readGrid().length) { toast("أكمل خانات الجدول الحالي أولاً.", "bad"); return; }
        const ys = tableYears(), def = Math.max.apply(null, ys) + 1;
        const res = await modal('<h3>جدول سنة جديدة</h3><label class="field"><span>السنة</span><input id="newTY" class="num-in" inputmode="numeric" value="' + def + '"></label>' +
            '<p class="hint-line">يُنسخ من جدول ' + curYear + "، ثم تعدّل قيمه.</p><p class=\"error-text\" id=\"newTYErr\"></p>" +
            '<div class="actions"><button class="btn primary" data-modal="ok">إضافة</button><button class="btn" data-modal="cancel">إلغاء</button></div>', {
            collect: function (box) {
                const y = toNum(box.querySelector("#newTY").value);
                if (!y || isNaN(y) || y < F.YEAR_MIN || y > F.YEAR_MAX) { box.querySelector("#newTYErr").textContent = "اكتب سنة صحيحة بين " + F.YEAR_MIN + " و" + F.YEAR_MAX + "."; return false; }
                if (work[TKEY[curFund]][y]) { box.querySelector("#newTYErr").textContent = "يوجد جدول لهذه السنة."; return false; }
                return y;
            }
        });
        if (!res) return;
        const copy = JSON.parse(JSON.stringify(work[TKEY[curFund]][curYear])); copy.from = res + "-01-01";
        work[TKEY[curFund]][res] = copy; curYear = res; renderYears(); renderGrid();
        toast("أُضيف جدول " + res + "؛ عدّل قيمه ثم احفظ.", "ok");
    };
    $("#fsDelTable").onclick = async function () {
        if (tableYears().length < 2) { toast("يجب أن يبقى جدول واحد على الأقل.", "bad"); return; }
        if (!await confirmBox("حذف جدول", "حذف جدول انتساب " + (curFund === "branch" ? "الفروع " : "") + "سنة <b>" + curYear + "</b>؟ السنوات التي كانت تأخذه ستأخذ الجدول الذي بعدها.", "حذف", true)) return;
        delete work[TKEY[curFund]][curYear];
        const ys = tableYears(); curYear = ys[ys.length - 1]; renderYears(); renderGrid();
    };

    /* ---------- رسوم إعادة القيد والنقل ---------- */
    function renderFixed() {
        $("#fsFixed").innerHTML = F.FIXED_FIELDS.map(function (f) {
            return '<label class="field"><span>' + esc(f[1]) + "</span>" + inp(work.fixed[f[0]], 'data-f="' + f[0] + '"') + "</label>";
        }).join("");
    }
    function readFixed() {
        const bad = [];
        $$("#fsFixed [data-f]").forEach(function (i) { const v = toNum(i.value); if (v === null || isNaN(v)) bad.push(i.closest("label").querySelector("span").textContent); else work.fixed[i.dataset.f] = v; });
        return bad;
    }

    /* ---------- الحفظ: يُخزَّن الفرق عن المعتمد فقط ---------- */
    function diffData() {
        const DEF = F.DEFAULTS, out = { annual: {}, over45: {}, tables: {}, fixed: {} };
        const keys = function (a, b) { const k = {}; Object.keys(a).concat(Object.keys(b)).forEach(function (x) { k[x] = 1; }); return Object.keys(k); };
        keys(DEF.ANNUAL, work.annual).forEach(function (y) { if (!(y in work.annual)) out.annual[y] = null; else if (work.annual[y] !== DEF.ANNUAL[y]) out.annual[y] = work.annual[y]; });
        keys(DEF.ANNUAL_OVER45, work.over45).forEach(function (y) { if (!(y in work.over45)) out.over45[y] = null; else if (work.over45[y] !== DEF.ANNUAL_OVER45[y]) out.over45[y] = work.over45[y]; });
        [["TABLES", "tables"], ["BRANCH_TABLES", "branchTables"]].forEach(function (p) {
            out[p[1]] = {};
            keys(DEF[p[0]], work[p[1]]).forEach(function (y) {
                if (!(y in work[p[1]])) out[p[1]][y] = null;
                else if (JSON.stringify(work[p[1]][y]) !== JSON.stringify(DEF[p[0]][y])) out[p[1]][y] = work[p[1]][y];
            });
        });
        out.branchAnnual = {};
        keys(DEF.BRANCH_ANNUAL, work.branchAnnual).forEach(function (y) { if (!(y in work.branchAnnual)) out.branchAnnual[y] = null; else if (work.branchAnnual[y] !== DEF.BRANCH_ANNUAL[y]) out.branchAnnual[y] = work.branchAnnual[y]; });
        Object.keys(work.fixed).forEach(function (k) { if (work.fixed[k] !== DEF.flat[k]) out.fixed[k] = work.fixed[k]; });
        ["annual", "over45", "tables", "fixed", "branchTables", "branchAnnual"].forEach(function (k) { if (!Object.keys(out[k]).length) delete out[k]; });
        return Object.keys(out).length ? out : null;
    }
    $("#fsSave").onclick = function () {
        const bad = readAnnual().concat(readGrid(), readFixed());
        if (bad.length) { toast("قيم غير صالحة (أرقام فقط، 0 أو أكثر): " + esc(bad.slice(0, 4).join("، ")) + (bad.length > 4 ? "…" : ""), "bad", 7000); return; }
        const fs = Object.assign({ org: $("#fsOrg").value.trim(), fontSize: $("#fsFont").value, footer: $("#fsFooter").value.trim(), signs: readSigns($("#fsSigns")) }, Letterhead.read($("#fsLh")));
        const data = diffData(); if (data) fs.data = data;
        if (store(KEY_FSET, fs)) { toast("حُفظت إعدادات الرسوم", "ok"); window.FeesUI.refresh(); }
        else toast("تعذر الحفظ في هذا المتصفح.", "bad");
    };
    $("#fsReset").onclick = async function () {
        if (!await confirmBox("استعادة الجداول المعتمدة", "تعود كل جداول الرسوم إلى القيم المعتمدة في النقابة، وتُلغى تعديلاتك عليها. اسم الجهة وإعدادات الطباعة تبقى كما هي.", "استعادة")) return;
        const fs = window.FeesUI.settings(); delete fs.data;
        if (!store(KEY_FSET, fs)) { toast("تعذر الحفظ في هذا المتصفح.", "bad"); return; }
        fill(); window.FeesUI.refresh(); toast("استُعيدت الجداول المعتمدة", "ok");
    };

    /* ---------- استيراد من Excel: قالب + تعلّم + معاينة قبل الاعتماد ---------- */
    $("#fsTpl").onclick = function () {
        const T = window.FeesLearn.template({ data: window.FeesUI.settings().data });
        const blob = new Blob(window.XLSXIO.build(T.sheets), { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "قالب رسوم " + T.year + ".xlsx";
        document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
        toast("نُزّل القالب لسنة " + T.year + ": عدّل القيم ثم ارفعه من هنا.", "ok");
    };
    $("#fsXlsx").addEventListener("change", async function (e) {
        const file = e.target.files[0]; e.target.value = "";
        if (!file) return;
        let P;
        try {
            const wb = await window.XLSXIO.read(await file.arrayBuffer());
            P = window.FeesLearn.learn(wb, { data: window.FeesUI.settings().data });
        } catch (err) { toast("تعذرت قراءة الملف: " + esc(err.message || "ليس ملف Excel صالحاً"), "bad", 7000); return; }
        const li = function (arr) { return "<ul class=\"imp-list\">" + arr.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>"; };
        const KIND = { central: "جدول مركزي", branch: "جدول فروع", annual: "رسم سنوي", fixed: "رسوم ثابتة", ignored: "تُجوهلت" };
        const sheets = P.sheets.map(function (s) { return "«" + s.name + "» ← " + KIND[s.kind] + (s.year ? " " + s.year : "") + (s.count ? " (" + s.count + " سنة)" : "") + (s.note ? " — " + s.note : ""); });
        const real = P.changes.filter(function (x) { return x.indexOf("لا تغيير") < 0; });
        let body = "<p><b>الملف:</b> " + esc(file.name) + "</p><p class=\"fee-sub\">ما فهمته من الأوراق</p>" + li(sheets);
        if (P.problems.length) body += '<p class="fee-sub" style="color:var(--danger)">انتبه</p>' + li(P.problems);
        if (P.notes.length) body += '<p class="fee-sub">ملاحظات</p>' + li(P.notes);
        body += '<p class="fee-sub">ما سيتغير</p>' + (real.length ? li(P.changes) : "<p class=\"muted\">لا شيء: القيم في الملف مطابقة لما في البرنامج.</p>");
        if (P.cells && P.cells.length) body += '<details class="how"><summary>الخانات المتغيرة (' + P.cells.length + ')</summary>' + li(P.cells.slice(0, 80).concat(P.cells.length > 80 ? ["… و" + (P.cells.length - 80) + " خانة أخرى"] : [])) + "</details>";
        if (P.empty || !real.length) { await modal("<h3>معاينة ملف Excel</h3>" + body + '<div class="actions"><button class="btn" data-modal="cancel">إغلاق</button></div>'); return; }
        body += '<p class="hint-line">الحسابات المحفوظة لا تتغير، وإن اختلف مجموعها بالجداول الجديدة يظهر تنبيه عند فتحها. وتعديلات هذه الصفحة غير المحفوظة تُستبدل.</p>';
        const ok = await modal("<h3>معاينة ملف Excel</h3>" + body + '<div class="actions"><button class="btn primary" data-modal="ok">اعتماد الجداول</button><button class="btn" data-modal="cancel">إلغاء</button></div>');
        if (ok !== "ok") return;
        const fs = window.FeesUI.settings(), data = window.FeesLearn.apply(P, fs.data);
        if (data) fs.data = data; else delete fs.data;
        if (store(KEY_FSET, fs)) { fill(); window.FeesUI.refresh(); toast("اعتُمدت الجداول من «" + esc(file.name) + "» (" + real.length + " تغيير)", "ok", 6000); }
        else toast("تعذر الحفظ في هذا المتصفح.", "bad");
    });

    window.FeeSettingsUI = { fill: fill };
})();
