
import React from 'react';
import styles from './Navbar.module.css';

interface NavbarProps {
  netSuiteStatus: boolean;
  aiStatus: boolean;
}

const Navbar: React.FC<NavbarProps> = ({ netSuiteStatus, aiStatus }) => {
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
      </div>
    </nav>
  );
};

export default Navbar;
