import { useState, useEffect } from 'react';
import Chatbot from './components/Chatbot';
import HistoryPanel from './components/HistoryPanel';
import type { HistoryItem } from './components/HistoryPanel';
import NetSuiteConnector, { connector } from './components/NetSuiteConnector';


export default function App() {
  const [showHistory, setShowHistory] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState('default');
  const [messages, setMessages] = useState<{ text: string; sender: 'user' | 'bot' }[]>([]);
  const [savedSessions, setSavedSessions] = useState<HistoryItem[]>([]);

  const loadSessions = async (accId?: string) => {
    try {
      const dbSessions = await connector.getSessions(accId);
      setSavedSessions(dbSessions || []);
      return dbSessions || [];
    } catch (e) {
      console.error('Failed to load sessions from SQLite DB', e);
      return [];
    }
  };

  const loadStoredMessages = async (sessionId: string, accId?: string) => {
    try {
      const storedMsgs = await connector.getMessages(sessionId, accId);
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

  const loadAccountAndData = async () => {
    try {
      const config = await connector.getConfig();
      const currentAccId = config.netsuite_account_id || '';
      const sessions = await loadSessions(currentAccId);

      const sessionExists = sessions.some((s: HistoryItem) => s.id === activeSessionId);

      if (sessionExists) {
        await loadStoredMessages(activeSessionId, currentAccId);
      } else if (sessions.length > 0) {
        const latestSessionId = sessions[0].id;
        setActiveSessionId(latestSessionId);
        await loadStoredMessages(latestSessionId, currentAccId);
      } else {
        setActiveSessionId('default');
        setMessages([]);
      }
    } catch (e) {
      console.error('Error loading account and chat data:', e);
    }
  };

  useEffect(() => {
    loadAccountAndData();

    const handleConfigUpdated = () => {
      loadAccountAndData();
    };

    window.addEventListener('suite_forge_config_updated', handleConfigUpdated);
    return () => {
      window.removeEventListener('suite_forge_config_updated', handleConfigUpdated);
    };
  }, []);

  useEffect(() => {
    const fetchSessionData = async () => {
      const config = await connector.getConfig().catch(() => ({ netsuite_account_id: '' }));
      const currentAccId = config.netsuite_account_id || '';
      loadStoredMessages(activeSessionId, currentAccId);
    };
    fetchSessionData();
  }, [activeSessionId]);

  const handleSendMessage = async (message: string, onChunk?: (chunk: string) => void): Promise<string> => {
    const result = await connector.sendMessage(message, activeSessionId, onChunk);
    const response = typeof result === 'string' ? result : result.response;
    
    // Refresh sessions list after message save for active account
    const config = await connector.getConfig().catch(() => ({ netsuite_account_id: '' }));
    loadSessions(config.netsuite_account_id || '');
    
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
  };

  const handleSelectPrompt = async (promptText: string) => {
    try {
      setMessages((prev) => [...prev, { text: promptText, sender: 'user' }]);
      let botMsgAdded = false;

      await handleSendMessage(promptText, (chunk: string) => {
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
      });
    } catch (err: any) {
      console.error('Error sending select prompt:', err);
    }
  };


  const handleClearHistory = async () => {
    try {
      const config = await connector.getConfig().catch(() => ({ netsuite_account_id: '' }));
      const currentAccId = config.netsuite_account_id || '';
      await connector.clearMessages(activeSessionId, currentAccId);
      loadSessions(currentAccId);
    } catch (e) {
      console.error('Failed to clear messages', e);
    }
    setMessages([]);
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


