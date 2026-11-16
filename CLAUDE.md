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

## Design — «الزيتون والعاج» (user decision 2026-11-17)
- The user asked for an identity distinct from Sarrafa («الجواهر») and Work_1 («التيتانيوم والنحاس»), "as if another programmer made it", **CSS only** (HTML/JS untouched). Colors were left to Claude.
- Palette: ivory paper background with faint ledger lines on login, ONE olive accent for actions (`--accent` #5a6a1e, `--grad-primary`), dark ink-olive structure (`--panel`, page icons, report headings), saffron highlights and totals, brick for danger. No blue. Light + dark (`[data-theme]`).
- Primitive names kept to avoid breakage: `--emerald-*` = olive, `--plum-*` = ink, `--gold-*` = saffron, `--wine-*` = brick. Use semantic tokens in new CSS.
- Font Readex Pro (via `@import` in `style.css`), Tabler icons. Tighter radii (6/9/12/16), flat cards with a saffron title mark, linear indicator on the active bottom tab.
- «الطبقة الثانية» at the end of `style.css` remaps the old hard-coded «الجواهر» colors and restyles the on-screen/printed report (`.rpt`) with `!important`. The downloaded standalone report HTML still uses the embedded CSS in `report.js`.
- Layout unchanged: sticky top bar + bottom tabs (الحاسبة، التقرير، الحالات، المزيد); settings, backup, account in «المزيد».
- Messages via `toast()` / `confirmBox()` / `modal()` — never `alert()` / `confirm()`.
- Telegram backup upload and Firebase sync/Google sign-in are **UI only, disabled ("قريباً")** until the user decides to implement them.

## Conventions
- The user writes in Arabic; answer in Arabic. Ask with the clickable question bar, recommended option first.
- Develop on the session branch; the user merges.
- Verify: `node --check js/app.js && node tests/calc.test.js`.
