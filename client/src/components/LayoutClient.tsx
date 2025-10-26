
import { useEffect, useState } from 'react';
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
  const [netSuiteStatus, setNetSuiteStatus] = useState(false);
  const [aiStatus, setAiStatus] = useState(false);
  const [netsuiteAccountId, setNetsuiteAccountId] = useState('')
  const [netsuiteClientId, setNetsuiteClientId] = useState('')

  const getAIDetails = () => {
    fetch("http://localhost:8000/get-cache")
    .then(response => response.json())
    .then(data => {
      console.log('getAIDetails: ',data)
      setInUseModelName(data.selected_model || '')
      setApiProvider(data.api_provider || '')
      setApiKey(data.api_key || '')
      setSelectedModel(data.selected_model || '')
      setModelList(data.models || [])
      if(data.selected_model){
        setAiStatus(true)
      }

      setNetsuiteAccountId(data.netsuite_config.account_id || '')
      setNetsuiteClientId(data.netsuite_config.client_id || '')
      if(data.netsuite_authenticated){
        setNetSuiteStatus(true)
      }
    })
  }

  useEffect(() => {
    getAIDetails()
  }, [])

  return (
    <div className={isDarkMode ? 'dark' : ''}>
      <Navbar 
        onConfigClick={() => setShowConfigModal(true)} 
        netSuiteStatus={netSuiteStatus}
        aiStatus={aiStatus}
        inUseModelName={inUseModelName}
        netsuiteAccountId={netsuiteAccountId}
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
        setNetSuiteStatus={setNetSuiteStatus}
        setAiStatus={setAiStatus}
        netsuiteAccountId={netsuiteAccountId}
        netsuiteClientId={netsuiteClientId}
        setNetsuiteAccountId={setNetsuiteAccountId}
        setNetsuiteClientId={setNetsuiteClientId}
      />}
      {children}
    </div>
  );
}
