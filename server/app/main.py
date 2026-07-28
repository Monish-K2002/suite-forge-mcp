import secrets
import logging
from typing import Optional
from fastapi import FastAPI, Request, HTTPException, status
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from services.auth.netsuite_auth import NetSuiteAuthService
from services.ai.ai import AIService
from services.cache.cache import Cache

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Suite Forge MCP API")

auth_service = NetSuiteAuthService()
ai_service = AIService()
cache = Cache()

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AuthRequest(BaseModel):
    client_id: str
    account_id: str

class FetchModelsRequest(BaseModel):
    api_provider: str
    api_key: str

class UseModelRequest(BaseModel):
    model_name: str
    api_provider: Optional[str] = None
    api_key: Optional[str] = None

class ChatRequest(BaseModel):
    message: str

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Suite Forge MCP API Running"}

@app.post("/auth")
async def auth(body: AuthRequest):
    config = {
        "client_id": body.client_id,
        "account_id": body.account_id,
    }
    cache.cache_set("netsuite_config", config)

    session_id = secrets.token_urlsafe(32)
    auth_url = auth_service.get_authorization_url(session_id, config)

    return {"auth_url": auth_url, "session_id": session_id}

@app.get("/callback")
def callback(code: Optional[str] = None, state: Optional[str] = None, error: Optional[str] = None):
    if error:
        return HTMLResponse(content=f"<html><body><h2>Authentication Failed</h2><p>{error}</p></body></html>", status_code=400)
    
    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing required authorization parameters (code, state).")

    try:
        tokens = auth_service.exchange_code_for_tokens(code, state)
        cache.cache_set("netsuite_tokens", tokens)
        html_content = """
        <html>
            <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
                <h2>NetSuite Authentication Successful!</h2>
                <p>You may close this window.</p>
                <script>
                    if (window.opener) {
                        window.opener.postMessage({ type: 'NETSUITE_AUTH_SUCCESS' }, '*');
                    }
                    setTimeout(() => window.close(), 2000);
                </script>
            </body>
        </html>
        """
        return HTMLResponse(content=html_content)
    except Exception as e:
        logger.error(f"Error during OAuth callback exchange: {e}")
        return HTMLResponse(content=f"<html><body><h2>Authentication Error</h2><p>{str(e)}</p></body></html>", status_code=500)

@app.post("/models")
def models(body: FetchModelsRequest):
    try:
        model_list = ai_service.get_models(body.api_provider, body.api_key)
        return model_list
    except Exception as e:
        logger.error(f"Error in /models: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/use-model")
def use_model(body: UseModelRequest):
    model_name = body.model_name
    if not model_name:
        raise HTTPException(status_code=400, detail="Model name is required")

    cache.cache_set("selected_model", model_name)
    if body.api_provider:
        cache.cache_set("api_provider", body.api_provider)
    if body.api_key:
        cache.cache_set("api_key", body.api_key)
        
    return {"status": "success", "message": f"Active model set to {model_name}"}

@app.post("/chat")
def chat(body: ChatRequest):
    message = body.message
    selected_model = cache.cache_get("selected_model")
    api_provider = cache.cache_get("api_provider")
    api_key = cache.cache_get("api_key")

    if not selected_model or not api_provider or not api_key:
        raise HTTPException(
            status_code=400, 
            detail="AI model is not configured. Please configure API Provider, API Key, and Model in settings."
        )

    response = ai_service.chat(message, api_provider=api_provider, api_key=api_key, model_name=selected_model)
    return {"response": response}

@app.get("/get-config")
def get_config():
    """Return sanitized non-sensitive configuration parameters for the client UI."""
    selected_model = cache.cache_get("selected_model", "")
    api_provider = cache.cache_get("api_provider", "")
    netsuite_config = cache.cache_get("netsuite_config", {})
    has_api_key = bool(cache.cache_get("api_key"))
    
    return {
        "selected_model": selected_model,
        "api_provider": api_provider,
        "netsuite_account_id": netsuite_config.get("account_id", ""),
        "has_api_key": has_api_key
    }

