"""Standalone terminal client for Suite Forge's AI and NetSuite services."""

from __future__ import annotations

import asyncio
import getpass
import logging
import secrets
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse

import typer


app = typer.Typer(
    name="suite-forge",
    help="Suite Forge AI chat and NetSuite MCP tools.",
    add_completion=False,
    no_args_is_help=False,
)
_cli: SuiteForgeCLI | None = None


class SuiteForgeCLI:
    def __init__(self, db=None):
        # Keep --help usable before optional AI/MCP dependencies are imported.
        from services.ai.ai import AIService
        from services.auth.netsuite_auth import NetSuiteAuthService
        from services.db.database import DatabaseManager

        self.db = db or DatabaseManager()
        self.ai = AIService()
        self.ai.db = self.db
        self.auth = NetSuiteAuthService()

    def _active_account_id(self) -> str | None:
        account = self.db.get_active_account()
        return account["account_id"] if account else None

    def configure_model(self) -> None:
        provider = input("API provider [google]: ").strip().lower() or "google"
        api_key = getpass.getpass("Provider API key (leave blank to use saved key): ").strip()
        api_key = api_key or self.db.get_setting("api_key", "")
        if not api_key:
            raise ValueError("An API key is required.")
        models = self.ai.get_models(provider, api_key)
        available = [model for model in models if model.get("name")]
        if not available:
            raise RuntimeError("The provider returned no selectable models.")
        for index, model in enumerate(available, 1):
            print(f"{index}. {model.get('displayName') or model['name']} ({model['name']})")
        selected = input("Model number or name: ").strip()
        if selected.isdigit() and 1 <= int(selected) <= len(available):
            model_name = available[int(selected) - 1]["name"]
        else:
            model_name = selected
            if model_name not in {item["name"] for item in available}:
                raise ValueError("Choose a model from the list.")
        self.db.set_setting("api_provider", provider)
        self.db.set_setting("api_key", api_key)
        self.db.set_setting("selected_model", model_name)
        print(f"Active model: {model_name} ({provider})")

    def list_accounts(self) -> None:
        accounts = self.db.list_accounts()
        active_id = self._active_account_id()
        if not accounts:
            print("No NetSuite accounts configured. Choose Accounts > Add account to connect.")
            return
        for account in accounts:
            marker = " *" if account["account_id"] == active_id else ""
            print(f"{account['account_id']}{marker}  client: {account.get('client_id', '')}")

    def select_account(self) -> None:
        self.list_accounts()
        account_id = input("Account ID to activate: ").strip()
        account = self.db.set_active_account(account_id)
        if not account:
            raise ValueError(f"Account '{account_id}' was not found.")
        print(f"Active NetSuite account: {account_id}")

    def delete_account(self) -> None:
        self.list_accounts()
        account_id = input("Account ID to delete: ").strip()
        if not account_id:
            raise ValueError("Account ID is required.")
        if input(f"Delete {account_id}? [y/N]: ").strip().lower() != "y":
            print("Cancelled.")
            return
        if not self.db.delete_account(account_id):
            raise ValueError(f"Account '{account_id}' was not found.")
        print(f"Deleted NetSuite account {account_id}.")

    def add_account(self, port: int = 8765) -> None:
        account_id = input("NetSuite account ID: ").strip()
        client_id = input("NetSuite integration client ID: ").strip()
        client_secret = getpass.getpass("Client secret (optional): ").strip() or None
        if not account_id or not client_id:
            raise ValueError("Account ID and client ID are required.")
        redirect_uri = f"http://localhost:{port}/callback"
        session_id = secrets.token_urlsafe(32)
        config = {"account_id": account_id, "client_id": client_id,
                  "client_secret": client_secret, "redirect_uri": redirect_uri}
        auth_url = self.auth.get_authorization_url(session_id, config)
        result: dict = {}
        completed = threading.Event()
        auth_service = self.auth
        db = self.db

        class CallbackHandler(BaseHTTPRequestHandler):
            def do_GET(self):
                query = parse_qs(urlparse(self.path).query)
                state = query.get("state", [""])[0]
                code = query.get("code", [""])[0]
                error = query.get("error", [""])[0]
                try:
                    if error:
                        raise RuntimeError(error)
                    if state != session_id or not code:
                        raise ValueError("OAuth callback state or authorization code is missing or invalid.")
                    tokens = auth_service.exchange_code_for_tokens(code, state)
                    db.add_or_update_account(
                        account_id=account_id,
                        client_id=client_id,
                        client_secret=client_secret,
                        access_token=tokens.get("access_token"),
                        refresh_token=tokens.get("refresh_token"),
                        set_active=True,
                    )
                    result["ok"] = True
                    message = "NetSuite authorization succeeded. You can close this tab."
                    status_code = 200
                except Exception as exc:
                    result["error"] = str(exc)
                    message = "NetSuite authorization failed. Return to the CLI for details."
                    status_code = 400
                body = f"<!doctype html><title>Suite Forge</title><p>{message}</p>".encode()
                self.send_response(status_code)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                completed.set()

            def log_message(self, _format, *_args):
                return

        try:
            server = HTTPServer(("localhost", port), CallbackHandler)
        except OSError as exc:
            raise RuntimeError(f"Cannot listen for the OAuth callback on port {port}: {exc}") from exc
        server.timeout = 0.5
        print(f"Opening NetSuite authorization in your browser: {auth_url}")
        webbrowser.open(auth_url)
        print(f"Waiting for OAuth callback at {redirect_uri} (Ctrl+C to cancel)...")
        try:
            while not completed.is_set():
                server.handle_request()
        except KeyboardInterrupt:
            self.auth.pkce_store.pop(session_id, None)
            raise
        finally:
            server.server_close()
        if result.get("error"):
            raise RuntimeError(result["error"])
        print(f"NetSuite account {account_id} connected and selected.")

    def show_tools(self) -> None:
        account = self.db.get_active_account()
        if not account or not account.get("access_token"):
            print("Connect and select a NetSuite account to load its tools.")
            return
        token_config = {"access_token": account["access_token"], "refresh_token": account.get("refresh_token")}
        tools = self.auth.get_tools(
            token_config,
            {"account_id": account["account_id"], "client_id": account["client_id"]},
        )
        self.db.update_tokens(account_id=account["account_id"],
                              access_token=token_config.get("access_token"),
                              refresh_token=token_config.get("refresh_token"))
        for tool in tools:
            print(f"- {tool.get('name', '(unnamed)')}: {tool.get('description', '')}")
        if not tools:
            print("No tools were returned for this account.")

    async def chat(self, session_id: str = "default") -> None:
        provider = self.db.get_setting("api_provider")
        api_key = self.db.get_setting("api_key")
        model = self.db.get_setting("selected_model")
        if not provider or not api_key or not model:
            raise RuntimeError("Configure an API provider, key, and model first (menu option 'Model').")
        account_id = self._active_account_id()
        history = self.db.get_messages(session_id=session_id, account_id=account_id)
        if history:
            print(f"Loaded {len(history)} saved messages from session '{session_id}'.")
        print(f"Suite Forge chat | model {model} | account {account_id or 'not connected'}")
        print("Enter /help for commands; /quit exits.")
        while True:
            try:
                message = input("\nYou: ").strip()
            except (EOFError, KeyboardInterrupt):
                print()
                return
            if not message:
                continue
            if message in {"/quit", "/exit"}:
                return
            if message == "/help":
                print("/sessions lists recent conversations | /history shows this chat | /clear clears this chat | /quit exits")
                continue
            if message == "/sessions":
                for row in self.db.get_sessions(account_id=account_id):
                    print(f"{row['id']}  {row['timestamp']}  ({row['messageCount']} messages)  {row['title']}")
                continue
            if message == "/history":
                for row in self.db.get_messages(session_id=session_id, account_id=account_id):
                    print(f"{row['sender']}: {row['content']}")
                continue
            if message == "/clear":
                self.db.clear_messages(session_id=session_id, account_id=account_id)
                print("Conversation cleared.")
                continue
            user_record = self.db.save_message(sender="user", content=message, model_used=model,
                                               account_id=account_id, session_id=session_id)
            print("\nSuite Forge: ", end="", flush=True)
            response_parts: list[str] = []
            try:
                async for token, _ in self.ai.stream_chat(message, provider, api_key, model, session_id):
                    if token:
                        print(token, end="", flush=True)
                        response_parts.append(token)
                print()
                response = "".join(response_parts)
                self.db.save_message(sender="ai", content=response, model_used=model,
                                     account_id=account_id, session_id=session_id)
            except Exception:
                self.db.delete_message(user_record["id"])
                raise

    def interactive(self) -> None:
        while True:
            print("\nSuite Forge CLI")
            print("1. Chat   2. Model/API   3. Connect account   4. Select account")
            print("5. List accounts   6. List tools   7. Delete account   8. Quit")
            choice = input("> ").strip().lower()
            try:
                if choice in {"1", "chat", "c"}:
                    asyncio.run(self.chat())
                elif choice in {"2", "model", "api"}:
                    self.configure_model()
                elif choice in {"3", "connect", "account add"}:
                    self.add_account()
                elif choice in {"4", "select"}:
                    self.select_account()
                elif choice in {"5", "accounts"}:
                    self.list_accounts()
                elif choice in {"6", "tools"}:
                    self.show_tools()
                elif choice in {"7", "delete"}:
                    self.delete_account()
                elif choice in {"8", "q", "quit", "exit"}:
                    return
                else:
                    print("Choose an option from 1 to 8.")
            except Exception as exc:
                print(f"Error: {exc}", file=sys.stderr)


def get_cli() -> SuiteForgeCLI:
    global _cli
    if _cli is None:
        logging.basicConfig(level=logging.WARNING)
        _cli = SuiteForgeCLI()
    return _cli


def run_action(action) -> None:
    try:
        action()
    except (KeyboardInterrupt, EOFError):
        typer.echo("\nGoodbye.")
        raise typer.Exit(code=130)
    except Exception as exc:
        typer.echo(f"Error: {exc}", err=True)
        raise typer.Exit(code=1) from exc


@app.callback(invoke_without_command=True)
def launch(ctx: typer.Context) -> None:
    """Open the interactive Suite Forge application when no command is given."""
    if ctx.invoked_subcommand is None:
        run_action(get_cli().interactive)


@app.command()
def chat(
    session: str = typer.Option("default", "--session", help="Chat session ID."),
) -> None:
    """Start a chat session."""
    run_action(lambda: asyncio.run(get_cli().chat(session)))


@app.command("configure-model")
def configure_model() -> None:
    """Choose the API provider, key, and model."""
    run_action(get_cli().configure_model)


@app.command()
def accounts() -> None:
    """List configured NetSuite accounts."""
    run_action(get_cli().list_accounts)


@app.command("select-account")
def select_account() -> None:
    """Switch the active NetSuite account."""
    run_action(get_cli().select_account)


@app.command()
def connect(
    port: int = typer.Option(8765, "--port", min=1, max=65535, help="Local OAuth callback port."),
) -> None:
    """Connect a NetSuite account through OAuth."""
    run_action(lambda: get_cli().add_account(port))


@app.command()
def tools() -> None:
    """List MCP tools available to the active NetSuite account."""
    run_action(get_cli().show_tools)


@app.command("delete-account")
def delete_account() -> None:
    """Delete a configured NetSuite account."""
    run_action(get_cli().delete_account)


def main() -> None:
    app()


if __name__ == "__main__":
    main()
