import os
import secrets
import logging
import json
from html import escape
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, Request, HTTPException, status
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool
from pydantic import BaseModel

from services.auth.netsuite_auth import NetSuiteAuthService
from services.ai.ai import AIService
from services.db.database import DatabaseManager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Suite Forge MCP API")

auth_service = NetSuiteAuthService()
ai_service = AIService()
db = DatabaseManager()

cors_origins_env = os.getenv("CORS_ORIGINS")
if cors_origins_env:
    origins = [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]
else:
    origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://localhost",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pending_auths: Dict[str, Dict[str, Any]] = {}

class AuthRequest(BaseModel):
    client_id: str
    account_id: str
    client_secret: Optional[str] = None

class SelectAccountRequest(BaseModel):
    account_id: str

class FetchModelsRequest(BaseModel):
    api_provider: str
    api_key: Optional[str] = None

class UseModelRequest(BaseModel):
    model_name: str
    api_provider: Optional[str] = None
    api_key: Optional[str] = None

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = "default"

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Suite Forge MCP API Running with SQLite Backend"}

# --- ACCOUNT MANAGEMENT ENDPOINTS ---

@app.post("/auth")
async def auth(body: AuthRequest):
    session_id = secrets.token_urlsafe(32)
    config = {
        "client_id": body.client_id,
        "account_id": body.account_id,
        "client_secret": body.client_secret
    }
    # Store temporary pending auth info in memory until callback authenticates successfully.
    # The account ID will NOT be saved to the DB until OAuth token exchange completes.
    pending_auths[session_id] = config

    auth_url = auth_service.get_authorization_url(session_id, config)

    return {"auth_url": auth_url, "session_id": session_id}

@app.get("/callback")
def callback(code: Optional[str] = None, state: Optional[str] = None, error: Optional[str] = None):
    if error:
        if state and state in pending_auths:
            pending_auths.pop(state, None)
        return HTMLResponse(content=f"<html><body><h2>Authentication Failed</h2><p>{escape(error)}</p></body></html>", status_code=400)
    
    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing required authorization parameters (code, state).")

    temp_auth = pending_auths.pop(state, None)

    try:
        tokens = auth_service.exchange_code_for_tokens(code, state)
        if temp_auth:
            # Save account to SQLite DB ONLY after successful authentication
            db.add_or_update_account(
                account_id=temp_auth["account_id"],
                client_id=temp_auth["client_id"],
                client_secret=temp_auth.get("client_secret"),
                access_token=tokens.get("access_token"),
                refresh_token=tokens.get("refresh_token"),
                set_active=True
            )
        else:
            active_acc = db.get_active_account()
            if active_acc:
                db.update_tokens(
                    account_id=active_acc["account_id"],
                    access_token=tokens.get("access_token"),
                    refresh_token=tokens.get("refresh_token")
                )
            else:
                db.cache_set("netsuite_tokens", tokens)

        allowed_origins_json = json.dumps(origins)
        html_content = f"""
        <html>
            <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
                <h2>NetSuite Authentication Successful!</h2>
                <p>You may close this window.</p>
                <script>
                    if (window.opener) {{
                        const allowedOrigins = {allowed_origins_json};
                        try {{
                            const openerOrigin = new URL(document.referrer).origin;
                            if (allowedOrigins.includes(openerOrigin)) {{
                                window.opener.postMessage({{ type: 'NETSUITE_AUTH_SUCCESS' }}, openerOrigin);
                            }}
                        }} catch (_) {{}}
                    }}
                    setTimeout(() => window.close(), 2000);
                </script>
            </body>
        </html>
        """
        return HTMLResponse(content=html_content)
    except Exception as e:
        logger.error(f"Error during OAuth callback exchange: {e}")
        return HTMLResponse(content=f"<html><body><h2>Authentication Error</h2><p>{escape(str(e))}</p></body></html>", status_code=500)

@app.get("/accounts")
def list_accounts():
    """Return all configured NetSuite accounts for easy switching."""
    accounts = db.list_accounts()
    active_account = db.get_active_account()
    return {
        "accounts": accounts,
        "active_account_id": active_account["account_id"] if active_account else None
    }

@app.post("/accounts/select")
def select_account(body: SelectAccountRequest):
    """Switch active NetSuite account."""
    acc = db.set_active_account(body.account_id)
    if not acc:
        raise HTTPException(status_code=404, detail=f"Account '{body.account_id}' not found.")
    return {"status": "success", "message": f"Active account switched to {body.account_id}", "account": acc}

@app.delete("/accounts/{account_id}")
def delete_account(account_id: str):
    """Delete a NetSuite account configuration."""
    deleted = db.delete_account(account_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Account '{account_id}' not found.")
    return {"status": "success", "message": f"Account '{account_id}' deleted."}

# --- MODEL & CONFIG ENDPOINTS ---

@app.post("/models")
def models(body: FetchModelsRequest):
    try:
        api_key = body.api_key or db.get_setting("api_key")
        model_list = ai_service.get_models(body.api_provider, api_key or "")
        return model_list
    except Exception as e:
        logger.error(f"Error in /models: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/use-model")
def use_model(body: UseModelRequest):
    model_name = body.model_name
    if not model_name:
        raise HTTPException(status_code=400, detail="Model name is required")

    db.set_setting("selected_model", model_name)
    if body.api_provider:
        db.set_setting("api_provider", body.api_provider)
    if body.api_key:
        db.set_setting("api_key", body.api_key)
        
    return {"status": "success", "message": f"Active model set to {model_name}"}

@app.get("/get-config")
def get_config():
    """Return sanitized non-sensitive configuration parameters for the client UI."""
    selected_model = db.get_setting("selected_model", "")
    api_provider = db.get_setting("api_provider", "")
    active_account = db.get_active_account()
    client_id = active_account["client_id"] if active_account else ""
    has_api_key = bool(db.get_setting("api_key"))
    
    return {
        "selected_model": selected_model,
        "api_provider": api_provider,
        "netsuite_account_id": active_account["account_id"] if active_account else "",
        "has_api_key": has_api_key,
        "client_id": client_id,
    }

# --- CHAT & MESSAGES ENDPOINTS ---

@app.post("/chat")
def chat(body: ChatRequest):
    message = body.message
    session_id = body.session_id or "default"
    selected_model = db.get_setting("selected_model")
    api_provider = db.get_setting("api_provider")
    api_key = db.get_setting("api_key")

    if not selected_model or not api_provider or not api_key:
        raise HTTPException(
            status_code=400, 
            detail="AI model is not configured. Please configure API Provider, API Key, and Model in settings."
        )

    active_account = db.get_active_account()
    account_id = active_account["account_id"] if active_account else None

    # Save user message to SQLite DB
    user_msg = db.save_message(
        sender="user",
        content=message,
        model_used=selected_model,
        account_id=account_id,
        session_id=session_id
    )

    async def event_generator():
        full_response = ""
        total_tokens = 0
        response_saved = False
        try:
            async for token, tokens in ai_service.stream_chat(message, api_provider=api_provider, api_key=api_key, model_name=selected_model, session_id=session_id):
                full_response += token
                total_tokens += tokens
                payload = json.dumps({"type": "token", "token": token, "total_tokens": total_tokens})
                yield f"data: {payload}\n\n"

            # Save AI response to SQLite DB upon completion
            ai_msg = await run_in_threadpool(db.save_message,
                sender="ai",
                content=full_response,
                model_used=selected_model,
                account_id=account_id,
                session_id=session_id
            )
            response_saved = True

            done_payload = json.dumps({
                "type": "done",
                "response": full_response,
                "user_message": user_msg,
                "ai_message": ai_msg,
                "total_tokens": total_tokens
            })
            yield f"data: {done_payload}\n\n"
        except Exception as e:
            logger.error(f"Error handling /chat streaming request: {e}")
            if not response_saved:
                await run_in_threadpool(db.delete_message, user_msg["id"])
            err_payload = json.dumps({"type": "error", "error": str(e)})
            yield f"data: {err_payload}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.get("/sessions")
def get_sessions(account_id: Optional[str] = None):
    """Retrieve list of active chat sessions from SQLite database."""
    if account_id is None:
        active_account = db.get_active_account()
        account_id = active_account["account_id"] if active_account else None
    sessions = db.get_sessions(account_id=account_id)
    return {"sessions": sessions}

@app.get("/messages")
def get_messages(session_id: str = "default", limit: int = 100, account_id: Optional[str] = None):
    """Retrieve chat message history from SQLite database."""
    if account_id is None:
        active_account = db.get_active_account()
        account_id = active_account["account_id"] if active_account else None
    messages = db.get_messages(session_id=session_id, limit=limit, account_id=account_id)
    return {"messages": messages}


@app.delete("/messages")
def clear_messages(session_id: str = "default", account_id: Optional[str] = None):
    """Clear message history for a session."""
    if account_id is None:
        active_account = db.get_active_account()
        account_id = active_account["account_id"] if active_account else None
    db.clear_messages(session_id=session_id, account_id=account_id)
    return {"status": "success", "message": "Message history cleared."}

@app.delete("/account")
def delete_account(account_id: str):
    """Delete the active account."""
    if not db.delete_account(account_id=account_id):
        raise HTTPException(status_code=404, detail=f"Account '{account_id}' not found.")
    return {"status": "success", "message": "Account deleted."}

@app.get("/get-tools-list")
def get_tools_list():
    """Return the list of available tools for the client UI."""
    active_account = db.get_active_account()
    if not active_account or not active_account.get("access_token"):
        return {"tools": []}

    token_config = {
        "access_token": active_account["access_token"],
        "refresh_token": active_account.get("refresh_token")
    }
    config = {
        "account_id": active_account["account_id"],
        "client_id": active_account["client_id"]
    }

    try:
        tools = auth_service.get_tools(token_config, config)
        # Update tokens in database if refreshed
        db.update_tokens(
            account_id=active_account["account_id"],
            access_token=token_config["access_token"],
            refresh_token=token_config.get("refresh_token")
        )
        return {"tools": tools}
    except Exception as e:
        logger.error(f"Error fetching tools list: {e}")
        return {"tools": []}

@app.get("/index-account")
async def index_account():
    """Index the active account."""
    active_account = db.get_active_account()
    if not active_account or not active_account.get("access_token"):
        return {"status": "error", "message": "No active account found."}
    
    token_config = {
        "access_token": active_account["access_token"],
        "refresh_token": active_account.get("refresh_token")
    }
    config = {
        "account_id": active_account["account_id"],
        "client_id": active_account["client_id"]
    }
    
    try:
        result = await ai_service.index_account()
        # Update tokens in database if refreshed
        db.update_tokens(
            account_id=active_account["account_id"],
            access_token=token_config["access_token"],
            refresh_token=token_config.get("refresh_token")
        )
        return {"status": "success", "message": "Account metadata retrieved. Persistent indexing is not implemented yet.", "result": result}
    except Exception as e:
        logger.error(f"Error indexing account: {e}")
        return {"status": "error", "message": str(e)}

