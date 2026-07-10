# Naming Field Sequencer Design QA

## Evidence

- Source visual truth: `.superpowers/design-qa/source-v4-full.png`
- Browser-rendered implementation: `.superpowers/design-qa/implementation-default-viewport.png`
- Focused normalized comparison: `.superpowers/design-qa/comparison-side-by-side.png`
- Route: `http://127.0.0.1:9009/#naming`
- Primary viewport: 1375 x 942, light theme
- Additional states: 1375 x 942 dark theme; 900 x 900, 640 x 900, and 375 x 844 responsive layouts

The full-view source and implementation were captured at 1375 x 942. The focused comparison uses the approved component crop and a complete implementation component crop from a 1375 x 1200 capture, each normalized to 1060 x 525. This removes the surrounding page and allows the typography, card grid, signal track, and spacing to be inspected together.

## Findings

No actionable P0, P1, or P2 differences remain.

- Fonts and typography: passed. Interface text uses Noto Sans; the assembled reference and examples use Source Code Pro. The panel title is 23 px, reference sample is 16 px, field names are 15 px, descriptions are 14 px, and status/example text is 13 px. Field labels use natural title case.
- Spacing and layout rhythm: passed. The panel, preview, signal track, and field cards follow the approved vertical sequence. All seven cards measured 271 px by 110 px at the desktop viewport. Cards 5, 6, and 7 form a centered second row and match the first-row cards.
- Colors and visual tokens: passed. The light surface, restrained blue-to-cyan signal line, field-specific accents, and subtle technical grid match the approved direction. The dark theme preserves hierarchy and readable contrast without becoming a black neon panel.
- Image quality and asset fidelity: passed. This component introduces no image, icon, logo, or generated asset; the existing Naming Standard hero artwork remains unchanged.
- Copy and content: passed. The assembled example is `2007_NASA_PCoE_LCO_18650_1C_1C_25T`; interface labels are `Year`, `Source`, `Chemistry`, `Form factor`, `Charge rate`, `Discharge rate`, and `Temperature`. The implementation replaces the mockup's static `Connected` badge with the specified live `Field n of 7` status.
- Interaction states: passed. Automatic sequencing updated the preview segment, card, signal, and status together. Focusing the Temperature card held all indicators at field 7 for longer than one sequencing interval.
- Responsive behavior: passed. No horizontal overflow was detected at 900, 640, or 375 px. The 900 and 640 px states use two equal columns; the 375 px state uses one column.
- Browser health: passed. The in-app browser console reported zero warnings and zero errors.

## Comparison History

### Iteration 1

- Earlier P2 finding: at 900 px, the sidebar reduced the content area enough that four columns produced 130 px cards, which was too narrow and contradicted the tablet two-column requirement.
- Fix: moved the sequencer's two-column breakpoint from 760 px to 900 px and added a regression assertion.
- Post-fix evidence: at 900 x 900, all seven cards measured 272 px wide, cards were arranged as three two-card rows plus one centered card, and horizontal overflow was false.

## Primary Interactions Tested

- Automatic field progression across multiple intervals
- Synchronized active card, preview segment, signal position, and `Field n of 7` status
- Focus pause/lock on the Temperature card
- Light-to-dark theme toggle
- Desktop, tablet, and phone wrapping
- Browser console warning/error check

## Residual Test Gap

The browser surface did not expose live reduced-motion emulation. Reduced-motion behavior is covered by the automated contract and source inspection: the sweep and transitions are disabled in the media query, and the JavaScript does not start the interval when `prefers-reduced-motion: reduce` matches.

## Follow-up Polish

No P3 visual changes are required for handoff.

final result: passed
