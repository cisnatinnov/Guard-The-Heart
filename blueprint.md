# Guard The Heart — implementation blueprint

This document describes the current source implementation. Operating instructions,
routes and commands are in [readme.md](./readme.md). Reference images and decks
supply artwork and question content; source code defines game behavior.

## Architecture

- React 19, TypeScript 5.9, Vite 7; Sequelize 6 over SQLite in sql.js/WASM.
- IndexedDB stores the SQLite file. localStorage stores tactical archives, shared
  game runs, presentation state, turn order, timer state and public navigation.
- Local events and BroadcastChannel notifications refresh mounted views; storage
  events provide a fallback. Synchronization requires the same origin/profile.
- The production PWA precaches application assets. Large source decks are excluded;
  the optimized Jaw of Risk bite WebP is precached. Browser shims stay in the vendor
  chunk alongside their CommonJS dependencies.
- Public and admin routes have different controls; no authentication is implemented.

## Database schema

`challenge_answer` stores host verdict ids, answering/pressing teams, correctness, bite results, saved press counts, a matching bonus deadline and the unique awarded pair numbers. New columns migrate into existing saves. Legacy `challenge_point.raw_score_only` flags are cleared during reranking; CP/GP always follow current raw-score rank.

Ten models use `createdAt` and `updatedAt` timestamps. Most ids are UUIDs;
GameQuestion and BlindReward use stable seeded/composite ids. Model definitions
and associations live in `src/models/index.ts`.

| Table | Fields excluding timestamps | Purpose |
| --- | --- | --- |
| `challenge` | `id`, `name`, nullable `cards_drawn_at` | Unique name and once-only draw marker |
| `team` | `id`, `name`, nullable `colour`, `status`, `total_gp` | Editable unique name, permanent original colour, active/inactive status, initial 5 GP |
| `challenge_point` | `id`, `challenge`, `team`, `rank`, `score`, `raw_score_only`, `challenge_point`, `guard_power` | Unique challenge/team; raw score, dense rank, earned CP/GP, legacy compatibility flag (cleared on rerank) |
| `challenge_answer` | `id`, `challenge`, `team`, `correct`, nullable `pressing_team`, `settled`, nullable `bitten`, `press_count`, nullable `matching_deadline`, `matching_pairs` | Idempotent host verdict, minimum-two press assignment, per-press bite settlement and unique matching bonuses |
| `scoreboard` | `id`, `team`, `rank`, `total_cp`, `total_card` | Saved standings and available-card totals |
| `card` | `id`, `name`, `type`, `effect`, `effect_action`, `icon`, nullable `challenge`, `team`, `challenge_point` | Finite physical copy and reward reservation |
| `team_card` | `id`, `name`, `type`, `effect`, `effect_action`, `icon`, nullable `team`, `challenge_point` | Awarded inventory and retained card history |
| `blind_reward` | `id`, `challenge`, `team`, `options`, nullable `selected`, `reward_id` | Saved rank 5 offer, JSON options, one final selection |
| `game_question` | `id`, `game_key`, `number`, `prompt`, `answer`, `options`, `kind`, `hint` | Seeded reference questions; unique game key/number |
| `gp_transaction` | `id`, nullable `team`, `team_name`, nullable `challenge`, `challenge_name`, `source_key`, `category`, `gp_before`, `delta`, `gp_after`, `description` | Persistent GP ledger; unique source keys prevent duplicate writes |

Card types are Normal/Rare/Epic/Legendary. Card effects are
Defense/Attack/Heal/Utility/Support/Thief. False Hope is a legacy blind-draw result,
not an additional tactical rarity or inventory design. GP lives on Team;
Scoreboard has no `total_gp` column. GP transaction categories are
opening/reward/attack/card. Saved team/challenge labels retain readable history
if referenced rows are deleted. The admin ledger shows the latest 500 matching
rows, optionally filtered by team, using Asia/Jakarta timestamps.

## Startup and persistence

Startup synchronizes the current schema, applies compatibility migrations, seeds
locked challenges, default teams, reference questions and missing deck copies,
and imports completed combat history without replaying effects. Current-schema
data is retained. A database without `ChallengePoint.score` receives that column
and copies the former raw `challenge_point` input before reranking.

The new deck retires only undrawn excess copies. Already-earned and historical
copies retain their identity and links. Legacy Reverse/Reflect definitions migrate
to Reverse/Thief/Swallow using saved names and actions. Old pending timing changes
are normalized; completed GP totals remain saved results.

SQLite changes export to IndexedDB after a debounce; draw/attack/display transitions
flush explicitly. Exported connections restore foreign-key enforcement. Database
write locks, ordered saves and refreshes protect browser-tab mutations. Public
notifications flush SQLite before the receiving tab reloads it.

| Storage | Contents |
| --- | --- |
| IndexedDB `guard-the-heart` / `sqlite` / `database` | Entire SQLite file, including blind draws and GP ledger |
| `guard-the-heart-tactical:<challengeId>` | Choices, targets, Fortune offers/visibility, assignment, reveal flags, resolution |
| `guard-the-heart-gigarisk-completed:<challengeId>` | Permanent completed attack snapshot |
| `guard-the-heart-cards-drawn:<challengeId>` | Additional draw marker |
| `guard-the-heart-crocodile:<challengeId>` | Jaw bite/pressed-tooth state and reopen deadline |
| `guard-the-heart-presentation-timer-v2` | Standalone timer duration/deadline/challenge/active team |
| `guard-the-heart-public-display` | Latest shared stage and challenge |
| `guard-the-heart-reward-pointer` | Transient Reward Claim hover/focus message with challenge, team and option ids; not reward settlement |
| Other localStorage keys | Main presentation selection, turn order, game runs, window presence, podium prizes |

Keep IndexedDB and localStorage together when preserving an event. Clearing one
store cannot reconstruct the other. Data does not sync between devices/profiles.

### Completed archives with missing teams

On startup, `initializeGPTransactions` imports completed tactical/GigaRisk history
using `recordGigaRiskGP(..., true)`. An archive can outlive team deletion or a
recreated SQLite database while localStorage still holds the earlier team ids.
That import skips only missing participants. It preserves the original archive,
imports surviving participants once, and never matches missing ids to newly
seeded teams by name. A completed archive containing no surviving teams produces
no attack-ledger rows. Repeated startup remains safe.

The live attack path retains its missing-team error and atomic rollback. This
recovery is confined to historical import; it does not weaken new-attack validation
or erase IndexedDB/localStorage. Fresh-browser tests exercise both `resolution`
and legacy `strike` archives through reload. Unit tests cover all-missing and
mixed participants, idempotent import and live-attack rollback. An additional
regression deletes a real team, recreates the same name with a new id and confirms
that the original ledger/history and surviving GP remain intact while the new
team stays at 5 GP. Browser coverage removes SQLite in an isolated test context
while retaining real archived team ids, then opens and reloads two tabs together;
both must seed exactly five fresh teams without importing stale attack deltas.

## Teams, scores and ranking

Default teams start as Merah, Hijau, Biru, Kuning and Pink. Their names can be
changed; their original colours and identities remain permanent. Default teams
cannot be deleted, including after renaming; all teams can be deactivated manually.
Creating another team with a default colour name remains reserved. A default
team can restore its own original colour name. Blank and duplicate names are rejected. Team creation
starts at 5 GP. Zero GP deactivates a team; automatic Second Chance can restore a
participant after damage. Positive rewards do not undo manual inactivity.

The three locked challenges are Image Decode, Flipping Connect and Jaw of Risk.
Their identities survive compatible renames; controllers reject duplicates,
renaming or deleting built-in challenges. Internal game ids remain
`emoji-decode`, `word-assembly`, `jaws-of-risk`.

At most five teams have one score each per challenge. `rerankChallenge` sorts
raw scores descending with dense ties (`1,2,2,3,4`). The scoreboard displays all
teams alphabetically until five scores exist, counting zero as a recorded score;
it then sorts by rank and displays badges. Removing a score restores name order.

| Rank | CP | GP | Ranked card reward |
| --- | --- | --- | --- |
| 1 | 3 | 3 | 3 |
| 2 | 2 | 2 | 2 |
| 3 | 1 | 1 | 2 |
| 4 | 1 | 1 | Exactly 1 Normal |
| 5 | 1 | 1 | Choose 1 from 3 random cards |

Total standings rank current GP descending, then earned CP descending; identical
GP/CP values share a dense rank and names stabilize exact ties. Leaderboards
include inactive teams marked OUT. Podium ranks active teams and displays the
first three with matching rank artwork and configured prizes. Available inventory
counts exclude consumed/reserved cards and are capped at eight.

Reward synchronization computes `max(0, 5 + earned GP + recorded combat deltas)`.
Score corrections preserve card/attack transactions. Opening, assignment, attack
and card source keys prevent repeat entries. `assignmentGP` and `revealApplied`
prevent reveal effects from being applied again with damage. Team balances and
ledger rows commit together. There is no arbitrary direct-GP edit screen.

### Shared team palette

`src/styles/team-colors.css`, imported by `src/main.tsx`, owns the five exact team
hex values. Team pills, reward-name fills and tactical headings consume these
variables instead of screen-specific approximations. Timer and Flipping Connect
use persisted `Team.colour` identities to select the same palette. Startup adds
the nullable colour column to compatible saved databases and backfills original
colour names once. Seeding matches by permanent colour before display name, so
renamed teams are reused without duplicating teams or losing scores/cards/GP.
Renaming flushes SQLite before notifying other tabs; both scoreboard views
refresh joined team names when `TEAMS_CHANGED` arrives. Active turns retain
their identity color and use outlines/Your Turn markers. Row fills remain light tints.

| Tim | Warna |
| --- | --- |
| Merah | `#ff2424` |
| Biru | `#43b3ff` |
| Kuning | `#ffd039` |
| Hijau | `#5aff7d` |
| Pink | `#ff1585` |

## Card pool and ranked rewards

`src/data/card-pool.ts` defines 60 new-deck copies across 12 designs:

| Rarity | Copies per design | Total |
| --- | --- | --- |
| Normal | Heal 11, Shield 11, Thief 11 | 33 |
| Rare | Heal 4, Protect 4, Thief 4, Fortune Draw 4 | 16 |
| Epic | Reverse 3, Thief 3, Swallow 2 | 8 |
| Legendary | Gardian Unity 2, Second Chance 1 | 3 |

### Random reward odds

These are percentages per ranked reward slot, in Normal/Rare/Epic/Legendary order.

| Rank | Challenge 1 | Challenge 2 | Challenge 3 |
| --- | --- | --- | --- |
| 1 | 57/40/0/3 | 52/45/0/3 | 51/38/8/3 |
| 2 | 59/40/0/1 | 54/45/0/1 | 49/50/0/1 |
| 3 | 90/10/0/0 | 85/15/0/0 | 80/20/0/0 |
| 4 | 100/0/0/0 | 100/0/0/0 | 100/0/0/0 |
| 5 | Blind draw below | Blind draw below | Blind draw below |

For ranks 1–4 rarity rolls, Rare eligibility is ranks 1–3 and Epic eligibility is rank 1 in Challenge 3. Rank 5 samples eligible cards of any rarity.
Legendary odds are 3% for rank 1 and 1% for rank 2. Built-in ids determine the
phase; numbered custom challenge names map to phases 1–3, otherwise phase 1.

Drawing requires five entries and commits physical reservations and the draw
marker atomically. A rolled-rarity shortage rolls back the draw without consuming
copies or changing the odds. Each card keeps its ChallengePoint recipient.
Assignment/replacement checks recipient, design uniqueness and capacity. Rank 4
cannot receive a second Normal ranked reward or a higher rarity; replacing an
older card cannot bypass its quota. Unassignable rewards wait rather than becoming
duplicate available designs. Deleting a custom challenge releases its inventory.

### Rank 5 blind draw

`blindRewards.ts` saves an offer under `rank5:<challengeId>:<teamId>` with three
random physical cards of any rarity. Their designs differ and
exclude owned available designs. Shuffle order is saved before display. Reserved
copies are excluded from ordinary automatic/manual allocation.

`RewardClaimPublicView.tsx` displays all three faces to the admin. Only admin
buttons can settle the offer; public buttons are disabled and the click handler
also checks `admin`, busy state and an existing selection before calling
`chooseRankFiveReward`. The public view opens only the chosen card.

Admin hover and keyboard focus write `{ challengeId, teamId, optionId }` to
`guard-the-heart-reward-pointer`. Public storage listeners match the current
challenge and offered option before rendering a hand-pointer SVG. The pointer
changes only presentation; it never changes GP, inventory or option order.
Leaving an option, blurring it, changing the admin challenge or unmounting the
admin view removes the message. Clicking clears it before awaiting settlement.
A saved selection suppresses the public pointer, including after reload.

Both views use `cursor: pointer` before selection. Once the offer has a selected
id, every option receives `is-locked`, remains disabled, and uses
`cursor: not-allowed`, including its image descendants. The chosen option retains
its `is-open` outline without a persistent hand cursor. Reduced-motion preferences
disable the card-opening animation.

`rewards.css` retains the original left-positioned card groups with fixed gaps;
card art uses contain fit. Rank badges use positive in-row offsets and fit within
the colored row backgrounds. A concrete `.reward-public` wrapper uses
`min(100vw, 177.777778dvh)` so the whole 16:9 artwork fits short screens; the
inner stage has bounded overflow. Team labels, earned-card areas and GP tracks occupy
separate columns. The public challenge name is a read-only badge; the admin
challenge selector publishes the chosen reward screen.

Any chosen card creates exactly one TeamCard. Old saved False Hope offers remain readable, but new rank 5 offers contain three real cards. The choice and grant commit in one
transaction. Unchosen physical copies return to the pool. Repeated selection is
rejected; reload never rerolls. Physical rarity and existing rewards are rechecked
before granting. A granted card follows ordinary Tactical Phase availability
in the current challenge; the next-challenge restriction applies to Fortune gifts.
Existing unfinished drawn rounds can receive a missing offer; completed rounds are
unchanged. Collection/deck shortages are reported.

## Tactical Phase, Card Reveal and GigaRisk

A team selects up to two available active cards by click or drag/drop, or explicitly
skips. Available cards can originate in any challenge. Second Chance cannot be
selected and uses no slot. Thief targets are opposing teams; Normal/Rare require
one, Epic accepts one or two different opponents. Protect always covers its owner
and the chosen target. Ownership and targets are retained through drag/drop.

Selection and retargeting change no GP. Card Reveal validates targets, commits
reveal-time effects exactly once, sets `cardsRevealed` and locks card/target
selections. Returning to the Tactical screen does not unlock an applied reveal.
A pending Fortune choice can still be confirmed before attacking.

| Card | Card Reveal | After GigaRisk damage |
| --- | --- | --- |
| Normal Heal | +2 GP | Normal damage |
| Rare Heal | +3 GP | Normal damage |
| Normal Thief | Take up to 1 GP from one opponent | Normal damage |
| Rare Thief | Take up to 2 GP from one opponent | Normal damage |
| Epic Thief | Take up to 2 GP per chosen opponent, one or two targets | Normal damage |
| Epic Reverse | Take up to 1 GP from each opponent | Normal damage |
| Normal Shield | No GP change | Lose 1 GP instead of 2 |
| Rare Protect | No GP change | Owner and chosen team avoid damage |
| Epic Swallow | No GP change | Avoid damage and gain 4 GP |
| Gardian Unity | Each active participant gains 1 GP | All participants avoid damage |
| Second Chance | Passive; no manual selection | Restore 1 GP if zero, once globally |
| Fortune Draw | Confirm a saved offered reward for a later challenge | Never activates the reward in this challenge |

Reverse/Thief transfers use available GP and cannot make a target negative.
Reveal resolves transfers before Heal/Unity bonuses, in saved team/card order.
Damage applies −2 GP with defenses, then evaluates automatic Second Chance.
Swallow retains its bonus alongside protection. New snapshots carry
`effectTimingVersion: 4` and `revealApplied`; damage reuses the reveal snapshot.
Stale owned-card lists cannot reuse a consumed Second Chance in another challenge.

Attacks lock per challenge, refresh saved balances and commit GP history before
publishing the archive. A completed round cannot attack again. Consumed records
stay for history and are filtered out of future inventory/counts. GigaRisk shows
waiting before the attack and saved final GP/outcomes afterward. The aligned
four-column rows show team, final GP, a numeric boom badge (−1 Shield, 0
Protect/Unity, −2 ordinary damage, +4 Swallow), and card effects. Badge tooltips
retain defense labels; saved attack calculations are unchanged. GP uses fixed
icon/number/unit tracks and right-aligned tabular digits across rows.

### Fortune Draw offers and display modes

| Challenge | Base offer |
| --- | --- |
| 1 and 2 | 2 Normal + 1 Rare; choose 1 of 3 |
| 3 | 2 Normal + 1 Rare + 1 Epic; choose 1 of 4 |

Existing rank eligibility applies: ranks 2–3 in Challenge 3 do not receive the
Epic slot; ranks 4–5 receive eligible Normal options. Offers contain distinct
actions across rarities and exclude Fortune Draw itself and owned designs.
Shortages show fewer valid options instead of repeated effects.

Admin always shows all option faces, rarity labels and names. The per-offer
**Public view: closed cards** checkbox defaults to checked and persists in
`FortuneChoice.publicClosed`. Uncheck to show all faces publicly; check to show
backs for unchosen cards. The selected card stays open in either mode. Toggle
changes synchronize with the public display and survive reload; they do not
reroll options, change the selection, alter GP or create another reward.

Admin or public can choose exactly one saved option. The choice is final and
locks the option buttons. Settlement rechecks physical availability, source
ownership/consumption, rarity eligibility, unique design and capacity, then
atomically creates its TeamCard. `rewardId` prevents duplicate grants across
reload/reveal/attack. The gift is marked Available next challenge and excluded
from current selections and normal ranked-reward quotas. Offers preview copies;
another operation taking a copy can cause a clear availability error. Completed
imports never grant again. Old duplicate offers are repaired in pending admin
views; saved historical GP is retained.

### Card presentation

Card Reveal retains equal-height card art and target captions. Effect-specific
animations support reduced-motion preferences. The rotating log identifies the
current effect and uses per-card saved `cardEffects` where available. Hover/focus
pins a card and replays/previews affected GP; leaving, blur or Escape restores
saved balances. Hover never saves or applies effects. Unknown historical amounts
fall back to action names rather than fabricated GP changes. Triggered passives
appear in history; untriggered Second Chance remains available.

## Game behavior

### English interface and host scoring (2026-10-24 WIB)

All three challenges have **Right Answer (+10)** and **Wrong Answer (-10)** host controls. These add or deduct raw challenge score. Every score change recalculates raw-score ranks and the CP/GP rewards of all teams in that challenge, including teams whose own raw score did not change. Combat GP transactions remain intact. **Claim Rewards** grants cards once using the current rank. Image Decode supports host verdicts during a team run; A right answer in Flipping Connect also unlocks a 20-second matching bonus after a 5-second preview; each matched pair earns +5 raw score, while mismatches and timeout deduct nothing. Automatic question grading still accepts the saved answer and its English equivalent.

In Challenge 3, choose the answering team. A right answer adds 10 and assigns a different active opponent selected under **Opponent to press**. A wrong answer deducts 10 and assigns the answering team itself. The assigned team must press at least two teeth before another answer can be recorded. A bite on the first press does not waive the second press: wait for the mouth to reopen and press again. A bite deducts 5 more from that team's raw score; a safe press has no extra penalty. Pending assignments and completed verdicts persist in SQLite, with idempotent answer ids, saved press counts, and transactional per-press bite settlement to prevent duplicate penalties after reload. Only the admin can score or press; the public display mirrors scores and assignments.

The interface uses **Turn Order**, **Shuffle Order**, **Your Turn**, **GigaRisk Attack** and **GP Transactions**. Navigation, controls, statuses, accessible labels and saved effect descriptions display English. Live English overlays cover source-language presentation and Turn Order headings while retaining the supplied artwork. Saved team names, database ids and source-asset filenames remain unchanged.

### Image Decode

Image Decode has 11 banking clues. Its current solo and team question screens have 15-second deadlines. Team runs
select up to five participants and randomize initial order through roulette.

- Self: +10 correct, −10 wrong/expired.
- Passed question: recipient +10 if correct or −10 if wrong/expired; giver unchanged.
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

After a bite and another recorded answer, the next press is accepted as soon as the 4.44-second deadline
expires, even if the reset callback was throttled in a background window. Focus
and visibility changes also catch up expired rounds. The animation uses an
optimized WebP with the same 111 frames and duration; playback no longer loads
the much larger source GIF on each attempt.


The Jaw of Risk game display has no overlaid challenge-title label or game logo.
Its public instruction reads “Watch closely. The dragon may bite”.

The routed game has fourteen teeth, host answer scoring and no question timer. `CROCODILE_TEETH` is 14 and `CROCODILE_BITE_MS` is 4440, matching
the supplied GIF. Safe teeth remain pressed until the bite finishes, then a
new round retains the configured biting teeth, or chooses a different single
tooth in random mode. Optional `bitingTeeth` preserves admin selections; older
rounds with only `bitingTooth` continue in random mode. `configureCrocodileTeeth`
validates at least one distinct index in 0–13 and resets the mouth on Apply.
The settings are outside the public stage and only rendered for admin. Applying
changes and returning to random mode are disabled during the bite animation. Round storage includes the last
press timestamp so both windows briefly render the same press hand.

Only admin can activate teeth. Public buttons are disabled and input handlers
also guard their controlling role. `useCrocodileHover` publishes normalized
1920 x 1080 pointer coordinates and the hovered tooth over a challenge-specific
BroadcastChannel, falling back to storage events. A newly connected display
requests the current pointer. Leaving the tooth/window or unmounting the admin
clears the remote hand and highlight; public pointer events do not publish.

The source assets in `public/ui/jaw-of-risk/` provide the proportional background,
fourteen full/pressed tooth pairs, left/right hands and all four MP3 cues. Sounds
play only in the controlling window. Small MP3s and the optimized bite WebP are precached. The original 63 MB GIF
is retained only as source material and excluded from the precache. The twenty retained
Jaw questions are reference-bank content only.

### Flipping Connect

A **Right Answer (+10)** unlocks **20 seconds** of matching after a **5-second preview**. Each unique matched pair earns **+5 raw score**. A wrong answer deducts 10 and does not unlock a bonus. Mismatches and timeouts deduct nothing. Admin
and public displays share the saved `matchingDeadline`. At zero, **Time's up!**
replaces the countdown and cards lock; the game logic rejects late flips too.
The same team's button cannot restart its timer. Selecting a different team
reshuffles the board, clears matches and ends the previous bonus; another Right Answer is required to unlock matching.
Reload preserves remaining time or the expired lock. Finishing all pairs before
time runs out keeps the completion state. Matching adds +5 per unique pair during the active bonus; duplicate submissions and reloads cannot award the same pair twice.

The board shows **Card opened** during the 5-second all-card preview, then
**Card closed** when the preview ends and the cards close. A newly matched
pair shows **Match!**; a mismatched pair shows **Mismatch!**. These bold status
messages appear beside the cards on admin and public screens, without intercepting
clicks. Closing and match/mismatch feedback clears after 1.2 seconds or the next first flip;
a fresh team preview replaces it with Card opened. Reloading restores board progress
without replaying old match/mismatch messages. Feedback itself changes no scores; a matched pair adds +5 and recalculates rank rewards.

The routed game is matching-only: twenty cards, ten pairs, host verdict scoring without a question bank,
and a 20-second matching bonus after the 5-second preview, unlocked by a Right Answer. Only team runs are available. Play immediately opens or reuses the public matching board, and starting a run publishes the game as the current display so a previous public feature cannot replace it. The admin clicks a
participating team name above the board to select whose turn it is;
`manualTeamSelection` prevents automatic rotation. After the initial all-card
preview, both unmatched cards remain visible for 600 ms, then close automatically;
matched pairs remain visible. The shared `matchingCloseDeadline` persists this short display across reload.
Legacy long delays are capped at 600 ms; `useRunCountdown` displays the all-card preview. A selected team's matched pairs are identified on the shared
board. All ten pairs complete the activity on admin and public screens; it does
not automatically open reward screens; each +5 bonus updates CP/GP by raw-score rank. Live GP lookup includes inactive teams
so an existing participant keeps its name and balance after deactivation. Waiting
boards use the active roster; selecting new participants still excludes inactive
teams. Starting a run awaits display publication and reports popup failures
without publishing an incomplete run. Legacy saved matching runs ignore old
question-game turn deadlines. When the admin opens an older untimed run, it
requires a new Right Answer to unlock scoring; later reloads keep the saved bonus deadline.

Turn Order stores team ids under `guard-the-heart-turn-order`. `turnOrder.ts`
provides read/publish/subscribe and shared ordering; `useTurnOrder` updates mounted
views through same-window events and cross-tab storage notifications. Shuffle
changes the numbered order; reset restores Kuning, Merah, Biru, Pink, Hijau.
Both actions publish the resulting first team's id as active, placing Your Turn
to its right while preserving the standalone timer's countdown state.
Timer and Flipping Connect use this order left to right, filtering to their own
rosters. Unlisted teams follow in default colour/name order. Rendering reordered
panels does not mutate a matching run's participant indices; shuffle and reset
explicitly select the first team in the resulting order.

Clicking an admin Turn Order team selects Your Turn without changing its position.
The selected id is shared through `EventTimer.activeTeamId`; `useActiveTeam`
subscribes Flipping Connect to it. Timer and Flipping team buttons update the same
selection. A new matching run uses that team when it participates, otherwise
publishes its first participant as active. `MatchingOnlyView` synchronizes an
eligible external selection using `selectMatchingTeam`, waiting until preview
and pending mismatch displays finish before resetting the board and deadlines.
Public controls are disabled and writes are guarded. Selection changes preserve
the standalone timer's duration, remaining time, label and deadline.

## Views, references and synchronization

See the complete [route table](./readme.md#routes-and-public-displays).
`publicDisplay.ts` supports scoreboard, leaderboard, heart-of-awareness, podium,
rewards, tactical, card-reveal, turn-order, gigarisk, timer, presentation,
flipping-connect and jaws-of-risk. Presentation maps to `/`; the last two stages map to `/play/word-assembly/:challengeId` and
`/play/jaws-of-risk/:challengeId`. Global routes have no challenge suffix.
Feature navigation opens or reuses a separate public window; existing public
pages refresh saved database state before following the published transition.
Play awaits successful publication before leaving the challenge list, preserving
popup errors and retry controls. Starting Flipping Connect republishes its stage
before sharing the run. The saved stage also restores the correct feature after
a public reload instead of replaying an earlier scoreboard/leaderboard command.

| Screen | Visual reference |
| --- | --- |
| Turn Order | Visual Guide slide 1 |
| Scoreboard | Visual Guide slide 4 layout and `Page_Score_Board.jpeg` GP footer |
| GigaRisk Attack | Visual Guide slide 8 |
| Leaderboard | Restored Visual Guide slide 9, 16:9 seven-column live table without CP labels |
| Heart of Awareness | `heart-of-awareness-no-gp.png`, derived from `Heart_of_Awareness.png`, full 16:9 canvas and five live GP plaques |
| Podium | `podium-no-gp.png`, based on Visual Guide slide 10, plus live rank and GP icons |
| Tactical Phase / Card Reveal | `tactical-slide-05-reference.png` / `tactical-slide-06-reference.png` |
| Flipping board | `flipping-slide-03-reference.png` and matching card faces |

The Visual Guide is `public/ui/Visual_Guide_App-Game_5.pptx`; extracted slide
assets are used as backgrounds with dynamic HTML values. Admin feature navigation
opens the associated public screen; separate public-view buttons are removed.
Rewards and Tactical Phase actions publish their selected challenge while
preserving tactical choices and reveal state. Timer and Turn Order each use an
independent named window, so other feature changes leave both visible and the
timer running. `publicWindowKind` separates projector, timer and turn-order
window names/presence; public navigation listeners accept only their own kind.
Admin reload reuses existing windows, and closing a window permits reopening it.
Podium supports three prize amounts
stored locally and mirrored publicly. GP ledger is admin-only.
Scoreboard uses `Page_Score_Board.jpeg` and overlays a five-column GP strip below
the ranking box. Names, team colours and live GP come from active Team records;
participating teams appear first. Admin/public scoreboard share this component.

`HeartAwarenessView.tsx` shares `useTeams` and its team/GP transaction refresh
events. Admin/public routes are `/admin/heart-of-awareness` and
`/heart-of-awareness`; public display commands support the new stage. Each
canvas contains five active teams, ordered green/red/yellow/blue/pink, followed
by custom teams. Names and GP replace reference samples inside the original
plaques. Shared `GPShield` (also used by `GPMark`) renders the supplied
`gp-shield.png` across every screen with a GP shield. Rewards and Tactical/Card
Reveal no longer draw SVG shields. Heart of Awareness and podium backgrounds
have embedded icons removed so their shields use the same live image asset. Additional teams use subsequent canvases; empty slots use a dash.
Artwork remains complete at 16:9 on desktop and mobile.

Podium value overlays scale typography by name/GP/prize length and remain within
the reference plaques. Long names have ellipsis/tooltips. `podium-no-gp.png`
retains the black jilbab and removes fixed medals, GP icons and prize placeholder text.
Every occupied slot renders its entire `Icon-Rank_<rank>.png` using the actual
GP/CP rank; ties therefore share both the number and the medal colour. Badge
frames sit above the name plaques, and numeric/prize typography stays within
the illustrated panels. Prize inputs use three columns and stack on narrow screens.
Name and GP overlays are transparent; text sits directly on the original plaque
surfaces without adding rectangular backgrounds over the frames.

Card Reveal uses aligned grid rows for header, caption, proportional card art,
status, effects and GP. Effect text wraps; excessive content scrolls within the
effects area. Waiting/status labels use centered single-line type sized to stay
inside their badge at desktop, tablet and phone widths; layout tests check both
horizontal and vertical text containment.
Card Reveal reserves matching caption space in every card slot, keeping targeted and non-targeted images proportional and aligned. Tactical and ranking card backs use contain fit.
Leaderboard includes pending assignment effects before damage and uses live
available TeamCard counts for Sisa Kartu, including teams without scored entries.
Long team pills truncate with an ellipsis, and admin headings/toolbars wrap.
Flipping team labels also truncate within their buttons. Leaderboard effect
lists scroll within a bounded container so long descriptions do not enlarge rows.
Challenge artwork scales to viewport width; admin toolbars stay outside
artwork. Shared layout supports narrow and wide screens. Team labels follow the
team's colour identity; medal artwork follows the actual rank. `index.css`/`layout.css` supply the app theme;
reference, tactical, flipping, rewards and podium styles handle each screen.
`GPShield.tsx` and `gp-shield.css` own the common decorative GP mark; each
screen supplies only its placement and dimensions.

Admin team cards use a separate `.team-card__status` group. Below 680 pixels,
badges occupy their own row and the three action buttons share equal columns.
Tactical Phase uses a native, keyboard-accessible `details`/`summary` panel for
card timing and targeting rules, keeping the challenge controls close to the
page heading. Challenge team-selection labels have a minimum 44-pixel click
area, contained text, selected-state colour and visible keyboard focus, including
Flipping Connect. Shared spacing, borders and focus styling live in `layout.css`.

### Main Presentation and standalone timer

`/` is the main public presentation; `/presentation` redirects there.
`/admin/presentation` controls six supplied images and a seventh live Image Decode
Scoreboard slide immediately after Image Decode — Cara Bermain. Slides synchronize
with the shared projector and survive reload. Previous/Next, selector, thumbnails,
keyboard navigation and fullscreen preview are supported. The scoreboard switches
from alphabetical names to rank badges once all five scores are recorded.

The independent `/admin/timer` controls `/timer`. Its 16:9 runtime artwork is
`public/ui/presentation-timer-clean.png`, based on `presentation-timer-no-banner.png`; it displays countdown, challenge and
active team with a Your Turn marker. Duration is 1–5999 seconds, default 900.
Absolute deadlines survive navigation/reload, with pause/reset support. Timer
notifications remain isolated from other public-feature navigation.

`EventTimerDisplay` receives `admin` from `EventTimerView`. Admin team names are
native buttons with `aria-pressed`; public names remain display-only spans. Click
or keyboard activation publishes a fresh `readEventTimer()` snapshot with only
`activeTeamId` replaced. Duration, remaining time, label and deadline are retained.
The dropdown, active-team highlight and Your Turn marker synchronize across tabs,
Turn Order and Flipping Connect. Team panels follow the saved Turn Order order
from left to right and update on shuffle/reset without changing timer deadlines.

## Validation record

Latest challenge/reward verification on **2026-10-24 (WIB)**: **281 unit/database tests** passed across 26 files. All **74 browser scenarios** were verified across the complete run and focused follow-ups; two expectations using the old rewards were corrected. Final focused checks passed 16 unit/database tests and 6 browser scenarios. Coverage includes +5 per matching pair, preview/20-second boundaries, mismatch/timeout without penalties, minimum two tooth presses, rank changes affecting other teams, saved-game migration, and choosing any of three random rank 5 cards. TypeScript, production/PWA build, ESLint and Markdown checks passed.

Historical verification below records earlier versions; the current rules above supersede earlier matching durations and reward rules.

Previous English/scoring verification (superseded scoring rules) on **2026-10-24 (WIB)**: **279 unit/database
tests** passed across 26 files. All **74 browser scenarios** were verified across
the full run and targeted follow-ups. The full run passed 72 scenarios; the two
remaining language/inventory fixtures were corrected and passed on rerun.
Tests cover raw score changes without CP/GP adjustments, reward freezing across
rank changes and reload, explicit finalization, opponent/self press assignments,
safe presses, once-only bite penalties, persistence, offline use and layouts.
Production/PWA build, TypeScript, ESLint and Markdown checks passed; translated
presentation and reference-heading overlays received visual inspection.

Full pre-push verification on **2026-10-23 (WIB)**:

| Check | Result |
| --- | --- |
| Complete unit/database suite | 274 tests passed across 25 files |
| Complete browser suite | 71 tests passed, no failures or skips (`npx playwright test --workers=2`) |
| TypeScript and production/PWA build | Passed through Playwright's fresh build-and-preview workflow |
| ESLint | Passed (`npm run lint`) |
| Markdown | Both tracked Markdown files checked for balanced fences, local links and anchors |

Coverage includes all three public window kinds; order changes without active-turn
resets; Your Turn synchronization from Turn Order to Timer and Flipping Connect;
queued team changes during preview; Card opened/Card closed timing; matching expiry
and reload; selectable biting teeth; repeated/offline WebP playback; score/card
rules; startup recovery; and responsive admin/public layouts. Unit tests used
`npm test -- --maxWorkers=2 --testTimeout=15000`. Dated records below are historical.

Previous public-order/response checks on **2026-10-22 (WIB)**: all 274 unit tests
passed, and all 11 affected browser scenarios passed. Coverage includes disabled
public shuffle/reorder controls, continued admin synchronization, repeated bites,
the first press after reopening, multi-tooth settings and offline WebP playback.
The optimized animation preserves 111 frames, 1280×720 dimensions and 4440 ms
duration while reducing the file from 63,096,657 to 12,250,668 bytes. Production/PWA
build, TypeScript, ESLint and Markdown links/anchors/fences passed. The complete
browser suite was not rerun for this change.


Previous timer/teeth verification on **2026-10-22 (WIB)**: 273 unit/database tests
passed across 25 files. All 18 affected browser scenarios passed across
`timed-matching-and-teeth`, `flipping-card`, `crocodile` and `challenge-flow`.
These cover the exact 15-second boundary, expired reload, same-team lock,
new-team preview/reset, preserved GP, multi-tooth bites, retained configuration,
random fallback, public read-only controls, cursors, sounds and game flow.
The complete browser suite was not rerun for this change; the earlier full-suite
record remains below. Production/PWA build, TypeScript, ESLint and Markdown
fences/local links/anchors passed.


Previous verification on **2026-10-22 (WIB)** covers permanent team colours,
editable team names, the existing team-label/podium changes, and Flipping Connect
feedback. Both repository Markdown files reflect the current behavior and schema.

| Check | Result |
| --- | --- |
| Unit/database suite | 271 tests passed across 25 files |
| Browser coverage | All 65 scenarios verified: 63 passed in the full run; the remaining 2 passed after correcting a panel selector and waiting for fixture startup |
| TypeScript and production/PWA build | Passed (`npm run build`) |
| ESLint | Passed |
| Markdown fences, local links and anchors | Passed in both files |

Unit verification used `npx vitest run --maxWorkers=2 --testTimeout=15000` to
avoid contention-related timeouts. Browser tests used the production preview on
a fresh loopback port with three workers; the final two fixture/selector checks
ran with one worker. The Flipping Connect test covers all three bold feedback
messages on admin/public displays, dismissal, no replay after reload, and bounds
at desktop, tablet and phone sizes. Team tests cover renaming, live scoreboard
refresh, permanent backgrounds, GP/cards/scores, repeated reload and migration.

Earlier dated results below are retained as historical records.

Team palette follow-up on **2026-10-21 (WIB)**: all 12 targeted browser scenarios
passed. Exact computed colors were checked on admin/public labels, including
reordered reward ranks, timer active turns and Flipping Connect. ESLint, TypeScript
and the production/PWA build passed. The full-suite baseline below was not rerun
for this presentation change.

Reward Claim frame follow-up on **2026-10-21 (WIB)**: all 11 targeted browser
scenarios passed. Route checks cover admin/public pages at 1366×600, 1280×800,
768×800 and 390×844; public canvases must fit both viewport axes. Populated reward
rows are checked through 1920 pixels, including medals, cards, GP, choice captions
and the mirrored hand cursor. Both reward outcomes passed a final cursor-bound
recheck. ESLint, TypeScript and production/PWA builds passed. These are targeted
UI checks; the full-suite baseline below was not rerun for this CSS change.

Timer team-selection follow-up on **2026-10-21 (WIB)**: all 4 timer browser
scenarios passed, including click/keyboard selection, dropdown/public synchronization
and unchanged running deadlines. ESLint, TypeScript and production/PWA build passed.
The full-suite results below remain the baseline; this UI change used targeted checks.

Historical full verification on **2026-10-20 (WIB)**:

| Check | Result |
| --- | --- |
| ESLint and TypeScript | Passed |
| Complete unit/database suite | 264 tests passed across 24 files |
| Complete browser suite | 60 scenarios passed, with no skips, failures or flaky results |
| Production/PWA build | Passed through Playwright's build-and-preview workflow |
| Markdown | Local links, anchors and fenced blocks checked |

Startup regression coverage includes missing archived team ids, mixed existing and
missing participants, idempotent imports, real team deletion followed by a new
team with the same name, strict live-attack rollback, both completed `resolution`
and legacy `strike` archives, SQLite recreation with localStorage retained, and
two tabs opening/reloading together. Recovery must preserve original history and
valid balances without attaching old GP to replacement teams.

The complete browser run also checks reward selection/cursors, Fortune Draw,
reveal/attack timing, GP persistence, rankings, all three games, presentation,
timer, public-window reuse, offline reload and responsive layouts. That historical
run replaced the earlier 57-scenario baseline and targeted startup follow-up
at that time. These regression cases run as part of the normal
`npm test` and `npm run test:e2e` suites.

Run application checks from the repository root:

```sh
npm run typecheck
npm run lint
npm test
npm run test:e2e -- --workers=2
npm run build
```

Playwright builds production assets before starting its preview server. Chromium
is required (`npx playwright install chromium`); custom installations can use
`PLAYWRIGHT_BROWSERS_PATH`. Tests use isolated browser contexts and saved fixtures.
Coverage includes game rules, CRUD, rankings, deck migration/rarities, blind draws,
reveal timing, passive revival, cross-tab navigation, layout, timers and offline
reload. Passing these checks covers the implemented scenarios, not every possible
device or simultaneous administrative edit.


### Shared live GP panels and Flipping timing (2026-10-22 WIB)

Timer, Scoreboard and Reward Claim use `TeamGPBadge` with the shared brown/orange
frame, exact team colour, GP shield and aligned numeric balance. `TeamPill` is
shared separately; styles live in `src/styles/team-gp.css`. Reward Claim shows
**current team GP**, including later card effects and damage, and labels the
challenge bonus separately as **Reward +N GP**. Cards retain their left alignment.
Timer and Flipping Connect leave a visible gap above the Your Turn marker.
The empty scoreboard message “No entries for this challenge yet.” is removed.

Flipping Connect shows both unmatched cards for 600 ms on admin and public views,
then closes them automatically.
Matched pairs remain visible; closing a mismatch does not rotate teams or award
points. Legacy saved unmatched pairs close within 600 ms when resumed.

Regression coverage includes `tests/matching-close.test.ts`,
`e2e/team-panels.spec.ts` and the Flipping, timer, palette and frame-bound tests.

Validation: ESLint and TypeScript passed; all 266 unit tests passed. The full
63-scenario browser suite and targeted reruns cover the updated panels,
countdown, reward selection, game flows and responsive admin/public layouts.


### Tactical target assignment placement (2026-10-22 WIB)

Thief and Protect target controls now appear inside the card owner's team panel,
below Owned cards and Selected cards. Each selected targeted card has its own
labeled section. Protect always includes its owner; Epic Thief retains two
opponent slots with duplicate targets disabled. Incoming effects remain beside
the target team's selection. Click and drag-and-drop assignment, reveal locking,
GP timing and public Card Reveal behavior are preserved. Fortune Draw choices
remain in their separate offer area. Target sections adapt to narrow screens.
`e2e/tactical-assignment.spec.ts` checks ownership, click/drop assignment,
reloading, locked targets and panel bounds at 1366, 768 and 390 pixels.

Validation: ESLint and TypeScript passed. All 5 targeted browser scenarios
passed across Tactical Phase, click/drop targeting, upgraded cards and Fortune
Draw, including the responsive target-panel assertions.


### Flipping Connect initial preview (2026-10-22 WIB)

Starting a new team run reveals all 20 shuffled cards on admin and public views
for 5 seconds, with a shared visible countdown. Card clicks and team changes are
locked during this memorization preview. The cards then close automatically and
normal matching begins. The preview is presentation-only: it creates no matches,
points or mismatches. `matchingPreviewDeadline` persists the absolute end time,
so reload and late public viewers retain only the time remaining. Existing runs
without that field continue normally. Both unmatched cards show for 600 ms before closing; matching pairs stay open. A new run starts a fresh preview; End run cancels it.

Validation: ESLint, TypeScript and all 267 unit tests passed. All 9 Flipping
Connect and challenge-flow browser scenarios passed, including preview timing,
reload during preview, automatic closing and subsequent matching.


### Mismatch display and closing (2026-10-22 WIB)

The initial all-card preview still lasts 5 seconds. During matching, selecting a
second card with a different picture shows both faces for 600 ms, then closes
both automatically, with no mismatch countdown. Matching pairs stay open, including
after later mismatches and reload. Manual team selection, scoring and GP remain
unchanged. Legacy saves with a pending mismatch are closed within 600 ms.

Validation: ESLint, TypeScript and all 268 unit tests passed. All 9 Flipping
Connect and challenge-flow browser scenarios passed, including brief mismatch display and automatic
closing, persistent matches, reload and the initial 5-second preview.


### Team-change preview and visible mismatches (2026-10-22 WIB)

Changing to a different active team starts a fresh 5-second all-card preview on
admin and public screens. The board is reshuffled and all previous matches and
board progress are cleared before this preview. Afterward all cards close and
the new team begins matching. GP and recorded scores are preserved.
Clicking the already active team does not restart the preview. Preview deadlines
survive reload without granting extra time.

During matching, both mismatched faces are visibly shown together for 600 ms,
then close automatically. Card clicks and team changes are blocked during this
short display. `matchingCloseDeadline` persists the short delay; old longer
pending delays are capped at 600 ms on resume. No mismatch countdown is shown.

Validation: all 269 unit tests and 9 Flipping Connect/challenge-flow browser
scenarios passed, including visible mismatch pairs, preview on team changes,
matched pairs within a turn and reload during the repeated preview.


### Fresh randomized board on team changes (2026-10-22 WIB)

Choosing a different team creates a newly shuffled 20-card board with zero
matched pairs and no partial flips. Every card opens for the 5-second preview,
then all cards close for the new team's matching attempt. Clicking the same team
does not reset its board. Team changes also work after all ten pairs are matched.
The randomized layout and preview deadline persist across admin/public reload.

Within that team's attempt, matching pairs stay open. Both mismatched faces show
for 600 ms and then close automatically. Switching teams resets only the matching
board and its progress; team GP and recorded scores are preserved. Repeated
random output still produces a changed layout through a one-position rotation.

Validation: ESLint, TypeScript and all 271 unit tests passed. All 9 Flipping
Connect/challenge-flow browser scenarios passed, including reshuffling, clearing
old matches, reload during preview and switching teams after board completion.


### TypeScript configuration cleanup (2026-10-22 WIB)

`tsconfig.app.json` omits the unused `baseUrl` and empty `paths` settings.
Application imports use relative paths or package names, while browser shims
remain configured in Vite. Removing the unnecessary option resolves the editor's
`baseUrl` deprecation diagnostic without adding `ignoreDeprecations`.


### Flipping Connect header spacing (2026-10-22 WIB)

The team row sits higher above the card frame. The Your Turn marker has a visible
gap below its team panel and clearance above the frame. The preview countdown
sits above the team row with its own gap. The old turn marker embedded in the
reference artwork is covered so only the live marker appears. Team panel size, colors and card
positions remain consistent. Admin/public spacing is checked at desktop, tablet
and phone widths in the existing Flipping Connect browser scenario.

Validation: ESLint passed. All 6 Flipping Connect browser scenarios passed,
with a final targeted visual recheck of the cleaned header backing and spacing
on both admin/public views at 1366, 768 and 390 pixels.
