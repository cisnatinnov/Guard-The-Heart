# Fight the Dragon

An offline-first team challenge tracker built with React, TypeScript, Vite,
Sequelize and sql.js. Game data stays in the browser. Admin and public displays
synchronize within the same browser profile and origin.

## Getting started

Use Node.js 20.19+ or 22.12+ and npm.

```sh
npm install
npm run dev
```

Open `/admin` to manage the event and `/` for Main Presentation. Production
hosting must serve `index.html` for application routes.

## Personal portfolio

Open `/portfolio` for Cendikia Hairy's personal portfolio, featuring Fight the
Dragon. It includes a project gallery, architecture and design case study,
event flow, technology stack, and LinkedIn contact. This route opens independently
of the event database and does not register as a synchronized public display.
The admin footer links to it. Light/dark appearance is shared with the event UI.

Portfolio content lives in `src/views/PortfolioView.tsx`, with styles in
`src/styles/portfolio.css`. Update the name, introduction, and LinkedIn URLs there
to personalize the page. The project screenshots use isolated default demo data.
To refresh them, start the local Vite server, then run
`node scripts/generate-portfolio-previews.mjs` (or pass another local origin).

The **Download portfolio** button saves a three-page PDF with the project case
study and screenshots. The deliverable is `output/pdf/Cendikia-Hairy-Portfolio.pdf`;
the app serves an identical copy from `public/portfolio/`. Regenerate both with
`python scripts/generate-portfolio-pdf.py` (requires ReportLab). The production
service worker caches the PDF for offline downloading after the first install.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local development server |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm test` | Rules and database regressions |
| `npx playwright install chromium` | Browser installation for tests and icon generation |
| `npm run test:e2e -- --workers=2` | Fresh production build and full browser regression suite |
| `npm run build` | Type-check and build the PWA into `dist/` |
| `npm run preview` | Serve the production build |
| `npm run icons` | Derive install icons from the current logo using local Chromium |

## Theme and characters

The interface follows the cast's navy and cobalt armor, silver plates, violet
cloth and cyan crystals, with restrained gold trim. Shared appearance tokens
control navigation, forms, tables, challenge panels, and the portfolio in dark
navy or light silver. The saved appearance takes precedence over the operating
system theme and synchronizes across tabs. Tactical Phase and Card Reveal use
native themed frames and live headings. Focus outlines are visible, disabled
controls remain recognizable, and team identity colors remain independent of
the theme, with dark labels on their pastel team backgrounds.

`src/styles/feature-theme.css` applies the shared surface rules to admin and public
features. Tactical Phase and Card Reveal render explicit Fight the Dragon headers
and do not load legacy tactical slide images. Development disables service workers
and retires workers left over from earlier previews without clearing event data;
production retains the offline-first PWA.

The cast is **Dragon Warden**, **Storm Ranger** and **Spark**, a small cobalt
dragon. The opponent **Gilgamesh** now has silver/navy armor, cyan crystal horns
and violet wings. Current character PNGs are in `public/characters/`; identities
are defined in `src/data/characters.ts`. Gilgamesh appears in the header,
presentation introduction, attack scene and attack-board header. Jaw of Risk
uses a new silver/navy Gilgamesh jaw illustration, a matching closed-jaw bite frame (`public/ui/jaw-of-risk/gilgamesh-bite.png`), CSS snap animation and the existing fourteen-tooth hit geometry.

The logo is `public/fight-the-dragon-logo.png`. Character images were created
with the built-in image-generation tool; exact prompts are in
[public/characters/prompts.json](./public/characters/prompts.json).

Opening a challenge automatically includes every active team (up to the existing
five-team scoreboard limit). No team checklist or Start button is needed. Click a
team name in Turn Order to choose the answering team. Matching Cards and Jaw of
Risk select an answer when the host clicks its option; scoring happens only after
**Grade this question**. Their synchronized 15-second
turn reminders never close answers or change scores. A correct Matching Cards
answer unlocks picture matching for +5 per pair after the preview. A correct Jaw
answer awards +10 before the host chooses an eligible opponent; an incorrect
answer assigns the answering team to the teeth. A bite deducts 5, ends that tooth
turn immediately, and deactivates the bitten team. OUT means inactive across the event.
Reactivate a team in Teams (with GP above zero) to make it eligible again;
saved bite history does not keep a reactivated team OUT.

Each challenge offers a question picker with a maximum of 10 questions (the first
10 are selected by default). The host can choose 1–10 questions from the bank.
Image Decode runs keep the selected question IDs in shared run state, while the
other Q&A screens synchronize the selection and question position with the public
screen. Submit a typed answer or selected option for automatic grading; manual
Right/Wrong buttons and solo play are removed. Each workbook question scores once
per answering team. Turn Order controls appear inside each challenge and the
standalone Turn Order page remains available. Main Presentation is accessible by
its route but is no longer listed in the admin menu.

Main Presentation consists of six native scenes and a seventh live scoreboard.
The opening, goals, GP rules, Gilgamesh introduction, Image Decode introduction
and How to Play scenes use HTML, CSS and current character cutouts. They no
longer fetch hidden source slide images. Previous/Next, selector, thumbnails,
arrow/Page Up/Page Down/Home/End keys and fullscreen preview are available.
Selection synchronizes to the shared public display and survives reload.

## Running an event

1. Review **Teams**. Merah, Hijau, Biru, Kuning and Pink are active by default,
   start with 5 GP and keep their permanent colors after renaming. Default teams
   cannot be deleted; teams can be deactivated and reactivated manually.
2. Open **Turn Order**. **Shuffle Order** changes the order; **Reset order** restores
   Kuning, Merah, Biru, Pink, Hijau. Both choose the first team. Clicking a team
   changes **Your Turn** without reshuffling. All challenges follow this active team. Image Decode starts in the saved order.
3. Open **Challenges** and choose **Play**. Record host verdicts or enter/correct
   raw scores on **Scoreboard**. Each challenge has at most five team entries.
4. **Claim Rewards** opens the reward board and draws cards once after all five
   entries exist. Revisiting or reloading does not draw again. Rank 5 receives
   three distinct random unowned designs of any rarity; admin chooses one.
   Public cards remain closed until selection and mirror the admin hover pointer.
5. In **Tactical Phase**, select up to two available cards per team or choose
   **Skip**. Assign Protect/Thief targets. Used cards are hidden from available
   inventory but retained in that challenge's played-card history.
6. **Card Reveal** applies Heal, Thief, Reverse and Gardian Unity once. Selection,
   retargeting and hovering do not change GP. Choose any Fortune Draw reward.
7. **Attack all teams −2 GP** resolves damage once and opens the Gilgamesh screen.
   A 6.5-second dragon lunge/flame scene precedes the saved results board.
   **Show attack results** skips the scene without applying damage again.
8. Show **Heart of Awareness**, **Leaderboard** or **Podium**. Podium ranks active
   teams by GP, then CP, and supports three saved prize amounts. Equal GP/CP
   values share a rank and matching medal. Its arena, native plinths and new cast
   contain no fixed team names, GP or prizes.
9. Review **GP Transactions** for before/change/after balances, including opening
   GP, challenge rewards, attacks and cards. Filter by team; the latest 500
   matching records use Asia/Jakarta timestamps.

## Challenges and scoring

| Challenge | Controls and timing |
| --- | --- |
| Image Decode | 69 workbook emoji clues. The 15-second timer is a reminder; answers stay open and expiry never changes scores. Correct +10, wrong -10. |
| Matching Cards | 71 workbook quiz questions. Right Answer +10 unlocks a board with a 5-second preview and no response deadline. Each distinct matched pair earns +5. Wrong Answer -10 grants no matching attempt. Changing teams ends the current bonus attempt. |
| Jaw of Risk | Right Answer +10 assigns a selected active opponent; Wrong Answer −10 assigns the answering team. The assigned team must press two teeth. Each bite deducts 5 more raw score; safe presses add no penalty. |

Scores range from −999 to 999. Host verdicts, matched pairs and tooth presses
persist with duplicate-submission protection. Pending tooth assignments survive
reload. A bite ends the tooth turn immediately and eliminates the bitten team
by deactivating it. Safe turns require two presses.
The host records verdicts and configures biting teeth. Both host and public screens can press teeth after a verdict unlocks them; shared locks and persisted press counts prevent duplicate penalties.

Raw-score changes rerank every team in the challenge and adjust CP/GP rewards
without replaying combat. The scoreboard lists all teams alphabetically until
all five have recorded scores, including zero; it then shows dense ranks and
badges. Removing a score restores alphabetical display.

| Rank | CP | GP | Card reward |
| --- | --- | --- | --- |
| 1 | 3 | 3 | 3 cards |
| 2 | 2 | 2 | 2 cards |
| 3 | 1 | 1 | 2 cards |
| 4 | 1 | 1 | 1 Normal |
| 5 | 1 | 1 | Choose 1 of 3 random unowned designs |

The finite deck has 60 cards: 33 Normal, 16 Rare, 8 Epic and 3 Legendary.
Ranked rarity rolls use each challenge's saved rules; shortage rolls back the
draw instead of silently changing rarity. Teams hold at most eight available
cards and cannot receive duplicate available designs.

Fortune Draw offers two Normal and one Rare in Challenges 1–2, plus one Epic
for eligible rank-one teams in Challenge 3. Rank restrictions apply; ranks 4–5
receive eligible Normal options. Admin sees faces and can choose whether public
options are closed. The selected reward persists and becomes available next
challenge. Rank-five earned rewards are usable in the current challenge.

## Gilgamesh Attack and card effects

The attack board shows five aligned tracks: team, **Before GP**, **After GP**,
attack outcome and saved card activity. Before GP uses the reveal-time
`assignmentGP`, falling back to `initialGP` for older archives. After GP is the
saved final value. Shield, Protect and Swallow outcomes have blue backgrounds;
ordinary damage remains red. Reloading and skipping the scene never change GP.
Reduced-motion preferences disable the lunge, flame and card movement.

Shield reduces damage, Protect covers owner and target, Swallow prevents damage
and grants +4 GP, and passive Second Chance revives once after damage at zero.
Fortune awards a card rather than GP. Heal/Thief/Reverse/Unity reveal effects are
not repeated by the attack. Completed choices and effects remain historical.
**Show Card Reveal** returns to played-card history after the attack.

## Admin workspace

The admin uses a compact character header, grouped sidebar navigation and a background that follows the saved light/dark theme. On phones, navigation becomes a horizontally scrollable row. The Teams page shows total/active/inactive counts, keeps GP rules in expandable help, and separates adding a team from filtering the list. Team colours and gameplay controls keep their existing meaning. Admin styling is isolated in `src/styles/admin.css`.

## Routes and public displays

`:challengeId?` is optional. Old `/gigarisk` URLs and `guard-the-heart` storage
keys remain compatible; visible names use Fight the Dragon and Gilgamesh.

| Feature | Admin | Public |
| --- | --- | --- |
| Teams | `/admin` | — |
| Challenges | `/admin/challenges` | — |
| Main Presentation | `/admin/presentation` | `/` (`/presentation` redirects) |
| Turn Order | `/admin/turn-order` | `/turn-order` |
| Scoreboard | `/admin/scoreboard/:challengeId?` | `/scoreboard/:challengeId?` |
| Rewards | `/admin/rewards/:challengeId?` | `/rewards/:challengeId?` |
| Tactical Phase | `/admin/tactical/:challengeId?` | `/tactical/:challengeId?` |
| Card Reveal | Controlled from Tactical Phase | `/card-reveal/:challengeId?` |
| Gilgamesh Attack | `/admin/gigarisk/:challengeId?` | `/gigarisk/:challengeId?` |
| Heart of Awareness | `/admin/heart-of-awareness` | `/heart-of-awareness` |
| Leaderboard | `/admin/leaderboard` | `/leaderboard` |
| Podium | `/admin/podium` | `/podium` |
| GP Transactions | `/admin/gp-transactions` | — |
| Game | `/admin/play/:gameId/:challengeId?` | `/play/:gameId/:challengeId?` |

Turn Order uses its own named window. Other features reuse one
projector window. Navigation, team turns and saved results synchronize in the
same browser profile/origin; they do not sync between devices. Popup blocking
produces an error while keeping the admin controls available.

## Assets, offline use and maintenance

The cleanup removed 64 unused assets (about 271 MiB), obsolete solo matching UI,
and retired reference-generation scripts. It also removed 332 obsolete CSS
rules and 101 superseded declarations. Source decks, old characters, video,
unused card-face variants, fonts, duplicate screenshots and covered slide images
are no longer shipped merely as references.

Branded cards use foil borders, dragon-scale textures, rarity gems, and distinct
light/dark palettes. Superseded PNG card faces, matching reference crops, and the
covered matching slide are removed from the public bundle.

Retained artwork is used by active scoreboards, rewards, matching cards,
question clues, rank/GP icons or the Jaw of Risk toy. Dynamic card-face, tooth and
hand paths are retained. Saved rank-five False Hope offers use the branded artwork. The legacy Image Decode PPTX is excluded from offline precaching. Application art, sounds
and the current Gilgamesh jaw artwork are precached. The app must be opened online once
before offline use. Question content lives in `src/data/reference-question-bank.json`
from the three current sheets in `Bank Soal Game 5.xlsx`. Import updates with `scripts/import-question-bank.py <workbook-path>` using Python with openpyxl. The importer preserves source rows, clues, answer keys, and educational explanations.

The header theme switch saves a light/dark preference across reloads and windows.
Dark is the default. Grouped navigation wraps on narrow screens without clipping.

SQLite bytes live in IndexedDB (`guard-the-heart` / `sqlite` / `database`).
localStorage holds tactical archives, runs, turns, timers, presentation state,
prizes and public-window commands. Keep both stores when preserving an event.
Clearing one cannot reconstruct the other. Startup migrations preserve valid
scores, cards, GP and historical attacks, including missing archived team IDs.

For implementation details, see [blueprint.md](./blueprint.md).

Public Matching Cards cards are clickable during the unlocked matching window. Host and public moves share a lock and read the latest saved board before scoring; mismatches also close when only the public screen remains open. Team selection, verdicts and run controls remain host-only.

## Verification

Historical baseline verified on **2026-10-27 (WIB)** (before the latest challenge UI changes):

| Check | Result |
| --- | --- |
| Unit/database suite | 285 passed across 26 files |
| Browser regression coverage | All 77 scenarios verified: 76 passed in the full run; after correcting a new test assertion, all 20 focused checks passed on the final build |
| TypeScript and production/PWA build | Passed through the fresh browser build-and-preview workflow |
| ESLint | Passed |
| Admin UI refresh | 11 focused browser checks passed; final viewport sweep passed at 1366, 1280, 768 and 390 px |
| Static asset references | 29 literal runtime paths checked; no missing assets; both Gilgamesh jaw frames confirmed in the offline precache |
| Markdown | Both tracked files checked for local links, anchors and balanced fences |
| Visual review | New Gilgamesh open/closed jaw frames, tooth alignment and public status/score spacing reviewed |


Checks cover asset loading, readable contrast,
responsive routes, all game flows, card effects, persistence, synchronization
and offline reload. A passing suite covers these scenarios, not every possible
device or simultaneous edit sequence.

### Branded cards and public choices

Public Matching Cards and Jaw of Risk show A–D option cards without turn timers.
The admin's selected option is shared with the public view and survives reload;
advancing the question clears the selection. Reminder timers stay on the admin.
Reward cards, closed backs, and matching pairs use native Fight the Dragon SVG
artwork in both themes. Regenerate the assets with
`python scripts/generate-branded-cards.py`. Changing the application theme updates
card artwork on the host and public display without changing card identities,
rarities, scores, or matching-pair assignments.

### Host controls

The standalone Timer feature is removed; old timer URLs redirect to Challenges
(admin) or Scoreboard (public). Challenge reminders stay at 15 seconds until the
admin clicks **Timer**. They do not automatically start on a new team or question,
and the Image Decode Timer button preserves the current question and scores.
Jaw of Risk keeps the public dragon hidden until **Show dragon**. Matching Cards
(formerly Flipping Connect) keeps its public board hidden until **Show cards**;
the full five-second memory preview starts with that click after a correct answer.
Each challenge has **Show public question**, including Challenge 1 (Image Decode),
with live question, team, and answer synchronization. The normal public challenge
route shows Q&A. **Show cards** opens `/play/word-assembly/:challengeId/cards`;
**Show dragon** opens `/play/jaws-of-risk/:challengeId/dragon`. These separate
board views retain live scores and omit Q&A. Reveal controls open or reuse the
public display; Hide returns it to the public question. Returning to Q&A does
not reset the board, matching preview, or scores.

### Current answer workflow (2026-10-30)

Image Decode mirrors the current answering team's typed text to the public Answer
panel after a 300 ms pause in typing. Clearing the input clears that public text.
Drafts are scoped to the run, question and originating turn so another question
or team never inherits an old answer. A passed question displays the chosen
opponent's input. Draft synchronization does not submit an answer or change scores.
Public reloads restore the latest saved draft in the same browser profile/origin.

For Matching Cards and Jaw of Risk, click an option to select it, then click
**Grade this question** to score it. Option hover/focus and selection mirror to
public Q&A. Both screens arrange A/B on the left and C/D on the right. Grading
shows a five-second result overlay with a check or cross and the correct answer.
The separate cards/dragon screens omit Q&A. Choosing a Jaw opponent also updates
the active team. Image Decode still grades and advances through its typed-answer
workflow; it does not yet have the workbook result overlay.

Latest targeted validation: production build, TypeScript, and two Image Decode
browser regressions passed on 2026-10-30 (WIB). Both Markdown files passed local-link
and code-fence checks. The full browser suite was not rerun. See
[blueprint.md](./blueprint.md) for the validation scope.

### OUT and reactivation

Challenges 1 and 2 never label a team OUT. Their Turn Order lists active teams;
a used Image Decode attempt is labeled Attempt used. Only Challenge 3 displays
OUT, and it follows `Team.status = inactive`, not historical Jaw bite records. A future
Jaw bite deactivates its pressing team transactionally with the penalty. Active
teams with old bites remain eligible; Teams activation restores eligibility
without deleting score or bite history. Zero-GP teams still require GP above zero
before activation. An unsuccessful Image Decode attempt is labeled Attempt used,
not OUT.

### Image Decode answer entry

Type directly into the ANSWER area on the admin Image Decode screen. The
per-team answer table is removed for this challenge. Turn Order and passing
choose whose answer is entered; Grade this question (or Enter) submits it.
The public ANSWER area remains read-only and mirrors the current typed text.
