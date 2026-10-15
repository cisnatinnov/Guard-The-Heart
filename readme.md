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
scoreboard. Configure and run the standalone event timer at `/admin/timer`; its
public display is `/timer`. Production hosting must serve `index.html` for application routes.

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
3. Choose **Play** on **Challenge** for **Challenge 2 - Flipping Card** or
   **Challenge 3 - Jaw of Risk**. Flipping Card is a matching-only activity;
   Jaw of Risk is a crocodile bite toy. Image Decode remains available through
   its direct game route and retains team scoring.
4. Review or enter game scores on **Scoreboard**. **Edit Score** corrects an existing score
   and recalculates ranks and GP rewards. Each challenge supports at most five
   team entries, with one entry per team.
5. **Claim Rewards** opens the reward board on admin and existing public pages.
   With five entries, it draws and randomly assigns bonus cards once. Revisiting
   the page does not draw again. **Draw Bonus Cards** offers the same draw from
   the scoreboard.
6. From **Rewards**, open **Tactical Phase**. Owned cards are grouped by the
   challenge that awarded them, including used cards marked as history. Select
   up to two available cards from any challenge, by clicking or dragging, or choose **Skip**.
   The public Tactical Phase shows one owned-card list per team, including used
   cards marked Used. Owned and selected cards are shown face-up.
   **Card Reveal** displays those selections without applying an attack.
7. In **Tactical Phase**, choose an opponent for each
   Normal/Rare Thief card, or two distinct opponents for Epic Thief, then click
   **Serang semua tim −2 GP**. The attack and selected
   effects apply once. An empty tactical phase blocks the attack with a message;
   explicit SKIP is a valid decision. Used cards leave available inventory.
   **Serangan GigaRisk** only displays the saved attack result.
   Applying the attack opens Card Reveal with animated played cards and resolved
   effects. Reduced-motion settings disable the animation.
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
| Event timer | `/admin/timer` | `/timer` |

Clicking an admin feature tab with a public view opens a separate public window
while keeping the admin window active. Later feature clicks update that window
without opening a duplicate or focusing it. If it is closed, the next feature
click opens a replacement. Separate public-view buttons have been removed.
Timer uses its own window, separate from the other public features. Other feature
clicks leave the timer visible and running; clicking Timer reuses its window or
reopens it if closed.
The former `/admin/presentation` URL redirects to `/admin/timer`.
Public game, reward, tactical, reveal and ranking pages display live state. Urutan Main
is interactive on its public page. The retired `/cards` and `/admin/cards`
routes are not current features; unknown routes redirect to `/scoreboard`.

## Challenges

The three seeded challenges cannot be added, renamed or deleted through the UI
or controller. Older titles migrate to current names. Internal game ids remain
stable for saved-data compatibility.

The challenge list hides Image Decode; its direct game route remains available.

| Challenge | Game id | Current play |
| --- | --- | --- |
| Challenge 1 - Image Decode | `emoji-decode` | 11 banking clues, 15-second solo/team question timers |
| Challenge 2 - Flipping Card | `word-assembly` | 20 picture cards, 10 pairs, matching only, no questions or CP |
| Challenge 3 - Jaw of Risk | `jaws-of-risk` | 12 teeth, one hidden biting tooth; automatically reopens and chooses a different biting tooth after each bite |

Jaw of Risk contains only the toy, with no questions, timer or automatic scoring.
Safe teeth stay pressed until a bite. The admin and public toy views synchronize
through local storage, including after reload. Clicking **Play** automatically
shows it in the public window, reusing an open public view. Tactical Phase and Card Reveal also show the current challenge
in a badge at the top right.

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
to choose the active team manually. Matching has no turn timer. Mismatched cards
close automatically, and matching or waiting does not change the selected team.
Matched pairs retain their team's identity. Completing ten pairs ends matching
on both displays; it does not create scores or automatically open rewards.
Solo mode supports matching and restart. Urutan Main does not change this run.

The 21 reference Flipping Card questions remain seeded for compatibility and
reference decks; the current routed screen uses matching-only play.

## Ranking, GP and cards

Challenge rankings use raw game score descending. Scores are stored separately
from earned challenge points (CP). Equal scores use dense ranks: `1, 2, 2, 3, 4`.
Leaderboard and podium rank current `Team.total_gp` descending, then total earned
CP descending to break GP ties. Teams share a rank only when both GP and CP are
equal; name ordering makes exact ties stable. The podium shows the first three teams.

Leaderboard refresh reads the saved standings. Recalculation is serialized and
updates existing rows to avoid duplicate-team validation conflicts.

| Challenge rank | CP reward | GP reward | Card reward |
| --- | --- | --- | --- |
| 1 | 10 | +3 | 3 |
| 2 | 8 | +2 | 2 |
| 3 | 6 | +2 | 2 |
| 4 | 4 | +1 | 1 |
| 5 | 2 | +1 | 0 |

Current GP includes the initial 5, challenge rewards, and recorded combat
changes. Score correction adjusts reward GP while preserving recorded attacks
and card effects. GP cannot become negative. The GP ledger persists attack
results so reload or leaderboard recalculation does not undo them.

The inventory contains 80 physical copies of 11 designs: 48 Normal, 18 Rare,
12 Epic and 2 Legendary. Epic Reverse has six copies (promoted from Rare Reverse);
Epic Thief has three copies (renamed from the old Epic Reverse). Epic Reflect
has three copies. A team can hold eight available cards. Assignment
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
| Rare Protect | Block the strike for a selected team (including its owner) |
| Epic Reverse (formerly Rare Reverse) | Take up to 1 GP from each opponent |
| Rare Thief | Take up to 2 GP from a selected opponent |
| Epic Reflect | Convert the incoming 2 GP strike into a doubled +4 GP gain |
| Epic Thief (formerly Epic Reverse) | Take up to 2 GP from each of two selected opponents, up to +4 GP total |
| Legendary Gardian Unity | Protect all teams and add 1 GP to each |
| Legendary Second Chance | Passively restore 1 GP when its owner reaches zero; consume only on activation |

Effects follow the definitions in `src/data/card-pool.ts` and `public/cards/`.
Defense/healing resolve first, transfers next. Second Chance triggers immediately when the strike or a transfer reduces its owner to zero, once per card, including when skipping; it does not occupy an active selection slot. Transfers
cannot take more than an opponent's remaining GP. No valid tactical decisions
means no GP changes, no consumption and no completed-attack marker.

Epic Thief requires two different opponents; the target selectors exclude the
other selection, and attack validation rejects missing, duplicate and self
targets. Normal/Rare Thief keep one target. Epic Reverse targets all opponents
automatically and retains its original one-GP effect. Reflect gains nothing
from damage that Gardian Unity or targeted Protect prevents entirely. Rare Protect requires one valid target, which can be its owner or another team.

Startup migrates `Rare Reverse Card #NN` to `Epic Reverse Card #NN`, and the old
`Epic Reverse Card #NN` with the two-GP-from-every-opponent description to
`Epic Thief Card #NN`. The description distinguishes old and new Epic Reverse
cards so repeated startups do not rename promoted cards again. Physical-copy
ids, ownership, challenge links, draw state and consumed-card ids are preserved.
Completed attack results and GP transactions are historical and are not replayed.

The updated PNG assets are `public/cards/Epic_Reflect Card.png`,
`public/cards/Epic_Reverse Card.png` and `public/cards/Epic_Thief Card.png`.
`Rare_Reverse Card.png` is retired. Artwork was edited with built-in imagegen.
The prompt set preserves the portrait Epic purple/silver frame and layout:

- Reflect: retain the explosion art and REFLECT title; print exactly
  “Damage Gigarisk yang diterima dikonversi double menjadi Guard Point (GP).”
- Reverse: retain the reverse-arrow art and REVERSE title; print exactly
  “Ambil 1 Guard Point (GP) dari setiap tim lawan.”
- Thief: use the Epic heading, THIEF title and a masked thief with two GP gems;
  print exactly “Ambil 2 Guard Point (GP) dari dua tim lawan.”

## Timer and visual references

The event timer is a standalone admin/public screen, independent of challenge
slides. Admins configure 1–5999 seconds and can start, pause or reset the timer.
Its deadline is saved locally, so the countdown continues across page changes and
reloads. `/timer` is a read-only display with no challenge label. The old
`/admin/presentation` path redirects to the timer for saved links; `/` now opens
the scoreboard. There is no slide navigation or public slideshow feature.

`public/ui/Visual_Guide_App-Game_5.pptx` and the supplied scoreboard JPEG provide reference artwork:

| Slide | Feature | Reference asset |
| --- | --- | --- |
| 1 | Urutan Main | `visual-guide-slide-01.png` |
| 4 | Scoreboard | `Page_Score_Board.jpeg` (including the GP footer) |
| 8 | Serangan GigaRisk | `visual-guide-slide-08.png` |
| 9 | Leaderboard | `visual-guide-slide-09.png` |
| 10 | Podium | `visual-guide-slide-10.png` |

Scoreboard displays five team GP panels below its main ranking box, following
`Page_Score_Board.jpeg`. They show current live Team GP on admin/public views,
with participating teams first and remaining active teams filling empty slots.

Podium overlays keep names, GP and prizes inside the illustrated plaques.
Names and GP use transparent overlays so the original plaque artwork stays visible.
Text scales to fit longer values; very long names use an ellipsis with the
full name available as a tooltip. Tied ranks cover the original badge numbers.

Tactical Phase and Card Reveal use `tactical-slide-05-reference.png` and
`tactical-slide-06-reference.png`. Live overlays render teams, cards and values.
Card Reveal preserves card proportions and aligns team/status/effect/GP rows;
the effects area has extra space for two selected-card descriptions. Longer
effects wrap and scroll inside their team panel. Card backs preserve their
proportions in Tactical Phase and rankings, and long team names use ellipses
inside their pills and Flipping team buttons. Long leaderboard effect lists
scroll within their row rather than expanding the reference table. Public layouts fit both
wide and 390-pixel viewports. Admin controls sit outside challenge artwork.
Admin toolbars wrap inside their panels; long headings and labels stay within
the viewport. UI checks cover all current routes at desktop/mobile widths,
including the standalone timer, direct Image Decode and Jaw of Risk pages and GP transactions.

## Data and offline operation

SQLite runs in WASM and is stored as bytes in IndexedDB (`guard-the-heart`,
store `sqlite`, key `database`). ORM models are defined in `src/models/index.ts`.
Existing raw CP values migrate into the new `ChallengePoint.score` column,
then CP/GP rewards are recalculated from ranks. Recorded combat remains intact.

Tactical selections, completed-attack archives, draw markers, turn order,
standalone timer/run state and podium prizes also use localStorage.

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
| `src/services/scoreboardAggregator.ts` | Score rankings, earned-CP totals, available-card totals, GP synchronization |
| `src/services/gpTransactions.ts` | GP ledger and durable combat balance changes |
| `src/services/tacticalPhase.ts` | Selection, effect resolution, consumption and once-only attack |
| `src/services/cardDraw.ts` | Card pool, draw, ownership and capacity |
| `src/services/games/` | Game rules and synchronized runs |
| `src/services/publicDisplay.ts`, `eventTimer.ts`, `turnOrder.ts` | Public display navigation, timer and order |
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
public pages, standalone timer, slide removal, offline loading and responsive layouts.
Podium and Urutan Main have route/layout coverage; unit rules cover GP ranking
and order independence. Automated checks do not guarantee every device or all
possible event sequences.

See the validation record in [blueprint.md](./blueprint.md#validation-record).

Card revision verified on 2026-10-15: 128 unit/database tests and six affected
browser scenarios passed, along with the production build and ESLint. Coverage
includes both Reverse migrations, repeated startup, double Reflect, distinct
Thief targets, card-image loading, public reveal, GP transactions and reward draws.
