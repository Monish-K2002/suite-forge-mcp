interface NetSuiteConnectorProps {
  onMessage: (message: string) => Promise<string>;
}

export class NetSuiteConnector {
  private apiEndpoint: string;
  private apiKey: string;

  constructor(apiEndpoint: string, apiKey: string) {
    this.apiEndpoint = apiEndpoint;
    this.apiKey = apiKey;
  }

  async sendMessage(message: string): Promise<string> {
    try {
      const response = await fetch(`${this.apiEndpoint}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          message,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.response || "I'm sorry, I couldn't process your request at the moment.";
    } catch (error) {
      console.error("NetSuite AI Connector Error:", error);
      return "I'm experiencing technical difficulties. Please try again later.";
    }
  }

  async getNetSuiteData(query: string): Promise<any> {
    try {
      const response = await fetch(`${this.apiEndpoint}/data`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          query,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("NetSuite Data Error:", error);
      throw error;
    }
  }
}

export default NetSuiteConnector;