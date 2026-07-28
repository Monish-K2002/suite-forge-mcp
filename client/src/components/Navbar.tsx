
import React, { useEffect, useState } from 'react';
import { FiSettings, FiMoon, FiSun, FiZap, FiDatabase, FiCpu, FiRefreshCw } from 'react-icons/fi';
import { useDarkMode } from '../contexts/DarkModeContext';
import NetSuiteConnector from './NetSuiteConnector';

interface NavbarProps {
  onConfigClick: () => void;
  refreshTrigger?: number;
}

const connector = new NetSuiteConnector();

const Navbar: React.FC<NavbarProps> = ({ onConfigClick, refreshTrigger }) => {
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const [netSuiteStatus, setNetSuiteStatus] = useState(false);
  const [accountId, setAccountId] = useState('');
  const [aiStatus, setAiStatus] = useState(false);
  const [modelName, setModelName] = useState('Not Configured');
  const [provider, setProvider] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchStatus = async () => {
    setIsRefreshing(true);
    try {
      const config = await connector.getConfig();
      if (config.selected_model) {
        setModelName(config.selected_model);
        setAiStatus(true);
      } else {
        setAiStatus(false);
        setModelName('Not Configured');
      }

      if (config.api_provider) {
        setProvider(config.api_provider);
      }

      if (config.netsuite_account_id) {
        setAccountId(config.netsuite_account_id);
        setNetSuiteStatus(true);
      } else {
        setNetSuiteStatus(false);
      }
    } catch (e) {
      setAiStatus(false);
      setNetSuiteStatus(false);
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  useEffect(() => {
    fetchStatus();

    const handleConfigUpdated = () => {
      fetchStatus();
    };

    window.addEventListener('suite_forge_config_updated', handleConfigUpdated);
    return () => {
      window.removeEventListener('suite_forge_config_updated', handleConfigUpdated);
    };
  }, [refreshTrigger]);

  return (
    <nav className="h-16 px-4 md:px-6 flex items-center justify-between border-b backdrop-blur-xl z-30 transition-colors duration-200 bg-white/70 border-slate-200/80 dark:bg-slate-900/80 dark:border-slate-800/80 shadow-sm shrink-0">
      {/* Left: Brand Logo & Title */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white font-bold text-lg">
          <FiZap className="w-5 h-5 text-white animate-pulse" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-slate-900 dark:text-white tracking-tight text-base leading-none">
              Suite Forge
            </h1>
            <span className="px-1.5 py-0.5 text-[10px] font-semibold tracking-wide rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 dark:border dark:border-indigo-800/50">
              MCP AI
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block mt-0.5">
            Enterprise NetSuite Assistant
          </p>
        </div>
      </div>

      {/* Right: Status Badges & Controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* NetSuite Status Badge */}
        <div 
          onClick={onConfigClick}
          className="cursor-pointer group flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all bg-slate-100/70 border-slate-200 hover:bg-slate-200/60 dark:bg-slate-800/50 dark:border-slate-700/60 dark:hover:bg-slate-800/90 text-xs"
        >
          <FiDatabase className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 group-hover:text-indigo-500 transition-colors" />
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              {netSuiteStatus && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${netSuiteStatus ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
            </span>
            <span className="font-medium text-slate-700 dark:text-slate-300 hidden md:inline">
              NetSuite:
            </span>
            <span className="font-mono text-slate-600 dark:text-slate-400">
              {accountId ? accountId : 'Disconnected'}
            </span>
          </div>
        </div>

        {/* AI Agent Status Badge */}
        <div 
          onClick={onConfigClick}
          className="cursor-pointer group flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all bg-slate-100/70 border-slate-200 hover:bg-slate-200/60 dark:bg-slate-800/50 dark:border-slate-700/60 dark:hover:bg-slate-800/90 text-xs"
        >
          <FiCpu className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 group-hover:text-cyan-500 transition-colors" />
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              {aiStatus && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${aiStatus ? 'bg-cyan-500' : 'bg-slate-400'}`}></span>
            </span>
            <span className="font-medium text-slate-700 dark:text-slate-300 hidden md:inline">
              AI Model:
            </span>
            <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[110px] sm:max-w-[160px]">
              {modelName}
            </span>
          </div>
        </div>

        {/* Refresh Status button */}
        <button
          onClick={fetchStatus}
          title="Refresh Status"
          className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
        >
          <FiRefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-indigo-500' : ''}`} />
        </button>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleDarkMode}
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
        >
          {isDarkMode ? <FiSun className="w-4 h-4 text-amber-400" /> : <FiMoon className="w-4 h-4 text-slate-700" />}
        </button>

        {/* Settings Modal Button */}
        <button
          onClick={onConfigClick}
          title="Open Settings"
          className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-600/20 active:scale-95 flex items-center gap-1.5 text-xs font-semibold"
        >
          <FiSettings className="w-4 h-4" />
          <span className="hidden sm:inline">Settings</span>
        </button>
      </div>
    </nav>
  );
};

export default Navbar;


