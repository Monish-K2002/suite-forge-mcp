import json
import logging
from typing import Any, Dict, List, Optional

from google import genai
from langchain_google_genai import GoogleGenerativeAI
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, MessagesState, StateGraph

from services.cache.cache import Cache

logger = logging.getLogger(__name__)


class AIService:
    def __init__(self, cache: Optional[Cache] = None):
        self.client = None
        self.llm = None
        self.api_key = None
        self.api_provider = None
        self.cache = cache
        self.human_contexts: Dict[str, str] = {}
        self.memory = MemorySaver()
        self.graph = None

    def _compile_graph(self) -> None:
        if self.llm is None:
            return

        builder = StateGraph(MessagesState)

        def call_model(state: MessagesState) -> Dict[str, List[AIMessage]]:
            response = self.llm.invoke(state["messages"])
            if isinstance(response, str):
                response = AIMessage(content=response)
            elif not isinstance(response, AIMessage):
                response = AIMessage(content=str(response))
            return {"messages": [response]}

        builder.add_node("model", call_model)
        builder.add_edge(START, "model")
        builder.add_edge("model", END)
        self.graph = builder.compile(checkpointer=self.memory)

    def _graph_config(self, session_id: str) -> Dict[str, Any]:
        return {
            "configurable": {
                "thread_id": session_id,
                "checkpoint_ns": "chat",
            }
        }

    def _has_history(self, config: Dict[str, Any]) -> bool:
        try:
            return self.memory.get(config) is not None
        except Exception:  # pragma: no cover
            return False

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

            if self.cache:
                self.cache.cache_set("models", llm_models)
            return llm_models
        return {"error": "Invalid API Provider"}

    def use_model(self, model_name: str):
        if self.api_provider == "google":
            self.llm = GoogleGenerativeAI(google_api_key=self.api_key, model=model_name)
            self._compile_graph()
            return
        return

    def set_human_context(self, context: str, session_id: Optional[str] = None) -> Optional[str]:
        session = session_id or "default"
        clean_context = (context or "").strip()
        if clean_context:
            self.human_contexts[session] = clean_context
            self.memory.delete_thread(session)
        else:
            self.human_contexts.pop(session, None)
            self.memory.delete_thread(session)
        return self.human_contexts.get(session)

    def get_human_context(self, session_id: Optional[str] = None) -> Optional[str]:
        session = session_id or "default"
        return self.human_contexts.get(session)

    def clear_human_context(self, session_id: Optional[str] = None) -> None:
        session = session_id or "default"
        self.human_contexts.pop(session, None)
        self.memory.delete_thread(session)

    def reset_session(self, session_id: Optional[str] = None) -> None:
        session = session_id or "default"
        self.human_contexts.pop(session, None)
        self.memory.delete_thread(session)

    def _build_system_prompt(self, session_id: str) -> str:
        context = self.human_contexts.get(session_id)
        instructions = [
            "You are Suite Forge's AI assistant helping users connect NetSuite and MCP.",
            "Respond clearly and concisely to the user's requests.",
        ]
        if context:
            instructions.append(f"Human context to keep in mind: {context}")
        return "\n".join(instructions)

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

        if self.graph is None:
            self._compile_graph()

        if self.graph is None:
            return "No AI model is configured. Please select a model before chatting."

        config = self._graph_config(session)
        has_history = self._has_history(config)

        input_messages: List[HumanMessage | SystemMessage] = []
        system_prompt = self._build_system_prompt(session)
        if system_prompt and not has_history:
            input_messages.append(SystemMessage(content=system_prompt))

        input_messages.append(HumanMessage(content=message))

        try:
            result = self.graph.invoke({"messages": input_messages}, config=config)
        except Exception as exc:  # pragma: no cover
            logger.exception("LLM invocation failed: %s", exc)
            return "I ran into an internal error while generating a response."

        messages = result.get("messages", [])
        final_message = messages[-1] if messages else AIMessage(content="")
        final_text = (
            final_message.content
            if isinstance(final_message, AIMessage)
            else str(final_message)
        )

        return final_text

    def get_api_details(self):
        return {
            "api_key": self.api_key,
            "api_provider": self.api_provider
        }
