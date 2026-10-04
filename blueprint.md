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
- Card Draw and Team Cards use a shared portrait trading-card layout: name and rarity header, icon artwork panel, and effect/type details. The frame accents distinguish Normal (orange), Rare (teal), and Epic (red) cards; the layout uses only fields stored on each card.

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
| type | enum(Normal/Rare/Epic) |
| effect | enum(Defense/Attack/Heal/Utility/Support) |
| icon | varchar(10) |
| challenge | uuid(refer to challenge table, nullable) |
| team | uuid(refer to team table, nullable) |
| createdAt | datetime |
| updatedAt | datetime |

f. team_card
| Field | type |
| id | uuid |
| name | varchar(100) |
| type | enum(Normal/Rare/Epic) |
| effect | enum(Defense/Attack/Heal/Utility/Support) |
| icon | varchar(10) |
| team | uuid(refer to team table, nullable) |
| createdAt | datetime |
| updatedAt | datetime |

Constraints: After the fifth team is entered, ranks and rank rewards are recalculated first. The challenge's bonus cards are then synchronized: each eligible team receives up to 3 cards matching its current rank reward. Drawn cards are recorded in `card` with challenge and team references and mirrored once in `team_card` as the permanent team collection. Synchronization runs at app startup and after score changes, repairs legacy duplicate counts, and must not duplicate either record. If scores change after completion, card counts follow the updated rewards; if an entry is removed and the challenge is no longer complete, its challenge bonus cards and permanent copies are removed.


## terms and conditions
1. challenge_scoreboard accomodate only 5 team each challenge
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
a. Type : Normal (48), Rare (24), Epic (6) - Total 78 cards (show remaining total cards can drawn after cards drawn)
b. Effect : Defense 🛡️, Attack 🗡️, Heal ❤️, Utility 🔀, Support 🤝
c. After the fifth team participates and all ranks/rewards are calculated, teams with a card reward receive random bonus cards (maximum 3 per team per challenge).
d. Each bonus card is stored in `card` with challenge and team references, then mirrored once in `team_card` for the permanent team collection. Repeated completion/sync requests reconcile counts rather than adding duplicates.
e. If a completed challenge's scores change, bonus-card counts are synchronized to the updated ranks. Removing a score so the challenge has fewer than five participants removes its challenge bonus cards and their permanent copies.
f. The pool depletes. A drawn card leaves the pool, so no pool card is ever awarded twice. Revoking a draw returns its cards to the pool. `getCardPoolStatus()` reports the total, drawn and remaining counts overall and per type, and the Card Draw view shows them.
g. **Challanges**
1. Emoji Decode : "'Emoji Decode' challenge that includes a link to a PPTX file. The presentation must feature 15 questions and include a built-in animated timer for each slide."
2. Gardimon Protocol : "'Gardimon Protocol' game consisting of 5 questions and 5 unique cards. The gameplay elements must be categorized into three phases or components: Crime Scene, Evidence, and Protocol."
3. Word Assembly : "'Word Assembly' match-card game mechanic featuring 5 main questions and 20 playable cards for players to match."
4. Incident Trail : "Develop an 'Incident Trail' challenge and provide a link to a PPTX file. It must include 5 Crime Scenes with associated questions, 5 distinct clues, 25 pieces of information, and 25 answer sheets."
5. Jaws of Risk : "Create a digital application interface inspired by the physical crocodile dentist toy. The digital version must allow the user to select, interact with, or label specific teeth before 'pressing' them."
6. 'Save the Core' : "Design a game mechanic called 'Save the Core' inspired by Ludo and Minesweeper. The rules are: if a player steps on a hidden bomb, their piece is immediately sent back to a predetermined starting position. However, stepping on a correct (safe) tile reveals a randomized score."