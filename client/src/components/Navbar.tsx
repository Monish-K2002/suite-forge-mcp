import React, { useEffect, useState, useRef } from 'react';
import { FiSettings, FiMoon, FiSun, FiZap, FiDatabase, FiCpu, FiRefreshCw, FiChevronDown, FiChevronUp, FiCheck, FiPlus, FiTrash } from 'react-icons/fi';
import { useDarkMode } from '../contexts/DarkModeContext';
import { connector, type AccountItem } from './NetSuiteConnector';

interface NavbarProps {
  onConfigClick: () => void;
  refreshTrigger?: number;
}

const Navbar: React.FC<NavbarProps> = React.memo(({ onConfigClick, refreshTrigger }) => {
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const [netSuiteStatus, setNetSuiteStatus] = useState(false);
  const [accountId, setAccountId] = useState('');
  const [aiStatus, setAiStatus] = useState(false);
  const [modelName, setModelName] = useState('Not Configured');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

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

      if (config.netsuite_account_id) {
        setAccountId(config.netsuite_account_id);
        setNetSuiteStatus(true);
      } else {
        setNetSuiteStatus(false);
      }
    } catch {
      setAiStatus(false);
      setNetSuiteStatus(false);
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  const fetchAccounts = async () => {
    setIsLoadingAccounts(true);
    try {
      const res = await connector.getAccounts();
      setAccounts(res.accounts || []);
      if (res.active_account_id) {
        setAccountId(res.active_account_id);
        setNetSuiteStatus(true);
      }
    } catch (e) {
      console.error('Error fetching NetSuite accounts list:', e);
    } finally {
      setIsLoadingAccounts(false);
    }
  };

  const handleAccountClick = () => {
    const nextState = !isAccountMenuOpen;
    setIsAccountMenuOpen(nextState);
    if (nextState) {
      fetchAccounts();
    }
  };

  const handleSelectAccount = async (selectedAccountId: string) => {
    try {
      await connector.selectAccount(selectedAccountId);
      setAccountId(selectedAccountId);
      setNetSuiteStatus(true);
      setIsAccountMenuOpen(false);
      window.dispatchEvent(new CustomEvent('suite_forge_config_updated'));
      fetchStatus();
    } catch (e) {
      console.error('Failed to select account:', e);
    }
  };

  const handleAccountIndex = async () => {
    try {
      await connector.indexAccount();
      fetchStatus();
    } catch (e) {
      console.error('Failed to index account:', e);
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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    };

    if (isAccountMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isAccountMenuOpen]);

  const handleDeleteSelectedAccount = async (selectedAccountId: string) => {
    try {
      await connector.deleteAccount(selectedAccountId);
      setAccounts((prev) => prev.filter((acc) => acc.account_id !== selectedAccountId));
      if (selectedAccountId === accountId) {
        setAccountId('');
        setNetSuiteStatus(false);
      }
      window.dispatchEvent(new CustomEvent('suite_forge_config_updated'));
      fetchStatus();
    } catch (e) {
      console.error('Failed to delete account:', e);
    }
  };

  return (
    <nav className="h-16 px-4 md:px-6 flex items-center justify-between border-b z-30 transition-colors duration-200 bg-white/95 border-slate-200/80 dark:bg-slate-900/95 dark:border-slate-800/80 shadow-sm shrink-0">
      {/* Left: Brand Logo & Title */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white font-bold text-lg">
          <FiZap className="w-5 h-5 text-white" />
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
        <button
          type="button"
          onClick={onConfigClick}
          className="cursor-pointer group flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all bg-slate-100/70 border-slate-200 hover:bg-slate-200/60 dark:bg-slate-800/50 dark:border-slate-700/60 dark:hover:bg-slate-800/90 text-xs"
          aria-label="Open NetSuite configuration"
        >
          <FiDatabase className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 group-hover:text-indigo-500 transition-colors" />
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className={`relative inline-flex rounded-full h-2 w-2 ${netSuiteStatus ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
            </span>
            <span className="font-medium text-slate-700 dark:text-slate-300 hidden md:inline">
              NetSuite:
            </span>
            <span className="font-mono text-slate-600 dark:text-slate-400">
              {accountId ? accountId : 'Disconnected'}
            </span>
          </div>
        </button>

        {/* AI Agent Status Badge */}
        <button
          type="button"
          onClick={onConfigClick}
          className="cursor-pointer group flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all bg-slate-100/70 border-slate-200 hover:bg-slate-200/60 dark:bg-slate-800/50 dark:border-slate-700/60 dark:hover:bg-slate-800/90 text-xs"
          aria-label="Open AI model configuration"
        >
          <FiCpu className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 group-hover:text-cyan-500 transition-colors" />
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className={`relative inline-flex rounded-full h-2 w-2 ${aiStatus ? 'bg-cyan-500' : 'bg-slate-400'}`}></span>
            </span>
            <span className="font-medium text-slate-700 dark:text-slate-300 hidden md:inline">
              AI Model:
            </span>
            <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[110px] sm:max-w-[160px]">
              {modelName}
            </span>
          </div>
        </button>

        {/* Refresh Status button */}
        <button
          onClick={fetchStatus}
          title="Refresh Status"
          className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          aria-label="Refresh connection status"
        >
          <FiRefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-indigo-500' : ''}`} />
        </button>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleDarkMode}
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDarkMode ? <FiSun className="w-4 h-4 text-amber-400" /> : <FiMoon className="w-4 h-4 text-slate-700" />}
        </button>

        {/* Index Button */}
        <button
          onClick={handleAccountIndex}
          title="Index"
          className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          aria-label="Index"
        >
          <div className="flex items-center gap-1.5">
            <FiDatabase className="w-4 h-4" />
            <span className="hidden sm:inline">INDEX</span>
          </div>
        </button>

        {/* Account Selector Dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={handleAccountClick}
            className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-600/20 active:scale-95 flex items-center gap-1.5 text-xs font-semibold"
            aria-haspopup="menu"
            aria-expanded={isAccountMenuOpen}
          >
            <span className="font-medium text-indigo-100 hidden md:inline">
              Account:
            </span>
            <span className="font-mono text-white">
              {accountId ? accountId : 'Disconnected'}
            </span>
            {isAccountMenuOpen ? <FiChevronUp className="w-4 h-4" /> : <FiChevronDown className="w-4 h-4" />}
          </button>

          {isAccountMenuOpen && (
            <div
              className="absolute right-0 mt-2 w-64 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
              role="menu"
            >
              <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-400">
                  Available Accounts
                </span>
                {isLoadingAccounts && (
                  <FiRefreshCw className="w-3 h-3 animate-spin text-indigo-500" />
                )}
              </div>

              <div className="max-h-60 overflow-y-auto py-1">
                {accounts.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 text-center">
                    {isLoadingAccounts ? 'Loading accounts...' : 'No accounts configured.'}
                  </div>
                ) : (
                  accounts.map((acc) => {
                    const isActive = acc.account_id === accountId;
                    return (
                      <button
                        key={acc.account_id}
                        onClick={() => handleSelectAccount(acc.account_id)}
                        className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors hover:bg-slate-100 dark:hover:bg-slate-700/50 ${
                          isActive
                            ? 'bg-indigo-50/80 dark:bg-indigo-950/40 font-semibold text-indigo-600 dark:text-indigo-400'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex flex-col">
                          <span className="font-mono font-medium">{acc.account_id}</span>
                          {acc.client_id && (
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-[170px]">
                              Client: {acc.client_id}
                            </span>
                          )}
                        </div>
                        {isActive && <FiCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 ml-2" />}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSelectedAccount(acc.account_id);
                          }}
                          className="text-red-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                          title={`Delete account ${acc.account_id}`}
                          aria-label={`Delete account ${acc.account_id}`}
                        >
                          <FiTrash className="w-4 h-4" />
                        </button>
                      </button>
                    );
                  })
                )}
              </div>

              <div className="border-t border-slate-100 dark:border-slate-700/60 pt-1 px-1 mt-1">
                <button
                  onClick={() => {
                    setIsAccountMenuOpen(false);
                    onConfigClick();
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg flex items-center gap-2 font-medium transition-colors"
                >
                  <FiPlus className="w-3.5 h-3.5" />
                  <span>Add / Manage Accounts</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Settings Modal Button */}
        <button
          onClick={onConfigClick}
          title="Open Settings"
          className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-600/20 active:scale-95 flex items-center gap-1.5 text-xs font-semibold"
          aria-label="Open settings"
        >
          <FiSettings className="w-4 h-4" />
          <span className="hidden sm:inline">Settings</span>
        </button>
      </div>
    </nav>
  );
});

Navbar.displayName = 'Navbar';

export default Navbar;
