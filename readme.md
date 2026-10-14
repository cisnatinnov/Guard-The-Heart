# Guard The Heart

An offline-first team challenge tracker built with React, TypeScript, Vite,
Sequelize and sql.js. Scores, rewards, cards and GP transactions stay in the
browser. Admin controls and public projector pages synchronize within the same
browser profile and origin.

## Getting started

Use Node.js 20.19+ or 22.12+ and npm.

```sh
npm install
npm run dev
```

Open Vite's local URL. Open `/admin` to manage the game; `/` opens the public
presentation. Production hosting must serve `index.html` for application routes.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm test` | Vitest rules and database regression tests |
| `npx playwright install chromium` | Install the browser used by end-to-end tests |
| `npm run test:e2e -- --workers=2` | Production build and browser regression tests |
| `npm run build` | Type-check and build the PWA into `dist/` |
| `npm run preview` | Serve the production build |
| `npm run decks` | Regenerate bundled challenge decks |
| `npm run icons` | Regenerate PWA icons |

## Running an event

1. Review teams in **Team**. Merah, Hijau, Biru, Kuning and Pink are seeded,
   active and protected from editing/deletion. Additional teams can be created,
   renamed, activated/deactivated and deleted. Each team starts with 5 GP.
2. Use **Urutan Main** to click team names in the desired order or use **Acak
   Giliran**. The public order page also supports these controls. This order is
   independent of the games' team selection.
3. Choose **Play** on **Challenge**, then start a team run or play solo. The
   current challenge list exposes Flipping Card, a matching-only activity.
   Image Decode and Jaw of Risk remain available through direct game routes
   and retain team scoring.
4. Review or enter CP on **Scoreboard**. **Edit CP** corrects an existing score
   and recalculates ranks and GP rewards. Each challenge supports at most five
   team entries, with one entry per team.
5. **Claim Rewards** opens the reward board on admin and existing public pages.
   With five entries, it draws and randomly assigns bonus cards once. Revisiting
   the page does not draw again. **Draw Bonus Cards** offers the same draw from
   the scoreboard.
6. From **Rewards**, open **Tactical Phase**. Select up to two cards earned by
   each team in that challenge, by clicking or dragging, or choose **Skip**.
   **Card Reveal** displays those selections without applying an attack.
7. In **Serangan GigaRisk**, select the challenge, choose an opponent for each
   Thief card, then click **Serang semua tim −2 GP**. The attack and selected
   effects apply once. An empty tactical phase blocks the attack with a message;
   explicit SKIP is a valid decision. Used cards leave available inventory.
8. Show the **Leaderboard** or **Podium** to display standings based on current
   GP. Configure the three podium prizes in the admin podium page.
9. Review **Transaksi GP** for opening balances, challenge rewards, GigaRisk and
   card effects, including before/change/after balances. Filter by team; the
   page shows the latest 500 matching transactions with WIB timestamps.

## Routes and public displays

`:challengeId?` is optional; choose a challenge on admin pages when omitted.
Public screens follow host transitions in other tabs of the same browser.
Display buttons open a new tab and publish the chosen public screen.

| Feature | Admin | Public |
| --- | --- | --- |
| Teams | `/admin` | — |
| Challenge list | `/admin/challenges` | — |
| Game | `/admin/play/:gameId/:challengeId?` | `/play/:gameId/:challengeId?` |
| Challenge scoreboard | `/admin/scoreboard/:challengeId?` | `/scoreboard/:challengeId?` |
| Leaderboard | `/admin/leaderboard` | `/leaderboard` |
| Podium | `/admin/podium` | `/podium` |
| GP transactions | `/admin/gp-transactions` | — |
| Urutan Main | `/admin/turn-order` | `/turn-order` |
| Reward Claim | `/admin/rewards/:challengeId?` | `/rewards/:challengeId?` |
| Tactical Phase | `/admin/tactical/:challengeId?` | `/tactical/:challengeId?` |
| Card Reveal | Controlled from Tactical Phase/GigaRisk | `/card-reveal/:challengeId?` |
| Serangan GigaRisk | `/admin/gigarisk/:challengeId?` | `/gigarisk/:challengeId?` |
| Presentation | `/admin/presentation` | `/` |

The scoreboard and leaderboard each have a **Show … (Public)** button. Public
game, reward, tactical, reveal and ranking pages display live state. Urutan Main
is interactive on its public page. The retired `/cards` and `/admin/cards`
routes are not current features; unknown routes redirect to `/scoreboard`.

## Challenges

The three seeded challenges cannot be added, renamed or deleted through the UI
or controller. Older titles migrate to current names. Internal game ids remain
stable for saved-data compatibility.

The challenge list currently hides Image Decode and Jaw of Risk; their data,
scoreboard choices, direct game routes and reference content remain present.

| Challenge | Game id | Current play |
| --- | --- | --- |
| Image Decode | `emoji-decode` | 11 banking clues, 15-second solo/team question timers |
| Flipping Card | `word-assembly` | 20 picture cards, 10 pairs, matching only, no questions or CP |
| Jaw of Risk | `jaws-of-risk` | 20 multiple-choice questions, 15-second solo/team question timers |

### Question games

Choose up to five teams. The start roulette randomizes question-game order.
Self answers score +10 correct or −10 wrong/timed out. Passing gives the
recipient +5 and the giver −10 when correct; an incorrect passed answer gives
both teams −5. Correct answers advance; unsuccessful attempts move the same
question to the next eligible team. When every team has tried, the next question
opens. Deadlines synchronize with the projector and survive its reload.

Team runs save scores and open the scoreboard when completed. **End run**
cancels early. Solo scores require manual entry because no team is selected.

### Flipping Card

Select participating teams and start the run. Click a team name above the board
to choose the active team manually. Matching has a 20-second turn timer, closes
mismatches, and preserves the manual team selection after a match or timeout.
Matched pairs retain their team's identity. Completing ten pairs ends matching
on both displays; it does not create scores or automatically open rewards.
Solo mode supports matching and restart. Urutan Main does not change this run.

The 21 reference Flipping Card questions remain seeded for compatibility and
reference decks; the current routed screen uses matching-only play.

## Ranking, GP and cards

Challenge rankings use CP descending. Ties use dense ranks: `1, 2, 2, 3, 4`.
Leaderboard and podium use current `Team.total_gp` descending; equal GP uses the
same dense rank, with team name ordering for display. The podium contains the
first three sorted teams and labels ties.

| Challenge rank | GP reward | Card reward |
| --- | --- | --- |
| 1 | +3 | 3 |
| 2 | +2 | 2 |
| 3 | +2 | 2 |
| 4 | +1 | 1 |
| 5 | +1 | 0 |

Current GP includes the initial 5, challenge rewards, and recorded combat
changes. Score correction adjusts reward GP while preserving recorded attacks
and card effects. GP cannot become negative. The GP ledger persists attack
results so reload or leaderboard recalculation does not undo them.

The inventory contains 80 physical copies of 11 designs: 48 Normal, 24 Rare,
6 Epic and 2 Legendary. A team can hold eight available cards. Assignment
prevents duplicate design-and-rarity cards in its available collection. At
capacity, rewards may remain unassigned; service operations support assignment
and replacement. There is no separate collection-management route.

Selected cards are consumed only when GigaRisk completes, not when previewed.
Used TeamCard records remain in the reveal archive but are excluded from earned
card counts, availability and capacity calculations. Each challenge can draw
cards once and receive one attack; later score edits do not reset these limits.

| Card | Effect during GigaRisk |
| --- | --- |
| Normal Heal | Add 2 GP |
| Normal Shield | Block 1 GP of the strike |
| Normal Thief | Take up to 1 GP from a selected opponent |
| Rare Heal | Add 3 GP |
| Rare Protect | Block the strike for its owner |
| Rare Reverse | Take up to 1 GP from each opponent |
| Rare Thief | Take up to 2 GP from a selected opponent |
| Epic Reflect | Convert the strike into +2 GP |
| Epic Reverse | Take up to 2 GP from each opponent |
| Legendary Gardian Unity | Protect all teams and add 1 GP to each |
| Legendary Second Chance | If its owner finishes at 0 GP, restore 1 GP |

Effects follow the definitions in `src/data/card-pool.ts` and `public/cards/`.
Defense/healing resolve first, transfers next, Second Chance last. Transfers
cannot take more than an opponent's remaining GP. No valid tactical decisions
means no GP changes, no consumption and no completed-attack marker.

## Presentation and visual references

The main presentation sequence is source slides 1, 2, 3, 5, a timer, 6 and 7.
The old reward slide is omitted. Admin **Previous/Next** synchronize the preview
and public display. Configure minutes/seconds and start, pause or reset the
timer; the public timer has no challenge label.

`public/ui/Visual_Guide_App-Game_5.pptx` supplies reference artwork:

| Slide | Feature | Extracted asset |
| --- | --- | --- |
| 1 | Urutan Main | `visual-guide-slide-01.png` |
| 4 | Scoreboard | `visual-guide-slide-04.png` |
| 8 | Serangan GigaRisk | `visual-guide-slide-08.png` |
| 9 | Leaderboard | `visual-guide-slide-09.png` |
| 10 | Podium | `visual-guide-slide-10.png` |

Tactical Phase and Card Reveal use `tactical-slide-05-reference.png` and
`tactical-slide-06-reference.png`. Live overlays render teams, cards and values.
Card Reveal preserves card proportions and aligns team/status/effect/GP rows;
long effects wrap and scroll inside their team panel. Public layouts fit both
wide and 390-pixel viewports. Admin controls sit outside the slide artwork.

## Data and offline operation

SQLite runs in WASM and is stored as bytes in IndexedDB (`guard-the-heart`,
store `sqlite`, key `database`). ORM models are defined in `src/models/index.ts`.
Tactical selections, completed-attack archives, draw markers, turn order,
presentation/run state and podium prizes also use localStorage.

Keep IndexedDB and localStorage together when preserving an event. Clearing
browser site data removes local scores and history. Data does not synchronize
across devices, origins or separate browser profiles. The admin interface has
no authentication layer.

Database events use BroadcastChannel with a localStorage fallback. Public
transitions flush SQLite and refresh the receiving tab's saved database. Browser
locks serialize draw/attack actions per challenge where available. sql.js export
preserves foreign-key enforcement, and refreshed connections enable it.

The production service worker caches application assets for offline operation
after the app has loaded. Deploy `dist/` to host the PWA. The leaderboard's
**Save offline copy** flushes local storage; it is not a downloadable backup of
both IndexedDB and localStorage.

Production JavaScript is split into application and vendor chunks, with browser
shims kept alongside vendor dependencies. Both chunks are precached for offline
use and stay below the existing build warning limit; this separates caching
without materially reducing the total startup download.

## Source map and maintenance

| Location | Responsibility |
| --- | --- |
| `src/models/`, `src/controllers/` | ORM schema and UI operations |
| `src/db/` | WASM driver, persistence, initialization and migrations |
| `src/services/scoreboardAggregator.ts` | CP rankings, available-card totals, GP synchronization |
| `src/services/gpTransactions.ts` | GP ledger and durable combat balance changes |
| `src/services/tacticalPhase.ts` | Selection, effect resolution, consumption and once-only attack |
| `src/services/cardDraw.ts` | Card pool, draw, ownership and capacity |
| `src/services/games/` | Game rules and synchronized runs |
| `src/services/publicDisplay.ts`, `publicPresentation.ts`, `turnOrder.ts` | Projector navigation, presentation and order |
| `src/views/`, `src/styles/` | Feature screens and responsive styles |
| `src/data/`, `public/` | Question bank, card definitions, reference art and decks |
| `tests/`, `e2e/` | Unit/database and browser regressions |

`python scripts/import-reference-questions.py` imports reference questions into
`src/data/reference-question-bank.json`. Startup seeds 52 rows: 11 Image Decode,
21 retained Flipping Card and 20 Jaw of Risk. Image Decode question 11 is
**Lapor** (KDO clue). Source slide metadata and answer positions are retained.

For schema and implementation rules, see [blueprint.md](./blueprint.md).

## Verification

Run typecheck, lint, unit tests and the full browser suite after changes. Coverage
includes team CRUD/default-team protections, question scoring/timeouts, manual
Flipping selection, score correction, reward draws, card definitions and
consumption, Tactical/Card Reveal, GigaRisk transactions/reload, synchronized
public pages, presentation timers, offline loading and responsive layouts.
Podium and Urutan Main have route/layout coverage; unit rules cover GP ranking
and order independence. Automated checks do not guarantee every device or all
possible event sequences.

See the validation record in [blueprint.md](./blueprint.md#validation-record).
