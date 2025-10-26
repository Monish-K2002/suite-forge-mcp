# from uuid import NIL
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from services.auth.netsuite_auth import NetSuiteAuthService
from services.ai.ai import AIService
from services.cache.cache import Cache
from services.netsuite_tools import NetSuiteToolService
import secrets
import json
from datetime import datetime

app = FastAPI()

auth_service = NetSuiteAuthService()
cache = Cache()
tool_service = NetSuiteToolService(cache)
ai_service = AIService(cache=cache, tool_service=tool_service)
session_id = secrets.token_urlsafe(32)

origins = [
    "http://localhost:5173",
    # you can add more origins if needed
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # or ["*"] to allow all origins (less secure)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],

    # auth_service.
)

@app.on_event("startup")
def startup():
    cache_content = cache._load_all()
    # print("Cache Content: ",cache_content)
    if datetime.now().timestamp() > cache.cache_get("token_expires_at"):
        print("Expired.")
    if cache_content.get("netsuite_config"):
        auth_service.config = cache_content.get("netsuite_config")
    if cache_content.get("netsuite_refresh_token"):
        auth_service.config["refresh_token"] = cache_content.get("netsuite_refresh_token")
    if cache_content.get("netsuite_access_token"):
        auth_service.config["access_token"] = cache_content.get("netsuite_access_token")
    # print("Auth Service Config: ",auth_service.config)
    if cache_content.get("api_provider"):
        ai_service.api_provider = cache_content.get("api_provider")
    if cache_content.get("api_key"):
        ai_service.api_key = cache_content.get("api_key")
    if cache_content.get("selected_model"):
        ai_service.use_model(cache_content.get("selected_model"))


@app.get("/")
def read_root():
    # print("Server Running")
    return {"success":"Server Running"}

@app.post("/auth")
async def auth(request: Request):
    body = await request.json()
    print("Body: ",body)

    config = {
        "client_id": body.get("client_id"),
        "account_id": body.get("account_id"),
    }
    # print("Config: ",config)
    cache.cache_set("netsuite_config", config)

    authURL = auth_service.get_authorization_url(session_id, config)

    print("Auth URL: ",authURL)
    return authURL

@app.get("/callback")
def callback(request: Request):
    params = request.query_params
    # print("Callback Body: ",params)
    code = params.get("code")
    state = params.get("state")
    # print("Code: ",code)
    # print("State: ",state)

    response = auth_service.exchange_code_for_tokens(code, session_id)
    # print("Callback Response: ",response)
    cache.cache_set("netsuite_access_token", response.get("access_token"))
    cache.cache_set("netsuite_refresh_token", response.get("refresh_token"))
    expires_at_ts = datetime.now().timestamp() + float(response.get("expires_in", 0))
    cache.cache_set("token_expires_at", expires_at_ts)

    payload = json.dumps({"status": "authenticated", "success": True})
    html_content = f"""
    <!DOCTYPE html>
    <html lang=\"en\">
    <head>
        <meta charset=\"utf-8\" />
        <title>NetSuite Authentication</title>
    </head>
    <body>
        <script>
            (function() {{
                const payload = {payload};
                if (window.opener) {{
                    window.opener.postMessage(payload, 'http://localhost:5173');
                }}
                window.close();
            }})();
        </script>
        <p>Authentication complete. You can close this window.</p>
    </body>
    </html>
    """

    return HTMLResponse(content=html_content)

@app.get("/models")
def models(request: Request):
    api_provider = request.query_params.get("api_provider")
    api_key = request.query_params.get("api_key")
    # print("API Provider: ",api_provider)
    models = ai_service.get_models(api_provider, api_key)
    return models
    
@app.post("/use-model")
async def use_model(request: Request):
    body = await request.json()
    # print("Body: ",body)
    model_name = body.get("model_name")
    ai_service.use_model(model_name)

    api_details = ai_service.get_api_details()
    cache.cache_set("selected_model", model_name)
    cache.cache_set("api_provider", api_details.get("api_provider"))
    cache.cache_set("api_key", api_details.get("api_key"))
    return "Model Used is: " + model_name

@app.post("/chat")
async def chat(request: Request):
    body = await request.json()
    message = body.get("message")
    session_id = body.get("session_id")
    human_context = body.get("human_context")
    reset_session = body.get("reset_session", False)
    clear_human_context = body.get("clear_human_context", False)

    if reset_session:
        ai_service.reset_session(session_id)

    if clear_human_context:
        ai_service.clear_human_context(session_id)

    response_text = ai_service.chat(
        message,
        session_id=session_id,
        human_context=human_context,
    )

    return {
        "response": response_text,
        "session_id": session_id or "default",
        "human_context": ai_service.get_human_context(session_id),
    }

@app.get("/get-cache")
def get_cache():
    cache_content = cache._load_all()
    if datetime.now().timestamp() > cache_content.get("token_expires_at"):
        cache_content["netsuite_authenticated"] = False
    else:
        cache_content["netsuite_authenticated"] = True
    return cache_content

@app.get("/get-specific-cache")
def get_specific_cache(request: Request):
    key = request.query_params.get("key")
    return cache.cache_get(key)

