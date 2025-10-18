'use client';

import Chatbot from './components/Chatbot';
import NetSuiteConnector from './components/NetSuiteConnector';

export default function Home() {
  // IMPORTANT: Create a .env.local file in the client directory and add the following environment variables:
  // NEXT_PUBLIC_NETSUITE_API_ENDPOINT=your_netsuite_api_endpoint
  // NEXT_PUBLIC_NETSUITE_API_KEY=your_netsuite_api_key

  const netSuiteConnector = new NetSuiteConnector(
    process.env.NEXT_PUBLIC_NETSUITE_API_ENDPOINT || '',
    process.env.NEXT_PUBLIC_NETSUITE_API_KEY || ''
  );

  const handleSendMessage = async (message: string) => {
    return await netSuiteConnector.sendMessage(message);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-100 dark:bg-gray-900">
      <Chatbot onSendMessage={handleSendMessage} />
    </main>
  );
}