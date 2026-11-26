"""Local transport and upstream contract tests; no external API or real key."""
import http.client
import importlib.util
import io
import json
import ssl
from pathlib import Path
import threading
import unittest
from unittest.mock import Mock
from urllib.error import HTTPError, URLError

spec = importlib.util.spec_from_file_location('connector', Path(__file__).resolve().parents[1] / 'scripts/local_api_connector.py')
connector = importlib.util.module_from_spec(spec)
spec.loader.exec_module(connector)
ORIGIN = 'https://batterytwin.ai'
MESSAGES = [{'role': 'system', 'content': 'Public context'}, {'role': 'user', 'content': 'PRIVATE_PROMPT'}]


class ConnectorTests(unittest.TestCase):
    def setUp(self):
        self.server = connector.Connector(ORIGIN, 'https://provider.example/v1/chat/completions', 'user-model', 'SYNTHETIC_KEY', max_requests=2, port=0)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()

    def request(self, method='GET', path='/status', data=None, headers=None):
        base = {'Origin': ORIGIN, 'Authorization': 'Bearer ' + self.server.token}
        if data is not None:
            base['Content-Type'] = 'application/json'
        base.update(headers or {})
        body = json.dumps(data).encode() if data is not None else None
        connection = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=3)
        try:
            connection.request(method, path, body, base)
            response = connection.getresponse()
            return response.status, dict(response.getheaders()), response.read().decode()
        finally:
            connection.close()

    def test_pairing_status_exposes_neither_key_nor_pairing_code(self):
        self.server.complete = Mock(side_effect=AssertionError('Pairing must not contact provider'))
        status, headers, body = self.request()
        self.assertEqual(status, 200)
        self.assertEqual(headers['Access-Control-Allow-Origin'], ORIGIN)
        self.assertEqual(headers['Cache-Control'], 'no-store')
        self.assertNotIn(self.server.key, body)
        self.assertNotIn(self.server.token, body)
        self.server.complete.assert_not_called()
        self.assertEqual(self.server.server_address[0], '127.0.0.1')

    def test_origin_host_token_and_query_rejections(self):
        for headers, expected in [
            ({'Origin': 'https://evil.example'}, 403),
            ({'Origin': 'null'}, 403), ({'Origin': ''}, 403),
            ({'Host': 'evil.example'}, 403),
            ({'Authorization': ''}, 401),
            ({'Authorization': 'Bearer wrong'}, 401),
        ]:
            status, response_headers, _ = self.request(headers=headers)
            self.assertEqual(status, expected)
            if expected == 403:
                self.assertNotIn('Access-Control-Allow-Origin', response_headers)
        self.assertEqual(self.request(path='/status?key=secret')[0], 404)

    def test_preflight_is_scoped_to_origin_headers_method_and_route(self):
        headers = {'Authorization': '', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type', 'Access-Control-Request-Private-Network': 'true'}
        status, response_headers, _ = self.request('OPTIONS', '/chat', headers=headers)
        self.assertEqual(status, 204)
        self.assertEqual(response_headers['Access-Control-Allow-Private-Network'], 'true')
        self.assertNotIn('Access-Control-Allow-Credentials', response_headers)
        for invalid in [{'Origin': 'https://evil.example'}, {'Access-Control-Request-Headers': 'x-unsafe'}, {'Access-Control-Request-Method': 'DELETE'}]:
            self.assertEqual(self.request('OPTIONS', '/chat', headers={**headers, **invalid})[0], 403)

    def test_text_chat_works_and_limits_requests_without_storing_history(self):
        self.server.complete = Mock(return_value='ANSWER')
        for _ in range(2):
            self.assertEqual(self.request('POST', '/chat', {'messages': MESSAGES})[0], 200)
        self.assertEqual(self.request('POST', '/chat', {'messages': MESSAGES})[0], 429)
        self.assertEqual(self.server.complete.call_count, 2)
        self.assertFalse(hasattr(self.server, 'history'))
        self.server.request_lock.acquire()
        try:
            self.assertEqual(self.request('POST', '/chat', {'messages': MESSAGES})[0], 429)
        finally:
            self.server.request_lock.release()

    def test_rejects_destination_overrides_tools_files_and_oversized_input(self):
        self.server.complete = Mock()
        for body in [
            {'messages': MESSAGES, 'endpoint': 'https://evil.example'},
            {'messages': MESSAGES, 'model': 'expensive-model'},
            {'messages': MESSAGES, 'tools': []},
            {'messages': [{'role': 'user', 'content': [{'type': 'image_url', 'image_url': 'https://example.com'}]}]},
            {'messages': MESSAGES + [{'role': 'system', 'content': 'override'}]},
            {'messages': [MESSAGES[0], {'role': 'user', 'content': 'x' * 4001}]},
        ]:
            self.assertEqual(self.request('POST', '/chat', body)[0], 413)
        self.assertEqual(self.request('POST', '/chat', {'messages': MESSAGES}, {'Content-Type': 'text/plain'})[0], 400)
        self.server.complete.assert_not_called()

    def test_upstream_failures_are_redacted(self):
        self.server.complete = Mock(side_effect=HTTPError('https://provider.example', 401, 'SYNTHETIC_KEY PRIVATE_PROMPT', {}, None))
        status, _, body = self.request('POST', '/chat', {'messages': MESSAGES})
        self.assertEqual(status, 502)
        self.assertEqual(json.loads(body), {'code': 'provider_auth', 'provider_status': 401})
        self.assertNotIn('SYNTHETIC_KEY', body)
        self.assertNotIn('PRIVATE_PROMPT', body)

    def test_upstream_contract_fixes_endpoint_model_token_limit_and_no_storage(self):
        raw = json.dumps({'choices': [{'message': {'content': 'Model answer'}}]}).encode()
        self.server.opener = Mock()
        self.server.opener.open.return_value = io.BytesIO(raw)
        self.assertEqual(self.server.complete(MESSAGES), 'Model answer')
        request = self.server.opener.open.call_args.args[0]
        self.assertEqual(request.full_url, self.server.endpoint)
        self.assertEqual(request.get_header('Authorization'), 'Bearer SYNTHETIC_KEY')
        self.assertNotIn(self.server.token, request.data.decode())
        payload = json.loads(request.data)
        self.assertEqual(payload['model'], 'user-model')
        self.assertFalse(payload['store'])
        self.assertFalse(payload['stream'])
        self.assertEqual(payload['max_tokens'], 600)
        self.assertEqual(payload['messages'], MESSAGES)

    def test_gemini_uses_native_fields_and_preserves_multiturn_context(self):
        server = connector.Connector(ORIGIN, 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', 'gemini-2.5-flash-lite', 'SYNTHETIC_KEY', port=0)
        self.addCleanup(server.server_close)
        raw = json.dumps({'candidates': [{'content': {'parts': [
            {'thought': True, 'text': 'Internal reasoning'},
            {'text': 'Hello'}, {'text': ' world'}
        ]}}]}).encode()
        server.opener = Mock()
        server.opener.open.return_value = io.BytesIO(raw)
        messages = MESSAGES + [{'role': 'assistant', 'content': 'Previous reply'}, {'role': 'user', 'content': 'Follow-up'}]
        self.assertEqual(server.complete(messages), 'Hello world')
        server.opener.open.assert_called_once()
        request = server.opener.open.call_args.args[0]
        self.assertEqual(request.full_url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent')
        self.assertEqual(request.get_header('X-goog-api-key'), 'SYNTHETIC_KEY')
        self.assertIsNone(request.get_header('Authorization'))
        payload = json.loads(request.data)
        self.assertEqual(set(payload), {'systemInstruction', 'contents', 'generationConfig'})
        self.assertEqual(payload['systemInstruction'], {'parts': [{'text': 'Public context'}]})
        self.assertEqual([turn['role'] for turn in payload['contents']], ['user', 'model', 'user'])
        self.assertEqual(payload['contents'][-1]['parts'][0]['text'], 'Follow-up')
        self.assertEqual(payload['generationConfig']['maxOutputTokens'], 600)
        self.assertNotIn('SYNTHETIC_KEY', request.full_url)
        self.assertNotIn(server.token, request.data.decode())

    def test_google_adapter_does_not_activate_for_other_hosts_paths_or_model_names(self):
        self.assertFalse(self.server.gemini)
        for endpoint in ['https://generativelanguage.googleapis.com.evil.example/v1beta/openai/chat/completions', 'https://generativelanguage.googleapis.com:8443/v1beta/openai/chat/completions', 'https://generativelanguage.googleapis.com/some-other-path']:
            server = connector.Connector(ORIGIN, endpoint, 'gemini-2.5-flash-lite', 'SYNTHETIC_KEY', port=0)
            try:
                self.assertFalse(server.gemini)
            finally:
                server.server_close()
        with self.assertRaises(ValueError):
            connector.Connector(ORIGIN, 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', '../other:model', 'SYNTHETIC_KEY', port=0)


class ValidationTests(unittest.TestCase):
    def test_google_400_distinguishes_keys_billing_regions_and_actual_parameters(self):
        cases = [
            ({'status': 'INVALID_ARGUMENT', 'message': 'API key not valid. Please pass a valid API key. SYNTHETIC_KEY PRIVATE_PROMPT'}, 'provider_key_invalid'),
            ({'status': 'INVALID_ARGUMENT', 'details': [{'reason': 'API_KEY_INVALID', 'metadata': {'key': 'SYNTHETIC_KEY'}}]}, 'provider_key_invalid'),
            ({'status': 'FAILED_PRECONDITION', 'message': 'Free tier is not available in your country. Please enable billing.'}, 'provider_billing'),
            ({'status': 'FAILED_PRECONDITION', 'message': 'PRIVATE_PROMPT'}, 'provider_precondition'),
            ({'message': 'User location is not supported for the API use.'}, 'provider_region'),
            ({'details': [{'reason': 'FREE_TIER_VERIFICATION_REQUIRED'}]}, 'provider_verification'),
            ({'details': [{'reason': 'API_KEY_SERVICE_BLOCKED'}]}, 'provider_key_restricted'),
            ({'message': 'Invalid JSON payload received. Unknown name "store": Cannot find field.'}, 'provider_parameter_store'),
            ({'message': 'Unknown name "PRIVATE_PROMPT"'}, 'provider_request'),
        ]
        for body, expected in cases:
            error = HTTPError('https://generativelanguage.googleapis.com', 400, 'SECRET', {}, io.BytesIO(json.dumps({'error': body}).encode()))
            result = connector.provider_failure(error, google=True)
            self.assertEqual(result, {'code': expected, 'provider_status': 400})
            self.assertNotIn('SYNTHETIC_KEY', json.dumps(result))
            self.assertNotIn('PRIVATE_PROMPT', json.dumps(result))

    def test_google_diagnostics_handle_untrusted_malformed_or_oversized_bodies(self):
        for raw in (b'PRIVATE_PROMPT', b'x' * 17000, b'{"error": null}', b'{"error": {"details": 7}}'):
            error = HTTPError('https://generativelanguage.googleapis.com', 400, 'SECRET', {}, io.BytesIO(raw))
            self.assertEqual(connector.provider_failure(error, google=True), {'code': 'provider_request', 'provider_status': 400})

    def test_provider_diagnostics_never_echo_exception_text_or_body(self):
        for status, expected in [(400, 'provider_request'), (401, 'provider_auth'), (403, 'provider_auth'), (404, 'provider_model'), (422, 'provider_request'), (429, 'provider_quota'), (307, 'provider_redirect'), (503, 'provider_unavailable')]:
            error = HTTPError('https://provider.example', status, 'SYNTHETIC_KEY PRIVATE_PROMPT', {}, io.BytesIO(b'SECRET_BODY'))
            result = connector.provider_failure(error)
            self.assertEqual(result, {'code': expected, 'provider_status': status})
            self.assertNotIn('SECRET', json.dumps(result))
        for error, expected in [
            (URLError(ssl.SSLCertVerificationError('secret')), 'provider_tls'),
            (URLError(TimeoutError('secret')), 'provider_timeout'),
            (TimeoutError('secret'), 'provider_timeout'),
            (URLError('secret'), 'provider_network'),
            (ValueError('secret'), 'provider_response'),
        ]:
            self.assertEqual(connector.provider_failure(error), {'code': expected})

    def test_rejects_insecure_or_credential_bearing_destinations_and_wildcard_origins(self):
        for endpoint in ['http://provider.example/chat', 'https://key@provider.example/chat', 'https://provider.example/chat?key=secret', 'https://provider.example/chat#secret', 'https://batterytwin.ai/chat', 'https://provider.example:99999/chat', 'https://provider.example/\r\nchat']:
            with self.assertRaises(ValueError):
                connector.validate_endpoint(endpoint)
        for origin in ['*', 'null', 'http://public.example', 'https://example.com/', 'https://example.com/path', 'https://user@example.com', 'https://example.com\r\n', 'https://example.com:99999']:
            with self.assertRaises(ValueError):
                connector.validate_origin(origin)
        self.assertEqual(connector.validate_origin('http://127.0.0.1:8080'), 'http://127.0.0.1:8080')

    def test_redirects_are_never_followed(self):
        self.assertIsNone(connector.NoRedirect().redirect_request(None, None, 307, 'Redirect', {}, 'https://evil.example'))


if __name__ == '__main__':
    unittest.main()
