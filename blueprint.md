## Tech Stack
1. MVC Framework: react latest typescript with vite (compatible with installed node and npm)
- **Models (ORM (sequilize (no raw queries)))** and **Controllers**
| Team (filterable; 5, 10, 20, 25, 50, or 100 teams per page with numbered page navigation) |
| Challenge |
| ChallengePoint |
| Scoreboard |
| Card |
| TeamCard |
| GameQuestion |
- **Views**
| Team |
| Challenge |
| Scoreboard per challenge (Public: read-only; Adm: Choose Challenge, Add entry, Edit CP, Delete) |
| Leaderboard (Public: read-only; Adm: Recalculate, Save offline copy) |
| Reward Claim and Card Reveal (Public: challenge rewards; Adm: synchronized reward flow plus collection management) |
| Main presentation (Public: synchronized deck slides; Adm: slide controls and preview) |
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
total_card counts the permanent TeamCard collection, capped at 8; GP is read from the related Team.
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
| challenge_point | uuid(refer to challenge_point table, nullable) |
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
| challenge_point | uuid(refer to challenge_point table, nullable) |
| createdAt | datetime |
| updatedAt | datetime |

Constraints: After the fifth team is entered and the challenge is complete, the host draws bonus cards once via Scoreboard (Adm). Cards are drawn into the challenge pool (with challenge reference, no team). Cards are assigned randomly within quotas; admin can assign waiting cards via Card Reveal (Adm) using drag-and-drop or click-to-assign (click a card, then click a team). Each assigned card is linked to the team's ChallengePoint entry and mirrored once in `team_card` as the permanent team collection. If a team reaches 8 cards, admin chooses which card to replace. Drawn cards are saved permanently: later score corrections or removed entries never redraw or return them. Only deleting a challenge returns its cards to the pool.

g. game_question
| Field | type |
| id | varchar(100) |
| game_key | varchar(40) |
| number | integer |
| prompt | text |
| answer | text |
| options | JSON-encoded text |
| kind | varchar(16) |
| hint | text |
| createdAt | datetime |
| updatedAt | datetime |

Constraints: unique (`game_key`, `number`). This table stores the correct
answer alongside every question and answer choice. Startup seeds 11 Image
Decode, 21 Flipping Card and 20 Jaw of Risk rows from the reference deck data.

## Terms and conditions
1. challenge_point accommodates only 5 teams each challenge. A team that has
entered a challenge keeps its entry; its challenge point is corrected in place, which
reranks the challenge and the overall scoreboard instead of removing the team.
2. scoreboard (total challenge_point (total_cp(challenge_point), total_card=count(TeamCard) capped at 8, total_gp from Team) per team)
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
a. Image Decode (formerly Emoji Decode) : Eleven banking-term clues and answers from slides 3–24 of `public/ui/Image_Decode.pptx`; 15-second timed play.
b. Flipping Card (formerly Word Assembly) : A 20-card picture-matching game. Its 21 multiple-choice questions and answers come from slides 3–44 of `public/ui/Match-Card.pptx`. Each matched pair unlocks one question; team runs allow two attempts per answering team after matching.
c. Jaw of Risk: question-only challenge; answer stored questions in sequence. No teeth are displayed or selected.
d. Retired: Gardimon Protocol, Incident Trail and Save the Core were removed together with all related code, content and decks. Older databases drop these challenge rows (with their entries) on startup and return their drawn cards to the pool.

9. Point 8 link to Challenge feature (save as challenge data and cannot be added more, edited and deleted)

## Implementation notes

The three challenges above are played from the **Challenge** view. Game rules
and screens are in `src/services/games/` and `src/views/challenges/`. The
reference question bank is bundled at `src/data/reference-question-bank.json`
and seeded into SQLite's `game_question` table at startup.

1. **Image Decode** — 11 clue/answer pairs from slides 3–24 of
   `public/ui/Image_Decode.pptx` are stored in SQLite. Solo and team self answers
   score +10 correct and −10 wrong or timed out (110 maximum), with a live
   15-second countdown. Team runs use the same timer for each team's
   attempt. Self-answer scores +10 when correct and −10 when wrong. A correct
   answer advances automatically; a wrong answer or timeout passes the same
   question to the next eligible team.
2. **Flipping Card** — 21 question/answer pairs from slides 3–44 of
   `public/ui/Match-Card.pptx`, in slide order. Starting a run randomly draws
   the roulette team order. Teams have 20 seconds to match a pair; a mismatch
   moves the matching turn to the next roulette team without deducting points.
   A match unlocks the question. The matcher chooses to answer or give it to
   another team before the 15-second answering timer starts. Each answering
   team has two attempts within that timer; the first miss has no penalty.
   After two misses or expiry, the next eligible team answers the same question.
   Self answers score +10 correct or −10 after exhausting attempts. Passed
   answers retain the shared +5/−10 and −5/−5 rules. Ten-pair boards refresh
   after ten and twenty questions, so every reference question is playable.
   Matching and answering deadlines persist across public-screen reloads.
3. **Jaw of Risk** — 20 question/answer pairs from slides 3–42 of
   `public/ui/Jaw-of-risk.pptx`. Solo and team runs use the questions in
   sequence without a tooth board. Self answers score +10 correct, −10 wrong;
   team runs have no countdown.

The admin solo game screen styles follow their references in `public/ui/`: Image Decode
uses the question-panel styling in `Image_Decode.pptx` with the clue images from
slides 3–24 stored as WebP files in `public/image-decode/questions/`; Flipping Card
uses the hidden and revealed board
art in `Preview-CH-3_Online_Card-Hidden.png` and
`Preview-CH-3_Online_Card-Reveal.png`, cropped into individual lightweight
card faces in `public/match-card/reference/`; and Jaw of Risk follows the orange question/answer frame in `Jaw-of-risk.pptx`.
Both the Flipping Card Q&A deck and Jaw of Risk visual deck are available from its
screen. A matched card image remains visible beside its database-backed question
while the answer is open.

The `game_question` table stores a stable id, game key, order, prompt, answer,
JSON answer choices, question kind and hint. Startup upserts all 52 seeded
question rows without resetting existing teams, scores or cards.

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
  **← All challenges** button returns to the challenge list. Each challenge also offers
  **Team run**, letting the host run the challenge question by question with up
  to five teams. One team answers at a time in the order selected when the run
  starts. The turn table highlights the team answering now. Admin controls the
  run and **Start team run** opens the matching Public game route in a new browser
  tab, where it mirrors the run live. **End run** is an admin-only control that
  ends the shared run on both pages. Teams may pass a
  question to an opponent: a correct opponent answer gives that team +5 and the
  passing team −10; a wrong opponent answer gives both teams −5. Self-answer
  scoring is +10 correct and −10 wrong for all three challenges. A correct answer
  advances automatically. An unsuccessful turn keeps the same question and
  moves the turn to the next eligible team, with **Answer yourself** selected.
  If every team exhausts its attempts, the run advances automatically.
  Solo and team question timers are 15 seconds for all three challenges.
  Flipping Card matching turns remain 20 seconds. Timeout grades only the team currently answering
  and moves the same question to the next eligible team.
- Because the rows are ordinary challenge data, the existing rules apply to them:
  up to 5 teams per challenge, ranks derived from scores, rank rewards awarding
  guard power, and a single permanent bonus-card draw depleting the card pool.

### Navigation

There is no separate games or Challenges tab. The games are listed as rows on
the Challenge view, the playing screen is a detail view reachable only from a
built-in row's Play button. The team run panel is shown within the same detail
view when the host chooses **Team run**. All other views are reached from the
admin navigation links. Public pages use their own routes. The run opens its Public page in a new tab, and that page follows the host’s completion and reward actions.

### Correcting a built-in challenge score

A built-in challenge behaves like any other challenge row on the per-challenge
scoreboard. A team gains challenge point either through the team run (where one team
answers at a time and a wrong answer passes the same question to the next team)
or by entering it manually with **Add entry** (Adm). A corrected result is
applied with **Edit CP** (Adm), which calls `ChallengePointController.update()`
and keeps the team in the challenge. Reranking and guard power follow the
corrected value; bonus cards already drawn for the challenge stay as drawn.

The active team-run state is shared live across tabs and windows in the same
browser profile through `BroadcastChannel` with a `localStorage` fallback. It
is separate from the SQLite data and is keyed by challenge. The games themselves
are never written to the database. In the team run, each answering team's challenge point
is persisted to the challenge point as it is earned; in solo play, the
challenge's scoreboard is filled in by hand with the player's result. The card
pool and scoreboard rules are unchanged by the games.

The deck is regenerated with `npm run decks`. The generator writes the ZIP and
OOXML parts without any PowerPoint dependency and validates the archive and all
XML parts before writing, so content edits only require re-running the script.


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
between the controller preview and public display; slides 1–3 and 5 use supplied
deck artwork, slide 4 reproduces the reward table, and slides 6–7 use supplied
deck artwork.
