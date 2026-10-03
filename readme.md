# Guard The Heart

Guard The Heart is an offline-first challenge tracker for teams. Record team
scores, calculate challenge and overall rankings, award guard power and bonus
cards, and view active teams' guard power in the Heart of Awareness tower.

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
| `npm run test:e2e` | Run the Playwright end-to-end tests |

## Using the app

1. Add and manage teams on the **Team** view. Teams start with 5 guard power
   (GP) and can be activated or deactivated.
2. Create challenges on the **Challenge** view.
3. Open a challenge scoreboard and enter one score per participating team.
   A challenge accepts at most five teams.
4. Rankings and challenge rewards are recalculated from scores.
5. When the fifth team joins a challenge, the app calculates final ranks and
   automatically awards bonus cards to eligible teams. Use **Card Draw** to
   review the challenge's card results.
6. Review team card collections, the overall scoreboard, and the **Heart of
   Awareness** tower from their respective views.

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

The card pool contains 78 cards: 48 Normal, 24 Rare, and 6 Epic. Each card has
an effect category (Defense, Attack, Heal, Utility, or Support). A completed
challenge awards up to three cards per eligible team based on the final rank.
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
  services/     Ranking, scoreboard aggregation, and card drawing rules
  styles/       Shared responsive theme and component styles
  views/        App shell and feature screens
public/         PWA icons and guardian character illustrations
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
