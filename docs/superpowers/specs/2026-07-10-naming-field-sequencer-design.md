# Naming Standard Field Sequencer Design

## Goal

Replace the selected `Format Pattern` panel on the Naming Standard page with a more distinctive digital-laboratory presentation that still belongs to BatteryLake's existing light interface.

The change is limited to this panel. The page hero, Examples table, Field Vocabulary cards, navigation, and underlying naming semantics stay unchanged.

## Visual Direction

- Keep the existing light page background and white surface treatment.
- Use a restrained blue-to-cyan top signal line, a faint technical grid, and shallow blue shadows to create a laboratory-instrument feel.
- Use the site's existing `Noto Sans` for headings, labels, and descriptions.
- Reserve `Source Code Pro` for the assembled reference-name example and field values.
- Use natural title case for interface labels: `Year`, `Source`, `Chemistry`, `Form factor`, `Charge rate`, `Discharge rate`, and `Temperature`.
- Display the real reference-name example `2007_NASA_PCoE_LCO_18650_1C_1C_25T`; uppercase text remains only where it is part of real dataset syntax or an abbreviation.
- Increase the current panel typography: 23 px panel title, 16 px assembled example, 15 px field names, 14 px descriptions, and 13 px status and example text.

## Layout

- Header: format status and panel title on the left; the active field count on the right.
- Reference preview: one full-width assembled dataset name.
- Signal track: a horizontal line and one moving signal point communicating the current field position.
- Field cards: seven equal-size cards.
  - Desktop: four cards on the first row and three equal-size cards centered on the second row.
  - Tablet: two columns, with the final card centered by the wrapping layout.
  - Mobile: one column with no horizontal scrolling.

## Interaction And Motion

- On entry, the panel automatically steps through the seven fields in sequence.
- The active segment of the assembled example, its signal position, its field card, and the `Field n of 7` status update together.
- Hovering or focusing a card pauses the automatic sequence and locks all four indicators to that field.
- Leaving the card resumes the sequence.
- Motion uses transform, opacity, color, and the signal's horizontal position; it must not change surrounding layout dimensions.
- A subtle light sweep crosses the assembled reference preview to reinforce the idea of parsing.
- Under `prefers-reduced-motion: reduce`, automatic stepping and the sweep are disabled; direct hover and keyboard focus states remain available without animated transitions.

## Accessibility And Theme Requirements

- Normal text must retain at least WCAG AA contrast against its surface.
- Field cards must not rely on color alone: field number, name, description, and example remain visible.
- Cards participating in hover behavior must also respond to keyboard focus.
- Dark mode uses the existing theme tokens and keeps the same hierarchy without inverting into neon black.
- No new image, icon, font dependency, route, or backend behavior is introduced.

## Verification

- Confirm the panel at desktop width near the annotated 1375 x 942 viewport.
- Confirm 900 px, 640 px, and 375 px layouts without horizontal overflow.
- Confirm automatic sequencing, hover pause/resume, and keyboard focus synchronization.
- Confirm light mode, dark mode, and reduced-motion behavior.
- Confirm the rest of the Naming Standard page is unchanged.
