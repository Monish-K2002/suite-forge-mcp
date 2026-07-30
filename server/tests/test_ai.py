import unittest
from unittest.mock import MagicMock, patch
from services.ai.ai import AIService, GoogleLLMProvider, BaseLLMProvider

class TestAIService(unittest.TestCase):
    def setUp(self):
        self.ai_service = AIService()

    def test_unsupported_provider(self):
        with self.assertRaises(ValueError) as ctx:
            self.ai_service.get_models("unsupported_provider", "dummy_key")
        self.assertIn("Unsupported API Provider", str(ctx.exception))

    def test_missing_api_key(self):
        with self.assertRaises(ValueError) as ctx:
            self.ai_service.get_models("google", "")
        self.assertIn("API Key is required", str(ctx.exception))

    def test_register_custom_provider(self):
        class DummyProvider(BaseLLMProvider):
            def get_models(self, api_key: str):
                return [{"name": "dummy-model", "displayName": "Dummy Model"}]
            def create_llm_instance(self, api_key: str, model_name: str):
                mock_llm = MagicMock()
                mock_llm.invoke.return_value = MagicMock(content="Hello from dummy")
                return mock_llm

        self.ai_service.register_provider("dummy", DummyProvider())
        models = self.ai_service.get_models("dummy", "test-key")
        self.assertEqual(len(models), 1)
        self.assertEqual(models[0]["name"], "dummy-model")

        res = self.ai_service.chat("test prompt", "dummy", "test-key", "dummy-model")
        self.assertEqual(res, "Hello from dummy")

    def test_stream_chat(self):
        import asyncio

        class StreamingDummyProvider(BaseLLMProvider):
            def get_models(self, api_key: str):
                return []
            def create_llm_instance(self, api_key: str, model_name: str):
                mock_llm = MagicMock(spec=[])
                mock_llm.stream.return_value = [
                    MagicMock(content="Hello "),
                    MagicMock(content="streaming "),
                    MagicMock(content="world!")
                ]
                return mock_llm

        async def collect_chunks():
            chunks = []
            async for chunk in self.ai_service.stream_chat("test prompt", "dummy_stream", "test-key", "dummy-model"):
                chunks.append(chunk)
            return "".join(chunks)

        self.ai_service.register_provider("dummy_stream", StreamingDummyProvider())
        result = asyncio.run(collect_chunks())
        self.assertEqual(result, "Hello streaming world!")

if __name__ == "__main__":
    unittest.main()
