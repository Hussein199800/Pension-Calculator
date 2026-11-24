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
    let work = null, curYear = null;

    function toNum(v) {
        const t = String(v === undefined || v === null ? "" : v).replace(/[٠-٩]/g, function (c) { return "٠١٢٣٤٥٦٧٨٩".indexOf(c); }).replace(/[,\s،]/g, "");
        if (t === "") return null;
        return /^\d+(\.\d+)?$/.test(t) ? +t : NaN;
    }
    function inp(val, attrs) { return '<input class="num-in" inputmode="numeric" ' + (attrs || "") + ' value="' + (val === null || val === undefined ? "" : val) + '">'; }

    /* نسخة عمل من البيانات النافذة (المعتمد + تعديلات المستخدم) */
    function load_() {
        const fs = window.FeesUI.settings();
        const D = F.dataWith(fs.data);
        work = {
            annual: JSON.parse(JSON.stringify(D.ANNUAL)), over45: JSON.parse(JSON.stringify(D.ANNUAL_OVER45)),
            tables: JSON.parse(JSON.stringify(D.TABLES)), fixed: JSON.parse(JSON.stringify(D.flat))
        };
        curYear = D.TABLE_YEARS[D.TABLE_YEARS.length - 1];
        return fs;
    }

    function fill() {
        const fs = load_();
        $("#fsOrg").value = fs.org || ""; $("#fsFont").value = fs.fontSize || ""; $("#fsFooter").value = fs.footer || "";
        signEditor($("#fsSigns"), fs.signs || window.FeesUI.signs);
        renderAnnual(); renderYears(); renderGrid(); renderFixed();
    }

    /* ---------- الرسم السنوي ---------- */
    function renderAnnual() {
        const years = Object.keys(work.annual).map(Number).sort(function (a, b) { return a - b; });
        $("#fsAnnual tbody").innerHTML = years.map(function (y) {
            return '<tr data-y="' + y + '"><td><b>' + y + "</b></td><td>" + inp(work.annual[y], 'data-a="n"') + "</td><td>" + inp(y in work.over45 ? work.over45[y] : "", 'data-a="o" placeholder="مثل حتى 45"') + "</td>" +
                '<td><button type="button" class="x" aria-label="حذف السنة" data-a-del><i class="ti ti-trash"></i></button></td></tr>';
        }).join("");
    }
    function readAnnual() {
        const bad = [];
        const annual = {}, over45 = {};
        $$("#fsAnnual tbody tr").forEach(function (tr) {
            const y = tr.dataset.y, n = toNum($("[data-a=n]", tr).value), o = toNum($("[data-a=o]", tr).value);
            if (n === null || isNaN(n)) bad.push("الرسم السنوي لسنة " + y); else annual[y] = n;
            if (isNaN(o)) bad.push("رسم فوق 45 لسنة " + y); else if (o !== null) over45[y] = o;
        });
        work.annual = annual; work.over45 = over45;
        return bad;
    }
    $("#fsAnnual").addEventListener("click", async function (e) {
        const b = e.target.closest("[data-a-del]"); if (!b) return;
        const tr = b.closest("tr");
        if (await confirmBox("حذف سنة", "حذف الرسم السنوي لسنة <b>" + tr.dataset.y + "</b>؟ لن يُحسب لها رسم حتى تُضاف من جديد.", "حذف", true)) { readAnnual(); delete work.annual[tr.dataset.y]; delete work.over45[tr.dataset.y]; renderAnnual(); }
    });
    $("#fsAddYear").onclick = function () {
        readAnnual();
        const ys = Object.keys(work.annual).map(Number), last = Math.max.apply(null, ys), next = last + 1;
        work.annual[next] = work.annual[last];
        if (last in work.over45) work.over45[next] = work.over45[last];
        renderAnnual();
        toast("أُضيفت سنة " + next + " بقيم سنة " + last + "؛ عدّلها ثم احفظ.", "ok");
    };

    /* ---------- جداول الانتساب ---------- */
    function tableYears() { return Object.keys(work.tables).map(Number).sort(function (a, b) { return a - b; }); }
    function renderYears() {
        $("#fsYears").innerHTML = tableYears().map(function (y) { return '<button type="button" data-ty="' + y + '"' + (y === curYear ? ' class="on"' : "") + ">" + y + "</button>"; }).join("");
        $("#fsFrom").value = (work.tables[curYear] && work.tables[curYear].from) || "";
    }
    function renderGrid() {
        const T = work.tables[curYear];
        let h = "<thead><tr><th>العمر</th>" + F.COLS.map(function (c) { return "<th>" + c[1] + "</th>"; }).join("") + "<th>المجموع</th></tr></thead><tbody>";
        F.AGES.forEach(function (a) {
            const r = T.rows[a];
            h += '<tr data-age="' + a + '"><td><b>' + a + "</b></td>" + F.COLS.map(function (c) {
                if (c[0] === "death" && a > 45) return '<td class="muted">—</td>';
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
        if (!work.tables[curYear]) return bad;
        const T = JSON.parse(JSON.stringify(work.tables[curYear]));
        T.from = $("#fsFrom").value || T.from || "";
        $$("#fsGrid tbody tr").forEach(function (tr) {
            const a = +tr.dataset.age;
            $$("[data-c]", tr).forEach(function (i) {
                const v = toNum(i.value);
                if (v === null || isNaN(v)) bad.push("جدول " + curYear + " عمر " + a); else T.rows[a][i.dataset.c] = v;
            });
            if (a > 45) T.rows[a].death = 0;
        });
        work.tables[curYear] = T;
        return bad;
    }
    $("#fsGrid").addEventListener("input", function (e) {
        if (e.target.classList.contains("num-in")) { const v = e.target.value.replace(/[٠-٩]/g, function (c) { return "٠١٢٣٤٥٦٧٨٩".indexOf(c); }); if (v !== e.target.value) e.target.value = v; }
        sums();
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
                if (!y || isNaN(y) || y < 2000 || y > 2100 || y % 1) { box.querySelector("#newTYErr").textContent = "اكتب سنة صحيحة."; return false; }
                if (work.tables[y]) { box.querySelector("#newTYErr").textContent = "يوجد جدول لهذه السنة."; return false; }
                return y;
            }
        });
        if (!res) return;
        const copy = JSON.parse(JSON.stringify(work.tables[curYear])); copy.from = res + "-01-01";
        work.tables[res] = copy; curYear = res; renderYears(); renderGrid();
        toast("أُضيف جدول " + res + "؛ عدّل قيمه ثم احفظ.", "ok");
    };
    $("#fsDelTable").onclick = async function () {
        if (tableYears().length < 2) { toast("يجب أن يبقى جدول واحد على الأقل.", "bad"); return; }
        if (!await confirmBox("حذف جدول", "حذف جدول انتساب سنة <b>" + curYear + "</b>؟ السنوات التي كانت تأخذه ستأخذ الجدول الذي بعدها.", "حذف", true)) return;
        delete work.tables[curYear];
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
        keys(DEF.TABLES, work.tables).forEach(function (y) {
            if (!(y in work.tables)) out.tables[y] = null;
            else if (JSON.stringify(work.tables[y]) !== JSON.stringify(DEF.TABLES[y])) out.tables[y] = work.tables[y];
        });
        Object.keys(work.fixed).forEach(function (k) { if (work.fixed[k] !== DEF.flat[k]) out.fixed[k] = work.fixed[k]; });
        ["annual", "over45", "tables", "fixed"].forEach(function (k) { if (!Object.keys(out[k]).length) delete out[k]; });
        return Object.keys(out).length ? out : null;
    }
    $("#fsSave").onclick = function () {
        const bad = readAnnual().concat(readGrid(), readFixed());
        if (bad.length) { toast("قيم غير صالحة (أرقام فقط، 0 أو أكثر): " + esc(bad.slice(0, 4).join("، ")) + (bad.length > 4 ? "…" : ""), "bad", 7000); return; }
        const fs = { org: $("#fsOrg").value.trim(), fontSize: $("#fsFont").value, footer: $("#fsFooter").value.trim(), signs: readSigns($("#fsSigns")) };
        const data = diffData(); if (data) fs.data = data;
        if (store(KEY_FSET, fs)) { toast("حُفظت إعدادات الرسوم", "ok"); window.FeesUI.refresh(); }
        else toast("تعذر الحفظ في هذا المتصفح.", "bad");
    };
    $("#fsReset").onclick = async function () {
        if (!await confirmBox("استعادة الجداول المعتمدة", "تعود كل جداول الرسوم إلى القيم المعتمدة في النقابة، وتُلغى تعديلاتك عليها. اسم الجهة وإعدادات الطباعة تبقى كما هي.", "استعادة")) return;
        const fs = window.FeesUI.settings(); delete fs.data;
        store(KEY_FSET, fs); fill(); window.FeesUI.refresh(); toast("استُعيدت الجداول المعتمدة", "ok");
    };

    window.FeeSettingsUI = { fill: fill };
})();
