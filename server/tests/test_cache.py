import os
import unittest
from services.cache.cache import Cache

class TestCache(unittest.TestCase):
    def setUp(self):
        self.test_file = "test_cache_temp.data"
        self.cache = Cache(cache_file=self.test_file)

    def tearDown(self):
        self.cache.cache_clear()
        if os.path.exists(self.test_file):
            os.remove(self.test_file)

    def test_set_and_get(self):
        self.cache.cache_set("key1", "value1")
        self.assertEqual(self.cache.cache_get("key1"), "value1")

    def test_complex_dict(self):
        data = {"foo": "bar", "num": 123, "nested": {"a": True}}
        self.cache.cache_set("complex", data)
        self.assertEqual(self.cache.cache_get("complex"), data)

    def test_delete(self):
        self.cache.cache_set("key_to_del", "val")
        self.cache.cache_delete("key_to_del")
        self.assertIsNone(self.cache.cache_get("key_to_del"))

if __name__ == "__main__":
    unittest.main()
