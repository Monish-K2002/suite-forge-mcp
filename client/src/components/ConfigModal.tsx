
import { useState, useEffect } from 'react';
import styles from './ConfigModal.module.css';
import NetSuiteConnector from './NetSuiteConnector';

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

interface Modelname {
  name: string;
  displayName: string;
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
  const [activeTab, setActiveTab] = useState('netsuite');
  const [accountId, setAccountId] = useState('');
  const [clientId, setClientId] = useState('');
  const [loading, setLoading] = useState(false);

  const getCacheConfig = async () => {
    try {
      const config = await connector.getConfig();
      if (config.api_provider) setApiProvider(config.api_provider);
      if (config.selected_model) setSelectedModel(config.selected_model);
      if (config.netsuite_account_id) setAccountId(config.netsuite_account_id);
    } catch (err) {
      console.error("Failed to load initial configuration:", err);
    }
  };

  useEffect(() => {
    getCacheConfig();
  }, []);

  const handleProviderChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const provider = event.target.value;
    setApiProvider(provider);
    setModelList([]);
    setSelectedModel('');
    setInUseModelName(null);
    setApiKey('');
  };

  const handleNetsuiteAuth = async () => {
    if (!accountId.trim() || !clientId.trim()) {
      alert("Please enter both NetSuite Account ID and Client ID.");
      return;
    }

    try {
      setLoading(true);
      const res = await connector.authenticateNetSuite(accountId, clientId);
      const popupWidth = window.screen.width * 0.8;
      const popupHeight = window.screen.height * 0.8;
      const left = (window.screen.width - popupWidth) / 2;
      const top = (window.screen.height - popupHeight) / 2;
      const windowFeatures = `width=${popupWidth},height=${popupHeight},left=${left},top=${top},scrollbars=yes,resizable=yes`;
      window.open(res.auth_url, "popupWindow", windowFeatures);
    } catch (err: any) {
      alert(`Authentication failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchModels = async () => {
    if (!apiProvider) {
      alert("Please select an API provider");
      return;
    }
    if (!apiKey) {
      alert("Please enter an API key");
      return;
    }

    try {
      setLoading(true);
      const models = await connector.fetchModels(apiProvider, apiKey);
      setModelList(models);
    } catch (err: any) {
      alert(`Error fetching models: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const useModel = async () => {
    if (!selectedModel) {
      alert("Please select a model");
      return;
    }

    const selectedObj = modelList.find(m => m.name === selectedModel);
    const displayName = selectedObj ? selectedObj.displayName : selectedModel;

    try {
      setLoading(true);
      await connector.useModel(selectedModel, apiProvider, apiKey);
      setInUseModelName(displayName);
    } catch (err: any) {
      alert(`Failed to set model: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={`${styles.modalContent} ${isDarkMode ? styles.dark : ''}`}>
        <div className={`${styles.header} ${isDarkMode ? styles.dark : ''}`}>
          <h2>Configuration</h2>
          <button onClick={onClose} className={styles.closeButton}>&times;</button>
        </div>
        <div className={`${styles.tabContainer} ${isDarkMode ? styles.dark : ''}`}>
          <button 
            className={`${styles.tabButton} ${activeTab === 'netsuite' ? styles.active : ''} ${isDarkMode ? styles.dark : ''}`}
            onClick={() => setActiveTab('netsuite')}
          >
            NetSuite
          </button>
          <button 
            className={`${styles.tabButton} ${activeTab === 'ai' ? styles.active : ''} ${isDarkMode ? styles.dark : ''}`}
            onClick={() => setActiveTab('ai')}
          >
            AI
          </button>
        </div>
        <div className={styles.tabContent}>
          {activeTab === 'netsuite' && (
            <div className={`${styles.configSection} ${isDarkMode ? styles.dark : ''}`}>
              <div className={styles.inputGroup}>
                <label htmlFor="netsuite-account-id">NetSuite Account ID</label>
                <input 
                  type="text" 
                  id="netsuite-account-id" 
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  placeholder="e.g. 1234567"
                />
              </div>
              <div className={styles.inputGroup}>
                <label htmlFor="client-id">Client ID</label>
                <input 
                  type="text" 
                  id="client-id" 
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="e.g. your_oauth_client_id"
                />
              </div>
              <button 
                className={styles.authButton} 
                onClick={handleNetsuiteAuth}
                disabled={loading}
              >
                {loading ? 'Connecting...' : 'Authenticate'}
              </button>
            </div>
          )}
          {activeTab === 'ai' && (
            <div className={`${styles.configSection} ${isDarkMode ? styles.dark : ''}`}>
              <div className={styles.inputGroup}>
                <label htmlFor="api-provider">API Provider</label>
                <select id="api-provider" value={apiProvider} onChange={(e) => handleProviderChange(e)}>
                  <option value="">Select API Provider</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="google">Google</option>
                </select>
              </div>
              <div className={styles.inputGroup}>
                <label htmlFor="api-key">API Key</label>
                <input 
                  type="password" 
                  id="api-key" 
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  disabled={Boolean(inUseModelName)}
                  placeholder="Enter provider API key"
                />
              </div>
              <div className={styles.inputGroup}>
                <label htmlFor="model-select">Model</label>
                <select 
                  id="model-select"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                >
                  {modelList.map((model) => (
                    <option key={model.name} value={model.name}>{model.displayName}</option>
                  ))}
                </select>
              </div>
              {inUseModelName && (
                <p className={styles.modelStatus}>Currently "{inUseModelName}" is in use.</p>
              )}
              <div className={styles.buttonGroup}>
                <button 
                  className={`${styles.authButton} ${inUseModelName ? styles.successButton : ''}`} 
                  onClick={useModel}
                  disabled={loading}
                >
                  Use Model
                </button>
                <button 
                  className={styles.authButton} 
                  onClick={fetchModels}
                  disabled={loading}
                >
                  {loading ? 'Fetching...' : 'Fetch Models'}
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

