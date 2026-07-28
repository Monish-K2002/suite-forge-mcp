import unittest
from services.auth.netsuite_auth import NetSuiteAuthService

class TestNetSuiteAuthService(unittest.TestCase):
    def setUp(self):
        self.auth_service = NetSuiteAuthService()

    def test_pkce_generation(self):
        pkce = self.auth_service.generate_pkce()
        self.assertIn("code_verifier", pkce)
        self.assertIn("code_challenge", pkce)
        self.assertEqual(pkce["code_challenge_method"], "S256")
        self.assertTrue(len(pkce["code_verifier"]) > 30)

    def test_authorization_url_generation(self):
        config = {
            "client_id": "test_client_id",
            "account_id": "TST12345",
        }
        session_id = "test_session_123"
        url = self.auth_service.get_authorization_url(session_id, config)
        self.assertIn("https://TST12345.app.netsuite.com", url)
        self.assertIn("test_client_id", url)
        self.assertIn("state=test_session_123", url)
        self.assertIn(session_id, self.auth_service.pkce_store)

if __name__ == "__main__":
    unittest.main()
