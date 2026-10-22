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
main presentation. The standalone scoreboard remains at `/scoreboard`.
Configure and run the standalone event timer at `/admin/timer`; its
public display is `/timer`. Production hosting must serve `index.html` for application routes.

### Main Presentation

Open **Main Presentation** in the admin navigation (`/admin/presentation`) to
project the six supplied images from `public/ui/main-presentation` at `/`.
`/presentation` redirects to `/` for saved links. Slide 7 is the live Image Decode
Scoreboard, immediately after Image Decode — Cara Bermain. It displays current
challenge scores and team GP, updates as scores change, and remains part of the
presentation without navigating away from the home page.
The Scoreboard initially shows all teams alphabetically, with a dash for scores
not yet recorded. Once all five teams have scores (including a recorded zero),
it switches to rank order and shows each team's rank badge. Tied scores retain
their shared rank. Removing a score returns the board to alphabetical order.
Use Previous/Next, the slide selector, or a thumbnail; arrow keys,
Page Up/Page Down, Home and End also work when a control is not focused. Slide
selection is saved and synchronizes with the shared public window. The Timer
keeps its separate window. Fullscreen preview enlarges the admin's slide preview.

### Fortune Draw

In **Tactical Phase**, admin always sees the Fortune Draw option faces and names.
**Public view: closed cards** is checked by default; uncheck it to show option
faces publicly. This setting synchronizes and survives reload without rerolling
the offer. The selected card stays open in either mode. Choose one option on admin
or public **Card Reveal**; the final reward and its effect persist across reloads.
Challenge 1–2 offers two Normal and one Rare. Challenge 3 adds one Epic for
rank 1. Rare is limited to ranks 1–3; rank 4–5 Fortune users receive eligible
Normal options. No repeated effect appears within an offer; shortages show fewer
eligible cards rather than duplicate fillers. Rewards are available next challenge.

### Reward Claim

Reward Claim shows each team's earned cards for the selected challenge and
current GP balance. The challenge GP bonus is labeled separately below the panel.
Cards retain their original left starting position with consistent spacing; they
are not centered or stretched across the row. Fixed card slots preserve artwork
proportions, and separate GP tracks keep icons and values aligned. The public
challenge name is a read-only badge; the admin selects the challenge. Rank badges
fit inside their colored rows and the illustrated frame. Public Reward Claim
uses a concrete 16:9 wrapper bounded by both viewport width and height, preserving
the full artwork on short laptop screens.

Rank 5 receives two Normal options and one False Hope (Zonk), shuffled and saved
once. Only the admin can choose, with all three faces visible in the admin view.
Public option buttons remain disabled, with three backs until selection.

| State | Admin | Public |
| --- | --- | --- |
| Before selection | Open cards; pointer cursor; click one option | Closed cards; pointer cursor; no selection action |
| Admin hover or keyboard focus | Highlights the option | Shows a hand pointer on the matching card without opening it |
| Admin clicks | Submits the final choice | Immediately removes the mirrored pointer, then opens only the chosen card |
| After selection or reload | All options disabled with a forbidden (`not-allowed`) cursor | Chosen card retains its outline; no mirrored pointer; all options use the forbidden cursor |

Leaving an option or the admin Reward Claim view clears the temporary public
pointer. Picking Normal grants exactly one inventory card; picking Zonk grants
none. Unchosen physical cards return to the deck. A Normal reward can be selected
in the current challenge's Tactical Phase; Fortune Draw gifts are available next
challenge. Existing unfinished draws receive missing offers when Reward Claim
opens; completed rounds retain their history.

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
   the scoreboard. For rank 5, select one of the three open cards on the admin
   Reward Claim screen; the public view mirrors the hover and chosen result.
6. From **Rewards**, open **Tactical Phase**. Owned cards are grouped by the
   challenge that awarded them. Only available cards are listed. Select
   up to two available cards from any challenge, by clicking or dragging, or choose **Skip**.
   The public and admin Tactical Phase hide used cards from available inventory and action panels. The Selected cards area retains
   that challenge’s locked selections after the attack and across reloads. Available cards and selections are shown face-up.
   Completed Card Reveal pages retain the played cards as history.
   Selecting, retargeting, deselecting or skipping cards does not change GP. Heal, Thief, Reverse and Gardian Unity change GP once on Card Reveal. Fortune Draw awards its confirmed card for another challenge.
   **Card Reveal** displays those selections without applying an attack.
7. In **Tactical Phase**, choose an opponent for each
   Normal/Rare Thief card, or one or two distinct opponents for Epic Thief, then click
   **Serang semua tim −2 GP**. The attack and selected
   defenses apply once. Heal, Thief, Reverse and Unity already applied on Card Reveal; the attack does not repeat them. An empty tactical phase blocks the attack with a message;
   explicit SKIP is a valid decision. Used cards leave available inventory.
   Rare Protect covers its owner and the selected target; selecting the owner protects that team once. Second Chance is passive and cannot be selected; it revives once after damage if GP is zero.
   **Serangan GigaRisk** displays the saved attack result and each team’s complete incoming/outgoing effect activity.
   Applying the attack opens Card Reveal with animated played cards and resolved
   effects. Reduced-motion settings disable the animation.
8. Show **Heart of Awareness** for live active-team GP plaques, or **Leaderboard**
   for the full standings, including inactive teams marked OUT. **Podium** ranks
   the top three active teams by GP, then CP. Configure its three prizes on the
   admin podium page.
9. Review **Transaksi GP** for opening balances, challenge rewards, GigaRisk and
   card effects, including before/change/after balances. Filter by team; the
   page shows the latest 500 matching transactions with WIB timestamps.

## Routes and public displays

`:challengeId?` is optional; choose a challenge on admin pages when omitted.
`/gigarisk` shows the most recently completed attack; `/gigarisk/:challengeId` shows that challenge.

Card Reveal shows selected cards at equal height, with reserved caption space so Thief and Protect target labels do not shrink their art. Beneath each targeted card, the label names the affected team; Epic Thief lists both opponents. The header badge identifies the current challenge. Team GP stays unchanged during selection, updates once for reveal-time effects, then shows the saved final balance after the attack.

After an attack, short card names appear in the effect panel. The numbered rotating banner shows one consumed card's saved result at a time, using `resolvedCardEffects` and per-card `cardEffects`. Companion-card effects stay on separate slides. Older archives use attributable saved activity or the action name when an exact outcome is unavailable. Completed selections and consumed cards remain visible in that challenge's history, while an untriggered Second Chance remains available for a later phase.

Card Reveal labels its rotating effect log with the current effect name, such as
**Swallow**, **Thief**, **Heal** or **Protect**. Hover or keyboard-focus a revealed
card to pin its log entry and animate the GP of its owner and affected teams.
Unapplied effects are previews; applied reveal and completed effects replay their saved outcomes.
Transfers replay saved amounts rather than taking GP again. Shield and Protect
show blocked damage. Fortune Draw does not animate GP because it awards a card.
Moving away, leaving focus or pressing Escape restores the saved GP display.
Hovering never saves scores, applies effects or changes team balances.
Revealed cards animate
according to their effect: Heal rises, Shield pulses, Protect surrounds the card,
Swallow draws inward, Thief transfers particles, Reverse rotates, Gardian Unity
links, Second Chance rises with a star, and Fortune Draw sparkles. Reduced-motion
preferences replace movement with a static symbol.

Serangan GigaRisk shows GP only after **Serang semua tim −2 GP** completes. Each
row displays the saved final GP, a numeric strike outcome on an orange/red boom
badge (−1 Shield, 0 Protect/Unity, −2 ordinary damage, +4 Swallow), and saved card
effects in aligned columns. Icons, right-aligned GP numbers and GP labels use
fixed tracks with tabular digits, so different digit counts cannot shift them.
The badge tooltip retains the defense name. Saved card activity includes incoming
effects such as `-1 Dicuri oleh Biru`. The screen does not show a before/after comparison or a
health bar. Positive effects are cyan and negative effects red. Long lists wrap
and scroll. Before an attack, teams show a waiting message without GP totals.
Historical results are displayed without replaying effects.

Public screens follow host transitions in other tabs of the same browser.
Feature navigation opens or reuses a separate public window and publishes the
chosen screen. Flipping Connect and Jaw of Risk open their public boards from
Play; Image Decode opens its question display when a team run starts.

| Feature | Admin | Public |
| --- | --- | --- |
| Main Presentation | `/admin/presentation` | `/` (`/presentation` redirects here) |
| Teams | `/admin` | — |
| Challenge list | `/admin/challenges` | — |
| Game | `/admin/play/:gameId/:challengeId?` | `/play/:gameId/:challengeId?` |
| Challenge scoreboard | `/admin/scoreboard/:challengeId?` | `/scoreboard/:challengeId?` |
| Leaderboard | `/admin/leaderboard` | `/leaderboard` |
| Heart of Awareness | `/admin/heart-of-awareness` | `/heart-of-awareness` |
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
Main Presentation uses `/admin/presentation` for controls and `/` for its public
display; the former `/presentation` public URL redirects to `/`.
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

Unmatched pairs stay open for 5 seconds, with a visible countdown on admin and
public boards. The absolute close deadline survives reload; team selection is
locked until the pair closes. Matched pairs stay open. Matching or waiting does not change
the selected team. Matched pairs retain their team's identity. All ten pairs
complete the activity on both screens without creating scores or opening
rewards. **End run** returns the public display to its waiting board. Shared
progress and selected teams survive public reload.

The 21 reference Flipping Connect questions remain seeded for compatibility and
reference decks; they are not part of the current matching-only screen.

## Team colors

Team identity colors are defined once in `src/styles/team-colors.css` and shared
by admin/public team badges, reward labels, Tactical Phase/Card Reveal, timer and
Flipping Connect. Active turns retain the team color and add a turn marker/outline.
Rows retain their lighter background tints for readable card and effect content.

| Tim | Warna |
| --- | --- |
| Merah | `#ff2424` |
| Biru | `#43b3ff` |
| Kuning | `#ffd039` |
| Hijau | `#5aff7d` |
| Pink | `#ff1585` |

## Ranking, GP and cards

Challenge rankings use raw game score descending. Scores are stored separately
from earned challenge points (CP). Equal scores use dense ranks: `1, 2, 2, 3, 4`.
Leaderboard and podium rank current `Team.total_gp` descending, then total earned
CP descending to break GP ties. Teams share a rank only when both GP and CP are
equal; name ordering makes exact ties stable. The leaderboard includes inactive
teams. The podium ranks active teams and shows its first three; tied winners
use the same rank number and medal colour.

Leaderboard restores the earlier 16:9 `visual-guide-slide-09.png` canvas and follows its seven-column table: rank, team, initial GP,
GigaRisk attack, card effects, final GP, and remaining cards. CP labels are
hidden on the leaderboard; earned CP still breaks GP ties. The shared GP icon
uses the supplied `gp-shield.png` through the shared `GPShield` component on leaderboard, scoreboard, rewards, Tactical Phase, Card Reveal, GigaRisk, Heart of Awareness and podium screens. Heart of Awareness uses the full `Heart_of_Awareness.png`
artwork (with sample text and embedded GP icons removed in `heart-of-awareness-no-gp.png`) with five live GP plaques in green, red, yellow, blue, and pink order.
Its admin tab opens the synchronized public screen; additional active teams
appear on subsequent five-team canvases. Empty slots show a dash.

Leaderboard keeps GP unchanged while selections are pending, then shows the final attack result and effects. Remaining-card counts come from live available inventory. Leaderboard refresh reads the saved standings. Inactive teams remain visible
on both leaderboard views with an OUT badge and faded row, including teams
manually deactivated while GP remains above zero. Zero-GP teams also show OUT. Recalculation is serialized and
updates existing rows to avoid duplicate-team validation conflicts.

| Challenge rank | CP reward | GP reward | Card reward |
| --- | --- | --- | --- |
| 1 | 10 | +3 | 3 |
| 2 | 8 | +2 | 2 |
| 3 | 6 | +2 | 2 |
| 4 | 4 | +1 | 1 |
| 5 | 2 | +1 | 1 blind draw |

### Reward draw odds

N = Normal, R = Rare, E = Epic, L = Legendary. Each card drawn uses its team's rank and challenge column; these are probabilities per card, not guaranteed quantities in a small draw.

| Rank | Cards | Challenge 1 | Challenge 2 | Challenge 3 |
| --- | --- | --- | --- | --- |
| 1 | 3 | N: 57%, R: 40%, L: 3% | N: 52%, R: 45%, L: 3% | N: 51%, R: 38%, E: 8%, L: 3% |
| 2 | 2 | N: 59%, R: 40%, L: 1% | N: 54%, R: 45%, L: 1% | N: 49%, R: 50%, L: 1% |
| 3 | 2 | N: 90%, R: 10% | N: 85%, R: 15% | N: 80%, R: 20% |
| 4 | 1 | N: 100% | N: 100% | N: 100% |
| 5 | 1 blind draw | 2 Normal + 1 Zonk | 2 Normal + 1 Zonk | 2 Normal + 1 Zonk |

Each reward slot rolls rarity first, then selects a remaining physical copy of
that rarity. Rank 1 rolls Legendary at 3%, rank 2 at 1%. Epic random draws are limited to rank 1 in Challenge 3. Within the
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

The new deck contains 60 physical cards: 33 Normal (11 each Shield, Heal,
Thief), 16 Rare (4 each Heal, Protect, Thief, Fortune Draw), 8 Epic (3 Reverse,
3 Thief, 2 Swallow), and 3 Legendary (2 Gardian Unity, 1 Second Chance).
Reducing counts retires only undrawn excess copies; existing earned cards and
completed history are preserved. A team can hold eight available cards. Assignment
prevents duplicate design-and-rarity cards in its available collection. At
capacity, rewards may remain unassigned; service operations support assignment
and replacement. There is no separate collection-management route.

A team automatically becomes inactive if its final GP is 0 after GigaRisk and
all card effects finish, or a reward correction leaves it at zero. Second Chance
can revive a team before this check. A team reduced to zero by this phase’s
immediate transfers is reactivated if the same phase’s deferred effects restore
positive GP; this does not reactivate a manually inactive team. All teams can also be deactivated manually
on `/admin`; use the Inactive or All teams filter to find them. Activation is
allowed only above 0 GP. Status changes survive reload and default-team seeding;
positive GP rewards do not automatically reactivate an inactive team. Inactive
teams are excluded from future active rosters and attacks. Completed GigaRisk
and Card Reveal results still include inactive participants.

Pending selections reserve cards against reuse in another challenge. Selecting or
targeting changes no GP. **Card Reveal** commits Heal (+2 Normal / +3 Rare),
Thief (1 Normal / 2 Rare / 2 Epic per target), Reverse (+1 from each opponent),
and Gardian Unity (+1 to every active team) exactly once and locks selections.
Theft is capped by the target’s available balance. Epic Thief accepts one or two
opponents. Reveal effects persist through reload and never repeat at damage.

After **Serang semua tim −2 GP**, Normal Shield reduces damage to −1;
Protect prevents damage for owner and chosen team; Gardian Unity prevents damage
for all active teams; Swallow prevents damage and gains 4 GP. Second Chance is
passive, cannot occupy a Tactical Phase selection, and revives its owner to 1 GP
once after damage if GP reaches zero. It remains in inventory until triggered.
Completed rounds are read from saved results without replaying effects.

Fortune Draw and rank 5 offers are saved before display and settle atomically
with at most one inventory grant. Fortune Draw gifts cannot activate in the same
challenge; a Normal rank 5 reward follows ordinary Tactical Phase availability.
False Hope grants no inventory card.
Existing card art lives in `public/cards/`, including `Zonk_False_Hope Card.png`.

## Timer and visual references

The event timer is a standalone admin/public screen, independent of challenge
slides. Admins configure 1–5999 seconds and can start, pause or reset the timer.
Its deadline is saved locally, so the countdown continues across page changes and
reloads. `/timer` is a read-only 16:9 display with the selected challenge,
active teams and a Giliran marker. Choose the challenge and active team in the
timer controls, or click a team name directly on the admin timer artwork. Team
buttons also support keyboard activation and reflect the active selection. Changing
teams updates the Giliran marker and dropdown without restarting the countdown;
selections survive pause, reset and reload and synchronize with the read-only
public display. The runtime artwork is `presentation-timer-clean.png`,
based on `presentation-timer-no-banner.png`, with live text and team panels.
Main Presentation is a separate feature at `/admin/presentation`; its public
slideshow is the home page `/`, including the live Scoreboard after the rules.

`public/ui/Visual_Guide_App-Game_5.pptx` and the supplied scoreboard JPEG provide reference artwork:

| Slide | Feature | Reference asset |
| --- | --- | --- |
| 1 | Urutan Main | `visual-guide-slide-01.png` |
| 4 | Scoreboard | `Page_Score_Board.jpeg` (including the GP footer) |
| 8 | Serangan GigaRisk | `visual-guide-slide-08.png` |
| 9 | Leaderboard | `visual-guide-slide-09.png`, restored 16:9 layout |
| 10 | Podium | `podium-no-gp.png`, derived from `podium-clean.png` and Visual Guide slide 10 |

Scoreboard displays five team GP panels below its main ranking box, following
`Page_Score_Board.jpeg`. They show current live Team GP on admin/public views,
with participating teams first and remaining active teams filling empty slots.

Podium uses `podium-no-gp.png`, derived from `podium-clean.png`, preserving
the black jilbab and blank award plaques. Embedded GP icons are removed; live
`gp-shield.png` icons sit inside the original score compartments. Full icons from `public/ui/Icon rank/` follow actual GP/CP ranks,
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
waiting labels stay centered inside their status badges without wrapping out.
The effects area has extra space for two selected-card descriptions. Longer
effects wrap and scroll inside their team panel. Card backs preserve their
proportions in Tactical Phase and rankings, and long team names use ellipses
inside their pills and Flipping team buttons. Long leaderboard effect lists
scroll within their row rather than expanding the reference table. Public layouts fit
desktop, tablet and phone viewports. Admin controls sit outside challenge artwork.
Admin toolbars wrap inside their panels; long headings and labels stay within
the viewport. Mobile team cards group status and GP badges above three evenly
sized action buttons. Tactical Phase keeps its selection guidance short; expand
**Card timing and targeting rules** for full effect and targeting instructions.
Challenge team selectors use full-width click areas with selected and keyboard
focus states, including Flipping Connect.
UI checks cover all current routes at 1366×600, 1280×800, 768×800 and 390×844, including both
Heart of Awareness views, the standalone timer, direct Image Decode and Jaw of
Risk pages and GP transactions.

## Data and offline operation

SQLite runs in WASM and is stored as bytes in IndexedDB (`guard-the-heart`,
store `sqlite`, key `database`). ORM models are defined in `src/models/index.ts`.
Existing raw CP values migrate into the new `ChallengePoint.score` column,
then CP/GP rewards are recalculated from ranks. Recorded combat remains intact.

Tactical selections, completed-attack archives, draw markers, turn order,
standalone timer/run state and podium prizes also use localStorage. Reward Claim
uses a separate transient localStorage pointer message for admin hover/focus; it
is not an earned reward or a GP transaction.

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
**Save offline copy** flushes SQLite bytes to IndexedDB; it is not a downloadable backup of
both IndexedDB and localStorage.

Production JavaScript is split into application and vendor chunks, with browser
shims kept alongside vendor dependencies. Both chunks are precached for offline
use and stay below the existing build warning limit; this separates caching
without materially reducing the total startup download.

## Startup troubleshooting

If a laptop shows **Failed to start the database: Tim tidak ditemukan**, an old
completed-attack archive may reference team ids absent from its current SQLite
database. Browser data is local to each origin/profile, so another laptop can
have a different database or older cached application code.

Startup imports historical GP only for team ids that still exist. Missing team
entries remain in their original archive and do not block startup or change the
GP of newly seeded teams. Existing participants are imported once. New attacks
still reject missing participants and roll back their transaction. Regression
tests also delete a real team and recreate the same name, ensuring its old GP
never transfers to the replacement. Browser checks recreate SQLite while keeping
localStorage, open two tabs together and reload both to detect startup regressions.

Use the updated application build on the affected laptop, retaining the same
URL/profile. For an installed PWA, open it online and reload after the updated
version is available. If each laptop runs its own source checkout, update that
checkout and rebuild/restart its local app. Updating one laptop's checkout does
not update another laptop or an already deployed site. Keep IndexedDB and
localStorage intact; clearing site data would remove local scores and history.

## Source map and maintenance

| Location | Responsibility |
| --- | --- |
| `src/models/`, `src/controllers/` | ORM schema and UI operations |
| `src/db/` | WASM driver, persistence, initialization and migrations |
| `src/services/scoreboardAggregator.ts` | Score rankings, earned-CP totals, available-card totals, GP synchronization |
| `src/services/gpTransactions.ts` | GP ledger, once-only reveal settlement, Fortune choices and durable combat balances |
| `src/services/fortuneDraw.ts` | Distinct mixed-rarity offers, rank eligibility and one-time atomic grants |
| `src/services/blindRewards.ts` | Rank 5 saved blind draws, Normal/False Hope outcomes and one-time settlement |
| `src/controllers/ScoreboardController.ts` | Saved standings and live remaining-card counts |
| `src/services/tacticalPhase.ts` | Selection, effect resolution, consumption and once-only attack |
| `src/services/cardDraw.ts` | Card pool, atomic draws, recipient reservations, ownership and capacity |
| `src/services/cardDrawRules.ts` | Challenge phase and rank-specific rarity percentages |
| `src/services/games/` | Game rules and synchronized runs |
| `src/services/publicDisplay.ts`, `eventTimer.ts`, `turnOrder.ts` | Public display navigation, timer and order |
| `src/views/`, `src/styles/` | Feature screens and responsive styles |
| `src/views/RewardClaimPublicView.tsx`, `src/styles/rewards.css` | Earned reward rows, admin-only rank 5 choice, public hand pointer and locked cursors |
| `src/services/mainPresentation.ts`, `src/views/MainPresentationView.tsx` | Saved slideshow selection and live scoreboard slide |
| `src/services/cardGPPreview.ts`, `src/views/AnimatedTeamGP.tsx` | Read-only GP previews and animated displayed values |
| `src/views/HeartAwarenessView.tsx` | Active-team GP plaques and matching admin/public canvases |
| `src/views/GPShield.tsx`, `src/styles/gp-shield.css` | Shared supplied GP shield asset and proportional sizing |
| `src/views/challenges/useCrocodileHover.ts` | Transient admin-to-public hand and tooth-hover synchronization |
| `src/data/`, `public/` | Question bank, card definitions, reference art and decks |
| `tests/`, `e2e/` | Unit/database and browser regressions |

`python scripts/import-reference-questions.py` imports reference questions into
`src/data/reference-question-bank.json`. Startup seeds 52 rows: 11 Image Decode,
21 retained Flipping Connect and 20 Jaw of Risk. Image Decode question 11 is
**Lapor** (KDO clue). Source slide metadata and answer positions are retained.

For schema and implementation rules, see [blueprint.md](./blueprint.md).

## Verification

Team palette follow-up on **2026-10-21 (WIB)**: all 12 targeted browser scenarios
passed. Exact computed colors were checked on admin/public labels, including
reordered reward ranks, timer active turns and Flipping Connect. ESLint, TypeScript
and the production/PWA build passed. The full-suite baseline below was not rerun
for this presentation change.

Reward Claim frame follow-up on **2026-10-21 (WIB)**: all 11 targeted browser
scenarios passed. Route checks cover admin/public pages at 1366×600, 1280×800,
768×800 and 390×844; public canvases must fit both viewport axes. Populated reward
rows are checked through 1920 pixels, including medals, cards, GP, choice captions
and the mirrored hand cursor. Both reward outcomes passed a final cursor-bound
recheck. ESLint, TypeScript and production/PWA builds passed. These are targeted
UI checks; the full-suite baseline below was not rerun for this CSS change.

Timer team-selection follow-up on **2026-10-21 (WIB)**: all 4 timer browser
scenarios passed, including click/keyboard selection, dropdown/public synchronization
and unchanged running deadlines. ESLint, TypeScript and production/PWA build passed.
The full-suite results below remain the baseline; this UI change used targeted checks.

Latest full verification on **2026-10-20 (WIB)**:

| Check | Result |
| --- | --- |
| ESLint and TypeScript | Passed |
| Complete unit/database suite | 264 tests passed across 24 files |
| Complete browser suite | 60 scenarios passed, with no skips, failures or flaky results |
| Production/PWA build | Passed through Playwright's build-and-preview workflow |
| Markdown | Local links, anchors and fenced blocks checked |

Startup regression coverage includes missing archived team ids, mixed existing and
missing participants, idempotent imports, real team deletion followed by a new
team with the same name, strict live-attack rollback, both completed `resolution`
and legacy `strike` archives, SQLite recreation with localStorage retained, and
two tabs opening/reloading together. Recovery must preserve original history and
valid balances without attaching old GP to replacement teams.

The complete browser run also checks reward selection/cursors, Fortune Draw,
reveal/attack timing, GP persistence, rankings, all three games, presentation,
timer, public-window reuse, offline reload and responsive layouts. It replaces
the earlier 57-scenario baseline and targeted startup follow-up as the latest
full browser verification. These regression cases run as part of the normal
`npm test` and `npm run test:e2e` suites.

Run application checks from the repository root:

```sh
npm run typecheck
npm run lint
npm test
npm run test:e2e -- --workers=2
npm run build
```

Coverage includes team CRUD/status, default-team protections, dense rankings,
score correction, reward rarities and limits, rank 5 blind draws, Fortune display
modes and final choices, all card effects, reveal-time GP, passive Second Chance,
GigaRisk, saved GP ledger, public-window reuse, presentation, game boards, timers,
responsive layouts and offline reload. Tests validate these scenarios; they cannot
guarantee every possible device or simultaneous edit sequence.

See [blueprint.md](./blueprint.md#validation-record) for the implementation and audit.


### Shared live GP panels and card-close countdown (2026-10-22 WIB)

Timer, Scoreboard and Reward Claim use `TeamGPBadge` with the shared brown/orange
frame, exact team colour, GP shield and aligned numeric balance. `TeamPill` is
shared separately; styles live in `src/styles/team-gp.css`. Reward Claim shows
**current team GP**, including later card effects and damage, and labels the
challenge bonus separately as **Hadiah +N GP**. Cards retain their left alignment.
Timer and Flipping Connect leave a visible gap above the Giliran marker.
The empty scoreboard message �No entries for this challenge yet.� is removed.

Flipping Connect unmatched pairs remain open for 5 seconds, with a synchronized
admin/public countdown. Reload does not restart the delay. Matching pairs remain
visible; closing a mismatch does not rotate teams or award points. Legacy saved
unmatched pairs receive a close deadline when resumed.

Regression coverage includes `tests/matching-close.test.ts`,
`e2e/team-panels.spec.ts` and the Flipping, timer, palette and frame-bound tests.

Validation: ESLint and TypeScript passed; all 266 unit tests passed. The full
63-scenario browser suite and targeted reruns cover the updated panels,
countdown, reward selection, game flows and responsive admin/public layouts.
