
import { useState } from 'react';
import { useDarkMode } from '../contexts/DarkModeContext';
import Navbar from './Navbar';
import ConfigModal from './ConfigModal';

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

  return (
    <div className={`h-screen w-screen flex flex-col overflow-hidden transition-colors duration-300 ${
      isDarkMode 
        ? 'dark bg-[#090d16] text-slate-100' 
        : 'bg-slate-50 text-slate-900'
    }`}>
      {/* Background ambient lighting effects for dark mode */}
      {isDarkMode && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          <div className="absolute -top-[20%] -left-[10%] w-[500px] h-[500px] rounded-full bg-indigo-600/10 blur-[130px]" />
          <div className="absolute top-[40%] -right-[10%] w-[500px] h-[500px] rounded-full bg-cyan-600/10 blur-[140px]" />
          <div className="absolute -bottom-[20%] left-[30%] w-[600px] h-[600px] rounded-full bg-purple-600/10 blur-[150px]" />
        </div>
      )}

      <div className="relative z-10 flex flex-col h-full w-full">
        <Navbar 
          onConfigClick={() => setShowConfigModal(true)} 
        />

        <main className="flex-1 flex min-h-0 overflow-hidden relative">
          {children}
        </main>
      </div>

      {showConfigModal && (
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
        />
      )}
    </div>
  );
}

