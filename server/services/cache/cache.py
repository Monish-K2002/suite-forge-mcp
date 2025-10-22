import os
import json
from base64 import b64encode, b64decode
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend

class Cache:
    def __init__(self):
        self.cache = {}
        self.ALGO = "AES"
        self.SECRET = os.getenv("ENCRYPTION_KEY", "default_key").ljust(32, "0")[:32].encode()  # must be 32 bytes
        self.IV_LENGTH = 16
        self.CACHE_FILE = "cache.data"

    def _encrypt(self, text: str) -> str:
        iv = os.urandom(self.IV_LENGTH)
        cipher = Cipher(algorithms.AES(self.SECRET), modes.CBC(iv), backend=default_backend())
        encryptor = cipher.encryptor()

        pad_len = 16 - (len(text.encode()) % 16)
        padded_text = text + chr(pad_len) * pad_len

        encrypted = encryptor.update(padded_text.encode()) + encryptor.finalize()
        return f"{b64encode(iv).decode()}:{b64encode(encrypted).decode()}"


    def _decrypt(self, data: str) -> str:
        iv_b64, encrypted_b64 = data.split(":")
        iv = b64decode(iv_b64)
        encrypted = b64decode(encrypted_b64)

        cipher = Cipher(algorithms.AES(self.SECRET), modes.CBC(iv), backend=default_backend())
        decryptor = cipher.decryptor()
        decrypted_padded = decryptor.update(encrypted) + decryptor.finalize()

        pad_len = decrypted_padded[-1]
        return decrypted_padded[:-pad_len].decode()


    def _load_all(self):
        if not os.path.exists(self.CACHE_FILE):
            return {}
        with open(self.CACHE_FILE, "r", encoding="utf-8") as f:
            encrypted = f.read().strip()
        if not encrypted:
            return {}
        decrypted = self._decrypt(encrypted)
        return json.loads(decrypted)


    def _save_all(self, data: dict):
        encrypted = self._encrypt(json.dumps(data))
        with open(self.CACHE_FILE, "w", encoding="utf-8") as f:
            f.write(encrypted)


    def cache_set(self, key: str, value):
        """Store any key-value pair in encrypted cache."""
        data = self._load_all()
        data[key] = value
        self._save_all(data)


    def cache_get(self, key: str, default=None):
        """Retrieve a value by key."""
        data = self._load_all()
        return data.get(key, default)


    def cache_delete(self, key: str):
        data = self._load_all()
        if key in data:
            del data[key]
            self._save_all(data)


    def cache_clear(self):
        """Nuke the entire cache."""
        if os.path.exists(self.CACHE_FILE):
            os.remove(self.CACHE_FILE)

    
