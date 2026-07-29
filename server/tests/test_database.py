import os
import unittest
from services.db.database import DatabaseManager

class TestDatabaseManager(unittest.TestCase):
    def setUp(self):
        self.test_db = "test_suite_forge_temp.db"
        if os.path.exists(self.test_db):
            os.remove(self.test_db)
        self.db = DatabaseManager(db_path=self.test_db)

    def tearDown(self):
        self.db.cache_clear()
        if os.path.exists(self.test_db):
            os.remove(self.test_db)

    def test_settings_kv(self):
        self.db.set_setting("theme", "dark")
        self.assertEqual(self.db.get_setting("theme"), "dark")

        data = {"model": "gemini-1.5-pro", "provider": "google"}
        self.db.set_setting("ai_config", data)
        self.assertEqual(self.db.get_setting("ai_config"), data)

    def test_account_management(self):
        # Add account 1
        acc1 = self.db.add_or_update_account(
            account_id="ACC_1001",
            client_id="client_id_1001",
            access_token="tok_1001_access",
            refresh_token="tok_1001_refresh",
            set_active=True
        )
        self.assertIsNotNone(acc1)
        self.assertEqual(acc1["account_id"], "ACC_1001")
        self.assertTrue(acc1["is_active"])

        active_acc = self.db.get_active_account()
        self.assertEqual(active_acc["account_id"], "ACC_1001")
        self.assertEqual(active_acc["access_token"], "tok_1001_access")

        # Add account 2 and set active
        acc2 = self.db.add_or_update_account(
            account_id="ACC_2002",
            client_id="client_id_2002",
            access_token="tok_2002_access",
            set_active=True
        )
        active_acc2 = self.db.get_active_account()
        self.assertEqual(active_acc2["account_id"], "ACC_2002")

        # Switch back to account 1
        self.db.set_active_account("ACC_1001")
        active_acc_switched = self.db.get_active_account()
        self.assertEqual(active_acc_switched["account_id"], "ACC_1001")

        # List accounts
        accounts_list = self.db.list_accounts()
        self.assertEqual(len(accounts_list), 2)

    def test_messages_persistence(self):
        msg1 = self.db.save_message(
            sender="user",
            content="Hello AI!",
            model_used="gemini-1.5-flash",
            account_id="ACC_1001",
            session_id="session_1"
        )
        self.assertEqual(msg1["sender"], "user")
        self.assertEqual(msg1["content"], "Hello AI!")

        msg2 = self.db.save_message(
            sender="ai",
            content="Hello! How can I assist you with NetSuite today?",
            model_used="gemini-1.5-flash",
            account_id="ACC_1001",
            session_id="session_1"
        )
        self.assertEqual(msg2["sender"], "ai")

        messages = self.db.get_messages(session_id="session_1")
        self.assertEqual(len(messages), 2)
        self.assertEqual(messages[0]["content"], "Hello AI!")
        self.assertEqual(messages[1]["content"], "Hello! How can I assist you with NetSuite today?")

        # Clear session messages
        self.db.clear_messages(session_id="session_1")
        self.assertEqual(len(self.db.get_messages(session_id="session_1")), 0)

if __name__ == "__main__":
    unittest.main()
