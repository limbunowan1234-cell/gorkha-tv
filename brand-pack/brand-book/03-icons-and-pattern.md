# App icons, favicons and iconography

## App icon system

All four product icons, and the master icon, are the **same object with a different symbol inside**:

| Property | Spec (on a 1024px canvas) |
| --- | --- |
| Outer shape | Superellipse (n = 5), full bleed. The store version is a plain square, because iOS and Play apply their own mask. |
| Ground | Vertical gradient from `#232833` at the top to Night `#101216` at the bottom |
| Mountain light | A radial glow in the product accent at 30% opacity, centred top-left (28%, 8%) and fading out by 55% of the radius |
| Horizon | A low ridge silhouette across the bottom 26%, in white at 6% fading to 0. Identical on all five icons. |
| Symbol | Product accent. The symbol box is 60% of the icon, centred and nudged up by 2%. |
| Text | None. No wordmark, no endorsement, no "TV". |

This gives consistent visual weight and lighting, and each icon is identifiable at 48px by its shape and colour together. The five icons were checked at 48px against a light home screen.

**Files:** `*-appicon-store-1024.png` (App Store / Play), `*-appicon-rounded-*.png` (PWA and previews), and `android-adaptive/*-foreground.svg` (the symbol in the 66% safe zone). For Android adaptive icons, set the background layer to Night `#101216`.

## Favicons

A 64-unit rounded square (radius 14) in Night, with the symbol at 56 units in the accent. PNG files are exported at 16, 32, 48, 180 (Apple touch), 192 and 512 (PWA manifest). At 16px the Chimal bloom and the Ukaali road simplify to their silhouettes, and that is expected.

```html
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/favicon-180.png">
```

## UI iconography

Use one open-source set everywhere, **Lucide** (ISC licence), because its round caps and joins match the symbols. Draw icons at a 2px stroke on a 24px grid. Icons take their colour from the surrounding text (Snow or Mist). They turn accent only when active, such as the current bottom-nav tab.

Custom glyphs follow the same rules: 24px grid, 2px stroke, round caps. **LIVE** is always a solid dot, not an icon.

## Brand pattern: Tea terraces

Contour lines, like the terraced rows of a Darjeeling tea garden or a map's height lines, drawn in the product accent at 10–18% opacity on Night. Use them behind YouTube banners, music covers, empty states and splash backgrounds. Never put them behind body text or over video. One pattern per layout, and never mix it with photography.
