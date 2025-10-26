
import styles from './Navbar.module.css';
import { FiSettings, FiMoon, FiSun } from 'react-icons/fi';
import { useDarkMode } from '../contexts/DarkModeContext';
import { useEffect, useState } from 'react';

interface NavbarProps {
  // netSuiteStatus: boolean;
  // aiStatus: boolean;
  onConfigClick: () => void;
  netSuiteStatus: boolean;
  aiStatus: boolean;
  inUseModelName: string | null;
  netsuiteAccountId: string;
}

const Navbar: React.FC<NavbarProps> = ({ onConfigClick, netSuiteStatus, aiStatus, inUseModelName, netsuiteAccountId }) => {
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  
  
  // const fetchCache = () => {
  //  fetch("http://localhost:8000/get-specific-cache?key=selected_model")
  //  .then(response => response.json()) 
  //  .then(data => {
  //   setModelName(data);
  //   setAiStatus(true);
  //  }) 

  // }

  // useEffect(() => {
  //   fetchCache();
  // }, []);

  return (
    <nav className={styles.navbar}>
      <div className={styles.logo}>NetSuite MCP Connector</div>
      <div className={styles.statusIndicators}>
        <div className={styles.statusIndicator}>
          <div className={styles.statusLabel}>
            <span className={`${styles.statusDot} ${netSuiteStatus ? styles.online : styles.offline}`}></span>
            NetSuite
          </div>
          <div className={styles.placeholder}>ACC ID: {netsuiteAccountId}</div>
        </div>
        <div className={styles.statusIndicator}>
          <div className={styles.statusLabel}>
            <span className={`${styles.statusDot} ${aiStatus ? styles.online : styles.offline}`}></span>
            Agent
          </div>
          <div className={styles.placeholder}>{inUseModelName}</div>
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
