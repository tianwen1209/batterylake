# Preprocessing page snapshot — 2026-09-08

Snapshot of the **Preprocessing** page (`#preprocessing`) as it existed before the
2026-09-08 redesign that replaced the browser-generated `bt_skill_*` package with the
BatteryLake processing skill from `Processed_Dataset_Standard/skills/batterylake-processing`.

| File | Contents |
|---|---|
| `preprocessing-page.html` | The `#page-preprocessing` markup (4-stage wizard: Upload Dataset → Review & Edit Metadata → Download Preprocessing Skill → Upload Report & Verification, plus the hidden legacy pipeline section). |
| `preprocessing-legacy.js` | The JavaScript that drove it: AI inspection / metadata extraction calls to `app.py`, the AI field table, the `pp*` wizard helpers, and the Python templates bundled into the generated skill zip (inspect / convert / validate / adapters). |

The complete site at that moment is tagged **`preprocessing-20260908`** in Git:

```bash
git show preprocessing-20260908:index.html > /tmp/index.html      # whole page
git checkout preprocessing-20260908 -- index.html js/main.js styles/base.css styles/polish.css   # restore everything
```

The CSS for this version lives in `styles/base.css` / `styles/polish.css` at that tag
(`.prep-*`, `.pp-*`, `.ai-*`, `.metadata-*` rules).
