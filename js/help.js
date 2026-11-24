/* =========================================================
   حاسبة المحامي — صفحة «الشرح»: كيف يتم الحساب، بلغة بسيطة وأمثلة
   الجداول في شرح الرسوم تُقرأ من fees.js نفسه، فلا تختلف عن الحساب أبداً.
   ========================================================= */
"use strict";
(function () {
    const F = window.FeesCalc, fmt = F.fmt;
    function sec(icon, title, body) { return '<div class="card help-card"><h3><i class="ti ti-' + icon + '"></i>' + title + "</h3>" + body + "</div>"; }
    function ex(t) { return '<div class="help-ex"><b><i class="ti ti-bulb"></i>مثال</b>' + t + "</div>"; }

    const pension = [
        sec("route", "الخطوات باختصار",
            "<ol><li>تُحسب <b>مدة الممارسة الصافية</b> من تاريخ حلف اليمين حتى نهاية الممارسة.</li>" +
            "<li>تُحدد <b>نسبة المعاش</b> حسب نوع الحالة (عادي، صحي، ورثة).</li>" +
            "<li>يُضرب المعاش الكامل النافذ في كل شهر بالنسبة، وتُجمع المستحقات حتى الشهر المطلوب.</li>" +
            "<li>تُحسب <b>معونة التقاعد أو الوفاة</b> إن وُجدت.</li></ol>"),
        sec("hourglass", "مدة الممارسة",
            "<ul><li>تبدأ من <b>تاريخ حلف اليمين</b>، وتُعدّ بالتقويم الحقيقي (سنوات وأشهر وأيام).</li>" +
            "<li><b>التمرين</b> (من اليمين حتى القيد أستاذاً) يُحسب منه <b>3 سنوات على الأكثر</b>، والزائد يُستبعد تلقائياً.</li>" +
            "<li>تُستبعد: سنوات الشطب والترقين، والاستبعاد لعدم دفع الرسوم، والمنع من المزاولة، والسنوات غير المثبتة. والفترات المتداخلة تُطرح مرة واحدة.</li></ul>" +
            ex("حلف اليمين 31/1/2011 وانتهت الممارسة 31/1/2026 (اليوم الأخير محسوب) = 15 سنة ويوم.")),
        sec("briefcase", "التقاعد العادي",
            "<ul><li>تُعتمد <b>السنوات الكاملة فقط</b>، ويُهمل كسر السنة.</li>" +
            "<li>30 سنة = معاش كامل. أقل من 30 = جزء منه بنسبة السنوات. أكثر من 30 = كامل مع علاوة، حتى سقف السنوات في الإعدادات.</li>" +
            "<li>يُصرف من تاريخ اكتساب قرار الإحالة الدرجة القطعية: تاريخ مشاهدة مراقب الخزانة إن أُسقط حق الطعن، وإلا بعد شهر منه. وإن لم يُدخل تاريخ المشاهدة يُعتمد تاريخ الإحالة.</li></ul>" +
            ex("معاش كامل 16,000 و20 سنة ممارسة ← 16,000 × 20 ÷ 30 = 10,666.")),
        sec("heart-rate-monitor", "التقاعد الصحي ومعاش الورثة (شرائح)",
            "<ul><li>حتى 5 سنوات = ربع المعاش. فوق 5 حتى 10 = النصف. فوق 10 حتى 15 = ثلاثة أرباع. فوق 15 ولو بيوم = كامل.</li>" +
            "<li>الحد يدخل في الشريحة الأدنى: <b>15 سنة بالضبط = ثلاثة أرباع</b>.</li>" +
            "<li>إن كانت الحالة أو الوفاة ناتجة عن المهنة = معاش كامل.</li>" +
            "<li>الصحي يُصرف من تاريخ الخبرة الطبية، والورثة من اليوم التالي للوفاة.</li>" +
            "<li>الشهر الأول الجزئي: الأيام من اليوم التالي حتى آخر الشهر ÷ 30. مثلاً وفاة 4/7 ← 27 يوماً.</li></ul>"),
        sec("users", "توزيع معاش الورثة",
            "<ul><li>يُقسم المعاش على المستحقين <b>+ حصة واحدة لخزانة التقاعد</b> دائماً، ما دام هناك مستحق واحد على الأقل.</li>" +
            "<li>الاستحقاق يُراجع سنوياً: من فقد الاستحقاق في أي يوم من السنة يتوقف من 1 كانون الثاني من السنة التالية، وحصته تذهب للخزانة.</li></ul>"),
        sec("gift", "معونة التقاعد والوفاة",
            "<ul><li>قيمة المعونة الكاملة حسب الإعدادات (200,000 من 1/7/2026)، وجزء السنة = سنة كاملة.</li>" +
            "<li>من انتسب <b>بعد 4/2/2014</b> يقبض عند التقاعد نصف المعونة النسبية، ويقبض الورثة النصف الثاني عند الوفاة بقيمة سنة الوفاة.</li>" +
            "<li>من كان عمره عند القيد <b>فوق 45</b> لا يستفيد من صندوق المعونة.</li></ul>")
    ].join("");

    let D = F.DEFAULTS, DATA = null;
    function feeTableHTML(year) {
        const ages = F.AGES;
        const cols = F.COLS.filter(function (c) { return c[0] !== "exam" || ages.some(function (a) { return D.TABLES[year].rows[a].exam; }); });
        return '<div class="table-wrap"><table class="fee-tbl small"><thead><tr><th>العمر</th>' + cols.map(function (c) { return "<th>" + c[1] + "</th>"; }).join("") + '<th>المجموع</th></tr></thead><tbody>' +
            ages.map(function (a) {
                const r = F.tableRow(year, a, DATA); let s = 0;
                return "<tr><td>" + a + "</td>" + cols.map(function (c) { s += r[c[0]]; return '<td class="n">' + (c[0] === "death" && a > 45 ? "—" : fmt(r[c[0]])) + "</td>"; }).join("") + '<td class="n"><b>' + fmt(s) + "</b></td></tr>";
            }).join("") + "</tbody></table></div>";
    }
    function feesHTML() {
    const X = D.flat, n = fmt;
    const annualRows = Object.keys(D.ANNUAL).map(function (y) {
        return "<tr><td>" + y + '</td><td class="n">' + fmt(D.ANNUAL[y]) + '</td><td class="n">' + fmt(y in D.ANNUAL_OVER45 ? D.ANNUAL_OVER45[y] : D.ANNUAL[y]) + "</td></tr>";
    }).join("");
    const last = D.TABLE_YEARS[D.TABLE_YEARS.length - 1];
    return [
        sec("user-plus", "الانتساب الجديد",
            "<ol><li><b>العمر</b> = تاريخ الانتساب − تاريخ الميلاد. <b>أي كسر يرفعه لسنة</b>: 30 سنة ويوم = سطر 31. دون 30 يأخذ سطر 30.</li>" +
            "<li>من تجاوز <b>50</b> لا يحق له التسجيل إلا بظرف خاص: يُحسب على سطر 50 ويظهر تنبيه.</li>" +
            "<li><b>الجدول</b>: جدول سنة الانتساب نفسها، وإن لم يوجد <b>فالجدول الذي بعدها</b> لا الذي قبلها. الجداول المتوفرة: " + D.TABLE_YEARS.join("، ") + ".</li>" +
            "<li>يُؤخذ من سطر العمر كل البنود <b>ما عدا الرسم السنوي</b>، ثم يُضاف <b>الرسم السنوي لكل سنة</b> من سنة الانتساب حتى سنة النهاية.</li>" +
            "<li><b>سنة النهاية</b>: قيده سارٍ ← السنة الحالية. مرقّن ← سنة الترقين. متوفى ← سنة الوفاة. وضع آخر ← سنة تكتبها. والسنة نفسها محسوبة.</li>" +
            "<li>معونة الوفاة تُدفع لمن عمره <b>45 فما دون</b>. ومن انتسب فوق 45 رسمه السنوي أقل لأنه لا يدفع حصة الوفاة.</li>" +
            "<li>كل سنة دفعها المحامي تعلّم عليها «مدفوع» فتُطرح من المجموع.</li></ol>" +
            ex("منتسب في 10/3/2019 ومولود في 1/6/1985: عمره 33 سنة و9 أشهر ← سطر 34. لا يوجد جدول 2019 فيُعتمد جدول 2020 بلا رسمه السنوي، ثم الرسم السنوي لكل سنة: 2019 (145) و2020 (155) و2021 (400) و2022 (650) و2023 (750) و2024 (750) و2025 (750) و2026 (5,000).")),
        sec("refresh", "إعادة القيد والحالات الأخرى",
            '<div class="table-wrap"><table class="fee-tbl"><thead><tr><th>الحالة</th><th>الرسوم</th></tr></thead><tbody>' +
            "<tr><td>مشطوب أمني</td><td>الرسم السنوي لكل سنة من " + X.securityFrom + " حتى سنة قرار إعادة القيد. الهوية والإجازة والشارة اختيارية.</td></tr>" +
            "<tr><td>مشطوب إداري</td><td>نقابة " + n(X.admUnion) + " + تقاعد " + n(X.admPension) + " + معونة وفاة " + n(X.deathAid) + " (إن كان عمره يوم القرار 45 فما دون) + " + n(X.gapYear) + " عن كل سنة انقطاع + مطبوعات " + n(X.prints) + " + تثبيت ممارسة " + n(X.practice) + ". والهوية والإجازة والشارة اختيارية.</td></tr>" +
            "<tr><td>ترقين بطلب المحامي</td><td>رسم سنة الترقين وكل رسم سابق غير مدفوع، لأنه يجب أن يكون بريء الذمة.</td></tr>" +
            "<tr><td>إعادة قيد بعد الترقين</td><td>نقابة " + n(X.reUnion) + " + تقاعد " + n(X.rePension) + " + معونة وفاة " + n(X.deathAid) + " (بشرط العمر نفسه) + " + n(X.gapYear) + " عن كل سنة انقطاع + مطبوعات " + n(X.prints) + " + تثبيت ممارسة " + n(X.practice) + ". والهوية والإجازة والشارة اختيارية.</td></tr>" +
            "<tr><td>مُغفَل</td><td>نقابة " + n(X.omUnion) + " + تقاعد " + n(X.omPension) + " + كل الرسوم السنوية غير المدفوعة بعد آخر سنة دفعها.</td></tr>" +
            "<tr><td>نقل من فرع لآخر</td><td>نقابة " + n(X.trfUnion) + " + تقاعد " + n(X.trfPension) + "، بشرط براءة الذمة.</td></tr>" +
            "<tr><td>نقل متمرن إلى الأساتذة</td><td>نقابة " + n(X.tmUnion) + " + تقاعد " + n(X.tmPension) + " + رسم إجازة " + n(X.tmLicenseFee) + " + هوية " + n(X.tmId) + " + ثمن إجازة " + n(X.tmLicensePrice) + " = " + n(X.tmUnion + X.tmPension + X.tmLicenseFee + X.tmId + X.tmLicensePrice) + ".</td></tr>" +
            "<tr><td>معفى من التمرين</td><td>قيد الدراسة.</td></tr></tbody></table></div>" +
            "<p><b>سنوات الانقطاع</b> تُحسب من تاريخ الشطب أو الترقين حتى قرار إعادة القيد، وأي جزء من سنة = سنة، ويمكنك تعديل العدد يدوياً.</p>" +
            ex("مشطوب إداري في 1/1/2022، وأُعيد قيده في 1/2/2025، وعمره 40: الانقطاع 3 سنوات وشهر ← 4 سنوات. المجموع: " + n(X.admUnion) + " + " + n(X.admPension) + " + " + n(X.deathAid) + " + (4 × " + n(X.gapYear) + ") + " + n(X.prints) + " + " + n(X.practice) + " = " + n(X.admUnion + X.admPension + X.deathAid + 4 * X.gapYear + X.prints + X.practice) + ".")),
        sec("building", "المركزية والفرع، وأكثر من عملية معاً",
            "<ul><li>كل ما في الجداول المركزية رسوم <b>النقابة المركزية</b>، ويُضاف إليها <b>رسم الفرع</b>. تختار النطاق: <b>مركزية + فرع</b> (الافتراضي)، أو مركزية فقط، أو فرع فقط.</li>" +
            "<li><b>الانتساب الجديد</b>: بنود جدول الفروع حسب العمر (جدول " + D.BRANCH_YEARS.join("، ") + ") ما عدا الرسم السنوي للفرع، ثم الرسم السنوي للفرع (" + n(D.BRANCH_ANNUAL[D.BRANCH_LAST] || 0) + ") لكل سنة من " + D.BRANCH_FIRST + " فقط. ورسم «الرسم السنوي لمتطلبات التمرين» يُدفع مرة عند الانتساب. و«مطبوعات + مفكرة» تُفعَّل ويُكتب مبلغها حسب المطبوعات الموجودة.</li>" +
            "<li><b>الأستذة (الانتقال لجدول الأساتذة)</b>: الرسم المركزي حسب تاريخ الانتقال: قبل 1/3/2026 = " + n(X.tmOld) + "، ومنه = " + n(X.tmUnion + X.tmPension + X.tmLicenseFee + X.tmId + X.tmLicensePrice) + ". ورسم الفرع " + n(X.brMaster) + " افتراضياً (غير محدد قبل 1/3/2026)، ويمكن تغييره لكل حساب.</li>" +
            "<li><b>رسوم الفرع الثابتة</b>: أستذة " + n(X.brMaster) + "، نقل " + n(X.brTransfer) + "، إعادة قيد المُغفَل " + n(X.brOmitted) + "، إعادة قيد المرقّن " + n(X.brReCancel) + "، إعادة قيد المشطوب " + n(X.brStruck) + " (والمشطوب الأمني معفى أحياناً، فيمكن إلغاؤه).</li>" +
            "<li><b>أكثر من عملية</b> (مثل إعادة قيد + أستذة، أو انتساب + أستذة): تُحسب كل عملية ببنودها. البند المتكرر (مثل الهوية) يُحسب في كل عملية لأنه يُدفع مرة متمرناً ومرة أستاذاً، ويمكن إلغاء تكراره بخانته. والرسم السنوي للسنة الواحدة يُحسب مرة واحدة.</li>" +
            "<li>التقرير يذكر الحالة والنطاق، ولكل عملية: لماذا وكيف، وجدول بنودها مع الجهة (مركزية / فرع)، ثم خلاصة المركزية والفرع والمجموع.</li></ul>" +
            '<div class="table-wrap" style="margin-top:12px"><table class="fee-tbl small"><thead><tr><th>العمر</th>' + F.BCOLS.map(function (c) { return "<th>" + c[1] + "</th>"; }).join("") + "<th>المجموع</th></tr></thead><tbody>" +
            F.AGES.map(function (a) { const r = D.BRANCH_TABLES[D.BRANCH_YEARS[D.BRANCH_YEARS.length - 1]].rows[a]; let t = 0; return "<tr><td>" + a + "</td>" + F.BCOLS.map(function (c) { t += r[c[0]]; return '<td class="n">' + fmt(r[c[0]]) + "</td>"; }).join("") + '<td class="n"><b>' + fmt(t) + "</b></td></tr>"; }).join("") +
            "</tbody></table></div>"),
        sec("calendar-dollar", "الرسم السنوي لكل سنة (ل.س — العملة الجديدة)",
            '<div class="table-wrap"><table class="fee-tbl small"><thead><tr><th>السنة</th><th>حتى 45</th><th>من انتسب فوق 45</th></tr></thead><tbody>' + annualRows + "</tbody></table></div>" +
            '<p class="muted">السنوات التي لا جدول انتساب لها بالمبلغ نفسه للجميع ما لم يُحدَّد غير ذلك. وما بعد ' + D.LAST + " يُحسب برسم " + D.LAST + " مع تنبيه حتى تُضاف السنة الجديدة في «إعدادات الرسوم».</p>"),
        sec("table", "جدول رسوم الانتساب حسب العمر",
            '<div class="seg help-years" id="helpYears">' + D.TABLE_YEARS.map(function (y) { return '<button type="button" data-hy="' + y + '"' + (y === last ? ' class="on"' : "") + ">" + y + "</button>"; }).join("") + "</div>" +
            '<div id="helpYearTable">' + feeTableHTML(last) + "</div>")
    ].join("");
    }

    function render() {
        DATA = window.FeesUI ? window.FeesUI.settings().data || null : null;
        D = F.dataWith(DATA);
        $("#helpPension").innerHTML = pension;
        $("#helpFees").innerHTML = feesHTML();
    }
    window.HelpUI = { render: render };
    render();
    $("#helpSeg").addEventListener("click", function (e) {
        const b = e.target.closest("[data-help]"); if (!b) return;
        $$("#helpSeg button").forEach(function (x) { x.classList.toggle("on", x === b); });
        $("#helpPension").hidden = b.dataset.help !== "pension";
        $("#helpFees").hidden = b.dataset.help !== "fees";
    });
    $("#helpFees").addEventListener("click", function (e) {
        const b = e.target.closest("[data-hy]"); if (!b) return;
        $$("#helpYears button").forEach(function (x) { x.classList.toggle("on", x === b); });
        $("#helpYearTable").innerHTML = feeTableHTML(+b.dataset.hy);
    });
})();
