# Project Structure

BatteryLake is currently a static single-page app. `index.html` is the entry point, with CSS, JavaScript, documentation, and static assets split into separate folders so future edits are easier to target.

## Current Tree

```text
.
|-- index.html
|-- README.md
|-- README_LOCAL_EDITING.md
|-- sync.sh
|-- archive/
|   `-- reference-html/
|-- assets/
|   |-- archive/
|   |   `-- unused/
|   |-- images/
|   |-- logos/
|   |   |-- models/
|   |   |   `-- dark/
|   |   `-- partners/
|   `-- vendor/
|-- docs/
|-- js/
`-- styles/
```

## Main Files And Folders

### `index.html`
Contains the page markup, sidebar navigation, page sections, modals, and the AI assistant HTML shell. Keep it as the main entry file. Edit this when changing visible page structure or adding/removing sections.

### `README.md`
Public-facing project overview for GitHub. It references the hosted platform, explains the BatteryLake concept, and embeds preview images from `docs/`.

### `README_LOCAL_EDITING.md`
Local editing notes for this static HTML version. It documents preview commands, local asset behavior, and a few practical editing notes.

### `sync.sh`
Convenience script for staging local changes, committing them, rebasing from `origin/main`, and pushing back to GitHub. It is a workflow helper, not part of the website runtime.

### `styles/`
Contains the app stylesheets, loaded by `index.html`.

- `styles/base.css`: original global styles and many page-level styles, including layout, sidebar, topbar, dataset cards, modals, quality/preprocessing/API/contribute pages, toast states, and AI assistant styling. The name is acceptable for now, but this file is broader than pure "base" styles.
- `styles/benchmark.css`: Benchmark workspace styles, mostly scoped to `#page-benchmarks` and `.bw-*` classes. Keep this separate because the Benchmark page is a dense workflow with its own wizard, dataset picker, model picker, split controls, package UI, and results views.
- `styles/polish.css`: current override/refinement layer, including design tokens, dark mode token overrides, visual polish, card/button/table refinements, page-specific visual updates, and final layout fixes. This file intentionally loads after the other CSS files so it can refine existing styles.

`polish.css` may eventually be renamed or split into smaller files such as `theme.css`, `components.css`, and `pages.css`, but avoid doing that until the UI has stabilized.

### `js/`
Contains the app scripts, loaded by `index.html`.

- `js/theme-init.js`: runs early and sets the initial light/dark theme on `document.documentElement` to prevent theme flicker.
- `js/main.js`: main application logic, including dataset loading/parsing, filters, search, page navigation, theme toggling, modals, preprocessing tools, Benchmark workflow/package generation/results, and model library behavior.
- `js/assistant.js`: floating AI assistant widget behavior, including open/close state, message rendering, local history, suggestions, and placeholder backend calls.

`main.js` is intentionally still the central logic file for now. It can be split later by domain after the UI and workflows are stable.

### `assets/images/`
Contains page and hero images used by the active site, including home, datasets, benchmarks, documentation, ETL pipeline, models, naming, and quality assessment visuals. Some files have transparent variants for UI composition.

### `assets/logos/`
Contains BatteryLake product logos and wordmarks, including `batterylake_logo.png`, `home-wordmark.png`, `logo-light.png`, and `logo-dark.png`.

### `assets/logos/partners/`
Contains partner and institution logos shown on the home page.

### `assets/logos/models/`
Contains model library logos named `1.png` through `8.png`, plus matching `dark/` variants. Some paths are referenced dynamically from `js/main.js`, so rename these carefully.

### `assets/vendor/`
Contains third-party browser dependencies served locally. Currently this is `papaparse.min.js`.

### `assets/archive/unused/`
Contains assets that appear unused by the active app but are kept instead of deleted. This is a safety archive.

### `docs/`
Contains project documentation and README preview images:

- `docs/PROJECT_STRUCTURE.md`
- `docs/preview-home.png`
- `docs/preview-datasets.png`
- `docs/preview-quality.png`
- `docs/preview-apis.png`

### `archive/reference-html/`
Contains temporary reference HTML files from external examples. They are not part of the active product and should not be used as app dependencies.

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

### Global cards, buttons, tables, and tags
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
- `assets/logos/logo-light.png`, `assets/logos/logo-dark.png`, and `assets/logos/models/dark/` when image variants need to change

### Images and logos
Check:
- `assets/images/`
- `assets/logos/`
- `assets/logos/partners/`
- `assets/logos/models/`

Also search `index.html`, `js/main.js`, and `README.md` for the asset path before renaming files.

### Dataset and model behavior
Edit:
- `js/main.js`

Dataset and model markup may also be generated dynamically from JavaScript, so do not assume all UI is written directly in `index.html`.

### README screenshots and documentation
Edit:
- `README.md` for the public GitHub project overview
- `README_LOCAL_EDITING.md` for local editing instructions
- `docs/PROJECT_STRUCTURE.md` for this structure guide
- `docs/preview-*.png` when README screenshots need to be refreshed

## Do Not Casually Edit

### Reference HTML files
The temporary reference files live in `archive/reference-html/`. They are not part of the active product and should not be used as app dependencies.

### Archived unused assets
Files in `assets/archive/unused/` are intentionally preserved. Do not delete them unless usage has been rechecked.

### Vendor files
`assets/vendor/papaparse.min.js` is a third-party dependency. Replace it only when intentionally upgrading PapaParse.

### Dynamic model logo paths
Model logo paths in `assets/logos/models/` are referenced from `js/main.js`. Renaming these files requires updating the dynamic path map and checking both light and dark variants.

### Sync workflow
`sync.sh` stages, commits, pulls with rebase, and pushes. Read it before editing or running it, especially if there are uncommitted local changes.
