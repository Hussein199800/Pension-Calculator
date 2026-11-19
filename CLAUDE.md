# حاسبة الراتب التقاعدي — Pension Calculator

Arabic (RTL) single-page web app that computes lawyers' pensions (ordinary / health / heirs) and retirement/death aid per the pension-fund circulars and Law 30/2010, and produces a detailed printable report for the lawyer's file. Plain HTML/CSS/JS, no build step. Same owner and conventions as Sarrafa (https://github.com/Hussein199800/Sarrafa) and Work_1.

## ⚠️ Never lose the user's data
- localStorage keys are fixed since v1: `pc.cases.v1` (saved cases), `pc.settings.v1`, `pc.draft.v1`; plus `pc.users.v1`, `pc_session`, `pc_theme`, `pc.lastBackup`. Never rename or clear them.
- Backup import is additive (adds/updates by id, newer `savedAt` wins, never deletes). Backup format: `format: "pension-calculator-backup"`, `version: 1`; import also accepts the v1 single-case export `{case: …}`.

## Files
- `index.html` — login, top bar, pages (`[data-page]`: calc, report, cases, more, settings, backup), bottom tab bar.
- `css/style.css` — «الزيتون والعاج» identity (tokens at top, light + dark), calculator section, and «الطبقة الثانية» at the end.
- `js/calc.js` — pure calculation engine (works in Node). `js/report.js` — report HTML + its CSS. `js/app.js` — UI, session, saving, backup.
- `tests/calc.test.js` — every numeric example from the circulars.

## Design — «الزيتون والعاج» (user decision 2026-11-17)
- The user asked for an identity distinct from Sarrafa («الجواهر») and Work_1 («التيتانيوم والنحاس»), "as if another programmer made it", **CSS only** (HTML/JS untouched). Colors were left to Claude.
- Palette: ivory paper background with faint ledger lines on login, ONE olive accent for actions (`--accent` #5a6a1e, `--grad-primary`), dark ink-olive structure (`--panel`, page icons, report headings), saffron highlights and totals, brick for danger. No blue. Light + dark (`[data-theme]`).
- Primitive names kept to avoid breakage: `--emerald-*` = olive, `--plum-*` = ink, `--gold-*` = saffron, `--wine-*` = brick. Use semantic tokens in new CSS.
- Font Readex Pro (via `@import` in `style.css`), Tabler icons. Tighter radii (6/9/12/16), flat cards with a saffron title mark, linear indicator on the active bottom tab.
- «الطبقة الثانية» at the end of `style.css` remaps the old hard-coded «الجواهر» colors and restyles the on-screen/printed report (`.rpt`) with `!important`. The downloaded standalone report HTML uses the embedded CSS in `report.js` (same olive/ink/saffron colors).
- Layout unchanged: sticky top bar + bottom tabs (الحاسبة، التقرير، الحالات، المزيد); settings, backup, account in «المزيد».
- Messages via `toast()` / `confirmBox()` / `modal()` — never `alert()` / `confirm()`.
- Telegram backup upload and Firebase sync/Google sign-in are **UI only, disabled ("قريباً")** until the user decides to implement them.

## Domain decisions — union specialist's written answers (2026-11-19)
Override the circulars' examples where they differ; all are covered by `tests/calc.test.js`.
1. Aid 200,000 from 2026-07-01. In aid, part of a year = a full year (9y1m → 10).
2. First partial month: days from the day after death (or start date) to the end of the month, ÷ 30 (death 4/7 → 27 days). The circular's heirs example "25 days" is a typo.
3. Ordinary pension: year fraction ignored (complete years only).
5. Health and heirs (in-service, or retired-health) brackets: the boundary belongs to the LOWER bracket and fractions count only at the boundaries: ≤5y = ¼, >5–10 = ½, >10–15 = ¾, >15 (even by one day) = full. So exactly 15 = ¾ (the circular's "15 → full" example is overridden; setting `bracketBoundary: 'upper'` restores it).
4. Joined after 2014-02-04: at retirement the lawyer is paid HALF of the proportional aid (`retirementAid.full` / `.amount`); the heirs get the second half at death (`receivedHalfRetirementAid`), on the same basis (health retirees: at least 5 parts), at the aid value of the death year. The older flag `receivedRetirementAid` keeps its v1 meaning "received the FULL aid" → no death aid; the two flags are mutually exclusive in the form (if both are set, the explicit half wins).
6. Practice starts at the oath date (`service.start`); training (oath → enrolment as أستاذ, `service.masterDate`, or to the end of practice when `service.stillTrainee`) counts 3 years at most (`trainingMaxYears`, whole years ≥ 0) — the excess is an automatic exclusion. Exclusions are merged (union) so overlapping periods are deducted once. Durations are counted on the real calendar (`diffYMD`: whole months added to the start, remaining days counted; no 30-day normalization), so 31/1/2011–31/1/2026 inclusive = 15 years and 1 day. Net service: an exclusion touching the start or the end of practice is cut at its own date; every other (merged) exclusion is measured in the oath date's own anniversary frame (offset of its start and of its end from the oath date; the difference is its length) and subtracted from the gross duration, borrowing a month at its real length at that anniversary when days go negative. This keeps the oath date's anniversaries (including an oath on 29/2), so excluding a whole year removes exactly one year and the training cap never adds or loses a day. `diffYMD` only steps a month back when the month-added date passes the end (29/2/2020 + 60 months = 28/2/2025). Brackets compare (years, months, days) directly.
7. One treasury share always (heirs' shares + 1); `settingsWith` forces `treasuryShare: true` and the setting is not offered.
8. Heir eligibility is checked at the start of payment and then yearly (annual documents): eligibility for year Y is judged on 31 December of Y−1, so whoever loses it at any date in a year (even 1 January) stops from 1 January of the next year; the share goes to the treasury (no redistribution). Optional per-heir `stopDate` + `stopReason` (`married` / `hasIncome` / `remarried` / `other`): before that date only the flag named by the reason is ignored; other disqualifying flags still apply.
- Join date = registration date (the separate "registration decision date" field was removed; `registrationDecisionDate` = `joinDate`, except that a different value saved by v1 is kept, shown as an editable/clearable field on those cases only, and used for the age-45 aid rule).
- Ordinary pension starts when the retirement decision becomes final: the treasury controller's review date (`reviewDate`) if the appeal right was waived (`appealWaived`), otherwise one month later. A review date before the retirement decision is rejected. Without `reviewDate`, the retirement date (or a legacy `paymentStartDate`, shown as an editable field only on cases that carry it) is used. Health stays from the medical-board date; heirs from the day after death.

## Conventions
- The user writes in Arabic; answer in Arabic. Ask with the clickable question bar, recommended option first.
- Develop on the session branch; the user merges.
- Verify: `node --check js/app.js && node tests/calc.test.js`.
