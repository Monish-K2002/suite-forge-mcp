import logging
from services.db.database import DatabaseManager

logger = logging.getLogger(__name__)

class Cache(DatabaseManager):
    """
    Backward-compatible Cache class wrapping DatabaseManager.
    Redirects legacy cache key operations to the SQLite database.
    """
    def __init__(self, cache_file: str = "suite_forge.db"):
        # If cache_file ends with .data (from legacy test runs), adapt to .db or test db
        db_path = cache_file if cache_file.endswith(".db") else f"{cache_file}.sqlite"
        super().__init__(db_path=db_path)
