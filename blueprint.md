## Tech Stack
1. MVC Framework: react latest typescript with vite (compatible with installed node and npm)
- **Models (ORM (sequilize (no raw queries)))** and **Controllers**
| Team (filterable; 5, 10, 20, 25, 50, or 100 teams per page with numbered page navigation) |
| Challenge |
| ChallengePoint |
| Scoreboard |
| Card |
| TeamCard |
- **Views**
| Team |
| Challenge |
| Scoreboard per challenge (Public: read-only; Adm: Choose Challenge, Add entry, Edit CP, Delete) |
| Leaderboard (Public: read-only; Adm: Recalculate, Save offline copy) |
| Heart of awareness (Tower that only shows total gp for active teams) |
| Card Reveal (Public: read-only team collections; Adm: Assign drawn cards to teams, replace at capacity) |
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
- Card Reveal uses a shared portrait trading-card layout: name and rarity header, icon artwork panel, and effect/type details. The same layout works across Normal, Rare, Epic, and Legendary cards, with the layout driven only by the stored card fields.

2. Database: sqlite
- **Tables**:
a. challenge
| Field | type |
| id | uuid |
| name | varchar(225) |
| cards_drawn_at | datetime (nullable; set once the challenge's bonus cards are drawn) |
| createdAt | datetime |
| updatedAt | datetime |
b. team
| Field | type |
| id | uuid |
| name | varchar(225) |
| status | enum(active/inactive) |
| total_gp | integer(3) |
| createdAt | datetime |
| updatedAt | datetime |
c. challenge_point
| Field | type |
| id | uuid |
| challenge | uuid(refer to challenge table) |
| team | uuid(refer to team table) |
| rank | integer(2) |
| challenge_point | integer(3) |
| guard_power | integer(3) |
| createdAt | datetime |
| updatedAt | datetime |

Constraints: unique (challenge, team), max 5 rows per challenge. rank is derived from challenge_point
(competition style), as are challenge_point, guard_power.
d. scoreboard
| Field | type |
| id | uuid |
| team | uuid(refer to team table) |
| rank | integer(2) |
| total_cp | integer(3) |
| total_card | integer(3) |
| createdAt | datetime |
| updatedAt | datetime |

Constraints: one row per team (unique team). Totals are summed from challenge_point per team
and rank is derived from total_cp. total_gp is synced from team.total_gp.
total_card is always 0 on the scoreboard; cards are managed via TeamCard.
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

Constraints: After the fifth team is entered and the challenge is complete, the host draws bonus cards once via Scoreboard (Adm). Cards are drawn into the challenge pool (with challenge reference, no team). Admin then assigns cards to teams via Card Reveal (Adm) using drag-and-drop or click-to-assign (click a card, then click a team). Each assigned card is linked to the team's ChallengePoint entry and mirrored once in `team_card` as the permanent team collection. If a team reaches 8 cards, admin chooses which card to replace. Drawn cards are saved permanently: later score corrections or removed entries never redraw or return them. Only deleting a challenge returns its cards to the pool.

## Terms and conditions
1. challenge_point accommodates only 5 teams each challenge. A team that has
entered a challenge keeps its entry; its challenge point is corrected in place, which
reranks the challenge and the overall scoreboard instead of removing the team.
2. scoreboard (total challenge_point (total_cp(challenge_point), total_card=0, total_gp) per team)
3. rank based on challenge_point (challenge_point) and total_cp (scoreboard), 1st rank have the highest and so on until 5th rank. Tied challenge points share a rank and the next rank increments by 1 (standard competition: 1, 2, 2, 3, 4)
4. guard_power based on rank
| rank | guard_power |
| 1 | +3 |
| 2 | +2 |
| 3 | +2 |
| 4 | +1 |
| 5 | +1 |
5. Team total_gp set to 5 as default
6. Team total_gp from guard_power accumulation (base 5 + earned guard_power)
7. **Card System**
a. Type : Normal (48), Rare (24), Epic (6), Legendary (2) - 80 cards are seeded permanently into the `card` inventory as copies of the 11 designs in `public/cards/` (Normal Heal/Shield/Thief x16, Rare Heal/Protect/Reverse/Thief x6, Epic Reflect/Reverse x3, Legendary Gardian Unity/Second Chance x1); unassigned cards have null challenge/team references.
b. Effect : Defense 🛡️, Attack 🗡️, Heal ❤️, Utility 🔀, Support 🤝, Thief 🕵️
c. Every card has an `effect_action` description stored in both `card` and `team_card`, matching its artwork.
d. After the fifth team participates, the host draws bonus cards for teams with card rewards (maximum 3 per team per challenge) from Scoreboard (Adm). Cards go to the challenge pool (challenge ref, no team).
e. Admin assigns drawn cards to teams via Card Reveal (Adm). A team can hold max 8 cards; if at capacity, admin chooses which card to replace. Assigned cards are mirrored once in `team_card`.
f. A challenge's cards can be drawn only once. The draw is saved permanently and is not changed by later score corrections.
g. Only deleting a challenge returns its cards to the pool, preserving the 80-card pool.
h. `getCardPoolStatus()` reports total, drawn and remaining counts overall and per type, and the Card Reveal (Adm) view shows them. An action description is card data; it does not by itself apply gameplay effects.
8. **Challenges**
a. Image Decode (formerly Emoji Decode) : "'Image Decode' challenge that includes a link to a PPTX file. The presentation must feature 15 questions and include a built-in animated timer for each slide."
b. Match Card (formerly Word Assembly) : "'Match Card' picture matching game featuring 10 questions and 20 cards, with two identical image cards for each question. Mismatched open cards turn face down again."
c. Jaws of Risk : "Digital application interface inspired by the physical crocodile dentist toy. The digital version must allow the user to select, interact with, or label specific teeth before 'pressing' them."
d. Retired: Gardimon Protocol, Incident Trail and Save the Core were removed together with all related code, content and decks. Older databases drop these challenge rows (with their entries) on startup and return their drawn cards to the pool.

9. Point 8 link to Challenge feature (save as challenge data and cannot be added more, edited and deleted)

## Implementation notes

The three challenges above are played from the **Challenge** view. Their rules
and content are pure modules under `src/services/games/`, their screens are
under `src/views/challenges/`, and the Image Decode deck is generated from the
same JSON content the app reads.

1. **Image Decode** — `src/data/emoji-decode.json` holds the 15 questions. Each
   question combines **four images (emoji)** into a single answer (emoji,
   answer, hint), and the app and the deck render all four together. The app
   screen scores 10 points per decoded answer, 150 in total, and mirrors the
   deck timing with a live countdown per question; letting the countdown expire
   counts as a miss. Team runs use the same 30-second timer for each team's
   attempt. A wrong answer passes the question to the next team; a correct
   answer or timeout ends the question.
   The deck `public/decks/emoji-decode.pptx` carries a title slide, one slide per
   question and an answer key. Each question slide animates a 30 second timer
   bar and auto-advances, so no presenter input is needed.
2. **Match Card** — 10 questions, each represented by two identical image
   cards sourced from `public/match-card/` (20 cards total). Players reveal two
   cards at a time; a matching pair remains face up, while a mismatch turns all
   open cards face down after a brief reveal. Each matched pair is worth 10
   points, and each mismatch costs 5 (100 max). Team-run questions have a
   15-second timer and ask teams to identify the matching image.
3. **Jaws of Risk** — team runs use 24 teeth; the solo game shows 8 teeth in two
   rows, 6 of them loose. A tooth is selected, labelled (Suspect, Firm or
   Unmarked) and only then graded by pressing. Loose
   teeth are worth 10 points, each false alarm costs 5, never below zero.

Internal identifiers keep their original names (`emoji-decode`,
`word-assembly`, `emojiDecode.ts`, `wordAssembly.ts`) so existing ids and the
deck path stay stable; only the displayed titles changed.

### Point 9: the challenges are challenge data

The three games are saved as rows in the `challenge` table, so they are seeded on
every launch and behave like any other challenge:

- `src/services/challengeSeeds.ts` seeds one row per game with
  `seedLockedChallenges()`. Seeding is idempotent and matches on the name, so an
  existing row keeps its id, scoreboard, bonus cards and timestamps. Each game
  also carries a fixed `challengeId`, used as the id for freshly seeded rows.
  Before seeding, rows saved under a former title (`Emoji Decode`,
  `Word Assembly`) are renamed, and retired challenges are deleted.
- Their names are reserved. `ChallengeController.create()` rejects a second row
  for any of the built-in names, and `rename()` rejects both renaming a built-in
  row and renaming another challenge to one of those names.
- `ChallengeController.rename()` and `ChallengeController.remove()` throw for a
  built-in row, so the lock holds even if the UI is bypassed. The Challenge view
  has no **Add challenge** form at all, shows no Rename or Delete control, and
  marks the seeded rows `Built-in`.
- A built-in row offers **Scoreboard**, **Play** and a deck link when one exists.
  **Play** opens the game's screen, which is a detail view and is not listed in
  the navigation; it is reachable only from its challenge row, and its
  **← All challenges** button is the only way back. Each challenge also offers
  **Team run**, letting the host run the challenge question by question with up
  to five teams. One team answers at a time in the order selected when the run
  starts. A wrong answer passes the same question to the next team; teams that
  have already tried it cannot try it again. A correct answer or timeout ends
  the question, after which the host advances and the next team's input becomes
  available. If every team answers incorrectly, the host can advance as well.
  Team-run timers are 30 seconds for Image Decode and 15 seconds for Match Card.
  Jaws of Risk has no timer. Timeout grades only the team currently answering
  and moves the run to the next question.
- Because the rows are ordinary challenge data, the existing rules apply to them:
  up to 5 teams per challenge, ranks derived from scores, rank rewards awarding
  guard power, and a single permanent bonus-card draw depleting the card pool.

### Navigation

There is no separate games or Challenges tab. The games are listed as rows on
the Challenge view, the playing screen is a detail view reachable only from a
built-in row's Play button. The team run panel is shown within the same detail
view when the host chooses **Team run**. All other views are reached from the
top navigation tabs, which now include separate Public and Adm tabs for
Scoreboard, Leaderboard, and Card Reveal.

### Correcting a built-in challenge score

A built-in challenge behaves like any other challenge row on the per-challenge
scoreboard. A team gains challenge point either through the team run (where one team
answers at a time and a wrong answer passes the same question to the next team)
or by entering it manually with **Add entry** (Adm). A corrected result is
applied with **Edit CP** (Adm), which calls `ChallengePointController.update()`
and keeps the team in the challenge. Reranking and guard power follow the
corrected value; bonus cards already drawn for the challenge stay as drawn.

Game state is intentionally kept in the browser tab only. The games themselves
are never written to the database. In the team run, each answering team's challenge point
is persisted to the challenge point as it is earned; in solo play, the
challenge's scoreboard is filled in by hand with the player's result. The card
pool and scoreboard rules are unchanged by the games.

The deck is regenerated with `npm run decks`. The generator writes the ZIP and
OOXML parts without any PowerPoint dependency and validates the archive and all
XML parts before writing, so content edits only require re-running the script.