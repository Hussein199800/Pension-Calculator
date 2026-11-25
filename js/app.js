/* =========================================================
   حاسبة المحامي — الواجهة والجلسة والحفظ والتنقل
   - قسم الراتب التقاعدي هنا، وقسم الرسوم في fees.js و fees-ui.js (منفصل تماماً).
   ---------------------------------------------------------
   - الحسابات كلها في calc.js (PensionCalc)، والتقرير في report.js.
   - التخزين المحلي: localStorage بالمفاتيح نفسها منذ الإصدار الأول
     (pc.cases.v1 / pc.settings.v1 / pc.draft.v1) — لا تُغيَّر ولا تُمسح.
   - الدخول محلي على كل جهاز. تيليجرام و Firebase: واجهة فقط (قريباً).
   ========================================================= */
"use strict";

const C = window.PensionCalc, Rp = window.PensionReport;
const APP_VERSION = "3.0.0";
const KEY_CASES = "pc.cases.v1", KEY_SET = "pc.settings.v1", KEY_DRAFT = "pc.draft.v1", KEY_USERS = "pc.users.v1", KEY_SESSION = "pc_session", KEY_THEME = "pc_theme";
/* مفاتيح قسم الرسوم (جديدة، منفصلة عن حالات التقاعد) */
const KEY_FEES = "pc.fees.v1", KEY_FDRAFT = "pc.feesDraft.v1", KEY_FSET = "pc.feeSettings.v1";
/* إعدادات طباعة تقرير التقاعد (جديدة v3، منفصلة عن إعدادات الرسوم) */
const KEY_PPRINT = "pc.pensionPrint.v1";
const BACKUP_FORMAT = "pension-calculator-backup", BACKUP_VERSION = 1;

/* =========================================================
   أدوات عامة
   ========================================================= */
const $ = function (s, r) { return (r || document).querySelector(s); };
const $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
const esc = Rp.esc;
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); return true; } catch (e) { return false; } }
function load(k, def) { try { const v = lsGet(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } }
function store(k, v) { return lsSet(k, JSON.stringify(v)); }
function thisMonth() { const d = new Date(); return d.getFullYear() + "-" + (d.getMonth() < 9 ? "0" : "") + (d.getMonth() + 1); }

/* SHA-256 (بلا مكتبات؛ يعمل حتى من ملف محلي) — نفس نظام الصرافة */
function sha256(text) {
    const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
    const bytes = new TextEncoder().encode(text);
    const len = bytes.length;
    const words = new Uint32Array(((len + 9 + 63) >> 6) << 4);
    for (let i = 0; i < len; i++) words[i >> 2] |= bytes[i] << (24 - (i % 4) * 8);
    words[len >> 2] |= 0x80 << (24 - (len % 4) * 8);
    words[words.length - 1] = len * 8;
    const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const W = new Uint32Array(64);
    const rot = function (x, n) { return (x >>> n) | (x << (32 - n)); };
    for (let j = 0; j < words.length; j += 16) {
        for (let t = 0; t < 64; t++) {
            if (t < 16) W[t] = words[j + t];
            else {
                const s0 = rot(W[t - 15], 7) ^ rot(W[t - 15], 18) ^ (W[t - 15] >>> 3);
                const s1 = rot(W[t - 2], 17) ^ rot(W[t - 2], 19) ^ (W[t - 2] >>> 10);
                W[t] = (W[t - 16] + s0 + W[t - 7] + s1) | 0;
            }
        }
        let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
        for (let t = 0; t < 64; t++) {
            const S1 = rot(e, 6) ^ rot(e, 11) ^ rot(e, 25);
            const ch = (e & f) ^ (~e & g);
            const t1 = (h + S1 + ch + K[t] + W[t]) | 0;
            const S0 = rot(a, 2) ^ rot(a, 13) ^ rot(a, 22);
            const mj = (a & b) ^ (a & c) ^ (b & c);
            const t2 = (S0 + mj) | 0;
            h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
        }
        H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
        H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    return H.map(function (x) { return (x >>> 0).toString(16).padStart(8, "0"); }).join("");
}
function passHash(userId, password) { return sha256("pc:" + userId + ":" + password); }

/* =========================================================
   الرسائل والنوافذ (بدل alert/confirm)
   ========================================================= */
function toast(html, kind, ms) {
    const el = document.createElement("div");
    el.className = "toast " + (kind || "");
    const icon = { ok: "circle-check", bad: "alert-circle", warn: "alert-triangle" }[kind] || "info-circle";
    el.innerHTML = '<i class="ti ti-' + icon + ' toast-icon" aria-hidden="true"></i><div>' + html + "</div>";
    el.addEventListener("click", function () { el.style.display = "none"; });
    $("#toasts").appendChild(el);
    setTimeout(function () { el.remove(); }, ms || 4500);
}
function modal(html, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
        const back = document.createElement("div");
        back.className = "modal-back";
        back.innerHTML = '<div class="modal ' + (opts.wide ? "wide" : "") + '" role="dialog" aria-modal="true">' + html + "</div>";
        $("#modalRoot").appendChild(back);
        const box = back.firstChild;
        function done(v) { back.remove(); document.removeEventListener("keydown", onKey); resolve(v); }
        function onKey(e) { if (e.key === "Escape") done(null); }
        document.addEventListener("keydown", onKey);
        back.addEventListener("click", function (e) { if (e.target === back) done(null); });
        box.addEventListener("click", function (e) {
            const b = e.target.closest("[data-modal]");
            if (!b) return;
            const v = b.getAttribute("data-modal");
            if (v === "cancel") { done(null); return; }
            if (opts.collect) { const res = opts.collect(box, v); if (res === false) return; done(res); }
            else done(v);
        });
        const f = box.querySelector("[autofocus], input, select, textarea, button.primary");
        if (f) setTimeout(function () { f.focus(); }, 30);
    });
}
function confirmBox(title, body, okText, danger) {
    return modal("<h3>" + esc(title) + "</h3><div>" + body + '</div><div class="actions">' +
        '<button class="btn ' + (danger ? "danger" : "primary") + '" data-modal="ok">' + esc(okText || "تأكيد") + "</button>" +
        '<button class="btn" data-modal="cancel">إلغاء</button></div>').then(function (v) { return v === "ok"; });
}

/* =========================================================
   الشعار
   ========================================================= */
function sealSVG(extraClass) {
    return '<svg class="seal brand-mark' + (extraClass ? " " + extraClass : "") + '" viewBox="0 0 64 64" aria-hidden="true">' +
        '<rect class="bm-tile" x="2" y="2" width="60" height="60" rx="17"/>' +
        '<g class="bm-arrows" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M18 15 H38 L46 23 V47 H18 Z"/><path d="M24 27 H40"/><path d="M24 34 H40"/><path d="M24 41 H32"/></g>' +
        '<circle class="bm-badge" cx="47" cy="46.5" r="10.5"/>' +
        '<path class="bm-check" d="M42.3 46.6 L45.6 49.9 L51.8 43.4" fill="none" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>' +
        "</svg>";
}
$$("svg.seal[data-seal]").forEach(function (old) {
    const extra = Array.from(old.classList).filter(function (c) { return c !== "seal"; }).join(" ");
    const holder = document.createElement("div");
    holder.innerHTML = sealSVG(extra);
    old.replaceWith(holder.firstChild);
});
function toggleTheme() {
    const t = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", t);
    lsSet(KEY_THEME, t);
}
const rptStyle = document.createElement("style"); rptStyle.textContent = Rp.CSS; document.head.appendChild(rptStyle);

/* =========================================================
   المستخدمون والجلسة (دخول محلي على كل جهاز)
   ========================================================= */
let me = null;
function users() {
    let list = load(KEY_USERS, null);
    if (!list || !list.length) {
        list = [{ id: "u-admin", username: "admin", name: "المدير", hash: passHash("u-admin", "1234"), isDefault: true }];
        store(KEY_USERS, list);
    }
    return list;
}
function findSessionUser() {
    const s = load(KEY_SESSION, null);
    if (!s) return null;
    return users().find(function (u) { return u.id === s.id && u.hash === s.hash; }) || null;
}
function showLogin() {
    $("#app").classList.add("hidden");
    $("#loginScreen").classList.remove("hidden");
    $("#loginError").textContent = "";
    const u = users();
    $("#loginHint").hidden = !(u.length === 1 && u[0].isDefault);
    setTimeout(function () { $("#loginUser").focus(); }, 50);
}
function login(username, password) {
    const u = users().find(function (x) { return x.username.toLowerCase() === username.trim().toLowerCase(); });
    if (!u || u.hash !== passHash(u.id, password)) return false;
    me = u;
    store(KEY_SESSION, { id: u.id, hash: u.hash, at: new Date().toISOString() });
    return true;
}
function logout() { lsSet(KEY_SESSION, null); me = null; showLogin(); }
function enterApp() {
    $("#loginScreen").classList.add("hidden");
    $("#app").classList.remove("hidden");
    renderSideUser();
    go(location.hash.replace("#", "") || "calc");
}
async function changePassword() {
    const res = await modal('<h3>تغيير بيانات الدخول</h3>' +
        '<div class="stack"><label class="field"><span>اسم المستخدم</span><input id="pwUser" value="' + esc(me.username) + '"></label>' +
        '<label class="field"><span>الاسم الظاهر</span><input id="pwName" value="' + esc(me.name || "") + '"></label>' +
        '<label class="field"><span>كلمة المرور الحالية</span><input id="pwOld" type="password" autocomplete="current-password"></label>' +
        '<label class="field"><span>كلمة المرور الجديدة</span><input id="pwNew" type="password" autocomplete="new-password"></label>' +
        '<label class="field"><span>تأكيد كلمة المرور الجديدة</span><input id="pwNew2" type="password" autocomplete="new-password"></label></div>' +
        '<p class="error-text" id="pwErr"></p><div class="actions"><button class="btn primary" data-modal="ok">حفظ</button><button class="btn" data-modal="cancel">إلغاء</button></div>', {
        collect: function (box) {
            const err = box.querySelector("#pwErr");
            const user = box.querySelector("#pwUser").value.trim(), nw = box.querySelector("#pwNew").value;
            if (passHash(me.id, box.querySelector("#pwOld").value) !== me.hash) { err.textContent = "كلمة المرور الحالية غير صحيحة."; return false; }
            if (!user) { err.textContent = "أدخل اسم المستخدم."; return false; }
            if (nw.length < 4) { err.textContent = "كلمة المرور الجديدة 4 أحرف على الأقل."; return false; }
            if (nw !== box.querySelector("#pwNew2").value) { err.textContent = "التأكيد لا يطابق كلمة المرور الجديدة."; return false; }
            return { username: user, name: box.querySelector("#pwName").value.trim(), pass: nw };
        }
    });
    if (!res) return;
    const list = users().map(function (u) {
        if (u.id !== me.id) return u;
        return Object.assign({}, u, { username: res.username, name: res.name, hash: passHash(u.id, res.pass), isDefault: false });
    });
    store(KEY_USERS, list);
    me = list.find(function (u) { return u.id === me.id; });
    store(KEY_SESSION, { id: me.id, hash: me.hash, at: new Date().toISOString() });
    toast("حُفظت بيانات الدخول الجديدة", "ok");
    renderSideUser();
}

/* =========================================================
   التنقل
   ========================================================= */
const PAGES = {
    calc: { title: "حاسبة الراتب التقاعدي", group: "الراتب التقاعدي" }, report: { title: "تقرير التقاعد", group: "الراتب التقاعدي" }, cases: { title: "حالات التقاعد", group: "الراتب التقاعدي" },
    settings: { title: "إعدادات التقاعد", group: "الراتب التقاعدي" },
    fcalc: { title: "حاسبة الرسوم", group: "الانتساب والرسوم" }, freport: { title: "تقرير الرسوم", group: "الانتساب والرسوم" }, fcases: { title: "حسابات الرسوم", group: "الانتساب والرسوم" },
    fsettings: { title: "إعدادات الرسوم", group: "الانتساب والرسوم" },
    help: { title: "الشرح", group: "عام" }, backup: { title: "النسخ الاحتياطي", group: "عام" }
};
let current = "calc";
function go(sec) {
    if (sec === "more") sec = "settings"; /* رابط قديم لصفحة «المزيد» */
    if (!PAGES[sec]) sec = "calc";
    current = sec;
    const p = PAGES[sec];
    $$("[data-page]").forEach(function (el) { el.hidden = el.getAttribute("data-page") !== sec; });
    $$("#sideNav [data-sec]").forEach(function (b) {
        const on = b.dataset.sec === sec;
        b.classList.toggle("on", on);
        if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
    $("#topTitle").textContent = p.title;
    $("#topSub").textContent = "حاسبة المحامي · " + p.group;
    document.title = p.title + " · حاسبة المحامي";
    closeNav();
    if (sec === "cases") renderCases();
    if (sec === "settings") fillSettings();
    if (sec === "backup") renderBackupInfo();
    if (window.FeesUI) window.FeesUI.onPage(sec);
    if (location.hash !== "#" + sec) history.replaceState(null, "", "#" + sec);
    window.scrollTo(0, 0);
}
/* القائمة الجانبية: ظاهرة على الشاشة الكبيرة، وتُفتح بزر ☰ على الهاتف والآيباد */
function openNav() { document.body.classList.add("nav-open"); $("#menuBtn").setAttribute("aria-expanded", "true"); }
function closeNav() { document.body.classList.remove("nav-open"); $("#menuBtn").setAttribute("aria-expanded", "false"); }
$("#menuBtn").addEventListener("click", function () { if (document.body.classList.contains("nav-open")) closeNav(); else openNav(); });
$("#sideClose").addEventListener("click", closeNav);
$("#navOverlay").addEventListener("click", closeNav);
document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && document.body.classList.contains("nav-open") && !$("#modalRoot").children.length) closeNav();
});
$("#sideNav").addEventListener("click", function (e) { const b = e.target.closest("[data-sec]"); if (b) go(b.dataset.sec); });
$("#themeBtn").addEventListener("click", toggleTheme);
document.addEventListener("click", function (e) { const g = e.target.closest("[data-go]"); if (g) go(g.dataset.go); });

/* بيانات المستخدم وأزراره أسفل القائمة الجانبية (كانت في «المزيد») */
function renderSideUser() {
    if (!me) return;
    $("#sideUserName").textContent = me.name || me.username;
    $("#sideUserLogin").textContent = me.username;
    $("#sidePwWarn").classList.toggle("hidden", !me.isDefault);
    $("#sideVer").textContent = "الإصدار " + APP_VERSION;
}
$(".side-foot").addEventListener("click", async function (e) {
    const b = e.target.closest("[data-side]");
    if (!b) return;
    if (b.dataset.side === "pw") changePassword();
    if (b.dataset.side === "logout" && await confirmBox("تسجيل الخروج", "هل تريد تسجيل الخروج من هذا الجهاز؟ تبقى الحالات محفوظة.", "خروج")) logout();
});

/* =========================================================
   الإعدادات والقيم
   ========================================================= */
function getSettings() { return load(KEY_SET, null) || { org: "" }; }

/* ---------- محرر التوقيعات (يستعمله القسمان، وكل قسم يحفظ توقيعاته في مفتاحه) ---------- */
function signEditor(box, list) {
    box.innerHTML = '<div class="table-wrap"><table class="edit"><thead><tr><th>الصفة</th><th>الاسم</th><th></th></tr></thead><tbody></tbody></table></div>' +
        '<button type="button" class="btn sm" data-sign-add style="margin-top:10px"><i class="ti ti-plus"></i>إضافة توقيع</button>' +
        '<p class="hint-line" style="margin:8px 0 0">الاسم الثابت الفارغ يترك خطاً للتوقيع باليد. «من الحاسبة» يأخذ الاسم المكتوب في حقل منظم التقرير أو المدقق.</p>';
    const tb = box.querySelector("tbody");
    function row(x) {
        x = x || { title: "", src: "fixed", name: "" };
        const tr = document.createElement("tr");
        tr.innerHTML = '<td><input data-k="title" placeholder="مثال: رئيس الفرع"></td>' +
            '<td><div class="sign-name"><select data-k="src"><option value="fixed">اسم ثابت</option><option value="preparer">من الحاسبة: منظم التقرير</option><option value="reviewer">من الحاسبة: المدقق</option></select><input data-k="name" placeholder="فارغ = خط للكتابة باليد"></div></td>' +
            '<td class="sign-ops"><button type="button" class="x up" aria-label="أعلى" data-sign-up><i class="ti ti-arrow-up"></i></button><button type="button" class="x" aria-label="حذف" data-sign-del><i class="ti ti-trash"></i></button></td>';
        tr.querySelector("[data-k=title]").value = x.title || "";
        tr.querySelector("[data-k=src]").value = x.src || "fixed";
        tr.querySelector("[data-k=name]").value = x.name || "";
        const upd = function () { tr.querySelector("[data-k=name]").hidden = tr.querySelector("[data-k=src]").value !== "fixed"; };
        tr.querySelector("[data-k=src]").onchange = upd; upd();
        tb.appendChild(tr);
    }
    (list || []).forEach(row);
    box.onclick = function (e) {
        if (e.target.closest("[data-sign-add]")) row();
        const tr = e.target.closest("tr");
        if (tr && e.target.closest("[data-sign-del]")) tr.remove();
        if (tr && e.target.closest("[data-sign-up]") && tr.previousElementSibling) tr.parentNode.insertBefore(tr, tr.previousElementSibling);
    };
}
function readSigns(box) {
    return $$("tbody tr", box).map(function (tr) {
        const src = $("[data-k=src]", tr).value;
        return { title: $("[data-k=title]", tr).value.trim(), src: src, name: src === "fixed" ? $("[data-k=name]", tr).value.trim() : "" };
    }).filter(function (x) { return x.title || x.name || x.src !== "fixed"; });
}
/* طباعة تقرير التقاعد: حجم الخط والنص الختامي والتوقيعات. الغائب = الشكل السابق تماماً */
function pensionPrint() { return load(KEY_PPRINT, null) || {}; }
function rptMeta() { const pp = pensionPrint(); return { org: getSettings().org, fontSize: pp.fontSize || "", footer: pp.footer || "", signs: pp.signs || null }; }
function effSettings() { const s = getSettings(), o = {}; for (const k in s) if (k !== "org") o[k] = s[k]; return o; }
function addValRow(id, r) {
    const tr = $("#valRow").content.firstElementChild.cloneNode(true);
    if (r) { $("[data-k=from]", tr).value = r.from || ""; $("[data-k=value]", tr).value = r.value; $("[data-k=note]", tr).value = r.note || ""; }
    $(".x", tr).onclick = function () { tr.remove(); };
    $("#" + id + " tbody").appendChild(tr);
}
function readValTable(id) {
    return $$("#" + id + " tbody tr").map(function (tr) { return { from: $("[data-k=from]", tr).value, value: +$("[data-k=value]", tr).value, note: $("[data-k=note]", tr).value }; })
        .filter(function (r) { return r.from && isFinite(r.value) && r.value > 0; });
}
function fillSettings() {
    const s = C.settingsWith(effSettings()), raw = getSettings();
    $("#setOrg").value = raw.org || "";
    const pp = pensionPrint();
    $("#pFont").value = pp.fontSize || ""; $("#pFooter").value = pp.footer || "";
    signEditor($("#pSigns"), pp.signs || Rp.PENSION_SIGNS);
    $("#pensionTbl tbody").innerHTML = ""; s.pensionTable.forEach(function (r) { addValRow("pensionTbl", r); });
    $("#aidTbl tbody").innerHTML = ""; s.aidTable.forEach(function (r) { addValRow("aidTbl", r); });
    $("#setCutoff").value = s.cutoffDate; $("#setMax").value = s.maxYears;
    $("#setPYM").value = s.pensionYearMode; $("#setAYM").value = s.aidYearMode;
    $("#setBracket").value = s.bracketBoundary; $("#setTraining").value = s.trainingMaxYears;
}
$$("[data-addrow]").forEach(function (b) { b.onclick = function () { addValRow(b.getAttribute("data-addrow")); }; });
$("#saveSettings").onclick = function () {
    const s = {
        org: $("#setOrg").value.trim(),
        pensionTable: readValTable("pensionTbl"), aidTable: readValTable("aidTbl"),
        cutoffDate: $("#setCutoff").value || C.DEFAULTS.cutoffDate, maxYears: +$("#setMax").value || C.DEFAULTS.maxYears,
        pensionYearMode: $("#setPYM").value, aidYearMode: $("#setAYM").value, treasuryShare: true,
        bracketBoundary: $("#setBracket").value, trainingMaxYears: $("#setTraining").value === "" ? C.DEFAULTS.trainingMaxYears : +$("#setTraining").value
    };
    if (!s.pensionTable.length || !s.aidTable.length) { toast("يجب إدخال قيمة واحدة على الأقل للمعاش وللمعونة.", "bad"); return; }
    if (!(Number.isInteger(s.trainingMaxYears) && s.trainingMaxYears >= 0)) { toast("أقصى مدة تمرين يجب أن تكون عدداً صحيحاً من السنوات (0 أو أكثر).", "bad"); $("#setTraining").focus(); return; }
    const pp = { fontSize: $("#pFont").value, footer: $("#pFooter").value.trim(), signs: readSigns($("#pSigns")) };
    if (store(KEY_SET, s) && store(KEY_PPRINT, pp)) toast("حُفظت إعدادات التقاعد", "ok"); else toast("تعذر الحفظ في هذا المتصفح.", "bad");
    /* الزيادات تُطبَّق من أول الشهر (قرار المالك): تنبيه إن كُتب تاريخ نفاذ في منتصف الشهر */
    const mid = s.pensionTable.concat(s.aidTable).filter(function (r) { return r.from && !/-01$/.test(r.from) && r.from > "1900-01-01"; });
    if (mid.length) toast("تنبيه: الزيادات تُطبَّق من أول الشهر، وهذه التواريخ ليست أول شهر: " + mid.map(function (r) { return r.from.split("-").reverse().join("/"); }).join("، ") + ". صحّحها إلى اليوم الأول من الشهر حتى تطابق الخلاصة جدول الأشهر.", "warn", 9000);
    if (lastCase) rerender();
};
$("#resetSettings").onclick = async function () {
    if (!await confirmBox("استعادة القيم الافتراضية", "ستعود جداول القيم وقواعد الحساب إلى ما ورد في التعاميم. اسم الجهة وإعدادات الطباعة تبقى كما هي.", "استعادة")) return;
    store(KEY_SET, { org: getSettings().org || "" }); fillSettings(); toast("استُعيدت القيم الافتراضية", "ok");
};

/* =========================================================
   النموذج: الجداول الديناميكية والجمع والتعبئة
   ========================================================= */
const form = $("#caseForm");
let currentId = null, lastCase = null, lastResult = null, legacyPaymentStart = "", legacyRegDecision = "";

function addEx(r) {
    const tr = $("#exRow").content.firstElementChild.cloneNode(true);
    if (r) { $("[data-k=reason]", tr).value = r.reason || "أخرى"; $("[data-k=from]", tr).value = r.from || ""; $("[data-k=to]", tr).value = r.to || ""; }
    $(".x", tr).onclick = function () { tr.remove(); liveService(); saveDraft(); };
    $("#exTable tbody").appendChild(tr);
}
function addHeir(r) {
    const tr = $("#heirRow").content.firstElementChild.cloneNode(true);
    if (r) $$("[data-k]", tr).forEach(function (el) { const k = el.getAttribute("data-k"); if (el.type === "checkbox") el.checked = !!r[k]; else if (r[k] !== undefined) el.value = r[k]; });
    const sel = $("[data-k=relation]", tr);
    function upd() { $$("[data-rel]", tr).forEach(function (l) { l.hidden = l.getAttribute("data-rel").split(" ").indexOf(sel.value) < 0; }); }
    sel.onchange = upd; upd();
    $(".x", tr).onclick = function () { tr.remove(); saveDraft(); };
    $("#heirTable tbody").appendChild(tr);
}
$("#addEx").onclick = function () { addEx(); };
$("#addHeir").onclick = function () { addHeir(); };

function val(n) { const el = form.elements[n]; if (!el) return ""; if (el.type === "checkbox") return el.checked; return (el.value || "").trim(); }
function radio(n) { const el = form.querySelector("input[name=" + n + "]:checked"); return el ? el.value : ""; }

function collect() {
    const type = radio("type"), status = val("status");
    const c = {
        name: val("name"), fatherName: val("fatherName"), motherName: val("motherName"), birthDate: val("birthDate"), birthPlace: val("birthPlace"),
        nationalId: val("nationalId"), memberNo: val("memberNo"), branch: val("branch"), fileNo: val("fileNo"), phone: val("phone"), address: val("address"),
        type: type, status: status, originalType: val("originalType"),
        joinDate: val("joinDate"), registrationDecisionDate: (legacyRegDecision && val("registrationDecisionDate")) || val("joinDate"),
        reRegistration: val("reRegistration"), priorPracticeYears: val("priorPracticeYears"),
        retirementDate: val("retirementDate"), reviewDate: val("reviewDate"), appealWaived: val("appealWaived"), medicalDate: val("medicalDate"),
        occupational: type === "heirs" ? val("occupationalHeirs") : val("occupational"),
        deathDate: val("deathDate"), deathDuringWork: val("deathDuringWork"),
        includeAid: val("includeAid"), requestedHalfAid: val("requestedHalfAid"), receivedHalfAid: val("receivedHalfAid"), receivedRetirementAid: val("receivedRetirementAid"), receivedHalfRetirementAid: val("receivedHalfRetirementAid"),
        untilMonth: val("untilMonth"), preparer: val("preparer"), reviewer: val("reviewer"), notes: val("notes"),
        service: {
            mode: val("serviceMode") || "dates", start: val("serviceStart"), masterDate: val("masterDate"), stillTrainee: val("stillTrainee"), end: val("serviceEnd"),
            exclusions: $$("#exTable tbody tr").map(function (tr) { return { reason: $("[data-k=reason]", tr).value, from: $("[data-k=from]", tr).value, to: $("[data-k=to]", tr).value }; }),
            manual: { y: val("manY"), m: val("manM"), d: val("manD") }
        },
        heirs: type === "heirs" ? $$("#heirTable tbody tr").map(function (tr) {
            const h = {}; $$("[data-k]", tr).forEach(function (el) { if (el.closest("[hidden]")) return; const k = el.getAttribute("data-k"); h[k] = el.type === "checkbox" ? el.checked : el.value.trim(); }); return h;
        }) : []
    };
    if (type === "health" && !c.retirementDate) c.retirementDate = c.medicalDate;
    /* ما كتبه المستخدم يُحفظ وحده (endInput)؛ الفارغ يبقى فارغاً ويتبع تاريخ الإحالة/الوفاة في كل مرة */
    c.service.endInput = c.service.end || "";
    if (!c.service.end) c.service.end = c.type === "heirs" ? (c.status === "inService" ? c.deathDate : c.retirementDate) : (c.retirementDate || c.medicalDate);
    if (currentId) c.id = currentId;
    /* حقل من الإصدار السابق: يظهر ويُعدَّل فقط في الحالات التي تحمله، ويُحفظ ولا يضيع */
    if (legacyPaymentStart) c.paymentStartDate = val("paymentStartDate");
    return c;
}

function validate(c) {
    const e = [];
    if (!c.name) e.push("أدخل اسم المحامي.");
    if (c.type === "ordinary" && !c.retirementDate) e.push("أدخل تاريخ الإحالة على التقاعد.");
    if (c.type === "health" && !c.medicalDate) e.push("أدخل تاريخ الخبرة الطبية.");
    if (c.type === "heirs") {
        if (!c.deathDate) e.push("أدخل تاريخ الوفاة.");
        if (c.status === "retired" && !c.retirementDate) e.push("أدخل تاريخ إحالة المورث على التقاعد.");
        if (!c.heirs.length) e.push("أضف أفراد الأسرة/الورثة.");
        if (c.retirementDate && c.deathDate && c.status === "retired" && c.deathDate < c.retirementDate) e.push("تاريخ الوفاة قبل تاريخ الإحالة على التقاعد.");
    }
    if (c.service.mode === "dates" && !c.service.start) e.push("أدخل تاريخ حلف اليمين.");
    if (c.type === "ordinary" && c.reviewDate && c.retirementDate && c.reviewDate < c.retirementDate) e.push("تاريخ مشاهدة مراقب الخزانة يسبق تاريخ قرار الإحالة على التقاعد.");
    if (c.service.mode === "dates" && c.service.masterDate && c.service.start && c.service.masterDate < c.service.start) e.push("تاريخ القيد في جدول الأساتذة يسبق تاريخ حلف اليمين.");
    if (c.type === "heirs" && c.status === "retired" && c.receivedRetirementAid && c.receivedHalfRetirementAid) e.push("اختر إما «قبض نصف معونة التقاعد» أو «قبض معونة التقاعد كاملة»، لا الاثنين.");
    if (c.service.mode === "dates" && c.service.masterDate && c.service.stillTrainee) e.push("اختر إما «تاريخ القيد في جدول الأساتذة» أو «بقي متمرناً حتى نهاية الممارسة»، لا الاثنين.");
    if (c.service.mode === "manual" && !c.service.manual.y && !c.service.manual.m) e.push("أدخل مدة الممارسة الصافية.");
    if (!c.untilMonth) e.push("حدد الشهر الذي تُحسب المستحقات حتى نهايته.");
    if (c.includeAid && !c.joinDate) e.push("أدخل تاريخ الانتساب للنقابة لحساب المعونة.");
    if (c.includeAid && !c.birthDate) e.push("أدخل تاريخ ميلاد المحامي (لازم لشروط العمر في المعونة).");
    return e;
}
function showErrors(list) {
    const box = $("#errors");
    if (!list.length) { box.classList.add("hidden"); return; }
    box.innerHTML = "<b>يرجى استكمال ما يلي:</b><ul style=\"margin:6px 20px 0 0\">" + list.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>";
    box.classList.remove("hidden"); box.scrollIntoView({ behavior: "smooth", block: "center" });
}

function compute(c) {
    const errs = validate(c);
    if (errs.length) return { errors: errs };
    const R = C.computeCase(c, effSettings());
    return R.errors.length ? { errors: R.errors } : { R: R };
}
function rerender() {
    if (!lastCase) return;
    const out = compute(lastCase);
    if (out.R) { lastResult = out.R; $("#report").innerHTML = Rp.render(lastCase, out.R, rptMeta()); }
}
form.addEventListener("submit", function (e) {
    e.preventDefault();
    const c = collect(), out = compute(c);
    if (out.errors) { showErrors(out.errors); return; }
    showErrors([]);
    lastCase = c; lastResult = out.R;
    $("#report").innerHTML = Rp.render(c, out.R, rptMeta());
    $("#reportEmpty").hidden = true; $("#reportBox").hidden = false;
    go("report");
    toast("أُنشئ التقرير", "ok", 2500);
});

/* إظهار/إخفاء الحقول حسب نوع الحالة */
function refresh() {
    const type = radio("type"), status = val("status"), orig = val("originalType");
    $$("#caseForm [data-types]").forEach(function (el) {
        let show = el.getAttribute("data-types").split(" ").indexOf(type) >= 0;
        const also = el.getAttribute("data-also");
        if (!show && also) { const p = also.split(":"); show = type === p[0] && status === p[1]; }
        const st = el.getAttribute("data-status"); if (show && st && type === "heirs") show = st === status;
        const og = el.getAttribute("data-orig"); if (show && og) show = og === orig;
        el.hidden = !show;
    });
    $$("#caseForm [data-when]").forEach(function (el) { el.hidden = !val(el.getAttribute("data-when")); });
    if (!legacyPaymentStart || type !== "ordinary") $("#legacyPayWrap").hidden = true;
    $("#legacyRegWrap").hidden = !legacyRegDecision;
    const mode = val("serviceMode") || "dates";
    $$("#caseForm [data-mode]").forEach(function (el) { el.hidden = el.getAttribute("data-mode") !== mode; });
    $$("[data-mode-btn]").forEach(function (b) { b.classList.toggle("on", b.dataset.modeBtn === mode); });
    $("#serviceEndHint").textContent = "إن تُرك فارغاً: " + (type === "heirs" ? (status === "inService" ? "تاريخ الوفاة" : "تاريخ الإحالة على التقاعد") : type === "health" ? "تاريخ الإحالة أو الخبرة الطبية" : "تاريخ الإحالة على التقاعد");
    liveService();
}
$("#serviceSeg").addEventListener("click", function (e) {
    const b = e.target.closest("[data-mode-btn]"); if (!b) return;
    form.elements.serviceMode.value = b.dataset.modeBtn; refresh(); saveDraft();
});
function liveService() {
    const c = collect(), out = $("#serviceLive");
    if (c.service.mode === "dates" && (!c.service.start || !c.service.end)) { out.textContent = ""; return; }
    const st = C.settingsWith(effSettings());
    const svcIn = Object.assign({}, c.service, { trainingMaxYears: st.trainingMaxYears });
    const s = C.computeService(svcIn);
    if (s.error) { out.textContent = s.error; return; }
    out.textContent = "مدة الممارسة الصافية: " + C.fmtYMD(s.net) + (c.type === "ordinary" ? " ← " + C.adoptYears(s.net, st.pensionYearMode).text : "");
}
form.addEventListener("change", function (e) {
    /* خيارا قبض المعونة متنافيان: تحديد أحدهما يلغي الآخر */
    const pair = { receivedHalfRetirementAid: "receivedRetirementAid", receivedRetirementAid: "receivedHalfRetirementAid" };
    if (e.target && pair[e.target.name] && e.target.checked) form.elements[pair[e.target.name]].checked = false;
    refresh(); saveDraft();
});
form.addEventListener("input", debounce(function () { liveService(); saveDraft(); }, 400));
function debounce(fn, ms) { let t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }

function fill(c) {
    form.reset();
    legacyPaymentStart = c.paymentStartDate || "";
    /* تاريخ قرار قيد مستقل من الإصدار الأول: يبقى محفوظاً ويُستعمل لشرط العمر كما كان */
    legacyRegDecision = c.registrationDecisionDate && c.registrationDecisionDate !== c.joinDate ? c.registrationDecisionDate : "";
    $("#exTable tbody").innerHTML = ""; $("#heirTable tbody").innerHTML = "";
    const sv = c.service || {};
    const map = {
        occupationalHeirs: c.type === "heirs" ? c.occupational : false, occupational: c.type !== "heirs" ? c.occupational : false,
        serviceStart: sv.start, masterDate: sv.masterDate, stillTrainee: sv.stillTrainee, serviceEnd: sv.endInput !== undefined ? sv.endInput : sv.end, serviceMode: sv.mode || "dates",
        manY: sv.manual && sv.manual.y, manM: sv.manual && sv.manual.m, manD: sv.manual && sv.manual.d
    };
    Array.prototype.forEach.call(form.elements, function (el) {
        if (!el.name || el.type === "radio" || el.type === "file") return;
        const v = el.name in map ? map[el.name] : c[el.name];
        if (v === undefined || v === null) return;
        if (el.type === "checkbox") el.checked = !!v; else el.value = v;
    });
    const tr = form.querySelector('input[name=type][value="' + (c.type || "ordinary") + '"]'); if (tr) tr.checked = true;
    (sv.exclusions || []).forEach(addEx);
    (c.heirs || []).forEach(addHeir);
    if (!form.elements.untilMonth.value) form.elements.untilMonth.value = thisMonth();
    currentId = c.id || null;
    lastCase = null; lastResult = null;
    $("#report").innerHTML = ""; $("#reportEmpty").hidden = false; $("#reportBox").hidden = true;
    $("#caseBadge").textContent = currentId ? "حالة محفوظة: " + (c.name || "") : "حالة جديدة";
    refresh();
}

/* =========================================================
   حفظ الحالات (إضافي دائماً: لا يُحذف شيء إلا بطلب صريح)
   ========================================================= */
function saveDraft() { store(KEY_DRAFT, collect()); }
function saveCase() {
    const c = current === "report" && lastCase ? lastCase : collect();
    if (!c.name) { toast("أدخل اسم المحامي قبل الحفظ.", "bad"); return; }
    const list = load(KEY_CASES, []);
    c.id = c.id || ("c" + Date.now());
    c.savedAt = new Date().toISOString();
    c.savedBy = me ? me.username : "";
    const next = list.filter(function (x) { return x.id !== c.id; }); next.unshift(c);
    if (store(KEY_CASES, next)) {
        currentId = c.id; if (lastCase) lastCase.id = c.id;
        $("#caseBadge").textContent = "حالة محفوظة: " + c.name;
        saveDraft();
        toast("حُفظت حالة: " + esc(c.name), "ok");
    } else toast("تعذر الحفظ في هذا المتصفح؛ حمّل نسخة احتياطية من «المزيد».", "bad");
}
document.addEventListener("click", async function (e) {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const a = b.dataset.act;
    if (a === "save") saveCase();
    if (a === "print") printReport();
    if (a === "download") downloadReport();
    if (a === "backupDownload") downloadBackup();
    if (a === "new") {
        if (!await confirmBox("حالة جديدة", "ستُفرَّغ الحاسبة. الحالات المحفوظة لا تتأثر.", "بدء حالة جديدة")) return;
        fill({ type: "ordinary", includeAid: true, untilMonth: thisMonth() });
        lastCase = null; lastResult = null; $("#reportEmpty").hidden = false; $("#reportBox").hidden = true; saveDraft();
        go("calc");
    }
});

const TYPE_NAME = { ordinary: "تقاعد عادي", health: "تقاعد صحي", heirs: "معاش ورثة" };
function renderCases() {
    const q = ($("#caseSearch").value || "").trim().toLowerCase();
    const list = load(KEY_CASES, []).filter(function (c) { return !q || (c.name || "").toLowerCase().indexOf(q) >= 0 || (c.fileNo || "").toLowerCase().indexOf(q) >= 0 || (c.memberNo || "").toLowerCase().indexOf(q) >= 0; });
    const box = $("#casesList");
    if (!list.length) { box.innerHTML = '<p class="empty">' + (q ? "لا نتائج مطابقة." : "لا توجد حالات محفوظة بعد.") + "</p>"; return; }
    box.innerHTML = list.map(function (c) {
        return '<div class="case-row"><div><b>' + esc(c.name) + "</b><small>" + esc(TYPE_NAME[c.type] || "") + " · إضبارة " + esc(c.fileNo || "—") + (c.branch ? " · " + esc(c.branch) : "") +
            " · حُفظت " + (c.savedAt ? new Date(c.savedAt).toLocaleString("ar-SY", { dateStyle: "medium", timeStyle: "short" }) : "") + "</small></div>" +
            '<div class="row"><button class="btn sm primary" data-open="' + esc(c.id) + '"><i class="ti ti-folder-open"></i>فتح</button>' +
            '<button class="btn sm" data-rep="' + esc(c.id) + '"><i class="ti ti-file-text"></i>التقرير</button>' +
            '<button class="btn sm danger" data-del="' + esc(c.id) + '" aria-label="حذف"><i class="ti ti-trash"></i></button></div></div>';
    }).join("");
}
$("#caseSearch").addEventListener("input", renderCases);
$("#casesList").addEventListener("click", async function (e) {
    const all = load(KEY_CASES, []);
    const find = function (id) { return all.find(function (x) { return x.id === id; }); };
    const o = e.target.closest("[data-open]"), r = e.target.closest("[data-rep]"), d = e.target.closest("[data-del]");
    if (o) { fill(find(o.dataset.open)); saveDraft(); go("calc"); toast("فُتحت الحالة", "ok", 2000); }
    if (r) {
        const c = find(r.dataset.rep); fill(c); saveDraft();
        const out = compute(collect());
        if (out.errors) { go("calc"); showErrors(out.errors); return; }
        lastCase = collect(); lastResult = out.R;
        $("#report").innerHTML = Rp.render(lastCase, out.R, rptMeta());
        $("#reportEmpty").hidden = true; $("#reportBox").hidden = false; go("report");
    }
    if (d) {
        const c = find(d.dataset.del);
        if (!await confirmBox("حذف حالة", "هل تريد حذف حالة <b>" + esc(c.name) + "</b> نهائياً من هذا الجهاز؟ يُنصح بتحميل نسخة احتياطية أولاً.", "حذف", true)) return;
        if (!store(KEY_CASES, load(KEY_CASES, []).filter(function (x) { return x.id !== c.id; }))) { toast("تعذر الحذف في هذا المتصفح.", "bad"); return; }
        if (currentId === c.id) { currentId = null; $("#caseBadge").textContent = "حالة جديدة"; saveDraft(); }
        if (lastCase && lastCase.id === c.id) { lastCase = null; lastResult = null; $("#report").innerHTML = ""; $("#reportEmpty").hidden = false; $("#reportBox").hidden = true; }
        renderCases(); toast("حُذفت الحالة", "ok");
    }
});

/* =========================================================
   الطباعة والتنزيل
   ========================================================= */
function fileName(kind, ext) { const c = lastCase || collect(); return (kind + " - " + (c.name || "بدون اسم") + (c.fileNo ? " - " + c.fileNo : "")).replace(/[\\/:*?"<>|]/g, "-") + "." + ext; }
function download(name, text, type) {
    const blob = new Blob([text], { type: type + ";charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function printReport() {
    if (!lastCase) return;
    $("#printArea").innerHTML = $("#report").innerHTML;
    window.print();
}
window.addEventListener("afterprint", function () { $("#printArea").innerHTML = ""; });
function downloadReport() {
    if (!lastCase) return;
    download(fileName("تقرير", "html"), Rp.standalone($("#report").innerHTML, "تقرير تقاعد - " + (lastCase.name || "")), "text/html");
}

/* =========================================================
   النسخ الاحتياطي والاستعادة (ملف) — الاستيراد يضيف ولا يحذف
   ========================================================= */
function renderBackupInfo() {
    const n = load(KEY_CASES, []).length, nf = load(KEY_FEES, []).length, last = lsGet("pc.lastBackup");
    $("#backupInfo").innerHTML = "على هذا الجهاز <b>" + n + "</b> حالة تقاعد و<b>" + nf + "</b> حساب رسوم محفوظ." + (last ? " آخر نسخة احتياطية: " + new Date(last).toLocaleString("ar-SY", { dateStyle: "medium", timeStyle: "short" }) + "." : " لم تُحمَّل أي نسخة احتياطية بعد.");
}
function downloadBackup() {
    const data = { format: BACKUP_FORMAT, version: BACKUP_VERSION, app: "pension-calculator", appVersion: APP_VERSION, exportedAt: new Date().toISOString(), cases: load(KEY_CASES, []), settings: getSettings(), fees: load(KEY_FEES, []), pensionPrint: load(KEY_PPRINT, null), feeSettings: load(KEY_FSET, null) };
    const d = new Date(), stamp = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
    download("نسخة احتياطية - حاسبة المحامي - " + stamp + ".json", JSON.stringify(data, null, 2), "application/json");
    lsSet("pc.lastBackup", d.toISOString()); renderBackupInfo();
    toast("حُمّلت النسخة الاحتياطية (" + data.cases.length + " حالة تقاعد، " + data.fees.length + " حساب رسوم)", "ok");
}
$("#restoreInput").addEventListener("change", function (e) {
    const file = e.target.files[0]; if (!file) return;
    const rd = new FileReader();
    rd.onload = async function () {
        e.target.value = "";
        let data;
        try { data = JSON.parse(rd.result); } catch (err) { toast("الملف ليس نسخة احتياطية صالحة.", "bad"); return; }
        const isObj = function (x) { return !!x && typeof x === "object" && !Array.isArray(x); };
        /* يقبل: نسخة احتياطية كاملة (الإصدار 1)، أو ملف حالة واحدة صُدِّر من الإصدار الأول */
        let incoming = [], settings = null, incomingFees = [], pPrint = null, fSet = null;
        if (isObj(data) && data.format === BACKUP_FORMAT) {
            if (data.version !== undefined && data.version !== BACKUP_VERSION) { toast("إصدار النسخة الاحتياطية (" + esc(String(data.version)) + ") غير مدعوم في هذا الإصدار من البرنامج.", "bad", 7000); return; }
            if (!Array.isArray(data.cases)) { toast("النسخة الاحتياطية تالفة: لا تحتوي قائمة الحالات.", "bad"); return; }
            if (data.fees !== undefined && !Array.isArray(data.fees)) { toast("النسخة الاحتياطية تالفة: قائمة حسابات الرسوم غير صالحة.", "bad"); return; }
            incoming = data.cases; settings = isObj(data.settings) ? data.settings : null; incomingFees = data.fees || [];
            pPrint = isObj(data.pensionPrint) ? data.pensionPrint : null;
            fSet = isObj(data.feeSettings) ? data.feeSettings : null;
        }
        else if (isObj(data) && isObj(data.case) && data.case.type) incoming = [data.case];
        else if (isObj(data) && data.type && data.service) incoming = [data];
        else { toast("الملف ليس نسخة احتياطية صالحة.", "bad"); return; }
        incoming = incoming.filter(function (c) { return isObj(c) && typeof c.type === "string"; });
        incomingFees = incomingFees.filter(function (c) { return isObj(c) && (typeof c.kind === "string" || (Array.isArray(c.kinds) && c.kinds.length)); });

        let useSettings = false, useFeeSet = false;
        if ((settings || pPrint) && await confirmBox("استيراد إعدادات التقاعد؟", "تحتوي النسخة على إعدادات قسم الراتب التقاعدي (جداول القيم وقواعد الحساب والطباعة). هل تريد اعتمادها بدل الحالية؟", "اعتماد إعدادات التقاعد")) useSettings = true;
        if (fSet && await confirmBox("استيراد إعدادات الرسوم؟", "تحتوي النسخة على إعدادات قسم الرسوم (الجداول والطباعة). هل تريد اعتمادها بدل الحالية؟", "اعتماد إعدادات الرسوم")) useFeeSet = true;

        /* الدمج بعد التأكيدات وعلى أحدث ما في المتصفح: بالمعرّف، والأحدث حفظاً يفوز، ولا حذف */
        function merge(current, inc, prefix) {
            const map = new Map(); current.forEach(function (c) { if (c && c.id) map.set(c.id, c); });
            let added = 0, updated = 0, kept = 0;
            inc.forEach(function (c) {
                const item = Object.assign({}, c);
                item.id = item.id || (prefix + Date.now() + Math.random().toString(36).slice(2, 6));
                const old = map.get(item.id);
                if (!old) { map.set(item.id, item); added++; }
                else if ((item.savedAt || "") > (old.savedAt || "")) { map.set(item.id, item); updated++; }
                else kept++;
            });
            const list = Array.from(map.values()).sort(function (a, b) { return (b.savedAt || "") > (a.savedAt || "") ? 1 : -1; });
            return { list: list, added: added, updated: updated, kept: kept };
        }
        const mc = merge(load(KEY_CASES, []), incoming, "c"), mf = merge(load(KEY_FEES, []), incomingFees, "f");

        /* الكتابة كلها أو لا شيء: نسخة مؤقتة من القيم السابقة تُعاد إذا فشلت أي كتابة */
        const writes = [[KEY_CASES, mc.list], [KEY_FEES, mf.list]];
        if (useSettings && settings) writes.push([KEY_SET, settings]);
        if (useSettings && pPrint) writes.push([KEY_PPRINT, pPrint]);
        if (useFeeSet) writes.push([KEY_FSET, fSet]);
        const before = writes.map(function (w) { return [w[0], lsGet(w[0])]; });
        const ok = writes.every(function (w) { return store(w[0], w[1]); });
        if (!ok) {
            before.forEach(function (b) { lsSet(b[0], b[1]); });
            toast("تعذر حفظ النسخة في هذا المتصفح (قد تكون مساحة التخزين ممتلئة). لم يتغير شيء.", "bad", 8000);
            return;
        }
        renderBackupInfo();
        if (current === "cases") renderCases();
        if (window.FeesUI) window.FeesUI.onPage(current);
        toast("اكتمل الاستيراد: أُضيفت " + mc.added + "، حُدّثت " + mc.updated + "، بقيت " + mc.kept + " كما هي (الأحدث محفوظ)." +
            (incomingFees.length ? " حسابات الرسوم: أُضيف " + mf.added + " وحُدّث " + mf.updated + "." : ""), "ok", 6000);
    };
    rd.readAsText(file);
});

/* =========================================================
   التشغيل
   ========================================================= */
$("#loginForm").addEventListener("submit", function (e) {
    e.preventDefault();
    if (login($("#loginUser").value, $("#loginPass").value)) { $("#loginPass").value = ""; enterApp(); }
    else $("#loginError").textContent = "اسم المستخدم أو كلمة المرور غير صحيحة.";
});
document.addEventListener("DOMContentLoaded", function init() {
    const draft = load(KEY_DRAFT, null);
    fill(draft && draft.type ? draft : { type: "ordinary", includeAid: true, untilMonth: thisMonth() });
    me = findSessionUser();
    if (me) enterApp(); else showLogin();
});
