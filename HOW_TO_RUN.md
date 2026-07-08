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

## How to Enable AI With a Key

Copy `.env.example` to `.env`.

For Gemini:

```text
AI_PROVIDER=gemini
GEMINI_API_KEY=your_real_gemini_key_here
GEMINI_MODEL=gemini-2.5-flash
```

Then restart:

```powershell
python app.py
```

## If the Other Person Does Not Have a Key

They have three choices:

1. Use the dashboard without AI.
2. Get their own Gemini API key and put it in `.env`.
3. You deploy the backend on your own server with your key, then change the frontend API URLs from `http://127.0.0.1:8000/api/...` to your server URL.

Do not send your private `.env` file or real API key to others.

## Included Files

- `index.html`: frontend dashboard
- `app.py`: local backend server
- `requirements.txt`: Python dependencies
- `.env.example`: example API key configuration
- `dataset_registry.csv`: dataset table used by the dashboard
- `README_EN.md`: project overview
- `docs/schema/schema_overview.md`: schema context used by the backend assistant
