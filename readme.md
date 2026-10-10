# Guard The Heart

Guard The Heart is an offline-first challenge tracker for teams. Record team
scores, calculate challenge and overall rankings, award guard power and bonus
cards. It also ships three playable challenges, saved as locked challenge data and played
from the **Challenge** view, one of which is also available as an offline
PowerPoint deck.

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
   its bonus cards via **Draw Bonus Cards**. Each challenge can be drawn only
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
| Card Reveal | Read-only team card collections, updates as cards are assigned | Randomly assign drawn cards to eligible teams; cards wait in the pool when teams are at capacity |

The navigation tabs show both variants explicitly (e.g., "Scoreboard (Public)" and "Scoreboard (Adm)").

## Challenges

The **Challenge** view is the only challenge screen. Each built-in row opens
its own game with a rules list, score counters and a restart button. Team-run
turn order is randomized when a run starts, and the current answering team is
highlighted in the turn table. Admin controls team runs and the matching Public
game page mirrors the live run as a read-only display. Jaws of Risk is
question-only and has no tooth board or tooth selection.

| Challenge | Contents | Scoring |
| --- | --- | --- |
| Image Decode | 11 banking-term clues from slides 3–24 of the reference deck, with a live 30 second countdown in solo and team play | 10 per decoded answer, 110 max |
| Match Card | Ten picture pairs from 20 cards; each matched pair unlocks one of 50 stored multiple-choice questions. Team runs use the shared one-attempt turn flow. | 10 per matched pair, minus 5 per mismatch (100 max) |
| Jaws of Risk | Solo and team runs use the 20 stored questions from slides 3–42 of the Match Card reference, in sequence. No tooth board or tooth selection. | +10 correct, −10 wrong |

The game screens use the supplied art direction: Image Decode uses the question
panel styling from `public/ui/Image_Decode.pptx` and the matching clue images
from slides 3–24 under `public/image-decode/questions/`,
Match Card uses the hidden/revealed card artwork from
`public/ui/Preview-CH-3_Online_Card-Hidden.png` and
`public/ui/Preview-CH-3_Online_Card-Reveal.png` (cropped into lightweight
faces under `public/match-card/reference/`), and Jaws of Risk follows the blue,
gold and purple question styling from `public/ui/Jaw-of-risk.pptx`. Match Card keeps
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
  correct answer advances automatically, while a wrong answer or timeout moves
  the same question to the next eligible team. If every team is unsuccessful,
  the run advances automatically. Team-run timers are
  30 seconds for Image Decode and 15 seconds for Match Card.
  Jaws of Risk has no team-run timer. When a timer expires, only the team
  currently answering is graded incorrect and the turn moves to the next
  eligible team for the same question.
- A built-in challenge accepts up to 5 teams like any other, so ranks and guard
  power are calculated from scores entered either by hand or via the team run.
  Team-run answer/pass scoring is shared by Image Decode, Match Card and Jaws of
  Risk. Challenge scores can fall below zero after penalties.

Older databases are migrated on startup: rows saved as **Emoji Decode** and
**Word Assembly** are renamed to **Image Decode** and **Match Card**, and the
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
clues from slides 3–24, the 50 Match Card questions from slides 3–75, and the
first 20 Match Card questions for Jaws of Risk from slides 3–42 into SQLite's
`game_question` table. Prompts, answer options, correct answers and clue hints
are loaded from those database rows by the game screens. The three reference
decks, including the Jaws of Risk visual reference, are downloadable from their
game screens and excluded from service-worker precaching because of their size.
`npm run decks` can still generate the
separate Image Decode presentation from `src/data/emoji-decode.json`.

### Ranking and rewards

Ranks use standard competition ranking: tied scores share a rank and the following
rank increments by 1 (for example, `1, 2, 2, 3, 4`).

| Rank | Challenge points | GP earned |
| --- | ---: | ---: |
| 1 | 10 | 3 |
| 2 | 8 | 2 |
| 3 | 6 | 2 |
| 4 | 4 | 1 |
| 5 | 2 | 1 |

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

The admin then uses **Card Reveal (Adm)** to assign drawn cards to teams via
drag-and-drop or click-to-assign (click a card to select it, then click a team
to assign). Each team can hold a maximum of 8 cards. If a team is at capacity,
the admin chooses which existing card to replace. Assigned cards are linked to
the team's ChallengePoint entry and mirrored once in the team's permanent
`team_card` collection. The **Card Reveal (Public)** page shows the permanent
collections for display.

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
keyed by challenge, so an admin's **Start team run** action updates the matching
Public View for Image Decode, Match Card, or Jaws of Risk and opens that Public
View in a new window. **End run** is available only to admin and ends the shared
run on both views, returning the Public View to its waiting state.

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
