# Suite Forge MCP

## Overview
Suite Forge MCP is a full-stack prototype that mixes a FastAPI backend with a React (Vite + TypeScript) frontend to experiment with connecting NetSuite to intelligent agents. The project exposes a conversational interface that proxies user messages to a NetSuite-aware connector and provides scaffolding for OAuth PKCE authentication with NetSuite REST APIs.

## Features
- **Conversational UI** – `client/src/components/Chatbot.tsx` offers a chat-first workspace with history toggles and dark-mode support via `client/src/contexts/DarkModeContext.tsx`.
- **Configuration Modal** – `client/src/components/ConfigModal.tsx` and `Navbar.tsx` expose UI placeholders for NetSuite credentials and AI provider selection.
- **NetSuite Connector Stub** – `client/src/components/NetSuiteConnector.tsx` centralizes calls to a NetSuite-facing API for chat and data retrieval.
- **FastAPI Service** – `server/app/main.py` stands up a CORS-enabled API and wires in the PKCE-based `NetSuiteAuthService` defined in `server/services/netsuite_auth.py`.

## Project Structure
```
.
├── client/
│   ├── package.json
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   └── contexts/
│   └── README.md (Vite template)
├── server/
│   ├── app/main.py
│   └── services/netsuite_auth.py
└── .env
```

## Prerequisites
- Node.js 20+ (for the Vite frontend)
- npm 10+
- Python 3.10+ (for the FastAPI backend)

## Environment Variables
Create environment files before running the stack:

- `client/.env`
  ```env
  VITE_NETSUITE_API_ENDPOINT=http://localhost:8000
  VITE_NETSUITE_API_KEY=replace_with_token
  ```
- `server/.env` *(optional)* – populate with NetSuite OAuth details or use another secrets manager. The backend service currently expects configuration to be provided by the caller of `NetSuiteAuthService`.

## Installation

### Client
1. `cd client`
2. `npm install`

### Server
1. `cd server`
2. Create and activate a virtual environment (recommended).
3. Install dependencies:
   ```bash
   pip install fastapi uvicorn[standard] requests python-dotenv
   ```

## Running Locally

### Start the FastAPI backend
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
uvicorn app.main:app --host localhost --port 8000 --reload  # for local development
```

### Start the Vite frontend
```bash
npm run dev -- --host
```
By default Vite serves on `http://localhost:5173`, which is already whitelisted for CORS in the backend.

## Development Notes
- The PKCE challenge flow in `NetSuiteAuthService` maintains state in memory. Replace with a persistent store in production.
- `ConfigModal` includes hooks for triggering NetSuite authentication via the backend (see `handleNetsuiteAuth`). Wire this to a proper endpoint once implemented.
- Tailwind CSS and dark mode classes are applied globally; ensure `client/src/index.css` and `client/src/App.css` include any theme changes.

## Next Steps
- Flesh out backend endpoints for `/chat`, `/data`, and OAuth callbacks.
- Persist conversation history and NetSuite session state.
- Add automated tests and CI workflows.
