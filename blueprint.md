# Fight the Dragon — implementation blueprint

This document describes the current implementation. Operational instructions,
routes and commands are in [readme.md](./readme.md).

## Architecture

- React 19 and TypeScript 5.9; Vite 7 builds the offline PWA.
- Sequelize 6 uses SQLite through sql.js/WASM and browser shims.
- IndexedDB stores SQLite bytes; localStorage stores presentation/game state.
- Local database events, BroadcastChannel and storage events refresh views.
- Mutation locks, queued exports and explicit flushes protect cross-tab writes.
- Admin and public routes have separate controls; no authentication is implemented.

## Branding, theme and assets

The product is Fight the Dragon and the opponent is Gilgamesh. Visible saved
labels normalize old dragon spellings through `englishText`; storage keys,
`/gigarisk` routes, archived fields and internal combat names remain compatible.

`src/data/characters.ts` defines Dragon Warden, Spark and Storm Ranger.
`GameCharacters.tsx` shares the cast across presentation and podium scenes.
The current opponent asset is `public/characters/gilgamesh.png`, used in the
admin portrait, presentation introduction, attack scene and attack board.
Generation prompts are in [public/characters/prompts.json](./public/characters/prompts.json).
Jaw of Risk retains its specialized playable mouth, tooth, hand and bite assets.

`theme.css` loads after shared styles and defines the cast palette: navy/cobalt
armor, silver surfaces, violet cloth, cyan crystals and restrained gold trim.
Admin navigation is dark with light text; reading surfaces use dark text on
silver-white. Semantic error/success colors and permanent team identities remain
separate. Keyboard focus remains visible. Existing screen art is subdued without
filtering card faces or team label colors.

Main Presentation uses six native scenes and one live scoreboard. `MAIN_SLIDES`
stores scene titles rather than hidden image filenames. `MainEnglishCopy`
renders the current characters, goals, GP rules and Image Decode instructions.
No old slide-image layer is fetched behind an opaque scene. `mainPresentation.ts`
persists selection; public and admin thumbnails share the scene renderer.

The asset audit removed 64 unused files (about 271 MiB) and five retired source
modules/scripts. CSS cleanup removed 332 obsolete rules and 101 declarations
superseded unconditionally by later rules. Dynamic class prefixes and dynamic
card/tooth/hand filenames were retained. Vendor shims remain because Vite aliases
resolve Sequelize's CommonJS dependencies to them. The retired solo matching
component and its timer hook are gone; timed matching runs remain active.

`public/` contains current characters/icons, active card faces, image clues,
matching art, gameplay backgrounds, sounds and the downloadable Image Decode
PPTX. Unused source decks, duplicate screenshots, old character images, old
video, unused matching variants and reference fonts were removed. The unused
standalone deck generator and source-import/GIF-conversion scripts were removed;
question JSON and the optimized runtime WebP remain canonical application inputs.

## Database schema

Models use `createdAt` and `updatedAt`. Most IDs are UUIDs; seeded questions and
blind rewards use stable IDs. Definitions live in `src/models/index.ts`.

| Table | Key fields and role |
| --- | --- |
| `challenge` | `id`, `name`, `cards_drawn_at`: once-only card draw marker |
| `team` | `id`, `name`, `colour`, `status`, `total_gp`: permanent color and live GP |
| `challenge_point` | `challenge`, `team`, `score`, `raw_score_only`, `rank`, `challenge_point`, `guard_power`: raw score and ranked rewards |
| `challenge_answer` | Answer ID, challenge/team, verdict, pressing team, settlement, bite flag, press count, matching deadline and awarded pair list |
| `scoreboard` | Team, rank, total CP and total available cards; GP remains on Team |
| `card` | Physical card copy, rarity/effect/action/icon, challenge/team/point reservation |
| `team_card` | Awarded inventory and retained card history |
| `blind_reward` | Saved rank-five options, selected option and reward ID |
| `game_question` | Game key, number, prompt, answer, options, kind and hint |
| `gp_transaction` | Saved team/challenge labels, unique source key, category, GP before/delta/after and description |

Startup synchronizes schema and applies compatibility migrations. Missing raw
scores copy legacy input, answer columns receive defaults, and legacy
`raw_score_only` flags clear on reranking. Default teams, locked challenges,
questions and missing card copies are seeded without replacing saved games.

Reference question JSON is consumed by `gameQuestionSeeds.ts`; source-deck names
in that data are provenance metadata, not runtime dependencies on removed files.
The retained Image Decode download is explicitly referenced by challenge controls.

## Persistence and cross-tab behavior

| Storage | Contents |
| --- | --- |
| IndexedDB `guard-the-heart` / `sqlite` / `database` | SQLite bytes |
| `guard-the-heart-tactical:<challengeId>` | Choices, targets, Fortune offers, reveal flags, assignment and resolution |
| `guard-the-heart-gigarisk-completed:<challengeId>` | Permanent completed attack snapshot |
| `guard-the-heart-cards-drawn:<challengeId>` | Additional once-only draw marker |
| `guard-the-heart-crocodile:<challengeId>` | Jaw state, pressed teeth and reopen deadline |
| `guard-the-heart-presentation-timer-v2` | Duration/deadline, challenge and active team |
| `guard-the-heart-public-display` | Latest projector command |
| `guard-the-heart-reward-pointer` | Transient rank-five option hover/focus |
| Other localStorage keys | Run state, presentation slide, turns, prizes and window presence |

SQLite exports after a debounce; draw, attack and display transitions flush
explicitly. `withDatabaseWriteLock` serializes scored writes. `withDatabaseMutation`
prevents a late storage refresh from replacing SQLite during a scored action.
Exports restore foreign-key enforcement; saved GP transaction source keys prevent
duplicate application. Both browser stores are needed to preserve an event.

`initializeGPTransactions` imports historical resolutions using
`recordGigaRiskGP(..., true)`. Missing archived team IDs are skipped without
matching new teams by name. Surviving participants import once; all-missing
archives remain history without affecting fresh teams. Live attacks retain
missing-team errors and rollback instead of using this import exception.

## Team identity, scores and rewards

Default teams are Merah, Hijau, Biru, Kuning and Pink. Each starts with 5 GP and a
permanent original color. Names and status can change; defaults cannot be deleted.
Custom teams can be created/deleted. Zero GP deactivates a team; Second Chance can
revive after damage. Positive rewards do not undo manual inactivity.

Raw scores range from −999 to 999, with one entry per team and at most five entries
per challenge. `rerankChallenge` assigns dense raw-score ranks and CP/GP rewards.
`recalculateTotalScoreboard` applies reward deltas while retaining combat history.
Every score change reranks every participant, including unchanged raw scores.

| Rank | CP | GP | Cards |
| --- | --- | --- | --- |
| 1 | 3 | 3 | 3 |
| 2 | 2 | 2 | 2 |
| 3 | 1 | 1 | 2 |
| 4 | 1 | 1 | Exactly 1 Normal |
| 5 | 1 | 1 | Choose 1 from 3 random unowned designs |

Standings use current GP, then CP; equal values share a dense rank. Leaderboard
retains inactive teams marked OUT. Podium takes the first three active teams.
Scoreboard stays alphabetical until all five raw scores exist, including zero;
then it displays ranks and medals. Removing a score restores name order.

The physical pool has 60 cards: 33 Normal, 16 Rare, 8 Epic and 3 Legendary.
Ranked draw odds live in `cardDrawRules.ts`; each slot retains its rolled rarity.
Insufficient stock rolls back the draw. Reservations bind rewards to their ranked
recipient. Inventory caps at eight available cards and disallows duplicate designs.

Rank-five offers reserve three distinct unowned physical designs of any rarity,
shuffle once and persist under `rank5:<challenge>:<team>`. Selection grants one
card and returns unchosen copies. Only admin chooses; public mirrors hover and
reveals the chosen face. Old False Hope offers remain readable through retained
compatibility art. Fortune gifts instead become usable next challenge.

## Challenges

`challengeAnswers.ts` persists host verdicts and score changes transactionally,
then reranks, recalculates totals, flushes and broadcasts. Duplicate answer IDs,
matched pairs and press counts cannot apply the same score change twice.

- Image Decode: eleven clues, 15-second question deadlines, +10 correct and −10
  wrong/timeout. Passed questions affect the answering recipient only.
- Flipping Connect: a right answer adds 10 and starts a fresh board with 5 seconds
  of preview and 20 seconds of matching. Each unique pair adds 5 during the active
  attempt. Wrong answers deduct 10 without unlocking a board. Mismatches/timeouts
  have no extra deduction. Team changes end the current bonus and reshuffle.
- Jaw of Risk: a right answer assigns a selected opponent and adds 10; a wrong
  answer deducts 10 and assigns self. Two presses are required; each bite deducts
  another 5 from the pressing team's raw score. Pending presses survive reload.
  Admin alone scores, configures biting teeth and presses; public mirrors state.

Matching preview/attempt deadlines are absolute and saved. Mismatches briefly
show both faces before automatic closing. A background public window catches up
without granting more time. The active team synchronizes through Turn Order,
Timer and matching panels. Test synchronization waits for a completed scored
answer before comparing and reloading a freshly generated board.

## Tactical effects and Gilgamesh Attack

Each team chooses at most two available cards or explicit Skip. Protect/Thief
require valid targets; passive Second Chance cannot be selected. Assignment and
reveal snapshots lock cards/targets once reveal effects are applied.

Heal, Thief, Reverse and Gardian Unity change GP once at Card Reveal. The attack
reuses that snapshot, applying damage and defenses without repeating those
transfers. Protect covers owner/target, Shield reduces damage, Swallow prevents
damage and adds 4, and Second Chance revives once when triggered. Consumed card
IDs leave available inventory but remain played-card history. Untriggered passive
cards remain available later. Fortune choices persist and never alter GP.

Attacks lock per challenge, refresh balances, commit GP transactions and publish
a permanent archive. `TacticalPhaseView.attack` opens `/gigarisk/:challengeId`.
`GilgameshAttackScene` displays the current dragon with a CSS lunge/flame for
6.5 seconds from `resolvedAt`; skip hides only presentation. Reduced-motion
preferences disable movement. Reloading historical results never reapplies damage.

The board has five tracks: team, saved Before GP (`assignmentGP`, falling back to
`initialGP`), saved After GP (`finalGP`), impact and saved card activity. Shield,
Protect and Swallow badges/effect labels are blue; normal damage remains red.
Fixed numeric tracks and tabular digits align different values. Card Reveal
history remains accessible after attack. Read-only hover previews never save GP.

## Views and offline operation

Main Presentation uses native scenes; scoreboards/rewards/tactical/timer/matching
retain only their active runtime backgrounds. Team, rank, GP, card and prize
fields remain live. Podium uses a clean arena, CSS plinths and current character
cutouts. All public canvases fit both viewport axes; admin controls wrap for phones.

`publicDisplay.ts` routes host commands through a shared projector. Timer and
Turn Order have separate named windows and notification channels. Admin reload
reuses existing windows; closed windows can reopen. Public views cannot invoke
admin scoring or change host turns/configuration.

The PWA precaches runtime art, current characters, audio and the optimized bite
WebP. The retained 30 MB Image Decode PPTX is an online download and is excluded
from precache patterns. Old source decks and the original large bite GIF are no
longer packaged. Offline use requires a successful first online load.

## Validation record

Verified on **2026-10-27 (WIB)**:

| Check | Result |
| --- | --- |
| Unit/database suite | 285 passed across 26 files |
| Browser regression coverage | All 75 scenarios verified: 74 passed in the full run; after restoring Kuning's identity tint, all 11 focused checks passed |
| TypeScript and production/PWA build | Passed through the fresh browser build-and-preview workflow |
| ESLint | Passed |
| Static asset references | 49 literal runtime paths checked; no missing assets |
| Markdown | Both tracked files checked for local links, anchors and balanced fences |
| Visual review | Admin header, native slides, new Gilgamesh scene and before/after board reviewed |


```sh
npm run typecheck
npm run lint
npm test
npm run test:e2e -- --workers=2
npm run build
```

Verification covers missing assets after cleanup, text contrast, native scenes,
new Gilgamesh art, all games, card rules, GP history, public windows, offline reload,
and desktop/tablet/phone layouts. Markdown links, anchors and fences are checked.
