# Aesthetic Affinity Profiler simulation

Seed 20261122. Each mode uses 200 personas per approved CARI entry (78 entries).
Personas select options using vector similarity, signature motif affinity and deterministic random noise. Era recall is imperfect. The simulation uses the same ranking and tie-break logic as the quiz.
The target is at least 80% full-mode recovery. Reachability below means observed within this simulation.

| Mode | Profiles | Top-3 recovery | Target ≥80% | Profiles with fewer than 3 eligible bottom results |
| --- | ---: | ---: | --- | ---: |
| Full | 15600 | 88.8% | Met | 0 |
| Quick | 15600 | 86.6% | Met | 0 |

## Reachability

- Full mode, unseen in top 3: None observed
- Full mode, unseen in bottom 3: None observed
- Quick mode, unseen in top 3: Corporate Scene
- Quick mode, unseen in bottom 3: Corporate Scene, Pulp Fantasy

## Most-confused pairs

Rows show the intended persona and a different style ranked first. A target can still appear lower in the top three.

| Persona | Ranked first | Full | Quick |
| --- | --- | ---: | ---: |
| Polychrome | Neon Ooze | 147 | 118 |
| Corporate Synthwave | Laser Grid | 131 | 145 |
| Contempo Eclectic | Wacky Pomo | 117 | 66 |
| Superflat Pop | Four Colors | 109 | 47 |
| Supergraphic Ultramodern | Neon Ooze | 105 | 19 |
| Blob World | Neon Ooze | 98 | 16 |
| Rad Dog / Neon Surf | Neon Ooze | 98 | 65 |
| Electroclash | Neon Ooze | 97 | 28 |
| Neo-Y2K | Four Colors | 86 | 97 |
| Live Laugh Love | Pastel Southwestern | 83 | 78 |
| Graffiti Pop | Neon Ooze | 74 | 29 |
| Corporate Scene | Neon Ooze | 72 | 34 |
| Millennium Disco | Laser Grid | 72 | 97 |
| Millennium Disco | Vectorheart | 69 | 38 |
| Googie Kitsch | Neon Ooze | 68 | 23 |

## Recovery by aesthetic

| CARI entry | Full top-3 recovery | Quick top-3 recovery |
| --- | ---: | ---: |
| Corporate Scene | 1.0% | 0.0% |
| Neo-Y2K | 8.0% | 14.5% |
| Millennium Disco | 9.0% | 19.5% |
| Themed Spaces | 10.0% | 21.5% |
| Superflat Pop | 13.5% | 9.5% |
| Contempo Eclectic | 19.5% | 30.0% |
| Dollar Store Vernacular | 35.0% | 26.5% |
| Pulp Fantasy | 40.5% | 27.0% |
| Electroclash | 61.5% | 55.5% |
| Live Laugh Love | 76.0% | 73.5% |
| Acidgrafix | 83.0% | 73.5% |
| Genericana | 85.5% | 95.0% |
| Graffiti Pop | 85.5% | 52.0% |
| Mid Century Medieval | 86.0% | 81.5% |
| Radical Surrealism | 91.0% | 84.5% |
| Renaissance Revival | 91.5% | 93.0% |
| Decoplex | 93.0% | 88.5% |
| Cyberbougie | 93.5% | 88.5% |
| Diner Kitsch | 94.5% | 96.5% |
| Airbrush Surrealism | 95.0% | 99.5% |
| Blob World | 95.5% | 99.5% |
| Pixelscape | 95.5% | 85.5% |
| Soft Colonial Wanderlust | 95.5% | 95.0% |
| Deco-Luxe | 96.0% | 95.5% |
| Googie Kitsch | 97.0% | 98.5% |
| Nouveau Organic | 97.0% | 98.0% |
| Corporate Synthwave | 97.5% | 95.0% |
| Curly Girly | 97.5% | 90.5% |
| Indie Sleaze | 97.5% | 92.0% |
| Supergraphic Ultramodern | 97.5% | 100.0% |
| Ultramodern Revival | 97.5% | 97.5% |
| Y2K Aesthetic | 97.5% | 100.0% |
| Internet Awesomesauce | 98.0% | 99.0% |
| Industrial Americana | 98.5% | 94.5% |
| Jumbled Font | 98.5% | 99.0% |
| New Wave Tropical | 98.5% | 96.0% |
| Polychrome | 99.0% | 98.5% |
| Pomo Faux Ruins | 99.0% | 94.5% |
| Disco Deco | 99.5% | 94.5% |
| Hipness Purgatory | 99.5% | 99.0% |
| Mission School | 99.5% | 99.5% |
| Neo-Vectorheart | 99.5% | 96.5% |
| Pacific Punk Wave | 99.5% | 86.5% |
| Utopian Scholastic | 99.5% | 91.5% |
| Austurbane | 100.0% | 100.0% |
| Boho-Chic | 100.0% | 100.0% |
| Corporate Cyberspace | 100.0% | 100.0% |
| Corporate Memphis | 100.0% | 99.5% |
| Cyberdelia | 100.0% | 100.0% |
| Early Cyber | 100.0% | 93.0% |
| Eco-Beige | 100.0% | 100.0% |
| Factory Pomo | 100.0% | 100.0% |
| Festival Marketplace | 100.0% | 92.5% |
| Four Colors | 100.0% | 94.5% |
| Frasurbane | 100.0% | 100.0% |
| Frutiger Aero | 100.0% | 99.5% |
| Gay Nineties Revival | 100.0% | 100.0% |
| Gen X Soft Club | 100.0% | 100.0% |
| Global Village Coffeehouse | 100.0% | 100.0% |
| Hexatron | 100.0% | 100.0% |
| Industrial Gothic | 100.0% | 99.5% |
| Laser Grid | 100.0% | 100.0% |
| McBling | 100.0% | 100.0% |
| Memphis-Milano | 100.0% | 100.0% |
| Neon Ooze | 100.0% | 100.0% |
| Nu-Brutalism | 100.0% | 94.0% |
| Paperback Chic | 100.0% | 99.5% |
| Pastel Southwestern | 100.0% | 100.0% |
| Preschool Pop | 100.0% | 96.5% |
| Rad Dog / Neon Surf | 100.0% | 83.0% |
| Sportsbrut | 100.0% | 95.0% |
| Urban Grunge | 100.0% | 99.0% |
| Vector Minimalism | 100.0% | 100.0% |
| Vectorheart | 100.0% | 100.0% |
| Wacky Pomo | 100.0% | 100.0% |
| Whimsicraft | 100.0% | 100.0% |
| Whimsigothic | 100.0% | 81.5% |
| Zen-X | 100.0% | 100.0% |

This is a synthetic benchmark. Human test–retest and face validity require separate playtests.
