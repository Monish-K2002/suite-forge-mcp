import logging
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from google import genai
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.messages import SystemMessage
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain.agents import create_agent
from langgraph.checkpoint.memory import InMemorySaver
from langchain_core.runnables import RunnableConfig
from services.db.database import DatabaseManager
import ast

logging.basicConfig(
    filename="ai.log",
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    filemode="a"
)
logger = logging.getLogger(__name__)

system_prompt = """
    You are a NetSuite Expert Solution provider. 
    You help users with their NetSuite related questions.
    Refer to Oracle Docs for Suitescript related queries.
    If the question is not related to netsuite then return that it is outside your scope.
"""



def is_tool_payload_str(text_str: str) -> bool:
    keywords = ['"method"', "'method'", '"success"', "'success'", '"error"', "'error'", '"params"', "'params'"]
    return any(kw in text_str for kw in keywords)

def extract_text_content(content: Any) -> str:
    """Normalize LangChain provider content into displayable text."""
    if content is None:
        return ""
    if isinstance(content, str):
        content_str = content.strip()
        if (content_str.startswith("[") and content_str.endswith("]")) or (content_str.startswith("{") and content_str.endswith("}")):
            try:
                parsed = ast.literal_eval(content_str)
                return extract_text_content(parsed)
            except Exception:
                pass
        return content

    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict):
                item_type = item.get("type", "")
                text_val = item.get("text")
                if item_type == "thinking" or "thinking" in item:
                    think_text = item.get("thinking") or text_val or item.get("content") or ""
                    if think_text:
                        parts.append(f"<think>{think_text}</think>")
                elif text_val is not None:
                    text_str = str(text_val)
                    if "method" in item or "success" in item or "error" in item or is_tool_payload_str(text_str):
                        parts.append(f"<think>Tool Payload: {text_str}</think>")
                    else:
                        parts.append(text_str)
                elif "method" in item or "success" in item or "error" in item:
                    parts.append(f"<think>Tool Payload: {str(item)}</think>")
                elif "content" in item and isinstance(item["content"], (str, list, dict)):
                    parts.append(extract_text_content(item["content"]))
                else:
                    parts.append(str(item))
            else:
                parts.append(extract_text_content(item))
        return "".join(parts)

    if isinstance(content, dict):
        item_type = content.get("type", "")
        text_val = content.get("text")
        if item_type == "thinking" or "thinking" in content:
            think_text = content.get("thinking") or text_val or content.get("content") or ""
            return f"<think>{think_text}</think>" if think_text else ""
        if "method" in content or "success" in content or "error" in content or (text_val and is_tool_payload_str(str(text_val))):
            return f"<think>Tool Payload: {text_val or str(content)}</think>"
        if text_val is not None:
            return str(text_val)
        if "content" in content:
            return extract_text_content(content["content"])

    return str(content)


def extract_message_text(message: Any) -> tuple:
    """Normalize provider message/chunk objects into text and token count tuple."""
    if hasattr(message, "content"):
        text = extract_text_content(message.content)
    else:
        text = extract_text_content(message)

    tokens = 0
    usage = None
    if hasattr(message, "usage_metadata") and message.usage_metadata:
        usage = message.usage_metadata
    elif isinstance(message, dict) and "usage_metadata" in message:
        usage = message.get("usage_metadata")

    if isinstance(usage, dict):
        tokens = usage.get("total_tokens", 0) or usage.get("output_tokens", 0) or 0

    return text, tokens


class BaseLLMProvider(ABC):
    """Abstract base class for LLM providers."""
    
    @abstractmethod
    def get_models(self, api_key: str) -> List[Dict[str, str]]:
        pass

    @abstractmethod
    def create_llm_instance(self, api_key: str, model_name: str) -> Any:
        pass


class GoogleLLMProvider(BaseLLMProvider):
    """Google Gemini LLM provider implementation."""

    def get_models(self, api_key: str) -> List[Dict[str, str]]:
        try:
            client = genai.Client(api_key=api_key)
            models = client.models.list()
            llm_models = [
                {
                    "name": "",
                    "displayName": "Select Model"
                }
            ]

            for m in models:
                supported = getattr(m, 'supported_actions', []) or getattr(m, 'supported_generation_methods', [])
                if any(x in supported for x in ["generateContent"]) and "gemini" in m.name.lower():
                    clean_name = m.name.replace("models/", "")
                    display = getattr(m, 'display_name', clean_name) or clean_name
                    llm_models.append({
                        "name": clean_name,
                        "displayName": display
                    })

            return llm_models
        except Exception as e:
            logger.error(f"Error fetching Google models: {e}")
            raise RuntimeError(f"Failed to fetch models from Google: {str(e)}")

    def create_llm_instance(self, api_key: str, model_name: str) -> Any:
        logger.info(f"Initializing Google Gemini LLM with model: {model_name}")
        return ChatGoogleGenerativeAI(api_key=api_key, model=model_name,include_thoughts=True)


class AIService:
    """Service layer managing multi-provider LLM integrations."""

    def __init__(self):
        self.db = DatabaseManager()
        self.tools: List[Any] = []
        self._providers: Dict[str, BaseLLMProvider] = {
            "google": GoogleLLMProvider()
        }
        self.llm = None
        self.agent = None
        self.session_id = None

    def register_provider(self, name: str, provider: BaseLLMProvider):
        """Register a new LLM provider."""
        self._providers[name.lower()] = provider
    
    def get_active_account_id(self) -> Optional[str]:
        """Get the active account ID from the database."""
        active_account = self.db.get_active_account()
        return active_account["account_id"] if active_account else None

    async def init_tools(self):
        if not MultiServerMCPClient:
            self.tools = []
            return

        active_account = self.db.get_active_account()
        if not active_account:
            self.tools = []
            return
        
        account_id = active_account.get("account_id", "")
        token = active_account.get("access_token", "")
        if not account_id:
            self.tools = []
            return

        try:
            client = MultiServerMCPClient(
                {
                    "netsuite": {
                        "transport": "http",
                        "url": f"https://{account_id}.suitetalk.api.netsuite.com/services/mcp/v1/all",
                        "headers": {
                            "Authorization": f"Bearer {token}"
                        }
                    }
                }
            )
            self.tools = await client.get_tools()
        except Exception as e:
            logger.error(f"Error initializing MCP tools: {e}")
            self.tools = []

    def _get_provider(self, api_provider: str) -> BaseLLMProvider:
        provider = self._providers.get(api_provider.lower())
        if not provider:
            supported = ", ".join(self._providers.keys())
            raise ValueError(f"Unsupported API Provider: '{api_provider}'. Supported providers: {supported}")
        return provider

    def get_models(self, api_provider: str, api_key: str) -> List[Dict[str, str]]:
        if not api_key or not api_key.strip():
            raise ValueError("API Key is required to fetch models")
        provider = self._get_provider(api_provider)
        return provider.get_models(api_key)

    def create_llm_instance(self, api_provider: str, api_key: str, model_name: str):
        if not api_provider or not api_key or not model_name:
            raise ValueError("Provider, API Key, and Model Name are required to initialize LLM")
        provider = self._get_provider(api_provider)
        self.llm = provider.create_llm_instance(api_key, model_name)

    def create_agent_instance(self):
        if not self.llm:
            raise ValueError("LLM instance is required to create agent")
        if not self.tools:
            self.tools = []
        self.agent = create_agent(model=self.llm, tools=self.tools, system_prompt=system_prompt, checkpointer=InMemorySaver())


    async def stream_chat(self, message: str, api_provider: str, api_key: str, model_name: str, session_id: str = None):
        if not message or not message.strip():
            yield "Please provide a non-empty message.", 0
            return

        try:
            if not self.tools:
                await self.init_tools()
        except Exception as e:
            logger.warning(f"Failed to initialize tools: {e}")

        try:
            logger.info(f"Session ID: {session_id}")
            if not self.session_id or self.session_id != session_id:
                self.session_id = session_id
            if not self.llm:
                self.create_llm_instance(api_provider, api_key, model_name)
            if not self.agent:
                self.create_agent_instance()
            config = {"configurable": {"thread_id": self.session_id}}
            if self.agent:
                async for event in self.agent.astream({"messages": [("user", message)]}, stream_mode="messages", config=config):
                    chunk, _ = event
                    text, total_tokens = extract_message_text(chunk)
                    if text or total_tokens:
                        yield text, total_tokens
            else:
                if hasattr(self.llm, 'astream'):
                    async for chunk in self.llm.astream(message):
                        text, total_tokens = extract_message_text(chunk)
                        if text or total_tokens:
                            yield text, total_tokens
                else:
                    for chunk in self.llm.stream(message):
                        text, total_tokens = extract_message_text(chunk)
                        if text or total_tokens:
                            yield text, total_tokens
            logger.debug(f"AI streaming completed successfully for model {model_name}")
        except Exception as e:
            logger.error(f"Error in stream_chat service: {e}")
            raise RuntimeError(f"AI Service Execution Error: {str(e)}")

    async def index_account(self):
        """Index the active account."""
        try:
            if not self.tools:
                await self.init_tools()
        except Exception as e:
            logger.warning(f"Failed to initialize tools: {e}")
        try:
            logger.info("Indexing account")
            # logger.info(f"Tools: {self.tools}")
            # logger.info(f"Tools type: {type(self.tools)}")
            tool = next(t for t in self.tools if t.name == "ns_getRecordTypeMetadata")
            logger.info(f"Tool: {tool}")
            logger.info(f"Tool args_schema: {tool.args_schema}")
            result = await tool.ainvoke({
                "recordType": "vendor"
            })
            logger.info(f"Result: {result}")
            # TODO: Implement account indexing logic
            return {"status": "success", "message": "Account indexed."}
        except Exception as e:
            logger.error(f"Error indexing account: {e}")
            raise RuntimeError(f"AI Service Execution Error: {str(e)}")


