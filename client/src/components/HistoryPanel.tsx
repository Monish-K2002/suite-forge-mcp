
import React, { useState } from 'react';
import { 
  FiPlus, 
  FiMessageSquare, 
  FiTrash2, 
  FiSearch, 
  FiDatabase, 
  FiCode, 
  FiFileText, 
  FiCheckCircle, 
  FiLayers,
  FiX
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
  savedSessions?: HistoryItem[];
  onClearHistory?: () => void;
}

const PRESET_PROMPTS = [
  {
    icon: FiDatabase,
    category: 'SuiteQL Queries',
    title: 'Top Customers Query',
    prompt: 'Write a SuiteQL query to fetch the top 10 customers by revenue along with total order count.',
    badge: 'SQL'
  },
  {
    icon: FiCode,
    category: 'SuiteScript 2.1',
    title: 'RESTlet Script Template',
    prompt: 'Generate a SuiteScript 2.1 RESTlet script that handles GET requests to retrieve customer details by ID.',
    badge: 'JS'
  },
  {
    icon: FiFileText,
    category: 'Sales Orders',
    title: 'Sales Order Status Lookup',
    prompt: 'How do I query NetSuite Sales Orders pending fulfillment with their line items?',
    badge: 'ERP'
  },
  {
    icon: FiLayers,
    category: 'NetSuite Schema',
    title: 'Customer Record Schema',
    prompt: 'What are the standard field IDs and join keys for the Customer and Transaction records in NetSuite?',
    badge: 'Schema'
  }
];

const HistoryPanel: React.FC<HistoryPanelProps> = ({ 
  showHistory, 
  onClose,
  onNewChat, 
  onSelectPrompt,
  savedSessions = [],
  onClearHistory
}) => {
  const { isDarkMode } = useDarkMode();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredPrompts = PRESET_PROMPTS.filter(p => 
    p.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <aside 
      className={`fixed inset-y-16 left-0 z-20 w-80 transform transition-transform duration-300 ease-in-out border-r flex flex-col backdrop-blur-xl ${
        showHistory ? 'translate-x-0' : '-translate-x-full'
      } ${
        isDarkMode 
          ? 'bg-slate-900/95 border-slate-800 text-slate-200' 
          : 'bg-white/95 border-slate-200 text-slate-800'
      } shadow-xl`}
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
        <button
          onClick={() => {
            if (onNewChat) onNewChat();
            if (onClose) onClose();
          }}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-all shadow-md shadow-indigo-600/20 active:scale-[0.98]"
        >
          <FiPlus className="w-4 h-4" />
          <span>New Conversation</span>
        </button>

        {onClose && (
          <button
            onClick={onClose}
            className="p-2.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400"
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
            type="text"
            placeholder="Search templates & history..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-6">
        {/* Preset Prompt Shortcuts */}
        <div>
          <div className="flex items-center justify-between px-2 mb-2">
            <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              NetSuite Copilot Templates
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
                  className="w-full text-left p-2.5 rounded-xl border border-transparent hover:border-slate-200 dark:hover:border-slate-700/80 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition-all group flex items-start gap-2.5"
                >
                  <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform mt-0.5 shrink-0">
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
            <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              Recent History
            </span>
            {savedSessions.length > 0 && onClearHistory && (
              <button 
                onClick={onClearHistory}
                className="text-[11px] text-rose-500 hover:text-rose-600 flex items-center gap-1 font-medium"
              >
                <FiTrash2 className="w-3 h-3" />
                Clear
              </button>
            )}
          </div>

          {savedSessions.length === 0 ? (
            <div className="p-4 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800">
              <FiMessageSquare className="w-5 h-5 mx-auto text-slate-400 mb-1.5" />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No previous chat history stored yet.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {savedSessions.map((session) => (
                <div
                  key={session.id}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors flex items-center justify-between gap-2 group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FiMessageSquare className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="text-xs text-slate-700 dark:text-slate-300 truncate font-medium">
                      {session.title}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono shrink-0">
                    {session.timestamp}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between text-[11px] text-slate-400">
        <span className="flex items-center gap-1">
          <FiCheckCircle className="w-3 h-3 text-emerald-500" />
          Suite Forge Active
        </span>
        <span className="font-mono text-[10px]">v1.0.0</span>
      </div>
    </aside>
  );
};

export default HistoryPanel;

