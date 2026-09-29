# Typography

One family for the brand voice and one for reading. Both are free for commercial use under the SIL Open Font License, served from Google Fonts, and designed in India with first-class Devanagari.

| Role | Latin | Devanagari | Weights | Use |
| --- | --- | --- | --- | --- |
| **Display** | Anek Latin | Anek Devanagari | 800 | Wordmarks, hero titles, poster titles, splash |
| **Heading** | Anek Latin | Anek Devanagari | 700–800 | H1–H3, row titles ("Trending on SWARA"), card titles |
| **Body** | Mukta | Mukta (Devanagari) | 400 / 500 | Descriptions, articles, captions, comments |
| **UI** | Mukta | Mukta | 500 / 700 | Buttons, tabs, form fields, metadata |
| **Label** | Anek Latin | Anek Devanagari | 700–800, uppercase, +0.08em | Pills, badges, overlines, endorsement (600, +0.14em) |

**Why Anek:** it is squarish, with open curves and a slightly condensed stance, so it reads as modern and Himalayan without any ornament. It is one design system across Latin and Devanagari, so खबर and KHABAR sit together at the same weight and height. It also has a variable width axis, which condensed headlines on mobile can use later.

**Why Mukta:** it is built for screens, it has a large x-height, and it is highly legible on low-end Android at 14–16px. Its Devanagari was designed alongside the Latin, not added afterwards.

## Scale (web and app)

| Style | Font | Size | Line height | Tracking |
| --- | --- | --- | --- | --- |
| display | Anek 800 | 40–72px (fluid) | 1.05 | -0.005em |
| h1 | Anek 800 | 32–48px | 1.05 | 0 |
| h2 | Anek 700 | 24px | 1.15 | 0 |
| h3 | Anek 700 | 18px | 1.2 | 0 |
| body | Mukta 400 | 16px | 1.55 | 0 |
| small | Mukta 500 | 14px | 1.5 | 0 |
| label | Anek 700 | 12px | 1 | +0.08em, uppercase |

**Nepali text:** use `lang="ne"` on Nepali content. Devanagari needs a line height of **1.7** for body text, because the matras (vowel marks above the line) collide at 1.5. Never set Devanagari in all-caps styles or with letter-spacing, since it breaks the headline (shirorekha) bar.

**Wordmarks are outlined artwork.** Never retype a logo in the font. Use the SVG files.

## Loading

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Anek+Latin:wght@600;700;800&family=Anek+Devanagari:wght@600;700;800&family=Mukta:wght@400;500;700&display=swap" rel="stylesheet">
```

Fallback stack: `system-ui, sans-serif`. Android's Noto Sans Devanagari takes over cleanly if the web font has not loaded yet.
