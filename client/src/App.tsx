import { useState, useEffect } from 'react';
import Chatbot from './components/Chatbot';
import HistoryPanel from './components/HistoryPanel';
import type { HistoryItem } from './components/HistoryPanel';
import NetSuiteConnector from './components/NetSuiteConnector';

const connector = new NetSuiteConnector();

export default function App() {
  const [showHistory, setShowHistory] = useState(false);
  const [messages, setMessages] = useState<{ text: string; sender: 'user' | 'bot' }[]>([]);

  const [savedSessions, setSavedSessions] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('suite_forge_sessions');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Load chat messages from backend SQLite DB on startup
  useEffect(() => {
    const loadStoredMessages = async () => {
      try {
        const storedMsgs = await connector.getMessages('default');
        if (storedMsgs && storedMsgs.length > 0) {
          const formatted = storedMsgs.map((m) => ({
            text: m.content,
            sender: (m.sender === 'user' ? 'user' : 'bot') as 'user' | 'bot'
          }));
          setMessages(formatted);
        }
      } catch (err) {
        console.error('Error fetching chat history from SQLite:', err);
      }
    };
    loadStoredMessages();
  }, []);

  const handleSendMessage = async (message: string): Promise<string> => {
    const result = await connector.sendMessage(message);
    const response = typeof result === 'string' ? result : result.response;
    
    // Save session title if history is empty
    if (messages.length === 0) {
      const newSession: HistoryItem = {
        id: Date.now().toString(),
        title: message.length > 30 ? `${message.substring(0, 30)}...` : message,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        messageCount: 2
      };
      setSavedSessions((prev) => [newSession, ...prev]);
    }
    
    return response;
  };

  const toggleHistory = () => {
    setShowHistory((prev) => !prev);
  };

  const handleNewChat = async () => {
    try {
      await connector.clearMessages('default');
    } catch (e) {
      console.error('Failed to clear messages in SQLite DB', e);
    }
    setMessages([]);
  };

  const handleSelectPrompt = (promptText: string) => {
    setMessages((prev) => [...prev, { text: promptText, sender: 'user' }]);
    connector.sendMessage(promptText)
      .then((res) => {
        const botResponse = typeof res === 'string' ? res : res.response;
        setMessages((prev) => [...prev, { text: botResponse, sender: 'bot' }]);
      })
      .catch((err: any) => {
        const errorMsg = err?.message || 'Failed to send message.';
        setMessages((prev) => [...prev, { text: `⚠️ **Error**: ${errorMsg}`, sender: 'bot' }]);
      });
  };

  const handleClearHistory = async () => {
    try {
      await connector.clearMessages('default');
    } catch (e) {
      console.error('Failed to clear messages', e);
    }
    setSavedSessions([]);
    setMessages([]);
    localStorage.removeItem('suite_forge_sessions');
  };

  return (
    <div className="flex flex-1 h-full w-full relative overflow-hidden bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100">
      <HistoryPanel 
        showHistory={showHistory} 
        onClose={() => setShowHistory(false)}
        onNewChat={handleNewChat}
        onSelectPrompt={handleSelectPrompt}
        savedSessions={savedSessions}
        onClearHistory={handleClearHistory}
      />
      <div className="flex flex-col flex-1 h-full min-w-0 overflow-hidden relative">
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

