import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useVirtualizer } from '@tanstack/react-virtual';
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
  FiTerminal,
  FiCpu,
  FiChevronDown,
  FiChevronRight,
  FiDownload
} from 'react-icons/fi';

import { useDarkMode } from '../contexts/DarkModeContext';

interface ChatbotProps {
  onSendMessage: (message: string, onChunk?: (chunk: string) => void) => Promise<string>;
  toggleHistory: () => void;
  messages: { text: string; sender: 'user' | 'bot' }[];
  setMessages: (
    messages: 
      | { text: string; sender: 'user' | 'bot' }[]
      | ((prevMessages: { text: string; sender: 'user' | 'bot' }[]) => { text: string; sender: 'user' | 'bot' }[])
  ) => void;
}

const REMARK_PLUGINS = [remarkGfm];

const downloadTextFile = (content: string, filename: string, mimeType = 'text/plain;charset=utf-8') => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const extensionForLanguage = (language: string) => {
  const normalized = language.toLowerCase();
  if (['js', 'javascript', 'suitescript'].includes(normalized)) return 'js';
  if (['ts', 'typescript'].includes(normalized)) return 'ts';
  if (['sql', 'suiteql'].includes(normalized)) return 'sql';
  if (['json'].includes(normalized)) return 'json';
  if (['html'].includes(normalized)) return 'html';
  if (['css'].includes(normalized)) return 'css';
  return 'txt';
};

class MessageRenderBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Message render failed:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-medium text-rose-600 dark:text-rose-300">
          This message could not be rendered safely. Use copy/export to inspect the raw response.
        </div>
      );
    }

    return this.props.children;
  }
}

// Formatted Code Block Component with Copy Button
const CodeBlock: React.FC<{ code: string; language: string }> = React.memo(({ code, language }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const ext = extensionForLanguage(language || 'code');
    downloadTextFile(code, `suite-forge-snippet.${ext}`);
  };

  return (
    <div className="my-3 rounded-xl border border-slate-700/80 bg-slate-950 overflow-hidden shadow-lg max-w-full min-w-0">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-slate-400 text-xs font-mono">
        <span className="flex items-center gap-1.5 font-semibold text-slate-300 uppercase truncate max-w-[70%]">
          <FiTerminal className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          {language || 'code'}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleDownload}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors text-[11px] font-sans"
            title="Download code snippet"
            aria-label="Download code snippet"
          >
            <FiDownload className="w-3 h-3" />
            <span className="hidden sm:inline">Download</span>
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors text-[11px] font-sans"
            aria-label="Copy code snippet"
          >
            {copied ? (
              <>
                <FiCheck className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400 font-medium">Copied</span>
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
      <div className="p-4 overflow-x-auto max-w-full">
        <pre className="text-xs font-mono text-indigo-100 leading-relaxed whitespace-pre-wrap sm:whitespace-pre break-words">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
});

CodeBlock.displayName = 'CodeBlock';

// Rich Markdown Text Formatter using react-markdown
const FormattedMessage: React.FC<{ text: string; isUser?: boolean }> = React.memo(({ text, isUser = false }) => {
  return (
    <div className={`text-sm leading-relaxed max-w-full min-w-0 break-words [overflow-wrap:anywhere] ${isUser ? 'text-white' : ''}`}>
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        components={{
          pre({ children }) {
            return <>{children}</>;
          },
          code({ className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            const codeString = String(children).replace(/\n$/, '');
            const isMultiLine = codeString.includes('\n');

            if (match || isMultiLine) {
              return (
                <CodeBlock
                  code={codeString}
                  language={match ? match[1] : ''}
                />
              );
            }

            return (
              <code
                className={`px-1.5 py-0.5 rounded font-mono text-[13px] border break-all inline-block max-w-full overflow-x-auto ${
                  isUser
                    ? 'bg-indigo-700/80 text-indigo-100 border-indigo-500/60'
                    : 'bg-slate-800/90 text-indigo-300 dark:text-indigo-200 border-slate-700/60'
                }`}
                {...props}
              >
                {children}
              </code>
            );
          },
          p({ children }) {
            return <p className="leading-relaxed mb-2.5 last:mb-0 break-words [overflow-wrap:anywhere]">{children}</p>;
          },
          ul({ children }) {
            return <ul className="list-disc list-outside pl-5 space-y-1 my-2 break-words">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal list-outside pl-5 space-y-1 my-2 break-words">{children}</ol>;
          },
          li({ children }) {
            return <li className="leading-relaxed pl-0.5 break-words">{children}</li>;
          },
          h1({ children }) {
            return <h1 className="text-lg font-bold my-3 border-b border-slate-700/60 pb-1 break-words">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="text-base font-bold my-2.5 break-words">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="text-sm font-bold my-2 break-words">{children}</h3>;
          },
          blockquote({ children }) {
            return (
              <blockquote
                className={`border-l-4 pl-3.5 py-1 my-2.5 italic rounded-r-md break-words ${
                  isUser
                    ? 'border-indigo-300 bg-indigo-700/40 text-indigo-100'
                    : 'border-indigo-500/80 bg-indigo-950/20 text-slate-300'
                }`}
              >
                {children}
              </blockquote>
            );
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto max-w-full my-3 rounded-lg border border-slate-700/80 shadow-md block">
                <table className="min-w-full divide-y divide-slate-700/80 text-left text-xs">
                  {children}
                </table>
              </div>
            );
          },
          thead({ children }) {
            return <thead className="bg-slate-900/90 text-slate-200 font-semibold">{children}</thead>;
          },
          tbody({ children }) {
            return <tbody className="divide-y divide-slate-800/80 bg-slate-950/50">{children}</tbody>;
          },
          tr({ children }) {
            return <tr className="hover:bg-slate-800/40 transition-colors">{children}</tr>;
          },
          th({ children }) {
            return <th className="px-3 py-2 text-slate-200 font-semibold break-words">{children}</th>;
          },
          td({ children }) {
            return <td className="px-3 py-2 text-slate-300 font-mono text-xs break-words">{children}</td>;
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={`${
                  isUser ? 'text-indigo-200 hover:text-white' : 'text-indigo-400 hover:text-indigo-300'
                } underline underline-offset-2 transition-colors font-medium break-all`}
              >
                {children}
              </a>
            );
          },
          hr() {
            return <hr className={`my-4 ${isUser ? 'border-indigo-400/40' : 'border-slate-700/60'}`} />;
          }
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
});

FormattedMessage.displayName = 'FormattedMessage';

// Helper to parse thinking content vs actual response
const parseThinkingAndResponse = (text: string) => {
  if (!text) {
    return { thinkingContent: null, actualResponse: '', isThinkingActive: false };
  }

  const thinkingParts: string[] = [];
  let remainingText = text;
  let isThinkingActive = false;

  // 1. Parse <think>...</think> tags (complete or active streaming)
  let thinkStart = remainingText.indexOf('<think>');
  while (thinkStart !== -1) {
    const thinkEnd = remainingText.indexOf('</think>', thinkStart);
    if (thinkEnd !== -1) {
      const extracted = remainingText.substring(thinkStart + 7, thinkEnd).trim();
      if (extracted) thinkingParts.push(extracted);
      remainingText = remainingText.substring(0, thinkStart) + remainingText.substring(thinkEnd + 8);
    } else {
      const extracted = remainingText.substring(thinkStart + 7).trim();
      if (extracted) thinkingParts.push(extracted);
      remainingText = remainingText.substring(0, thinkStart);
      isThinkingActive = true;
      break;
    }
    thinkStart = remainingText.indexOf('<think>');
  }

  // 2. Parse stringified dict thinking patterns (e.g. {'type': 'thinking', ...})
  const dictThinkingPattern = /\{['"]type['"]:\s*['"]thinking['"](?:,\s*['"](?:thinking|text|content)['"]:\s*['"]([\s\S]*?)['"])?[\s\S]*?\}/gi;
  remainingText = remainingText.replace(dictThinkingPattern, (_, thinkingVal) => {
    if (thinkingVal) {
      const cleanVal = thinkingVal.replace(/\\n/g, '\n').replace(/\\'/g, "'").replace(/\\"/g, '"').trim();
      if (cleanVal) thinkingParts.push(cleanVal);
    }
    return '';
  });

  // Handle trailing partial dict string like "{'type': 'thinking', ..." while streaming
  const trailingThinkingDict = /\{['"]type['"]:\s*['"]thinking['"][\s\S]*$/i;
  if (trailingThinkingDict.test(remainingText)) {
    isThinkingActive = true;
    remainingText = remainingText.replace(trailingThinkingDict, (match) => {
      const matchClean = match
        .replace(/\{['"]type['"]:\s*['"]thinking['"],?\s*/i, '')
        .replace(/['"](?:thinking|text|content)['"]:\s*/i, '')
        .replace(/^['"]|['"]$/g, '')
        .trim();
      if (matchClean) thinkingParts.push(matchClean);
      return '';
    });
  }

  // 3. Parse stringified text dict patterns, e.g. [{'type': 'text', 'text': '{"success":false,"error":...}'}] or {'type': 'text', 'text': '...'}
  const isToolPayload = (str: string) => /"method"|'method'|"success"|'success'|"error"|'error'|"params"|'params'|"result"|'result'/i.test(str);

  const dictTextPattern = /\{['"]type['"]:\s*['"]text['"][\s\S]*?['"]text['"]:\s*['"]([\s\S]*?)['"][\s\S]*?\}/gi;
  remainingText = remainingText.replace(dictTextPattern, (_, innerText) => {
    if (!innerText) return '';
    const cleanInner = innerText.replace(/\\n/g, '\n').replace(/\\'/g, "'").replace(/\\"/g, '"').trim();
    if (isToolPayload(cleanInner)) {
      thinkingParts.push(`Tool Payload: ${cleanInner}`);
      return '';
    }
    return cleanInner;
  });

  // Handle full array wrappers like [{'type': 'text', 'text': '...'}]
  const fullArrayPattern = /\[?\s*\{['"]type['"]:\s*['"]text['"][\s\S]*?\}?\s*\]?/gi;
  remainingText = remainingText.replace(fullArrayPattern, (fullMatch) => {
    const textMatch = fullMatch.match(/['"]text['"]:\s*['"]([\s\S]*?)['"]/i);
    if (textMatch && textMatch[1]) {
      const cleanVal = textMatch[1].replace(/\\n/g, '\n').replace(/\\'/g, "'").replace(/\\"/g, '"').trim();
      if (isToolPayload(cleanVal)) {
        thinkingParts.push(`Tool Payload: ${cleanVal}`);
        return '';
      }
      return cleanVal;
    }
    return '';
  });

  // 4. Handle any raw tool result strings like {"success":false,"error":...} or {"method":...} in text
  const rawToolPayloadPattern = /\{['"](?:method|success|error|result)['"]:\s*[\s\S]*?\}/gi;
  remainingText = remainingText.replace(rawToolPayloadPattern, (payloadMatch) => {
    thinkingParts.push(`Tool Payload: ${payloadMatch.trim()}`);
    return '';
  });

  // 5. Handle [Thinking: ...] bracketed format
  const altMatch = remainingText.match(/^\[Thinking:\s*([\s\S]*?)\]\n*([\s\S]*)$/i);
  if (altMatch) {
    thinkingParts.push(altMatch[1].trim());
    remainingText = altMatch[2].trim();
  }



  const thinkingContent = thinkingParts.length > 0 ? thinkingParts.join('\n\n') : null;
  const actualResponse = remainingText.trim();

  return { thinkingContent, actualResponse, isThinkingActive };
};


// Foldable Thinking Process Component
const FoldableThinking: React.FC<{ thinkingText: string; isActive?: boolean }> = React.memo(({ thinkingText, isActive = false }) => {
  const [isOpen, setIsOpen] = useState(isActive);

  useEffect(() => {
    if (isActive) {
      setIsOpen(true);
    }
  }, [isActive]);

  return (
    <div className="mb-3 rounded-xl border border-indigo-500/20 dark:border-indigo-900/40 bg-indigo-50/50 dark:bg-slate-900/60 overflow-hidden text-xs transition-all">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-indigo-100/50 dark:hover:bg-slate-800/60 transition-colors text-slate-600 dark:text-slate-300 font-medium"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-indigo-500/10 text-indigo-500 dark:text-indigo-400">
            <FiCpu className={`w-3.5 h-3.5 ${isActive ? 'animate-spin' : ''}`} />
          </div>
          <span className="font-medium text-slate-700 dark:text-slate-200">
            {isActive ? 'Thinking in progress...' : 'Thought Process'}
          </span>
          {isActive && (
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
          <span>{isOpen ? 'Hide' : 'Show'}</span>
          {isOpen ? <FiChevronDown className="w-3.5 h-3.5" /> : <FiChevronRight className="w-3.5 h-3.5" />}
        </div>
      </button>

      {isOpen && (
        <div className="p-3 border-t border-indigo-500/10 dark:border-slate-800/80 bg-white/40 dark:bg-slate-950/70 text-slate-600 dark:text-slate-300 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto">
          {thinkingText || <span className="italic text-slate-400">Analyzing prompt and querying NetSuite context...</span>}
        </div>
      )}
    </div>
  );
});

FoldableThinking.displayName = 'FoldableThinking';



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

  const isStreamingRef = useRef(false);
  const chunkBufferRef = useRef('');
  const rafIdRef = useRef<number | null>(null);
  const virtualRowCount = messages.length + (isThinking ? 1 : 0);
  const messageVirtualizer = useVirtualizer({
    count: virtualRowCount,
    getScrollElement: () => messageListRef.current,
    estimateSize: (index) => {
      if (index >= messages.length) return 96;
      return messages[index].sender === 'user' ? 120 : 220;
    },
    overscan: 6,
  });

  const flushChunkBuffer = () => {
    if (chunkBufferRef.current) {
      const toAppend = chunkBufferRef.current;
      chunkBufferRef.current = '';
      setMessages((prev) => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (lastIdx >= 0 && updated[lastIdx].sender === 'bot') {
          updated[lastIdx] = {
            ...updated[lastIdx],
            text: updated[lastIdx].text + toAppend
          };
        }
        return updated;
      });
    }
    rafIdRef.current = null;
  };

  const scheduleChunkFlush = () => {
    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(flushChunkBuffer);
    }
  };

  useEffect(() => {
    if (virtualRowCount === 0) return;

    messageVirtualizer.scrollToIndex(virtualRowCount - 1, {
      align: 'end',
      behavior: isThinking || isStreamingRef.current ? 'auto' : 'smooth'
    });
  }, [messages, isThinking, messageVirtualizer, virtualRowCount]);

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
    if (textToSend.trim() === '' || isThinking || isStreamingRef.current) return;

    setMessages((prev) => [...prev, { text: textToSend, sender: 'user' }]);
    if (!customPrompt) setInputValue('');
    setIsThinking(true);
    isStreamingRef.current = true;

    let hasReceivedChunk = false;

    try {
      await onSendMessage(textToSend, (chunk: string) => {
        if (!hasReceivedChunk) {
          hasReceivedChunk = true;
          setIsThinking(false);
          setMessages((prev) => [...prev, { text: chunk, sender: 'bot' }]);
        } else {
          chunkBufferRef.current += chunk;
          scheduleChunkFlush();
        }
      });
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to communicate with NetSuite MCP. Please check API settings.';
      setIsThinking(false);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      flushChunkBuffer();

      if (!hasReceivedChunk) {
        setMessages((prev) => [...prev, { text: `Warning: **Error**: ${errorMsg}`, sender: 'bot' }]);
      } else {
        setMessages((prev) => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (lastIdx >= 0 && updated[lastIdx].sender === 'bot') {
            updated[lastIdx] = {
              ...updated[lastIdx],
              text: updated[lastIdx].text + `\n\nWarning: **Error**: ${errorMsg}`
            };
          }
          return updated;
        });
      }
    } finally {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      flushChunkBuffer();
      setIsThinking(false);
      isStreamingRef.current = false;
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

  const handleExportChat = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const transcript = messages
      .map((message) => {
        const label = message.sender === 'user' ? 'User' : 'Assistant';
        return `## ${label}\n\n${message.text.trim() || '_Empty message_'}`;
      })
      .join('\n\n---\n\n');

    downloadTextFile(
      `# Suite Forge Conversation\n\nExported: ${new Date().toLocaleString()}\n\n${transcript}\n`,
      `suite-forge-conversation-${timestamp}.md`,
      'text/markdown;charset=utf-8'
    );
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
              onClick={handleExportChat}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-slate-500 hover:bg-slate-200/60 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100 transition-colors font-medium"
              title="Export active conversation as Markdown"
            >
              <FiDownload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>
          )}
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
          <div
            className="max-w-4xl mx-auto relative"
            style={{ height: `${messageVirtualizer.getTotalSize()}px` }}
          >
            {messageVirtualizer.getVirtualItems().map((virtualRow) => {
              const index = virtualRow.index;
              const isThinkingRow = index >= messages.length;

              if (isThinkingRow) {
                return (
                  <div
                    key="thinking-indicator"
                    ref={messageVirtualizer.measureElement}
                    data-index={index}
                    className="absolute left-0 top-0 w-full pb-6"
                    style={{ transform: `translateY(${virtualRow.start}px)` }}
                  >
                    <div className="flex gap-3 sm:gap-4 animate-slide-up w-full">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 text-white flex items-center justify-center shrink-0 shadow-md">
                        <FiZap className="w-4 h-4 animate-pulse" />
                      </div>
                      <div className="flex flex-col min-w-0 max-w-[85%] sm:max-w-[78%] mr-auto">
                        <div className={`p-4 rounded-2xl rounded-tl-xs border min-w-0 max-w-full overflow-hidden ${
                          isDarkMode ? 'bg-slate-800/80 border-slate-700/80 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
                        }`}>
                          <FoldableThinking thinkingText="Analyzing prompt and querying NetSuite MCP context..." isActive={true} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              const message = messages[index];
              const isUser = message.sender === 'user';

              return (
                <div
                  key={`${message.sender}-${index}`}
                  ref={messageVirtualizer.measureElement}
                  data-index={index}
                  className="absolute left-0 top-0 w-full pb-6"
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                >
                  <div className={`flex gap-3 sm:gap-4 ${isUser ? 'flex-row-reverse' : 'flex-row'} animate-slide-up group w-full`}>
                    {/* Avatar */}
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold shadow-md ${
                      isUser
                        ? 'bg-slate-700 text-white'
                        : 'bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 text-white'
                    }`}>
                      {isUser ? <FiUser className="w-4 h-4" /> : <FiZap className="w-4 h-4" />}
                    </div>

                    {/* Message Bubble Container */}
                    <div className={`flex flex-col min-w-0 max-w-[85%] sm:max-w-[78%] ${isUser ? 'items-end ml-auto' : 'items-start mr-auto'}`}>
                      <div
                        className={`p-4 rounded-2xl shadow-sm border transition-all min-w-0 max-w-full overflow-hidden break-words [overflow-wrap:anywhere] ${
                        isUser
                          ? 'bg-indigo-600 text-white border-indigo-500 rounded-tr-xs'
                          : isDarkMode
                            ? 'bg-slate-800/80 text-slate-100 border-slate-700/80 rounded-tl-xs'
                            : 'bg-white text-slate-800 border-slate-200 rounded-tl-xs shadow-slate-100'
                      }`}
                        aria-live={isUser ? undefined : 'polite'}
                      >

                        {!isUser ? (
                          (() => {
                            const { thinkingContent, actualResponse, isThinkingActive } = parseThinkingAndResponse(message.text);
                            return (
                              <MessageRenderBoundary>
                                {(thinkingContent !== null || isThinkingActive) && (
                                  <FoldableThinking thinkingText={thinkingContent || ''} isActive={isThinkingActive} />
                                )}
                                {actualResponse ? (
                                  <FormattedMessage text={actualResponse} isUser={false} />
                                ) : isThinkingActive ? (
                                  <div className="flex items-center gap-2 text-xs text-slate-400 italic font-mono py-1">
                                    <FiCpu className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                                    Generating response...
                                  </div>
                                ) : null}
                              </MessageRenderBoundary>
                            );
                          })()
                        ) : (
                          <MessageRenderBoundary>
                            <FormattedMessage text={message.text} isUser={true} />
                          </MessageRenderBoundary>
                        )}
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
                </div>
              );
            })}
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
            aria-haspopup="menu"
            aria-expanded={showAttachmentMenu}
            aria-label="Insert NetSuite template snippet"
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
              aria-label="Chat prompt"
            />

            <button
              onClick={() => handleSendMessage()}
              disabled={!inputValue.trim() || isThinking}
              className={`p-2.5 rounded-xl text-white transition-all shrink-0 ${
                inputValue.trim() && !isThinking
                  ? 'bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/30 active:scale-95'
                  : 'bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed opacity-60'
              }`}
              aria-label="Send message"
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
