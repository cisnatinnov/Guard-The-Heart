# Guard The Heart

Guard The Heart is an offline-first challenge tracker for teams. Record team
scores, calculate challenge and overall rankings, award guard power and bonus
cards. It also ships three playable challenges, saved as locked challenge data and played
from the **Challenge** view, all of which have downloadable reference PowerPoint decks.

The app is a client-side Progressive Web App (PWA). It runs in the browser and
does not require a server or remote database.

## Getting started

### Requirements

- Node.js supported by Vite 7 (Node.js 20.19+ or 22.12+)
- npm

### Install and run

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. The database is initialized in the browser
when the app starts.

### Common commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run build` | Type-check and create the production PWA in `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | Run the TypeScript project check |
| `npm run lint` | Run ESLint |
| `npm test` | Run the Vitest unit tests |
| `npm run test:e2e` | Build, then run the Playwright end-to-end tests |
| `npm run decks` | Regenerate the Image Decode PPTX deck |
| `npm run icons` | Regenerate the PWA icon set |

## Using the app

1. Add and manage teams on the **Team** view. Teams start with 5 guard power
   (GP) and can be activated or deactivated. Filter by name and status, and
   choose 5, 10, 20, 25, 50, or 100 teams per page.
2. Use the **Challenge** view. It lists the three built-in challenges, each with
   its **Scoreboard**, **Play** and deck links. Challenges cannot be added,
   renamed or deleted.
3. Play a question-based challenge with teams using **Team run**. Choose up to
   five teams.
   Roulette selects the first team. On each turn, it can answer itself (+10
   correct, −10 wrong) or pass the question to an opponent. On a pass, a correct
   opponent answer gives that opponent +5 and the passing team −10; a wrong
   opponent answer gives both teams −5. Self-answer misses pass the same
   question to the next team. Each team's
   score is saved directly to the challenge scoreboard. A correct answer opens
   the next question automatically. A wrong answer or timer expiry keeps the
   same question open and moves the turn to the next eligible team. Each new
   turn starts with **Answer yourself** selected.
4. Alternatively, open a challenge's scoreboard in **Scoreboard (Adm)** and enter one
   score per participating team manually with **Add entry**.
5. Correct a score with **Edit CP**. The team stays in the challenge and its
   rank, challenge points and guard power are recalculated from the new value,
   so a corrected score never has to be deleted and re-entered. **Cancel**
   leaves the score untouched, and switching challenge abandons an in-progress
   correction.
6. Rankings and guard power rewards are recalculated from scores.
7. When all five teams have joined a challenge, use **Scoreboard (Adm)** to draw
   its bonus cards via **Claim Rewards** (or the existing **Draw Bonus Cards** control). Each challenge can be drawn only
   once; its cards are assigned at random to eligible teams within their reward
   quotas. Teams at the 8-card limit keep their current cards; those rewards
   remain in the pool.
8. Use **Card Reveal (Adm)** to view team collections. The random assignment
   button is available for any unassigned cards already waiting in the pool.
9. Download the offline PowerPoint deck from a challenge row or from its
    playing screen.

### Public and Adm pages

Each major view has separate **Public** and **Adm** pages:

| View | Public | Adm |
| --- | --- | --- |
| Scoreboard per challenge | Read-only ranking of the selected challenge, for display | Choose Challenge, Add entry, Edit CP, Delete |
| Leaderboard | Read-only team standings, for display | (Auto-recalculates on changes) |
| Reward Claim | `/rewards/:challengeId` shows earned card counts and GP | `/admin/rewards/:challengeId` has **Rewards** to open card reveal on both screens |
| Card Reveal | `/cards/:challengeId` shows cards earned in that challenge | `/admin/cards/:challengeId` mirrors the reveal; `/admin/cards` retains collection management |
| Main presentation | `/` displays slides 1–7 from `public/ui/Guard The Heart_Main PPT.pptx` | **Public** opens slide 1 in a new tab and shows synchronized slide controls |

Admin pages use the admin navigation. Public pages use separate routes and follow the host’s scoreboard and reward transitions in the same browser profile.
On the admin presentation page, **Previous** and **Next** advance both the admin preview and open public display. Slides 1–3 and 5–7 use supplied deck artwork; slide 4 reproduces the reward table from the deck.

## Challenges

The **Challenge** view is the only challenge screen. Each built-in row opens
its own game with a rules list, score counters and a restart button. Team-run
turn order is randomized when a run starts, and the current answering team is
highlighted in the turn table. Admin controls team runs and the matching Public
game page mirrors the live run as a read-only display. Jaw of Risk is
question-only and has no tooth board or tooth selection.

| Challenge | Contents | Scoring |
| --- | --- | --- |
| Image Decode | 11 banking-term clues from slides 3–24 of the reference deck, with a live 15 second countdown in solo and team play | +10 correct, −10 wrong or timed out, 110 max |
| Flipping Card | Ten picture pairs from 20 cards; each matched pair unlocks one of 21 multiple-choice questions from slides 3–44. Match a pair before each question; each answering team has two attempts. Boards refresh after ten pairs. | +10 correct, −10 after two wrong answers, no mismatch penalty (210 max before penalties) |
| Jaw of Risk | Solo and team runs use the 20 stored questions from slides 3–42 of the Jaw of Risk reference, in sequence. No tooth board or tooth selection. | +10 correct, −10 wrong |

The admin solo game screens use the supplied art direction: Image Decode uses the question
panel styling from `public/ui/Image_Decode.pptx` and the matching clue images
from slides 3–24 under `public/image-decode/questions/`,
Flipping Card uses the hidden/revealed card artwork from
`public/ui/Preview-CH-3_Online_Card-Hidden.png` and
`public/ui/Preview-CH-3_Online_Card-Reveal.png` (cropped into lightweight
faces under `public/match-card/reference/`), and Jaw of Risk follows the orange question/answer frame from `public/ui/Jaw-of-risk.pptx`. Flipping Card keeps
the two-at-a-time reveal, mismatch turn-back, and two-answer-attempt flow; the
matched image stays beside its unlocked question.

### The challenges are challenge data

All three are saved as rows in the `challenge` table, so they are present from
the first launch:

- They cannot be added, renamed or deleted. The view has no **Add challenge**
  form, marks each row `Built-in`, and the controller refuses those operations.
  Their names stay reserved so a row can never be created with one of them.
- Each row offers **Scoreboard**, **Play**, and a deck link when one exists.
  Every challenge offers **Team run**, which lets the host run the challenge
  question by question with up to five teams; one team answers at a time. A
  correct answer advances automatically. An unsuccessful turn moves the same
  question to the next eligible team; Flipping Card allows two attempts before
  a turn is unsuccessful, while the other games allow one. If every team is unsuccessful,
  the run advances automatically. Team-run timers are
  15 seconds per question for Image Decode, Flipping Card, and Jaw of Risk.
  Flipping Card matching turns remain 20 seconds. When a timer expires, only the team
  currently answering is graded incorrect and the turn moves to the next
  eligible team for the same question.
- A built-in challenge accepts up to 5 teams like any other, so ranks and guard
  power are calculated from scores entered either by hand or via the team run.
  Team-run answer/pass scoring is shared by Image Decode, Flipping Card and Jaw of
  Risk. Challenge scores can fall below zero after penalties.

Older databases are migrated on startup: rows saved as **Emoji Decode** and
**Word Assembly** are renamed to **Image Decode** and **Flipping Card**, and the
retired **Gardimon Protocol**, **Incident Trail** and **Save the Core**
challenges are deleted together with their entries, and their drawn cards go
back to the pool.

### Views and navigation

There is no separate games tab. The challenges are rows on the **Challenge**
view, and the playing screen is a detail view reached only from a built-in row's
**Play** button; its **← All challenges** button is the way back. **Team run**
is a panel within each challenge; it lets the host run the challenge with
teams. Views are otherwise reached from the top navigation tabs.

### PowerPoint deck

The reference decks are supplied in `public/ui/`. Startup seeds the Image Decode
clues from slides 3–24, the 21 Flipping Card questions from slides 3–44, and the
20 Jaw of Risk questions from its own deck, slides 3–42 into SQLite's
`game_question` table. Prompts, answer options, correct answers and clue hints
are loaded from those database rows by the game screens. The three reference
decks, including the Jaw of Risk visual reference, are downloadable from their
game screens and excluded from service-worker precaching because of their size.
`npm run decks` can still generate the
separate Image Decode presentation from `src/data/emoji-decode.json`.

### Ranking and rewards

Ranks use standard competition ranking: tied scores share a rank and the following
rank increments by 1 (for example, `1, 2, 2, 3, 4`).

| Rank | Cards earned | GP earned |
| --- | ---: | ---: |
| 1 | 3 | 3 |
| 2 | 2 | 2 |
| 3 | 2 | 2 |
| 4 | 1 | 1 |
| 5 | 0 | 1 |

The leaderboard aggregates challenge scores and challenge points per team.
Total cards are capped at 8. Team GP is the starting 5 plus GP earned across
challenges.

### Correcting a score

Each row on the per-challenge scoreboard (Adm) has **Edit CP** alongside
**Delete**. Editing updates the entry in place, so the team keeps its place in
the challenge. Ranks and guard power are recalculated from the corrected score,
which also reshuffles the other teams' ranks and the leaderboard. The team is
pinned while editing, because a correction applies to the team that already has
the entry.

### Bonus cards

The card pool has 80 cards stored permanently in the database: 48 Normal,
24 Rare, 6 Epic, and 2 Legendary. They are copies of the 11 card designs in
`public/cards/` (Normal Heal/Shield/Thief x16, Rare Heal/Protect/Reverse/Thief
x6, Epic Reflect/Reverse x3, Legendary Gardian Unity/Second Chance x1), and each
card is displayed with its artwork image. Each card has an effect category and
an `effect_action` description matching the artwork.

Once all five teams have an entry, the host can **Draw Bonus Cards** on the
Scoreboard (Adm) page. This draws up to three cards per eligible team based on
the rank at the moment of the draw (Rank 1: 3 cards, Rank 2: 2, Rank 3: 2, Rank 4: 1, Rank 5: 0).
A challenge can be drawn only once: the draw is recorded on the challenge
(`cards_drawn_at`) and a second draw is refused. Drawn cards are saved to the
challenge pool (with challenge reference but no team) permanently; later score
corrections or removed entries do not redraw or return them.

The draw automatically assigns distinct cards within team quotas; the admin can also use **Card Reveal (Adm)** to assign waiting cards via
drag-and-drop or click-to-assign (click a card to select it, then click a team
to assign). Each team can hold a maximum of 8 cards. If a team is at capacity,
the admin chooses which existing card to replace. Assigned cards are linked to
the team's ChallengePoint entry and mirrored once in the team's permanent
`team_card` collection. The **Card Reveal (Public)** page shows cards earned
in the selected challenge.

## Data and offline behavior

Sequelize models manage the app data, including the persisted game question and
answer bank, using SQLite compiled to WebAssembly by
`sql.js`. The SQLite database runs in memory while the app is open and is saved
to the browser's IndexedDB after changes. It is local to the browser profile
and device; it is not synchronized to other users or devices. Clearing browser
site data may delete the saved database.

Scoreboards, leaderboard, teams and card reveal listen for database-change
events. Within the same browser profile, those events and the active team-run
state are shared live across tabs and windows through `BroadcastChannel` with a
`localStorage` fallback. The active run is stored separately from SQLite and is
keyed by challenge, so an admin's **Start team run** action updates an already-open
Public View for Image Decode, Flipping Card, or Jaw of Risk in a new browser tab.
The tab opens as a regular tab without popup sizing.
**End run** is available only to admin and ends the shared run on both views,
returning the Public View to its waiting state.

On startup the app syncs the schema, migrates renamed and retired challenges,
seeds the built-in challenge rows (`src/services/challengeSeeds.ts`), seeds the
card pool, and marks challenges whose cards were drawn by older builds. Seeding
matches on the challenge name, so restarting never duplicates a row and never
disturbs an existing scoreboard.

The production build uses Workbox to cache the app's static files for offline
use. The service worker updates automatically when a new build is available.
Run `npm run build` and deploy the contents of `dist/` to host the PWA.

## Project structure

```text
src/
  controllers/  UI-facing operations over the models
  db/           sql.js engine, persistence, and database initialization
  hooks/        React hooks for database, teams, and challenges
  models/       Sequelize model definitions
  services/     Ranking, scoreboard aggregation, card drawing, challenge seeding
  services/games/  Rules, content, and shared active-run synchronization
  styles/       Shared responsive theme and component styles
  views/        App shell and feature screens
  views/challenges/  The game screens and their shared playing frame
  data/         Card pool and JSON content shared by the app and the PPTX generator
public/         PWA icons, guardian illustrations, card artwork, and game decks
scripts/        Icon and PowerPoint deck generators
blueprint.md    Detailed data model and product rules
```

## Interface and character assets

The shared app header uses `public/Logo_Game-5.png` for the app logo and displays `public/gardian-male.png`,
`public/gardimon.png`, `public/gardian-female.png`, and the Giga Risk dragon
artwork from `public/gigarisk-portrait.jpg`. Character framing, light/dark theme
tokens, and the card layouts are styled in `src/styles/index.css`. Card Reveal
shows drawn cards in a Reward Claim board, and Team Cards shows each team's
collection in a Card Reveal board; both render the card artwork from
`public/cards/`.

For the full schema, constraints, and product rules, see
[blueprint.md](./blueprint.md).


## Challenge completion and synchronized rewards

Team runs finish after all 11 Image Decode, 21 Flipping Card, or 20 Jaw of Risk
questions are resolved. A correct answer resolves the question; wrong answers
and Image Decode/Flipping Card timeouts continue the existing next-team attempt
flow until the question is resolved or every participating team has tried it.
The final resolved question automatically saves every participating team's
score (including zero), then opens `/admin/scoreboard/:challengeId` for the host
and updates `/scoreboard/:challengeId` in public pages that are already open. Early **End run** still
cancels the active run and leaves the public question screen waiting.

Solo screens also open the scoreboard after all eleven Image Decode answers
or timeouts, twenty-one Flipping Card pair questions, or twenty Jaw of Risk questions
are graded. Solo scores continue to require manual entry because solo play has
no selected team. Solo and team Flipping Card runs use all 21 reference questions in slide order.
Each board contains at most ten pairs and refreshes when its pairs are used.

On the admin scoreboard, **Claim Rewards** opens
`/admin/rewards/:challengeId` and sends the public display to
`/rewards/:challengeId`. For a five-team challenge it draws and randomly assigns
rewards once if they have not been drawn. Revisiting does not redraw. Runs with
fewer than five participants still show earned rank rewards; the existing
five-team requirement for drawing remains in force. **Rewards** on the admin
reward-count screen opens `/admin/cards/:challengeId` and updates an already-open
public display at `/cards/:challengeId`. `/admin/cards` remains the collection and
assignment management screen. Cards shown on the reveal belong to that
challenge through their ChallengePoint link.

Navigation is synchronized through same-origin `localStorage` events between
windows in the same browser profile. SQLite is flushed before publishing each
transition, and the public window refreshes its saved database before opening
the requested view. Direct links remain usable. Public controls do not move
the admin window. Score correction, rank/GP calculations, collection capacity,
and the once-only reward draw retain their existing rules.

A team cannot receive the same card design and rarity twice across challenges,
even when the inventory names have different copy numbers. Automatic assignment,
manual assignment, and replacement enforce this rule. A startup repair replaces
older duplicate designs while retaining earned card counts and challenge links,
preferring the same rarity where inventory permits. Teams remain capped at eight
cards; unassignable rewards wait in the pool.

Admin and public scoreboards use the artwork from slide 9 of
`Guard The Heart_Main PPT.pptx` (`public/ui/scoreboard-slide9.png`), with live
challenge names, ranks and points. Admin editing controls sit below the board.
Public leaderboards use `Page_Leaderboard.jpeg`; the leaderboard has no total-score column. Shared public
Q&A uses the orange question/answer frame. Reward counts and card reveals use
backgrounds extracted from slides 11 and 12 of `Guard The Heart_Main PPT.pptx`.
`src/styles/layout.css` and `src/styles/rewards.css` maintain spacing and proportions.

Validation: `npm test` covers game rules, database/controller flows and duplicate
card protection. `npm run test:e2e -- --workers=1` covers completion of each
challenge, Image Decode's final timeout, two-window reward navigation, once-only
claiming, unique five-team rewards, score correction, leaderboard and reload,
plus synchronized presentation navigation through slide 7.
`npm run lint` and `npm run build` check source and production output.

## Reference content maintenance

`python scripts/import-reference-questions.py` imports the supplied decks into
`src/data/reference-question-bank.json`: 11 Image Decode pairs (slides 3–24),
21 Flipping Card pairs (slides 3–44), and 20 Jaw of Risk pairs (slides 3–42).
Startup upserts these 52 rows and removes obsolete out-of-range seeded rows.
Image Decode question 11 uses the answer **Lapor**, exactly as slide 24; its
clue is KDO. Question and answer slide numbers are retained as source metadata.
For multiple-choice slides, letters follow their visual positions (A/B left,
C/D right), and the answer slide's red outline identifies the correct choice.
The shared question presentation preserves the arena, frame, logo, clue art,
letter positions and Image Decode word-count hints. Admin inputs remain outside
that presentation so public screens display only the live question.

Flipping Card retains roulette: the start draw establishes a random team order,
and each new matching turn follows that order. A pair must be matched before
its question is shown. The matcher commits to self-answering or a recipient;
each answering team then gets two attempts within 15 seconds. The first wrong
attempt keeps the same deadline and has no score penalty. Matching timeout
rotates the matching turn; answering timeout consumes the remaining attempts.
The roulette, pair states, recipient, attempts and countdown deadline are
shared with the public display. All 21 questions are used in solo and team play.

Internal game ids remain `emoji-decode`, `word-assembly` and `jaws-of-risk` for
saved-data compatibility. Old Match Card and Flipping Connect titles migrate
to Flipping Card, and Jaws of Risk migrates to Jaw of Risk.

Image Decode team turns also store their 15-second deadline in the shared run,
so reloading the public display preserves the host countdown.

Portrait layouts stack the Q&A header, clue and answer panels with readable
text; wide displays preserve the reference slide proportions. Browser checks
include a 390-pixel viewport and shared Image Decode countdown after reload.

### Flipping Card question handoff

After a correct answer, the next question starts on the matching board and
stays hidden until another pair is matched. After two incorrect attempts or
an answering timeout, another eligible team answers the same unlocked question.
The question remains open until a team answers correctly or every participating
team has exhausted its answering turn (all five in a five-team run). Giving a
question does not count as answering it: the giver remains eligible to answer
later in the same roulette order. Existing pass-score penalties still apply.
After all teams fail, the next question also starts with matching. The roulette
order, two attempts per answering team, 15-second question timers, scoring, other games,
and scoreboard/reward transitions retain their existing behavior.

### Opening public displays

Starting a team run opens its public game route in a new browser tab, without
popup sizing. The admin scoreboard's Reward Claim (Public) and Reveal Cards
(Public) links also open their display routes in new tabs. If a public page is
already open in the same browser profile, it follows team-run updates and the
host's completion and reward transitions. The Admin **Public** link opens the
main presentation at slide 1 in a new tab and moves the admin view to its
presentation controller. **Previous** and **Next** synchronize slides 1–7
between the controller preview and public display.
