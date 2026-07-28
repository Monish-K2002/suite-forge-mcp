import React, { useState, useRef, useEffect } from 'react';
import { 
  FiSend, 
  FiPlus, 
  FiClock, 
  FiZap, 
  FiCopy, 
  FiCheck, 
  FiUser, 
  FiCode, 
  FiDatabase, 
  FiFileText, 
  FiTrash2, 
  FiStar,
  FiCornerDownLeft,
  FiTerminal
} from 'react-icons/fi';
import { useDarkMode } from '../contexts/DarkModeContext';

interface ChatbotProps {
  onSendMessage: (message: string) => Promise<string>;
  toggleHistory: () => void;
  messages: { text: string; sender: 'user' | 'bot' }[];
  setMessages: (
    messages: 
      | { text: string; sender: 'user' | 'bot' }[]
      | ((prevMessages: { text: string; sender: 'user' | 'bot' }[]) => { text: string; sender: 'user' | 'bot' }[])
  ) => void;
}

// Formatted Code Block Component with Copy Button
const CodeBlock: React.FC<{ code: string; language: string }> = ({ code, language }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-xl border border-slate-700/80 bg-slate-950 overflow-hidden shadow-lg">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-slate-400 text-xs font-mono">
        <span className="flex items-center gap-1.5 font-semibold text-slate-300 uppercase">
          <FiTerminal className="w-3.5 h-3.5 text-indigo-400" />
          {language || 'code'}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors text-[11px] font-sans"
        >
          {copied ? (
            <>
              <FiCheck className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Copied!</span>
            </>
          ) : (
            <>
              <FiCopy className="w-3 h-3" />
              <span>Copy Code</span>
            </>
          )}
        </button>
      </div>
      <div className="p-4 overflow-x-auto">
        <pre className="text-xs font-mono text-indigo-100 leading-relaxed">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
};

// Rich Markdown Text Formatter
const FormattedMessage: React.FC<{ text: string }> = ({ text }) => {
  // Regex to split code blocks: ```lang ... ```
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.substring(lastIndex, match.index) });
    }
    parts.push({ type: 'code', language: match[1] || 'javascript', content: match[2].trim() });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.substring(lastIndex) });
  }

  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {parts.map((part, idx) => {
        if (part.type === 'code') {
          return <CodeBlock key={idx} code={part.content} language={part.language} />;
        }
        
        // Render regular text line breaks and simple inline formatting
        const paragraphs = part.content.split('\n\n');
        return (
          <div key={idx} className="space-y-2">
            {paragraphs.map((para, pIdx) => {
              if (!para.trim()) return null;
              
              // Handle line-by-line formatting
              const lines = para.split('\n');
              return (
                <p key={pIdx} className="leading-relaxed">
                  {lines.map((line, lIdx) => (
                    <React.Fragment key={lIdx}>
                      {lIdx > 0 && <br />}
                      {line.startsWith('- ') || line.startsWith('* ') ? (
                        <span className="flex items-start gap-2 my-1 pl-2">
                          <span className="text-indigo-400 font-bold">•</span>
                          <span>{line.substring(2)}</span>
                        </span>
                      ) : (
                        line
                      )}
                    </React.Fragment>
                  ))}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

const HERO_PROMPTS = [
  {
    icon: FiDatabase,
    title: 'Run SuiteQL Statement',
    desc: 'Query NetSuite records & joined tables via SQL',
    prompt: 'Write a SuiteQL query to get top 5 Customers with open Sales Orders.',
    gradient: 'from-blue-500/20 to-indigo-500/20 border-blue-500/30'
  },
  {
    icon: FiCode,
    title: 'Generate SuiteScript 2.1',
    desc: 'Create User Event, Scheduled or RESTlet scripts',
    prompt: 'Write a SuiteScript 2.1 User Event script that logs customer field changes before submit.',
    gradient: 'from-purple-500/20 to-indigo-500/20 border-purple-500/30'
  },
  {
    icon: FiFileText,
    title: 'Sales Order Inspection',
    desc: 'Fetch order statuses, line items, and fulfillment state',
    prompt: 'Fetch pending fulfillment Sales Orders and list total amounts.',
    gradient: 'from-cyan-500/20 to-blue-500/20 border-cyan-500/30'
  },
  {
    icon: FiStar,
    title: 'NetSuite Record Schema',
    desc: 'Explore standard field IDs, joins & sublists',
    prompt: 'Show the standard schema and field IDs for Customer and Invoice records in NetSuite.',
    gradient: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/30'
  }
];

const Chatbot: React.FC<ChatbotProps> = ({ onSendMessage, toggleHistory, messages, setMessages }) => {
  const { isDarkMode } = useDarkMode();
  const [inputValue, setInputValue] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [copiedMsgIdx, setCopiedMsgIdx] = useState<number | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const attachmentButtonRef = useRef<HTMLButtonElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTo({
        top: messageListRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isThinking]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [inputValue]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (attachmentButtonRef.current && !attachmentButtonRef.current.contains(event.target as Node)) {
        setShowAttachmentMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = customPrompt || inputValue;
    if (textToSend.trim() === '' || isThinking) return;

    setMessages((prev) => [...prev, { text: textToSend, sender: 'user' }]);
    if (!customPrompt) setInputValue('');
    setIsThinking(true);

    try {
      const botResponse = await onSendMessage(textToSend);
      setMessages((prev) => [...prev, { text: botResponse, sender: 'bot' }]);
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to communicate with NetSuite MCP. Please check API settings.';
      setMessages((prev) => [...prev, { text: `⚠️ **Error**: ${errorMsg}`, sender: 'bot' }]);
    } finally {
      setIsThinking(false);
    }
  };

  const copyMessage = (index: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgIdx(index);
    setTimeout(() => setCopiedMsgIdx(null), 2000);
  };

  const handleClearChat = () => {
    if (messages.length > 0 && confirm('Are you sure you want to clear this conversation?')) {
      setMessages([]);
    }
  };

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 w-full relative overflow-hidden">
      {/* Top Action Subheader */}
      <div className="px-4 py-2.5 border-b backdrop-blur-md flex items-center justify-between z-10 transition-colors bg-white/40 border-slate-200/80 dark:bg-slate-900/40 dark:border-slate-800/80 shrink-0">
        <div className="flex items-center gap-2">
          <button 
            onClick={toggleHistory} 
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 transition-colors"
            title="Toggle Sidebar History & Templates"
          >
            <FiClock className="w-3.5 h-3.5 text-indigo-500" />
            <span className="hidden sm:inline">Templates & History</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={handleClearChat}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-rose-500 hover:bg-rose-500/10 transition-colors font-medium"
              title="Clear active conversation"
            >
              <FiTrash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear Chat</span>
            </button>
          )}
          <span className="text-[11px] font-mono text-slate-400">
            {messages.length} {messages.length === 1 ? 'message' : 'messages'}
          </span>
        </div>
      </div>

      {/* Main Conversation Scroll Body */}
      <div ref={messageListRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {messages.length === 0 ? (
          /* Empty State Hero Dashboard */
          <div className="max-w-3xl mx-auto py-8 sm:py-12 px-4 animate-fade-in text-center space-y-8">
            <div className="inline-flex items-center justify-center p-4 rounded-3xl bg-gradient-to-tr from-indigo-500/20 via-purple-500/20 to-cyan-500/20 border border-indigo-500/30 shadow-2xl shadow-indigo-500/10 mb-2">
              <FiZap className="w-10 h-10 text-indigo-500 animate-pulse" />
            </div>

            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                How can I assist your <span className="bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 bg-clip-text text-transparent">NetSuite Workspace</span> today?
              </h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
                Suite Forge combines MCP tool capabilities with LLM intelligence to execute SuiteQL queries, generate SuiteScript 2.1, and manage NetSuite records.
              </p>
            </div>

            {/* Quick Hero Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-left pt-2">
              {HERO_PROMPTS.map((card, index) => {
                const Icon = card.icon;
                return (
                  <button
                    key={index}
                    onClick={() => handleSendMessage(card.prompt)}
                    className={`p-4 rounded-2xl border bg-white/60 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800/80 transition-all duration-200 group text-left flex flex-col justify-between shadow-sm hover:shadow-md ${card.gradient}`}
                  >
                    <div>
                      <div className="flex items-center gap-2.5 mb-1.5">
                        <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500 group-hover:scale-110 transition-transform">
                          <Icon className="w-4 h-4" />
                        </div>
                        <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-500 transition-colors">
                          {card.title}
                        </h3>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                        {card.desc}
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-[11px] font-medium text-indigo-500 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span>Send prompt</span>
                      <FiCornerDownLeft className="w-3.5 h-3.5" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* Message List */
          <div className="max-w-4xl mx-auto space-y-6">
            {messages.map((message, index) => {
              const isUser = message.sender === 'user';
              return (
                <div 
                  key={index}
                  className={`flex gap-3 sm:gap-4 ${isUser ? 'flex-row-reverse' : 'flex-row'} animate-slide-up group`}
                >
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold shadow-md ${
                    isUser 
                      ? 'bg-slate-700 text-white' 
                      : 'bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 text-white'
                  }`}>
                    {isUser ? <FiUser className="w-4 h-4" /> : <FiZap className="w-4 h-4" />}
                  </div>

                  {/* Message Bubble */}
                  <div className={`flex flex-col max-w-[85%] sm:max-w-[78%] ${isUser ? 'items-end' : 'items-start'}`}>
                    <div className={`p-4 rounded-2xl shadow-sm border transition-all ${
                      isUser
                        ? 'bg-indigo-600 text-white border-indigo-500 rounded-tr-xs'
                        : isDarkMode
                          ? 'bg-slate-800/80 text-slate-100 border-slate-700/80 rounded-tl-xs'
                          : 'bg-white text-slate-800 border-slate-200 rounded-tl-xs shadow-slate-100'
                    }`}>
                      <FormattedMessage text={message.text} />
                    </div>

                    {/* Action Bar (Copy Button) */}
                    <div className={`mt-1 flex items-center gap-2 text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity px-1 ${
                      isUser ? 'justify-end' : 'justify-start'
                    }`}>
                      <button
                        onClick={() => copyMessage(index, message.text)}
                        className="hover:text-slate-200 transition-colors flex items-center gap-1"
                        title="Copy message content"
                      >
                        {copiedMsgIdx === index ? (
                          <>
                            <FiCheck className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <FiCopy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Thinking Indicator */}
            {isThinking && (
              <div className="flex gap-3 sm:gap-4 animate-slide-up">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 text-white flex items-center justify-center shrink-0 shadow-md">
                  <FiZap className="w-4 h-4 animate-pulse" />
                </div>
                <div className={`px-4 py-3 rounded-2xl rounded-tl-xs border flex items-center gap-3 ${
                  isDarkMode ? 'bg-slate-800/80 border-slate-700/80 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
                }`}>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce"></span>
                    <span className="w-2 h-2 rounded-full bg-purple-500 animate-bounce [animation-delay:0.2s]"></span>
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce [animation-delay:0.4s]"></span>
                  </div>
                  <span className="text-xs font-medium text-slate-400">
                    Suite Forge AI is querying NetSuite MCP...
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input Container Footer */}
      <div className="p-3 sm:p-4 border-t backdrop-blur-xl transition-colors bg-white/70 border-slate-200/80 dark:bg-slate-900/80 dark:border-slate-800/80 shrink-0">
        <div className="max-w-4xl mx-auto relative">
          {/* Quick Context Attachment Dropdown */}
          {showAttachmentMenu && (
            <div className="absolute bottom-full left-0 mb-2 w-72 p-2 rounded-2xl border shadow-2xl z-30 animate-fade-in bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-xs">
              <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Quick NetSuite Snippets
              </div>
              <div className="space-y-1 mt-1">
                {[
                  { label: 'SuiteQL Select Statement', snippet: 'SELECT id, entityid, companyname FROM customer WHERE isperson = \'T\'' },
                  { label: 'SuiteScript RESTlet Template', snippet: 'define([\'N/record\', \'N/search\'], function(record, search) { return { get: function(requestParams) {} }; });' },
                  { label: 'Sales Order Search', snippet: 'Query all Sales Orders created in the last 30 days.' }
                ].map((item, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setInputValue((prev) => (prev ? `${prev}\n${item.snippet}` : item.snippet));
                      setShowAttachmentMenu(false);
                    }}
                    className="w-full text-left p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors text-slate-700 dark:text-slate-200 font-mono text-[11px] truncate block"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Main Input Text Area Box */}
          <div className={`flex items-end gap-2 p-2 sm:p-2.5 rounded-2xl border transition-all ${
            isDarkMode 
              ? 'bg-slate-800/70 border-slate-700/80 focus-within:border-indigo-500/80 focus-within:ring-2 focus-within:ring-indigo-500/20' 
              : 'bg-slate-50 border-slate-200 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20'
          }`}>
            <button
              ref={attachmentButtonRef}
              onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors shrink-0"
              title="Insert NetSuite Template Snippet"
            >
              <FiPlus className="w-4 h-4" />
            </button>

            <textarea
              ref={textareaRef}
              rows={1}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Ask NetSuite Copilot or type SuiteQL query... (Press Enter to send)"
              className="flex-1 bg-transparent border-none outline-none resize-none text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 max-h-36 py-1 font-sans"
            />

            <button
              onClick={() => handleSendMessage()}
              disabled={!inputValue.trim() || isThinking}
              className={`p-2.5 rounded-xl text-white transition-all shrink-0 ${
                inputValue.trim() && !isThinking
                  ? 'bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/30 active:scale-95'
                  : 'bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed opacity-60'
              }`}
            >
              <FiSend className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center justify-between px-2 mt-1.5 text-[10px] text-slate-400">
            <span>Press <kbd className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[9px]">Shift+Enter</kbd> for new line</span>
            <span>NetSuite MCP Connected</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chatbot;