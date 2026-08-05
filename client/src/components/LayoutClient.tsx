import { lazy, Suspense, useState } from 'react';
import { useDarkMode } from '../contexts/DarkModeContext';
import Navbar from './Navbar';

const ConfigModal = lazy(() => import('./ConfigModal'));

interface Modelname {
  name: string;
  displayName: string;
}

export default function LayoutClient({ children }: { children: React.ReactNode }) {
  const { isDarkMode } = useDarkMode();
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [modelList, setModelList] = useState<Modelname[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [apiProvider, setApiProvider] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [inUseModelName, setInUseModelName] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleRefreshStatus = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className={`h-screen w-screen flex flex-col overflow-hidden transition-colors duration-300 ${
      isDarkMode 
        ? 'dark bg-[#090d16] text-slate-100' 
        : 'bg-slate-50 text-slate-900'
    }`}>
      {/* Background ambient lighting effects for dark mode (Hardware accelerated radial gradients) */}
      {isDarkMode && (
        <div 
          className="fixed inset-0 pointer-events-none overflow-hidden z-0 opacity-60" 
          style={{
            backgroundImage: `
              radial-gradient(circle at 10% 0%, rgba(79, 70, 229, 0.15) 0%, transparent 45%),
              radial-gradient(circle at 90% 50%, rgba(6, 182, 212, 0.15) 0%, transparent 45%),
              radial-gradient(circle at 50% 100%, rgba(147, 51, 234, 0.15) 0%, transparent 45%)
            `
          }}
        />
      )}

      <div className="relative z-10 flex flex-col h-full w-full">
        <Navbar 
          onConfigClick={() => setShowConfigModal(true)} 
          refreshTrigger={refreshTrigger}
        />

        <main className="flex-1 flex min-h-0 overflow-hidden relative">
          {children}
        </main>
      </div>

      {showConfigModal && (
        <Suspense fallback={<div className="fixed inset-0 z-50 bg-slate-950/70" />}>
          <ConfigModal 
            onClose={() => setShowConfigModal(false)} 
            isDarkMode={isDarkMode} 
            modelList={modelList} 
            setModelList={setModelList} 
            apiProvider={apiProvider}
            setApiProvider={setApiProvider}
            apiKey={apiKey}
            setApiKey={setApiKey}
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
            inUseModelName={inUseModelName}
            setInUseModelName={setInUseModelName}
            onConfigSaved={handleRefreshStatus}
          />
        </Suspense>
      )}
    </div>
  );
}
