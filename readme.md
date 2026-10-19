# Guard The Heart

An offline-first team challenge tracker built with React, TypeScript, Vite,
Sequelize and sql.js. Scores, rewards, cards and GP transactions stay in the
browser. Admin controls and public projector pages synchronize within the same
browser profile and origin.

## Getting started

Use Node.js 20.19+ or 22.12+ and npm.

```sh
npm install
npm run dev
```

Open Vite's local URL. Open `/admin` to manage the game; `/` opens the public
scoreboard. Configure and run the standalone event timer at `/admin/timer`; its
public display is `/timer`. Production hosting must serve `index.html` for application routes.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm test` | Vitest rules and database regression tests |
| `npx playwright install chromium` | Install the browser used by end-to-end tests |
| `npm run test:e2e -- --workers=2` | Production build and browser regression tests |
| `npm run build` | Type-check and build the PWA into `dist/` |
| `npm run preview` | Serve the production build |
| `npm run decks` | Regenerate bundled challenge decks |
| `npm run icons` | Regenerate PWA icons |

## Running an event

1. Review teams in **Team**. Merah, Hijau, Biru, Kuning and Pink are seeded,
   active and protected from renaming/deletion. All teams, including defaults,
   can be deactivated manually. Additional teams can be created, renamed and
   deleted. Each team starts with 5 GP.
2. Use **Urutan Main** to click team names in the desired order or use **Acak
   Giliran**. The public order page also supports these controls. This order is
   independent of the games' team selection.
3. Choose **Play** on **Challenge** for **Challenge 1 - Image Decode**, **Challenge 2 - Flipping Connect** or
   **Challenge 3 - Jaw of Risk**. Flipping Connect is a matching-only activity;
   Jaw of Risk is a bite toy using the dragon background and numbered tooth assets from `public/ui/jaw-of-risk/`. Image Decode is visible in the challenge list and retains team scoring.
4. Review or enter game scores on **Scoreboard**. **Edit Score** corrects an existing score
   and recalculates ranks and GP rewards. Each challenge supports at most five
   team entries, with one entry per team.
5. **Claim Rewards** opens the reward board on admin and existing public pages.
   With five entries, it rolls rarity per rank and challenge, then assigns the reserved bonus cards once. Revisiting
   the page does not draw again. **Draw Bonus Cards** offers the same draw from
   the scoreboard.
6. From **Rewards**, open **Tactical Phase**. Owned cards are grouped by the
   challenge that awarded them. Only available cards are listed. Select
   up to two available cards from any challenge, by clicking or dragging, or choose **Skip**.
   The public and admin Tactical Phase hide used cards from available inventory and action panels. The Selected cards area retains
   that challenge’s locked selections after the attack and across reloads. Available cards and selections are shown face-up.
   Completed Card Reveal pages retain the played cards as history.
   Heal, Reverse and valid Thief assignments update GP immediately. Gardian Unity adds 1 GP to every team only when selected for use. Retargeting, deselecting or skipping recalculates the pending effects without stacking bonuses.
   **Card Reveal** displays those selections without applying an attack.
7. In **Tactical Phase**, choose an opponent for each
   Normal/Rare Thief card, or two distinct opponents for Epic Thief, then click
   **Serang semua tim −2 GP**. The attack and selected
   defenses apply once; assignment effects are not repeated. An empty tactical phase blocks the attack with a message;
   explicit SKIP is a valid decision. Used cards leave available inventory.
   Rare Protect requires a target team, which may be its owner. Select Second Chance to use it; it activates automatically at zero GP and is consumed only if triggered.
   **Serangan GigaRisk** displays the saved attack result and each team’s complete incoming/outgoing effect activity.
   Applying the attack opens Card Reveal with animated played cards and resolved
   effects. Reduced-motion settings disable the animation.
8. Show the **Leaderboard** or **Podium** to display standings based on current
   GP. Configure the three podium prizes in the admin podium page.
9. Review **Transaksi GP** for opening balances, challenge rewards, GigaRisk and
   card effects, including before/change/after balances. Filter by team; the
   page shows the latest 500 matching transactions with WIB timestamps.

## Routes and public displays

`:challengeId?` is optional; choose a challenge on admin pages when omitted.
`/gigarisk` shows the most recently completed attack; `/gigarisk/:challengeId` shows that challenge.

Card Reveal shows selected cards at equal height, with reserved caption space so Thief and Protect target labels do not shrink their art. Beneath each targeted card, the label names the affected team; Epic Thief lists both opponents. The header badge identifies the current challenge. Team GP reflects assignment effects before the attack and the saved final balance after it.

After an attack, short card names appear in the effect panel. The numbered rotating banner shows one consumed card's saved result at a time, using `resolvedCardEffects` and per-card `cardEffects`. Companion-card effects stay on separate slides. Older archives use attributable saved activity or the action name when an exact outcome is unavailable. Completed selections and consumed cards remain visible in that challenge's history, while an untriggered Second Chance remains available for a later phase.

Serangan GigaRisk shows the full saved `Efek Kartu` activity, including incoming effects such as `-1 Dicuri oleh Biru`. Positive effects are cyan and negative effects red. Long lists wrap and scroll. Raw GigaRisk damage is represented by the balance and strike fields rather than inserted into Card Reveal's card-effect panel. Before an attack, GigaRisk shows a waiting state. Historical results are displayed without replaying effects.

Public screens follow host transitions in other tabs of the same browser.
Feature navigation opens or reuses a separate public window and publishes the
chosen screen. Flipping Connect and Jaw of Risk open their public boards from
Play; Image Decode opens its question display when a team run starts.

| Feature | Admin | Public |
| --- | --- | --- |
| Teams | `/admin` | — |
| Challenge list | `/admin/challenges` | — |
| Game | `/admin/play/:gameId/:challengeId?` | `/play/:gameId/:challengeId?` |
| Challenge scoreboard | `/admin/scoreboard/:challengeId?` | `/scoreboard/:challengeId?` |
| Leaderboard | `/admin/leaderboard` | `/leaderboard` |
| Podium | `/admin/podium` | `/podium` |
| GP transactions | `/admin/gp-transactions` | — |
| Urutan Main | `/admin/turn-order` | `/turn-order` |
| Reward Claim | `/admin/rewards/:challengeId?` | `/rewards/:challengeId?` |
| Tactical Phase | `/admin/tactical/:challengeId?` | `/tactical/:challengeId?` |
| Card Reveal | Controlled from Tactical Phase/GigaRisk | `/card-reveal/:challengeId?` |
| Serangan GigaRisk | `/admin/gigarisk/:challengeId?` | `/gigarisk/:challengeId?` |
| Event timer | `/admin/timer` | `/timer` |

Clicking an admin feature tab with a public view opens a separate public window
while keeping the admin window active. Later feature clicks update that window
without opening a duplicate or focusing it. If it is closed, the next feature
click opens a replacement. Separate public-view buttons have been removed.
Timer uses its own window, separate from the other public features. Other feature
clicks leave the timer visible and running; clicking Timer reuses its window or
reopens it if closed.
The former `/admin/presentation` URL redirects to `/admin/timer`.
Public game, reward, tactical, reveal and ranking pages display live state. Urutan Main
is interactive on its public page. The retired `/cards` and `/admin/cards`
routes are not current features; unknown routes redirect to `/scoreboard`.

## Challenges

The three seeded challenges cannot be added, renamed or deleted through the UI
or controller. Older titles migrate to current names. Internal game ids remain
stable for saved-data compatibility.

The challenge list displays Image Decode, Flipping Connect and Jaw of Risk. Image Decode includes Play, Scoreboard and its reference-deck download.

| Challenge | Game id | Current play |
| --- | --- | --- |
| Challenge 1 - Image Decode | `emoji-decode` | 11 banking clues, 15-second solo/team question timers |
| Challenge 2 - Flipping Connect | `word-assembly` | Team runs only; 20 cards, 10 pairs, live team GP; no questions or automatic scoring |
| Challenge 3 - Jaw of Risk | `jaws-of-risk` | 14 teeth, one hidden biting tooth; automatically reopens and chooses a different biting tooth after each bite |

Jaw of Risk is a fourteen-tooth toy with no questions, timer or automatic
scoring. Only admin can press a tooth; the public board is display-only. Safe
teeth stay pressed until a bite. The supplied 4.44-second GIF plays before the
mouth reopens with a different biting tooth. Round state survives reload.

The admin's left/right hand cursor and tooth highlight mirror on the public
board at the same relative position, even when the windows have different
sizes. Hover clears when the admin leaves the tooth or window. Press feedback
appears briefly in both windows. Hover, click, safe and bite sounds play in the
admin window; browsers may require an initial interaction before hover audio.
The supplied artwork, sounds and animation live in `public/ui/jaw-of-risk/`.

Clicking **Play** opens or reuses the public window and publishes Jaw of Risk
as its current feature, so an earlier scoreboard or leaderboard command cannot
redirect the toy after reload. Tactical Phase and Card Reveal also identify the
current challenge in a badge at the top right.

### Question games

Choose up to five teams. The start roulette randomizes question-game order.
Self answers score +10 correct or −10 wrong/timed out. Passing gives the
recipient +5 and the giver −10 when correct; an incorrect passed answer gives
both teams −5. Correct answers advance; unsuccessful attempts move the same
question to the next eligible team. When every team has tried, the next question
opens. Deadlines synchronize with the projector and survive its reload.

Team runs save scores and open the scoreboard when completed. **End run**
cancels early. Solo scores require manual entry because no team is selected.

### Flipping Connect

Flipping Connect only supports team runs. **Play** immediately opens or reuses
the public matching board. Choose up to five active teams and start the run;
the same public window switches to the shared board without opening a duplicate.
If a popup is blocked, Play keeps the challenge list available and displays the
browser's popup-permission instruction so the action can be retried.

The admin clicks a team name above the board to choose the active team. Matching
has no turn timer and does not use Urutan Main. Team badges show current GP on
both screens, including teams deactivated during a saved run. The waiting board
shows the current active roster and GP before a run starts.

Mismatches close automatically after 900 ms. Matching or waiting does not change
the selected team. Matched pairs retain their team's identity. All ten pairs
complete the activity on both screens without creating scores or opening
rewards. **End run** returns the public display to its waiting board. Shared
progress and selected teams survive public reload.

The 21 reference Flipping Connect questions remain seeded for compatibility and
reference decks; they are not part of the current matching-only screen.

## Ranking, GP and cards

Challenge rankings use raw game score descending. Scores are stored separately
from earned challenge points (CP). Equal scores use dense ranks: `1, 2, 2, 3, 4`.
Leaderboard and podium rank current `Team.total_gp` descending, then total earned
CP descending to break GP ties. Teams share a rank only when both GP and CP are
equal; name ordering makes exact ties stable. The podium shows the first three teams.

Leaderboard refresh reads the saved standings. Recalculation is serialized and
updates existing rows to avoid duplicate-team validation conflicts.

| Challenge rank | CP reward | GP reward | Card reward |
| --- | --- | --- | --- |
| 1 | 10 | +3 | 3 |
| 2 | 8 | +2 | 2 |
| 3 | 6 | +2 | 2 |
| 4 | 4 | +1 | 1 |
| 5 | 2 | +1 | 0 |

### Reward draw odds

N = Normal, R = Rare, E = Epic, L = Legendary. Each card drawn uses its team's rank and challenge column; these are probabilities per card, not guaranteed quantities in a small draw.

| Rank | Cards | Challenge 1 | Challenge 2 | Challenge 3 |
| --- | --- | --- | --- | --- |
| 1 | 3 | N: 55%, R: 40%, E: 3%, L: 2% | N: 47%, R: 45%, E: 5%, L: 3% | N: 50%, R: 38%, E: 8%, L: 4% |
| 2 | 2 | N: 60%, R: 40% | N: 55%, R: 45% | N: 50%, R: 50% |
| 3 | 2 | N: 90%, R: 10% | N: 85%, R: 15% | N: 80%, R: 20% |
| 4 | 1 | N: 100% | N: 100% | N: 100% |
| 5 | 0 | — | — | — |

Each reward slot rolls rarity first, then selects a remaining physical copy of
that rarity. Only rank one can roll Legendary rewards. Within the
rolled rarity, available designs not already held or selected for that team are
preferred. If only duplicate designs remain, the physical reward stays reserved
and may wait for replacement rather than violating collection uniqueness.
The eight-card capacity still applies. A reward cannot be reassigned to another
ranked team; legacy unreserved cards keep their existing assignment behavior.

If a rolled rarity is exhausted, the entire draw rolls back: no cards are
consumed and the challenge remains undrawn. Probabilities are never silently
changed to another rarity. Existing completed draws are preserved.

Built-in challenge ids select phases 1–3. Numbered custom names such as
`Challenge 2 - Bonus` or `Fase 3` select that phase; other custom challenges use
phase 1. Numbers outside 1–3 are clamped to that range.

Current GP includes the initial 5, challenge rewards, and recorded combat
changes. Score correction adjusts reward GP while preserving recorded attacks
and card effects. GP cannot become negative. The GP ledger persists attack
results so reload or leaderboard recalculation does not undo them.

The inventory contains 86 physical copies of 12 designs: 48 Normal, 24 Rare,
12 Epic and 2 Legendary. Epic Reverse has six copies (promoted from Rare Reverse);
Epic Thief has three copies (renamed from the old Epic Reverse). Epic Swallow
has three copies and replaces Epic Reflect, preserving existing card ids and ownership.
Fortune Draw has six copies, matching the other Rare designs. A team can hold eight available cards. Assignment
prevents duplicate design-and-rarity cards in its available collection. At
capacity, rewards may remain unassigned; service operations support assignment
and replacement. There is no separate collection-management route.

A team automatically becomes inactive if its final GP is 0 after GigaRisk and
all card effects finish, or a reward correction leaves it at zero. Second Chance
can revive a team before this check. All teams can also be deactivated manually
on `/admin`; use the Inactive or All teams filter to find them. Activation is
allowed only above 0 GP. Status changes survive reload and default-team seeding;
positive GP rewards do not automatically reactivate an inactive team. Inactive
teams are excluded from future active rosters and attacks. Completed GigaRisk
and Card Reveal results still include inactive participants.

Pending assignments reserve their selected cards against use in another challenge. Active cards are consumed when GigaRisk completes. Selected Second Chance is consumed only when its zero-GP revival triggers, which may happen during assignment or damage; an untriggered Second Chance is released after the attack.
Used TeamCard records remain in the reveal archive but are hidden from Tactical
Phase and excluded from earned card counts, availability and capacity calculations. Each challenge can draw
cards once and receive one attack; later score edits do not reset these limits.

| Card | Effect |
| --- | --- |
| Normal Heal | Add 2 GP |
| Normal Shield | Block 1 GP of the strike |
| Normal Thief | Take up to 1 GP from a selected opponent |
| Rare Heal | Add 3 GP |
| Rare Protect | Block the strike for a selected team (including its owner) |
| Epic Reverse (formerly Rare Reverse) | Take up to 1 GP from each opponent |
| Rare Thief | Take up to 2 GP from a selected opponent |
| Rare Fortune Draw | Choose one of three shuffled Rare cards; receive it after the attack for a later phase |
| Epic Swallow | Swallow the incoming GigaRisk strike and gain a fixed +4 GP |
| Epic Thief (formerly Epic Reverse) | Take up to 2 GP from each of two selected opponents, up to +4 GP total |
| Legendary Gardian Unity | Only when a team uses this card: add 1 GP to every team at assignment and protect every team during the strike |
| Legendary Second Chance | When selected by its owner, automatically restore 1 GP at zero; consume only on activation |

Effects follow the definitions in `src/data/card-pool.ts` and `public/cards/`.
Heal, Reverse and Thief apply at assignment. Shield, Protect and Swallow apply at damage time. Second Chance triggers immediately when the strike or a transfer reduces its owner to zero, once per selected card. Owning or skipping the card does not activate it; selecting it occupies one of the two selection slots. Transfers
cannot take more than an opponent's remaining GP. No valid tactical decisions
means no GP changes, no consumption and no completed-attack marker.

Epic Thief requires two different opponents; the target selectors exclude the
other selection, and attack validation rejects missing, duplicate and self
targets. Normal/Rare Thief keep one target. Epic Reverse targets all opponents
automatically and retains its original one-GP effect. Swallow gains nothing
from damage that Gardian Unity or targeted Protect prevents entirely. Rare Protect requires one valid target, which can be its owner or another team.

Startup migrates `Rare Reverse Card #NN` to `Epic Reverse Card #NN`, and the old
`Epic Reverse Card #NN` with the two-GP-from-every-opponent description to
`Epic Thief Card #NN`. The description distinguishes old and new Epic Reverse
cards so repeated startups do not rename promoted cards again. Physical-copy
ids, ownership, challenge links, draw state and consumed-card ids are preserved.
Startup also renames Epic Reflect to Epic Swallow and updates its printed action.
Completed attack results and GP transactions are historical and are not replayed;
archived public effect labels display Swallow without changing historical balances.

The card definitions match the supplied PNGs, including `Epic_Swallow Card.png`
(SWALLOW, +4 GP), `Epic_Reverse Card.png` (1 GP from every opponent),
`Epic_Thief Card.png` (2 GP from two opponents), and `Rare_Fortune_Draw Card.png`
(“Ambil 1 dari 3 kartu.”). The old Reflect and Rare Reverse images are retired.

Selecting Fortune Draw in admin Tactical Phase shuffles three remaining Rare
physical copies and shows a choice panel. Different designs are preferred;
when fewer designs are eligible, multiple copies of a design may appear.
Already-owned designs and Fortune Draw itself are excluded. The offer and
selection survive reload, deselection and SKIP, so these actions do not reroll it.
Choose exactly one before attacking. Offers do not remove cards from the deck;
the chosen copy is revalidated and assigned atomically with the GP ledger.
If another draw takes that copy first, choose another saved option. If fewer
than three eligible copies remain, selection reports the shortage without
consuming the Fortune card. The two unchosen copies stay available.
The reward does not execute its effect in the same attack, respects the eight-card
limit and design uniqueness, and is shown in the reveal slide and GigaRisk effect
ledger. Normal challenge reward counts and rarity probabilities stay unchanged.
Startup and combat synchronize database writes across windows, preventing a
public screen opened during an attack from overwriting a newly awarded card.

## Timer and visual references

The event timer is a standalone admin/public screen, independent of challenge
slides. Admins configure 1–5999 seconds and can start, pause or reset the timer.
Its deadline is saved locally, so the countdown continues across page changes and
reloads. `/timer` is a read-only 16:9 display with the selected challenge,
active teams and a Giliran marker. Choose the challenge and active team in the
timer controls; those selections survive pause, reset and reload and synchronize
with the public display. The runtime artwork is `presentation-timer-clean.png`,
based on `presentation-timer-no-banner.png`, with live text and team panels. The old
`/admin/presentation` path redirects to the timer for saved links; `/` now opens
the scoreboard. There is no slide navigation or public slideshow feature.

`public/ui/Visual_Guide_App-Game_5.pptx` and the supplied scoreboard JPEG provide reference artwork:

| Slide | Feature | Reference asset |
| --- | --- | --- |
| 1 | Urutan Main | `visual-guide-slide-01.png` |
| 4 | Scoreboard | `Page_Score_Board.jpeg` (including the GP footer) |
| 8 | Serangan GigaRisk | `visual-guide-slide-08.png` |
| 9 | Leaderboard | `visual-guide-slide-09.png` |
| 10 | Podium | `podium-clean.png`, derived from `visual-guide-slide-10.png` |

Scoreboard displays five team GP panels below its main ranking box, following
`Page_Score_Board.jpeg`. They show current live Team GP on admin/public views,
with participating teams first and remaining active teams filling empty slots.

Podium uses `podium-clean.png`, preserving the black jilbab and blank award
plaques. Full icons from `public/ui/Icon rank/` follow actual GP/CP ranks,
including matching medal colours for ties. Names, GP and prizes scale inside
the illustrated plaques; admin prize inputs use a responsive three-column grid.
Names and GP use transparent overlays so the original plaque artwork stays visible.
Text scales to fit longer values; very long names use an ellipsis with the
full name available as a tooltip. Fixed badge artwork and prize placeholder text
are removed from the background; live badges and transparent prize text replace
them without rectangular patches or overlapping digits.

Tactical Phase and Card Reveal use `tactical-slide-05-reference.png` and
`tactical-slide-06-reference.png`. Live overlays render teams, cards and values.
Card Reveal preserves card proportions and aligns team/status/effect/GP rows;
the effects area has extra space for two selected-card descriptions. Longer
effects wrap and scroll inside their team panel. Card backs preserve their
proportions in Tactical Phase and rankings, and long team names use ellipses
inside their pills and Flipping team buttons. Long leaderboard effect lists
scroll within their row rather than expanding the reference table. Public layouts fit both
wide and 390-pixel viewports. Admin controls sit outside challenge artwork.
Admin toolbars wrap inside their panels; long headings and labels stay within
the viewport. UI checks cover all current routes at desktop/mobile widths,
including the standalone timer, direct Image Decode and Jaw of Risk pages and GP transactions.

## Data and offline operation

SQLite runs in WASM and is stored as bytes in IndexedDB (`guard-the-heart`,
store `sqlite`, key `database`). ORM models are defined in `src/models/index.ts`.
Existing raw CP values migrate into the new `ChallengePoint.score` column,
then CP/GP rewards are recalculated from ranks. Recorded combat remains intact.

Tactical selections, completed-attack archives, draw markers, turn order,
standalone timer/run state and podium prizes also use localStorage.

Keep IndexedDB and localStorage together when preserving an event. Clearing
browser site data removes local scores and history. Data does not synchronize
across devices, origins or separate browser profiles. The admin interface has
no authentication layer.

Database events use BroadcastChannel with a localStorage fallback. Public
transitions flush SQLite and refresh the receiving tab's saved database. Browser
locks serialize draw/attack actions per challenge where available. sql.js export
preserves foreign-key enforcement, and refreshed connections enable it.

The production service worker precaches application assets, including the small
Jaw of Risk MP3 files. Its 63 MB bite GIF uses a separate runtime cache after a
successful service-worker-controlled load, avoiding a large install-time download.
Large source PowerPoint decks are excluded from the precache. Deploy `dist/` to host the PWA. The leaderboard's
**Save offline copy** flushes local storage; it is not a downloadable backup of
both IndexedDB and localStorage.

Production JavaScript is split into application and vendor chunks, with browser
shims kept alongside vendor dependencies. Both chunks are precached for offline
use and stay below the existing build warning limit; this separates caching
without materially reducing the total startup download.

## Source map and maintenance

| Location | Responsibility |
| --- | --- |
| `src/models/`, `src/controllers/` | ORM schema and UI operations |
| `src/db/` | WASM driver, persistence, initialization and migrations |
| `src/services/scoreboardAggregator.ts` | Score rankings, earned-CP totals, available-card totals, GP synchronization |
| `src/services/gpTransactions.ts` | GP ledger and durable combat balance changes |
| `src/services/tacticalPhase.ts` | Selection, effect resolution, consumption and once-only attack |
| `src/services/cardDraw.ts` | Card pool, atomic draws, recipient reservations, ownership and capacity |
| `src/services/cardDrawRules.ts` | Challenge phase and rank-specific rarity percentages |
| `src/services/games/` | Game rules and synchronized runs |
| `src/services/publicDisplay.ts`, `eventTimer.ts`, `turnOrder.ts` | Public display navigation, timer and order |
| `src/views/`, `src/styles/` | Feature screens and responsive styles |
| `src/views/challenges/useCrocodileHover.ts` | Transient admin-to-public hand and tooth-hover synchronization |
| `src/data/`, `public/` | Question bank, card definitions, reference art and decks |
| `tests/`, `e2e/` | Unit/database and browser regressions |

`python scripts/import-reference-questions.py` imports reference questions into
`src/data/reference-question-bank.json`. Startup seeds 52 rows: 11 Image Decode,
21 retained Flipping Connect and 20 Jaw of Risk. Image Decode question 11 is
**Lapor** (KDO clue). Source slide metadata and answer positions are retained.

For schema and implementation rules, see [blueprint.md](./blueprint.md).

## Verification

Verified on 2026-10-19 (WIB): **204 unit/database tests across 19 files and all
44 browser scenarios passed**, together with ESLint and the TypeScript/production
build. Playwright builds the production app before starting its preview server.

Run from the repository root:

```sh
npm run typecheck
npm run lint
npm test
npm run test:e2e -- --workers=2
```

Coverage includes team CRUD and activation, default-team protections, Image
Decode scoring and timeouts, reward rarity/ownership/capacity rules, all twelve
card actions, Fortune Draw persistence, reversible tactical assignment, GigaRisk
and GP ledger persistence, and once-only attacks/draws.

Display checks cover team-only Flipping Connect with immediate Play/public
handoff and live GP, admin-only fourteen-tooth Jaw of Risk with mirrored hover,
supplied hand/sound/bite assets, timer challenge/team synchronization, full
podium rank/tie badges and large prize labels, public-window reuse/reopening,
offline reload and 1280/390-pixel layouts. Jaw of Risk also stays on its game
screen after a previous public feature and after public reload.

Browser fixtures use deterministic rarity rolls where exact collections are
required. Automated checks validate these implemented scenarios; they do not
establish exhaustive coverage of every device or simultaneous admin-edit sequence.
See [blueprint.md](./blueprint.md#validation-record) for implementation and validation details.
