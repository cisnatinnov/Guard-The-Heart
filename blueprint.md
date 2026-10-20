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
  the Jaw of Risk bite GIF has a runtime cache. Browser shims stay in the vendor
  chunk alongside their CommonJS dependencies.
- Public and admin routes have different controls; no authentication is implemented.

## Database schema

Nine models use `createdAt` and `updatedAt` timestamps. Most ids are UUIDs;
GameQuestion and BlindReward use stable seeded/composite ids. Model definitions
and associations live in `src/models/index.ts`.

| Table | Fields excluding timestamps | Purpose |
| --- | --- | --- |
| `challenge` | `id`, `name`, nullable `cards_drawn_at` | Unique name and once-only draw marker |
| `team` | `id`, `name`, `status`, `total_gp` | Unique name, active/inactive status, initial 5 GP |
| `challenge_point` | `id`, `challenge`, `team`, `rank`, `score`, `challenge_point`, `guard_power` | Unique challenge/team; raw score, dense rank, earned CP/GP |
| `scoreboard` | `id`, `team`, `rank`, `total_cp`, `total_card` | Saved standings and available-card totals |
| `card` | `id`, `name`, `type`, `effect`, `effect_action`, `icon`, nullable `challenge`, `team`, `challenge_point` | Finite physical copy and reward reservation |
| `team_card` | `id`, `name`, `type`, `effect`, `effect_action`, `icon`, nullable `team`, `challenge_point` | Awarded inventory and retained card history |
| `blind_reward` | `id`, `challenge`, `team`, `options`, nullable `selected`, `reward_id` | Saved rank 5 offer, JSON options, one final selection |
| `game_question` | `id`, `game_key`, `number`, `prompt`, `answer`, `options`, `kind`, `hint` | Seeded reference questions; unique game key/number |
| `gp_transaction` | `id`, nullable `team`, `team_name`, nullable `challenge`, `challenge_name`, `source_key`, `category`, `gp_before`, `delta`, `gp_after`, `description` | Persistent GP ledger; unique source keys prevent duplicate writes |

Card types are Normal/Rare/Epic/Legendary. Card effects are
Defense/Attack/Heal/Utility/Support/Thief. False Hope is a blind-draw result,
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
| Other localStorage keys | Main presentation selection, turn order, game runs, window presence, podium prizes |

Keep IndexedDB and localStorage together when preserving an event. Clearing one
store cannot reconstruct the other. Data does not sync between devices/profiles.

## Teams, scores and ranking

Default teams are Merah, Hijau, Biru, Kuning and Pink. Names are reserved and
cannot be changed/deleted; all teams can be deactivated manually. Team creation
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
| 1 | 10 | 3 | 3 |
| 2 | 8 | 2 | 2 |
| 3 | 6 | 2 | 2 |
| 4 | 4 | 1 | Exactly 1 Normal |
| 5 | 2 | 1 | One blind result: 1 Normal or False Hope |

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

Rare eligibility is ranks 1–3. Epic eligibility is rank 1 in Challenge 3.
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

`blindRewards.ts` saves an offer under `rank5:<challengeId>:<teamId>` with two
Normal physical cards and one virtual Zonk option. The Normal designs differ and
exclude owned available designs. Shuffle order is saved before display. Reserved
copies are excluded from ordinary automatic/manual allocation.

Reward Claim displays three backs in both views. Clicking one opens only that
result. A Normal choice creates exactly one TeamCard; False Hope uses
`Zonk_False_Hope Card.png` and creates none. The choice and grant commit in one
transaction. Unchosen physical copies return to the pool. Repeated selection is
rejected; reload never rerolls. Physical rarity and existing rewards are rechecked
before granting. Existing unfinished drawn rounds can receive a missing offer;
completed rounds are unchanged. Collection/deck shortages are reported.

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
`publicDisplay.ts` supports scoreboard, leaderboard, heart-of-awareness, podium,
rewards, tactical, card-reveal, turn-order, gigarisk, timer, flipping-connect and
jaws-of-risk. The
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
| Leaderboard | Restored Visual Guide slide 9, 16:9 seven-column live table without CP labels |
| Heart of Awareness | `heart-of-awareness-no-gp.png`, derived from `Heart_of_Awareness.png`, full 16:9 canvas and five live GP plaques |
| Podium | `podium-no-gp.png`, based on Visual Guide slide 10, plus live rank and GP icons |
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

The independent `/admin/timer` controls `/timer`. Its 16:9 artwork comes from
`public/ui/presentation-timer-no-banner.png`; it displays countdown, challenge and
active team with a Giliran marker. Duration is 1–5999 seconds, default 900.
Absolute deadlines survive navigation/reload, with pause/reset support. Timer
notifications remain isolated from other public-feature navigation.

## Validation record

Verified on **2026-10-20 (WIB)**: **260 unit/database tests across 23 files** and
**57 browser scenarios** passed. The browser run had no skipped or flaky scenarios.
ESLint, TypeScript, production/PWA compilation, Markdown links and code fences
passed their checks. The full audit includes admin face-up Fortune options, both
public display modes, exact available rarity mixes, live synchronization, reload,
one-time choices, rank 5 results, passive revival and the current responsive routes.

The subsequent GigaRisk alignment update passed card-effects, shared GP-icon and
admin/public route-layout checks (5 tests). Mixed 1–3 digit GP values preserve
icon, number-slot and unit positions at 390, 768, 1280 and 1920 pixels. The route
audit covers presentation, rankings, rewards, tactical/reveal, games and timers
at 390, 768 and 1280 pixels.
ESLint, TypeScript and the production/PWA build passed again. The earlier full
feature audit remains the baseline for unchanged game logic.

Run from the repository root:

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
