
import React, { useState, useEffect } from 'react';
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
  FiRefreshCw
} from 'react-icons/fi';
import NetSuiteConnector from './NetSuiteConnector';

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
}

const connector = new NetSuiteConnector();

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
  setInUseModelName 
}) => {
  const [activeTab, setActiveTab] = useState<'netsuite' | 'ai'>('netsuite');
  const [accountId, setAccountId] = useState('');
  const [clientId, setClientId] = useState('');
  const [loading, setLoading] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const getCacheConfig = async () => {
    try {
      const config = await connector.getConfig();
      if (config.api_provider) setApiProvider(config.api_provider);
      if (config.selected_model) {
        setSelectedModel(config.selected_model);
        setInUseModelName(config.selected_model);
      }
      if (config.netsuite_account_id) setAccountId(config.netsuite_account_id);
    } catch (err) {
      console.error("Failed to load initial configuration:", err);
    }
  };

  useEffect(() => {
    getCacheConfig();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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
    if (!apiKey) {
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
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Failed to set model: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in">
      <div className={`w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden transition-all flex flex-col ${
        isDarkMode 
          ? 'bg-slate-900 border-slate-800 text-slate-100' 
          : 'bg-white border-slate-200 text-slate-900'
      }`}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
              <FiLayers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">System Configuration</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Configure NetSuite MCP & AI Provider Credentials</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 pt-2 gap-2 bg-slate-50/50 dark:bg-slate-900/50">
          <button 
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl border-b-2 transition-all ${
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
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl border-b-2 transition-all ${
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
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {feedback && (
            <div className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
              feedback.type === 'success' 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
                : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
            }`}>
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
                <input 
                  type="text" 
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="e.g. 849392... (NetSuite OAuth Client ID)"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>

              <div className="pt-2">
                <button 
                  onClick={handleNetsuiteAuth}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all"
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

          {activeTab === 'ai' && (
            <div className="space-y-4">
              {/* Provider selection cards */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Select AI Provider
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: 'openai', label: 'OpenAI', badge: 'GPT-4o' },
                    { id: 'anthropic', label: 'Anthropic', badge: 'Claude 3.5' },
                    { id: 'google', label: 'Google', badge: 'Gemini 1.5' },
                  ].map((prov) => (
                    <button
                      key={prov.id}
                      type="button"
                      onClick={() => handleProviderChange(prov.id)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        apiProvider === prov.id 
                          ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="font-semibold text-xs">{prov.label}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{prov.badge}</div>
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
                    disabled={Boolean(inUseModelName && apiKey && !loading)}
                    placeholder={apiProvider ? `Enter ${apiProvider.toUpperCase()} API Key...` : "Select provider first"}
                    className="w-full pl-9 pr-10 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-75"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
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
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
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
                    disabled={loading || !apiProvider || !apiKey}
                    className="px-3.5 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold disabled:opacity-50 transition-colors shrink-0 flex items-center gap-1.5"
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
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all"
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

export default ConfigModal;


