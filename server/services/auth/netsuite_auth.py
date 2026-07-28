from functools import cache
import os
import base64
import hashlib
import secrets
import logging
import requests
from urllib.parse import urlencode
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

class NetSuiteAuthService:
    def __init__(self):
        # PKCE challenges in-memory store mapping session_id -> metadata
        self.pkce_store = {}

    def _cleanup_expired_challenges(self, ttl_minutes: int = 15):
        """Remove stored PKCE challenges older than TTL."""
        now = datetime.now(timezone.utc)
        expired_keys = []
        for session_id, data in self.pkce_store.items():
            ts = data.get('timestamp')
            if isinstance(ts, str):
                ts = datetime.fromisoformat(ts)
            if ts and (now - ts > timedelta(minutes=ttl_minutes)):
                expired_keys.append(session_id)
        for key in expired_keys:
            del self.pkce_store[key]

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
        self._cleanup_expired_challenges()
        pkce = self.generate_pkce()
        
        self.pkce_store[session_id] = {
            'verifier': pkce['code_verifier'],
            'config': config,
            'timestamp': datetime.now(timezone.utc)
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
        logger.info(f"Generated NetSuite authorization URL for session {session_id}")
        return auth_url

    # Exchange authorization code for tokens
    def exchange_code_for_tokens(self, code: str, session_id: str):
        self._cleanup_expired_challenges()
        pkce_data = self.pkce_store.get(session_id)
        if not pkce_data:
            raise ValueError('PKCE challenge not found or expired for this session. Please restart authorization.')

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

        if 'client_secret' in config and config['client_secret']:
            params['client_secret'] = config['client_secret']

        response = requests.post(token_url, data=params, headers={'Content-Type': 'application/x-www-form-urlencoded'})
        
        # Clean up PKCE data after attempt
        del self.pkce_store[session_id]

        if not response.ok:
            logger.error(f"NetSuite token exchange failed: {response.text}")
            response.raise_for_status()

        return response.json()

    # Refresh access token
    def refresh_access_token(self, refresh_token: str, config: dict):
        token_url = f"https://{config['account_id']}.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token"

        params = {
            'grant_type': 'refresh_token',
            'refresh_token': refresh_token,
            'client_id': config['client_id']
        }

        if 'client_secret' in config and config['client_secret']:
            params['client_secret'] = config['client_secret']

        response = requests.post(token_url, data=params, headers={'Content-Type': 'application/x-www-form-urlencoded'})
        if not response.ok:
            logger.error(f"NetSuite token refresh failed: {response.text}")
            response.raise_for_status()

        return response.json()

    
    def get_tools(self, config: dict, account_id: str) -> list:
        """Return the list of available tools."""
        # print(f"Config: {config}")
        # print(f"Access Token: {config.get('access_token')}")
        # print(f"Account ID: {account_id}")
        if not config:
            raise ValueError("NetSuite configuration not found in cache")
        mcp_url = f"https://{account_id}.suitetalk.api.netsuite.com/services/mcp/v1/all"

        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/list"
        }

        response = requests.post(
            mcp_url,
            headers={
                "Authorization": f"Bearer {config['access_token']}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            json=payload,
        )
        if response.status_code == 200:
            data = response.json()
            result = data.get("result", [])
            # print("Success:", result.get("tools", []))
            return result.get("tools", [])
        else:
            print(f"Error {response.status_code}:", response.text)
            return []

