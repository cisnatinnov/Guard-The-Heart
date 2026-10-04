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
3. Play a challenge with teams using **Team run**. Choose the teams that will
   follow the challenge. Each team answers every question independently. A wrong
   answer eliminates that team until the next question, where it can rejoin.
   Correct answers add score directly to the challenge scoreboard automatically.
   A challenge accepts at most five teams. Each question-based team run uses its
   challenge's timer; unanswered teams are graded incorrect when time runs out.
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
| Gardimon Protocol | 5 unique cards with rarity, icon and charge, each split into Crime Scene, Evidence and Protocol phases; 8 minutes per question in team runs | 10 per correct phase, plus 15 for a card answered perfectly (225 max) |
| Word Assembly | 5 questions of 4 letters each, dealt as 20 face-down letter tiles; 15 seconds per question in team runs | 10 per matched letter, minus 5 per wrong slot (200 max) |
| Incident Trail | 5 crime scenes, 5 clues hidden among 25 information pieces, each with its own answer sheet; 20 seconds per question in team runs; also available as a PPTX deck | 20 per scene closed with the right clue (100 max) |
| Jaws of Risk | A crocodile dentist with 24 teeth in two jaws, 6 of them loose; no team-run timer | 10 per loose tooth found, minus 5 per false alarm (60 max) |
| Save the Core | Ludo-style race of 4 guardians on a 24-tile track crossed with minesweeper | Randomised score on a safe tile, bomb sends the piece back to the start, 50 for finishing |

### The challenges are challenge data

All six are saved as rows in the `challenge` table, so they are present from the
first launch:

- They cannot be added, renamed or deleted. The view has no **Add challenge**
  form, marks each row `Built-in`, and the controller refuses those operations.
  Their names stay reserved so a row can never be created with one of them.
- Each row offers **Scoreboard**, **Play**, **Team run**, and a deck link when
  one exists. **Play** opens the solo game screen. **Team run** lets the host
  run the challenge question by question with up to five teams; each team's
  running total is written to the scoreboard as it is earned. Team-run timers
  are 30 seconds for Emoji Decode, 8 minutes for Gardimon Protocol, 15 seconds
  for Word Assembly, and 20 seconds for Incident Trail. Jaws of Risk has no
  team-run timer. Unanswered teams are automatically graded incorrect when a
  timer expires.
- A built-in challenge accepts up to 5 teams like any other, so ranks, guard
  power and bonus cards are calculated from scores entered either by hand or
  via the team run.

### Views and navigation

There is no separate games tab. The six challenges are rows on the **Challenge**
view, and the playing screen is a detail view reached only from a built-in row's
**Play** button; its **← All challenges** button is the way back. **Team run**
is a panel within the challenge detail that lets the host run the challenge with
teams, grading answers question by question. Views are otherwise reached from
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

The card pool contains 78 cards: 48 Normal, 24 Rare, and 6 Epic. Each card has
an effect category (Defense, Attack, Heal, Utility, or Support). A completed
challenge awards up to three cards per eligible team based on the final rank.
The pool depletes as cards are drawn, so no pool card is ever awarded twice, and
revoking a draw returns its cards to the pool. The **Card Draw** view shows the
pool size, how many cards are drawn, and how many remain, overall and per type.
Each card is recorded for the challenge and mirrored once in the team's
permanent collection. Startup and score changes synchronize these records,
repair old duplicate counts, and avoid repeated awards. If scores change, card
counts follow the updated rewards, and reopening a challenge by removing an
entry removes its challenge bonus cards.

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

The shared app header displays `public/gardian-male.png`,
`public/gardimon.png`, `public/gardian-female.png`, and the Giga Risk dragon
artwork from `public/gigarisk-portrait.jpg`. Character framing, light/dark theme
tokens, and the trading-card layout are styled in
`src/styles/index.css`. Card Draw and Team Cards share one portrait card
component and use each card's name, rarity, icon, and effect.

For the full schema, constraints, and product rules, see
[blueprint.md](./blueprint.md).
