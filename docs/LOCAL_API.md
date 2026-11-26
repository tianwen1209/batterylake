# Connect Your API — local, session-only chat

This mode is separate from Guest Mode. It supports text chat with Gemini and
OpenAI-compatible HTTPS chat completions endpoints. It does not support agent
actions, file uploads, history synchronization, or automatic guest fallback.
No change to the BatteryLake server is needed.

## Setup

1. Install Python 3.10 or newer on **your computer**.
2. Download `scripts/local_api_connector.py` using the assistant's download link.
3. Open a terminal in the download directory. Run the command shown in
   **Connect Your API**, replacing the endpoint and model placeholders with the
   values from your provider. The endpoint is the **complete chat completions
   URL**, not just the provider's base URL. The origin is the exact website
   address (scheme, hostname and port), without a path or trailing slash:

   ```sh
   python3 local_api_connector.py \
     --origin https://batterytwin.ai \
     --endpoint https://YOUR_PROVIDER/v1/chat/completions \
     --model YOUR_MODEL_ID
   ```

   On Windows, use `py -3` if `python3` is unavailable. For a local website
   preview, use its actual origin, for example `http://127.0.0.1:8080`.
4. Enter your API key at the hidden terminal prompt. Do not put it into a
   command, file, website field, screenshot, or message to BatteryLake.
5. Keep the terminal running. Paste the **pairing code** it prints into the
   assistant and click **Connect locally**. This pairs with your computer; it
   does not verify the provider until you send the first message.
6. If the browser asks for local network access, allow it for this website.
   Support and permission behavior vary by browser. If connections fail, check
   browser permissions, origin spelling, Python version and port 8765. Do not
   disable browser security. Guest Mode remains a separate option.

For generic Chat Completions endpoints, the provider must accept bearer authentication and text `messages` with
`model`, `max_tokens`, `stream: false`, and `store: false`, returning
`choices[0].message.content`. A provider that rejects this contract is currently
unsupported; the connector will not silently remove the no-storage request.

For Gemini, keep using the full endpoint
`https://generativelanguage.googleapis.com/v1beta/openai/chat/completions` and
your Gemini model ID. The connector recognizes only that exact Google host and
path and uses Google's native `generateContent` API on the **same host**, with
`x-goog-api-key`, `contents`, `systemInstruction`, and
`generationConfig.maxOutputTokens`. This avoids sending Chat Completions-only
fields such as `store` to Gemini. No change to your startup command is required.
The terminal prints `Protocol: Gemini native generateContent` to confirm the
updated connector is running. There are no automatic retries or extra requests.
Current connector version: **3**. The website rejects older connectors before
sending chat text. Hover over the model name to see the native-adapter detail;
the terminal also confirms the protocol. Older connectors cannot silently use
the generic protocol.

For a Gemini test, `gemini-3.1-flash-lite` was successfully verified with this
connector on November 26, 2026. Model access and free quota depend on the Google
project. Avoid assuming that a model listed in pricing is available to a new
project: Google limits access to its 2.5 series to prior active users. See
[Google's model availability notice](https://ai.google.dev/gemini-api/docs/deprecations#gemini-2.5-flash-models).

## What is sent and retained

```text
Website in your browser -> 127.0.0.1 connector -> your chosen HTTPS provider
                               |
                          API key in memory
```

- Your API key is entered only in the connector and remains in its process
  memory until it stops. This version deliberately does not save it in a file
  or system credential store; re-enter it after each restart.
- The browser holds the pairing code in memory. Treat it as sensitive: it
  authorizes bounded use of your API through the connector. It is not the API
  key and is never sent to the provider. Restart the connector to invalidate it.
- The browser sends text, recent conversation context, and relevant **public**
  site context to the local connector. The connector forwards them directly to
  the configured provider with your API key. It does not contact BatteryLake's
  guest proxy, backend, search, or analytics with conversation content.
- Chats in this mode are not written to localStorage, sessionStorage, IndexedDB,
  cookies, chat databases, files, or connector access logs. Clear, disconnect,
  closing the assistant, returning to the mode picker, reload and page exit
  discard the browser's session references. This is not a guarantee of secure
  erasure from browser/OS memory, swap, extensions, or crash dumps.
- Clear retains pairing; disconnect/close/back also discard browser pairing.
  Clearing cancels waiting in the browser but cannot undo a request already
  received by the provider. The connector may finish that in-flight request;
  its result is not restored into a cleared or disconnected conversation.
- Provider retention policies still apply. For generic endpoints, `store: false` is requested but
  does not guarantee zero retention or override a provider's operational logs.
  Choose a provider/account with appropriate privacy terms. Fully offline use
  with a local model is not included in this version.
- Gemini's native request does not contain a `store` field; it does not create
  a server-side conversation resource, and context is supplied with each call.
  This does **not** guarantee zero Google-side retention. Google free-tier data
  may be used to improve its products: use public test prompts, not confidential
  research data. See [Google's data-use and pricing terms](https://ai.google.dev/gemini-api/docs/pricing).
- Responses are plain text: no automatic model-generated link/image fetches,
  executable HTML, tool calls or site actions. Public site context is computed
  from already loaded catalog data; no query containing private chat text is
  sent to the website. Ordinary website asset/catalog requests still occur.
- Guest Mode keeps its existing provider and browser history behavior. Its
  conversation is not sent to the user's provider, nor is the private
  conversation copied to Guest Mode.

## Connector limits and trust boundary

The connector binds only to `127.0.0.1:8765`, validates the exact HTTP Host and
configured website Origin, requires a random per-run bearer pairing code, and
returns CORS headers only for that origin. It allows only status and text-chat
requests. Endpoint, model, and API key can only be configured locally at startup.
It validates HTTPS certificates, refuses redirects, and ignores proxy environment
variables to avoid forwarding credentials through an unexpected proxy.

Default limits: one provider request at a time, 100 requests per connector run,
600 requested output tokens per request, 4,000 characters per new user message,
32,000 characters of combined context, and a 60-second provider timeout. Reduce
the request count with `--max-requests 20`. These are usage limits, **not a
monetary spending cap**; configure provider-side budgets and a dedicated,
restricted key where available. Failures count toward the request limit.

The allowed website's scripts can still read displayed chat and use the paired
connector. Keeping the key out of the webpage does not remove frontend supply
chain or XSS risks. Origin/pairing checks also do not defend against malware or
untrusted applications already running as the user. Keep website dependencies,
browser and computer secure.

Ctrl+C in the connector terminal stops it and invalidates its pairing code.
No provider request is made merely by pairing. Provider failures are reported
without logging or echoing upstream errors, which could contain sensitive data.
The webpage shows only fixed diagnostic categories: provider access denied
(401/403), endpoint/model not found (404), quota/rate limit (429), unclassified
request rejection (400/422), redirects, service errors, TLS, timeout, network,
or invalid/empty response. These diagnoses do not include provider error bodies,
keys, or chat text. If reporting a problem, share only this category.
For Google 400/403 errors, the connector inspects a bounded error response in
local memory and maps known error reasons to fixed labels for invalid keys,
key/service restrictions, account verification, billing/free-tier eligibility,
region restrictions, or `FAILED_PRECONDITION`. Only known parameter names may
be surfaced. Raw error messages/metadata are never returned, printed or saved.
An unclassified HTTP 400 is not proof of a request-format problem.

## Development checks

```sh
node --test tests/test_assistant.cjs
python3 -m unittest discover -s tests -p 'test_local_api_connector.py'
```

Tests use synthetic credentials and mocked providers, never real user keys or
billable model calls. An actual provider/browser connection still needs manual
verification with the user's chosen endpoint and local network permission.
