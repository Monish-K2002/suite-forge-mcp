import json
import logging
import re
import os
from typing import Any, Dict, List, Optional, Union

from google import genai
from langchain_google_genai import GoogleGenerativeAI
from langchain_core.callbacks import CallbackManagerForToolRun
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_core.tools import BaseTool
from pydantic import Field

from services.cache.cache import Cache
from services.netsuite_tools import NetSuiteToolService

logger = logging.getLogger(__name__)
cache = Cache()


ConversationHistory = List[Union[HumanMessage, AIMessage]]


class NetSuiteLangChainTool(BaseTool):
    """LangChain tool wrapper that delegates execution to NetSuite."""

    tool_service: NetSuiteToolService
    tool_name: str
    description: str = ""
    args_schema: Dict[str, Any] = Field(default_factory=dict)

    def _run(
        self,
        tool_input: Union[str, Dict[str, Any]],
        run_manager: CallbackManagerForToolRun | None = None,
    ) -> str:
        if isinstance(tool_input, str):
            payload: Dict[str, Any] = {"input": tool_input}
        elif isinstance(tool_input, dict):
            payload = tool_input
        else:
            payload = dict(tool_input)

        result = self.tool_service.invoke_tool(self.tool_name, payload)
        if isinstance(result, (dict, list)):
            return json.dumps(result, ensure_ascii=False)
        return str(result)

    async def _arun(  # pragma: no cover - async NetSuite calls not yet supported
        self,
        tool_input: Union[str, Dict[str, Any]],
        run_manager: CallbackManagerForToolRun | None = None,
    ) -> str:
        raise NotImplementedError("Async NetSuite tool execution is not implemented.")


class AIService:
    def __init__(self, cache: Optional[Cache] = None, tool_service: Optional[NetSuiteToolService] = None):
        self.client = None
        self.llm = None
        self.api_key = None
        self.api_provider = None
        self.cache = cache
        self.conversations: Dict[str, ConversationHistory] = {}
        self.human_contexts: Dict[str, str] = {}
        self.tools: Dict[str, Dict[str, Any]] = {}
        self.tool_objects: Dict[str, BaseTool] = {}
        self.max_tool_iterations = 3
        self.max_history_messages = 20
        self.tool_service = tool_service or (NetSuiteToolService(cache) if cache else None)

    def _synchronize_tools(self) -> None:
        if not self.tool_service:
            self.tools = {}
            return

        try:
            fetched_tools = self.tool_service.list_tools()
        except Exception as exc:  # pragma: no cover
            logger.warning("Failed to fetch NetSuite tools: %s", exc)
            self.tools = {}
            return

        normalized: Dict[str, Dict[str, Any]] = {}
        tool_objects: Dict[str, BaseTool] = {}
        for tool in fetched_tools:
            if not isinstance(tool, dict):
                continue
            name = tool.get("name") or tool.get("tool_name")
            description = tool.get("description") or ""
            schema = tool.get("schema") or tool.get("args") or {}
            if not name or not isinstance(schema, dict):
                continue
            normalized[name] = {
                "description": description,
                "schema": schema,
            }
            tool_objects[name] = NetSuiteLangChainTool(
                name=name,
                description=description,
                args_schema=schema if isinstance(schema, dict) else {},
                tool_service=self.tool_service,
                tool_name=name,
            )
        self.tools = normalized
        self.tool_objects = tool_objects

    def get_models(self, api_provider: str, api_key: str):
        if api_provider == "google":
            self.api_key = api_key
            self.api_provider = api_provider
            self.client = genai.Client(api_key=api_key)
            models = self.client.models.list()
            llm_models = [
                {
                    "name": "",
                    "displayName": "Select Model"
                }
            ]

            for m in models:
                if (
                    any(x in m.supported_actions for x in ["generateContent"]) and
                    "gemini" in m.name.lower()
                ):
                    llm_models.append(
                        {
                            "name": m.name.replace("models/", ""),
                            "displayName": m.display_name
                        }
                    )

            cache.cache_set("models", llm_models)
            return llm_models
        return {"error": "Invalid API Provider"}

    def use_model(self, model_name: str):
        if self.api_provider == "google":
            self.llm = GoogleGenerativeAI(google_api_key=self.api_key, model=model_name)
            return
        return

    def set_human_context(self, context: str, session_id: Optional[str] = None) -> Optional[str]:
        session = session_id or "default"
        clean_context = (context or "").strip()
        if clean_context:
            self.human_contexts[session] = clean_context
        else:
            self.human_contexts.pop(session, None)
        return self.human_contexts.get(session)

    def get_human_context(self, session_id: Optional[str] = None) -> Optional[str]:
        session = session_id or "default"
        return self.human_contexts.get(session)

    def clear_human_context(self, session_id: Optional[str] = None) -> None:
        session = session_id or "default"
        self.human_contexts.pop(session, None)

    def reset_session(self, session_id: Optional[str] = None) -> None:
        session = session_id or "default"
        self.conversations.pop(session, None)
        if session_id is None:
            self.tools = {}

    def _build_system_prompt(self, session_id: str) -> str:
        context = self.human_contexts.get(session_id)
        tool_descriptions = []
        for name, meta in self.tools.items():
            args_description = ", ".join(f"{arg}: {arg_type}" for arg, arg_type in meta["schema"].items())
            tool_descriptions.append(f"- {name}({args_description}): {meta['description']}")

        instructions = [
            "You are Suite Forge's AI assistant helping users connect NetSuite and MCP.",
            "Leverage the available tools when they can help answer NetSuite-related requests.",
            "When tools are not needed, respond directly in natural language.",
        ]

        if context:
            instructions.append(f"Human context to keep in mind: {context}")

        if tool_descriptions:
            instructions.append("Available tools:\n" + "\n".join(tool_descriptions))
        else:
            instructions.append("No tools are available.")

        return "\n".join(instructions)

    def _invoke_tool_call(self, call: Dict[str, Any]) -> str:
        tool_name = call.get("name") or call.get("tool_name") or ""
        tool = self.tool_objects.get(tool_name)
        if not tool:
            return f"Tool '{tool_name}' is not available."

        try:
            result = tool.invoke(call)
        except Exception as exc:  # pragma: no cover
            logger.exception("NetSuite tool '%s' invocation failed", tool_name)
            return f"Tool '{tool_name}' failed: {exc}"

        if isinstance(result, (dict, list)):
            return json.dumps(result, ensure_ascii=False)
        return str(result)

    def _update_session_history(
        self,
        session_id: str,
        previous_history: ConversationHistory,
        human_message: HumanMessage,
        ai_response_text: str,
    ) -> None:
        updated_history = previous_history + [human_message, AIMessage(content=ai_response_text)]
        if len(updated_history) > self.max_history_messages:
            updated_history = updated_history[-self.max_history_messages :]
        self.conversations[session_id] = updated_history

    def chat(
        self,
        message: str,
        session_id: Optional[str] = None,
        human_context: Optional[str] = None,
    ) -> str:
        if not message:
            return "I need a message to respond to."

        if not self.llm:
            return "No AI model is configured. Please select a model before chatting."

        session = session_id or "default"

        if human_context is not None:
            self.set_human_context(human_context, session)

        self._synchronize_tools()

        history = self.conversations.get(session, [])

        conversation: List[Union[SystemMessage, HumanMessage, AIMessage]] = [
            SystemMessage(content=self._build_system_prompt(session))
        ]
        conversation.extend(history)
        user_message = HumanMessage(content=message)
        conversation.append(user_message)

        agent_messages = list(conversation)
        final_response: Optional[AIMessage] = None
        tool_iterations = 0
        llm_runner = (
            self.llm.bind_tools(list(self.tool_objects.values()))
            if self.tool_objects
            else self.llm
        )

        while tool_iterations <= self.max_tool_iterations:
            try:
                response = llm_runner.invoke(agent_messages)
            except Exception as exc:  # pragma: no cover
                logger.exception("LLM invocation failed: %s", exc)
                final_response = AIMessage(
                    content="I ran into an internal error while generating a response."
                )
                break

            if isinstance(response, str):
                response = AIMessage(content=response)
            elif not isinstance(response, AIMessage):
                response = AIMessage(content=str(response))

            agent_messages.append(response)

            tool_calls = getattr(response, "tool_calls", None) or []
            if tool_calls:
                tool_iterations += 1
                for call in tool_calls:
                    tool_result = self._invoke_tool_call(call)
                    tool_call_id = call.get("id") or call.get("tool_call_id")
                    agent_messages.append(
                        ToolMessage(
                            content=tool_result,
                            name=call.get("name"),
                            tool_call_id=tool_call_id,
                        )
                    )
                continue

            final_response = response
            break

        if final_response is None:
            final_text = "I could not complete that request."
        else:
            final_text = (
                final_response.content
                if isinstance(final_response.content, str)
                else str(final_response.content)
            )

        self._update_session_history(session, history, user_message, final_text)
        return final_text

    def get_api_details(self):
        return {
            "api_key": self.api_key,
            "api_provider": self.api_provider
        }
