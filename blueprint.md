## Tech Stack
1. MVC Framework: react latest typescript with vite (compatible with installed node and npm)
- **Models (ORM (sequilize (no raw queries)))** and **Controllers**
| Team (filterable; 5, 10, 20, 25, 50, or 100 teams per page with numbered page navigation) |
| Challenge |
| ChallengeScoreboard |
| Scoreboard |
| Card |
- **Views**
| Team |
| Challenge |
| Scoreboard Per Challenge |
| Scoreboard Total |
| Heart of awareness (Tower that only show total gp for active teams) |
| Card Draw Bonus |
- **PWA**: vite-plugin-pwa with Workbox, auto-update service worker, offline caching for static assets
- **colour themes** (current interface tokens; CSS custom properties live in `src/styles/index.css`)
  - White / card surfaces: `#ffffff`
  - Warm off-white: `#fff9f2`
  - Yellow-off white: `#fff4e6`
  - Creme: `#fff6cc`
  - Warm border: `#e8d9c9`
  - Orange costume accent: `#f48220`
  - Teal costume accent: `#027479`
  - Red: `#be392a`
  - Dark red: `#8d3030`
  - Charcoal text / costume: `#20292b`
  - Muted text: `#52666a`
  - Skin-tone accent: `#f2c4a5` (used as a soft translucent wash)
  - Primary action orange: `#a9470c`
  - Dark mode surfaces: `#17282b`, `#223639`, and `#30484b`; text uses warm off-white.

### Visual theme and character assets
- The shared app header pairs the product name with three character illustrations:
  - `public/gardian-male.png` — male guardian
  - `public/gardimon.png` — Gardimon mascot
  - `public/gardian-female.png` — female guardian
- The header also features `public/gigarisk-portrait.jpg` as a wide, proportionally framed Giga Risk dragon illustration.
- Guardian images are shown in portrait frames with `object-fit: cover`; the mascot uses `object-fit: contain` so its wide tail remains visible. Images retain their source proportions.
- The responsive header keeps all three characters visible and scales their frames down on narrow screens.
- The interface palette reflects the character costumes: teal and orange for navigation and actions, warm cream surfaces, charcoal text, and a soft peach skin-tone accent. Light and dark palettes are defined by CSS custom properties in `src/styles/index.css`.
- PWA theme and background colors use teal (`#027479`) and warm off-white (`#fff4e6`). Production Workbox caching includes the PNG and JPEG character artwork for offline use.
- Card Draw and Team Cards use a shared portrait trading-card layout: name and rarity header, icon artwork panel, and effect/type details. The same layout works across Normal, Rare, Epic, and Legendary cards, with the layout driven only by the stored card fields.

2. Database: sqlite
- **Tables**:
a. challenge
| Field | type |
| id | uuid |
| name | varchar(225) |
| createdAt | datetime |
| updatedAt | datetime |
b. team
| Field | type |
| id | uuid |
| name | varchar(225) |
| total_gp | integer(3) |
| status | enum(active/inactive) |
| createdAt | datetime |
| updatedAt | datetime |
c. challenge_scoreboard
| Field | type |
| id | uuid |
| challenge | uuid(refer to challenge table) |
| team | uuid(refer to team table) |
| score | integer(3) |
| rank | integer(2) |
| challenge_point | integer(3) |
| guard_power | integer(3) |
| card | integer(3) |
| createdAt | datetime |
| updatedAt | datetime |

Constraints: unique (challenge, team), max 5 rows per challenge. rank is derived from score
(competition style), as are challenge_point, guard_power and card.
d. scoreboard
| Field | type |
| id | uuid |
| team | uuid(refer to team table) |
| total_score | integer(3) |
| rank | integer(2) |
| total_cp | integer(3) |
| total_card | integer(3) |
| total_gp | integer(3) |
| createdAt | datetime |
| updatedAt | datetime |

Constraints: one row per team (unique team). Totals are summed from challenge_scoreboard per team
and rank is derived from total_score. total_gp synced from team.total_gp.
e. card
| Field | type |
| id | uuid |
| name | varchar(100) |
| type | enum(Normal/Rare/Epic/Legendary) |
| effect | enum(Defense/Attack/Heal/Utility/Support/Thief) |
| effect_action | varchar(225) |
| icon | varchar(10) |
| challenge | uuid(refer to challenge table, nullable) |
| team | uuid(refer to team table, nullable) |
| createdAt | datetime |
| updatedAt | datetime |

f. team_card
| Field | type |
| id | uuid |
| name | varchar(100) |
| type | enum(Normal/Rare/Epic/Legendary) |
| effect | enum(Defense/Attack/Heal/Utility/Support/Thief) |
| effect_action | varchar(225) |
| icon | varchar(10) |
| team | uuid(refer to team table, nullable) |
| createdAt | datetime |
| updatedAt | datetime |

Constraints: After the fifth team is entered, ranks and rank rewards are recalculated first. The challenge's bonus cards are then synchronized: each eligible team receives up to 3 cards matching its current rank reward. Drawn inventory rows in `card` receive challenge and team references and are mirrored once in `team_card` as the permanent team collection. Synchronization runs at app startup and after score changes, repairs legacy duplicate counts, and must not duplicate either record. If scores change after completion, card counts follow the updated rewards; if an entry is removed and the challenge is no longer complete, its challenge assignments are cleared to return those cards to the pool and its permanent team copies are removed.


## terms and conditions
1. challenge_scoreboard accomodate only 5 team each challenge. A team that has
entered a challenge keeps its entry; its score is corrected in place, which
reranks the challenge and the overall scoreboard instead of removing the team.
2. scoreboard (total challenge_scoreboard (total_score(score), total_cp(challenge_point), total_card(card) max 8, total_gp) per team)
3. rank based on score (challenge_scoreboard) and total_score (scoreboard), 1st rank have the highest and so on until 5th rank. Tied scores share a rank and the next rank skips (1, 1, 3)
4. challenge_point, guard_power, and card based on rank
| rank | challenge_point | guard_power | card |
| 1 | +10 | +3 | +3 |
| 2 | +8 | +2 | +2 |
| 3 | +6 | +2 | +2 |
| 4 | +4 | +1 | +1 |
| 5 | +2 | +1 | 0 |
5. Team total_gp set to 5 as default
6. Team total_gp from guard_power accumulation (base 5 + earned guard_power)
7. **Card System**
a. Type : Normal (48), Rare (24), Epic (6), Legendary (2) - 80 named cards are seeded permanently into the `card` inventory; unassigned cards have null challenge/team references.
b. Effect : Defense 🛡️, Attack 🗡️, Heal ❤️, Utility 🔀, Support 🤝, Thief 🕵️
c. Every card has an `effect_action` description stored in both `card` and `team_card`, and shown in Card Draw and the permanent team collection.
d. After the fifth team participates and all ranks/rewards are calculated, teams with a card reward receive random bonus cards (maximum 3 per team per challenge).
e. A drawn inventory row receives challenge/team references and is mirrored once in `team_card`. Repeated completion/sync requests reconcile counts rather than adding duplicates.
f. If a completed challenge's scores change, bonus-card counts are synchronized to the updated ranks. Returned bonus cards are unassigned, preserving the 80-card pool; deleting a challenge also returns its cards before removing its records.
g. `getCardPoolStatus()` reports total, drawn and remaining counts overall and per type, and the Card Draw view shows them. An action description is card data; it does not by itself apply gameplay effects.
8. **Challenges**
a. Emoji Decode : "'Emoji Decode' challenge that includes a link to a PPTX file. The presentation must feature 15 questions and include a built-in animated timer for each slide."
b. Gardimon Protocol : "'Gardimon Protocol' game consisting of 5 questions and 5 unique cards. The gameplay elements must be categorized into three phases or components: Crime Scene, Evidence, and Protocol."
c. Word Assembly : "'Word Assembly' picture matching game featuring 10 questions and 20 cards, with two identical image cards for each question. Mismatched open cards turn face down again."
d. Incident Trail : "'Incident Trail' challenge and provide a link to a PPTX file. It must include 5 Crime Scenes with associated questions, 5 distinct clues, 25 pieces of information, and 25 answer sheets."
e. Jaws of Risk : "Digital application interface inspired by the physical crocodile dentist toy. The digital version must allow the user to select, interact with, or label specific teeth before 'pressing' them."
e. 'Save the Core' : "A game mechanic called 'Save the Core' inspired by Ludo and Minesweeper. The Core is the destination on a 24-space chessboard path; show only path squares, with no dedicated start tile. Play with the built-in Guardimon Male, Guardimon Female, Gardimon and Giga Risk pawns, or select teams; starting squares are assigned randomly. A hidden bomb sends a pawn back to its randomized starting square, and a safe tile reveals a randomized score. The game lasts five minutes. Reaching the Core ends the game and awards its bonus; if time expires first, finalize and rank the scores earned so far."

9. Point 8 link to Challenge feature (save as challenge data and cannot be added more, edited and deleted)

## Implementation notes

The six challenges above are played from the **Challenge** view. Their rules and
content are pure modules under `src/services/games/`, their screens are under
`src/views/challenges/`, and the two decks are generated from the same JSON
content the app reads.

1. **Emoji Decode** — `src/data/emoji-decode.json` holds the 15 questions. Each
   question combines **four emoji** into a single answer (emoji, answer, hint),
   and the app and the deck render all four together. The app screen scores 10
   points per decoded answer, 150 in total, and mirrors the deck timing with a
   live countdown per question; letting the countdown expire counts as a miss.
   Emoji Decode team runs use the same 30-second timer for each team's attempt.
   A wrong answer passes the question to the next team; a correct answer or
   timeout ends the question.
   The deck `public/decks/emoji-decode.pptx` carries a title slide, one slide per
   question and an answer key. Each question slide animates a 30 second timer
   bar and auto-advances, so no presenter input is needed. Emoji Decode team runs
   also use a 30-second timer per team attempt; a timeout ends the question.
2. **Gardimon Protocol** — temporarily hidden behind a Work in progress page.
   The implemented design is 5 cards, each with rarity drawn from the card pool
   set, an icon, a charge value, and three option blocks: Crime Scene, Evidence
   and Protocol. A phase is worth 10 points and a card answered correctly in all
   three phases pays a 15 point perfect bonus (225 max). Team-run questions have
   an 8-minute timer.
3. **Word Assembly** — 10 questions, each represented by two identical image
   cards sourced from `public/match-card/` (20 cards total). Players reveal two
   cards at a time; a matching pair remains face up, while a mismatch turns all
   open cards face down after a brief reveal. Each matched pair is worth 10
   points, and each mismatch costs 5 (100 max). Team-run questions have a
   15-second timer and ask teams to identify the matching image.
4. **Incident Trail** — temporarily hidden behind a Work in progress page.
   Its content remains in `src/data/incident-trail.json`, which holds the 5
   crime scenes with their questions and answers, the 5 clues (each marked with the
   information piece that contains it), and the 25 information pieces with their
   25 answer sheets. Filing a clue closes its scene for 20 points (100 max).
   Team-run questions have a 20-second timer.
   The deck `public/decks/incident-trail.pptx` reproduces the title, the scenes,
   the clue tray, every information piece with its answer sheet, and a scoring
   summary.
5. **Jaws of Risk** — team runs use 24 teeth; the solo game shows 8 teeth in two
   rows, 6 of them loose. A tooth is selected, labelled (Suspect, Firm or
   Unmarked) and only then graded by pressing. Loose
   teeth are worth 10 points, each false alarm costs 5, never below zero.
6. **Save the Core** — the Core is the destination at the end of a 24-tile
   snake path on a chessboard. Play with the four built-in pawns (Guardimon
   Male, Guardimon Female, Gardimon and Giga Risk) or select active teams.
   Starting squares are randomized. Select up to five teams. The five-minute
   timer starts when play begins. Landing on a safe tile reveals its randomised score the
   first time only; a bomb sends that pawn back to its randomized start.
   Reaching the Core ends the game and pays a 50 point bonus. If the timer
   expires first, the current scores are final and ranked on the leaderboard.

### Point 9: the challenges are challenge data

The six games are saved as rows in the `challenge` table, so they are seeded on
every launch and behave like any other challenge:

- `src/services/challengeSeeds.ts` seeds one row per game with
  `seedLockedChallenges()`. Seeding is idempotent and matches on the name, so an
  existing row keeps its id, scoreboard, bonus cards and timestamps. Each game
  also carries a fixed `challengeId`, used as the id for freshly seeded rows.
- Their names are reserved. `ChallengeController.create()` rejects a second row
  for any of the six names, and `rename()` rejects both renaming a built-in row
  and renaming another challenge to one of those names.
- `ChallengeController.rename()` and `ChallengeController.remove()` throw for a
  built-in row, so the lock holds even if the UI is bypassed. The Challenge view
  has no **Add challenge** form at all, shows no Rename or Delete control, and
  marks the seeded rows `Built-in`.
- A built-in row offers **Scoreboard**, **Play** and a deck link when one exists.
  **Play** opens the game's screen, which is a detail view and is not listed in
  the navigation; it is reachable only from its challenge row, and its
  **← All challenges** button is the only way back. Question-based challenges
  also offer **Team run**, letting the host run the challenge question by
  question with up to five teams. One team answers at a time in the
  order selected when the run starts. A wrong answer passes the same question
  to the next team; teams that have already tried it cannot try it again.
  A correct answer or timeout ends the question, after which the host advances
  and the next team's input becomes available. If every team answers incorrectly,
  the host can advance as well. Team-run timers are 30 seconds for Emoji Decode,
  8 minutes for Gardimon Protocol, 15 seconds for Word Assembly, and 20 seconds
  for Incident Trail. Jaws of Risk has no timer. Timeout grades only the team
  currently answering and moves the run to the next question.
  Save the Core does not use the question-based team-run panel; its board game
  lets the host choose the built-in Guardians or up to five active teams as pawns.
  Their starting squares are randomized and they race toward the Core against
  the five-minute timer. The board displays only its 24 path squares and has no
  dedicated starting tile; pawns start on their assigned random squares. A Core arrival or timeout ends the game and freezes
  the final scores; board-game scores are then entered on the challenge
  scoreboard.
- Because the rows are ordinary challenge data, the existing rules apply to them:
  up to 5 teams per challenge, ranks derived from scores, and rank rewards
  awarding guard power and depleting the card pool.

### Navigation

There is no separate games or Challenges tab. The six games are listed as rows on
the Challenge view, the playing screen is a detail view reachable only from a
built-in row's Play button. The team run panel is shown within the same detail
view for question-based challenges when the host chooses **Team run**. Save the
Core uses team selection in its timed board game instead. All other views are
reached from the top navigation.

### Correcting a built-in challenge score

A built-in challenge behaves like any other challenge row on the per-challenge
scoreboard. A team gains score either through the team run (where one team
answers at a time and a wrong answer passes the same question to the next team)
or by entering it manually with **Add entry**. A corrected result is applied with **Edit score**,
which calls `ChallengeScoreboardController.update()` and keeps the team in the
challenge. Reranking, guard power and bonus cards follow the corrected value, so
the team that gains score is also the team whose rewards change.

Game state is intentionally kept in the browser tab only. The games themselves
are never written to the database. In the team run, each answering team's score
is persisted to the challenge scoreboard as it is earned; in solo play, the
challenge's scoreboard is filled in by hand with the player's result. Save the
Core's final board-game scores are also entered manually. The card pool and
scoreboard rules are unchanged by the games.

The decks are regenerated with `npm run decks`. The generator writes the ZIP and
OOXML parts without any PowerPoint dependency and validates the archive and all
XML parts before writing, so content edits only require re-running the script.