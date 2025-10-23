
import styles from './Navbar.module.css';
import { FiSettings, FiMoon, FiSun } from 'react-icons/fi';
import { useDarkMode } from '../contexts/DarkModeContext';
import { useEffect, useState } from 'react';

interface NavbarProps {
  // netSuiteStatus: boolean;
  // aiStatus: boolean;
  onConfigClick: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ onConfigClick }) => {
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const [netSuiteStatus, setNetSuiteStatus] = useState(false);
  const [aiStatus, setAiStatus] = useState(false);
  const [modelName, setModelName] = useState('');
  
  const fetchCache = () => {
   fetch("http://localhost:8000/get-specific-cache?key=selected_model")
   .then(response => response.json()) 
   .then(data => {
    setModelName(data);
    setAiStatus(true);
   }) 

  }

  useEffect(() => {
    fetchCache();
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
          <div className={styles.placeholder}>ACC ID: 123456</div>
        </div>
        <div className={styles.statusIndicator}>
          <div className={styles.statusLabel}>
            <span className={`${styles.statusDot} ${aiStatus ? styles.online : styles.offline}`}></span>
            AI
          </div>
          <div className={styles.placeholder}>Agent: {modelName}</div>
        </div>
        <button onClick={toggleDarkMode} className={styles.configButton}>
          {isDarkMode ? <FiSun /> : <FiMoon />}
        </button>
        <button onClick={onConfigClick} className={styles.configButton}><FiSettings /></button>
      </div>
    </nav>
  );
};

export default Navbar;
