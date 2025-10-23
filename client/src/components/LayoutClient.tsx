
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
  const [modelList, setModelList] = useState<Modelname[]>([])
  const [selectedModel, setSelectedModel] = useState('')
  const [apiProvider, setApiProvider] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [inUseModelName, setInUseModelName] = useState<string | null>(null);

  return (
    <div className={isDarkMode ? 'dark' : ''}>
      <Navbar 
        // netSuiteStatus={false} 
        // aiStatus={false} 
        onConfigClick={() => setShowConfigModal(true)} 
      />

      {showConfigModal && 
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
      />}
      {children}
    </div>
  );
}
