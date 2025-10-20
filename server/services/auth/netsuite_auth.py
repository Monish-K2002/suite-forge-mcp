import os
import base64
import hashlib
import secrets
import requests
from urllib.parse import urlencode
from datetime import datetime, timedelta

class NetSuiteAuthService:
    def __init__(self):
        # Store PKCE challenges in memory for now (you can swap to a session store)
        self.pkce_store = {}

    # Generate PKCE challenge
    def generate_pkce(self):
        verifier = base64.urlsafe_b64encode(secrets.token_bytes(32)).rstrip(b'=').decode('utf-8')
        challenge = base64.urlsafe_b64encode(
            hashlib.sha256(verifier.encode('utf-8')).digest()
        ).rstrip(b'=').decode('utf-8')
        return {
            'code_verifier': verifier,
            'code_challenge': challenge,
            'code_challenge_method': 'S256'
        }

    # Generate OAuth 2.0 authorization URL
    def get_authorization_url(self, session_id, config):
        pkce = self.generate_pkce()

        # Store PKCE verifier in memory (or session)
        self.pkce_store[session_id] = {
            'verifier': pkce['code_verifier'],
            'config': config,
            'timestamp': datetime.utcnow().isoformat()
        }

        params = {
            'response_type': 'code',
            'client_id': config['client_id'],
            'redirect_uri': config.get('redirect_uri', 'http://localhost:8000/callback'),
            'scope': config.get('scope', 'mcp'),
            'state': session_id,
            'code_challenge': pkce['code_challenge'],
            'code_challenge_method': pkce['code_challenge_method']
        }

        auth_url = f"https://{config['account_id']}.app.netsuite.com/app/login/oauth2/authorize.nl?{urlencode(params)}"
        print('Generated auth URL with PKCE challenge stored')
        return auth_url

    # Exchange authorization code for tokens
    def exchange_code_for_tokens(self, code, session_id):
        pkce_data = self.pkce_store.get(session_id)
        if not pkce_data:
            raise ValueError('PKCE challenge not found for this session. Retry the flow.')

        verifier = pkce_data['verifier']
        config = pkce_data['config']

        token_url = f"https://{config['account_id']}.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token"

        params = {
            'grant_type': 'authorization_code',
            'code': code,
            'redirect_uri': config.get('redirect_uri', 'http://localhost:8000/callback'),
            'client_id': config['client_id'],
            'code_verifier': verifier
        }

        if 'client_secret' in config:
            params['client_secret'] = config['client_secret']

        response = requests.post(token_url, data=params, headers={'Content-Type': 'application/x-www-form-urlencoded'})
        response.raise_for_status()

        # Clean up PKCE data
        del self.pkce_store[session_id]

        return response.json()

    # Refresh access token
    def refresh_access_token(self, refresh_token, config):
        token_url = f"https://{config['account_id']}.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token"

        params = {
            'grant_type': 'refresh_token',
            'refresh_token': refresh_token,
            'client_id': config['client_id']
        }

        if 'client_secret' in config:
            params['client_secret'] = config['client_secret']

        response = requests.post(token_url, data=params, headers={'Content-Type': 'application/x-www-form-urlencoded'})
        response.raise_for_status()

        return response.json()
