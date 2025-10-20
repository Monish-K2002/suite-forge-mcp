
import { useState } from 'react';
import styles from './ConfigModal.module.css';

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
}

interface Modelname {
  name: string;
  displayName: string;
}

const ConfigModal: React.FC<ConfigModalProps> = ({ onClose, isDarkMode, modelList, setModelList, apiProvider, setApiProvider, apiKey, setApiKey, selectedModel, setSelectedModel }) => {
  const [activeTab, setActiveTab] = useState('netsuite');
  // const [apiProvider, setApiProvider] = useState('openai')
  // const [models, setModels] = useState<Modelname[]>([])

  const handleProviderChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const provider = event.target.value;
    setApiProvider(provider);
    setModelList([]);
  };

  const handleNetsuiteAuth = async () => {
    const clientIdInput = document.getElementById("client-id");
    const clientId = clientIdInput instanceof HTMLInputElement ? clientIdInput.value : '';

    const accountIdInput = document.getElementById("netsuite-account-id");
    const accountId = accountIdInput instanceof HTMLInputElement ? accountIdInput.value : '';
    const response = await fetch("http://localhost:8000/auth", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        account_id: accountId,
      }),
    });
    const data = await response.json()
    console.log(data)
    window.open(data,"popupWindow", "width=400,height=300,scrollbars=yes,resizable=yes");
  }

  const fetchModels = async () => {
    if(!apiProvider) {
      alert("Please select an API provider")
      return
    }
    if(!apiKey) {
      alert("Please enter an API key")
      return
    }
    const params = new URLSearchParams({
      api_provider: apiProvider,
      api_key: apiKey,
    })

    const response = await fetch("http://localhost:8000/models?" + params, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    const data = await response.json()
    // console.log(data)
    if(data?.error) {
      alert(data.error)
      return
    }
    setModelList(data)
  }

  const useModel = async() => {
    const modelName = document.getElementById("model-select")
    const model = modelName instanceof HTMLSelectElement ? modelName.value : ''

    if(!model) {
      alert("Please select a model")
      return
    }
    const data = await fetch("http://localhost:8000/use-model", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model_name: model,
      }),
    });
    const response = await data.json()
    console.log(response)
  }

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
                <input type="text" id="netsuite-account-id" />
              </div>
              <div className={styles.inputGroup}>
                <label htmlFor="client-id">Client ID</label>
                <input type="text" id="client-id" />
              </div>
              <button className={styles.authButton} onClick={handleNetsuiteAuth}>Authenticate</button>
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
              <div className={styles.buttonGroup}>
                <button className={styles.authButton} onClick={useModel}>Use Model</button>
                <button className={styles.authButton} onClick={fetchModels}>Fetch Models</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConfigModal;
