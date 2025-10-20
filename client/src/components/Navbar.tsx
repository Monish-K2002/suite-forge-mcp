
import styles from './Navbar.module.css';
import { FiSettings, FiMoon, FiSun } from 'react-icons/fi';
import { useDarkMode } from '../contexts/DarkModeContext';

interface NavbarProps {
  netSuiteStatus: boolean;
  aiStatus: boolean;
  onConfigClick: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ netSuiteStatus, aiStatus, onConfigClick }) => {
  const { isDarkMode, toggleDarkMode } = useDarkMode();

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
          <div className={styles.placeholder}>Agent: Gemini</div>
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
