
import styles from './Navbar.module.css';
import { FiSettings, FiMoon, FiSun } from 'react-icons/fi';
import { useDarkMode } from '../contexts/DarkModeContext';
import { useEffect, useState } from 'react';
import NetSuiteConnector from './NetSuiteConnector';

interface NavbarProps {
  onConfigClick: () => void;
}

const connector = new NetSuiteConnector();

const Navbar: React.FC<NavbarProps> = ({ onConfigClick }) => {
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const [netSuiteStatus, setNetSuiteStatus] = useState(false);
  const [accountId, setAccountId] = useState('');
  const [aiStatus, setAiStatus] = useState(false);
  const [modelName, setModelName] = useState('Not Configured');
  
  const fetchStatus = async () => {
    try {
      const config = await connector.getConfig();
      if (config.selected_model) {
        setModelName(config.selected_model);
        setAiStatus(true);
      } else {
        setAiStatus(false);
        setModelName('Not Configured');
      }

      if (config.netsuite_account_id) {
        setAccountId(config.netsuite_account_id);
        setNetSuiteStatus(true);
      } else {
        setNetSuiteStatus(false);
      }
    } catch (e) {
      setAiStatus(false);
      setNetSuiteStatus(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  return (
    <nav className={styles.navbar}>
      <div className={styles.logo}>NetSuite MCP Connector</div>
      <div className={styles.statusIndicators}>
        <div className={styles.statusIndicator}>
          <div className={styles.statusLabel}>
            <span className={`${styles.statusDot} ${netSuiteStatus ? styles.online : styles.offline}`}></span>
            NetSuite
          </div>
          <div className={styles.placeholder}>{accountId ? `ACC ID: ${accountId}` : 'Not Connected'}</div>
        </div>
        <div className={styles.statusIndicator}>
          <div className={styles.statusLabel}>
            <span className={`${styles.statusDot} ${aiStatus ? styles.online : styles.offline}`}></span>
            AI
          </div>
          <div className={styles.placeholder}>Agent: {modelName}</div>
        </div>
        <button onClick={toggleDarkMode} className={styles.configButton} title="Toggle Theme">
          {isDarkMode ? <FiSun /> : <FiMoon />}
        </button>
        <button onClick={onConfigClick} className={styles.configButton} title="Settings"><FiSettings /></button>
      </div>
    </nav>
  );
};

export default Navbar;

