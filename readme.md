# Guard The Heart

Guard The Heart is an offline-first challenge tracker for teams. Record team
scores, calculate challenge and overall rankings, award guard power and bonus
cards, and view active teams' guard power in the Heart of Awareness tower. It
also ships six playable challenges, saved as locked challenge data and played
from the **Challenge** view, two of which are also available as offline
PowerPoint decks.

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
| `npm run decks` | Regenerate the Emoji Decode and Incident Trail PPTX decks |
| `npm run icons` | Regenerate the PWA icon set |

## Using the app

1. Add and manage teams on the **Team** view. Teams start with 5 guard power
   (GP) and can be activated or deactivated. Filter by name and status, and
   choose 5, 10, 20, 25, 50, or 100 teams per page.
2. Use the **Challenge** view. It lists the six built-in challenges, each with
   its **Scoreboard**, **Play** and deck links. Challenges cannot be added,
   renamed or deleted.
3. Play a question-based challenge with teams using **Team run**. Choose up to
   five teams.
   One team answers at a time in selection order. If its answer is wrong, the
   next team can try the same question. A correct answer or time-up moves to the
   next question; if all teams are wrong, the host can also advance. Each team's
   score is saved directly to the challenge scoreboard. Save the Core uses its
   timed board game instead: play with the four built-in Guardians or choose up
   to five active teams. Pawns start on randomized squares and race to the Core
   for five minutes. If time expires first, the current scores are final. Record
   a board-game result on its challenge scoreboard manually.
4. Alternatively, open a challenge's scoreboard and enter one score per
   participating team manually with **Add entry**.
5. Correct a score with **Edit score**. The team stays in the challenge and its
   rank, challenge points, guard power and bonus cards are recalculated from the
   new value, so a corrected score never has to be deleted and re-entered.
   **Cancel** leaves the score untouched, and switching challenge abandons an
   in-progress correction.
6. Rankings and challenge rewards are recalculated from scores.
7. When the fifth team joins a challenge, the app calculates final ranks and
   automatically awards bonus cards to eligible teams. Use **Card Draw** to
   review the challenge's card results.
8. Review team card collections, the overall scoreboard, and the **Heart of
   Awareness** tower from their respective views.
9. Download the offline PowerPoint decks from a challenge row or from its
   playing screen.

## Challenges

The **Challenge** view is the only challenge screen. Each built-in row opens
its own game with a rules list, score counters and a restart button. Game state
lives in the browser tab only; it is not written to the database.

| Challenge | Contents | Scoring |
| --- | --- | --- |
| Emoji Decode | 15 questions that each combine **four emoji** into one answer, with a live 30 second countdown in solo and team play, plus a PPTX deck where every slide carries a built-in animated timer and auto-advances | 10 per decoded answer, 150 max |
| Gardimon Protocol | Temporarily unavailable; opens a **Work in progress** page | — |
| Word Assembly | Ten picture-matching questions using 20 cards (two identical copies of each image); mismatched open cards turn face down after a short reveal | 10 per matched pair, minus 5 per mismatch (100 max) |
| Incident Trail | Temporarily unavailable; opens a **Work in progress** page | — |
| Jaws of Risk | Team runs use 24 teeth; the solo game below uses 8 teeth in two rows, with 6 loose | 10 per loose tooth found, minus 5 per false alarm (60 max) |
| Save the Core | Five-minute race across 24 playable chessboard squares to the Core; only path squares are shown, with no dedicated start tile. Use four built-in Guardians or select up to five active teams, with randomized starting squares | Randomised score on each safe tile (once), bomb returns a pawn to its randomized starting square, 50-point Core bonus; scores are final when time expires |

### The challenges are challenge data

All six are saved as rows in the `challenge` table, so they are present from the
first launch:

- They cannot be added, renamed or deleted. The view has no **Add challenge**
  form, marks each row `Built-in`, and the controller refuses those operations.
  Their names stay reserved so a row can never be created with one of them.
- Each row offers **Scoreboard**, **Play**, and a deck link when one exists.
  Available question-based challenges offer **Team run**, which lets the host
  run the challenge question by question with up to five teams; one team answers
  at a time, and a wrong answer lets the next team try the same question. A
  correct answer or timeout advances to the next question; if every team is
  wrong, the host can advance. Gardimon Protocol and Incident Trail are
  temporarily hidden behind a **Work in progress** page. Each team's score is
  written to the scoreboard as it is earned. Team-run timers are 30 seconds for
  Emoji Decode and 15 seconds for Word Assembly. Jaws of Risk has no team-run
  timer. When a timer expires, only the team currently answering is graded
  incorrect and the host can advance to the next question.
  Save the Core instead uses a timed chessboard game with built-in pawns or up
  to five selected teams.
- A built-in challenge accepts up to 5 teams like any other, so ranks, guard
  power and bonus cards are calculated from scores entered either by hand or
  via the team run.

### Views and navigation

There is no separate games tab. The six challenges are rows on the **Challenge**
view, and the playing screen is a detail view reached only from a built-in row's
**Play** button; its **← All challenges** button is the way back. **Team run**
is a panel within the question-based challenges; it lets the host run the
challenge with teams. One team answers at a time in selection order; a wrong
answer hands the same question to the next team. A correct answer or timeout
ends the question, and the host advances to the next question. Save the Core
uses its board game's team selection instead. Views are otherwise reached from
the top navigation only.

### PowerPoint decks

Two challenges also ship as offline PowerPoint decks:

- `public/decks/emoji-decode.pptx` — title slide, 15 question slides and an
  answer key. Each question slide shows the four emoji that combine into one
  answer, animates a 30 second timer bar, and advances automatically.
- `public/decks/incident-trail.pptx` — title slide, the 5 crime scenes, the
  clue tray, all 25 information pieces with their answer sheets, and a
  scoring summary.

Both decks are generated from the shared JSON content, not hand-authored. Run
`npm run decks` to rebuild them after editing `src/data/emoji-decode.json` or
`src/data/incident-trail.json`. The generator writes the ZIP and OOXML parts
itself, so there is no PowerPoint dependency, and it verifies the archive and
every XML part before writing. The decks are precached by the service worker and
can be downloaded from a challenge row or from its playing screen.

### Ranking and rewards

Ranks use competition ranking: tied scores share a rank and the following rank
skips the tied positions (for example, `1, 1, 3`).

| Rank | Challenge points | GP earned | Cards |
| --- | ---: | ---: | ---: |
| 1 | 10 | 3 | 3 |
| 2 | 8 | 2 | 2 |
| 3 | 6 | 2 | 2 |
| 4 | 4 | 1 | 1 |
| 5 | 2 | 1 | 0 |

The overall scoreboard aggregates challenge scores and challenge points per
team. Total cards are capped at 8. Team GP is the starting 5 plus GP earned
across challenges.

### Correcting a score

Each row on the per-challenge scoreboard has **Edit score** alongside **Delete**.
Editing updates the entry in place, so the team keeps its place in the challenge
and no bonus cards are revoked. Ranks, challenge points, guard power and card
rewards are recalculated from the corrected score, which also reshuffles the
other teams' ranks and the overall scoreboard. The team is pinned while editing,
because a correction applies to the team that already has the entry.

The card pool has 80 named cards stored permanently in the database: 48 Normal,
24 Rare, 6 Epic, and 2 Legendary. Each card has an effect category (Defense,
Attack, Heal, Utility, Support, or Thief) and an `effect_action` description
displayed on the card. A completed challenge awards up to three cards per
eligible team based on the final rank. Draws assign challenge/team references to
existing inventory rows, so no pool card is ever awarded twice. Revoked draws
and deleted challenges return cards to the inventory. The **Card Draw** view
shows the pool size, how many cards are drawn, and how many remain, overall and
per type. Each drawn card is mirrored once in the team's permanent collection.
Startup and score changes synchronize these records, repair old duplicate counts,
and avoid repeated awards. If scores change, card assignments follow the updated
rewards.

## Data and offline behavior

Sequelize models manage the app data using SQLite compiled to WebAssembly by
`sql.js`. The SQLite database runs in memory while the app is open and is saved
to the browser's IndexedDB after changes. It is local to the browser profile
and device; it is not synchronized to other users or devices. Clearing browser
site data may delete the saved database.

On startup the app syncs the schema, seeds the six built-in challenge rows
(`src/services/challengeSeeds.ts`), and synchronizes every completed challenge's
bonus cards. Seeding matches on the challenge name, so restarting never
duplicates a row and never disturbs an existing scoreboard.

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
  services/games/  Pure rules and content for the six challenges
  styles/       Shared responsive theme and component styles
  views/        App shell and feature screens
  views/challenges/  The six game screens and their shared playing frame
  data/         JSON content shared by the app and the PPTX generator
public/         PWA icons, guardian character illustrations, and game decks
scripts/        Icon and PowerPoint deck generators
blueprint.md    Detailed data model and product rules
```

## Interface and character assets

The shared app header uses `public/Logo_Game-5.png` for the app logo and displays `public/gardian-male.png`,
`public/gardimon.png`, `public/gardian-female.png`, and the Giga Risk dragon
artwork from `public/gigarisk-portrait.jpg`. Character framing, light/dark theme
tokens, and the trading-card layout are styled in
`src/styles/index.css`. Card Draw and Team Cards share one portrait card
component and use each card's name, rarity, icon, effect, and action description.

For the full schema, constraints, and product rules, see
[blueprint.md](./blueprint.md).
