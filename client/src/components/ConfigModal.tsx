
import { useState } from 'react';
import styles from './ConfigModal.module.css';

interface ConfigModalProps {
  onClose: () => void;
  isDarkMode: boolean;
}

const ConfigModal: React.FC<ConfigModalProps> = ({ onClose, isDarkMode }) => {
  const [activeTab, setActiveTab] = useState('netsuite');
  const [apiProvider, setApiProvider] = useState('openai');
  const models = {
    openai: ['GPT-3.5', 'GPT-4'],
    anthropic: ['Claude 2', 'Claude 3'],
    google: ['Gemini Pro', 'Gemini Ultra'],
  };

  const handleNetsuiteAuth = async () => {
    const response = await fetch("http://127.0.0.1:8000/")
    const data = await response.json()
    console.log(data)
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
                <select id="api-provider" value={apiProvider} onChange={(e) => setApiProvider(e.target.value)}>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="google">Google</option>
                </select>
              </div>
              <div className={styles.inputGroup}>
                <label htmlFor="api-key">API Key</label>
                <input type="password" id="api-key" />
              </div>
              <div className={styles.inputGroup}>
                <label htmlFor="model-select">Model</label>
                <select id="model-select">
                  {models[apiProvider as keyof typeof models].map((model) => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              </div>
              <div className={styles.buttonGroup}>
                <button className={styles.authButton}>Authenticate</button>
                <button className={styles.authButton}>Fetch Models</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConfigModal;
