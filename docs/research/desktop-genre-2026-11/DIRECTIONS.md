# Desktop companion games on Steam: market review and directions

Data pulled 11 November 2026. `genre.csv` in this folder holds the dataset (262 games; 195 classified by hand, 67 by keyword rule and flagged `auto`).

## Where the numbers come from

- **Review counts and % positive:** Steam directly (review histogram, all languages).
- **Census:** Steam store search on the "Desktop Companion" tag (872 games) plus store details for 970 apps.
- **Praise and complaints:** the top-rated positive and negative Steam reviews of 79 games (738 and 602 reviews).
- **Revenue:** estimated, not measured. Net = reviews x 30 copies x list price x 0.75 (discounts, regional prices) x 0.62 (Steam's cut, tax, refunds). Treat every dollar figure as right to within a factor of two or three. Free games are left out because reviews say nothing about their income.
- **Not available:** real sales, wishlists, refunds, SteamDB, Reddit.

## The state of the genre

- **It is flooding.** Tagged releases per half-year: 24, 47, 80, then 264 in the second half of 2026 so far. Another 438 are unreleased.
- **Most games earn very little.** Of 121 paid games classified by hand, the median estimated net is about $15,500. 25 pass $100,000 and 6 pass $500,000.
- **Two thirds of games out three months or more have under 100 reviews.** Most of those are liked (80-100% positive); they failed on reach, not quality.
- **First into a slot usually wins it.** In 9 of 15 placement-and-theme combinations with four or more games, the earliest game found is also the biggest.

## What earns money (paid games, estimated net)

| By theme | Games | Median price | Median net | Share over $100k |
|---|---|---|---|---|
| Focus / productivity companion | 12 | $9.99 | $142,000 | 50% |
| Farm | 8 | $4.99 | $30,000 | 25% |
| Fishing / aquarium | 13 | $4.99 | $23,000 | 38% |
| Anime mascot | 13 | $1.99 | $22,000 | 15% |
| Pet | 24 | $4.49 | $15,000 | 17% |
| Town / shop | 20 | $4.99 | $15,000 | 20% |
| RPG party / dungeon | 17 | $4.99 | $9,000 | 6% |
| Space | 5 | $5.99 | $1,100 | 0% |
| Train / travel | 3 | $4.99 | $500 | 0% |

| By what drives it | Games | Median price | Median net | Share over $100k |
|---|---|---|---|---|
| A focus timer | 14 | $8.99 | $124,000 | 50% |
| Nothing (pure idle) | 89 | $4.99 | $16,000 | 20% |
| Typing and clicking | 16 | $3.99 | $2,000 | 0% |

| By place on screen | Games | Median price | Median net | Share over $100k |
|---|---|---|---|---|
| Full window with an idle or mini mode | 13 | $7.99 | $144,000 | 54% |
| Bottom strip | 30 | $5.99 | $34,000 | 30% |
| Floating pet / overlay | 21 | $2.99 | $14,000 | 10% |
| Corner widget | 44 | $4.99 | $11,000 | 16% |
| Taskbar strip | 8 | $4.99 | $400 | 0% |

Groups are small and tangled up with price, release date and team quality. They describe what happened; they do not prove why.

## What this says about Keystroke Keep as it stands

It sits in the two weakest groups at once:

- **RPG party in a strip** is the only theme where the typical game is disliked (median 67% positive), and 30 games already occupy it.
- **Typing as the core loop** has never produced a paid game over $100,000 in this data. The best is Tap Tap Loot, about $87,000 at 76% positive.
- Typing does work as a light meter on something cute (Bit Buddy 99% positive, Desktop Duck 98%), but those sell for $1.99-4.99 and earn little.
- Bongo Cat, the largest game in the genre, is typing-driven, but it is free and its income could not be measured.

## Directions, ranked by the evidence for profit

### 1. A focus companion in the strip

Turn the party into people who work alongside you: they get on with the dungeon while you are in a focus session, and rest when you stop.

- **Evidence for:** the best-earning group by a wide margin, at twice the price ($9-12). The top reviews say why: "I have a study buddy", "helped me finish my ADHD assessment". Only two real entries exist outside a full window; one of them, On-Together, is the only strip game and is estimated at about $200,000 in ten months.
- **What carries over:** the strip, the four heroes, the Clatter theme and the shift report, which is already a focus report.
- **What changes:** the unit of play becomes a focus session, not a keystroke. Typing can still start a session by itself, so there is no timer to press.
- **Risks:** Spirit City and Chill with You are strong incumbents with far better art and music than this prototype. Buyers judge these as tools ("this is not a game, it is a utility"), so the timer, tasks and sound have to be good.

### 2. The first real game that plays on top of your open windows

Heroes that walk along the top edges of whatever windows are open, with progression, not just a pet.

- **Evidence for:** 24 released games use windows as terrain and every one is a pet or mascot. First into a slot usually wins it, and this slot (a progression game on window edges) is empty.
- **Evidence against:** floating overlay games sell for $0.99-3.99 and earn a median of about $14,000, so this only pays if players accept $5-7 for it. "Distracting" and multi-monitor problems are common complaints in this placement.
- **Cost:** new desktop code to read window positions on Windows; the click-through overlay already exists.

### 3. A proper small game that shrinks into the strip

A full game people would buy anyway, with an idle mode for work hours. Cast n Chill does this at $14.99 and is estimated at about $1.9 million.

- **Evidence for:** the highest typical outcome of any placement, and the highest prices.
- **Evidence against:** it wins on craft, and it is the largest build by far. This is a new game, not a change to this one.

### 4. A loop around the edge of the screen (wildcard)

Nothing was found that runs around the screen border. It is a new format, which is what Rusty's Retirement was in 2024. There are no comparable games, so there is no evidence either way on money, and a frame on all four edges may get in the way.

### Not recommended

- **Keeping the typing-powered dungeon as the product.** See above.
- **Space or travel themes.** All eleven released games found are tiny.
- **A corner widget.** The most crowded placement, with the lowest ceiling.
- **Free with tradeable items.** It produced the biggest player counts and the worst sentiment: games with Steam Market items have a median of 64% positive, and the top complaints are bans, telemetry and nerfs.

## Complaints to design against (602 negative reviews, 73 games)

Ordered by how many games they appear in: bugs and lost saves (43), window, monitor and taskbar behaviour (40), balance and grind (37), content running out (32), monetisation (29), too active for an idle game (24), performance (23), distracting (21), too passive (19), privacy or keylogger fears (7).

"Too active" and "too passive" often hit the same game. The stable complaint is a mismatch between what "idle" promises on the store page and what the game asks for. Games that hook input also draw a specific one: lag in the player's own typing.
