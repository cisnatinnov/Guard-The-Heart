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
- **colour themes**
White                 : ffffff
Yellow-off white	    : fff4e6
Creme                 : fff6cc
Yellow-off Light Grey	: efe8df
Orange                : f48220
Tosca                 : 027479
Red                   : be392a
Dark Red              : 8d3030

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