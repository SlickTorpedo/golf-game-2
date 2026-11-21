# What makes a mini-golf party game fun: research for Bubaran

Compiled 21 November 2026 from web research. Every factual claim carries a link to where it was read. Three labels are used throughout:

- **[read]** – stated directly in the linked source.
- **[inferred]** – my reading across sources; the sources do not say it in so many words.
- **[estimate]** – a number or pattern I am proposing as a starting point. It is not from a source and needs tuning in the build.

Limits of this research are listed in [What I could not find](#what-i-could-not-find) near the end. The most important one: there is very little written about Putt Party. Almost all specific detail comes from one fan-maintained TV Tropes page and Discord's short FAQ. I did not watch any videos, so the two famous "juice" talks are represented by a university lecture slide that lists their contents, not by the talks themselves.

---

## Summary

1. **Putt Party's fun is mostly mechanics, not scenery.** All 19 courses use the same floor and wall textures in different colours; what differs is one mechanical theme per course (springs, fans, boosters, portals, bumpers, invisible walls, thin paths) and about 23 power-ups, most of which mess with *everyone else's next shot* ([TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/PuttParty)). For Bubaran this means course geometry and power-up interplay matter more than the stadium around it. [inferred]
2. **Its round structure is short and capped:** 6 holes per course, a 2-minute limit per hole with warning sounds in the last 15 seconds, up to 8 players at once, vote on the next course afterwards ([TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/PuttParty), [Discord FAQ](https://support-apps.discord.com/hc/en-us/articles/26502262624919-Putt-Party-FAQ)). A course is at most about 12 minutes.
3. **Each course is built around one idea, and each hole should be too.** Putt Party names courses after their gimmick (Jumpington, Gustington, Boostington, Teletown). Real mini-golf guidance says the same: one clear idea per hole ([minigolfspots](https://minigolfspots.com/learn/mini-golf-course-ideas)).
4. **A hole-in-one should always be possible, and the safe route should always exist.** Putt-Putt's whole design rule is par 2 with an ace always reachable by a skilled shot ([Wikipedia](https://en.wikipedia.org/wiki/Putt-Putt_Fun_Center)); the windmill is the classic "gamble on the shortcut or go round" hole ([Miniature Golf Solutions](https://www.miniaturegolfsolutions.com/Crazy-Golf-Course-Design--4-Obstacles-That-Mini-Golfers-Love-to-Hate-1-10858.html)).
5. **Aim for roughly 80% skill, 20% chaos, and make failure funny and fair.** That is Fall Guys' stated level rule, alongside "it's only over when it's over" and "let's go again" ([Fall Guys](https://fallguys.com/news/behind-the-beans-the-story-of-snowball-survival)). Nintendo's version: everyone should feel in it until the end, but the best player still usually wins ([GameSpot](https://www.gamespot.com/articles/how-nintendo-uses-luck-to-make-games-fun-for-every/1100-6465850/)).
6. **Keep matches short rather than adding heavy catch-up rules.** A short match makes "play another" the catch-up mechanic ([The Ludite](https://theludite.com/2014/10/29/smash-bros-what-makes-a-party-game/)). Light catch-up is still worth having: Mario Kart gives stronger items to players further back ([MarioWiki](https://www.mariowiki.com/Item_Boxes)) and Mario Party hands out end-of-game bonus awards that can change the winner ([MarioWiki](https://www.mariowiki.com/Bonus_Star)).
7. **Juice the result, keep the aiming calm.** Peggle's designers put all their excess (zoom, slow motion, Ode to Joy) on the final moment because they could not distract players while aiming ([Gamezebo](https://www.gamezebo.com/news/peggle-how-a-spark-started-a-fever/), [GamesRadar](https://www.gamesradar.com/uk/peggle-10/)). A survey of game-feel research found medium-to-high juice beats both none and extreme, and warns that heavy effects hide information ([Pichlmair & Johansen](https://ar5iv.arxiv.org/html/2011.09201)).
8. **The camera must put the player's own intent first.** The widely cited rules: an automatic camera that yields to player input and waits before taking over again, pull-in or swing-round when something blocks the view, smoothed motion with no sudden turns ([Unreal Engine tech blog](https://www.unrealengine.com/tech-blog/six-ingredients-for-a-dynamic-third-person-camera), [Game Developer](https://www.gamedeveloper.com/design/third-person-camera-view-in-games-a-record-of-the-most-common-problems-in-modern-games-solutions-taken-from-new-and-retro-games)).
9. **Golf-game cameras are a common complaint, and the fix players ask for is control and options.** Golf With Your Friends is criticised for a camera that gets stuck on geometry and forces blind shots ([TheXboxHub](https://www.thexboxhub.com/golf-with-your-friends-review/)); Mario Golf: Super Rush for an overhead putting view ([CGMagazine](https://www.cgmagonline.com/review/mario-golf-super-rush-switch-review/)); Super Monkey Ball for a camera that cannot keep up at speed and cannot be adjusted ([TechRaptor](https://techraptor.net/gaming/previews/super-monkey-ball-banana-blitz-hd-preview), [Nintendo Insider](https://www.nintendo-insider.com/super-monkey-ball-3d-review/)). Putt Party itself has at least two views, one of them a full-hole view ([TV Tropes YMMV](https://tvtropes.org/pmwiki/pmwiki.php/YMMV/PuttParty)).
10. **Near misses make people want another go, but they also frustrate.** In a Candy Crush study near-misses produced the strongest urge to keep playing and the highest frustration ([Larche et al.](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5445157/)). Show a lip-out clearly and make the retry instant; do not manufacture fake ones. [inferred]
11. **Modes and modifiers are what comparable games use for replay value.** Golf With Your Friends has Classic/Dunk/Hockey modes, ball shapes, gravity and collision toggles ([Blueprinted Gaming guide](https://blueprintedgaming.com/docs/golf-with-your-friends/multiplayer-and-workshop)); Golf Gang has "mutations" and scores time as well as strokes ([Indie Games Plus](https://indiegamesplus.com/golf-gang-review/)); Party Golf ships 50+ preset custom games ([Party Golf wiki mirror](https://www.mdwiki.org/wiki/Party_Golf)).
12. **Putt Party is buggy and people still play it.** The fan wiki's biggest section is its bug list, and the most common softlocks are solved only by the hole timer running out ([TV Tropes YMMV](https://tvtropes.org/pmwiki/pmwiki.php/YMMV/PuttParty)). The lesson is that the timer is a safety net for stuck balls as well as a pacing tool, and that Bubaran can compete on polish. [inferred]

---

## Putt Party: what it actually does

Sources for this section: Discord's own [FAQ](https://support-apps.discord.com/hc/en-us/articles/26502262624919-Putt-Party-FAQ), the fan-written [TV Tropes page](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/PuttParty) and its [YMMV](https://tvtropes.org/pmwiki/pmwiki.php/YMMV/PuttParty) and [Trivia](https://tvtropes.org/pmwiki/pmwiki.php/Trivia/PuttParty) subpages, the [Discord Fandom wiki](https://discord.fandom.com/wiki/Putt_Party), and a [blog post by an animator who worked on it](https://medium.com/@joshburton_30676/putt-party-7ed9b26c62cd). TV Tropes is community-edited; treat its numbers as "probably right" rather than official.

### Round structure

| Item | What the sources say | Confidence |
|---|---|---|
| Players | 1–8 play at once; extra people spectate and can queue for the next round ([FAQ](https://support-apps.discord.com/hc/en-us/articles/26502262624919-Putt-Party-FAQ)) | read, official |
| Simultaneous play | Everyone plays the hole at the same time ([FAQ](https://support-apps.discord.com/hc/en-us/articles/26502262624919-Putt-Party-FAQ)) | read, official |
| Holes per course | 6 ([FAQ](https://support-apps.discord.com/hc/en-us/articles/26502262624919-Putt-Party-FAQ)) | read, official |
| Courses | 19 in total; 13 before the May 2023 "Paradise" update ([TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/PuttParty)) | read, fan wiki |
| Casual mode | One course, score for that course only, players vote on the next course ([FAQ](https://support-apps.discord.com/hc/en-us/articles/26502262624919-Putt-Party-FAQ)) | read, official |
| Tournament mode | 3, 6 or 9 courses chosen at random; score totals across all; power-ups carry over between courses ([FAQ](https://support-apps.discord.com/hc/en-us/articles/26502262624919-Putt-Party-FAQ)) | read, official |
| Timer | 2 minutes per hole; irritating warning sounds in the last 15 seconds; on time-out you are moved to the next hole ([TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/PuttParty)) | read, fan wiki |
| Scoring | Fewest strokes wins; each hole has a par, described as what a proficient player would score ([FAQ](https://support-apps.discord.com/hc/en-us/articles/26502262624919-Putt-Party-FAQ)) | read, official |
| Out of bounds | The ball falls, you lose that stroke and return to where you hit from ([TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/PuttParty)) | read, fan wiki |
| Stroke limit per hole | **Unknown.** No source gives one. A GitHub spec for a clone also notes the rule is not documented anywhere reliable ([roosterchat issue](https://github.com/PondLabs/roosterchat/issues/222)) | not found |
| Score given on time-out | **Unknown.** | not found |
| Hole-in-one | Announced to all players with a "(Player) got a HOLE IN ONE!!!" message ([TV Tropes YMMV](https://tvtropes.org/pmwiki/pmwiki.php/YMMV/PuttParty)) | read, fan wiki |

### Aiming and controls

- Input is "select, drag, aim, and release to launch" ([FAQ](https://support-apps.discord.com/hc/en-us/articles/26502262624919-Putt-Party-FAQ)). [read]
- The aim arrow has a built-in **wobble**: it swings side to side in a sine pattern, so a shot can leave a few degrees off the line you chose. Players regard it as easy to beat (aim slightly to one side and release when the arrow pauses at the end of its swing). A power-up, Steady Aim, removes it ([TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/PuttParty), [YMMV](https://tvtropes.org/pmwiki/pmwiki.php/YMMV/PuttParty)). [read]
- How the arrow shows power (length, colour, a separate meter) is **not described in any source I could read.**

### Camera

- There are at least two camera modes, and "camera 2" is a full-hole view. This is known only because a bug sometimes leaves players on it when the next hole starts ([YMMV](https://tvtropes.org/pmwiki/pmwiki.php/YMMV/PuttParty)). [read]
- What camera 1 does (distance, whether it follows the rolling ball, whether it can be rotated) is **not described in any source I could read.**

### Power-ups

How they work: drive into a "?" block to get a random one; you can hold three, and any further pickups are thrown away; some help you, some hurt others; every harmful one hits *all* other players except Steal, which targets one ([FAQ](https://support-apps.discord.com/hc/en-us/articles/26502262624919-Putt-Party-FAQ), [TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/PuttParty)). Discord's directory page says "over 20" power-ups; the table below has the 23 named on TV Tropes. All effects are from [TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/PuttParty).

| Power-up | Affects | Effect |
|---|---|---|
| Steady Aim | You | Removes the aim wobble |
| Hole Magnet | You | Ball is pulled into the hole if it gets close enough |
| Ghost Ball | You | Ball passes through walls and obstacles for a while, sometimes ignoring gravity |
| Chip Shot | You | Shot is lofted high into the air instead of rolling |
| Teleport | You | Move the ball to a spot you click, limited range, costs no stroke |
| Rewind | You | Puts the ball back where it was before your last stroke and removes that stroke |
| Steal | One opponent | Take a power-up from a player you choose, at any distance |
| Fun Size | All others | Shrinks them for their next shot |
| Super Size | All others | Enlarges them so much they cannot fit in the hole |
| Zanyball | All others | Makes their next shot much too fast |
| Sticky Ball | All others | Their ball sticks to surfaces for their next shot |
| Gas Giant | All others | Pushes them around at random, with a green cloud and a fart sound |
| Reversiball | All others | Reverses their aim arrow for their next shot |
| Twisted Aim | All others | Their aim arrow spins in a circle |
| One Too Many | All others | They get three wobbly arrows and the game picks one at random |
| Guess Work | All others | Removes their aim arrow and indicators completely |
| Unlovaball | Unclear | Timed effect; the page does not say what it does |
| Wind | Everyone | A gust in a direction you choose, for a limited time |
| Tornado | Everyone nearby | A tornado wanders the course and blows balls around, for a limited time |
| Ice Rink | Everyone | Floor becomes ice |
| Sticky Walls | Everyone, including you | Walls become sticky until the hole ends |
| Bumper Spawn | The course | Place a bumper anywhere |
| Black Hole Bumper | The course | Place a bumper that also pulls balls within a set range |

Patterns worth copying [inferred from the table]:

- Roughly a third help you, a third sabotage others' *next shot only*, and a third change the *hole* for everyone. Most sabotage lasts one shot, so nobody is out of the game for long.
- Many sabotage items attack the *aiming interface* (reverse, spin, hide, multiply the arrow). They are cheap to build, funny to suffer, and do not need new physics.
- Movement items (Wind, Teleport) can be combined to score a "hole in zero" on some holes ([TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/PuttParty)); the game allows it.

### Courses and hole features

Named courses and their gimmicks, all from [TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/PuttParty):

| Course | Gimmick |
|---|---|
| Jumpington, Leapington | Springboards launch the ball upward; Leapington requires jumping gaps over the void |
| Bumpington | Bumpers bounce the ball sideways |
| Boostington | Speed pads push the ball in a set direction |
| Gustington | Fans push balls in front of them |
| Teletown | Colour-coded portal pairs that keep the ball's speed |
| Fortune Falls | Pachinko: the ball drops through pegs into one of five holes; the outer ones add 1 or 2 penalty points |
| Invisible Isles | Parts of the walls and floor are invisible |
| Mazemoor | Some "holes" have two or three cups; which one you sink decides where you start the next hole |
| Openborough | The whole course is one continuous area; each cup is the tee for the next hole |
| Thin Trails | Narrow paths where precise aim matters ([YMMV](https://tvtropes.org/pmwiki/pmwiki.php/YMMV/PuttParty)) |
| Multiton | Named but not described |

Other facts:

- Hazards listed across courses: wind, speed boosts, jump boosts, bumpers, moving walls, rotating obstacles, bottomless edges ([TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/PuttParty), [YMMV](https://tvtropes.org/pmwiki/pmwiki.php/YMMV/PuttParty)). [read]
- All courses share the same floor and wall textures, recoloured ([TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/PuttParty)). The team wanted a different theme per course (a pirate course was pitched) but dropped it for lack of time ([Josh Burton](https://medium.com/@joshburton_30676/putt-party-7ed9b26c62cd)). [read]
- Background life: blocky characters and sheep (and, after the 2023 update, a small dragon-centipede that moves around with the player plus a huge one looping in the background) with "win", "excited" and "disappointed" animations ([Josh Burton](https://medium.com/@joshburton_30676/putt-party-7ed9b26c62cd)). [read]
- Lead designer was David Bokser; the game is built in Cocos Creator ([Josh Burton](https://medium.com/@joshburton_30676/putt-party-7ed9b26c62cd)). [read]

### What players praise and complain about

- **Praise:** chaos that scales with player count ([TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/PuttParty)); Discord's own tagline for it is "Mini golf, mega drama" ([Discord blog](https://discord.com/blog/server-activities-games-voice-watch-together)). I found no long-form review.
- **Complaints, mostly bugs** ([YMMV](https://tvtropes.org/pmwiki/pmwiki.php/YMMV/PuttParty)): ball in the cup not registering; getting stuck bouncing between two portals when entering too slowly; landing on wall decorations and being stuck until the timer expires; stuck inside rotating obstacles; moving obstacles appearing stationary for one player; wrong winner shown; camera not resetting from full-hole view. The Fandom wiki carries a warning that the game "contains a number of significant bugs" ([Fandom](https://discord.fandom.com/wiki/Putt_Party)).
- **One user on Discord's support forum** complains of lag and that the monsters get in the way when lining up a shot ([Discord support community](https://support.discord.com/hc/en-us/community/posts/16069968046743-Activities)). I saw this only as a search-result excerpt and it is a single post.

---

## What makes this kind of game fun

### Game feel ("juice")

**1. Feel is control plus a simulated space plus polish, and players spend most of their time in the moment-to-moment part.**
Source: Steve Swink defines the layers as input, response, context, polish, metaphor and rules, and argues that feel deserves attention from the start because steering/moving is what players do most ([Game Developer](https://www.gamedeveloper.com/design/game-feel-the-secret-ingredient)). Polish is "any effect that artificially enhances interaction without changing the underlying simulation" (Swink, quoted in a [Bayreuth University lecture](https://medienwissenschaft.uni-bayreuth.de/wp-content/uploads/GxD-10-Game-Feel.pdf)).
Example: Mario feels fluid on a two-button pad because of acceleration, variable jump height and ground/air states, where Donkey Kong with a joystick does not ([Game Developer](https://www.gamedeveloper.com/design/game-feel-the-secret-ingredient)).
For Bubaran [inferred]: the "moment-to-moment" is the pull-back, the release, and watching the roll. Those three must feel good with every effect switched off before effects are added.

**2. Tuning, juicing and streamlining are three separate jobs.**
Source: a survey of game-feel writing splits polish into *physicality* (tuning how things move and collide), *amplification* (feedback that signals how important an event is: screen shake, particles, colour flash, hit stop, audio, slow motion) and *support* (reading the player's intent: aim assist, input buffering, trails and decals that show history, a dynamic camera that points at what matters) ([Pichlmair & Johansen](https://ar5iv.arxiv.org/html/2011.09201)).
Example: the survey lists "assisted aiming" under physicality and "trails, decals and debris" under support; Putt Party's Hole Magnet is an aim assist sold as a power-up ([TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/PuttParty)).

**3. The Breakout checklist: small responses on everything.**
Source: "Juice it or lose it" (Jonasson & Purho, 2012) takes a plain Breakout clone and adds, in order: colour; tweening/easing of position, rotation and scale; random delay; paddle stretch by velocity; ball rotation and stretch; wobble; colour change on impact; scaling blocks on impact; sounds for wall, block and paddle; music; impact particles; block-hit animation; shatter; ball trail; screen shake; a face on the paddle (eyes, blink, smile); screen colour flash (list as given in the [Bayreuth lecture slide](https://medienwissenschaft.uni-bayreuth.de/wp-content/uploads/GxD-10-Game-Feel.pdf); the talk's code is at [GitHub](https://github.com/grapefrukt/juicy-breakout), whose README describes juice as "tons of cascading action and response for minimal user input").
Example: every item on that list applies to a ball hitting a wall, which is the most frequent event in mini-golf. [inferred]

**4. The shooter checklist: impact, permanence, camera, time.**
Source: "The art of screenshake" (Nijman, 2013) adds roughly 30 tweaks to a dull shooter, including impact effects, hit animation, knockback, permanence (things that stay on the ground), camera lerp, camera position, screen shake, a brief game pause on hit ("sleep"), more bass in sound effects, a camera kick opposite to the shot direction, and slow motion; his summary is "fill your game with love and tiny details" (list from the [Bayreuth lecture slide](https://medienwissenschaft.uni-bayreuth.de/wp-content/uploads/GxD-10-Game-Feel.pdf); two items confirmed by [Game Developer](https://www.gamedeveloper.com/design/vlambeer-co-founder-shares-advice-on-building-better-action-games)).
Example for a putting game [inferred]: "permanence" = scuff marks where the ball landed and a fading roll line on the turf; "camera kick" = a small push along the shot direction on release; "sleep" = a few frames of freeze on a full-power putt.

**5. Save the biggest effects for the result, not the aiming.**
Source: Peggle's Extreme Fever began as a joke and stayed because the end of the level was the only place the team could go over the top without distracting from aiming ([Gamezebo](https://www.gamezebo.com/news/peggle-how-a-spark-started-a-fever/)). The camera zooms in and the last stretch of the ball's path plays in slow motion to Ode to Joy ([GamesRadar](https://www.gamesradar.com/uk/peggle-10/)).
Example: Mario Golf: World Tour flashes light out of the cup only for par or better ([MarioWiki](https://www.mariowiki.com/List_of_golfing_terms)), which is celebration scaled to the result.

**6. More juice is not always better.**
Source: a large study cited in the survey found medium and high juice outperform both none and extreme; heavy feedback can hide which things matter; feedback that implies something the rules do not do makes a game frustrating ([Pichlmair & Johansen](https://ar5iv.arxiv.org/html/2011.09201)). Folmer Kelly's counter-talk "Don't juice it or lose it" argues polish cannot replace a design that works ([Game Developer](https://www.gamedeveloper.com/design/video-indies-resist-the-urge-to-juice-it-or-lose-it-)).
Example: Xbox's accessibility guideline asks games to avoid camera shake, bobbing and motion blur or offer a switch to turn them off; Halo Infinite has 0–100% sliders for screen shake and full-screen effects ([Microsoft](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/117)).

**7. Hit stop and shake: short, and scaled.**
Sources disagree on numbers and none is authoritative: 2–3 frames for light hits and never more than about 20 frames ([gamejuice](https://gamejuice.pages.dev/articles/hit-stop-frame-trick)); 60–120 ms ([dev.to](https://dev.to/saltmire/godot-4-screen-shake-and-hit-stop-in-one-script-11eh)); a 0.06 s default that slows time instead of stopping it ([Godot forum](https://forum.godotengine.org/t/game-feel-checklist-for-godot-4-hit-stop-trauma-shake-coyote-time-and-more/145340)). For shake, the common method from Squirrel Eiserloh's GDC talk is a 0–1 "trauma" value that decays over time, with shake amount = trauma squared and smooth noise rather than random jumps (as implemented in [Bevy's example](https://bevy.org/examples/camera/2d-screen-shake/), which credits the talk).

**8. Near misses motivate and frustrate at the same time.**
Source: in a study of Candy Crush players, near-misses triggered the strongest urge to continue and were rated the most frustrating outcome ([Larche et al., 2017](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5445157/)). A smaller video-game experiment found players felt more bored and less excited after a near miss than after a clear win ([Finserås et al.](https://link.springer.com/article/10.1007/s11469-019-00070-9)). The evidence base is mostly slot machines.
For Bubaran [inferred]: a lip-out is a natural near miss. Acknowledge it (a sound, a crowd "ooh") and get the player aiming again immediately. The current build already has lip-out physics (`CUP_MAX_SPEED`, `CUP_PULL` in `src/shared/constants.ts`).

### Hole design

**1. An ace is always possible; par stays low.**
Source: every Putt-Putt hole is par 2 and built so a skilled putt, usually a bank off the rail, can score a hole-in-one ([Wikipedia](https://en.wikipedia.org/wiki/Putt-Putt_Fun_Center); the article flags part of that section as possibly original research).
Example: Putt Party's par is "what a proficient player would likely score" ([FAQ](https://support-apps.discord.com/hc/en-us/articles/26502262624919-Putt-Party-FAQ)).

**2. Risk and reward: a tempting shortcut next to a safe route.**
Source: golf architecture writing puts risk/reward at the centre of hole design, with "heroic" options where the player may take on risk for a bigger payoff ([Golf.com](https://golf.com/travel/golf-hole-design-beginners-guide/)). In mini-golf the windmill is the standard form: a shortcut through the blades or a safe putt around ([Miniature Golf Solutions](https://www.miniaturegolfsolutions.com/Crazy-Golf-Course-Design--4-Obstacles-That-Mini-Golfers-Love-to-Hate-1-10858.html)). One mini-golf designer describes the aim as a little temptation without putting players in the garden every time ([Australian Golf Digest](https://www.australiangolfdigest.com.au/opinion-small-hole-big-deal/)).
Example: Putt Party's Leapington makes you jump gaps over the void; missing costs a stroke and a reset ([TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/PuttParty)).

**3. Know which holes are skill, which are luck, and label them in your head.**
Source: the same obstacle guide sorts four classics: windmill (timing skill with risk/reward), pipe hole (mostly luck; several entrances with different exits), "impossible angle" dogleg (pure bank-shot skill, no shortcut), loop (power control plus an unpredictable exit) ([Miniature Golf Solutions](https://www.miniaturegolfsolutions.com/Crazy-Golf-Course-Design--4-Obstacles-That-Mini-Golfers-Love-to-Hate-1-10858.html)).
Example: Putt Party's Fortune Falls is the luck hole: a pachinko drop into five cups with different penalties ([TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/PuttParty)).

**4. One idea per hole; simple beats cluttered.**
Source: mini-golf guidance recommends one clear idea per hole, and notes a short straight hole with a subtle slope can be more satisfying than one crammed with obstacles that stop every ball ([minigolfspots](https://minigolfspots.com/learn/mini-golf-course-ideas)). This is a hobbyist site, not a professional designer.
Example: Putt Party builds a whole course on one mechanic ([TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/PuttParty)).

**5. Design the route through the course, and give each course a twist.**
Source: Walkabout Mini Golf's creator plans courses like a film: a loose three-act shape, holes as "markers along the way", landmarks that you see from one side and reach later; an idea alone may not "hold a course" without a twist ([UploadVR](https://www.uploadvr.com/how-lucas-martell-brings-hollywood-production-storytelling-to-walkabout-mini-golf/)). In other interviews he describes drawing the path through all 18 holes first, and limiting punishing "do or die" holes to one or two per course (reported via search summaries of [Voices of VR](https://voicesofvr.com/1560-walkabout-mini-golfs-incredible-fusion-of-worldbuilding-gameplay-social-dynamics-dlc-experimentation/) and [MIXED](https://mixed-news.com/en/walkabout-mini-golf-vr-is-one-of-the-most-successful-vr-games-we-spoke-with-its-creator/); I did not read those two pages in full).
Example: on Walkabout's windmill course the windmills catch balls rather than block them, because the designer disliked classic windmill holes ([UploadVR](https://www.uploadvr.com/quixote-valley-ghibli/), via search summary).

**6. Do not put the cup where a good putt gets punished.**
Source: a Golf With Your Friends review criticises cups set on platforms or slopes that turn an easy birdie into a bogey ([Hardcore Gamer](https://hardcoregamer.com/reviews/review-golf-with-your-friends/378832/), via search summary). Another notes a ball that bounces out and back in is still counted out, and that power cannot be fine-tuned despite precise platforms ([TheXboxHub](https://www.thexboxhub.com/golf-with-your-friends-review/)).

**7. Every way of getting stuck needs a way out.**
Source: Putt Party's commonest softlocks are balls stuck between portals, on wall decorations, or inside rotating obstacles, freed only by the hole timer ([YMMV](https://tvtropes.org/pmwiki/pmwiki.php/YMMV/PuttParty)).
For Bubaran [inferred]: no ledge a ball can rest on without a way to putt off it; portals and tunnels need a minimum exit speed; add a manual "reset to last spot" button.

**8. Difficulty arc.**
Source: one course-building guide suggests an easy opener to build confidence, a gradual climb, a hard "signature" hole around the middle, and a lighter or prettier hole after a punishing one ([Patch Perfect Yard](https://patchperfectyard.com/building-a-mini-golf-course/), via search summary). This is a home-improvement blog; I found no professional source that states an arc this precisely, so treat it as a reasonable convention, not established fact.

**9. What simultaneous play changes.**
I found **no source** that discusses hole design for simultaneous multiplayer specifically. What the sources do show: Golf With Your Friends treats ball-to-ball collision as an optional lobby setting and one guide says the best sessions are 12 players with collisions and power-ups on ([Blueprinted Gaming guide](https://blueprintedgaming.com/docs/golf-with-your-friends/multiplayer-and-workshop)); Fall Guys requires every round to work across player counts ("the more the merrier") ([Fall Guys](https://fallguys.com/news/behind-the-beans-the-story-of-snowball-survival)). Whether Putt Party's balls collide with each other is not stated anywhere I could read. The multiplayer items in the checklist below are therefore my own estimates.

### Camera

**1. Three goals: attention, interaction, comfort.**
Source: Itay Keren's camera study: show what the player needs to see, respond predictably to their input, and avoid sudden or jerky motion. Techniques include a look-ahead offset in the direction of travel, lerp or physics smoothing, "cue focus" where important objects pull the camera toward them, and zoom-to-fit to frame everything that matters ([Game Developer](https://www.gamedeveloper.com/design/scroll-back-the-theory-and-practice-of-cameras-in-side-scrollers)). It is about 2D games but the goals transfer.
Example for golf [inferred]: the cup is the "cue"; the look-ahead is along the aim line while aiming and along velocity while rolling.

**2. Automatic camera, but the player always wins.**
Source: a third-person camera built on John Nesky's "50 camera mistakes in Journey" talk: the camera turns toward the direction of movement on its own, but every automatic behaviour has a cooldown after player input, because it is "very frustrating" to rotate the view and have it snap back; distance and FOV can change with pitch; transitions between camera states are smoothed ([Unreal Engine tech blog](https://www.unrealengine.com/tech-blog/six-ingredients-for-a-dynamic-third-person-camera)). A second article recommends the same hybrid: automate most behaviour, let the player adjust, return when they stop ([Game Developer](https://www.gamedeveloper.com/design/third-person-camera-view-in-games-a-record-of-the-most-common-problems-in-modern-games-solutions-taken-from-new-and-retro-games)).
Example: Sea of Thieves exposes auto-centre on/off, delay (2.0 in the screenshot) and speed as settings ([Microsoft](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/117)).

**3. Deal with things blocking the view before they block it.**
Source: two standard methods: a spring arm that pulls the camera in when something is between it and the subject, and "whisker" rays cast to either side that rotate the camera around an obstacle before it hides the subject; use one or the other per obstacle, not both ([Unreal Engine tech blog](https://www.unrealengine.com/tech-blog/six-ingredients-for-a-dynamic-third-person-camera)). Alternatives: fade or dither geometry near the camera (The Witcher 3), or draw a silhouette through walls (Super Mario Sunshine) ([Game Developer](https://www.gamedeveloper.com/design/third-person-camera-view-in-games-a-record-of-the-most-common-problems-in-modern-games-solutions-taken-from-new-and-retro-games)).
Counter-example: in Golf With Your Friends the view goes nearly first-person against a wall and zoom fails when an obstacle is between camera and ball, leaving a blind shot ([TheXboxHub](https://www.thexboxhub.com/golf-with-your-friends-review/)).

**4. Distance and speed.**
Source: Rocket League's "stiffness" setting controls how far the camera drops back as the car speeds up (at 0 it pulls back by more than 100 units at top speed; at 1 it does not move) ([esports.net](https://www.esports.net/wiki/guides/best-camera-setting-rocket-league/), via search summary). Small developers of ball games report zooming out with speed or distance so the player can see where the ball is going, and testers asking for a wider view or a ground shadow to judge landings ([itch.io dev posts](https://itch.io/post/3799073), via search summary). A Super Monkey Ball reviewer lost track of the ball at speed and wanted a more zoomed-out camera ([TechRaptor](https://techraptor.net/gaming/previews/super-monkey-ball-banana-blitz-hd-preview)).
This cuts against "tighten on the ball when you putt". The sources say a fast ball needs *more* view ahead, not less. The recommendation below reconciles the two: move the camera closer and lower for presence, but widen the field of view slightly and look ahead of the ball so the destination stays on screen. [inferred]

**5. Give the player settings and preset views.**
Source: Rocket League exposes FOV (60–110), distance, height, angle, stiffness, swivel speed and transition speed ([Liquipedia](https://liquipedia.net/rocketleague/Settings)), and community guides recommend turning camera shake off ([Destructoid](https://www.destructoid.com/best-rocket-league-camera-settings/), via search summary). Xbox's guideline asks for adjustable FOV, adjustable camera sensitivity and a way to disable automatic camera movement ([Microsoft](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/117)). Super Monkey Ball: Banana Mania added player camera control after fan requests ([Nintendo Life](https://www.nintendolife.com/news/2021/09/super_monkey_ball_banana_mania_would_never_have_come_to_be_without_the_fans)).
Example: Putt Party has a second, full-hole camera ([YMMV](https://tvtropes.org/pmwiki/pmwiki.php/YMMV/PuttParty)); Golf With Your Friends gives a 15-second free camera to scout a hole, which reviewers found too short for long holes ([TheXboxHub](https://www.thexboxhub.com/golf-with-your-friends-review/)).

**6. Comfort.**
Source: motion sickness comes from the eyes reporting movement the body does not feel; avoid sudden changes of speed or direction ([Game Developer](https://www.gamedeveloper.com/design/scroll-back-the-theory-and-practice-of-cameras-in-side-scrollers)); avoid camera shake and bobbing or make them optional, and avoid repetitive side-to-side movement ([Microsoft](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/117)); a camera boom that only moves once the subject passes a threshold is steadier than one that copies every motion ([Game Developer](https://www.gamedeveloper.com/design/third-person-camera-view-in-games-a-record-of-the-most-common-problems-in-modern-games-solutions-taken-from-new-and-retro-games)). I found no source giving numeric limits for rotation speed.

**7. Smooth in a frame-rate-independent way.**
Source: replace `lerp(a, b, 0.1)` per frame with `value = lerp(target, value, exp2(-rate * dt))`; `rate = 1 / halfLife`, so a rate of 1 moves halfway to the target each second ([Howling Moon Software](https://howlingmoonsoftware.com/improved-lerp-smoothing/)). The current build already does this for the look target (`1 - Math.exp(-dt * 4)` in `src/client/world.ts`).

### Party play and retention

**1. Five rules for a round, from Fall Guys.**
Source: Mediatonic's level pillars are: 80% skill and 20% chaos; "a million slapstick moments" (moments people want to share); "it's only over when it's over" (last-second tension); "the more the merrier" (works at every player count, better with friends); "let's go again" (failure feels fair, success feels within reach) ([Fall Guys](https://fallguys.com/news/behind-the-beans-the-story-of-snowball-survival)). The designers also said rounds were meant to be as enjoyable to watch as to play ([Gamepur](https://www.gamepur.com/features/fall-guys-developers-q-and-a), via search summary).

**2. Luck is there so everyone believes they can win.**
Source: a media psychologist on Mario Kart, Mario Party and Smash: the important thing is that newcomers "think they have a chance of winning"; Mario Kart's producer wanted everyone "in it until the end" while the best player still wins most of the time; chance is meant to change strategy, not replace it ([GameSpot](https://www.gamespot.com/articles/how-nintendo-uses-luck-to-make-games-fun-for-every/1100-6465850/)).
Example: Mario Kart item boxes give stronger items the further back you are; first place usually gets a banana or green shell ([MarioWiki](https://www.mariowiki.com/Item_Boxes)).

**3. Prefer short matches to strong catch-up rules.**
Source: one design essay argues the urge to add catch-up is often a sign the match is too long; in a short game players just start another round. It also argues the blue shell mostly lets a player who cannot win decide who does, and that random items help skilled players as much as weak ones ([The Ludite](https://theludite.com/2014/10/29/smash-bros-what-makes-a-party-game/)). The same essay says party games should have low execution barriers and no player elimination. This is one writer's opinion and it disagrees with Nintendo's practice in point 2; both are worth knowing.

**4. End-of-match awards keep the result open and give everyone a mention.**
Source: Mario Party gives out bonus stars after the last turn; they can overturn the leader; some categories reward things trailing players do; the set of awards is partly random each game ([MarioWiki](https://www.mariowiki.com/Bonus_Star)).
For a golf game [inferred]: awards that change the *score* would undercut the stroke count. Awards as titles ("Longest putt", "Most time in the void") give the social moment without that cost.

**5. Variety through modes and modifiers.**
Source: Golf With Your Friends lobby options include game mode (Classic, Dunk, Hockey, Speed Golf), stroke limit (default 12), per-hole time limit, collisions, power-ups, random ball shapes, gravity and turn order ([Blueprinted Gaming guide](https://blueprintedgaming.com/docs/golf-with-your-friends/multiplayer-and-workshop); a third-party guide, and its default timer is not stated; a review gives the classic timer as two minutes per hole and a full course as about 30 minutes ([TheXboxHub](https://www.thexboxhub.com/golf-with-your-friends-review/))). Golf Gang's "mutations": everyone can jump, everyone slows while someone aims, the ball grows with each shot, every other shot goes backwards; it also lets you hit a moving ball and counts time as well as strokes ([Indie Games Plus](https://indiegamesplus.com/golf-gang-review/)). Party Golf ships more than fifty preset custom games ([Party Golf wiki mirror](https://www.mdwiki.org/wiki/Party_Golf)).
Caution: random ball shapes draw fairness complaints (the acorn "can make some holes unwinnable") ([Blueprinted Gaming guide](https://blueprintedgaming.com/docs/golf-with-your-friends/multiplayer-and-workshop)).

**6. These games are for groups; solo is the weak case.**
Source: reviews of Golf With Your Friends agree it is far better with friends; one calls its chaos close to no fun without people to laugh with ([Finger Guns](https://fingerguns.net/reviews/2020/05/21/golf-with-your-friends-ps4-review-bogeys/), via search summary).
For Bubaran, which is single player with bots today [inferred]: bots need to supply the social moments: visible mistakes, visible luck, reactions.

**7. Small rewards per course.**
Source: Golf With Your Friends awards a random cosmetic item for finishing a course ([TheXboxHub](https://www.thexboxhub.com/golf-with-your-friends-review/)); Golf Gang has cosmetic outfits for the ball that do not affect play ([Indie Games Plus](https://indiegamesplus.com/golf-gang-review/)).

**8. Between rounds: let the group choose.**
Source: Putt Party's casual mode ends each course with a vote on the next one; tournament mode carries power-ups from course to course ([FAQ](https://support-apps.discord.com/hc/en-us/articles/26502262624919-Putt-Party-FAQ)).

---

## Recommendations for Bubaran

Numbers are in the game's world units (one map cell = 1 unit; ball radius 0.16; `MAX_PUTT` 12.5 and `MAX_SPEED` 17 units/s), read from `src/shared/constants.ts`. Current values quoted from the build: `STROKE_CAP 8`, `HOLE_SECONDS 90`, `HOLE_END_SECONDS 9`, `INTRO_SECONDS 2.5`, `MAX_ITEMS 2`, camera FOV 36° in `src/client/world.ts`.

Unless a line says otherwise, **the numbers below are my estimates**: the sources give principles and almost no numbers for a putting camera or hole dimensions. Treat them as first values to tune by playing.

### Must

**M1. Replace the camera with three selectable views and a putt/roll transition.**

Why: owner feedback; camera is the most common complaint in comparable games (Summary 9); the rules come from Camera 1–7 above.

| View | Distance from ball | Pitch above horizontal | FOV | Behaviour |
|---|---|---|---|---|
| **Follow** (default) | 5.5–7 while aiming | 22–28° | 50° | Sits behind the ball along the aim direction. Look target is 1.5–2 units ahead of the ball along the aim line so the ball sits in the lower third and the course ahead fills the frame. |
| **Follow, ball rolling** | eases to about 80% of aim distance | 16–20° | +4 to +6° at full speed, scaled by speed / `MAX_SPEED` | Look target leads the ball by velocity × 0.35 s, capped at 3 units. Yaw turns toward the direction of travel. |
| **Overview** | fits whole hole | 55–60° | 36–40° | Today's "helicopter" view, kept as an option. Putt Party has an equivalent full-hole view ([YMMV](https://tvtropes.org/pmwiki/pmwiki.php/YMMV/PuttParty)). |
| **Free / orbit** | player-set, clamp 3–14 | player-set, clamp 10–70° | 50° | Drag to orbit, wheel or pinch to zoom. Available at any time. |

Transition rules:

- On release, ease from aim framing to rolling framing over about 0.35 s. When the ball has been below stop speed for 0.3 s, ease back over about 0.8 s. Use the exponential form `lerp(target, value, exp2(-rate * dt))` ([Howling Moon](https://howlingmoonsoftware.com/improved-lerp-smoothing/)); a half-life of 0.12 s gives roughly the 0.35 s feel, 0.25 s the 0.8 s feel.
- The pull-in is paired with a wider FOV and look-ahead on purpose: sources say a fast ball needs more view ahead (Camera 4). If testers lose the ball's destination, reduce the pull-in before touching anything else.
- Yaw while rolling: follow the velocity direction with a half-life of about 0.3 s, cap the turn rate at about 120°/s, and stop turning when speed is under 1.5 units/s. A ball bouncing between two walls must not whip the camera (Camera 6). If it still feels busy, hold yaw fixed during the roll and only re-centre when the ball stops.
- Player input wins: any manual orbit or zoom suspends automatic yaw and distance changes until the next stroke, or for 2 s after the last input while aiming ([Unreal Engine tech blog](https://www.unrealengine.com/tech-blog/six-ingredients-for-a-dynamic-third-person-camera) for the rule; the 2 s is my estimate).
- Blocking: cast from the ball to the camera each frame; if a wall is in the way, pull the camera in along the ray and raise pitch slightly; fade to about 25% opacity any wall or prop that sits between camera and ball within 2 units of the camera ([Game Developer](https://www.gamedeveloper.com/design/third-person-camera-view-in-games-a-record-of-the-most-common-problems-in-modern-games-solutions-taken-from-new-and-retro-games) for both techniques). Never let the camera go below the playing surface.
- Hole intro: a 2–3 s fly-through from cup back to tee so the route and the shortcut are seen once, skippable. This replaces Golf With Your Friends' 15-second free camera, which reviewers found both too short and fiddly ([TheXboxHub](https://www.thexboxhub.com/golf-with-your-friends-review/)).
- Reset the view to the player's chosen default at every hole start. Putt Party has a known bug where it does not ([YMMV](https://tvtropes.org/pmwiki/pmwiki.php/YMMV/PuttParty)).
- Settings: default view, FOV slider (40–70°), camera shake on/off, "camera follows ball direction" on/off ([Microsoft](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/117)).
- Draw a soft blob shadow under the ball at all times so height is readable when it is in the air ([itch.io tester feedback](https://itch.io/post/3799073), via search summary).

Check for "too much background": in the Follow view while aiming, the playable surface should cover well over half the screen. If it does not, lower the pitch or shorten the distance; do not narrow the FOV, which is what makes the current view feel distant.

**M2. Rebuild holes as modelled routes, each with one idea, an ace line and a safe line.** Use the [hole-design checklist](#hole-design-checklist-for-level-designers) below. Sources: Hole design 1–7.

**M3. Aiming and power.**

- Keep drag-back-and-release; it is what Putt Party uses ([FAQ](https://support-apps.discord.com/hc/en-us/articles/26502262624919-Putt-Party-FAQ)) and Golf Gang reviewers call mouse pull-back precise ([Indie Games Plus](https://indiegamesplus.com/golf-gang-review/), [search summary of other reviews](https://www.thesixthaxis.com/2022/05/19/golf-gang-review-mini-golf-racing/)).
- Arrow length and colour both show power (the build already tints the line above 55% power). Add tick marks at 25/50/75/100% so players can repeat a strength. Reviewers faulted Golf With Your Friends for power that cannot be fine-tuned ([TheXboxHub](https://www.thexboxhub.com/golf-with-your-friends-review/)).
- Make the last 10% of drag distance map to the last 10% of power (no dead zone at the top), and let the player cancel by dragging back onto the ball. [estimate]
- Show a short guide by default: the aim line continues to the first wall and shows the first bounce direction for 1–1.5 units. Offer a "long guide" only as a power-up or assist option. Kirby's Dream Course lets players toggle short and long guides ([WiKirby](https://wikirby.com/wiki/Dream_Course), via search summary).
- Do not copy Putt Party's aim wobble as a default. Players describe it as trivially beaten ([YMMV](https://tvtropes.org/pmwiki/pmwiki.php/YMMV/PuttParty)), so it adds delay without adding skill. Put the skill in power judgement and reading the line. [my judgement]
- Aiming must work while other balls are moving and while the camera is in any view.

**M4. Feedback pass ("juice checklist").** Do these in order; each is small. Source lists: Game feel 3 and 4.

| Moment | Add | Source of the idea |
|---|---|---|
| Pulling back | Line stretches with easing; ball squashes slightly away from the pull; rising pitch on a soft tension sound | Juice it or lose it: stretch, tweening, sound |
| Release | Putt "tock" with more bass at higher power; ball stretches along velocity for ~0.15 s; small camera push along the shot (0.05–0.15 units, scaled by power) | Art of screenshake: more bass, camera kick |
| Full-power release (>85%) | 40–60 ms visual freeze of your own ball and camera only | Art of screenshake "sleep"; duration range from Game feel 7 |
| Rolling | Trail whose length scales with speed; roll sound whose pitch and volume follow speed; faint line left on the turf that fades over ~5 s | Juice: ball trail. Screenshake: permanence |
| Wall hit | Squash on the hit axis; 6–10 particles; the wall panel flexes or flashes; sound pitched by impact speed; shake only above ~60% of max speed | Juice: colour change, scale on impact, particles, wobble |
| Flying off an edge | Wind sound, camera tilts down to follow, crowd gasp; quick fade and instant return to the last spot | Fall Guys "slapstick moments" |
| Pickup | Box pops, item icon flies to the HUD slot, short jingle | Juice: tweening, sound |
| Near the cup | When your ball is within ~1.5 units of the cup and slow enough to drop, push the camera in 10–15% and duck the music | Peggle Extreme Fever |
| Lip-out | Rim sound, crowd "ooh", ball wobble; no delay before the next aim | Near-miss research |
| Sink | Scaled to the result: bogey or worse = cup rattle only; par = rattle + small confetti; birdie = bigger burst + crowd cheer; ace = slow-motion replay camera, stadium floodlights flash, banner to all players | Mario Golf cup flash for par or better; Putt Party's hole-in-one broadcast |

Rules for the pass:

- Time effects (freeze, slow motion) are **visual only and local**. In simultaneous play the simulation cannot pause for one player. [inferred]
- Use trauma-style shake (0–1, decays, amount = trauma²) and cap it low ([Bevy example](https://bevy.org/examples/camera/2d-screen-shake/)); honour the shake toggle.
- Nothing on this list may hide the ball, the aim line or the cup ([Pichlmair & Johansen](https://ar5iv.arxiv.org/html/2011.09201)).
- The stadium setting gives a free feedback channel: crowd noise and floodlights. Use them for results, not during aiming. [my suggestion]

**M5. Stuck-ball safety.** A "reset to last spot" button (costs one stroke, same as falling off in Putt Party ([TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/PuttParty))); automatic reset if a ball has moved less than 0.3 units in 4 s while not at rest; minimum exit speed from tunnels. Source: Putt Party's softlock list ([YMMV](https://tvtropes.org/pmwiki/pmwiki.php/YMMV/PuttParty)).

### Should

**S1. Round structure and pacing.**

| Setting | Now | Suggested | Basis |
|---|---|---|---|
| Holes per course | (9 planned) | Offer 6 ("quick") and 9 | Putt Party uses 6 ([FAQ](https://support-apps.discord.com/hc/en-us/articles/26502262624919-Putt-Party-FAQ)); short matches ([The Ludite](https://theludite.com/2014/10/29/smash-bros-what-makes-a-party-game/)) |
| Hole timer | 90 s | Keep 90 s; warning sound and visual from 15 s | Putt Party: 120 s with a 15 s warning ([TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/PuttParty)); GWYF classic: 120 s ([TheXboxHub](https://www.thexboxhub.com/golf-with-your-friends-review/)). 90 s is shorter than both, which suits holes with par 2–4 |
| When all but one have finished | – | Cut the remaining time to 20 s | estimate; stops one player holding up eight |
| Stroke cap | 8 | Keep 8 | GWYF default is 12 ([Blueprinted Gaming guide](https://blueprintedgaming.com/docs/golf-with-your-friends/multiplayer-and-workshop)); Putt Party's is unknown. 8 keeps a disaster hole from deciding the match |
| Score on time-out or cap | 10 | Cap + 1 (9) or par + 4, whichever is lower | estimate; keeps one bad hole recoverable ("it's only over when it's over") |
| Scorecard between holes | 9 s | 5–6 s, ends early when everyone is ready | estimate |
| Items held | 2 | Keep 2, or 3 to match Putt Party | Putt Party caps at 3 and discards extras ([TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/PuttParty)) |
| Target match length | – | 6 holes ≈ 6–8 min; 9 holes ≈ 10–13 min | estimate from the numbers above; Putt Party's 6 holes are at most 12 min |

**S2. Power-up set shaped like Putt Party's.** Roughly one third self-help, one third sabotage that lasts one shot and hits all others, one third hole-wide effects that also hit the user (see the [power-up table](#power-ups)). Cheapest high-value items to build first: reverse aim, hidden aim line, oversized ball, shrink, ice floor, wind in a chosen direction, rewind, hole magnet. [inferred priority]
Light catch-up: weight the random draw by position, so players behind on total strokes are more likely to draw strong self-help items and the leader mostly draws mild ones, as Mario Kart does by race position ([MarioWiki](https://www.mariowiki.com/Item_Boxes)). Keep the weighting gentle; one essay argues strong catch-up mostly creates kingmaking ([The Ludite](https://theludite.com/2014/10/29/smash-bros-what-makes-a-party-game/)).

**S3. Finished players spectate.** When you hole out, the camera goes to Overview or cycles between players still putting, with their names and stroke counts shown. Fall Guys designs rounds to be watchable ([Gamepur](https://www.gamepur.com/features/fall-guys-developers-q-and-a), via search summary); Putt Party lets extra people watch and queue ([FAQ](https://support-apps.discord.com/hc/en-us/articles/26502262624919-Putt-Party-FAQ)).

**S4. End-of-course awards as titles, not score.** Three chosen from a larger pool each match so they vary, as Mario Party varies its bonus stars ([MarioWiki](https://www.mariowiki.com/Bonus_Star)). Candidates: longest putt holed, most wall bounces on one shot, most falls, most items used on others, fastest hole, most lip-outs, best comeback hole. Include at least one that the last-placed player is likely to win.

**S5. Bots that create moments.** Bots should visibly gamble on shortcuts, sometimes fall off, use sabotage items on the leader, and react. Reviews say this genre is flat without other people ([Finger Guns](https://fingerguns.net/reviews/2020/05/21/golf-with-your-friends-ps4-review-bogeys/), via search summary). Putt Party's background characters have win, excited and disappointed animations ([Josh Burton](https://medium.com/@joshburton_30676/putt-party-7ed9b26c62cd)); the stadium crowd can play that role here.

**S6. Keep scenery out of the shot.** No animated set dressing between the default camera and the ball or across the aim line; one Putt Party player complains the monsters get in the way of shots ([Discord support community](https://support.discord.com/hc/en-us/community/posts/16069968046743-Activities), single post seen via search excerpt).

### Could

- **C1. Modifiers ("house rules")** chosen at match start: low gravity, ball collisions on, giant cups, everyone can hop once per shot, growing ball. Sources: Golf With Your Friends lobby options ([Blueprinted Gaming guide](https://blueprintedgaming.com/docs/golf-with-your-friends/multiplayer-and-workshop)); Golf Gang mutations ([Indie Games Plus](https://indiegamesplus.com/golf-gang-review/)). Avoid random ball shapes that make holes unfinishable (same guide).
- **C2. Speed mode**: score = strokes plus a time component, as Golf Gang does ([Indie Games Plus](https://indiegamesplus.com/golf-gang-review/)). Its exact formula is not published.
- **C3. Vote on the next course** after each one, and a tournament of 3 courses with items carried over ([FAQ](https://support-apps.discord.com/hc/en-us/articles/26502262624919-Putt-Party-FAQ)).
- **C4. Cosmetic unlock per finished course** (ball skin, trail, sink effect) ([TheXboxHub](https://www.thexboxhub.com/golf-with-your-friends-review/)).
- **C5. Structural gimmick courses** once the basics work: a course where each cup is the next tee (Openborough), holes with several cups that set your next start (Mazemoor), a pachinko drop hole (Fortune Falls) ([TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/PuttParty)).
- **C6. Daily course**: a fixed rotation or seed per day with a personal best. I found no source on daily variety for this genre; this is my suggestion.
- **C7. Shareable replay of an ace** (Fall Guys' "moments players want to share" ([Fall Guys](https://fallguys.com/news/behind-the-beans-the-story-of-snowball-survival))).

### Hole-design checklist for level designers

Each line cites the principle it comes from. Dimensions are estimates in world units for a ball of radius 0.16.

Route and readability
- [ ] The hole has **one idea** you can say in a sentence ("bank off the curved wall to skip the S-bend"). (Hole design 4)
- [ ] From the tee, in the default Follow view, the player can see the cup or a clear landmark above it, and can see where the shortcut goes. If not, the intro fly-through must show both. (Walkabout: landmarks and markers, Hole design 5)
- [ ] There is an **ace line**: a single shot from the tee that can hole out with correct aim and power. It may need a bank or a jump. (Putt-Putt, Hole design 1)
- [ ] There is a **safe line** that reaches the cup in par with no risk of falling. (Windmill principle, Hole design 2)
- [ ] There is a **shortcut** that saves at least one stroke and has a visible cost: a drop to the void, a thin wall, a timed obstacle. (Hole design 2)
- [ ] Hazards look like hazards before you reach them. Invisible or surprise hazards belong only on a course whose stated theme is that (Putt Party's Invisible Isles). (Hole design 3)

Shape
- [ ] No hole is an axis-aligned box. Use at least two of: a curve, a banked turn, a ramp, a drop to a lower level, a narrowing. (Owner feedback; Putt Party courses are each built on such a feature)
- [ ] Fairway width 2.5–4 units in ordinary sections; "thin" sections 0.8–1.2 units and no longer than about 6 units. [estimate]
- [ ] Walls are thin (0.1–0.15 units) and low enough that a fast or lofted ball can clear them; where a wall is meant to be a rail, it is clearly taller. [estimate; owner feedback]
- [ ] Open edges are deliberate. An edge beside the safe line has a low lip; an edge beside the shortcut has none. [estimate]
- [ ] Drops land on a surface that keeps the ball in play: a bowl, a backstop, or a wide flat. No drop should end in a place where the only move is to fall again. (Hole design 7)
- [ ] The cup sits on flat ground at least 1 unit across, not on a slope or a tiny platform. (GWYF criticism, Hole design 6)
- [ ] Length: tee to cup along the safe line 10–18 units for par 2, 18–30 for par 3, 30–45 for par 4. A full-power putt on flat turf should cover most of a par-2 hole. [estimate; check against `MAX_PUTT` and `ROLL_DECEL` in the build]
- [ ] Par is 2, 3 or 4. Par = strokes for a competent player on the safe line. (Putt Party's definition of par)

Recovery and failure
- [ ] After a bad first shot from anywhere on the hole, the player still has a shot that makes progress. (Fall Guys: failure should feel fair)
- [ ] Falling off returns the ball to the last resting spot at the cost of one stroke, and that spot is never one from which falling again is likely. (Putt Party rule)
- [ ] There is nowhere a ball can come to rest and be unable to putt out: no flat tops on decorations, no pockets behind obstacles, no dead zones inside spinners. (Putt Party softlocks, Hole design 7)
- [ ] Tunnels, portals and boosters throw the ball out with enough speed to clear the exit. (Putt Party portal softlock)

Simultaneous play (my estimates; no source found)
- [ ] The tee is wide enough for 8 balls side by side (about 3 units) or the game spawns them in a small grid.
- [ ] No single-ball-wide choke point within the first 5 units of the tee.
- [ ] Moving obstacles have a cycle short enough (2–4 s) that waiting for a gap does not cost a slow player the timer.
- [ ] Pickups: 1–3 per hole, at least one on the safe line and one that needs a detour or sits on the shortcut. Putt Party's "?" blocks are collected by driving into them ([FAQ](https://support-apps.discord.com/hc/en-us/articles/26502262624919-Putt-Party-FAQ)).
- [ ] The hole can be finished in under half the hole timer by a player who takes par + 2.

Sign-off test
- [ ] A new player reaches the cup within the stroke cap on the first try.
- [ ] A practised player can ace it about one time in ten. [estimate]
- [ ] Three different testers describe the hole's idea in the same words.

### Suggested 9-hole difficulty arc

Basis: the opener / climb / mid-course peak / lighter hole pattern from mini-golf building guidance ([Patch Perfect Yard](https://patchperfectyard.com/building-a-mini-golf-course/), a weak source), Walkabout's three-act shape and its limit of one or two "do or die" holes per course (Hole design 5), and one-idea-per-hole. The specific assignment per hole is my own.

| Hole | Par | Role | Content |
|---|---|---|---|
| 1 | 2 | Confidence | Wide, gently curved, walled. Ace is a straight shot with correct power. Teaches drag, power and the cup. No void. |
| 2 | 2 | Teach banking | Dogleg where the ace is a single bank off a curved wall. One pickup on the line. |
| 3 | 3 | Teach height | A ramp down to a lower green. First open edge, on the outside of the shortcut only. |
| 4 | 3 | First real choice | Safe S-bend versus a thin-wall shortcut you can fly off. Pickup placed on the shortcut. |
| 5 | 3 | Mid-course peak ("signature") | The course's main gimmick at full strength: a moving obstacle or spring with timing. Risk of the void on both lines. This is the first of at most two "do or die" holes. |
| 6 | 2 | Breather | Short, showy, generous: a big drop into a funnel or bowl that feeds the cup. High ace rate. |
| 7 | 3 | Combine | Two earlier ideas together (bank + ramp, or ramp + timing). Two viable routes of similar value. |
| 8 | 4 | Longest | Multi-level route with a mid-hole landmark. Several pickups; the place where items change the standings. |
| 9 | 3 | Finale | The most dramatic layout, with a high-variance shortcut that can swing 2–3 strokes, so the leader is not safe. Second "do or die" hole. |

Total par 25. For a 6-hole quick course use holes 1, 2, 4, 5, 6 and 9.

---

## What I could not find

- **Putt Party's stroke limit, time-out score, default camera behaviour, how power is displayed, whether balls collide, and the effect of the Unlovaball power-up.** No readable source states them. Someone should play a round and note these.
- **Player reviews of Putt Party.** No Reddit thread or long review surfaced in search; opinion comes from the fan wiki's bug list and one forum post.
- **The two juice talks and the GMTK and GDC camera talks themselves.** They are videos. I used written lists and summaries of them and say so where they are cited.
- **Developer writing on camera design in marble or rolling-ball games** (Marble It Up, Super Monkey Ball). Only reviews turned up.
- **Any source on hole design for simultaneous multiplayer**, and any professional source giving hole dimensions, pars or ace rates as numbers.
- **Numeric comfort limits for camera rotation.** Guidance is qualitative.
- Pages that refused automated access and were not read: a Hive blog review of Putt Party (bot check), the Internet Archive copies of the Discord pages, and the GamesRadar Fall Guys interview (only the headline loaded).

---

## Sources

Putt Party
- https://support-apps.discord.com/hc/en-us/articles/26502262624919-Putt-Party-FAQ – official rules: players, modes, holes per course, par, power-up basics, controls.
- https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/PuttParty – fan wiki: course count and names, every named power-up and effect, 2-minute timer, out-of-bounds rule, 3-item cap.
- https://tvtropes.org/pmwiki/pmwiki.php/YMMV/PuttParty – fan wiki: bug list, aim wobble workaround, "camera 2 (full hole view)", Thin Trails.
- https://tvtropes.org/pmwiki/pmwiki.php/Trivia/PuttParty – made free in May 2023.
- https://discord.fandom.com/wiki/Putt_Party – player cap, access history, bug warning.
- https://medium.com/@joshburton_30676/putt-party-7ed9b26c62cd – animator's account: lead designer, engine, background characters and their reactions, dropped themed courses.
- https://discord.com/blog/server-activities-games-voice-watch-together – Discord's one-line description ("Mini golf, mega drama").
- https://support.discord.com/hc/en-us/community/posts/16069968046743-Activities – single user complaint about lag and monsters blocking shots (search excerpt only).
- https://github.com/PondLabs/roosterchat/issues/222 – a clone's spec noting Putt Party's stroke rule is undocumented (search excerpt only).
- https://dcsv.me/en/blog/putt-party-a-fun-discord-activity-for-golf-enthusiasts – repeats the FAQ; no new detail.
- https://activities.rocks/putt-party – Discord's short description of the game; no new detail.

Comparable games
- https://blueprintedgaming.com/docs/golf-with-your-friends/multiplayer-and-workshop – Golf With Your Friends lobby settings, modes, power-ups, ball shapes (third-party guide).
- https://www.thexboxhub.com/golf-with-your-friends-review/ – GWYF camera problems, 15 s free camera, 2-minute timer, course length, cosmetics.
- https://hardcoregamer.com/reviews/review-golf-with-your-friends/378832/ – GWYF cup placement criticism (search summary).
- https://fingerguns.net/reviews/2020/05/21/golf-with-your-friends-ps4-review-bogeys/ – GWYF is flat without friends (search summary).
- https://indiegamesplus.com/golf-gang-review/ – Golf Gang mutations, hitting a moving ball, time plus strokes, cosmetics.
- https://www.thesixthaxis.com/2022/05/19/golf-gang-review-mini-golf-racing/ – Golf Gang speed-versus-efficiency framing (search summary).
- https://www.mdwiki.org/wiki/Party_Golf – Party Golf: simultaneous race, 50+ custom presets (search summary).
- https://www.cgmagonline.com/review/mario-golf-super-rush-switch-review/ – criticism of Super Rush's overhead putting camera (search summary).
- https://www.mariowiki.com/List_of_golfing_terms – Mario Golf cup effects for par or better (search summary).
- https://wikirby.com/wiki/Dream_Course – Kirby's Dream Course short/long guide toggle (search summary).
- https://www.uploadvr.com/how-lucas-martell-brings-hollywood-production-storytelling-to-walkabout-mini-golf/ – Walkabout Mini Golf: three-act courses, landmarks, a twist per course.
- https://www.uploadvr.com/quixote-valley-ghibli/ – Walkabout windmills that catch rather than block (search summary).
- https://voicesofvr.com/1560-walkabout-mini-golfs-incredible-fusion-of-worldbuilding-gameplay-social-dynamics-dlc-experimentation/ – path drawn through the whole course (search summary).
- https://mixed-news.com/en/walkabout-mini-golf-vr-is-one-of-the-most-successful-vr-games-we-spoke-with-its-creator/ – "do or die" holes limited to one or two (search summary).
- https://techraptor.net/gaming/previews/super-monkey-ball-banana-blitz-hd-preview – Super Monkey Ball camera cannot keep up at speed.
- https://www.nintendo-insider.com/super-monkey-ball-3d-review/ – non-adjustable camera hides hazards (search summary).
- https://www.nintendolife.com/news/2021/09/super_monkey_ball_banana_mania_would_never_have_come_to_be_without_the_fans – camera control added after fan requests (search summary).

Game feel
- https://www.gamedeveloper.com/design/game-feel-the-secret-ingredient – Swink's six layers of game feel and examples.
- https://medienwissenschaft.uni-bayreuth.de/wp-content/uploads/GxD-10-Game-Feel.pdf – university lecture slides listing the contents of "Juice it or lose it" and "The art of screenshake", and Swink's definition of polish.
- https://github.com/grapefrukt/juicy-breakout – source and one-line definition of juice from the Juice it or lose it authors.
- https://www.gamedeveloper.com/design/vlambeer-co-founder-shares-advice-on-building-better-action-games – report on Nijman's talk; confirms two tweaks.
- https://ar5iv.arxiv.org/html/2011.09201 – Pichlmair & Johansen, "Designing Game Feel: A Survey": three kinds of polish, technique list, cautions on overuse.
- https://www.gamedeveloper.com/design/video-indies-resist-the-urge-to-juice-it-or-lose-it- – counter-argument to heavy juice (search summary).
- https://www.gamezebo.com/news/peggle-how-a-spark-started-a-fever/ – why Peggle's excess sits at the end of the level (search summary).
- https://www.gamesradar.com/uk/peggle-10/ – description of Extreme Fever's zoom and slow motion (search summary).
- https://bevy.org/examples/camera/2d-screen-shake/ – trauma-based shake as implemented from Eiserloh's GDC talk (search summary).
- https://gamejuice.pages.dev/articles/hit-stop-frame-trick , https://dev.to/saltmire/godot-4-screen-shake-and-hit-stop-in-one-script-11eh , https://forum.godotengine.org/t/game-feel-checklist-for-godot-4-hit-stop-trauma-shake-coyote-time-and-more/145340 – differing hit-stop durations (search summaries; low authority).
- https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5445157/ – Larche et al.: near-misses raise both urge to continue and frustration (search summary).
- https://link.springer.com/article/10.1007/s11469-019-00070-9 – Finserås et al.: near miss in a video game felt less exciting than a clear win (search summary).

Hole design
- https://en.wikipedia.org/wiki/Putt-Putt_Fun_Center – Putt-Putt: par 2 everywhere, ace always possible, skill over gimmicks.
- https://www.miniaturegolfsolutions.com/Crazy-Golf-Course-Design--4-Obstacles-That-Mini-Golfers-Love-to-Hate-1-10858.html – windmill, pipe, dogleg and loop holes sorted by risk, luck and skill.
- https://golf.com/travel/golf-hole-design-beginners-guide/ – risk/reward and heroic options in golf architecture (search summary).
- https://www.australiangolfdigest.com.au/opinion-small-hole-big-deal/ – a mini-golf designer on temptation without constant punishment (search summary).
- https://minigolfspots.com/learn/mini-golf-course-ideas – one idea per hole; simple beats cluttered (search summary; hobbyist site).
- https://patchperfectyard.com/building-a-mini-golf-course/ – opener / climb / peak / breather sequence (search summary; hobbyist site).

Camera
- https://www.unrealengine.com/tech-blog/six-ingredients-for-a-dynamic-third-person-camera – player-input priority with cooldown, camera lag, spring arm, whisker rays, auto-rotate to movement; based on Nesky's Journey talk.
- https://www.gamedeveloper.com/design/third-person-camera-view-in-games-a-record-of-the-most-common-problems-in-modern-games-solutions-taken-from-new-and-retro-games – occlusion, collision, nausea and control problems with fixes.
- https://www.gamedeveloper.com/design/scroll-back-the-theory-and-practice-of-cameras-in-side-scrollers – attention / interaction / comfort; look-ahead, smoothing, cue focus, zoom-to-fit.
- https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/117 – camera shake, FOV and auto-camera settings for motion sensitivity, with examples.
- https://liquipedia.net/rocketleague/Settings – Rocket League camera setting ranges (search summary).
- https://www.esports.net/wiki/guides/best-camera-setting-rocket-league/ – what stiffness does (search summary).
- https://www.destructoid.com/best-rocket-league-camera-settings/ – common settings; shake off (search summary).
- https://howlingmoonsoftware.com/improved-lerp-smoothing/ – frame-rate-independent smoothing formula and half-life.
- https://itch.io/post/3799073 – small developers and testers on zooming out with speed and ball shadows (search summary; anecdotal).

Party design and retention
- https://fallguys.com/news/behind-the-beans-the-story-of-snowball-survival – Fall Guys' five level pillars.
- https://www.gamepur.com/features/fall-guys-developers-q-and-a – rounds designed to be watchable (search summary).
- https://www.gamespot.com/articles/how-nintendo-uses-luck-to-make-games-fun-for-every/1100-6465850/ – why Nintendo adds luck; "in it until the end".
- https://theludite.com/2014/10/29/smash-bros-what-makes-a-party-game/ – short matches over catch-up; criticism of the blue shell and random items.
- https://www.mariowiki.com/Item_Boxes – Mario Kart gives stronger items to trailing players (search summary).
- https://www.mariowiki.com/Bonus_Star – Mario Party end-of-game bonus stars (search summary).
