# Gorkha TV Brand System

**A modern Himalayan media company, born in Darjeeling, built for a global audience.**

Gorkha TV is the parent company. It runs four products that are meant to grow into brands of their own: **CHIMAL** (films and entertainment), **KHABAR** (news), **SWARA** (music) and **UKAALI** (reels and creators). This book is the single reference for how all five look, move and speak. Every colour, size and rule here is a token or a file in this system, so designers, developers and AI tools build from the same source.

## 1. Positioning

For the Gorkha, Darjeeling and wider Nepali-speaking audience, in the hills and across the diaspora, Gorkha TV is the home of their own stories, news, music and creators. It carries the finish of a global streaming service and the voice of home. Global platforms treat this audience as a niche inside a larger catalogue. Local TV channels look dated and parochial. Gorkha TV sits between the two: world-class product design, with culture built into it rather than pasted on top.

**Promise:** *Our stories, made to world standard.*

## 2. Personality

| We are | We are not |
| --- | --- |
| Confident, proud of where we come from | Political, nationalistic or militaristic |
| Modern and digital-first | A traditional local cable channel |
| Warm, rooted, quietly Himalayan | A tourism poster or a cultural museum |
| Youthful and quick | Loud, noisy or gimmicky |
| Premium and precise | Luxury-gold or ornamental |

Voice: short sentences, plain words, English and Nepali side by side. We talk like a friend who works in media, not like a government notice.

## 3. Brand architecture

An **endorsed-brand** model. Each product has its own name, symbol and accent colour, so it can stand alone in an app store, on YouTube or on a billboard. The parent appears as a quiet endorsement and never as a prefix.

```
GORKHA TV                      master brand · company, corporate, cross-app ID
├── CHIMAL    Movies · Short films · Comedy      Cinema Amber  #E8A62A
├── KHABAR    News · Current affairs             Signal Blue   #3183F2
├── SWARA     Music · Artists · Audio            Raga Pink     #E6479D
└── UKAALI    Reels · Creators · Trends          Tea Mint      #2BD19B
```

**Endorsement line:** `A GORKHA TV COMPANY`, set in Anek Latin 600, uppercase, tracking 0.14em. It sits at about 17% of the wordmark's cap height, under the wordmark, left-aligned in horizontal lockups and centred in vertical ones. Use it on splash screens, store listings, "About" pages, press material and the end of long videos. Leave it off app icons, favicons, watermarks and small UI.

**Never write** "Gorkha TV News", "Gorkha TV Music", and so on. Write "KHABAR" (first mention in formal text: "KHABAR, a Gorkha TV company").

## 4. The shared visual DNA

Five symbols, one construction. This is what makes them a family without being five recolours of one logo:

1. **One grid, one stroke.** Every symbol is drawn on a 100-unit square with a single monoline stroke of **12 units** (12% of the box), with round caps and round joins. Filled shapes (the Chimal bloom, the Ukaali play head, the Khabar dot) are sized to read at that same weight.
2. **The rise.** Every symbol ends moving **up or to the right**: the G's ridge climbs out of its opening, Khabar's dot sits top-right, Swara's wave crests right of centre, Ukaali's road breaks out up-right, Chimal's play points forward. Motion follows the same direction.
3. **One Himalayan detail, hidden in each.** The G's crossbar carries a single asymmetric peak. Swara's wave has an asymmetric ridge as its envelope. Ukaali is a hill road with hairpin bends. Chimal is the rhododendron. Khabar is the one purely typographic mark, because news should read as fact first. Mountains appear once per symbol, as structure, never as a picture.
4. **One container.** App icons, avatars and favicons all share the same Night squircle, a top-left "mountain light" in the product accent, and a low ridge horizon across the base.
5. **One typeface.** All wordmarks are set in Anek Latin ExtraBold with the Devanagari names in Anek Devanagari ExtraBold. It is one design family from Ek Type, an Indian foundry.

## 5. The symbols

| Brand | Symbol | Idea | Why it works |
| --- | --- | --- | --- |
| **GORKHA TV** | **G-Ridge** | A G drawn as a signal ring. Its crossbar is a single asymmetric peak rising through the opening. | Reads as G at 16px. The peak is noticed second, which is the point: the culture is inside the letter. Works as avatar, watermark and production ident. |
| **CHIMAL** | **Bloom** | Five chimal (rhododendron) petals around a play-shaped heart. | Himalayan flower plus streaming. The play cut-out keeps it from reading as a flower shop. |
| **KHABAR** | **K-Signal** | A K with a free arm and a dot at top right: the signal, the full stop, the fact. | Credible and typographic like a newsroom, with no globe, no newspaper and no mic. |
| **SWARA** | **Ridge Wave** | A voice waveform whose envelope is an asymmetric Himalayan ridge. | Music-tech rather than a music academy. A melody and a skyline in one line. |
| **UKAALI** | **Hill Road** | A road climbing two hairpin bends, then breaking out into a play arrow. | *Ukaali* means the uphill climb. The mark is the rising creator and the rising trend, with no TikTok note and no Reels camera. |

## 6. Logo system

Every brand ships in all of these (see Assets and the downloadable pack):

| Version | Use |
| --- | --- |
| Symbol only | App icon, avatar, favicon, watermark, small UI |
| Wordmark | Where the symbol already appears nearby, or in text-led layouts |
| Horizontal lockup | Website headers, lower thirds, letterheads, store banners |
| Vertical lockup | Splash screens, posters, merchandise, square formats |
| Devanagari wordmark | Nepali-first campaigns and print, paired with the Latin lockup |
| On dark (default) | Symbol in accent, wordmark in Snow `#F4F1EA`, endorsement in Mist |
| On light | Symbol in the **deep** accent, wordmark in Ink `#15171C`, endorsement in Stone |
| Mono white / mono black | Single-colour print, embossing, photos, partner co-branding |

**Clear space:** keep a margin of at least the symbol's stroke weight × 2 (24% of the symbol height) on every side.
**Minimum sizes:** symbol 16px digital, 6mm print. Horizontal lockup 96px wide digital, 25mm print. Below 120px wide, drop the endorsement line.
**Symbol-to-wordmark ratio:** the symbol box is 1.5× the wordmark cap height, with a gap of 0.38× the cap height.

## 7. Colour in one paragraph

Night `#101216` is the stage. Snow `#F4F1EA` (a warm off-white, like morning light on paper) is the text. **Gorkha Red `#E63946`** belongs to the master brand and to LIVE states. Each product owns exactly one accent, plus a *deep* shade for light backgrounds and a *tint* for surfaces on dark. The four accents are spaced round the colour wheel (amber, blue, pink, mint) and differ in lightness too, so they remain distinguishable for colour-blind viewers. The full palette with HEX, RGB, CMYK and contrast figures is in **Colour**.

## 8. How to use this system

- **Web and apps:** load the fonts and `tokens.css` (from the download pack), set `data-brand="chimal"` (or another product) on `<html>`, and every component picks up the right accent.
- **Designers:** the lockups, icons, splash screens and social templates are in Assets. The fonts are free on Google Fonts under the Open Font License.
- **AI tools:** read this README, then the section you need. Never guess a colour or font.

## 9. Open decisions (from the brief)

- **KHABAR and KhabarDarjeeling:** decide whether khabardarjeeling.space moves under the KHABAR brand or stays separate.
- **UKAALI and Gorkha Reels:** decide whether UKAALI replaces Gorkha Reels or launches alongside it.
- **Ukaali colour change:** the live site's UKAALI pill is orange. This system moves it to Tea Mint, because orange sat too close to Chimal's amber, especially for colour-blind viewers. Changing it is one CSS variable.
- **Spelling:** "Ukali" is the more common romanisation in search. Secure both domains and handles.
- **Trademark and domains:** check all four names before launch. "Swara" in particular is used by several Indian music products.
