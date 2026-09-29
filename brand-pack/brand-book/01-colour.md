# Colour

Dark-first: Night is the default stage for every app, and light mode (Snow) is for reading-heavy pages, print and partners. Contrast figures are WCAG ratios. Body text needs 4.5 or more; large text (24px+) and icons need 3 or more.

## Master palette

| Swatch | Name | HEX | RGB | CMYK | On Night | On Snow | Use |
|---|---|---|---|---|---|---|---|
| ![](data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='18'%3E%3Crect width='28' height='18' rx='4' fill='%23E63946'/%3E%3C/svg%3E) | **Gorkha Red** | `#E63946` | 230, 57, 70 | 0/75/70/10 | 4.5 | 3.7 | Master primary. Symbol, CTA buttons, LIVE/active states, the one red thing on a screen. |
| ![](data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='18'%3E%3Crect width='28' height='18' rx='4' fill='%23B81D2B'/%3E%3C/svg%3E) | **Ember** | `#B81D2B` | 184, 29, 43 | 0/84/77/28 | 2.9 | 5.7 | Red for text/links on light backgrounds; pressed states. |
| ![](data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='18'%3E%3Crect width='28' height='18' rx='4' fill='%23101216'/%3E%3C/svg%3E) | **Night** | `#101216` | 16, 18, 22 | 27/18/0/91 | 1.0 | 16.6 | Default app/website background (dark-first). |
| ![](data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='18'%3E%3Crect width='28' height='18' rx='4' fill='%231B1F26'/%3E%3C/svg%3E) | **Slate** | `#1B1F26` | 27, 31, 38 | 29/18/0/85 | 1.1 | 14.7 | Cards, rows, sheets on Night. |
| ![](data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='18'%3E%3Crect width='28' height='18' rx='4' fill='%232A3039'/%3E%3C/svg%3E) | **Ridge** | `#2A3039` | 42, 48, 57 | 26/16/0/78 | 1.4 | 11.8 | Borders, dividers, raised surfaces, chips. |
| ![](data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='18'%3E%3Crect width='28' height='18' rx='4' fill='%23A3AAB5'/%3E%3C/svg%3E) | **Mist** | `#A3AAB5` | 163, 170, 181 | 10/6/0/29 | 8.0 | 2.1 | Secondary text on dark; never body text on light. |
| ![](data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='18'%3E%3Crect width='28' height='18' rx='4' fill='%235B6370'/%3E%3C/svg%3E) | **Stone** | `#5B6370` | 91, 99, 112 | 19/12/0/56 | 3.1 | 5.4 | Secondary text on light backgrounds. |
| ![](data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='18'%3E%3Crect width='28' height='18' rx='4' fill='%23F4F1EA'/%3E%3C/svg%3E) | **Snow** | `#F4F1EA` | 244, 241, 234 | 0/1/4/4 | 16.6 | 1.0 | Primary text on dark; light-mode background (warm, like morning light on paper). |
| ![](data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='18'%3E%3Crect width='28' height='18' rx='4' fill='%2315171C'/%3E%3C/svg%3E) | **Ink** | `#15171C` | 21, 23, 28 | 25/18/0/89 | 1.0 | 15.9 | Primary text on light backgrounds. |

## Product palettes

Each product has three colours and no more. **Accent** is used on dark backgrounds for the symbol, active states, the pill and one highlight per screen. **Deep** is used on light backgrounds for the symbol, links and text. **Tint** is used for surfaces on dark, such as pill fills, category rows and avatar discs.

| Brand | Role | Name | HEX | RGB | CMYK | Contrast |
|---|---|---|---|---|---|---|
| CHIMAL | accent | Cinema Amber | `#E8A62A` | 232, 166, 42 | 0/28/82/9 | 8.9 on Night |
|  | deep | Reel Brown | `#8F5E00` | 143, 94, 0 | 0/34/100/44 | 4.9 on Snow |
|  | tint | Amber Dusk | `#2A2114` | 42, 33, 20 | 0/21/52/84 | accent on it 7.5 |
| KHABAR | accent | Signal Blue | `#3183F2` | 49, 131, 242 | 80/46/0/5 | 5.1 on Night |
|  | deep | Press Blue | `#1656B8` | 22, 86, 184 | 88/53/0/28 | 6.1 on Snow |
|  | tint | Night Wire | `#0E1A2A` | 14, 26, 42 | 67/38/0/84 | accent on it 4.7 |
| SWARA | accent | Raga Pink | `#E6479D` | 230, 71, 157 | 0/69/32/10 | 5.1 on Night |
|  | deep | Deep Raga | `#A81F6B` | 168, 31, 107 | 0/82/36/34 | 6.1 on Snow |
|  | tint | Velvet | `#24111E` | 36, 17, 30 | 0/53/17/86 | accent on it 4.9 |
| UKAALI | accent | Tea Mint | `#2BD19B` | 43, 209, 155 | 79/0/26/18 | 9.5 on Night |
|  | deep | Tea Leaf | `#0B7A57` | 11, 122, 87 | 91/0/29/52 | 4.7 on Snow |
|  | tint | Hill Shade | `#10261F` | 16, 38, 31 | 58/0/18/85 | accent on it 8.1 |

## Primary, secondary, background, text and accent at a glance

| Brand | Primary | Secondary | Background | Text | Accent |
|---|---|---|---|---|---|
| GORKHA TV | Gorkha Red `#E63946` | Snow `#F4F1EA` | Night `#101216` | Snow / Ink | Ember `#B81D2B` |
| CHIMAL | Cinema Amber `#E8A62A` | Gorkha Red `#E63946` (LIVE, master moments) | Night `#101216` / Amber Dusk `#2A2114` | Snow / Ink | Reel Brown `#8F5E00` |
| KHABAR | Signal Blue `#3183F2` | Gorkha Red `#E63946` (LIVE, master moments) | Night `#101216` / Night Wire `#0E1A2A` | Snow / Ink | Press Blue `#1656B8` |
| SWARA | Raga Pink `#E6479D` | Gorkha Red `#E63946` (LIVE, master moments) | Night `#101216` / Velvet `#24111E` | Snow / Ink | Deep Raga `#A81F6B` |
| UKAALI | Tea Mint `#2BD19B` | Gorkha Red `#E63946` (LIVE, master moments) | Night `#101216` / Hill Shade `#10261F` | Snow / Ink | Tea Leaf `#0B7A57` |

## Rules
- **One accent per screen.** A CHIMAL screen uses Cinema Amber and nothing else from the product palette. Gorkha Red is the only colour allowed to appear in every app, and only for LIVE, the master symbol and the verified check.
- **The 70 / 20 / 10 split.** About 70% Night and Slate, 20% Snow and Mist text, 10% accent. If the accent covers more than a tenth of a screen, it has become decoration.
- **Text on an accent fill** is always Night (dark text), never white. All four accents pass 5:1 with Night.
- **On light backgrounds** use the *deep* shade for symbols and text. Accents on Snow fail contrast.
- **The cross-app hub** (the gorkhatv.site home and nav pills) is the only place all four accents appear together, each confined to its own pill.
- **No gradients between brand colours.** The only gradients allowed are Night-to-Slate depth and the accent 'mountain light' glow on icons and splash screens, at 30% opacity or less.
- **Photography first.** On posters and thumbnails, the image carries the colour and the brand appears as the symbol plus one accent rule or badge.
- **Print:** CMYK values are conversions for coated stock. For signage, match to Pantone on press with a printed proof.
