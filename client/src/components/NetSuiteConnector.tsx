export interface ConfigResponse {
  selected_model: string;
  api_provider: string;
  netsuite_account_id: string;
  has_api_key: boolean;
}

export class NetSuiteConnector {
  private apiEndpoint: string;

  constructor(apiEndpoint?: string) {
    this.apiEndpoint = (apiEndpoint || import.meta.env.VITE_NETSUITE_API_ENDPOINT || 'http://localhost:8000').replace(/\/+$/, '');
  }

  async sendMessage(message: string): Promise<string> {
    try {
      const response = await fetch(`${this.apiEndpoint}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.response || "No response received from AI service.";
    } catch (error: any) {
      console.error("NetSuite AI Connector Error:", error);
      throw error;
    }
  }

  async authenticateNetSuite(accountId: string, clientId: string): Promise<{ auth_url: string; session_id: string }> {
    const response = await fetch(`${this.apiEndpoint}/auth`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        account_id: accountId,
        client_id: clientId,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.detail || "NetSuite authorization initialization failed.");
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
