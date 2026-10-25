# Suite Forge CLI

The CLI runs the same AI service, NetSuite MCP integration, and SQLite data store as the optional HTTP API. It does not need a running FastAPI server. Use one database path and encryption key across interfaces if you want them to share accounts, model settings, and chat history.

## Install

From `server/`, create/activate a Python 3.10+ virtual environment and install the project:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -e .
```

Set `DB_PATH` and `ENCRYPTION_KEY` as needed. They default to the existing local development behavior; production deployments should set the same secure values used by the server. The default database is `suite_forge.db` in the current working directory.

## Use

```powershell
suite-forge
```

Starting `suite-forge` opens the persistent interactive application. Its menu supports chat, API provider/key/model configuration, NetSuite OAuth account connection, account switching and deletion, and listing the active account's MCP tools. In chat, `/history`, `/sessions`, `/clear`, and `/quit` are available. Chat and model choices persist in SQLite.

Typer commands are also available individually for automation or quick actions:

```powershell
suite-forge --help
suite-forge configure-model
suite-forge accounts
suite-forge connect --port 8765
suite-forge select-account
suite-forge tools
suite-forge chat --session default
suite-forge delete-account
```

The OAuth connection opens the NetSuite authorization page in the default browser and listens on `http://localhost:8765/callback`. The callback port must be reachable locally and allowed in the NetSuite integration's redirect URI configuration. Use `--port` to choose another registered port.

Only the `google` provider is currently implemented. NetSuite tools are discovered for the active account and supplied to the AI agent automatically during chat.
