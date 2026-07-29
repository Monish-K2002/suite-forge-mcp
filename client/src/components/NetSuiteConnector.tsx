export interface ConfigResponse {
  selected_model: string;
  api_provider: string;
  netsuite_account_id: string;
  has_api_key: boolean;
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

export class NetSuiteConnector {
  private apiEndpoint: string;

  constructor(apiEndpoint?: string) {
    this.apiEndpoint = (apiEndpoint || import.meta.env.VITE_NETSUITE_API_ENDPOINT || 'http://localhost:8000').replace(/\/+$/, '');
  }

  async sendMessage(message: string, sessionId: string = 'default'): Promise<{ response: string; user_message?: any; ai_message?: any }> {
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

      const data = await response.json();
      return {
        response: data.response || "No response received from AI service.",
        user_message: data.user_message,
        ai_message: data.ai_message
      };
    } catch (error: any) {
      console.error("NetSuite AI Connector Error:", error);
      throw error;
    }
  }

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

  async getMessages(sessionId: string = 'default'): Promise<ChatMessageItem[]> {
    try {
      const response = await fetch(`${this.apiEndpoint}/messages?session_id=${encodeURIComponent(sessionId)}`);
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

  async clearMessages(sessionId: string = 'default'): Promise<any> {
    const response = await fetch(`${this.apiEndpoint}/messages?session_id=${encodeURIComponent(sessionId)}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error("Failed to clear messages.");
    }
    return await response.json();
  }

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
    const data = await response.json();
    return data || [];
  }
}

export default NetSuiteConnector;

