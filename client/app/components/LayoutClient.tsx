
'use client';

import { useState } from 'react';
import { useDarkMode } from '../contexts/DarkModeContext';
import Navbar from './Navbar';
import ConfigModal from './ConfigModal';

export default function LayoutClient({ children }: { children: React.ReactNode }) {
  const { isDarkMode } = useDarkMode();
  const [showConfigModal, setShowConfigModal] = useState(false);

  return (
    <div className={isDarkMode ? 'dark' : ''}>
      <Navbar netSuiteStatus={true} aiStatus={true} onConfigClick={() => setShowConfigModal(true)} />
      {showConfigModal && <ConfigModal onClose={() => setShowConfigModal(false)} isDarkMode={isDarkMode} />}
      {children}
    </div>
  );
}
