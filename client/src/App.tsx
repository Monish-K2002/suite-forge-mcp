import { useState } from 'react';
import Chatbot from './components/Chatbot';
import HistoryPanel from './components/HistoryPanel';
import NetSuiteConnector from './components/NetSuiteConnector';

const connector = new NetSuiteConnector();

export default function App() {
  const [showHistory, setShowHistory] = useState(false);
  const [messages, setMessages] = useState<{ text: string; sender: 'user' | 'bot' }[]>([]);

  const handleSendMessage = async (message: string): Promise<string> => {
    return await connector.sendMessage(message);
  };

  const toggleHistory = () => {
    setShowHistory(!showHistory);
  };

  return (
    <div className="flex h-[calc(100vh-5rem)] w-full bg-gray-100 dark:bg-gray-900">
      <HistoryPanel showHistory={showHistory} />
      <div className="flex flex-col flex-grow">
        <Chatbot 
          onSendMessage={handleSendMessage} 
          toggleHistory={toggleHistory} 
          messages={messages}
          setMessages={setMessages}
        />
      </div>
    </div>
  );
}