import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { 
  FiX, 
  FiDatabase, 
  FiCpu, 
  FiKey, 
  FiCheckCircle, 
  FiAlertCircle, 
  FiEye, 
  FiEyeOff, 
  FiLayers, 
  FiExternalLink,
  FiRefreshCw,
  FiChevronDown, 
  FiChevronRight, 
  FiTool,
  FiSearch,
  FiCopy,
  FiCheck,
  FiCode,
  FiBox
} from 'react-icons/fi';
import { connector } from './NetSuiteConnector';

interface Modelname {
  name: string;
  displayName: string;
}

interface ConfigModalProps {
  onClose: () => void;
  isDarkMode: boolean;
  modelList: Modelname[];
  setModelList: (modelList: Modelname[]) => void;
  apiProvider: string;
  setApiProvider: (apiProvider: string) => void;
  apiKey: string;
  setApiKey: (apiKey: string) => void;
  selectedModel: string;
  setSelectedModel: (selectedModel: string) => void;
  inUseModelName: string | null;
  setInUseModelName: (inUseModelName: string | null) => void;
  onConfigSaved?: () => void;
}

const ConfigModal: React.FC<ConfigModalProps> = ({ 
  onClose, 
  isDarkMode, 
  modelList, 
  setModelList, 
  apiProvider, 
  setApiProvider, 
  apiKey, 
  setApiKey, 
  selectedModel, 
  setSelectedModel, 
  inUseModelName, 
  setInUseModelName,
  onConfigSaved
}) => {
  const [activeTab, setActiveTab] = useState<'netsuite' | 'ai' | 'mcp'>('netsuite');
  const [accountId, setAccountId] = useState('');
  const [clientId, setClientId] = useState('');
  const [loading, setLoading] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [hasSavedApiKey, setHasSavedApiKey] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [mcpTools, setMcpTools] = useState<any[]>([]);
  const [fetchingTools, setFetchingTools] = useState(false);
  const [toolSearchQuery, setToolSearchQuery] = useState('');
  const [expandedTool, setExpandedTool] = useState<string | null>(null);
  const [copiedToolName, setCopiedToolName] = useState<string | null>(null);
  const [showClientId, setShowClientId] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const toolListRef = useRef<HTMLDivElement>(null);

  const notifyConfigUpdated = useCallback(() => {
    onConfigSaved?.();
    window.dispatchEvent(new CustomEvent('suite_forge_config_updated'));
  }, [onConfigSaved]);

  const handleClose = useCallback(() => {
    notifyConfigUpdated();
    onClose();
  }, [notifyConfigUpdated, onClose]);

  const getCacheConfig = useCallback(async () => {
    try {
      const config = await connector.getConfig();
      setHasSavedApiKey(config.has_api_key);
      if (config.api_provider) setApiProvider(config.api_provider);
      if (config.selected_model) {
        setSelectedModel(config.selected_model);
        setInUseModelName(config.selected_model);
      }
      if (config.netsuite_account_id) setAccountId(config.netsuite_account_id);
      if (config.client_id) setClientId(config.client_id);
      if (!config.has_api_key) setApiKey('');
    } catch (err) {
      console.error("Failed to load initial configuration:", err);
    }
  }, [setApiProvider, setSelectedModel, setInUseModelName, setAccountId, setClientId, setApiKey]);

  const fetchMcpTools = useCallback(async () => {
    setFetchingTools(true);
    setFeedback(null);
    try {
      const data = await connector.getToolsList();
      const toolsList = Array.isArray(data) ? data : (data?.tools || []);
      setMcpTools(toolsList);
      setFeedback({
        type: 'success',
        message: `Successfully loaded ${toolsList.length} MCP tool${toolsList.length === 1 ? '' : 's'} from server.`
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `Failed to fetch MCP tools list: ${err?.message || 'Server connection error'}`
      });
    } finally {
      setFetchingTools(false);
    }
  }, []);

  const handleSelectMcpTab = useCallback(() => {
    setActiveTab('mcp');
    setFeedback(null);
    if (mcpTools.length === 0 && !fetchingTools) {
      fetchMcpTools();
    }
  }, [mcpTools.length, fetchingTools, fetchMcpTools]);

  useEffect(() => {
    getCacheConfig();
    closeButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
        return;
      }

      if (e.key !== 'Tab' || !modalRef.current) return;

      const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (!firstElement || !lastElement) return;

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    };

    const handleWindowMessage = (e: MessageEvent) => {
      if (e.data && (e.data.type === 'NETSUITE_AUTH_SUCCESS' || e.data === 'NETSUITE_AUTH_SUCCESS')) {
        setFeedback({ type: 'success', message: 'NetSuite authentication successful!' });
        getCacheConfig();
        notifyConfigUpdated();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('message', handleWindowMessage);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('message', handleWindowMessage);
    };
  }, []);

  const handleProviderChange = (provider: string) => {
    setApiProvider(provider);
    setModelList([]);
    setSelectedModel('');
    setInUseModelName(null);
    setApiKey('');
    setFeedback(null);
  };

  const handleNetsuiteAuth = async () => {
    if (!accountId.trim() || !clientId.trim()) {
      setFeedback({ type: 'error', message: 'Please enter both NetSuite Account ID and Client ID.' });
      return;
    }

    try {
      setLoading(true);
      setFeedback(null);
      const res = await connector.authenticateNetSuite(accountId, clientId);
      const popupWidth = window.screen.width * 0.8;
      const popupHeight = window.screen.height * 0.8;
      const left = (window.screen.width - popupWidth) / 2;
      const top = (window.screen.height - popupHeight) / 2;
      const windowFeatures = `width=${popupWidth},height=${popupHeight},left=${left},top=${top},scrollbars=yes,resizable=yes`;
      window.open(res.auth_url, "popupWindow", windowFeatures);
      setFeedback({ type: 'success', message: 'NetSuite OAuth pop-up opened. Please authorize access in the window.' });
      notifyConfigUpdated();
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Authentication failed: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  const fetchModels = async () => {
    if (!apiProvider) {
      setFeedback({ type: 'error', message: 'Please select an API provider first.' });
      return;
    }
    if (!apiKey && !hasSavedApiKey) {
      setFeedback({ type: 'error', message: 'Please enter a valid API key for your chosen provider.' });
      return;
    }

    try {
      setLoading(true);
      setFeedback(null);
      const models = await connector.fetchModels(apiProvider, apiKey);
      setModelList(models);
      if (models.length > 0) {
        setSelectedModel(models[0].name);
        setFeedback({ type: 'success', message: `Successfully fetched ${models.length} models for ${apiProvider.toUpperCase()}` });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Error fetching models: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  const useModel = async () => {
    if (!selectedModel) {
      setFeedback({ type: 'error', message: 'Please select a model from the dropdown.' });
      return;
    }

    const selectedObj = modelList.find(m => m.name === selectedModel);
    const displayName = selectedObj ? selectedObj.displayName : selectedModel;

    try {
      setLoading(true);
      setFeedback(null);
      await connector.useModel(selectedModel, apiProvider, apiKey);
      setInUseModelName(displayName);
      setFeedback({ type: 'success', message: `Model "${displayName}" is now active!` });
      notifyConfigUpdated();
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Failed to set model: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  const copyToolName = (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(name);
    setCopiedToolName(name);
    setTimeout(() => setCopiedToolName(null), 2000);
  };

  // Memoize Tool Filter Computation
  const filteredTools = useMemo(() => {
    const q = toolSearchQuery.toLowerCase().trim();
    if (!q) return mcpTools;
    return mcpTools.filter((t) => {
      const nameMatch = (t.name || '').toLowerCase().includes(q);
      const descMatch = (t.description || '').toLowerCase().includes(q);
      return nameMatch || descMatch;
    });
  }, [mcpTools, toolSearchQuery]);

  const toolVirtualizer = useVirtualizer({
    count: filteredTools.length,
    getScrollElement: () => toolListRef.current,
    estimateSize: useCallback((index: number) => expandedTool === filteredTools[index]?.name ? 240 : 96, [expandedTool, filteredTools]),
    overscan: 4,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 transition-opacity duration-200">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="system-configuration-title"
        className={`w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden transition-all flex flex-col ${
        isDarkMode 
          ? 'bg-slate-900 border-slate-800 text-slate-100' 
          : 'bg-white border-slate-200 text-slate-900'
      }`}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
              <FiLayers className="w-5 h-5" />
            </div>
            <div>
              <h2 id="system-configuration-title" className="text-lg font-bold tracking-tight">System Configuration</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Configure NetSuite MCP & AI Provider Credentials</p>
            </div>
          </div>
          <button 
            ref={closeButtonRef}
            onClick={handleClose} 
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
            aria-label="Close system configuration"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 pt-2 gap-2 bg-slate-50/50 dark:bg-slate-900/50" role="tablist" aria-label="Configuration sections">
          <button 
            role="tab"
            aria-selected={activeTab === 'netsuite'}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl border-b-2 transition-all cursor-pointer ${
              activeTab === 'netsuite' 
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900' 
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
            onClick={() => { setActiveTab('netsuite'); setFeedback(null); }}
          >
            <FiDatabase className="w-4 h-4" />
            NetSuite ERP
          </button>
          <button 
            role="tab"
            aria-selected={activeTab === 'mcp'}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl border-b-2 transition-all cursor-pointer ${
              activeTab === 'mcp' 
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900' 
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
            onClick={handleSelectMcpTab}
          >
            <FiTool className="w-4 h-4" />
            MCP Tools
            {mcpTools.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono">
                {mcpTools.length}
              </span>
            )}
          </button>
          <button 
            role="tab"
            aria-selected={activeTab === 'ai'}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl border-b-2 transition-all cursor-pointer ${
              activeTab === 'ai' 
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900' 
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
            onClick={() => { setActiveTab('ai'); setFeedback(null); }}
          >
            <FiCpu className="w-4 h-4" />
            AI Provider & Models
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto" role="tabpanel">
          {feedback && (
            <div className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
              feedback.type === 'success' 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
                : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
            }`} role="status" aria-live="polite">
              {feedback.type === 'success' ? (
                <FiCheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <FiAlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span className="font-medium">{feedback.message}</span>
            </div>
          )}

          {activeTab === 'netsuite' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 text-xs text-indigo-900 dark:text-indigo-200">
                <p className="font-medium mb-1">NetSuite OAuth 2.0 Token-Based Authentication</p>
                <p className="opacity-80">
                  Connect your NetSuite instance to query records, execute SuiteQL statements, and manage transactions seamlessly via MCP.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  NetSuite Account ID
                </label>
                <input 
                  id="netsuite-account-id"
                  type="text" 
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  placeholder="e.g. 1234567 or TSTDRV12345"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Integration Client ID
                </label>
                <div className="relative">
                  <FiKey className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input 
                    id="netsuite-client-id"
                    type={showClientId ? "text" : "password"} 
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="e.g. 849392... (NetSuite OAuth Client ID)"
                    className="w-full pl-9 pr-10 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-75"
                  />
                  <button
                    type="button"
                    onClick={() => setShowClientId(!showClientId)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    aria-label={showClientId ? 'Hide client ID' : 'Show client ID'}
                  >
                    {showClientId ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button 
                  onClick={handleNetsuiteAuth}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                >
                  {loading ? (
                    <>
                      <FiRefreshCw className="w-4 h-4 animate-spin" />
                      Connecting to NetSuite...
                    </>
                  ) : (
                    <>
                      <FiExternalLink className="w-4 h-4" />
                      Authenticate via NetSuite OAuth
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'mcp' && (
            <div className="space-y-4">
              {/* Info Header Banner */}
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-cyan-500/10 border border-indigo-500/20 flex items-start gap-3">
                <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-500 shrink-0 mt-0.5">
                  <FiBox className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Model Context Protocol (MCP) Registries
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    Inspect active endpoints, tools, and schemas registered on your Suite Forge MCP server.
                  </p>
                </div>
              </div>

              {/* Action Toolbar: Search & Refresh */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <FiSearch className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={toolSearchQuery}
                    onChange={(e) => setToolSearchQuery(e.target.value)}
                    placeholder="Search MCP tools by name or description..."
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    aria-label="Search MCP tools"
                  />
                  {toolSearchQuery && (
                    <button
                      onClick={() => setToolSearchQuery('')}
                      className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      aria-label="Clear MCP tool search"
                    >
                      <FiX className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  onClick={fetchMcpTools}
                  disabled={fetchingTools}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all shrink-0 active:scale-95 cursor-pointer"
                >
                  <FiRefreshCw className={`w-3.5 h-3.5 ${fetchingTools ? 'animate-spin text-white' : ''}`} />
                  <span>{fetchingTools ? 'Fetching Tools...' : 'Refresh Tools'}</span>
                </button>
              </div>

              {/* Tool List Container */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-sm overflow-hidden">
                {/* Status Bar */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      Tool Registry
                    </span>
                    {fetchingTools && (
                      <span className="text-[10px] text-indigo-500 font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                        Syncing with MCP...
                      </span>
                    )}
                  </div>

                  <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-semibold">
                    {filteredTools.length} {filteredTools.length === 1 ? 'tool' : 'tools'}
                  </span>
                </div>

                {/* Body List */}
                <div
                  ref={toolListRef}
                  className="max-h-80 overflow-y-auto p-3"
                >
                  {fetchingTools ? (
                    /* Skeleton Loading Animation */
                    <div className="py-8 px-4 space-y-3">
                      <div className="flex items-center justify-center gap-2 text-xs font-medium text-indigo-500 mb-4">
                        <FiRefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
                        <span>Querying MCP Server Tool Specifications...</span>
                      </div>
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-800/30 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="h-4 w-40 bg-slate-200 dark:bg-slate-700 rounded-md" />
                            <div className="h-3 w-12 bg-slate-200 dark:bg-slate-700 rounded-full" />
                          </div>
                          <div className="h-3 w-3/4 bg-slate-200 dark:bg-slate-700/60 rounded" />
                        </div>
                      ))}
                    </div>
                  ) : filteredTools.length === 0 ? (
                    /* Empty State */
                    <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                      <div className="mb-3 p-3.5 rounded-full bg-indigo-500/10 text-indigo-500">
                        <FiTool className="w-6 h-6" />
                      </div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {toolSearchQuery ? 'No Matching MCP Tools Found' : 'No MCP Tools Loaded'}
                      </h4>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">
                        {toolSearchQuery 
                          ? `No tools match your query "${toolSearchQuery}". Try clearing the search.`
                          : 'Click "Refresh Tools" to fetch registered tool endpoints from your backend MCP server.'}
                      </p>
                      {toolSearchQuery ? (
                        <button
                          onClick={() => setToolSearchQuery('')}
                          className="mt-3 px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                        >
                          Clear Search Filter
                        </button>
                      ) : (
                        <button
                          onClick={fetchMcpTools}
                          className="mt-3 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <FiRefreshCw className="w-3.5 h-3.5" />
                          Fetch Tools List
                        </button>
                      )}
                    </div>
                  ) : (
                    /* Tools List Items */
                    <div
                      className="relative"
                      style={{ height: `${toolVirtualizer.getTotalSize()}px` }}
                    >
                      {toolVirtualizer.getVirtualItems().map((virtualRow) => {
                        const tool = filteredTools[virtualRow.index];
                        if (!tool) return null;

                        const isExpanded = expandedTool === tool.name;
                        const hasProperties = tool.inputSchema?.properties && Object.keys(tool.inputSchema.properties).length > 0;
                        const reqList: string[] = tool.inputSchema?.required || [];

                        return (
                          <div
                            key={tool.name}
                            ref={toolVirtualizer.measureElement}
                            data-index={virtualRow.index}
                            onClick={() => setExpandedTool(isExpanded ? null : tool.name)}
                            className={`absolute left-0 top-0 w-full rounded-xl border transition-all duration-200 cursor-pointer ${
                              isExpanded
                                ? 'border-indigo-500/80 bg-indigo-50/40 dark:bg-indigo-950/20 shadow-md'
                                : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700'
                            }`}
                            style={{ transform: `translateY(${virtualRow.start}px)` }}
                            role="button"
                            tabIndex={0}
                            aria-expanded={isExpanded}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setExpandedTool(isExpanded ? null : tool.name);
                              }
                            }}
                          >
                            {/* Tool Header Card */}
                            <div className="p-3 flex items-start justify-between gap-3">
                              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500 shrink-0 mt-0.5">
                                  <FiTool className="w-4 h-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="font-mono text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                                      {tool.name}
                                    </h4>
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                                      MCP
                                    </span>
                                  </div>
                                  <p className={`mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed ${
                                    isExpanded ? '' : 'line-clamp-1'
                                  }`}>
                                    {tool.description || 'No description provided for this tool.'}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  onClick={(e) => copyToolName(tool.name, e)}
                                  title="Copy tool name"
                                  className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                                  aria-label={`Copy tool name ${tool.name}`}
                                >
                                  {copiedToolName === tool.name ? (
                                    <FiCheck className="w-3.5 h-3.5 text-emerald-500" />
                                  ) : (
                                    <FiCopy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                                <div className="text-slate-400">
                                  {isExpanded ? (
                                    <FiChevronDown className="w-4 h-4 text-indigo-500" />
                                  ) : (
                                    <FiChevronRight className="w-4 h-4" />
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Expanded Details & Input Schema */}
                            {isExpanded && (
                              <div className="px-3 pb-3.5 pt-1 border-t border-slate-200/80 dark:border-slate-800/80 mt-1 space-y-3">
                                {hasProperties ? (
                                  <div>
                                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                                      <FiCode className="w-3 h-3 text-indigo-400" />
                                      <span>Input Arguments Schema</span>
                                    </div>
                                    <div className="space-y-1.5">
                                      {Object.entries(tool.inputSchema.properties).map(([propKey, propVal]: [string, any]) => {
                                        const isReq = reqList.includes(propKey);
                                        return (
                                          <div
                                            key={propKey}
                                            className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs flex flex-col gap-0.5"
                                          >
                                            <div className="flex items-center justify-between gap-2">
                                              <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                                                {propKey}
                                              </span>
                                              <div className="flex items-center gap-1.5">
                                                <span className="font-mono text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                                  {propVal?.type || 'any'}
                                                </span>
                                                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                                                  isReq
                                                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300'
                                                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                                }`}>
                                                  {isReq ? 'Required' : 'Optional'}
                                                </span>
                                              </div>
                                            </div>
                                            {propVal?.description && (
                                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                                {propVal.description}
                                              </p>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-xs text-slate-400 italic">
                                    No input parameters required for this tool.
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="space-y-4">
              {/* Provider selection cards */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Select AI Provider
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: 'google', label: 'Google', badge: 'Gemini' },
                  ].map((prov) => (
                    <button
                      key={prov.id}
                      type="button"
                      onClick={() => handleProviderChange(prov.id)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        apiProvider === prov.id 
                          ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="font-semibold text-xs">{prov.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* API Key */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Provider API Key
                </label>
                <div className="relative">
                  <FiKey className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input 
                    type={showApiKey ? "text" : "password"} 
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  placeholder={apiProvider ? (hasSavedApiKey ? 'API key saved. Enter a new key to replace it.' : `Enter ${apiProvider.toUpperCase()} API Key...`) : "Select provider first"}
                    className="w-full pl-9 pr-10 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-75"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                  >
                    {showApiKey ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Model selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Available Model
                </label>
                <div className="flex gap-2">
                  <select 
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer"
                  >
                    {modelList.length === 0 ? (
                      <option value="">No models fetched yet. Click 'Fetch Models'.</option>
                    ) : (
                      modelList.map((model) => (
                        <option key={model.name} value={model.name}>{model.displayName}</option>
                      ))
                    )}
                  </select>

                  <button 
                    type="button"
                    onClick={fetchModels}
                    disabled={loading || !apiProvider || (!apiKey && !hasSavedApiKey)}
                    className="px-3.5 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold disabled:opacity-50 transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer"
                  >
                    {loading ? <FiRefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FiRefreshCw className="w-3.5 h-3.5" />}
                    Fetch
                  </button>
                </div>
              </div>

              {inUseModelName && (
                <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Active Model:</span>
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400 font-mono">{inUseModelName}</span>
                </div>
              )}

              <div className="pt-2">
                <button 
                  onClick={useModel}
                  disabled={loading || !selectedModel}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                >
                  <FiCheckCircle className="w-4 h-4" />
                  Save & Apply Model Configuration
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(ConfigModal);
