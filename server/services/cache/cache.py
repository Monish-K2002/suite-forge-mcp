import os
import json
import logging
from base64 import b64encode, b64decode
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.padding import PKCS7
from cryptography.hazmat.backends import default_backend

logger = logging.getLogger(__name__)

class Cache:
    def __init__(self, cache_file: str = "cache.data"):
        self.CACHE_FILE = cache_file
        self.IV_LENGTH = 16
        
        env_key = os.getenv("ENCRYPTION_KEY")
        if not env_key:
            logger.warning("ENCRYPTION_KEY environment variable not set. Using fallback key for local dev cache.")
            env_key = "suite_forge_mcp_default_secret_key_32bytes"
        
        # Ensure 32 bytes key for AES-256
        self.SECRET = env_key.ljust(32, "0")[:32].encode('utf-8')

    def _encrypt(self, text: str) -> str:
        iv = os.urandom(self.IV_LENGTH)
        cipher = Cipher(algorithms.AES(self.SECRET), modes.CBC(iv), backend=default_backend())
        encryptor = cipher.encryptor()

        padder = PKCS7(128).padder()
        padded_bytes = padder.update(text.encode('utf-8')) + padder.finalize()

        encrypted_bytes = encryptor.update(padded_bytes) + encryptor.finalize()
        return f"{b64encode(iv).decode('utf-8')}:{b64encode(encrypted_bytes).decode('utf-8')}"

    def _decrypt(self, data: str) -> str:
        iv_b64, encrypted_b64 = data.split(":")
        iv = b64decode(iv_b64)
        encrypted_bytes = b64decode(encrypted_b64)

        cipher = Cipher(algorithms.AES(self.SECRET), modes.CBC(iv), backend=default_backend())
        decryptor = cipher.decryptor()
        padded_bytes = decryptor.update(encrypted_bytes) + decryptor.finalize()

        unpadder = PKCS7(128).unpadder()
        unpadded_bytes = unpadder.update(padded_bytes) + unpadder.finalize()
        return unpadded_bytes.decode('utf-8')

    def _load_all(self) -> dict:
        if not os.path.exists(self.CACHE_FILE):
            return {}
        try:
            with open(self.CACHE_FILE, "r", encoding="utf-8") as f:
                encrypted = f.read().strip()
            if not encrypted:
                return {}
            decrypted = self._decrypt(encrypted)
            return json.loads(decrypted)
        except Exception as e:
            logger.error(f"Failed to read or decrypt cache file: {e}")
            return {}

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
        """Delete a key from cache."""
        data = self._load_all()
        if key in data:
            del data[key]
            self._save_all(data)

    def cache_clear(self):
        """Clear the entire cache."""
        if os.path.exists(self.CACHE_FILE):
            os.remove(self.CACHE_FILE)

