# Guard The Heart — implementation blueprint

This document describes the current implementation. User operating instructions,
routes and commands are in [readme.md](./readme.md). Reference decks supply visual
and question content; application behavior is defined by the source code.

## Architecture

- React 19, TypeScript 5.9 and Vite 7.
- Sequelize 6 models/controllers over SQLite in sql.js/WASM; no remote database.
- IndexedDB stores exported SQLite bytes. localStorage stores shared game and
  tactical state. Both stores are required to retain a full event.
- `vite-plugin-pwa`/Workbox caches production assets for offline use.
- Vite separates application code from a vendor chunk. CommonJS browser shims
  stay with vendor dependencies to avoid an application/vendor import cycle.
  Both JavaScript chunks remain within the configured 2048 kB warning limit.
- React hooks refresh views from local events and cross-tab BroadcastChannel
  messages, with a localStorage fallback.
- Public routes are separate from admin routes; no authentication is implemented.

## Database schema

All eight models use `createdAt` and `updatedAt` timestamps. UUID ids are generated
for all models except seeded GameQuestion ids. Definitions and associations live
in `src/models/index.ts`; startup seeds/migrations are in `src/db/database.ts`.

| Table | Fields excluding timestamps | Constraints and purpose |
| --- | --- | --- |
| `challenge` | `id`, `name`, nullable `cards_drawn_at` | Unique name; durable once-only draw timestamp |
| `team` | `id`, `name`, `status`, `total_gp` | Unique name; active/inactive status; initial GP 5 |
| `challenge_point` | `id`, `challenge`, `team`, `rank`, `score`, `challenge_point`, `guard_power` | Unique challenge/team; controllers limit a challenge to five teams |
| `scoreboard` | `id`, `team`, `rank`, `total_cp`, `total_card` | Unique team; rebuilt CP totals and available-card count |
| `card` | `id`, `name`, `type`, `effect`, `effect_action`, `icon`, nullable `challenge`, `team`, `challenge_point` | Physical inventory copy; null ownership before drawing/assignment |
| `team_card` | `id`, `name`, `type`, `effect`, `effect_action`, `icon`, nullable `team`, `challenge_point` | Assigned copy and retained reveal archive |
| `game_question` | `id`, `game_key`, `number`, `prompt`, `answer`, `options`, `kind`, `hint` | Unique game key/number; options JSON encoded as text; kind decode/choice |
| `gp_transaction` | See below | Persistent GP audit history |

Card rarity is Normal/Rare/Epic/Legendary. Effect is
Defense/Attack/Heal/Utility/Support/Thief. CP, GP, ranks and card counts are
integers. `Scoreboard` has no `total_gp` column: live GP comes from `Team`.

### GP transaction fields

| Field | Type and behavior |
| --- | --- |
| `id` | UUID primary key |
| `team` | Nullable Team UUID; deletion sets null |
| `team_name` | Saved label, string(100) |
| `challenge` | Nullable Challenge UUID; deletion sets null |
| `challenge_name` | Saved label, string(100), default empty |
| `source_key` | Unique string(250), prevents duplicate opening/attack/card records |
| `category` | opening/reward/attack/card |
| `gp_before` | Integer balance before this transaction |
| `delta` | Signed integer change |
| `gp_after` | Integer balance after this transaction |
| `description` | Text explaining reward/strike/card effect |

Saved labels retain readable history if a referenced team or challenge is
deleted. The admin ledger displays the latest 500 rows, optionally filtered by
team, ordered newest first, with timestamps in Asia/Jakarta (WIB).

## Startup and persistence

1. Load saved SQLite bytes and initialize Sequelize models.
2. Apply compatibility migrations, seed locked challenges and default teams.
3. Create missing opening GP transactions and import existing completed tactical
   resolutions once, without rerunning effects.
4. Seed reference questions and the 80-card pool; repair legacy card definitions
   and duplicate available designs as appropriate.

The GP ledger is added with normal schema synchronization. Adding it does not
classify an otherwise current database as a legacy schema requiring reset.
Current-schema startup retains existing teams, scores, rewards and card links.
For databases without `ChallengePoint.score`, startup adds the integer column
and copies the old raw `challenge_point` values into it before reranking.
Reward CP/GP and standings are rebuilt; combat transactions remain preserved.
Controllers accept `score` as input; legacy `challenge_point` input is treated
as a raw score for compatibility. New UI controls use Score/Edit Score.

SQLite mutations schedule a debounced IndexedDB export. Display transitions and
draw/attack operations flush before sending updates. sql.js export resets
connection pragmas, so `exportDatabase` restores the foreign-key setting;
reloading a connection enables foreign keys.

| Storage | Contents |
| --- | --- |
| IndexedDB `guard-the-heart` / `sqlite` / `database` | Entire SQLite file including GP transactions |
| `guard-the-heart-tactical:<challengeId>` | Tactical choices, targets, visibility and resolution |
| `guard-the-heart-gigarisk-completed:<challengeId>` | Permanent completed-attack snapshot |
| `guard-the-heart-cards-drawn:<challengeId>` | Additional permanent draw marker |
| Other localStorage keys | Turn order, synchronized game runs, standalone timer/run state and podium prizes |

Do not clear one store while expecting the other to reconstruct the entire
event. Synchronization is same-origin and same-profile, not cross-device.

## Teams and challenge data

`defaultTeams.ts` seeds Merah, Hijau, Biru, Kuning and Pink. Their names are
reserved; default teams cannot be renamed, deactivated or deleted. Existing
colour teams are reused and reactivated. Additional teams support CRUD/status
changes. The Team view filters name/status and offers 5/10/20/25/50/100 rows.

Image Decode, Flipping Card and Jaw of Risk are locked challenge rows.
Controllers reject adding their reserved names, renaming them or deleting them.
Former names migrate; retired challenges are removed through startup migration.
The current Challenge view filters out Image Decode and Jaw of Risk, displaying
Flipping Card with Play, Scoreboard and deck links. Its Play screen contains the
team-run controls. Hidden games retain direct routes and scoreboard selections.

Internal game ids remain `emoji-decode`, `word-assembly` and `jaws-of-risk`.
`GameView` routes `word-assembly` to `MatchingOnlyView`. The retained legacy
question/matching services and 21 Flipping questions are not the current
Flipping UI flow.

## Scores, rankings and rewards

`rerankChallenge` orders entries by raw `score` and assigns dense ranks. Equal
scores share rank; the next distinct score increments by one (`1,2,2,3,4`).
`challenge_point` stores the CP reward, not the raw score. Editing/removing an
entry reranks its challenge, rebuilds earned CP totals and adjusts reward GP.

| Rank | CP reward | GP reward | Card quota |
| --- | --- | --- | --- |
| 1 | 10 | 3 | 3 |
| 2 | 8 | 2 | 2 |
| 3 | 6 | 2 | 2 |
| 4 | 4 | 1 | 1 |
| 5 | 2 | 1 | 0 |

`recalculateTotalScoreboard` sums CP and counts available TeamCards, capped at
eight. Stored `Scoreboard.rank`, both leaderboard views and podium use the
shared `rankGuardPointStandings`: current GP descending, then total earned CP
descending. Only identical GP/CP values share a dense rank; team names stabilize
exact ties. Podium shows the first three teams and labels unresolved ties.

Leaderboard mount/event refresh reads stored standings rather than starting a
second rebuild. Recalculations run through a shared in-tab queue and update
existing team rows, preserving ids and avoiding duplicate-team validation errors.

### GP synchronization and audit rules

`gpTransactions.ts` serializes its mutations within a tab.

- Team creation records `opening:<teamId>` (0 → 5). Existing data records a
  single opening balance during initialization.
- Reward synchronization computes `max(0, 5 + earned GP + sum of recorded
  attack/card deltas)`. It records only changed balances; recalculating an
  unchanged reward does not add a transaction.
- Each GigaRisk team result records the actual clamped raw −2 strike, then any
  card-related adjustment to the resolved final balance. Protection/restoration,
  healing and transfers are explained in the card transaction.
- Attack and card records use `attack:<challengeId>:<teamId>` and
  `card:<challengeId>:<teamId>`. A challenge with an attack record cannot be
  applied again. Migration may encounter it again without changing balances.
- The attack's Team updates and ledger inserts share one Sequelize transaction.
  The tactical archive is published after database persistence succeeds.
- Reward corrections preserve combat deltas; completed strikes are not undone
  by recalculation or reload. GP is clamped at zero.

There is no admin feature for arbitrary direct GP edits.

## Card pool and consumption

`src/data/card-pool.ts` defines 11 artwork-backed designs from `public/cards/`:

| Rarity | Designs and copies | Total |
| --- | --- | --- |
| Normal | Heal, Shield, Thief: 16 each | 48 |
| Rare | Heal, Protect, Reverse, Thief: 6 each | 24 |
| Epic | Reflect, Reverse: 3 each | 6 |
| Legendary | Gardian Unity, Second Chance: 1 each | 2 |

Drawing requires five challenge entries. `cards_drawn_at`, a local draw marker,
and a per-challenge browser lock protect the once-only draw. CardController
draws into the challenge pool, then assigns eligible rewards randomly within
quota/capacity. Ineligible/unassignable cards remain waiting. Reopening rewards
or correcting scores cannot redraw. Controller/service assignment and replacement
operations remain available, but no collection-management screen is routed.

Assignments retain the ChallengePoint link and mirror an inventory copy in
TeamCard. A team's available collection excludes repeated design/rarity and is
capped at eight. Consumed cards stay physically stored for reveal history;
`usedTacticalCardIds` excludes chosen cards in completed resolutions from default
queries, totals and available capacity. `includeUsed=true` loads reveal archives.
Consumed records are not returned to the pool when an attack completes.

## Tactical Phase and Serangan GigaRisk

`TacticalChoice` stores card ids, `skipped`, and optional per-card opponent
targets. `useTacticalTeams` restricts selection to a team's cards earned in the
selected challenge. Clicking toggles selection; drag/drop enforces ownership;
each team may select at most two cards. Previewed selections are hidden publicly
until admin reveals them. Returning from a preview permits edits; completing an
attack permanently locks decisions and result.

`attackTacticalPhaseOnce` executes under a per-challenge browser lock where
supported:

1. Reject a completed attack.
2. Validate owned selected cards and explicit SKIP decisions. With no decisions,
   show `Selesaikan challenge terlebih dahulu atau isi Tactical Phase dengan
   kartu yang dipilih.` and change nothing.
3. Require an explicit other-team target for each Thief action.
4. Resolve the strike and effects, persist GP transactions, publish the immutable
   completed snapshot and emit card/scoreboard updates.

A partial valid tactical phase is accepted: teams without a selected card
receive the ordinary strike. Explicit all-team SKIP is valid. SKIP teams receive
−2 GP, subject to global Gardian Unity protection and GP floor zero.

### Effect resolution

The built-in effect descriptions match card artwork. Numeric values are read
from `effect_action`; supported designs and behavior are resolved by name/type
and effect. Arbitrary freeform descriptions do not create a general rules engine.

| Card | Action |
| --- | --- |
| Normal Heal | +2 GP after the strike |
| Normal Shield | Block 1 GP; multiple shields can block the full strike |
| Normal Thief | Take up to 1 GP from the selected opponent |
| Rare Heal | +3 GP after the strike |
| Rare Protect | Block the full strike for the owner |
| Rare Reverse | Take up to 1 GP from each opponent |
| Rare Thief | Take up to 2 GP from the selected opponent |
| Epic Reflect | Convert −2 strike into +2 GP |
| Epic Reverse | Take up to 2 GP from each opponent |
| Legendary Gardian Unity | All teams avoid the strike and gain 1 GP |
| Legendary Second Chance | Owner ending at zero returns to 1 GP |

Defense and healing resolve first. Reverse/Thief transfers resolve next in team
and card iteration order and cannot exceed the opponent's remaining balance.
Second Chance resolves last. The saved result includes initial GP, effective
strike, final GP, effect descriptions, used-card count and resolution timestamp.
Opening Card Reveal alone does not execute the attack or consume cards; the
GigaRisk action makes the completed result visible there.

## Game behavior

### Image Decode and Jaw of Risk

Image Decode has 11 banking clues; Jaw of Risk has 20 choice questions. Both
current solo and team question screens have 15-second deadlines. Team runs
select up to five participants and randomize initial order through roulette.

- Self: +10 correct, −10 wrong/expired.
- Passed question: recipient +5/giver −10 if correct; both −5 if wrong/expired.
- Correct advances. Wrong/expired keeps the question for the next eligible team.
  All-team failure also advances.
- Scores are persisted to ChallengePoint. Final completion saves all participants
  and transitions host/projector to their scoreboard. Early End run cancels.
- Solo has no selected team, so its score must be entered manually.

Shared run state and deadlines survive public reload. Question content is
upserted from `src/data/reference-question-bank.json`; the importer retains
source slide numbers and answer positions. There are 52 stored reference rows
(11 Image Decode, 21 retained Flipping, 20 Jaw). Image Decode question 11 uses
the KDO clue and answer Lapor.

### Flipping Card

The routed game is matching-only: twenty cards, ten pairs, no Q&A, score changes
or turn timer. Solo supports restart. In team mode, the admin clicks a
participating team name above the board to select whose turn it is;
`manualTeamSelection` prevents automatic rotation. Mismatches close after a
short delay. A selected team's matched pairs are identified on the shared
board. All ten pairs complete the activity on admin and public screens; it does
not auto-save CP or open reward screens. Legacy saved matching runs ignore old
turn deadlines so the removed timer cannot block an active game.

Urutan Main is a separate stored order. Its click/shuffle controls work on admin
and public routes and do not determine Flipping's manually chosen team.

## Views, references and synchronization

See the complete [route table](./readme.md#routes-and-public-displays).
`publicDisplay.ts` supports scoreboard, leaderboard, podium, rewards, tactical,
card-reveal, turn-order and gigarisk. Global routes have no challenge suffix.
Display buttons open a normal browser tab and broadcast a transition; existing
public pages refresh saved database state before following it.

| Screen | Visual reference |
| --- | --- |
| Urutan Main | Visual Guide slide 1 |
| Scoreboard | Visual Guide slide 4 layout and `Page_Score_Board.jpeg` GP footer |
| Serangan GigaRisk | Visual Guide slide 8 |
| Leaderboard | Visual Guide slide 9 |
| Podium | Visual Guide slide 10 |
| Tactical Phase / Card Reveal | `tactical-slide-05-reference.png` / `tactical-slide-06-reference.png` |
| Flipping board | `flipping-slide-03-reference.png` and matching card faces |

The Visual Guide is `public/ui/Visual_Guide_App-Game_5.pptx`; extracted slide
assets are used as backgrounds with dynamic HTML values. Leaderboard and
scoreboard have public display buttons.
Rewards and Tactical Phase admin toolbars also open their selected challenge
in a public tab and publish its display transition, preserving tactical choices
and reveal state. Podium supports three prize amounts
stored locally and mirrored publicly. GP ledger is admin-only.
Scoreboard uses `Page_Score_Board.jpeg` and overlays a five-column GP strip below
the ranking box. Names, team colours and live GP come from active Team records;
participating teams appear first. Admin/public scoreboard share this component.

Podium value overlays scale typography by name/GP/prize length and remain within
the reference plaques. Long names have ellipsis/tooltips. Tie badges mask the
original printed rank to prevent overlapping digits.
Name and GP overlays are transparent; text sits directly on the original plaque
surfaces without adding rectangular backgrounds over the frames.

Card Reveal uses aligned grid rows for header, caption, proportional card art,
status, effects and GP. Effect text wraps; excessive content scrolls within the
effects area.
Card Reveal reserves more vertical space for effect descriptions while keeping
the card images proportional. Tactical and ranking card backs use contain fit.
Long team pills truncate with an ellipsis, and admin headings/toolbars wrap.
Flipping team labels also truncate within their buttons. Leaderboard effect
lists scroll within a bounded container so long descriptions do not enlarge rows.
Challenge artwork scales to viewport width; admin toolbars stay outside
artwork. Shared layout supports narrow and wide screens. Colours follow the
team's identity, not its rank. `index.css`/`layout.css` supply the app theme;
reference, tactical, flipping, rewards and podium styles handle each screen.

### Standalone event timer

`/admin/timer` owns timer configuration and controls; `/timer` is its public
read-only display. `eventTimer.ts` stores duration, remaining seconds and an
absolute deadline in localStorage. A running countdown therefore survives
navigation and reloads. The default is 900 seconds and configured duration is
1–5999 seconds. The old timer storage keys are read for compatibility. No slide
index, slideshow navigation, or public slide feature remains. `/` routes to the
public scoreboard, and `/admin/presentation` redirects to `/admin/timer` for
older links.

`publicDisplay.ts` synchronizes the timer alongside the scoreboard, leaderboard,
podium, rewards, tactical, card-reveal, turn-order and GigaRisk public displays.

## Validation record

Run checks from the repository root:

```sh
npm run typecheck
npm run lint
npm test
npm run test:e2e -- --workers=2
```

Playwright's configured web server runs a production build before browser tests.
Install Chromium first if needed (`npx playwright install chromium`). On machines
using a custom browser installation, set `PLAYWRIGHT_BROWSERS_PATH` accordingly.

Verification on 2026-10-14:

- 121 unit/database tests across 13 files passed, including score migration, the
  exact five-rank reward table and GP/CP tie-break rules.
- 22 Playwright scenarios passed, covering GP ledger persistence, score correction,
  default-team protections, game completion/timeouts, reward draw limits,
  manual Flipping Card team selection without a turn timer, synchronized
  Tactical/Card Reveal, standalone timer, slideshow removal, offline reload and
  responsive layouts at 1280 and 390 pixels.
- TypeScript, ESLint and the production build passed. The vendor/application
  JavaScript chunks are 1,947.94 kB and 180.82 kB, both below the 2,048 kB
  chunk warning threshold.
- Automated coverage validates the implemented scenarios; it does not establish
  exhaustive coverage of all combinations, devices or simultaneous admin edits.
