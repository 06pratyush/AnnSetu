# Logos

`annsetu-mark.svg` is the bridge arc used beside the wordmark. It is a stand-in, not an official logo.

- The farm half is khet `#1e5e3f`, the buyer half is neel `#2f3d8f`, the deck is `#7d8a80` (`border-strong`), and the grain is haldi `#f2b61f`. These are the light-theme values. The SVG carries fixed colors because `<img>` cannot inherit them.
- On dark grounds, draw the mark inline from the tokens (as the app's `BridgeArc` component does) so it uses the dark steps (`#58c08a`, `#9aa8ff`).
- Keep clear space of at least half the mark's height around it. Never recolor, rotate or outline it.
