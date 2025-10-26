import json
from typing import Any, Dict, List, Optional

import requests

from services.cache.cache import Cache


class NetSuiteToolService:
    """Proxy for retrieving and executing tools hosted on NetSuite."""

    def __init__(self, cache: Cache, timeout: float = 15.0) -> None:
        self.cache = cache
        self.timeout = timeout

    def _get_base_url(self) -> str:
        config = self.cache.cache_get("netsuite_config", {})
        base_url: Optional[str] = None
        if isinstance(config, dict):
            base_url = (
                config.get("tool_base_url")
                or config.get("base_url")
                or config.get("mcp_base_url")
            )
        if not base_url:
            raise RuntimeError("NetSuite tool base URL is not configured.")
        return base_url.rstrip("/")

    def _get_headers(self) -> Dict[str, str]:
        headers: Dict[str, str] = {"Content-Type": "application/json"}
        token_payload = self.cache.cache_get("netsuite_tokens")
        access_token: Optional[str] = None
        if isinstance(token_payload, dict):
            access_token = token_payload.get("access_token")
        if not access_token:
            access_token = self.cache.cache_get("netsuite_access_token")
        if access_token:
            headers["Authorization"] = f"Bearer {access_token}"
        return headers

    def list_tools(self) -> List[Dict[str, Any]]:
        url = f"{self._get_base_url()}/tools"
        response = requests.get(url, headers=self._get_headers(), timeout=self.timeout)
        response.raise_for_status()
        data: Any = response.json()
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            tools = data.get("tools") or data.get("items")
            if isinstance(tools, list):
                return tools
            raise ValueError("NetSuite tools response did not include a list of tools.")
        raise ValueError("Unexpected payload received from NetSuite tools endpoint.")

    def invoke_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Any:
        url = f"{self._get_base_url()}/tools/{tool_name}"
        payload = {"arguments": arguments}
        response = requests.post(
            url,
            headers=self._get_headers(),
            json=payload,
            timeout=self.timeout,
        )
        response.raise_for_status()
        data: Any = response.json()
        if isinstance(data, dict) and "result" in data:
            return data["result"]
        return data
