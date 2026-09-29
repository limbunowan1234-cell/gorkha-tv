# Motion

Motion says the same thing as the symbols: **things rise into place.** Movement travels up and to the right, starts quickly and lands softly, and finishes before you have time to wait for it.

## Tokens

| Token | Value | Use |
| --- | --- | --- |
| `--ease-rise` | `cubic-bezier(.2, .8, .2, 1)` | The default: taps, cards, sheets, pills |
| `--ease-settle` | `cubic-bezier(.3, 0, .1, 1)` | Reveals: letterbox, hero images, splash |
| `--t-micro` | 160ms | Hover, press, toggles |
| `--t-ui` | 280ms | Pills, cards lifting 4px, tab changes |
| `--t-reveal` | 480ms | Sheets, row entrances, hero crossfades |
| `--t-logo` | 900ms | Logo intros only |

## Per brand

| Brand | Language | Logo intro (once, ≤ 900ms) | Loader (loops) |
| --- | --- | --- | --- |
| **GORKHA TV** | Rise | The ring draws clockwise, then the ridge climbs out through the gap | The ring orbits |
| **CHIMAL** | Cinematic reveal | A letterbox opens from the centre while the bloom turns 36° into place | The bloom steps round one petal (72°) like a lens iris |
| **KHABAR** | Signal pulse | Stem, then arm, then leg draw in turn; the dot lands last | The dot beats and sends out a ping ring |
| **SWARA** | Sound flow | The waveform draws left to right | Dashes flow along the wave like a playing track |
| **UKAALI** | Climb | The road draws up the hairpins and the play head pops out | A light runs up the road and the play head re-pops |

All of these are in `tokens.css` as pure CSS and inline SVG, with no Lottie and no library. A preview file, `motion.html`, is in the download pack. Loaders run while content fetches; after 8 seconds, swap the loader for a text message ("Still loading. Slow connection?").

## Rules

- **Maximum 900ms for any branded motion,** and 300ms for anything that responds to a tap.
- **Only one branded animation per screen.** Everything else uses the plain `--ease-rise` fades and lifts.
- **Video idents:** at the start of a video, show the product symbol intro plus the wordmark fade-in, 2.5 seconds total, then hold for 0.5s. At the end card, show the vertical lockup with the endorsement for 3 seconds. No music stings longer than 2 seconds.
- **Respect reduced motion.** `prefers-reduced-motion` shows the final frame straight away. This is already built into `tokens.css`.
- **No bouncing, no spinning 360s, no confetti.** "Rising" should never become "wobbling".
