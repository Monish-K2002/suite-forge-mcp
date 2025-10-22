from google import genai
from langchain_google_genai import GoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage


# Create a single client object
class AIService:
    def __init__(self):
        self.client = None
        self.llm = None
        self.api_key = None
        self.api_provider = None
    
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

            return llm_models
        return {"error": "Invalid API Provider"}

    def use_model(self, model_name: str):
        if self.api_provider == "google":
            self.llm = GoogleGenerativeAI(google_api_key=self.api_key,model=model_name)
            return
        return

    def chat(self, message: str):
        print("Message: ",message)
        if self.api_provider == "google":
            response = self.llm.invoke(message)
            print("LLM Response: ",response)
            return response

    def get_api_details(self):
        return {
            "api_key": self.api_key,
            "api_provider": self.api_provider
        }
