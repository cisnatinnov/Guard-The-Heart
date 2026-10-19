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
4. Seed reference questions and the 86-card pool; repair legacy card definitions
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
| `guard-the-heart-tactical:<challengeId>` | Tactical choices, targets, assignment snapshot, visibility and completed resolution |
| `guard-the-heart-gigarisk-completed:<challengeId>` | Permanent completed-attack snapshot |
| `guard-the-heart-cards-drawn:<challengeId>` | Additional permanent draw marker |
| `guard-the-heart-crocodile:<challengeId>` | Jaw of Risk biting tooth, pressed teeth, last press time and reopen deadline |
| `guard-the-heart-presentation-timer-v2` | Countdown duration, remaining seconds, deadline, challenge title and active team id |
| `guard-the-heart-public-display` | Latest public stage and challenge, including game-board transitions |
| Other localStorage keys | Turn order, synchronized game runs, public-window presence/navigation and podium prizes |

Do not clear one store while expecting the other to reconstruct the entire
event. Synchronization is same-origin and same-profile, not cross-device.

## Teams and challenge data

`defaultTeams.ts` seeds Merah, Hijau, Biru, Kuning and Pink. Their names are
reserved; default teams cannot be renamed or deleted, but their status can be
changed manually. Existing colour teams are reused without changing status.
Additional teams support CRUD/status changes. The Team view filters name/status and offers 5/10/20/25/50/100 rows.

`recordGigaRiskGP` deactivates teams whose settled GP is zero in the same
transaction as the balance update. `syncRewardGP` also deactivates at zero,
including when a legacy active record already has that balance. Startup repairs
zero-GP status through `initializeGPTransactions`. Status is evaluated after
Second Chance and other card effects, so a positive revived balance stays active.
Manual deactivation applies to every team; `TeamController.setStatus` rejects
activation at zero and flushes status changes before notifying the UI. Neither
reward increases nor default-team seeding automatically reactivate a team.
The Teams view keeps inactive teams accessible through its status filter.

Image Decode, Flipping Connect and Jaw of Risk are locked challenge rows.
Controllers reject adding their reserved names, renaming them or deleting them.
Former names migrate; retired challenges are removed through startup migration. Stored `Flipping Card` and `Challenge 2 - Flipping Card` names migrate to `Challenge 2 - Flipping Connect` while retaining their ids and linked data.
The Challenge view displays all three built-in games with Play and Scoreboard
controls; Image Decode also has a reference-deck download. Play opens team-run
controls for Image Decode and Flipping Connect. Flipping Connect and Jaw of Risk
also publish and open their public game boards immediately from the click gesture.

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
- Editable assignment effects use one `assignment:<challengeId>:<teamId>` card ledger entry per team. Each edit replaces its prior delta from the original balance. This prevents repeated clicks or retargeting from stacking GP and lets deselection undo pending effects.
- Each GigaRisk team result records the actual clamped raw −2 strike, then any
  card-related adjustment to the resolved final balance. Protection/restoration,
  damage-time effects are explained in the card transaction; earlier assignment changes remain in their assignment ledger entries. `assignmentGP` prevents those changes from applying again.
- Attack and card records use `attack:<challengeId>:<teamId>` and
  `card:<challengeId>:<teamId>`. A challenge with an attack record cannot be
  applied again. Migration may encounter it again without changing balances.
- The attack's Team updates and ledger inserts share one Sequelize transaction.
  The tactical archive is published after database persistence succeeds.
- Reward corrections preserve combat deltas; completed strikes are not undone
  by recalculation or reload. GP is clamped at zero.

There is no admin feature for arbitrary direct GP edits.

## Card pool and consumption

`src/data/card-pool.ts` defines 12 artwork-backed designs (86 physical copies) from `public/cards/`:

| Rarity | Designs and copies | Total |
| --- | --- | --- |
| Normal | Heal, Shield, Thief: 16 each | 48 |
| Rare | Heal, Protect, Thief, Fortune Draw: 6 each | 24 |
| Epic | Reverse: 6; Swallow, Thief: 3 each | 12 |
| Legendary | Gardian Unity, Second Chance: 1 each | 2 |

Drawing requires five challenge entries. `cards_drawn_at`, a local draw marker,
and a per-challenge browser lock protect the once-only draw. CardController
draws into the challenge pool, reserving each rolled card through its
`challenge_point` recipient link, then assigns eligible rewards within quota/capacity.
`allocateUniqueCards` respects these reservations. Assignment and replacement
services reject a different recipient; old cards without a reservation remain compatible. Ineligible/unassignable cards remain waiting. Reopening rewards
or correcting scores cannot redraw. Controller/service assignment and replacement
operations remain available, but no collection-management screen is routed.

### Rarity-first reward draws

N = Normal, R = Rare, E = Epic, L = Legendary. Each card drawn uses its team's rank and challenge column; these are probabilities per card, not guaranteed quantities in a small draw.

| Rank | Cards | Challenge 1 | Challenge 2 | Challenge 3 |
| --- | --- | --- | --- | --- |
| 1 | 3 | N: 55%, R: 40%, E: 3%, L: 2% | N: 47%, R: 45%, E: 5%, L: 3% | N: 50%, R: 38%, E: 8%, L: 4% |
| 2 | 2 | N: 60%, R: 40% | N: 55%, R: 45% | N: 50%, R: 50% |
| 3 | 2 | N: 90%, R: 10% | N: 85%, R: 15% | N: 80%, R: 20% |
| 4 | 1 | N: 100% | N: 100% | N: 100% |
| 5 | 0 | — | — | — |

Each reward slot rolls rarity first, then selects a remaining physical copy of
that rarity. Only rank one can roll Legendary rewards. Within the
rolled rarity, available designs not already held or selected for that team are
preferred. If only duplicate designs remain, the physical reward stays reserved
and may wait for replacement rather than violating collection uniqueness.
The eight-card capacity still applies. A reward cannot be reassigned to another
ranked team; legacy unreserved cards keep their existing assignment behavior.

If a rolled rarity is exhausted, the entire draw rolls back: no cards are
consumed and the challenge remains undrawn. Probabilities are never silently
changed to another rarity. Existing completed draws are preserved.

`cardDrawRules.ts` contains the percentages and phase resolver. Built-in ids map
to challenge numbers; numbered custom names select a clamped phase 1–3, and
unnumbered custom challenges use phase 1. The draw plans against unassigned
inventory, removes every selected physical copy from its working set, and writes
reservations and `cards_drawn_at` in one SQLite transaction. A thrown depletion
error rolls back prior selections. Local draw markers are written only after success.
No migration rerolls previously completed rewards.

Assignments retain the ChallengePoint link and mirror an inventory copy in
TeamCard. A team's available collection excludes repeated design/rarity and is
capped at eight. Consumed cards stay physically stored for reveal history;
`usedTacticalCardIds` excludes consumed cards and reservations in other pending challenges from default
queries, totals and available capacity. Both admin and public Tactical Phase filter
these cards from available inventory, including cards used in a different
challenge. The Selected cards area and public selected slots retain the current
challenge’s locked played cards after completion; they cannot be reused. Pending choices are cleaned before selection, preview and attack.
Completed Card Reveal and GigaRisk history still load archived cards and inactive
participants through `useTacticalTeams({ includeInactive: true })`. New phases
load active teams only; inactive choices are excluded before executing an attack. `includeUsed=true` loads reveal archives.
Consumed records are not returned to the pool when an attack completes.

The 2026-10-15 card migration promotes the six Rare Reverse copies to Epic
Reverse, retaining their one-GP-from-each-opponent action. It renames the three
old Epic Reverse copies to Epic Thief with a two-selected-opponent action.
`seedCardPool` uses the old two-GP-from-every-opponent action to distinguish the
old Epic Reverse from the promoted one, making repeated startup idempotent even
when both designs share a numbered suffix. Inventory and TeamCard ids, ownership
and challenge links stay intact. Epic Reflect copies become Epic Swallow in place,
including owned cards, using the new fixed +4 GP action. Archived display labels
are normalized to Swallow; completed
attack snapshots and GP transactions are not recomputed. All three Epic PNGs
match the new definitions; the Rare Reverse PNG is retired.

## Tactical Phase and Serangan GigaRisk

`TacticalChoice` stores card ids, `skipped`, and optional per-card opponent
targets (one id for Normal/Rare Thief; two ids for Epic Thief), plus Fortune Draw
offers and selected reward ids. `useTacticalTeams` permits available earned cards
from all challenges, retaining each card's origin. Clicking toggles selection; drag/drop enforces ownership;
each team may select at most two cards. Public Tactical Phase shows selected cards face-up; Card Reveal hides its card art until admin reveals it or completes the attack. Returning from a preview permits edits; completing an
attack permanently locks decisions and result.

`attackTacticalPhaseOnce` executes under a per-challenge browser lock where
supported:

1. Reject a completed attack.
2. Validate owned selected cards and explicit SKIP decisions. With no decisions,
   show `Selesaikan challenge terlebih dahulu atau isi Tactical Phase dengan
   kartu yang dipilih.` and change nothing.
3. Require one other-team target for Normal/Rare Thief and two distinct other-team
   targets for Epic Thief. Missing, self and duplicate targets reject the attack.
4. Resolve the strike and effects, persist GP transactions, publish the immutable
   completed snapshot and emit card/scoreboard updates.

A partial valid tactical phase is accepted: teams without a selected card
receive the ordinary strike. Explicit all-team SKIP is valid. SKIP teams receive
−2 GP, subject to global Gardian Unity protection and GP floor zero.

### Effect resolution

Assignment GP is persisted immediately in one recalculated ledger entry per team and challenge. Retargeting or deselecting recalculates from the original balance, so repeated clicks cannot stack effects. Assignments reserve their cards against reuse in another challenge. The saved assignment snapshot carries effects and triggered Second Chance cards into damage resolution without repeating them.

The built-in effect descriptions match card artwork. Numeric values are read
from `effect_action`; supported designs and behavior are resolved by name/type
and effect. Arbitrary freeform descriptions do not create a general rules engine.

| Card | Action |
| --- | --- |
| Normal Heal | +2 GP at assignment |
| Normal Shield | Block 1 GP; multiple shields can block the full strike |
| Normal Thief | Take up to 1 GP from the selected opponent |
| Rare Heal | +3 GP at assignment |
| Rare Protect | Block the full strike for a selected team (including its owner) |
| Epic Reverse (promoted from Rare) | Take up to 1 GP from each opponent |
| Rare Thief | Take up to 2 GP from the selected opponent |
| Rare Fortune Draw | Choose 1 of 3 shuffled remaining Rare copies; award after the attack for later use |
| Epic Swallow | Convert the incoming strike into a fixed +4 GP; Unity/targeted Protect prevent conversion |
| Epic Thief (formerly Epic Reverse) | Take up to 2 GP from each of two selected opponents; up to +4 GP total |
| Legendary Gardian Unity | Only when selected and used: every team gains 1 GP at assignment and avoids the strike; owning or skipping the card grants neither effect |
| Legendary Second Chance | When selected by its owner, automatically restore 1 GP at zero; consume only on activation |

`fortuneDraw.ts` shuffles unassigned Rare copies, preferring distinct designs and
excluding Fortune Draw and designs the team already holds. Exactly three physical
copies are offered; fewer eligible copies cause a clear shortage error. Offers
and the chosen id are stored in the pending TacticalChoice and survive reload,
deselection and SKIP. No reroll button is provided. Offers are previews rather than
reservations, so settlement rechecks the selected copy's availability.
`validateTacticalAttack` requires one offered choice. `settleFortuneDraws` runs in
the GP transaction, checks source ownership/consumption, capacity and uniqueness,
assigns the chosen Card and creates its TeamCard, then records the result in
`effects`, `usedCardEffects`, and the source card's `cardEffects`. It uses the
inventory space freed by consumed selections. Unchosen copies remain untouched;
the reward's effect starts only when played later. Any failed grant rolls back
the entire attack. Completed-attack imports never grant the reward again.

Startup, card-pool operations and attacks share a browser database-write lock. Startup flushes its
changes before releasing the lock; an attack refreshes the saved database inside
it. Persistence writes only dirty databases, and incoming notifications cannot
replace local pending writes. Saves run in order and callers wait for pending
saves before telling public screens to reload. This prevents a newly opened public window from
overwriting a Fortune reward with its pre-attack SQLite snapshot. Ledger and
archive labels use the Swallow name while preserving historical GP values.
Fortune rewards are excluded from normal challenge assignment quotas, so a bonus
grant cannot block a team's remaining ranked rewards. Rapid public-screen
commands ignore obsolete requests, and owned popups catch up after loading.

During assignment, selected Heal and Unity bonuses apply before Reverse/Thief transfers. Transfers follow team/card iteration order and cannot exceed the opponent's remaining balance. Damage-time resolution applies Shield, Protect, Swallow and selected Unity protection without repeating assignment GP.
Second Chance triggers immediately at zero after the strike or a transfer, once per selected card. Owning or skipping the card does not activate it. It occupies one of the two selection slots and remains available if it is not triggered. The saved result includes consumed card ids, initial GP, effective
strike, final GP, effect descriptions, used-card count and resolution timestamp.
Opening Card Reveal alone does not execute the attack or consume cards; the
GigaRisk action makes the completed result visible there.

`GigaRiskView` and Card Reveal use the Tactical Phase card selection and
completed resolution to identify the cards actually consumed by each team.
Incoming effects do not add cards to a team's own list. Triggered Second Chance
is included through `usedCardIds`; untriggered passives are not shown.
Completed selections remain visible in their challenge's history, separate from available inventory. Card Reveal lays out equal-height images and reserves target-caption space beneath every slot. Visible Thief and Protect captions resolve saved target ids to team names; Epic Thief shows both opponents. Status, effect names and final GP remain within each team panel.

The rotating banner uses `resolvedCardEffects` with the current consumed card id. New resolutions save `cardEffects` keyed by card id; older archives split attributable saved activity by action and play order. Unknown historical amounts fall back to the action name without replaying the attack or inventing GP. Team `effects` remain the complete incoming/outgoing activity log for GigaRisk and the ledger. Positive and negative text use cyan and red respectively; long lists wrap and scroll.

An explicit GigaRisk challenge route loads that snapshot; `/gigarisk` uses the latest completed snapshot and subscribes to all challenges. Before an attack, it displays a waiting state. Raw damage is shown through the strike/balance fields rather than as an extra card outcome in Card Reveal.

## Game behavior

### Image Decode

Image Decode has 11 banking clues. Its current solo and team question screens have 15-second deadlines. Team runs
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

### Jaw of Risk

The routed game is a fourteen-tooth bite toy without questions, scoring or a
question timer. `CROCODILE_TEETH` is 14 and `CROCODILE_BITE_MS` is 4440, matching
the supplied GIF. Safe teeth remain pressed until the bite finishes, then a
new round chooses a different biting tooth. Round storage includes the last
press timestamp so both windows briefly render the same press hand.

Only admin can activate teeth. Public buttons are disabled and input handlers
also guard their controlling role. `useCrocodileHover` publishes normalized
1920 x 1080 pointer coordinates and the hovered tooth over a challenge-specific
BroadcastChannel, falling back to storage events. A newly connected display
requests the current pointer. Leaving the tooth/window or unmounting the admin
clears the remote hand and highlight; public pointer events do not publish.

The source assets in `public/ui/jaw-of-risk/` provide the proportional background,
fourteen full/pressed tooth pairs, left/right hands and all four MP3 cues. Sounds
play only in the controlling window. Small MP3s are precached; the 63 MB GIF uses
Workbox CacheFirst runtime caching after a controlled load. The twenty retained
Jaw questions are reference-bank content only.

### Flipping Connect

The routed game is matching-only: twenty cards, ten pairs, no Q&A, score changes
or turn timer. Only team runs are available. Play immediately opens or reuses the public matching board, and starting a run publishes the game as the current display so a previous public feature cannot replace it. The admin clicks a
participating team name above the board to select whose turn it is;
`manualTeamSelection` prevents automatic rotation. Mismatches close after a
short delay. A selected team's matched pairs are identified on the shared
board. All ten pairs complete the activity on admin and public screens; it does
not auto-save CP or open reward screens. Live GP lookup includes inactive teams
so an existing participant keeps its name and balance after deactivation. Waiting
boards use the active roster; selecting new participants still excludes inactive
teams. Starting a run awaits display publication and reports popup failures
without publishing an incomplete run. Legacy saved matching runs ignore old
turn deadlines so the removed timer cannot block an active game.

Urutan Main is a separate stored order. Its click/shuffle controls work on admin
and public routes and do not determine Flipping's manually chosen team.

## Views, references and synchronization

See the complete [route table](./readme.md#routes-and-public-displays).
`publicDisplay.ts` supports scoreboard, leaderboard, podium, rewards, tactical,
card-reveal, turn-order, gigarisk, timer, flipping-connect and jaws-of-risk. The
last two stages map to `/play/word-assembly/:challengeId` and
`/play/jaws-of-risk/:challengeId`. Global routes have no challenge suffix.
Feature navigation opens or reuses a separate public window; existing public
pages refresh saved database state before following the published transition.
Play awaits successful publication before leaving the challenge list, preserving
popup errors and retry controls. Starting Flipping Connect republishes its stage
before sharing the run. The saved stage also restores the correct feature after
a public reload instead of replaying an earlier scoreboard/leaderboard command.

| Screen | Visual reference |
| --- | --- |
| Urutan Main | Visual Guide slide 1 |
| Scoreboard | Visual Guide slide 4 layout and `Page_Score_Board.jpeg` GP footer |
| Serangan GigaRisk | Visual Guide slide 8 |
| Leaderboard | Visual Guide slide 9 |
| Podium | `podium-clean.png`, based on Visual Guide slide 10, plus live rank icons |
| Tactical Phase / Card Reveal | `tactical-slide-05-reference.png` / `tactical-slide-06-reference.png` |
| Flipping board | `flipping-slide-03-reference.png` and matching card faces |

The Visual Guide is `public/ui/Visual_Guide_App-Game_5.pptx`; extracted slide
assets are used as backgrounds with dynamic HTML values. Admin feature navigation
opens the associated public screen; separate public-view buttons are removed.
Rewards and Tactical Phase actions publish their selected challenge while
preserving tactical choices and reveal state. Timer uses its own named window,
so other feature changes leave it visible and running. Podium supports three prize amounts
stored locally and mirrored publicly. GP ledger is admin-only.
Scoreboard uses `Page_Score_Board.jpeg` and overlays a five-column GP strip below
the ranking box. Names, team colours and live GP come from active Team records;
participating teams appear first. Admin/public scoreboard share this component.

Podium value overlays scale typography by name/GP/prize length and remain within
the reference plaques. Long names have ellipsis/tooltips. `podium-clean.png`
retains the black jilbab while removing fixed medals and prize placeholder text.
Every occupied slot renders its entire `Icon-Rank_<rank>.png` using the actual
GP/CP rank; ties therefore share both the number and the medal colour. Badge
frames sit above the name plaques, and numeric/prize typography stays within
the illustrated panels. Prize inputs use three columns and stack on narrow screens.
Name and GP overlays are transparent; text sits directly on the original plaque
surfaces without adding rectangular backgrounds over the frames.

Card Reveal uses aligned grid rows for header, caption, proportional card art,
status, effects and GP. Effect text wraps; excessive content scrolls within the
effects area.
Card Reveal reserves matching caption space in every card slot, keeping targeted and non-targeted images proportional and aligned. Tactical and ranking card backs use contain fit.
Long team pills truncate with an ellipsis, and admin headings/toolbars wrap.
Flipping team labels also truncate within their buttons. Leaderboard effect
lists scroll within a bounded container so long descriptions do not enlarge rows.
Challenge artwork scales to viewport width; admin toolbars stay outside
artwork. Shared layout supports narrow and wide screens. Team labels follow the
team's colour identity; medal artwork follows the actual rank. `index.css`/`layout.css` supply the app theme;
reference, tactical, flipping, rewards and podium styles handle each screen.

### Standalone event timer

`/admin/timer` owns timer configuration and controls; `/timer` is its public
read-only display. Its 16:9 arena follows `public/ui/presentation-timer-no-banner.png`, with a clean background asset and live countdown, challenge title and team-turn panel. The admin selects the challenge and active team; the selected team is highlighted with a Giliran marker. `eventTimer.ts` stores those selections, duration, remaining seconds and an
absolute deadline in localStorage. A running countdown therefore survives
navigation and reloads. The default is 900 seconds and configured duration is
1–5999 seconds. The old timer storage keys are read for compatibility. No slide
index, slideshow navigation, or public slide feature remains. `/` routes to the
public scoreboard, and `/admin/presentation` redirects to `/admin/timer` for
older links.

`publicDisplay.ts` synchronizes the timer alongside scoreboard, leaderboard,
podium, rewards, tactical, card-reveal, turn-order, GigaRisk, Flipping Connect and
Jaw of Risk public displays. Timer notifications stay isolated to the timer window.

## Validation record

Verified on 2026-10-19 (WIB): **204 unit/database tests across 19 files and all
44 Playwright scenarios passed**. ESLint and the production build, including
TypeScript compilation, passed. Repository Markdown links and code fences were
also checked.

The browser suite covers all current public/admin routes at 1280 and 390 pixels,
team CRUD and status persistence, GP/CP ranking, score correction, reward draws,
Tactical/Card Reveal, GigaRisk, GP transactions, question deadlines and offline
reload. Card regressions cover all twelve actions, migration identities,
rank/phase rarity percentages, recipient reservations, capacity, atomic rollback,
Fortune Draw grants, target captions and retained reveal history.

Recent feature checks specifically verify:

- Flipping Connect is team-run only; Play opens its public board immediately,
  start reuses that window, popup errors can be retried, progress survives
  reload, and GP updates remain visible even for deactivated participants.
- Jaw of Risk renders fourteen teeth, blocks public activation, mirrors hand
  position and highlights (including storage-event fallback), uses the supplied
  sounds/GIF, and reopens after the 4.44-second bite. A published game transition
  prevents an earlier public feature from taking over after reload.
- Timer configuration, challenge selection and active-team marker synchronize
  across pause/reset/reload while its window remains independent of other views.
- Podium uses full rank artwork for distinct and tied GP/CP ranks, with matching
  medal colours, the black jilbab and correctly fitted labels/prize amounts on
  desktop and phone layouts. Numbered Urutan Main slots remain fixed during
  ordering/shuffling and synchronize publicly.

The full-suite audit corrected a stale twelve-tooth expectation and reproduced
and fixed Jaw of Risk's return to a previously published leaderboard command.

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

Automated coverage validates the implemented scenarios; it does not establish
exhaustive coverage of all combinations, devices or simultaneous admin edits.
