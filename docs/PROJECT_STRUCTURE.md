# Project Structure

BatteryLake is currently a static single-page app. `index.html` is the entry point, with CSS, JavaScript, and assets split into separate folders so future edits are easier to target.

## Main Files And Folders

### `index.html`
Contains the page markup, sidebar navigation, page sections, modals, and the AI assistant HTML shell. Keep it as the main entry file. Edit this when changing visible page structure or adding/removing sections.

### `styles/base.css`
Contains the original global styles and many page-level styles: layout, sidebar, topbar, dataset cards, modals, quality/preprocessing/API/contribute pages, toast states, and AI assistant styling. The name is acceptable for now, but this file is broader than pure "base" styles.

### `styles/benchmark.css`
Contains Benchmark workspace styles, mostly scoped to `#page-benchmarks` and `.bw-*` classes. Keep this separate because the Benchmark page is a dense workflow with its own wizard, dataset picker, model picker, split controls, package UI, and results views.

### `styles/polish.css`
Contains the current override/refinement layer: design tokens, dark mode token overrides, visual polish, card/button/table refinements, page-specific visual updates, and final layout fixes. This file intentionally loads after the other CSS files so it can refine existing styles.

`polish.css` may eventually be renamed or split into smaller files such as `theme.css`, `components.css`, and `pages.css`, but avoid doing that until the UI has stabilized.

### `js/theme-init.js`
Runs before the CSS finishes painting. It sets the initial light/dark theme on `document.documentElement` to prevent theme flicker.

### `js/main.js`
Contains the main application logic: dataset loading/parsing, filters, search, page navigation, theme toggling, modals, preprocessing tools, Benchmark workflow/package generation/results, and model library behavior.

`main.js` is intentionally still the central logic file for now. It can be split later by domain after the UI and workflows are stable.

### `js/assistant.js`
Contains the floating AI assistant widget behavior: open/close state, message rendering, local history, suggestions, and placeholder backend calls.

### `assets/images/`
Contains page and hero images, such as home, datasets, benchmarks, models, and quality visuals.

### `assets/logos/`
Contains BatteryLake product logos and wordmarks, including the favicon and light/dark sidebar logos.

### `assets/logos/partners/`
Contains partner and institution logos shown on the home page.

### `assets/logos/models/`
Contains model library logos and their `dark/` variants. Some paths are referenced dynamically from `js/main.js`, so rename these carefully.

### `assets/archive/unused/`
Contains assets that appear unused by the active app but are kept instead of deleted. This is a safety archive.

## Where To Edit

### Benchmark page UI
Edit:
- `index.html`
- `styles/benchmark.css`
- `styles/polish.css`
- `js/main.js`

### AI assistant UI
Edit:
- `index.html`
- `styles/base.css`
- `styles/polish.css`
- `js/assistant.js`

### Global cards, buttons, and tags
Start with:
- `styles/polish.css`

Then check:
- `styles/base.css`
- `styles/benchmark.css` for Benchmark-only controls

### Dark mode
Edit:
- `styles/polish.css` for theme tokens and dark-mode visual rules
- `styles/base.css` for older dark-mode selectors
- `js/theme-init.js` for initial theme setup
- `js/main.js` for theme toggle behavior and logo switching

### Images and logos
Check:
- `assets/images/`
- `assets/logos/`
- `assets/logos/partners/`
- `assets/logos/models/`

Also search `index.html` and `js/main.js` for the asset path before renaming files.

### Dataset and model behavior
Edit:
- `js/main.js`

Dataset and model markup may also be generated dynamically from JavaScript, so do not assume all UI is written directly in `index.html`.

## Do Not Casually Edit

### Reference HTML files
The temporary reference files live in `archive/reference-html/`. They are not part of the active product and should not be used as app dependencies.

### Archived unused assets
Files in `assets/archive/unused/` are intentionally preserved. Do not delete them unless usage has been rechecked.

### Vendor files
`assets/vendor/papaparse.min.js` is a third-party dependency. Replace it only when intentionally upgrading PapaParse.

### Dynamic model logo paths
Model logo paths in `assets/logos/models/` are referenced from `js/main.js`. Renaming these files requires updating the dynamic path map and checking both light and dark variants.
