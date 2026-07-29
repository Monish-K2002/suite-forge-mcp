import logging
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from google import genai
from langchain_google_genai import ChatGoogleGenerativeAI

logger = logging.getLogger(__name__)

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
        return ChatGoogleGenerativeAI(api_key=api_key, model=model_name)


class AIService:
    """Service layer managing multi-provider LLM integrations."""

    def __init__(self):
        self._providers: Dict[str, BaseLLMProvider] = {
            "google": GoogleLLMProvider()
        }

    def register_provider(self, name: str, provider: BaseLLMProvider):
        """Register a new LLM provider."""
        self._providers[name.lower()] = provider

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
            
            # Normalize LangChain output
            if hasattr(response, 'content'):
                content = response.content
                if isinstance(content, list) and len(content) > 0:
                    first_part = content[0]
                    if isinstance(first_part, dict):
                        response_text = first_part.get('text', str(first_part))
                    else:
                        response_text = str(first_part)
                else:
                    response_text = str(content)
            else:
                response_text = str(response)

            logger.debug(f"AI response generated successfully for model {model_name}")
            return response_text
        except Exception as e:
            logger.error(f"Error in chat service: {e}")
            raise RuntimeError(f"AI Service Execution Error: {str(e)}")

