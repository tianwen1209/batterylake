#!/usr/bin/env python3
"""BatteryLake user-owned API connector. Python 3.10+, standard library only.

Run on the user's computer, never on the BatteryLake server. No key, prompt,
response or pairing token is written to disk. No request/access logging.
"""
import argparse
import getpass
import hmac
import json
import re
import secrets
import ssl
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener

MAX_BODY = 196608
MAX_CONTEXT = 32000
MAX_REPLY = 16000
PORT = 8765
CONNECTOR_VERSION = 3


def google_failure_code(error):
    """Inspect Google's error in local memory; emit only fixed categories.

    HTTP 400 includes invalid keys and unmet billing/region prerequisites, not
    just invalid JSON. Never return the upstream message, metadata or field
    values, which may contain the key or user's text.
    """
    try:
        raw = error.read(16385)
        if len(raw) > 16384:
            return None
        data = json.loads(raw).get('error', {})
        if not isinstance(data, dict):
            return None
        message = data.get('message', '')
        message = message.lower() if isinstance(message, str) else ''
        details = data.get('details', [])
        reasons = {detail.get('reason') for detail in details
                   if isinstance(detail, dict) and isinstance(detail.get('reason'), str)} if isinstance(details, list) else set()
        if reasons & {'API_KEY_INVALID', 'API_KEY_EXPIRED', 'API_KEY_NOT_FOUND', 'API_KEY_REVOKED'} or any(text in message for text in ('api key not valid', 'api key expired', 'api key was reported as leaked')):
            return 'provider_key_invalid'
        if reasons & {'FREE_TIER_VERIFICATION_REQUIRED', 'PROJECT_VERIFICATION_REQUIRED'}:
            return 'provider_verification'
        if reasons & {'BILLING_DISABLED', 'BILLING_NOT_ACTIVE', 'FREE_TIER_UNAVAILABLE'} or any(text in message for text in ('free tier is not available', 'enable billing', 'billing is disabled')):
            return 'provider_billing'
        if any(text in message for text in ('user location is not supported', 'location is not supported', 'country is not supported', 'region is not supported')):
            return 'provider_region'
        if reasons & {'SERVICE_DISABLED', 'API_KEY_SERVICE_BLOCKED', 'API_KEY_HTTP_REFERRER_BLOCKED', 'API_KEY_IP_ADDRESS_BLOCKED'}:
            return 'provider_key_restricted'
        if data.get('status') == 'FAILED_PRECONDITION' or data.get('code') == 'failed_precondition':
            return 'provider_precondition'
        # Report only known parameter names, never arbitrary upstream strings.
        for field in ('store', 'max_tokens', 'maxOutputTokens', 'systemInstruction', 'contents'):
            if 'unknown name "' + field.lower() + '"' in message:
                return 'provider_parameter_' + field
    except (OSError, ValueError, TypeError, AttributeError):
        pass
    return None


def provider_failure(error, google=False):
    """Return allowlisted diagnostics, never exception text or provider bodies."""
    if isinstance(error, HTTPError):
        status = error.code
        code = ('provider_auth' if status in (401, 403) else
                'provider_model' if status == 404 else
                'provider_quota' if status == 429 else
                'provider_request' if status in (400, 422) else
                'provider_redirect' if 300 <= status < 400 else
                'provider_unavailable')
        if google and status in (400, 401, 402, 403, 422):
            code = google_failure_code(error) or code
        return {'code': code, 'provider_status': status}
    reason = error.reason if isinstance(error, URLError) else error
    if isinstance(reason, ssl.SSLError):
        return {'code': 'provider_tls'}
    if isinstance(reason, TimeoutError):
        return {'code': 'provider_timeout'}
    if isinstance(error, (URLError, OSError)):
        return {'code': 'provider_network'}
    return {'code': 'provider_response'}


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def validate_origin(value):
    if not value.isascii() or any(ord(c) < 33 or ord(c) == 127 for c in value):
        raise ValueError('Origin must not contain whitespace or control characters.')
    url = urlsplit(value)
    _ = url.port  # Reject malformed and out-of-range ports before serving.
    local = url.hostname in ('localhost', '127.0.0.1', '::1')
    if (url.scheme != 'https' and not (url.scheme == 'http' and local)) or not url.hostname:
        raise ValueError('Origin must be HTTPS (or HTTP localhost for development).')
    if url.username or url.password or url.path or url.query or url.fragment or '*' in value:
        raise ValueError('Origin must contain only scheme, hostname and optional port, without a trailing slash.')
    return value


def validate_endpoint(value):
    if not value.isascii() or any(ord(c) < 33 or ord(c) == 127 for c in value):
        raise ValueError('Endpoint must not contain whitespace or control characters.')
    url = urlsplit(value)
    _ = url.port
    if url.scheme != 'https' or not url.hostname or url.username or url.password or url.query or url.fragment:
        raise ValueError('Endpoint must be a full HTTPS chat completions URL without credentials, query or fragment.')
    if url.hostname in ('batterytwin.ai', 'www.batterytwin.ai', 'tianwen1209.github.io', 'tianwen-gemini-proxy.tianwen-4e0.workers.dev'):
        raise ValueError('Use your model provider endpoint, not the BatteryLake guest service.')
    return value


def validate_messages(body):
    if not isinstance(body, dict) or set(body) != {'messages'}:
        raise ValueError('Only messages are accepted.')
    messages = body['messages']
    if not isinstance(messages, list) or not 2 <= len(messages) <= 10:
        raise ValueError('Invalid conversation length.')
    size = 0
    for index, message in enumerate(messages):
        if not isinstance(message, dict) or set(message) != {'role', 'content'}:
            raise ValueError('Text messages only.')
        expected = 'system' if index == 0 else ('user' if index % 2 else 'assistant')
        if message['role'] != expected or not isinstance(message['content'], str) or not message['content'].strip():
            raise ValueError('Invalid message.')
        size += len(message['content'])
    if messages[-1]['role'] != 'user' or size > MAX_CONTEXT or len(messages[-1]['content']) > 4000:
        raise ValueError('Conversation exceeds limit.')
    return messages


class Connector(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = False

    def __init__(self, origin, endpoint, model, key, max_requests=100, port=PORT):
        self.origin = validate_origin(origin)
        self.endpoint = validate_endpoint(endpoint)
        if not model or len(model) > 200 or any(ord(c) < 32 for c in model):
            raise ValueError('Invalid model ID.')
        url = urlsplit(self.endpoint)
        # Only the exact Google-owned compatibility endpoint is adapted. Never
        # infer a provider from a model name or send a key to a different host.
        self.gemini = (url.hostname == 'generativelanguage.googleapis.com'
                       and url.port in (None, 443)
                       and url.path == '/v1beta/openai/chat/completions')
        if self.gemini and not re.fullmatch(r'gemini-[A-Za-z0-9._-]+', model):
            raise ValueError('Use a Gemini model ID, without a models/ prefix.')
        if not key or not key.isascii() or any(ord(c) < 33 or ord(c) == 127 for c in key):
            raise ValueError('Invalid API key.')
        if max_requests < 1:
            raise ValueError('Request limit must be positive.')
        self.model = model
        self.key = key
        self.token = secrets.token_urlsafe(32)
        self.max_requests = max_requests
        self.used = 0
        self.request_lock = threading.Lock()
        # Do not inherit HTTP(S)_PROXY settings or follow credential-bearing
        # requests to another destination. HTTPS certificate validation stays on.
        self.opener = build_opener(ProxyHandler({}), NoRedirect())
        super().__init__(('127.0.0.1', port), Handler)

    def handle_error(self, request, client_address):
        # Default tracebacks can expose local state. Never dump request data.
        pass

    def complete(self, messages):
        body = {
            'model': self.model, 'messages': messages,
            'max_tokens': 600, 'stream': False, 'store': False
        }
        endpoint = self.endpoint
        headers = {
            'Authorization': 'Bearer ' + self.key,
            'Content-Type': 'application/json', 'Accept': 'application/json'
        }
        if self.gemini:
            # generateContent is stateless: send current context explicitly.
            # It has no OpenAI `store` field. Do not claim that this controls
            # Google's retention/training policy (especially the free tier).
            endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/' + self.model + ':generateContent'
            headers = {'x-goog-api-key': self.key, 'Content-Type': 'application/json', 'Accept': 'application/json'}
            body = {
                'systemInstruction': {'parts': [{'text': messages[0]['content']}]},
                'contents': [
                    {'role': 'model' if message['role'] == 'assistant' else 'user',
                     'parts': [{'text': message['content']}]} for message in messages[1:]
                ],
                'generationConfig': {'maxOutputTokens': 600}
            }
        payload = json.dumps(body).encode('utf-8')
        request = Request(endpoint, data=payload, headers=headers, method='POST')
        with self.opener.open(request, timeout=60) as response:
            raw = response.read(262145)
        if len(raw) > 262144:
            raise ValueError('Response too large.')
        data = json.loads(raw)
        if self.gemini:
            parts = data['candidates'][0]['content']['parts']
            text = ''.join(part['text'] for part in parts
                           if isinstance(part, dict) and isinstance(part.get('text'), str)
                           and not part.get('thought'))
        else:
            text = data['choices'][0]['message']['content']
        if not isinstance(text, str) or not text.strip() or len(text) > MAX_REPLY:
            raise ValueError('Invalid model response.')
        return text


class Handler(BaseHTTPRequestHandler):
    # HTTP/1.0 closes every connection; do not retain request bodies across turns.
    server_version = 'BatteryLakeLocal/1'
    sys_version = ''

    def setup(self):
        super().setup()
        self.connection.settimeout(10)

    def log_message(self, *args):
        pass

    def send_error(self, code, message=None, explain=None):
        # BaseHTTPRequestHandler otherwise echoes untrusted request paths.
        self.reply(code, {'error': 'Request rejected.'})

    def reply(self, code, data=None, cors=False):
        body = json.dumps(data).encode('utf-8') if data is not None else b''
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Vary', 'Origin')
        if cors:
            self.send_header('Access-Control-Allow-Origin', self.server.origin)
        self.end_headers()
        self.wfile.write(body)

    def permitted(self, authenticate=True):
        # Exact Host blocks DNS rebinding; exact Origin blocks other websites.
        if (self.headers.get('Host') != '127.0.0.1:' + str(self.server.server_port)
                or self.headers.get('Origin') != self.server.origin):
            self.reply(403, {'error': 'Origin or host rejected.'})
            return False
        if authenticate and not hmac.compare_digest(
                self.headers.get('Authorization', '').encode('utf-8'),
                ('Bearer ' + self.server.token).encode('ascii')):
            self.reply(401, {'error': 'Pairing required.'}, cors=True)
            return False
        return True

    def do_OPTIONS(self):
        if not self.permitted(authenticate=False):
            return
        method = self.headers.get('Access-Control-Request-Method')
        headers = {v.strip().lower() for v in self.headers.get('Access-Control-Request-Headers', '').split(',') if v.strip()}
        if (self.path, method) not in (('/status', 'GET'), ('/chat', 'POST')) or not headers <= {'authorization', 'content-type'}:
            self.reply(403, {'error': 'Preflight rejected.'}, cors=True)
            return
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', self.server.origin)
        self.send_header('Access-Control-Allow-Methods', 'GET, POST')
        self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
        self.send_header('Access-Control-Allow-Private-Network', 'true')
        self.send_header('Vary', 'Origin')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', '0')
        self.end_headers()

    def do_GET(self):
        if not self.permitted():
            return
        if self.path != '/status':
            self.reply(404, {'error': 'Unknown route.'}, cors=True)
            return
        self.reply(200, {
            'protocol': 'batterylake-local-v1', 'provider': urlsplit(self.server.endpoint).hostname,
            'model': self.server.model, 'version': CONNECTOR_VERSION,
            'transport': 'gemini-native' if self.server.gemini else 'chat-completions'
        }, cors=True)

    def do_POST(self):
        if not self.permitted():
            return
        if self.path != '/chat':
            self.reply(404, {'error': 'Unknown route.'}, cors=True)
            return
        if self.headers.get('Content-Type', '').lower() != 'application/json' or self.headers.get('Transfer-Encoding'):
            self.reply(400, {'error': 'JSON required.'}, cors=True)
            return
        length = self.headers.get('Content-Length', '')
        if not re.fullmatch(r'[0-9]{1,6}', length) or not 0 < int(length) <= MAX_BODY:
            self.reply(413, {'error': 'Request too large.'}, cors=True)
            return
        try:
            self.connection.settimeout(10)
            raw = self.rfile.read(int(length))
            if len(raw) != int(length):
                raise ValueError('Incomplete body.')
            messages = validate_messages(json.loads(raw))
        except (ValueError, UnicodeError, OSError):
            self.reply(413, {'error': 'Invalid or oversized conversation.'}, cors=True)
            return
        if not self.server.request_lock.acquire(blocking=False):
            self.reply(429, {'error': 'One request at a time.'}, cors=True)
            return
        try:
            if self.server.used >= self.server.max_requests:
                self.reply(429, {'error': 'Session request limit reached.'}, cors=True)
                return
            self.server.used += 1
            try:
                text = self.server.complete(messages)
            except (HTTPError, URLError, TimeoutError, OSError, ValueError, KeyError, IndexError, TypeError) as error:
                self.reply(502, provider_failure(error, google=self.server.gemini), cors=True)
                return
            self.reply(200, {'reply': text}, cors=True)
        finally:
            self.server.request_lock.release()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--origin', required=True, help='Exact website origin, e.g. https://batterytwin.ai')
    parser.add_argument('--endpoint', required=True, help='Full HTTPS OpenAI-compatible chat completions URL')
    parser.add_argument('--model', required=True, help='Model ID from your provider')
    parser.add_argument('--max-requests', type=int, default=100, help='Maximum provider requests per connector run (default 100)')
    args = parser.parse_args()
    if not sys.stdin.isatty():
        parser.exit(1, 'Run in an interactive terminal so the API key can be entered without echo.\n')
    try:
        validate_origin(args.origin)
        validate_endpoint(args.endpoint)
        key = getpass.getpass('API key (local only, hidden; never paste it into the website): ').strip()
        server = Connector(args.origin, args.endpoint, args.model, key, args.max_requests)
    except (ValueError, OSError):
        parser.exit(1, 'Cannot start. Check origin, HTTPS endpoint, model, key, request limit, and that port 8765 is free.\n')
    print('Local connector: http://127.0.0.1:8765 (this computer only)')
    print('Connector version: ' + str(CONNECTOR_VERSION))
    print('Allowed website: ' + args.origin)
    print('Provider: ' + urlsplit(args.endpoint).hostname + ' | Model: ' + args.model)
    if server.gemini:
        print('Protocol: Gemini native generateContent (no Chat Completions-only fields).')
    print('Pairing code (paste into Connect Your API): ' + server.token)
    print('No chat/key files or request logs. Provider retention policy still applies.')
    print('Limit: ' + str(args.max_requests) + ' provider requests. Ctrl+C stops the connector and invalidates this code.')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
