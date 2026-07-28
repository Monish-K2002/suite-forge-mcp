import logging
from typing import List, Dict, Any, Optional
from google import genai
from langchain_google_genai import GoogleGenerativeAI, ChatGoogleGenerativeAI

logger = logging.getLogger(__name__)

class AIService:
    def __init__(self):
        pass
    
    def get_models(self, api_provider: str, api_key: str) -> List[Dict[str, str]]:
        if not api_key:
            raise ValueError("API Key is required to fetch models")
            
        if api_provider == "google":
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
        
        raise ValueError(f"Unsupported API Provider: '{api_provider}'")

    def create_llm_instance(self, api_provider: str, api_key: str, model_name: str):
        if not api_provider or not api_key or not model_name:
            raise ValueError("Provider, API Key, and Model Name are required to initialize LLM")
            
        if api_provider == "google":
            print(f"Creating Google LLM with model: {model_name}")
            return ChatGoogleGenerativeAI(api_key=api_key, model=model_name)
            
        raise ValueError(f"Unsupported API Provider: '{api_provider}'")

    def chat(self, message: str, api_provider: str, api_key: str, model_name: str) -> str:
        if not message or not message.strip():
            return "Please provide a non-empty message."
            
        try:
            llm = self.create_llm_instance(api_provider, api_key, model_name)
            response = llm.invoke(message)
            response_text = response.content[0].get('text') if hasattr(response, 'content') and len(response.content) > 0 else str(response)
            print(f"Response: {response_text}")
            return response_text
        except Exception as e:
            logger.error(f"Error in chat service: {e}")
            return f"AI Service Error: {str(e)}"
