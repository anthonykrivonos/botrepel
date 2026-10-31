# Design

BotRepel is dark-first and minimal: sharp black-and-white contrast, precision over decoration.
Tokens live in `apps/web/src/styles.css` (`@theme`). Primitives live in `apps/web/src/components/`.
`/design` renders all of them for review.

## Rules

- **Write like a capable, kind narrator** with occasional dry humor and small Undertale nods on low-stakes surfaces.
  Let connected sentences flow naturally, including longer ones, and use semicolons and colon-led explanations sparingly.
  Do not use em dashes in prose, and follow [AGENTS.md's copy rules](AGENTS.md#copy) for tone, protected wording, and meaning preservation.
- **Color means state, never decoration.** `ok` = verified or passed, `warn` = pending or low
  credit, `danger` = failed or irreversible, `info` = links, focus, informational. Everything else
  is black, white, and grays. Exceptions: `brand` red belongs to the heart in the mark,
  wordmark, and favicon, nowhere else; `yc` orange (#ff6600) belongs only to the hero's
  "Built by YC Alums" chip and its official Y Combinator mark; and the flash check's hues (yellow through magenta) may
  appear where they depict the light challenge itself, as in the hero's LightStage and FIG. 3,
  and in the hero's ambient `glow-light` wash, which follows the color LightStage is sending.
  The navigation's "Get Started" button uses a pale blue-to-violet gradient with dark text.
  In the risk chart, green, amber, and rose encode increasing risk and accompany labeled step-up zones.
  Fictional mini websites in the use-case slides use their own palettes and type treatments to
  demonstrate different customer contexts; those styles stay inside the browser previews.
- **Sentence case for headings, labels, and navigation; title case for buttons and button-styled
  links** ("Get Started", "Run Check"), as AGENTS.md sets for controls. Provider sign-in buttons
  keep the provider's own wording ("Continue with Google", "Continue with GitHub"), as their brand
  guidelines require.
- **The serif is for display only.** Use `font-display` (Instrument Serif) for hero lines and
  section titles, at weight 400. Never bold it, and never use it in dense product UI.
- **Pixel type is a small accent.** `font-game` is Monster Friend Fore Regular;
  `font-playful` is MERCY Regular, used for "determination" in the integration heading.
  Scale accents to fit the surrounding serif and keep each word intact on small screens.
- **Monospace is for code, copyable agent prompts, keys, and numbers in tables,** plus the small uppercase labels that
  frame content: section eyebrows, `FIG. n` captions, and sources. Never for titles or body prose.
- **One primary button per view.** Primary is white with black text; everything else is
  secondary or ghost, except for the navigation's gradient "Get Started" link.
- **Glows are atmosphere only.** Use a `glow-*` low-opacity radial wash at the top of a section,
  never as a solid surface.
- **Motion:** 150–200 ms ease-out for controls; 500 ms ease-out with an 8px rise for scroll
  reveals (`useReveal`, which never hides content that was on screen at load). Inside a reveal,
  `data-stagger` children follow 70 ms apart and `data-draw` SVG lines (with `pathLength="1"`)
  trace in. Above the fold, `data-entrance` children rise in on load (900 ms, with a brief blur).
  Opacity, small translations, and blur only. `prefers-reduced-motion` turns it off globally, and
  canvases draw one still frame.

## Tokens

| Group | Tokens |
|---|---|
| Surfaces | `canvas` #000, `well` #060608 (code), `surface` #0a0a0c (cards, inputs), `surface-raised` #111113 |
| Text | `fg` #fcfcfd (headings), `fg-body` 86% (prose), `fg-muted` 64% (secondary), `fg-subtle` #8a8f93 (captions), `fg-disabled` |
| Materials | `glass` utility: surface at 50% with a faint white top sheen, 20px blur, and 1.6× saturation; nearly opaque without `backdrop-filter`. `RippleDots` (a canvas of faint white dots that brighten near the pointer and ripple in its wake; static under reduced motion) sits fixed behind the landing page so panes have something to frost. `dot-grid` and `dot-field` are its static CSS counterparts |
| Lines | `line` white 8%, `line-strong` white 14%, `border-gradient` utility (10% → 5% hairline) |
| State | `ok`, `warn`, `danger`, `info`, each with a `-wash` background |
| Brand | `brand` #ff0000, the heart only |
| Radii | `rounded-control` 6px, `rounded-card` 10px, `rounded-dialog` 14px |

## Type

| Use | Font | Size / line height |
|---|---|---|
| Display | Instrument Serif 400 | `text-display` 80/80, `text-display-sm` 56/59, section titles 40 |
| Heading | Inter 500 | `text-xl` 24/32 |
| Body | Inter 400 | `text-lg` 18/28, `text-base` 16/24, `text-sm` 14/20 |
| Code | Geist Mono | 13–14 |
| Game accent | Monster Friend Fore 400 | About 55–58% of the surrounding display size |
| Playful accent | MERCY Regular 400 | About 90% of the surrounding display size |

All fonts are self-hosted in `apps/web/public/fonts/`. Inter, Instrument Serif, and Geist Mono are
OFL; pixel font sources and copyrights are recorded in their accompanying notices. MERCY's
published license is non-commercial; commercial publication requires separate permission.
Their `@font-face` rules are inline
in `src/index.html`, because Bun's CSS bundler would base64-inline them. That inline block is
allowed by a CSP hash in `vercel.json`, and `build.ts` fails if they drift apart.

## Primitives

`Button` (`primary` | `secondary` | `ghost` | `danger`; `sm` | `md`; `buttonClassName` for links),
`Input`, `Field`, `Card`, `Glass` (frosted panel with a lit top edge; `glassClassName` for figures and links, the `glass` utility alone for bars like `Nav`), `Badge` (tones), `CopyButton`, `CopyField` (`secret` | `prose` | `code`),
`CodeBlock`, `Dialog` (native `<dialog>`), `Tabs` (ARIA tabs, arrow keys), `Nav`, `Logo`.
`CopyField` is one button across its full surface: clicking or tapping anywhere copies the full
value, with the same action available through Enter or Space and a checkmark confirming success.
Its `code` variant uses Geist Mono, preserves whitespace, and wraps long lines; use it for commands and agent prompts.
Copy fields and code blocks use `surface-raised` for a slight gray background.

The mark is a pixel B with the `brand` heart in its counter (`LogoMark`, for compact places like
the widget badge). The wordmark (`Logo`) sets BOTREPEL in the same pixel letters with the heart
filling the O; it is an SVG with an accessible name, drawn in the current text color and sized by
font size, so `text-lg` scales it. The favicon is the heart alone. `public/og.png` carries the
wordmark: regenerate it with `bun run og:image`.

The hero figure (`LightStage`, geometry in `utils/face.ts`) is a friendly, softly lit face: wrap
lighting rather than hard shadows, features carried by albedo, highlights mixed toward white, and
a blink every few seconds. Keep it gentle; dark sockets and steep shadows read as uncanny.

The light check's head roll (`PoseRing`) rings the camera oval with 60 bars: long and white until
the head covers their angle, then short and `ok` green. The start bar is brightest, bars outside
a partial arc stay faint, and the prompt line above the oval is the only text. Once the roll is
captured, the whole ring closes green from the start bar in the roll's direction (400 ms), then a
crest circles it once a second while the server judges; the ring stays for at least that sweep and
one revolution, the prompt line says "Got it", and reduced motion holds the ring green and still.

Landing page patterns (`apps/web/src/site/`): every card is a glass pane over the page's faint `RippleDots`, including the inset footer container. `Section` (hairline above, mono eyebrow, serif title, lede, aside),
numbered `LayerRow`s whose figures carry a mono `FIG. n` caption, SVG data figures (never
inline styles: the CSP forbids them, so sizes go in attributes), and glass evidence cards with
serif figures and linked source logos at the bottom. Source marks stay monochrome; benchmark
and pricing labels distinguish vendor evidence from independent research. Every figure on the page cites the whitepaper. Sections are
divided by a fading hairline. The hero cycles through three synthetic MakeHuman heads (an East
Asian woman, a Black man, and a white woman; CC0 mesh, targets, and hair, defined in `AVATARS` in
`scripts/face-points.ts`; the white woman's bun is modeled there), starting on a random one, each
holding about nine seconds, then dissolving dot by dot into the next. The head turns and tilts
toward a mouse or pen anywhere on the page, within its drift's angles. They're sampled into `public/faces/` by `bun run face:points`, framed so every face's eyes sit
at the same height and spacing, and are never scans or photos of real people. `dot-field` repeats its
point-cloud texture as a faint static background.

Prefer composing these over new one-off styles. Add a primitive only when a pattern repeats with
one meaning.

The use-cases slideshow spans the page inside one glass pane, with one full-width slide visible
at a time. Native horizontal scroll snapping supports touch and trackpads; Previous/Next controls
and a position counter sit above the pane. Arrow keys, Home, and End work when the slideshow is
focused. Inactive slides are inert, and there is no automatic advancement. Its ranked descriptions
and linked public reports do not imply customer relationships. `Section` supports full-width
content while keeping its heading aligned with the rest of the page.
Each slide includes a fictional website animation with a black, white-outlined Mac-style cursor.
Preview palettes, layout, and controls follow the referenced company's public website; spoof
names and illustrative content remain distinct. Local fonts approximate proprietary typefaces.
The cursor moves to verification, clicks, and reveals the action's outcome in a single 4.8-second
sequence. Motion runs only for the visible, selected slide; reduced-motion
mode shows the completed still. Preview forms are decorative and never submit or request camera access.
