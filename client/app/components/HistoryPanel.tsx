
'use client';

import React from 'react';
import styles from './HistoryPanel.module.css';
import { useDarkMode } from '../contexts/DarkModeContext';

interface HistoryPanelProps {
  showHistory: boolean;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({ showHistory }) => {
  const { isDarkMode } = useDarkMode();

  return (
    <div className={`${styles.historyPanel} ${showHistory ? styles.show : ''} ${isDarkMode ? styles.dark : ''}`}>
      <p>Feature coming soon</p>
    </div>
  );
};

export default HistoryPanel;
