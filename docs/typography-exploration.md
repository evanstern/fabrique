# Typography exploration

Focus card #28 asked for visible typography passes for Fabrique's app shell,
login, initial brief, and session workspace UI. The product direction is a calm,
Claude/GPT-like page-building workspace: legible, low-friction, and slightly more
crafted than a default SaaS dashboard.

## Direction 1: neutral/productive

- **Heading stack:** Geist Sans or Inter, `ui-sans-serif`, `system-ui`, `sans-serif`
- **Body stack:** Geist Sans or Inter, `ui-sans-serif`, `system-ui`, `sans-serif`
- **Mono stack:** Geist Mono or IBM Plex Mono, `SFMono-Regular`, `Consolas`, monospace
- **Intended feel:** crisp, highly familiar, fast to parse, and close to current AI
  workspace conventions.
- **What worked:** excellent density and interface readability; labels, buttons,
  and textarea copy all felt immediately usable.
- **What did not work:** too anonymous for Fabrique. Inter/Geist-style neutrality
  made the product feel more like a template than a named workshop.
- **Fit:** strong functional fit, weak voice fit.

## Direction 2: editorial/warm

- **Heading stack:** Fraunces, `ui-serif`, Georgia, serif
- **Body stack:** IBM Plex Sans or Source Sans 3, `ui-sans-serif`, `system-ui`, sans-serif
- **Mono stack:** IBM Plex Mono, `SFMono-Regular`, `Consolas`, monospace
- **Intended feel:** warmer and more magazine-like, with Fabrique leaning into the
  maker-shop meaning of the name.
- **What worked:** the brand wordmark gained personality, and the warm serif paired
  naturally with the existing parchment-like palette.
- **What did not work:** the serif heading voice pulled the product away from the
  Claude/GPT-like workspace direction. It made the session UI feel more editorial
  than operational, especially around IDs, stages, and review controls.
- **Fit:** memorable, but too expressive for the primary workspace.

## Direction 3: technical/calm

- **Heading stack:** IBM Plex Sans, `ui-sans-serif`, `system-ui`, `sans-serif`
- **Body stack:** IBM Plex Sans, `ui-sans-serif`, `system-ui`, `sans-serif`
- **Mono stack:** IBM Plex Mono, `SFMono-Regular`, `Consolas`, monospace
- **Intended feel:** calm, legible, technical without feeling cold; a workshop that
  can hold prompts, statuses, review notes, and artifact URLs comfortably.
- **What worked:** IBM Plex Sans has more character than Inter/Geist while staying
  readable in form-heavy UI. IBM Plex Mono makes session IDs and artifact paths feel
  deliberate instead of incidental. The pair supports the existing Tailwind token
  system without route-level churn.
- **What did not work:** it is quieter than the editorial direction; Fabrique's voice
  comes through in restraint rather than in a display face.
- **Fit:** best balance for the current product direction.

## Specimen review feedback

Evan reviewed the live specimen page and preferred a blended direction rather
than one single stack everywhere:

- **Fabrique wordmark / brand:** keep Plex for the `fabrique` text itself. The
  current boldness, size, and serif character still feel right for the product
  name.
- **Small muted labels and light-gray UI metadata:** use Geist where practical.
  It gives the interface labels a cleaner AI-workspace feel without taking over
  the brand voice.
- **General prose and explanatory text:** keep the editorial/source-style body
  direction. Source Sans 3 carries prompts, notes, and review copy warmly while
  staying legible in product UI.
- **High-level uppercase labels:** use Space Grotesk for items like `PASSWORD`,
  `BRIEF PROMPT`, `REVIEW`, and `PUBLISHED`. It has the distinctive technical
  flavor Evan liked, but it should not replace true monospace usage.
- **True mono strings:** keep a real mono stack for session IDs, URLs, artifact
  paths, and code-ish values. Space Grotesk is not a monospace font.

## Final blended direction

The live app uses the **blended** direction:

- **Brand:** IBM Plex Serif via the `--font-brand` role.
- **Body / prose:** Source Sans 3 via the `--font-body` role.
- **Muted metadata:** Geist via the `--font-label` role.
- **Display labels:** Space Grotesk via the `--font-display-label` role.
- **Mono:** IBM Plex Mono via the `--font-mono` role.

This keeps the parts Evan liked from each specimen without making the whole app
feel like a patchwork. The wordmark remains grounded in Plex, the working copy
stays readable and warm, metadata recedes cleanly, uppercase labels get a more
intentional technical voice, and IDs/URLs remain properly monospaced.

Temporary review controls — the font selectors and `/font-specimens` specimen
route — were removed before merge. The branch keeps the selected blended system
as the normal app typography rather than as a switchable exploration mode.

## Prior recommendation

Land the **technical/calm** system:

- **Headings:** IBM Plex Sans, medium weight, tight tracking for product names and
  section titles.
- **Body:** IBM Plex Sans, regular weight, relaxed line-height for prompts and
  explanatory copy.
- **Mono:** IBM Plex Mono for session IDs, artifact URLs, inline paths, and generated
  workflow identifiers.
- **Serif token:** IBM Plex Serif remains available as the Tailwind `font-serif`
  token for future restrained editorial accents, but it is not used as a competing
  live theme in this pass.

This keeps Fabrique calm and workspace-oriented while giving it a more specific
typographic voice than a default system stack.
