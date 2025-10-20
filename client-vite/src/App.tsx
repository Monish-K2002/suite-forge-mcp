import { useState } from 'react';
import Chatbot from './components/Chatbot';
import HistoryPanel from './components/HistoryPanel';
import NetSuiteConnector from './components/NetSuiteConnector';

export default function App() {
  // IMPORTANT: Create a .env file in the client-vite directory and add the following environment variables:
  // VITE_NETSUITE_API_ENDPOINT=your_netsuite_api_endpoint
  // VITE_NETSUITE_API_KEY=your_netsuite_api_key

  const netSuiteConnector = new NetSuiteConnector(
    import.meta.env.VITE_NETSUITE_API_ENDPOINT || '',
    import.meta.env.VITE_NETSUITE_API_KEY || ''
  );

  const [showHistory, setShowHistory] = useState(false);

  const handleSendMessage = async (message: string) => {
    return await netSuiteConnector.sendMessage(message);
  };

  const toggleHistory = () => {
    setShowHistory(!showHistory);
  };

  return (
    <div className="flex h-[calc(100vh-5rem)] w-full bg-gray-100 dark:bg-gray-900">
      <HistoryPanel showHistory={showHistory} />
      <div className="flex flex-col flex-grow">
        <Chatbot onSendMessage={handleSendMessage} toggleHistory={toggleHistory} />
      </div>
    </div>
  );
}