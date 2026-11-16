# حاسبة الراتب التقاعدي — Pension Calculator

Arabic (RTL) single-page web app that computes lawyers' pensions (ordinary / health / heirs) and retirement/death aid per the pension-fund circulars and Law 30/2010, and produces a detailed printable report for the lawyer's file. Plain HTML/CSS/JS, no build step. Same owner and conventions as Sarrafa (https://github.com/Hussein199800/Sarrafa) and Work_1.

## ⚠️ Never lose the user's data
- localStorage keys are fixed since v1: `pc.cases.v1` (saved cases), `pc.settings.v1`, `pc.draft.v1`; plus `pc.users.v1`, `pc_session`, `pc_theme`, `pc.lastBackup`. Never rename or clear them.
- Backup import is additive (adds/updates by id, newer `savedAt` wins, never deletes). Backup format: `format: "pension-calculator-backup"`, `version: 1`; import also accepts the v1 single-case export `{case: …}`.

## Files
- `index.html` — login, top bar, pages (`[data-page]`: calc, report, cases, more, settings, backup), bottom tab bar.
- `css/style.css` — design system «الجواهر» copied from Sarrafa (tokens at top, light + dark) + a section for the calculator.
- `js/calc.js` — pure calculation engine (works in Node). `js/report.js` — report HTML + its CSS. `js/app.js` — UI, session, saving, backup.
- `tests/calc.test.js` — every numeric example from the circulars.

## Design (user decision: same as Sarrafa)
- IBM Plex Sans Arabic, Tabler icons, emerald actions / royal plum structure / wine danger / gold totals, `[data-theme]` light/dark.
- Sticky top bar + bottom tabs (الحاسبة، التقرير، الحالات، المزيد). Settings, backup, account live in «المزيد» (gradient user card + `.lcard` list).
- Messages via `toast()` / `confirmBox()` / `modal()` — never `alert()` / `confirm()`.
- Telegram backup upload and Firebase sync/Google sign-in are **UI only, disabled ("قريباً")** until the user decides to implement them.

## Conventions
- The user writes in Arabic; answer in Arabic. Ask with the clickable question bar, recommended option first.
- Develop on the session branch; the user merges.
- Verify: `node --check js/app.js && node tests/calc.test.js`.
