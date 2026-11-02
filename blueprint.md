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
Jaw of Risk uses `public/ui/jaw-of-risk/gilgamesh-jaw.png`, generated from the current Gilgamesh design. A matching `gilgamesh-bite.png` frame animates the jaw snapping shut for 4.44 seconds, with reduced-motion support. Existing tooth sprites and hand cursors keep their hit geometry.

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
component and its timer hook are gone; matching runs remain active with a brief preview and no response deadline.

`public/` contains current characters/icons, active card faces, image clues,
matching art, gameplay backgrounds, sounds and the downloadable Image Decode
PPTX. Unused source decks, duplicate screenshots, old character images, old
video, unused matching variants and reference fonts were removed. The unused
standalone deck generator and source-import/GIF-conversion scripts were removed;
question JSON remain canonical application inputs. The old dragon jaw and bite WebP have been removed.

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

- Image Decode: 69 workbook clues, +10 correct and -10 wrong. A shared 15-second
  reminder leaves scoring and answer controls open. Turn Order selects the active team.
- Matching Cards: 71 workbook quiz questions. Select an option, then grade it.
  A correct answer adds 10 and unlocks a fresh board; Show cards starts the
  five-second preview, followed by unlimited matching time. Each unique
  pair adds 5. Wrong answers deduct 10 without unlocking a board. Team changes
  end the current bonus and reshuffle.
- Jaw of Risk: a right answer assigns a selected opponent and adds 10; a wrong
  answer deducts 10 and assigns self. Two safe presses finish a turn; a bite ends it immediately, deducts
  another 5 and deactivates the pressing team across the event. Pending presses survive reload.
  The host selects an option and clicks Grade this question, then configures biting teeth; both screens can press unlocked teeth. A shared gameplay lock serializes presses, and database press counts prevent duplicate penalties.

Matching preview deadlines are absolute and saved; there is no response deadline. Mismatches briefly
show both faces before automatic closing. A background public window catches up
to the saved preview state. The active team synchronizes through Turn Order,
the shared active-team state and matching panels. Test synchronization waits for a completed scored
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

Main Presentation uses native scenes; scoreboards/rewards/tactical/matching
retain only their active runtime backgrounds. Team, rank, GP, card and prize
fields remain live. Podium uses a clean arena, CSS plinths and current character
cutouts. All public canvases fit both viewport axes; admin controls wrap for phones.

`publicDisplay.ts` routes host commands through a shared projector. Turn Order has a separate named window. The standalone Timer UI is removed;
legacy timer URLs redirect. Challenge reminder timers start only on Timer click. Admin reload
reuses existing windows; closed windows can reopen. Public views cannot invoke
admin scoring or change host turns/configuration.

The PWA precaches runtime art, current characters, audio and the current Gilgamesh jaw artwork. The retained 30 MB Image Decode PPTX is an online download and is excluded
from precache patterns. Old source decks and the original large bite GIF are no
longer packaged. Offline use requires a successful first online load.

The admin shell is a two-column workspace: compact branding above a sticky grouped navigation sidebar and the active view. Below 680px, navigation becomes a horizontal scrolling row. `src/styles/admin.css` owns these admin-only presentation rules. The Teams view includes live participation counts and expandable GP guidance; CRUD, filters and pagination retain their existing behavior.

## Validation record

Public Matching Cards cards are clickable during the unlocked matching window. Shared gameplay locks serialize card moves across tabs, read the latest saved board and guard against replaced attempts. Both screens close mismatches; host controls remain separate.

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

## Current challenge presentation (2026-10-30)

All active teams join automatically, up to five. Hosts select 1–10 questions;
solo play, manual Right/Wrong buttons and the Presentation navigation item are
removed. Main Presentation routes remain compatible. Image Decode is exposed by
Show public question; its public route is `/play/emoji-decode/:challengeId`.

The normal Matching Cards and Jaw public routes show only Q&A and live scores.
Show cards opens `/play/word-assembly/:challengeId/cards`; Show dragon opens
`/play/jaws-of-risk/:challengeId/dragon`. These board routes omit Q&A and retain
live score strips. Hide returns to Q&A. Switching screens does not reset a board.
Matching previews are deferred until Show cards; repeated shows reuse the deadline.

Workbook option clicks select without scoring. Grade this question persists the
verdict and unlocks the applicable matching/tooth flow. Hover/focus and selected
options mirror through `guard-the-heart-quiz:<challengeId>`. Options use two
columns, A/B left and C/D right. Grading shows a five-second check/cross overlay
with the correct answer. Choosing a Jaw opponent updates the shared active team.

`useDecodeAnswer.ts` publishes Image Decode drafts after a 300 ms typing pause to
`guard-the-heart-decode-answer:<challengeId>`. Local events and storage events
synchronize the host and public views. Payloads identify the run, question,
originating turn and answering team. PublicQuestionView rejects stale scopes and
uses the matching text in its Answer panel. Draft writes do not mutate SQLite or
shared run state, so they cannot overwrite scores or advance questions. Empty
input clears the public answer. Image Decode grading still advances immediately;
the workbook verdict overlay applies to Challenges 2 and 3 only.

Reward and matching art uses theme-specific SVGs in `public/cards/branded/`.
Regenerate with `python scripts/generate-branded-cards.py`. Native question and
board layouts use the shared theme, with compact public score strips.

### Targeted validation on 2026-10-30 (WIB)

- Production/PWA build passed through the fresh browser build-and-preview run.
- TypeScript check passed after the final draft payload validation change.
- Two Image Decode browser regressions passed: typing, clearing, public reload,
  question advancement, passed-opponent text and active-team changes.
- Both tracked Markdown files passed local-link and balanced-code-fence checks;
  `git diff --check` passed.
- The full browser suite was not rerun for this draft-sync change. Older workbook
  scenarios that expect option clicks to score need the explicit Grade action.

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

### Branded card collection refresh

The native SVG generator supplies all 50 reward, matching, and card-back assets
in light and dark themes. Cards use foil-style frames, dragon-scale textures,
rarity gems, and a clear rules panel. Rarity borders and reduced-motion-aware
hover/focus states reinforce the collection in live play. The 45 superseded
PNG faces, matching reference crops, and matching slide have been removed;
active question-bank data and educational clue images remain in use.

### Editable question banks

Question Bank at `/admin/questions` provides persistent question CRUD. Image
Decode owns a separate 69-question bank; Matching Cards and Jaw of Risk share the
140 existing multiple-choice questions. A one-time SQLite migration combines the
legacy banks while preserving question IDs and source content. Question rows
store their explanations, and startup no longer overwrites edits or resurrects
deletions. Same-origin database events refresh the question cache in open views.
