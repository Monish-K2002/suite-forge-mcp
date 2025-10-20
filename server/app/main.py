from uuid import NIL
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from services.auth.netsuite_auth import NetSuiteAuthService
from services.ai.ai import AIService
import secrets

app = FastAPI()

auth_service = NetSuiteAuthService()
ai_service = AIService()


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

@app.get("/")
def read_root():
    return {"success":"Server Running"}

@app.post("/auth")
async def auth(request: Request):
    body = await request.json()
    print("Body: ",body)

    config = {
        "client_id": body.get("client_id"),
        "account_id": body.get("account_id"),
    }
    print("Config: ",config)

    session_id = secrets.token_urlsafe(32)
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
    return "Callback"

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
    return "Model Used is: " + model_name

@app.post("/chat")
async def chat(request: Request):
    body = await request.json()
    # print("Body: ",body)
    message = body.get("message")
    response = ai_service.chat(message)
    return response

