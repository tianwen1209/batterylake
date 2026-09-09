# BatteryTwin Frontend Package

This package contains the files needed to run the BatteryTwin dashboard on another computer.

## What Works Without an API Key

You can open and browse the dashboard without any API key.

Option A:

```powershell
start index.html
```

Option B, recommended:

```powershell
python app.py
```

Then open:

```text
http://127.0.0.1:8000/
```

Without an API key, these parts still work:

- Dashboard pages
- Built-in dataset list
- Uploading `dataset_registry.csv`
- Most static project information

AI-related features will show a setup message instead of real AI results.

## What Needs the Backend

Run the backend if you want these features:

- AI chat
- Metadata extraction from source or paper URLs
- Local file/folder inspection

Install Python dependencies first:

```powershell
pip install -r requirements.txt
```

Then start:

```powershell
python app.py
```

## AI Assistant (bottom-right chat)

The chat widget works out of the box, with no key and no backend: it answers
from a built-in knowledge base (`js/assistant-knowledge.js`) that reads the live
dataset catalog on the page. It covers catalog numbers, individual datasets,
chemistry / form-factor / category look-ups, the processing skill, `status.json`
fields, benchmarks, quality, citation and team, in English and Chinese.

To add a free language model on top of that, edit `js/ai-config.js`:

| Provider | What to set | Notes |
|---|---|---|
| `gemini` | `apiKey` (and optionally `model`, default `gemini-flash-lite-latest`) | Free tier at https://aistudio.google.com/apikey. The key is served to visitors, so restrict it in Google Cloud Console → Credentials → *Website restrictions* to `https://tianwen1209.github.io/*`. |
| `openai` | `endpoint` (any OpenAI-compatible `/chat/completions` URL) + `apiKey` if needed | Groq, OpenRouter, a Cloudflare Worker proxy, vLLM / Ollama on your own HTTPS host. Do not put a secret key here unless the endpoint is your own proxy. |
| `worker` | `endpoint` = your Cloudflare Worker `/chat` URL | Recommended for the hosted site: the Gemini key stays in the Worker's secrets, the Worker only accepts this site's origin. Reference code and steps in `deploy/cloudflare-worker/`. |
| `backend` | `endpoint` = `http://127.0.0.1:8000/api/chat` (default when the page runs on localhost) | Uses `app.py` and the `.env` keys described below. |
| `pollinations` | nothing | Free anonymous model at text.pollinations.ai; tried automatically in `auto` mode, currently often over quota. |
| `local` | nothing | Knowledge base only, no network calls. |

### Agent mode

The panel has two modes. **Chat** answers questions. **Agent** executes page
actions from a request such as "open dataset_21's quality report", "filter LFP
pouch datasets", "download the processing skill" or "switch to dark theme".
The model (or, without a model, a rule-based planner) turns the request into a
plan made only of the whitelisted tools in `js/assistant-actions.js` (open a
page / dataset / quality report, filter or clear the catalog, download the
skill or a report, run a sample assessment, select the preprocessing dataset,
open a model, set the theme, and drive the Contribute page: prefill the
contribution form from a sentence such as "I want to contribute 24 NMC 21700
cells from NTU, 2025, 1C/1C at 25 °C", report readiness, download the package,
open the prefilled GitHub issue). Each step is validated against the live catalog
and reported in the transcript with a ✓ / ! marker.

`provider: 'auto'` (default) tries Gemini → custom endpoint → local backend (localhost only)
→ Pollinations, and falls back to the knowledge base whenever a remote model is unavailable.
The header of the chat panel shows which source is active, and every answer is tagged
with its source.

## Backend keys (`app.py` only)

Copy `.env.example` to `.env`.

For Gemini:

```text
AI_PROVIDER=gemini
GEMINI_API_KEY=your_real_gemini_key_here
GEMINI_MODEL=gemini-2.5-flash
```

For any OpenAI-compatible API:

```text
AI_PROVIDER=openai
AI_API_KEY=your_key
AI_API_URL=https://api.example.com/v1/chat/completions
AI_MODEL=model-name
```

Then restart:

```powershell
python app.py
```

Without a key `POST /api/chat` answers `503` and the widget keeps using its knowledge base.

## If the Other Person Does Not Have a Key

They have three choices:

1. Use the dashboard with the built-in assistant (no AI key needed).
2. Get their own free Gemini API key and put it in `js/ai-config.js` (hosted site) or `.env` (local backend).
3. You deploy the backend on your own HTTPS server with your key, then point `endpoint` in `js/ai-config.js` at it.

Do not send your private `.env` file or real API key to others.

## Included Files

- `index.html`: frontend dashboard
- `app.py`: local backend server
- `requirements.txt`: Python dependencies
- `.env.example`: example API key configuration for `app.py`
- `js/ai-config.js`: AI assistant provider settings for the hosted site
- `dataset_registry.csv`: dataset table used by the dashboard
- `README_EN.md`: project overview
- `docs/schema/schema_overview.md`: schema context used by the backend assistant
