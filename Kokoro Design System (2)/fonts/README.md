# Fonts — substitutions in use

Production Kokoro almost certainly uses commercial typefaces. The codebase wasn't accessible, so this design system uses Google Fonts substitutes loaded via `@import` in `colors_and_type.css`.

| Role | Likely production face | Substitute (in use) | Match quality |
| --- | --- | --- | --- |
| Display / headline / prose italic | **GT Sectra** or **Domaine Display** | **Cormorant Garamond** | Decent — same high-contrast didone family with sharp italic |
| System / labels / buttons | **Berkeley Mono** or custom mono | **JetBrains Mono** | Good — similar warmth & x-height |
| CJK glyphs | System CJK serif | **Noto Serif JP** | Native equivalent |

## Action requested

Please drop the real `.woff2`/`.ttf` files into this folder and replace the `@import` line at the top of `colors_and_type.css` with `@font-face` declarations pointing to them. I'll update the system on next pass once they're here.
