# Suite Forge Future Implementation Plan

## Purpose

This plan captures the current architecture, the main refactoring pressure points, and a staged path for the next large features:

- Thinking state visibility
- RAG support
- Token efficiency improvements
- Multi-NetSuite account switching
- Ticketing portal and Teams integrations
- Collaboration support
- Final migration to an Electron native app

The project is already beyond a simple prototype. It now has a React/Vite client, FastAPI server, SQLite persistence, encrypted account/token storage, streaming chat, saved sessions, basic NetSuite OAuth PKCE, and a first pass at NetSuite MCP tool discovery. The next phase should focus on separating concerns before feature work multiplies the number of edge cases.

## Current System Snapshot

### Frontend

- `client/src/App.tsx` owns chat session state, selected history, and the `NetSuiteConnector` client.
- `client/src/components/Chatbot.tsx` renders the conversational workspace and streams responses through `onSendMessage`.
- `client/src/components/HistoryPanel.tsx` exposes saved sessions and prompt templates.
- `client/src/components/ConfigModal.tsx` handles NetSuite auth, AI provider configuration, and MCP tool inspection.
- `client/src/components/Navbar.tsx` displays NetSuite and AI configuration status.
- `client/src/components/NetSuiteConnector.tsx` is the central HTTP/SSE client wrapper.

### Backend

- `server/app/main.py` is the FastAPI composition root and currently contains routing, DTOs, persistence calls, auth service calls, and streaming response assembly.
- `server/services/db/database.py` stores accounts, encrypted tokens/secrets, settings, and messages in SQLite.
- `server/services/auth/netsuite_auth.py` handles OAuth PKCE URL generation, token exchange, token refresh, and direct MCP `tools/list`.
- `server/services/ai/ai.py` manages provider registration, Google Gemini initialization, LangChain response normalization, MCP tool loading, and streaming chat.
- `server/services/cache/cache.py` is a compatibility wrapper over `DatabaseManager`.

### Tests

- Existing tests cover service-layer behavior for AI, auth, database, and cache.
- Missing coverage: FastAPI routes, SSE event protocol, frontend connector behavior, account switching UX, OAuth callback behavior, and migration behavior.

## Primary Risks To Resolve First

1. `main.py` is doing too much. As new event types, RAG context, external ticketing actions, and collaboration state arrive, route handlers will become hard to debug.
2. AI streaming events are currently text-centric. Thinking state, tool calls, retrieval citations, and collaboration signals need a typed event protocol.
3. `AIService` has mutable `self.tools`, which can leak active-account state across concurrent requests.
4. SQLite is acceptable for local development, but collaboration and multi-user use will need stronger session/user/account isolation.
5. Secrets are encrypted at rest, but the app still lacks a first-class secret boundary, audit logging policy, and production key management story.
6. Frontend state is spread across components and browser events. This will get fragile when real-time collaboration, account switching, and native app windows are added.
7. The project currently behaves like a single-user local app. Future collaboration and ticketing integrations require user identity, permissions, and workspace scoping.

## Target Architecture

### Backend Layers

Use clear boundaries:

1. API routes
   - Validate request DTOs.
   - Call application services.
   - Convert service events into HTTP/SSE/WebSocket responses.

2. Application services
   - `ChatOrchestrator`
   - `AccountService`
   - `RagService`
   - `IntegrationService`
   - `CollaborationService`

3. Provider adapters
   - LLM providers: Google, OpenAI, Anthropic.
   - NetSuite adapters: OAuth, MCP, REST/SuiteQL.
   - Ticketing adapters: Jira, Linear, Zendesk, GitHub Issues, ServiceNow.
   - Communication adapters: Microsoft Teams, Slack.
   - Vector stores: local SQLite/FAISS initially, then pgvector/Qdrant/Chroma.

4. Persistence repositories
   - Accounts
   - Users/workspaces
   - Sessions/messages
   - Retrieval documents/chunks/embeddings
   - Integration connections
   - Audit logs

### Frontend Layers

1. API client
   - Keep `NetSuiteConnector`, but split it into domain clients:
     - `ChatApi`
     - `ConfigApi`
     - `AccountsApi`
     - `IntegrationsApi`
     - `RagApi`

2. App state
   - Introduce explicit stores/contexts for:
     - Active session
     - Active account
     - Configuration status
     - Streaming run state
     - Collaboration presence

3. UI components
   - Keep chat presentation separate from transport and orchestration state.
   - Add reusable event renderers for assistant text, thinking summaries, tool calls, citations, errors, and collaboration events.

## Typed Streaming Event Protocol

Before thinking state and RAG, formalize the stream payload shape.

Recommended event types:

```json
{ "type": "run_started", "run_id": "...", "session_id": "...", "account_id": "..." }
{ "type": "thinking", "summary": "Planning SuiteQL query", "stage": "planning" }
{ "type": "tool_started", "tool_call_id": "...", "tool_name": "...", "input_preview": "..." }
{ "type": "tool_finished", "tool_call_id": "...", "status": "ok", "output_preview": "..." }
{ "type": "retrieval_started", "query": "..." }
{ "type": "retrieval_finished", "citations": [] }
{ "type": "token", "token": "..." }
{ "type": "done", "response": "...", "usage": {}, "citations": [] }
{ "type": "error", "error": "...", "recoverable": true }
```

Do not expose private chain-of-thought. The UI should show concise, user-safe progress summaries such as "Looking up record schema", "Searching saved NetSuite notes", or "Calling SuiteQL tool".

## Phase 0: Immediate Refactoring And Debuggability

Status: started.

1. Centralize AI provider response normalization.
   - Completed in `server/services/ai/ai.py`.
   - This gives future text, tool, citation, and thinking-event parsing one named place to evolve.

2. Fix obvious client correctness issues.
   - Completed: `ConfigModal` MCP search now uses `trim()`.

3. Create route/service split.
   - Move account route logic into `AccountService`.
   - Move chat route logic into `ChatOrchestrator`.
   - Keep `main.py` as API wiring only.

4. Add request/run IDs.
   - Generate `run_id` per chat request.
   - Include `session_id`, `account_id`, `model`, and `run_id` in logs.
   - Add a simple structured logger helper.

5. Create backend route tests.
   - Test `/chat` error when model config is missing.
   - Test `/accounts/select` changes active account.
   - Test `/messages` persists and clears a session.
   - Test `/models` rejects unsupported providers.

## Phase 1: Account Isolation And Configuration Foundation

Goal: make multi-account support dependable before adding integrations.

1. Replace global active account assumptions.
   - Prefer explicit `account_id` on requests.
   - Keep "active account" as a UI convenience, not as hidden backend context.
   - Store messages with `account_id` and filter history by workspace/account.

2. Add workspace/user concepts.
   - Tables:
     - `workspaces`
     - `users`
     - `workspace_members`
     - `connections`
   - Accounts, model config, integrations, and sessions belong to a workspace.

3. Normalize settings.
   - Replace generic `settings` for sensitive or structured config with typed tables.
   - Keep key-value settings only for harmless UI preferences.

4. Token lifecycle.
   - Track token expiry if NetSuite provides it.
   - Refresh before tool calls.
   - Mark connection health in DB.
   - Surface connection errors in config UI.

5. Account switching UI.
   - Add account list and active account picker in `Navbar` or settings.
   - On switch, refresh tools, sessions, and status.
   - Avoid mixing messages from different accounts unless the user chooses an all-account view.

## Phase 2: Thinking State Support

Goal: show useful progress without revealing private reasoning.

1. Backend
   - Add typed stream events.
   - Emit progress summaries during:
     - request validation
     - retrieval
     - MCP tool discovery
     - tool execution
     - final answer synthesis
   - Wrap provider/tool calls in instrumentation helpers.

2. Frontend
   - Replace one boolean `isThinking` state with a `RunState`.
   - Render a compact activity timeline under the assistant avatar.
   - Keep old clients compatible with `token` and `done` events during migration.

3. Data model
   - Store run events in a `run_events` table for debugging.
   - Persist only safe summaries, not hidden reasoning.

## Phase 3: RAG Support

Goal: let the assistant retrieve durable knowledge from project docs, user uploads, tickets, Teams messages, NetSuite metadata, and historical conversations.

1. Ingestion
   - Add document source types:
     - uploaded files
     - pasted text
     - NetSuite schema/tool metadata
     - ticketing portal issues
     - Teams threads
     - conversation summaries
   - Store source metadata, version hash, permissions, and timestamps.

2. Chunking
   - Use source-aware chunkers:
     - markdown/text by headings
     - ticket threads by message/comment
     - NetSuite records by field groups
     - code/scripts by symbols

3. Embeddings
   - Start with local development vector store.
   - Choose a production store only after volume and deployment model are clear.
   - Store embedding model name and chunk checksum for reindexing.

4. Retrieval
   - Add hybrid search later:
     - keyword search for IDs, record names, ticket numbers
     - vector search for semantic questions
   - Return citations with source title, URL/deep link, and snippet.
   - Enforce workspace/user permissions before retrieval results enter the prompt.

5. Prompt assembly
   - Add a `ContextBuilder`.
   - Inputs:
     - active account
     - selected tools
     - retrieved chunks
     - conversation summary
     - latest messages
   - Outputs:
     - model messages
     - token estimate
     - citation map

## Phase 4: Token Efficiency

Goal: reduce cost, latency, and context overflow.

1. Conversation memory
   - Keep latest N messages verbatim.
   - Summarize older messages per session.
   - Store summaries by account/workspace.
   - Recompute summaries incrementally.

2. Tool metadata compression
   - Cache NetSuite MCP tool schemas.
   - Send only relevant tool descriptions to the model.
   - Use tool allowlists based on user intent.

3. Retrieval budgeting
   - Set a context budget by model.
   - Rank chunks by relevance, freshness, permission, and source type.
   - Deduplicate chunks by source and semantic overlap.

4. Prompt observability
   - Log token estimates and final usage per run.
   - Add debug UI panel for:
     - selected model
     - retrieved sources
     - selected tools
     - estimated prompt tokens
     - completion tokens

5. Model routing
   - Use smaller models for classification, summarization, and title generation.
   - Use stronger models for NetSuite actions, code generation, and final synthesis.

## Phase 5: Ticketing Portal And Teams Linking

Goal: connect assistant work to external operating systems.

1. Integration abstraction
   - Add `IntegrationProvider` interface:
     - `connect`
     - `refresh`
     - `search`
     - `get_item`
     - `create_item`
     - `update_item`
     - `link_item_to_session`

2. Ticketing support
   - Start with one provider behind the abstraction.
   - Suggested first candidates:
     - Jira for enterprise workflows
     - GitHub Issues for developer workflows
     - Zendesk/ServiceNow for support workflows
   - Normalize tickets into a shared shape:
     - id
     - title
     - status
     - assignee
     - priority
     - comments
     - external URL

3. Teams support
   - Connect via Microsoft Graph.
   - Support linking a chat session to a Teams thread/channel.
   - Allow posting summaries and action items.
   - Ingest Teams threads into RAG with permissions intact.

4. UI
   - Add integrations settings tab.
   - Add "link to ticket/thread" command in chat.
   - Show linked external items in session header/sidebar.

## Phase 6: Collaboration Support

Goal: multiple users can share a workspace, see shared context, and collaborate around NetSuite tasks.

1. Identity and permissions
   - Add user login before collaboration features.
   - Enforce workspace roles:
     - owner
     - admin
     - member
     - viewer

2. Real-time transport
   - Add WebSocket channel for:
     - presence
     - typing
     - shared run events
     - comments/reactions
     - session updates

3. Data model
   - Tables:
     - `runs`
     - `run_events`
     - `session_participants`
     - `session_links`
     - `comments`
     - `audit_logs`

4. Conflict model
   - Chat messages are append-only.
   - Config edits use last-write-wins initially with audit history.
   - Larger collaborative documents should use provider-native docs or CRDTs later.

5. Auditability
   - Log who triggered tool calls.
   - Log which NetSuite account was used.
   - Log external ticket/thread writes.
   - Redact secrets and sensitive payloads.

## Phase 7: Electron Native Application

Goal: package the mature web app as a desktop application after architecture stabilizes.

Do not start with Electron. Move after the backend/frontend contracts, local storage model, and integration boundaries are stable.

1. App shell
   - Use Electron main process for native shell, menus, tray, secure storage, and deep links.
   - Keep React renderer close to current Vite app.
   - Decide whether FastAPI runs as:
     - bundled local sidecar process, or
     - remote cloud API

2. Native storage and secrets
   - Use OS keychain for secrets.
   - Keep SQLite local only for single-user native data.
   - Sync shared/collaboration data through remote backend.

3. Desktop-specific features
   - Deep links from ticketing portals.
   - Native notifications for long-running NetSuite tasks.
   - File drop ingestion for RAG.
   - Auto-update.

4. Security
   - Disable Node integration in renderer.
   - Use preload bridge with strict IPC.
   - Validate every IPC payload.
   - Keep OAuth redirects and token exchange hardened.

## Suggested Refactoring Sequence

1. Create `server/app/routes/` modules.
2. Create `server/services/chat/orchestrator.py`.
3. Create `server/services/accounts/account_service.py`.
4. Create `server/services/streaming/events.py` for event DTOs.
5. Remove mutable per-request state from `AIService`.
6. Split frontend `NetSuiteConnector` into domain API modules.
7. Add typed frontend stream event handling.
8. Add explicit account selector and pass `account_id` through chat requests.
9. Add RAG tables and ingestion service.
10. Add integrations abstraction.
11. Add collaboration identity and WebSocket service.
12. Package with Electron only after steps 1-11 are stable.

## Debugging And Observability Checklist

- Every chat request has a `run_id`.
- Every log line for a run includes `run_id`, `session_id`, `account_id`, and model.
- SSE/WebSocket events are persisted for failed runs.
- Tool calls have start/end/error events.
- Retrieval results include citation IDs.
- Errors include a user-safe message and a developer diagnostic message.
- Secrets are never logged.
- Frontend stream parser is tested against partial chunks and error events.

## Near-Term Implementation Tickets

1. Split FastAPI routes from business logic.
2. Add typed stream events and frontend stream reducer.
3. Remove `AIService.tools` mutable shared state.
4. Add route-level tests for accounts, messages, models, and chat failure paths.
5. Add account picker UI and explicit `account_id` on chat requests.
6. Add run event persistence.
7. Add first RAG ingestion path for local markdown/text files.
8. Add conversation summarization and token budget accounting.
9. Add first external integration provider behind `IntegrationProvider`.
10. Add WebSocket channel for collaboration events.

