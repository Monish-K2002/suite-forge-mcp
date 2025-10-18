"use client";

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

// Mock implementation for development
export const mockNetSuiteConnector = {
  async sendMessage(message: string): Promise<string> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
    
    // Mock responses based on message content
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes("hello") || lowerMessage.includes("hi")) {
      return "Hello! I'm your NetSuite AI assistant. I can help you with inventory management, financial reports, customer data, and more. What would you like to know?";
    }
    
    if (lowerMessage.includes("inventory")) {
      return "I can help you with inventory management in NetSuite. I can check stock levels, track items, generate inventory reports, and help with reorder points. What specific inventory information do you need?";
    }
    
    if (lowerMessage.includes("customer") || lowerMessage.includes("client")) {
      return "I can assist with customer-related tasks in NetSuite. I can help you find customer information, track sales history, manage customer relationships, and generate customer reports. What customer data are you looking for?";
    }
    
    if (lowerMessage.includes("report") || lowerMessage.includes("analytics")) {
      return "I can help you generate various reports in NetSuite including financial reports, sales analytics, inventory reports, and custom dashboards. What type of report would you like to create?";
    }
    
    if (lowerMessage.includes("sales") || lowerMessage.includes("revenue")) {
      return "I can help you with sales data and revenue analysis in NetSuite. I can track sales performance, analyze revenue trends, manage sales orders, and provide insights on your sales pipeline. What sales information do you need?";
    }
    
    return `I understand you're asking about "${message}". As your NetSuite AI assistant, I can help you with various NetSuite functions including inventory management, customer relations, financial reporting, and data analysis. Could you be more specific about what you'd like to accomplish?`;
  }
};
