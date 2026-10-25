export interface ConfigResponse {
  selected_model: string;
  api_provider: string;
  netsuite_account_id: string;
  has_api_key: boolean;
  client_id: string;
}

export interface AccountItem {
  account_id: string;
  client_id: string;
  is_active: boolean;
  has_tokens: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageItem {
  id: number;
  session_id: string;
  account_id: string | null;
  sender: 'user' | 'ai' | 'bot';
  content: string;
  model_used: string | null;
  timestamp: string;
}

// HTTP boundary for the frontend: all calls to the Python API are collected here.
export class NetSuiteConnector {
  private apiEndpoint: string;

  constructor(apiEndpoint?: string) {
    this.apiEndpoint = (apiEndpoint || import.meta.env.VITE_NETSUITE_API_ENDPOINT || 'http://localhost:8000').replace(/\/+$/, '');
  }

  // Send a chat turn and handle either JSON replies or the server's token-by-token SSE stream.
  async sendMessage(
    message: string, 
    sessionId: string = 'default',
    onChunk?: (chunk: string) => void
  ): Promise<{ response: string; user_message?: any; ai_message?: any; total_tokens?: number }> {
    try {
      const response = await fetch(`${this.apiEndpoint}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message, session_id: sessionId }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `HTTP error! status: ${response.status}`);
      }

      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        const data = await response.json();
        if (onChunk && data.response) {
          onChunk(data.response);
        }
        console.log('(contentType.includes("application/json"))', data);
        return {
          response: data.response || "No response received from AI service.",
          user_message: data.user_message,
          ai_message: data.ai_message
        };
      }

      if (!response.body) {
        throw new Error("Response body is empty.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";
      let buffer = "";
      let doneData: any = null;

      const consumeEvent = (frame: string) => {
        const data = frame
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).replace(/^ /, ""))
          .join("\n");
        if (!data) return;

        let parsed: any;
        try {
          parsed = JSON.parse(data);
        } catch {
          console.warn("Ignoring malformed SSE event from chat endpoint.");
          return;
        }

        if (parsed.type === "token" && typeof parsed.token === "string") {
          fullResponse += parsed.token;
          onChunk?.(parsed.token);
        } else if (parsed.type === "done") {
          doneData = parsed;
        } else if (parsed.type === "error") {
          throw new Error(parsed.error || "The chat stream returned an error.");
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          buffer += decoder.decode();
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        let separator: RegExpExecArray | null;
        const frameSeparator = /\r?\n\r?\n/;
        while ((separator = frameSeparator.exec(buffer)) !== null) {
          consumeEvent(buffer.slice(0, separator.index));
          buffer = buffer.slice(separator.index + separator[0].length);
        }
      }

      if (buffer.trim()) consumeEvent(buffer);

      return {
        response: fullResponse || doneData?.response || "",
        user_message: doneData?.user_message,
        ai_message: doneData?.ai_message,
        total_tokens: doneData?.total_tokens,
      };
    } catch (error: any) {
      console.error("NetSuite AI Connector Error:", error);
      throw error;
    }
  }

  // Begin the NetSuite OAuth flow; the server returns the URL the user must authorize.
  async authenticateNetSuite(accountId: string, clientId: string, clientSecret?: string): Promise<{ auth_url: string; session_id: string }> {
    const response = await fetch(`${this.apiEndpoint}/auth`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        account_id: accountId,
        client_id: clientId,
        client_secret: clientSecret
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.detail || "NetSuite authorization initialization failed.");
    }

    return await response.json();
  }

  // Account management and saved chat history endpoints.
  async getAccounts(): Promise<{ accounts: AccountItem[]; active_account_id: string | null }> {
    const response = await fetch(`${this.apiEndpoint}/accounts`);
    if (!response.ok) {
      throw new Error("Failed to fetch accounts list.");
    }
    return await response.json();
  }

  async selectAccount(accountId: string): Promise<any> {
    const response = await fetch(`${this.apiEndpoint}/accounts/select`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ account_id: accountId }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.detail || `Failed to switch to account ${accountId}`);
    }

    return await response.json();
  }

  async deleteAccount(accountId: string): Promise<any> {
    const response = await fetch(`${this.apiEndpoint}/accounts/${encodeURIComponent(accountId)}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.detail || `Failed to delete account ${accountId}`);
    }

    return await response.json();
  }

  async getSessions(accountId?: string): Promise<any[]> {
    try {
      const url = accountId !== undefined
        ? `${this.apiEndpoint}/sessions?account_id=${encodeURIComponent(accountId)}`
        : `${this.apiEndpoint}/sessions`;
      const response = await fetch(url);
      if (!response.ok) return [];
      const data = await response.json();
      return data.sessions || [];
    } catch (e) {
      console.error("Failed to fetch sessions from SQLite DB", e);
      return [];
    }
  }

  async getMessages(sessionId: string = 'default', accountId?: string): Promise<ChatMessageItem[]> {
    try {
      let url = `${this.apiEndpoint}/messages?session_id=${encodeURIComponent(sessionId)}`;
      if (accountId !== undefined) {
        url += `&account_id=${encodeURIComponent(accountId)}`;
      }
      const response = await fetch(url);
      if (!response.ok) {
        return [];
      }
      const data = await response.json();
      return data.messages || [];
    } catch (e) {
      console.error("Failed to load messages from backend SQLite DB", e);
      return [];
    }
  }

  async clearMessages(sessionId: string = 'default', accountId?: string): Promise<any> {
    let url = `${this.apiEndpoint}/messages?session_id=${encodeURIComponent(sessionId)}`;
    if (accountId !== undefined) {
      url += `&account_id=${encodeURIComponent(accountId)}`;
    }
    const response = await fetch(url, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error("Failed to clear messages.");
    }
    return await response.json();
  }

  // AI provider/model configuration and backend tool discovery/indexing endpoints.
  async fetchModels(apiProvider: string, apiKey: string): Promise<Array<{ name: string; displayName: string }>> {
    const response = await fetch(`${this.apiEndpoint}/models`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_provider: apiProvider,
        api_key: apiKey,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.detail || "Failed to fetch models for specified provider.");
    }

    return await response.json();
  }

  async useModel(modelName: string, apiProvider?: string, apiKey?: string): Promise<any> {
    const response = await fetch(`${this.apiEndpoint}/use-model`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model_name: modelName,
        api_provider: apiProvider,
        api_key: apiKey,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.detail || "Failed to configure model.");
    }

    return await response.json();
  }

  async getConfig(): Promise<ConfigResponse> {
    const response = await fetch(`${this.apiEndpoint}/get-config`);
    if (!response.ok) {
      throw new Error("Failed to fetch client configuration.");
    }
    return await response.json();
  }

  async getToolsList(): Promise<any> {
    const response = await fetch(`${this.apiEndpoint}/get-tools-list`);
    if (!response.ok) {
      throw new Error("Failed to fetch tools list.");
    }
    return await response.json();
  }

  async indexAccount(): Promise<any> {
    const response = await fetch(`${this.apiEndpoint}/index-account`, {
      method: "POST",
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.detail || "Failed to index account.");
    }
    return await response.json();
  }
}

export const connector = new NetSuiteConnector();
export default NetSuiteConnector;


