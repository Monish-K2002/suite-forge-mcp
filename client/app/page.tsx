'use client';

import { useState } from 'react';
import Chatbot from './components/Chatbot';
import HistoryPanel from './components/HistoryPanel';
import NetSuiteConnector from './components/NetSuiteConnector';

export default function Home() {
  // IMPORTANT: Create a .env.local file in the client directory and add the following environment variables:
  // NEXT_PUBLIC_NETSUITE_API_ENDPOINT=your_netsuite_api_endpoint
  // NEXT_PUBLIC_NETSUITE_API_KEY=your_netsuite_api_key

  const netSuiteConnector = new NetSuiteConnector(
    process.env.NEXT_PUBLIC_NETSUITE_API_ENDPOINT || '',
    process.env.NEXT_PUBLIC_NETSUITE_API_KEY || ''
  );

  const [showHistory, setShowHistory] = useState(false);

  const handleSendMessage = async (message: string) => {
    return await netSuiteConnector.sendMessage(message);
  };

  const toggleHistory = () => {
    setShowHistory(!showHistory);
  };

  return (
    <main className="flex min-h-screen bg-gray-100 dark:bg-gray-900">
      <HistoryPanel showHistory={showHistory} />
      <Chatbot onSendMessage={handleSendMessage} toggleHistory={toggleHistory} />
    </main>
  );
}