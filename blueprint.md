## Tech Stack
1. MVC Framework: react latest typescript with vite (compatible with installed node and npm)
- **Models (ORM (sequilize (no raw queries)))** and **Controllers**
| Team |
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
- Guardian images are shown in portrait frames with `object-fit: cover`; the mascot uses `object-fit: contain` so its wide tail remains visible. Images retain their source proportions.
- The responsive header keeps all three characters visible and scales their frames down on narrow screens.
- The interface palette reflects the character costumes: teal and orange for navigation and actions, warm cream surfaces, charcoal text, and a soft peach skin-tone accent. Light and dark palettes are defined by CSS custom properties in `src/styles/index.css`.
- PWA theme and background colors use teal (`#027479`) and warm off-white (`#fff4e6`). The production Workbox PNG glob caches the character assets for offline use.
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

Constraints: Card drawn as bonus after challenge completion. challenge and team set when drawn as bonus.


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
a. Type : Normal (48), Rare (24), Epic (6) - Total 78 cards
b. Effect : Defense 🛡️, Attack 🗡️, Heal ❤️, Utility 🔀, Support 🤝
c. After the challenge ends (all 5 teams participated and ranked), teams with card > 0 draw random bonus cards (max 3 per team and per challange)
d. Drawn cards stored in Card table with challenge and team reference temporary then stored in team_card table with team reference