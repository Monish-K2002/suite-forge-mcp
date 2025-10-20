from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from services.netsuite_auth import NetSuiteAuthService

app = FastAPI()

auth_service = NetSuiteAuthService()


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