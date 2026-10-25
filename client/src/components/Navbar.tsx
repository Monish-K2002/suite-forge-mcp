import React, { useEffect, useRef, useState } from 'react';
import { FiCheck, FiChevronDown, FiDatabase, FiMoon, FiPlus, FiRefreshCw, FiSettings, FiSun, FiTrash2 } from 'react-icons/fi';
import { useDarkMode } from '../contexts/DarkModeContext';
import { connector, type AccountItem } from './NetSuiteConnector';

interface NavbarProps {
  onConfigClick: () => void;
  refreshTrigger?: number;
}

const Navbar: React.FC<NavbarProps> = React.memo(({ onConfigClick, refreshTrigger }) => {
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const [accountId, setAccountId] = useState('');
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [feedback, setFeedback] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  const refreshStatus = async () => {
    setRefreshing(true);
    try {
      const config = await connector.getConfig();
      setAccountId(config.netsuite_account_id || '');
    } catch {
      setAccountId('');
    } finally {
      window.setTimeout(() => setRefreshing(false), 250);
    }
  };

  const loadAccounts = async () => {
    setLoadingAccounts(true);
    try {
      const response = await connector.getAccounts();
      setAccounts(response.accounts || []);
      if (response.active_account_id) setAccountId(response.active_account_id);
    } catch (error) {
      console.error('Error fetching NetSuite accounts list:', error);
    } finally {
      setLoadingAccounts(false);
    }
  };

  useEffect(() => {
    refreshStatus();
    const handleConfigUpdated = () => refreshStatus();
    window.addEventListener('suite_forge_config_updated', handleConfigUpdated);
    return () => window.removeEventListener('suite_forge_config_updated', handleConfigUpdated);
  }, [refreshTrigger]);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', closeOutside);
    return () => document.removeEventListener('mousedown', closeOutside);
  }, [menuOpen]);

  const selectAccount = async (id: string) => {
    try {
      await connector.selectAccount(id);
      setAccountId(id);
      setMenuOpen(false);
      window.dispatchEvent(new CustomEvent('suite_forge_config_updated'));
    } catch (error) {
      console.error('Failed to select account:', error);
    }
  };

  const deleteAccount = async (id: string) => {
    try {
      await connector.deleteAccount(id);
      setAccounts((current) => current.filter((account) => account.account_id !== id));
      if (id === accountId) setAccountId('');
      window.dispatchEvent(new CustomEvent('suite_forge_config_updated'));
    } catch (error) {
      console.error('Failed to delete account:', error);
    }
  };

  const indexAccount = async () => {
    setIndexing(true);
    setFeedback('');
    try {
      const result = await connector.indexAccount();
      setFeedback(result.message || 'Account metadata indexed.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Could not index account.');
    } finally {
      setIndexing(false);
    }
  };

  const controlClass = 'inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white';

  return (
    <nav className="z-30 flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 dark:border-slate-800 dark:bg-[#1d2025]">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-700 text-sm font-semibold text-white">S</div>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">Suite Forge</h1>
          <p className="hidden text-[11px] text-slate-500 sm:block">NetSuite workspace</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <button type="button" onClick={refreshStatus} className={`${controlClass} w-9 px-0`} title="Refresh connection" aria-label="Refresh connection">
          <FiRefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
        <button type="button" onClick={toggleDarkMode} className={`${controlClass} w-9 px-0`} title={isDarkMode ? 'Switch to light theme' : 'Switch to dark theme'} aria-label={isDarkMode ? 'Switch to light theme' : 'Switch to dark theme'}>
          {isDarkMode ? <FiSun className="h-4 w-4" /> : <FiMoon className="h-4 w-4" />}
        </button>
        <button type="button" onClick={indexAccount} disabled={indexing} className={`${controlClass} hidden sm:inline-flex`} title={feedback || 'Index account metadata'}>
          <FiDatabase className={`h-4 w-4 ${indexing ? 'animate-pulse' : ''}`} />
          <span>{indexing ? 'Indexing…' : 'Index data'}</span>
        </button>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => {
              const next = !menuOpen;
              setMenuOpen(next);
              if (next) loadAccounts();
            }}
            className={controlClass}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <span className={`h-2 w-2 rounded-full ${accountId ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            <span className="max-w-28 truncate sm:max-w-40">{accountId || 'Choose account'}</span>
            <FiChevronDown className={`h-3.5 w-3.5 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg motion-enter dark:border-slate-700 dark:bg-[#24272d]" role="menu">
              <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 dark:border-slate-700">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">NetSuite accounts</span>
                {loadingAccounts && <FiRefreshCw className="h-3.5 w-3.5 animate-spin text-slate-400" />}
              </div>
              {accounts.length === 0 ? (
                <p className="px-3 py-4 text-sm text-slate-500">{loadingAccounts ? 'Loading accounts…' : 'No accounts configured yet.'}</p>
              ) : accounts.map((account) => (
                <div key={account.account_id} className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-800">
                  <button type="button" role="menuitem" onClick={() => selectAccount(account.account_id)} className="flex min-w-0 flex-1 items-center justify-between rounded-md px-2 py-2 text-left text-sm text-slate-700 dark:text-slate-200">
                    <span className="truncate">{account.account_id}</span>
                    {account.account_id === accountId && <FiCheck className="ml-2 h-4 w-4 shrink-0 text-emerald-600" />}
                  </button>
                  <button type="button" onClick={() => deleteAccount(account.account_id)} className="rounded-md p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40" title={`Delete account ${account.account_id}`} aria-label={`Delete account ${account.account_id}`}>
                    <FiTrash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <div className="border-t border-slate-100 p-2 dark:border-slate-700 sm:hidden">
                <button type="button" onClick={indexAccount} disabled={indexing} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800">
                  <FiDatabase className="h-4 w-4" /> {indexing ? 'Indexing account data…' : 'Index account data'}
                </button>
              </div>
              <div className="border-t border-slate-100 p-2 dark:border-slate-700">
                <button type="button" onClick={() => { setMenuOpen(false); onConfigClick(); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-sky-700 transition-colors hover:bg-sky-50 dark:text-sky-300 dark:hover:bg-slate-800">
                  <FiPlus className="h-4 w-4" /> Add or manage accounts
                </button>
              </div>
            </div>
          )}
        </div>
        <button type="button" onClick={onConfigClick} className={`${controlClass} w-9 px-0 sm:w-auto sm:px-3`} aria-label="Open settings" title="Settings">
          <FiSettings className="h-4 w-4" /><span className="hidden sm:inline">Settings</span>
        </button>
      </div>
      {feedback && <span role="status" className="sr-only">{feedback}</span>}
    </nav>
  );
});

Navbar.displayName = 'Navbar';
export default Navbar;
