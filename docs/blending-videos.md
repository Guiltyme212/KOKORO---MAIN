# Blending Kokoro videos into the cream background

The mascot MP4s look transparent but **they are not**. They are rectangular videos with the Kokoro cream color (`#f6ebd7`) painted in their background. The "cutout" effect is a compositing trick — if any of the four pieces below is missing, you get a visible cream/grey box around the mascot.

## The four ingredients (all required)

1. **An opaque cream parent** behind the video. The blend needs the page's actual cream to multiply against. `--k3-cream: #f6ebd7;` is the canonical color — anything different (gradient, image, off-cream) and the mascot will show a faint halo.
2. **`mix-blend-mode: multiply`** on the `<video>` element itself. This is what makes the cream pixels in the video disappear into the cream behind it. Without it, the rectangle stays visible.
3. **A `mask-image`** on the wrapper around the video (both `-webkit-mask-image` and `mask-image` — Safari needs the prefix). The mask feathers the edges so the un-blended fringe pixels fade out instead of cutting off as a hard rectangle.
4. **`autoplay loop muted playsinline`** on the `<video>` (iOS will refuse to play without `muted` + `playsinline`).

If you have all four and it still looks wrong, the issue is almost always #1: something opaque-but-not-cream sits between the video and the page background.

## Canonical structure

```tsx
// Wrapper holds position + mask. Video holds blend mode.
<div className="k3-name-mascot">
  <video autoPlay loop muted playsInline className="k3-mascot">
    <source src="/kokoro3/kokoro-proud.mp4" type="video/mp4" />
  </video>
</div>
```

```css
.k3-name-mascot {
  /* wrapper: positioning + feathered mask */
  position: absolute;
  width: 300px;
  height: 300px;
  -webkit-mask-image: radial-gradient(ellipse 62% 62% at 50% 50%, #000 62%, transparent 96%);
          mask-image: radial-gradient(ellipse 62% 62% at 50% 50%, #000 62%, transparent 96%);
}

.k3-name-mascot .k3-mascot {
  /* video: fill the wrapper, multiply against cream */
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  mix-blend-mode: multiply;
}
```

**Do not put `mix-blend-mode` on the wrapper, and do not put `mask-image` on the video.** They have to be on the elements shown above — browser compositing rules will not give you the same result if you swap them.

## Existing helpers to reuse

Before writing new CSS, check whether one of these already does what you need:

| Class                  | Mask shape                              | When to use                                   |
| ---------------------- | --------------------------------------- | --------------------------------------------- |
| `.k3-name-mascot`      | Soft round ellipse, center              | Full mascot, centered, no edge clipping       |
| `.k3-blended-video`    | Soft round ellipse, slightly tighter    | Generic round mascot inside any container     |
| `.k3-peek-wrap--soft`  | Round ellipse 62%                       | Mascot peeking from the middle of the screen  |
| `.k3-peek-wrap--feather` | Tighter round ellipse 55%             | Smaller peek with more fade                   |
| `.k3-peek-wrap--right` | Linear gradients (left fade + top/bottom fade) | Mascot peeking in from the right edge   |
| `.k3-chat-peek`        | Same as `--right` but tighter           | Chat screen's edge-peeking mascot             |

Pair each wrapper with a `<video>` (or `<img>`) inside that has `mix-blend-mode: multiply` — the wrapper CSS already targets `> video, > img`.

## Failure modes — and what to check

| Symptom                                              | Almost always means                                                                                       |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Faint rectangular cream box around the mascot        | The mask is missing or too small. Widen the radial / soften the falloff.                                  |
| Greyish square — cream is darker than the page       | A non-cream parent is between the video and `--k3-cream`. Look for an intermediate `background: white/gradient/image`. |
| Mascot is invisible but you can hear audio cue       | `mix-blend-mode: multiply` is on the wrapper instead of the video, or the wrapper has `opacity: 0.x`.     |
| Box appears only on iOS / Safari                     | `-webkit-mask-image` is missing. The unprefixed `mask-image` alone is not enough on older WebKit.        |
| Mascot doesn't play at all (just a black/blank box)  | Missing `muted` or `playsinline`. iOS blocks autoplay otherwise.                                          |
| Edges are hard, no fade                              | Mask gradient has no `transparent` stop. Add `..., transparent 96%)` at the end.                          |

## When you add a new mascot video

1. Drop the MP4 in `app/public/kokoro3/`. Confirm in QuickLook that the background is true Kokoro cream — not white, not off-cream. (If it isn't, the video is unusable for blending without re-export.)
2. Pick a wrapper from the table above. If none fits, copy `.k3-blended-video` and tweak the mask only.
3. Use the existing `MascotVideo` / `BlendedVideo` / `PeekVideo` components in [`app/src/screens/Kokoro3.tsx`](../app/src/screens/Kokoro3.tsx) — they already wire up the correct `<video>` attributes. Do not hand-roll a new `<video>` tag unless you genuinely need different playback behavior.
4. The immediate parent of the wrapper must paint cream. `.k3-frame` does this at the screen root, so anything inside a `<Frame>` is fine by default. If you put a mascot inside a card with `background: white`, the blend will break.

## Quick checklist before reporting it "still broken"

- [ ] Parent paints `var(--k3-cream)` (or is a child of `.k3-frame`).
- [ ] Video has `mix-blend-mode: multiply`.
- [ ] Wrapper has both `-webkit-mask-image` and `mask-image`.
- [ ] Video has `autoplay loop muted playsinline`.
- [ ] No `background: #fff` / `linear-gradient` / `backdrop-filter` between the video and the page background.

If all five are true and you still see a box, the source MP4's background is wrong — open it in QuickLook and verify it's `#f6ebd7`.
