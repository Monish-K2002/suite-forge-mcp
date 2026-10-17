import os
import json
import sqlite3
import logging
import threading
import hashlib
from typing import List, Dict, Any, Optional
from base64 import b64encode, b64decode
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.padding import PKCS7
from cryptography.hazmat.backends import default_backend

logger = logging.getLogger(__name__)
_database_lock = threading.RLock()

class DatabaseManager:
    """
    SQLite Database Service managing:
    - Multi-account NetSuite configuration and OAuth token storage
    - Chat message history persistence
    - App settings & key-value configuration (with AES encryption for sensitive data)
    """

    def __init__(self, db_path: str = "suite_forge.db"):
        self.db_path = db_path
        # All managers for the same process share a lock. SQLite still coordinates
        # other processes; busy_timeout below gives those writers time to finish.
        self._lock = _database_lock
        self.IV_LENGTH = 16

        # Initialize encryption key
        env_key = os.getenv("ENCRYPTION_KEY")
        if env_key and os.getenv("APP_ENV", "").lower() == "production" and len(env_key) < 32:
            raise RuntimeError("ENCRYPTION_KEY must contain at least 32 characters when APP_ENV=production")
        if not env_key:
            if os.getenv("APP_ENV", "").lower() == "production":
                raise RuntimeError("ENCRYPTION_KEY must be set when APP_ENV=production")
            logger.warning("ENCRYPTION_KEY environment variable not set. Using default key for SQLite local dev encryption.")
            env_key = "suite_forge_mcp_default_secret_key_32bytes"
        self.LEGACY_SECRET = env_key.ljust(32, "0")[:32].encode("utf-8")
        self.SECRET = hashlib.sha256(env_key.encode("utf-8")).digest()

        self._init_db()
        self._migrate_legacy_cache()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, check_same_thread=False, timeout=30)
        conn.execute("PRAGMA busy_timeout = 30000")
        conn.row_factory = sqlite3.Row
        return conn

    def _encrypt(self, text: str) -> str:
        if not text:
            return ""
        nonce = os.urandom(12)
        encrypted = AESGCM(self.SECRET).encrypt(nonce, text.encode("utf-8"), None)
        return f"v2:{b64encode(nonce).decode('ascii')}:{b64encode(encrypted).decode('ascii')}"

    def _decrypt(self, data: str) -> str:
        if not data:
            return ""
        try:
            if data.startswith("v2:"):
                _, nonce_b64, encrypted_b64 = data.split(":", 2)
                return AESGCM(self.SECRET).decrypt(
                    b64decode(nonce_b64), b64decode(encrypted_b64), None
                ).decode("utf-8")
            # Read legacy AES-CBC values so existing account credentials remain usable.
            iv_b64, encrypted_b64 = data.split(":")
            iv = b64decode(iv_b64)
            encrypted_bytes = b64decode(encrypted_b64)
            cipher = Cipher(algorithms.AES(self.LEGACY_SECRET), modes.CBC(iv), backend=default_backend())
            decryptor = cipher.decryptor()
            padded_bytes = decryptor.update(encrypted_bytes) + decryptor.finalize()
            unpadder = PKCS7(128).unpadder()
            unpadded_bytes = unpadder.update(padded_bytes) + unpadder.finalize()
            return unpadded_bytes.decode('utf-8')
        except Exception as e:
            logger.error(f"Failed to decrypt database string: {e}")
            return data

    def _init_db(self):
        """Create required tables if they don't exist."""
        with self._lock:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            # Accounts table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS accounts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    account_id TEXT UNIQUE NOT NULL,
                    client_id TEXT NOT NULL,
                    client_secret TEXT,
                    access_token TEXT,
                    refresh_token TEXT,
                    is_active INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)

            # Messages table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT DEFAULT 'default',
                    account_id TEXT,
                    sender TEXT NOT NULL,
                    content TEXT NOT NULL,
                    model_used TEXT,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)

            # Settings table (Key-Value)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)

            cursor.execute("CREATE INDEX IF NOT EXISTS idx_messages_session_id_id ON messages(session_id, id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_messages_account_session_id ON messages(account_id, session_id, id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_messages_sender_account_session ON messages(sender, account_id, session_id, timestamp)")
            cursor.execute("UPDATE accounts SET is_active = 0 WHERE is_active = 1 AND id NOT IN (SELECT id FROM accounts WHERE is_active = 1 ORDER BY updated_at DESC, id DESC LIMIT 1)")
            cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_single_active ON accounts(is_active) WHERE is_active = 1")
            conn.execute("PRAGMA journal_mode = WAL")
            conn.commit()
            conn.close()

    def _migrate_legacy_cache(self, legacy_file: str = "cache.data"):
        """Migrate legacy cache.data file into SQLite if it exists."""
        if not os.path.exists(legacy_file):
            return

        try:
            with open(legacy_file, "r", encoding="utf-8") as f:
                encrypted = f.read().strip()
            if encrypted:
                decrypted = self._decrypt(encrypted)
                legacy_data = json.loads(decrypted)
                
                # Import settings
                for k, v in legacy_data.items():
                    if k not in ["netsuite_config", "netsuite_tokens"]:
                        self.set_setting(k, v)

                # Import NetSuite account
                config = legacy_data.get("netsuite_config")
                tokens = legacy_data.get("netsuite_tokens")
                if config and config.get("account_id") and config.get("client_id"):
                    acc_id = config["account_id"]
                    client_id = config["client_id"]
                    access_token = tokens.get("access_token") if tokens else None
                    refresh_token = tokens.get("refresh_token") if tokens else None
                    self.add_or_update_account(
                        account_id=acc_id,
                        client_id=client_id,
                        access_token=access_token,
                        refresh_token=refresh_token,
                        set_active=True
                    )
                logger.info("Successfully migrated legacy cache.data into SQLite database.")
            # Remove legacy file after migration
            os.remove(legacy_file)
        except Exception as e:
            logger.error(f"Error during legacy cache migration: {e}")

    # --- ACCOUNTS MANAGEMENT ---

    def add_or_update_account(
        self,
        account_id: str,
        client_id: str,
        client_secret: Optional[str] = None,
        access_token: Optional[str] = None,
        refresh_token: Optional[str] = None,
        set_active: bool = True
    ) -> Dict[str, Any]:
        """Add a new account or update an existing one."""
        with self._lock:
            conn = self._get_connection()
            cursor = conn.cursor()

            # Encrypt tokens and secrets
            enc_secret = self._encrypt(client_secret) if client_secret else None
            enc_access = self._encrypt(access_token) if access_token else None
            enc_refresh = self._encrypt(refresh_token) if refresh_token else None

            if set_active:
                cursor.execute("UPDATE accounts SET is_active = 0")

            cursor.execute("""
                INSERT INTO accounts (account_id, client_id, client_secret, access_token, refresh_token, is_active, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(account_id) DO UPDATE SET
                    client_id = excluded.client_id,
                    client_secret = COALESCE(excluded.client_secret, accounts.client_secret),
                    access_token = COALESCE(excluded.access_token, accounts.access_token),
                    refresh_token = COALESCE(excluded.refresh_token, accounts.refresh_token),
                    is_active = CASE WHEN ? = 1 THEN 1 ELSE accounts.is_active END,
                    updated_at = CURRENT_TIMESTAMP;
            """, (account_id, client_id, enc_secret, enc_access, enc_refresh, 1 if set_active else 0, 1 if set_active else 0))

            conn.commit()
            conn.close()

        logger.info(f"Account {account_id} saved in database (is_active={set_active})")
        return self.get_account(account_id)

    def get_account(self, account_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            conn = self._get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM accounts WHERE account_id = ?", (account_id,))
            row = cursor.fetchone()
            conn.close()

            if not row:
                return None

            return {
                "id": row["id"],
                "account_id": row["account_id"],
                "client_id": row["client_id"],
                "client_secret": self._decrypt(row["client_secret"]) if row["client_secret"] else None,
                "access_token": self._decrypt(row["access_token"]) if row["access_token"] else None,
                "refresh_token": self._decrypt(row["refresh_token"]) if row["refresh_token"] else None,
                "is_active": bool(row["is_active"]),
                "created_at": str(row["created_at"]),
                "updated_at": str(row["updated_at"])
            }

    def get_active_account(self) -> Optional[Dict[str, Any]]:
        with self._lock:
            conn = self._get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM accounts WHERE is_active = 1 LIMIT 1")
            row = cursor.fetchone()
            conn.close()

            if not row:
                return None

            return {
                "id": row["id"],
                "account_id": row["account_id"],
                "client_id": row["client_id"],
                "client_secret": self._decrypt(row["client_secret"]) if row["client_secret"] else None,
                "access_token": self._decrypt(row["access_token"]) if row["access_token"] else None,
                "refresh_token": self._decrypt(row["refresh_token"]) if row["refresh_token"] else None,
                "is_active": True,
                "created_at": str(row["created_at"]),
                "updated_at": str(row["updated_at"])
            }

    def set_active_account(self, account_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            conn = self._get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT account_id FROM accounts WHERE account_id = ?", (account_id,))
            if not cursor.fetchone():
                conn.close()
                return None

            cursor.execute("UPDATE accounts SET is_active = 0")
            cursor.execute("UPDATE accounts SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE account_id = ?", (account_id,))
            conn.commit()
            conn.close()

        logger.info(f"Switched active NetSuite account to {account_id}")
        return self.get_account(account_id)

    def list_accounts(self) -> List[Dict[str, Any]]:
        """List all accounts with sensitive tokens masked for safe API output."""
        with self._lock:
            conn = self._get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT account_id, client_id, is_active, created_at, updated_at, access_token IS NOT NULL as has_tokens FROM accounts ORDER BY updated_at DESC")
            rows = cursor.fetchall()
            conn.close()

            return [
                {
                    "account_id": row["account_id"],
                    "client_id": row["client_id"],
                    "is_active": bool(row["is_active"]),
                    "has_tokens": bool(row["has_tokens"]),
                    "created_at": str(row["created_at"]),
                    "updated_at": str(row["updated_at"])
                }
                for row in rows
            ]


    def delete_account(self, account_id: str) -> bool:
        with self._lock:
            conn = self._get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT is_active FROM accounts WHERE account_id = ?", (account_id,))
            existing = cursor.fetchone()
            cursor.execute("DELETE FROM accounts WHERE account_id = ?", (account_id,))
            deleted = cursor.rowcount > 0
            if deleted and existing and existing["is_active"]:
                cursor.execute("SELECT account_id FROM accounts ORDER BY updated_at DESC LIMIT 1")
                replacement = cursor.fetchone()
                if replacement:
                    cursor.execute("UPDATE accounts SET is_active = 1 WHERE account_id = ?", (replacement["account_id"],))
            conn.commit()
            conn.close()
        return deleted

    def update_tokens(self, account_id: str, access_token: str, refresh_token: Optional[str] = None):
        with self._lock:
            conn = self._get_connection()
            cursor = conn.cursor()
            enc_access = self._encrypt(access_token)
            if refresh_token:
                enc_refresh = self._encrypt(refresh_token)
                cursor.execute("""
                    UPDATE accounts 
                    SET access_token = ?, refresh_token = ?, updated_at = CURRENT_TIMESTAMP 
                    WHERE account_id = ?
                """, (enc_access, enc_refresh, account_id))
            else:
                cursor.execute("""
                    UPDATE accounts 
                    SET access_token = ?, updated_at = CURRENT_TIMESTAMP 
                    WHERE account_id = ?
                """, (enc_access, account_id))
            conn.commit()
            conn.close()

    # --- MESSAGES MANAGEMENT ---

    def save_message(
        self,
        sender: str,
        content: str,
        model_used: Optional[str] = None,
        account_id: Optional[str] = None,
        session_id: str = "default"
    ) -> Dict[str, Any]:
        """Store a chat message in the SQLite database."""
        with self._lock:
            conn = self._get_connection()
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO messages (session_id, account_id, sender, content, model_used)
                VALUES (?, ?, ?, ?, ?);
            """, (session_id, account_id, sender, content, model_used))
            msg_id = cursor.lastrowid
            conn.commit()

            cursor.execute("SELECT * FROM messages WHERE id = ?", (msg_id,))
            row = cursor.fetchone()
            conn.close()

            return {
                "id": row["id"],
                "session_id": row["session_id"],
                "account_id": row["account_id"],
                "sender": row["sender"],
                "content": row["content"],
                "model_used": row["model_used"],
                "timestamp": str(row["timestamp"])
            }
    def get_messages(self, session_id: str = "default", limit: int = 100, account_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Retrieve stored chat history messages."""
        with self._lock:
            conn = self._get_connection()
            cursor = conn.cursor()
            if account_id is not None:
                cursor.execute("""
                    SELECT * FROM messages 
                    WHERE session_id = ? AND (account_id = ? OR (account_id IS NULL AND ? = ''))
                    ORDER BY id DESC
                    LIMIT ?
                """, (session_id, account_id, account_id, max(0, min(limit, 1000))))
            else:
                cursor.execute("""
                    SELECT * FROM messages 
                    WHERE session_id = ? 
                    ORDER BY id DESC
                    LIMIT ?
                """, (session_id, max(0, min(limit, 1000))))
            rows = list(reversed(cursor.fetchall()))
            conn.close()

            return [
                {
                    "id": row["id"],
                    "session_id": row["session_id"],
                    "account_id": row["account_id"],
                    "sender": row["sender"],
                    "content": row["content"],
                    "model_used": row["model_used"],
                    "timestamp": str(row["timestamp"])
                }
                for row in rows
            ]

    def clear_messages(self, session_id: str = "default", account_id: Optional[str] = None) -> bool:
        """Clear chat messages for a session."""
        with self._lock:
            conn = self._get_connection()
            cursor = conn.cursor()
            if account_id is not None:
                cursor.execute("""
                    DELETE FROM messages 
                    WHERE session_id = ? AND (account_id = ? OR (account_id IS NULL AND ? = ''))
                """, (session_id, account_id, account_id))
            else:
                cursor.execute("DELETE FROM messages WHERE session_id = ?", (session_id,))
            deleted = cursor.rowcount > 0
            conn.commit()
            conn.close()
        return deleted

    def delete_message(self, message_id: int) -> bool:
        """Remove a message that belongs to an unsuccessful, incomplete turn."""
        with self._lock:
            conn = self._get_connection()
            cursor = conn.cursor()
            cursor.execute("DELETE FROM messages WHERE id = ?", (message_id,))
            deleted = cursor.rowcount > 0
            conn.commit()
            conn.close()
        return deleted

    def get_sessions(self, account_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """List distinct chat sessions with title snippet, message count, and last timestamp."""
        with self._lock:
            conn = self._get_connection()
            cursor = conn.cursor()
            if account_id is not None:
                cursor.execute("""
                    SELECT 
                        session_id,
                        (SELECT content FROM messages m2 WHERE m2.session_id = messages.session_id AND (m2.account_id = ? OR (m2.account_id IS NULL AND ? = '')) AND m2.sender = 'user' ORDER BY m2.id LIMIT 1) as title,
                        MAX(timestamp) as last_updated,
                        COUNT(*) as message_count
                    FROM messages
                    WHERE (account_id = ? OR (account_id IS NULL AND ? = ''))
                    GROUP BY session_id
                    ORDER BY last_updated DESC
                """, (account_id, account_id, account_id, account_id))
            else:
                cursor.execute("""
                    SELECT 
                        session_id,
                        (SELECT content FROM messages m2 WHERE m2.session_id = messages.session_id AND m2.sender = 'user' ORDER BY m2.id LIMIT 1) as title,
                        MAX(timestamp) as last_updated,
                        COUNT(*) as message_count
                    FROM messages
                    GROUP BY session_id
                    ORDER BY last_updated DESC
                """)
            rows = cursor.fetchall()
            conn.close()

            return [
                {
                    "id": row["session_id"],
                    "title": (row["title"] or "New chat")[:40] + ("..." if len(row["title"] or "") > 40 else ""),
                    "timestamp": str(row["last_updated"]),
                    "messageCount": row["message_count"]
                }
                for row in rows
            ]


    # --- SETTINGS & BACKWARD COMPATIBLE CACHE INTERFACE ---

    def set_setting(self, key: str, value: Any):
        """Store setting in key-value format."""
        with self._lock:
            conn = self._get_connection()
            cursor = conn.cursor()
            if key == "api_key" and value:
                value = {"__encrypted_api_key__": self._encrypt(str(value))}
            json_val = json.dumps(value)
            cursor.execute("""
                INSERT INTO settings (key, value, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(key) DO UPDATE SET
                    value = excluded.value,
                    updated_at = CURRENT_TIMESTAMP;
            """, (key, json_val))
            conn.commit()
            conn.close()

    def get_setting(self, key: str, default: Any = None) -> Any:
        with self._lock:
            conn = self._get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT value FROM settings WHERE key = ?", (key,))
            row = cursor.fetchone()
            conn.close()

            if not row:
                return default
            try:
                value = json.loads(row["value"])
                if key == "api_key" and isinstance(value, dict) and "__encrypted_api_key__" in value:
                    return self._decrypt(value["__encrypted_api_key__"])
                if key == "api_key" and isinstance(value, str) and value:
                    self.set_setting(key, value)
                return value
            except Exception:
                return row["value"]

    def delete_setting(self, key: str):
        with self._lock:
            conn = self._get_connection()
            cursor = conn.cursor()
            cursor.execute("DELETE FROM settings WHERE key = ?", (key,))
            conn.commit()
            conn.close()

    def cache_set(self, key: str, value: Any):
        """Backward compatible cache_set method."""
        self.set_setting(key, value)

    def cache_get(self, key: str, default: Any = None) -> Any:
        """Backward compatible cache_get method."""
        # Special handling for legacy keys mapped to accounts table
        if key == "netsuite_config":
            active_acc = self.get_active_account()
            if active_acc:
                return {
                    "account_id": active_acc["account_id"],
                    "client_id": active_acc["client_id"]
                }
            return default
        elif key == "netsuite_tokens":
            active_acc = self.get_active_account()
            if active_acc and active_acc.get("access_token"):
                return {
                    "access_token": active_acc["access_token"],
                    "refresh_token": active_acc["refresh_token"]
                }
            return default

        value = self.get_setting(key, default)
        # Upgrade existing plaintext API keys at rest on first read.
        if key == "api_key" and isinstance(value, str) and value:
            self.set_setting(key, value)
        return value

    def cache_delete(self, key: str):
        """Backward compatible cache_delete method."""
        self.delete_setting(key)

    def cache_clear(self):
        """Clear settings and database tables."""
        with self._lock:
            conn = self._get_connection()
            cursor = conn.cursor()
            cursor.execute("DELETE FROM settings")
            cursor.execute("DELETE FROM messages")
            cursor.execute("DELETE FROM accounts")
            conn.commit()
            conn.close()
