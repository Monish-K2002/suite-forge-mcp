import logging
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from google import genai
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.messages import SystemMessage
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain.agents import create_agent
from services.db.database import DatabaseManager

logging.basicConfig(
    filename="ai.log",
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    filemode="a"
)
logger = logging.getLogger(__name__)

sys_message = SystemMessage(
    """
    You are a helpful NetSuite Assistant. You help users with their NetSuite tasks.
    """
)


def extract_text_content(content: Any) -> str:
    """Normalize LangChain provider content into displayable text."""
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict):
                item_type = item.get("type", "")
                if item_type == "thinking" or "thinking" in item:
                    think_text = item.get("thinking") or item.get("text") or item.get("content") or ""
                    if think_text:
                        parts.append(f"<think>{think_text}</think>")
                else:
                    text_val = item.get("text")
                    if text_val is not None:
                        parts.append(str(text_val))
                    else:
                        parts.append(str(item))
            else:
                parts.append(str(item))
        return "".join(parts)
    return str(content)



def extract_message_text(message: Any) -> str:
    """Normalize provider message/chunk objects into text."""
    if hasattr(message, "content"):
        return extract_text_content(message.content)
    return extract_text_content(message)


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
        return provider.create_llm_instance(api_key, model_name)

    def chat(self, message: str, api_provider: str, api_key: str, model_name: str) -> str:
        if not message or not message.strip():
            return "Please provide a non-empty message."
            
        try:
            llm = self.create_llm_instance(api_provider, api_key, model_name)
            response = llm.invoke(message)
            response_text = extract_message_text(response)

            logger.debug(f"AI response generated successfully for model {model_name}")
            return response_text
        except Exception as e:
            logger.error(f"Error in chat service: {e}")
            raise RuntimeError(f"AI Service Execution Error: {str(e)}")

    async def stream_chat(self, message: str, api_provider: str, api_key: str, model_name: str):
        if not message or not message.strip():
            yield "Please provide a non-empty message."
            return

        try:
            await self.init_tools()
        except Exception as e:
            logger.warning(f"Failed to initialize tools: {e}")

        try:
            llm = self.create_llm_instance(api_provider, api_key, model_name)
            system_prompt = """
            You are a NetSuite Expert Solution provider. 
            You help users with their NetSuite related questions.
            Refer to Oracle Docs for Suitescript related queries.
            """
            if create_agent:
                if getattr(self, 'tools', None):
                    agent = create_agent(model=llm, tools=self.tools, system_prompt=system_prompt)
                else:
                    agent = create_agent(model=llm, system_prompt=system_prompt)
                async for event in agent.astream({"messages": [("user", message)]}, stream_mode="messages"):
                    chunk, _ = event
                    # print("chunk:", chunk)
                    logger.info(f"chunk: {chunk}")
                    text = extract_message_text(chunk)
                    # print("text:", text)
                    if text:
                        yield text
            else:
                if hasattr(llm, 'astream'):
                    async for chunk in llm.astream(message):
                        text = extract_message_text(chunk)
                        if text:
                            yield text
                else:
                    for chunk in llm.stream(message):
                        text = extract_message_text(chunk)
                        if text:
                                yield text
            logger.debug(f"AI streaming completed successfully for model {model_name}")
        except Exception as e:
            logger.error(f"Error in stream_chat service: {e}")
            raise RuntimeError(f"AI Service Execution Error: {str(e)}")


