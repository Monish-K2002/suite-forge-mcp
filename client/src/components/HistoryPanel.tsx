import React, { useEffect, useRef, useState } from 'react';
import { 
  FiPlus, 
  FiMessageSquare, 
  FiTrash2, 
  FiSearch, 
  FiDatabase, 
  FiCode, 
  FiFileText, 
  FiLayers,
  FiX,
  FiBox
} from 'react-icons/fi';
import { useDarkMode } from '../contexts/DarkModeContext';

export interface HistoryItem {
  id: string;
  title: string;
  timestamp: string;
  messageCount: number;
}

interface HistoryPanelProps {
  showHistory: boolean;
  onClose?: () => void;
  onNewChat?: () => void;
  onSelectPrompt?: (promptText: string) => void;
  onSelectSession?: (sessionId: string) => void;
  activeSessionId?: string;
  savedSessions?: HistoryItem[];
  onClearHistory?: () => void;
}

// Starter prompts shown alongside saved conversations to help users begin common NetSuite tasks.
const PRESET_PROMPTS = [
  {
    icon: FiDatabase,
    category: 'SuiteQL Queries',
    title: 'Top Customers Revenue Query',
    prompt: 'Write a SuiteQL query to fetch top 10 customers by total revenue, including invoice amounts and order counts.',
    badge: 'SuiteQL'
  },
  {
    icon: FiCode,
    category: 'SuiteScript 2.1',
    title: 'RESTlet GET Endpoint Template',
    prompt: 'Create a SuiteScript 2.1 RESTlet script that accepts GET request parameters to retrieve Customer record fields by ID.',
    badge: 'RESTlet'
  },
  {
    icon: FiFileText,
    category: 'Sales & Inventory',
    title: 'Pending Fulfillment Orders',
    prompt: 'How do I query NetSuite Sales Orders currently pending fulfillment along with line items and item quantities?',
    badge: 'SalesOrder'
  },
  {
    icon: FiLayers,
    category: 'NetSuite Schema',
    title: 'Customer & Transaction Joins',
    prompt: 'What are the standard schema field names and foreign key joins between Customer and Transaction records in NetSuite?',
    badge: 'Schema'
  },
  {
    icon: FiBox,
    category: 'SuiteScript User Event',
    title: 'User Event Script BeforeSubmit',
    prompt: 'Provide a SuiteScript 2.1 User Event script template validating custom fields on beforeSubmit during record edit.',
    badge: 'UserEvent'
  }
];

// Searchable slide-out drawer for starter prompts and previously saved chat sessions.
const HistoryPanel: React.FC<HistoryPanelProps> = ({ 
  showHistory, 
  onClose,
  onNewChat, 
  onSelectPrompt,
  onSelectSession,
  activeSessionId = 'default',
  savedSessions = [],
  onClearHistory
}) => {
  const { isDarkMode } = useDarkMode();
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const focusSearch = () => {
      window.setTimeout(() => searchInputRef.current?.focus(), 0);
    };

    window.addEventListener('suite_forge_focus_history_search', focusSearch);
    return () => window.removeEventListener('suite_forge_focus_history_search', focusSearch);
  }, []);

  const filteredPrompts = PRESET_PROMPTS.filter(p => 
    p.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.prompt.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredSessions = savedSessions.filter(s =>
    s.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
    {showHistory && <button type="button" onClick={onClose} className="fixed inset-14 z-20 bg-slate-900/15 backdrop-blur-[1px] motion-enter" aria-label="Close history and prompts" />}
    <aside
      className={`fixed inset-y-14 left-0 z-20 flex w-[min(21rem,88vw)] transform flex-col border-r transition-transform duration-200 ease-out ${
        showHistory ? 'translate-x-0' : '-translate-x-full'
      } ${
        isDarkMode
          ? 'bg-[#1d2025] border-slate-800 text-slate-200'
          : 'bg-white border-slate-200 text-slate-800'
      } shadow-xl`}
      aria-label="Templates and conversation history"
      aria-hidden={!showHistory}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 p-4 dark:border-slate-800">
        <button
          onClick={() => {
            if (onNewChat) onNewChat();
            if (onClose) onClose();
          }}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-sky-700 hover:bg-sky-800 text-white font-medium text-sm transition-colors cursor-pointer"
        >
          <FiPlus className="w-4 h-4" />
          <span>New chat</span>
        </button>

        {onClose && (
          <button
            onClick={onClose}
            className="p-2.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-pointer"
            aria-label="Close history panel"
          >
            <FiX className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Search Input */}
      <div className="p-3 border-b border-slate-100 dark:border-slate-800/60">
        <div className="relative">
          <FiSearch className="absolute left-3 top-3 w-3.5 h-3.5 text-slate-400" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search prompts and chats"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            aria-label="Search templates and history"
          />
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-6">
        {/* Preset Prompt Shortcuts */}
        <div>
          <div className="flex items-center justify-between px-2 mb-2">
            <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              Prompts
            </span>
          </div>

          <div className="space-y-1.5">
            {filteredPrompts.map((item, idx) => {
              const IconComp = item.icon;
              return (
                <button
                  key={idx}
                  onClick={() => {
                    if (onSelectPrompt) onSelectPrompt(item.prompt);
                    if (onClose) onClose();
                  }}
                  className="w-full text-left p-2.5 rounded-xl border border-transparent hover:border-slate-200 dark:hover:border-slate-700/80 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition-all group flex items-start gap-2.5 cursor-pointer"
                >
                  <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 mt-0.5 shrink-0">
                    <IconComp className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {item.title}
                      </h4>
                      <span className="text-[9px] font-mono font-medium px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0">
                        {item.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5 leading-snug">
                      {item.prompt}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Previous Chat Sessions */}
        <div>
          <div className="flex items-center justify-between px-2 mb-2">
            <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">Recent chats</span>
            {savedSessions.length > 0 && onClearHistory && (
              <button 
                onClick={onClearHistory}
                className="text-[11px] text-rose-500 hover:text-rose-600 flex items-center gap-1 font-medium transition-colors cursor-pointer"
              >
                <FiTrash2 className="w-3.5 h-3.5" />
                Clear
              </button>
            )}
          </div>

          {filteredSessions.length === 0 ? (
            <div className="p-4 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800">
              <FiMessageSquare className="w-5 h-5 mx-auto text-slate-400 mb-1.5" />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {searchTerm ? 'No matching conversations found.' : 'No previous chat history stored yet.'}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredSessions.map((session) => {
                const isActive = session.id === activeSessionId;
                return (
                  <button
                    type="button"
                    key={session.id}
                    onClick={() => {
                      if (onSelectSession) onSelectSession(session.id);
                      if (onClose) onClose();
                    }}
                    className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all flex items-center justify-between gap-2 cursor-pointer ${
                      isActive 
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-900 dark:bg-indigo-950/60 dark:border-indigo-800 dark:text-indigo-200 font-semibold' 
                        : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FiMessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                      <span className="text-xs truncate font-medium">
                        {session.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[10px] text-slate-400 font-mono">
                        {session.timestamp ? session.timestamp.split('T')[0] : ''}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-400">Select a prompt to start a conversation.</div>
    </aside>
    </>
  );
};

export default React.memo(HistoryPanel);
