import { useState, useEffect } from 'react';
import Chatbot from './components/Chatbot';
import HistoryPanel from './components/HistoryPanel';
import type { HistoryItem } from './components/HistoryPanel';
import NetSuiteConnector from './components/NetSuiteConnector';

const connector = new NetSuiteConnector();

export default function App() {
  const [showHistory, setShowHistory] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState('default');
  const [messages, setMessages] = useState<{ text: string; sender: 'user' | 'bot' }[]>([]);
  const [savedSessions, setSavedSessions] = useState<HistoryItem[]>([]);

  const loadSessions = async () => {
    try {
      const dbSessions = await connector.getSessions();
      if (dbSessions && dbSessions.length > 0) {
        setSavedSessions(dbSessions);
      }
    } catch (e) {
      console.error('Failed to load sessions from SQLite DB', e);
    }
  };

  const loadStoredMessages = async (sessionId: string) => {
    try {
      const storedMsgs = await connector.getMessages(sessionId);
      if (storedMsgs) {
        const formatted = storedMsgs.map((m) => ({
          text: m.content,
          sender: (m.sender === 'user' ? 'user' : 'bot') as 'user' | 'bot'
        }));
        setMessages(formatted);
      } else {
        setMessages([]);
      }
    } catch (err) {
      console.error('Error fetching chat history from SQLite:', err);
    }
  };

  // Load chat messages and sessions from backend SQLite DB on startup
  useEffect(() => {
    loadSessions();
    loadStoredMessages(activeSessionId);
  }, [activeSessionId]);

  const handleSendMessage = async (message: string, onChunk?: (chunk: string) => void): Promise<string> => {
    const result = await connector.sendMessage(message, activeSessionId, onChunk);
    const response = typeof result === 'string' ? result : result.response;
    
    // Refresh sessions list after message save
    loadSessions();
    
    return response;
  };

  const toggleHistory = () => {
    setShowHistory((prev) => !prev);
  };

  const handleNewChat = () => {
    const newSessionId = `session_${Date.now()}`;
    setActiveSessionId(newSessionId);
    setMessages([]);
  };

  const handleSelectSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
    loadStoredMessages(sessionId);
  };

  const handleSelectPrompt = (promptText: string) => {
    setMessages((prev) => [...prev, { text: promptText, sender: 'user' }]);
    let botMsgAdded = false;

    connector.sendMessage(promptText, activeSessionId, (chunk: string) => {
      if (!botMsgAdded) {
        botMsgAdded = true;
        setMessages((prev) => [...prev, { text: chunk, sender: 'bot' }]);
      } else {
        setMessages((prev) => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (lastIdx >= 0 && updated[lastIdx].sender === 'bot') {
            updated[lastIdx] = {
              ...updated[lastIdx],
              text: updated[lastIdx].text + chunk
            };
          }
          return updated;
        });
      }
    })
      .then(() => {
        loadSessions();
      })
      .catch((err: any) => {
        const errorMsg = err?.message || 'Failed to send message.';
        if (!botMsgAdded) {
          setMessages((prev) => [...prev, { text: `⚠️ **Error**: ${errorMsg}`, sender: 'bot' }]);
        } else {
          setMessages((prev) => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            if (lastIdx >= 0 && updated[lastIdx].sender === 'bot') {
              updated[lastIdx] = {
                ...updated[lastIdx],
                text: updated[lastIdx].text + `\n\n⚠️ **Error**: ${errorMsg}`
              };
            }
            return updated;
          });
        }
      });
  };

  const handleClearHistory = async () => {
    try {
      await connector.clearMessages(activeSessionId);
    } catch (e) {
      console.error('Failed to clear messages', e);
    }
    setMessages([]);
    loadSessions();
  };

  return (
    <div className="flex flex-1 h-full w-full relative overflow-hidden bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100">
      <HistoryPanel 
        showHistory={showHistory} 
        onClose={() => setShowHistory(false)}
        onNewChat={handleNewChat}
        onSelectPrompt={handleSelectPrompt}
        onSelectSession={handleSelectSession}
        activeSessionId={activeSessionId}
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


