# Aesthetic Affinity Profiler simulation

Seed 20261122. Each mode uses 200 personas per approved CARI entry (78 entries).
Personas select options using vector similarity, signature motif affinity and deterministic random noise. Era recall is imperfect. The simulation uses the same ranking and tie-break logic as the quiz.
The target is at least 80% full-mode recovery. Reachability below means observed within this simulation.

| Mode | Profiles | Top-3 recovery | Target ≥80% | Profiles with fewer than 3 eligible bottom results |
| --- | ---: | ---: | --- | ---: |
| Full | 15600 | 89.9% | Met | 0 |
| Quick | 15600 | 86.8% | Met | 0 |
| Quick proposal (review) | 15600 | 70.8% | Below target | 0 |

## Reachability

- Full mode, unseen in top 3: None observed
- Full mode, unseen in bottom 3: Contempo Eclectic
- Quick mode, unseen in top 3: None observed
- Quick mode, unseen in bottom 3: Pulp Fantasy, Themed Spaces

## Most-confused pairs

Rows show the intended persona and a different style ranked first. A target can still appear lower in the top three.

| Persona | Ranked first | Full | Quick |
| --- | --- | ---: | ---: |
| Corporate Synthwave | Laser Grid | 132 | 157 |
| Polychrome | Neon Ooze | 125 | 109 |
| Supergraphic Ultramodern | Neon Ooze | 110 | 20 |
| Contempo Eclectic | Wacky Pomo | 109 | 58 |
| Rad Dog / Neon Surf | Neon Ooze | 104 | 56 |
| Superflat Pop | Four Colors | 104 | 67 |
| Millennium Disco | Laser Grid | 103 | 96 |
| Live Laugh Love | Pastel Southwestern | 101 | 69 |
| Electroclash | Neon Ooze | 94 | 27 |
| Corporate Scene | Neon Ooze | 82 | 42 |
| Neo-Y2K | Four Colors | 82 | 87 |
| Graffiti Pop | Neon Ooze | 77 | 40 |
| Blob World | Neon Ooze | 75 | 26 |
| Decoplex | Wacky Pomo | 68 | 23 |
| Disco Deco | Memphis-Milano | 57 | 152 |

## Recovery by aesthetic

| CARI entry | Full top-3 recovery | Quick top-3 recovery |
| --- | ---: | ---: |
| Corporate Scene | 0.5% | 0.0% |
| Neo-Y2K | 9.0% | 18.0% |
| Contempo Eclectic | 13.0% | 36.0% |
| Superflat Pop | 13.0% | 10.0% |
| Millennium Disco | 14.5% | 12.5% |
| Themed Spaces | 21.0% | 28.0% |
| Dollar Store Vernacular | 41.0% | 36.0% |
| Electroclash | 68.0% | 55.0% |
| Pulp Fantasy | 74.0% | 30.0% |
| Acidgrafix | 80.0% | 76.0% |
| Graffiti Pop | 81.5% | 37.5% |
| Live Laugh Love | 82.5% | 69.0% |
| Mid Century Medieval | 91.5% | 85.0% |
| Decoplex | 93.5% | 89.5% |
| Genericana | 93.5% | 95.0% |
| Internet Awesomesauce | 94.0% | 96.5% |
| Ultramodern Revival | 94.0% | 95.0% |
| Cyberbougie | 95.0% | 86.5% |
| Airbrush Surrealism | 95.5% | 99.5% |
| Deco-Luxe | 96.0% | 96.5% |
| Jumbled Font | 96.0% | 99.5% |
| Supergraphic Ultramodern | 96.0% | 99.5% |
| Corporate Synthwave | 97.0% | 95.5% |
| Nouveau Organic | 97.0% | 97.5% |
| Pixelscape | 97.0% | 92.0% |
| Curly Girly | 98.0% | 92.5% |
| Soft Colonial Wanderlust | 98.0% | 94.5% |
| Blob World | 98.5% | 96.5% |
| Diner Kitsch | 98.5% | 98.0% |
| Disco Deco | 98.5% | 97.5% |
| Googie Kitsch | 98.5% | 97.5% |
| Industrial Americana | 98.5% | 94.0% |
| Renaissance Revival | 98.5% | 90.5% |
| Indie Sleaze | 99.0% | 91.5% |
| New Wave Tropical | 99.0% | 98.0% |
| Pomo Faux Ruins | 99.0% | 95.5% |
| Radical Surrealism | 99.0% | 82.0% |
| Four Colors | 99.5% | 96.0% |
| Neo-Vectorheart | 99.5% | 96.5% |
| Polychrome | 99.5% | 97.5% |
| Utopian Scholastic | 99.5% | 88.0% |
| Y2K Aesthetic | 99.5% | 99.0% |
| Austurbane | 100.0% | 100.0% |
| Boho-Chic | 100.0% | 100.0% |
| Corporate Cyberspace | 100.0% | 100.0% |
| Corporate Memphis | 100.0% | 99.5% |
| Cyberdelia | 100.0% | 100.0% |
| Early Cyber | 100.0% | 98.5% |
| Eco-Beige | 100.0% | 100.0% |
| Factory Pomo | 100.0% | 100.0% |
| Festival Marketplace | 100.0% | 94.0% |
| Frasurbane | 100.0% | 100.0% |
| Frutiger Aero | 100.0% | 99.5% |
| Gay Nineties Revival | 100.0% | 100.0% |
| Gen X Soft Club | 100.0% | 100.0% |
| Global Village Coffeehouse | 100.0% | 100.0% |
| Hexatron | 100.0% | 100.0% |
| Hipness Purgatory | 100.0% | 98.5% |
| Industrial Gothic | 100.0% | 99.0% |
| Laser Grid | 100.0% | 100.0% |
| McBling | 100.0% | 100.0% |
| Memphis-Milano | 100.0% | 100.0% |
| Mission School | 100.0% | 100.0% |
| Neon Ooze | 100.0% | 99.0% |
| Nu-Brutalism | 100.0% | 97.0% |
| Pacific Punk Wave | 100.0% | 85.5% |
| Paperback Chic | 100.0% | 100.0% |
| Pastel Southwestern | 100.0% | 100.0% |
| Preschool Pop | 100.0% | 96.0% |
| Rad Dog / Neon Surf | 100.0% | 81.0% |
| Sportsbrut | 100.0% | 94.0% |
| Urban Grunge | 100.0% | 99.5% |
| Vector Minimalism | 100.0% | 100.0% |
| Vectorheart | 100.0% | 100.0% |
| Wacky Pomo | 100.0% | 100.0% |
| Whimsicraft | 100.0% | 99.0% |
| Whimsigothic | 100.0% | 86.5% |
| Zen-X | 100.0% | 100.0% |

This is a synthetic benchmark. Human test–retest and face validity require separate playtests.
