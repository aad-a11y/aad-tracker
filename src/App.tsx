import React, { useState, useEffect } from 'react';
import { 
  BankAccount, 
  ProgressLog, 
  BankReEligibilityRule
} from './types';
import Dashboard from './components/Dashboard';
import AccountList from './components/AccountList';
import AccountModal from './components/AccountModal';
import RuleBook from './components/RuleBook';
import ROICalculator from './components/ROICalculator';

import { 
  Building2, 
  LayoutDashboard, 
  BookOpen, 
  Plus, 
  AlertTriangle, 
  Menu, 
  X,
  Calculator,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [rules, setRules] = useState<BankReEligibilityRule[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'accounts' | 'playbook' | 'calculator'>('dashboard');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [accountToEdit, setAccountToEdit] = useState<BankAccount | undefined>(undefined);
  const [initialPreFill, setInitialPreFill] = useState<{ url?: string; bankName?: string; bonusAmount?: number } | undefined>(undefined);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Helper to filter out legacy sample/demo accounts
  const isSampleAccount = (acc: BankAccount) => {
    if (!acc) return true;
    const name = (acc.bankName || '').toLowerCase();
    const accName = (acc.accountName || '').toLowerCase();
    const id = (acc.id || '').toLowerCase();

    return (
      (acc as any).isSample ||
      id.includes('acc-ms') ||
      id.includes('acc-chase') ||
      id.includes('acc-capone') ||
      id.includes('acc-wf') ||
      id.includes('acc-southstate') ||
      id.includes('acc-citi') ||
      id.includes('acc-etrade') ||
      id.includes('acc-bofa') ||
      id.includes('acc-boa') ||
      id.includes('acc-sample') ||
      id.includes('acc-demo') ||
      id === 'acc-1' || id === 'acc-2' || id === 'acc-3' || id === 'acc-4' || id === 'acc-5' ||
      name.includes('morgan stanley') ||
      name.includes('southstate') ||
      name.includes('citi') ||
      name.includes('citibank') ||
      name.includes('e*trade') ||
      name.includes('bank of america') ||
      name.includes('bofa') ||
      (name.includes('chase') && (accName.includes('total checking') || id.includes('acc-chase') || acc.bonusAmount === 300)) ||
      (name.includes('wells fargo') && (accName.includes('everyday checking') || acc.bonusAmount === 325)) ||
      (name.includes('capital one') && (accName.includes('360 performance') || acc.bonusAmount === 1500))
    );
  };

  // Load offline local storage data on mount
  useEffect(() => {
    const saved = localStorage.getItem('bank_bonus_tracker_accounts');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const clean = (Array.isArray(parsed) ? parsed : []).filter(acc => !isSampleAccount(acc));
        setAccounts(clean);
        localStorage.setItem('bank_bonus_tracker_accounts', JSON.stringify(clean));
      } catch (e) {
        setAccounts([]);
      }
    } else {
      setAccounts([]);
    }

    const savedRules = localStorage.getItem('bank_reeligibility_rules');
    if (savedRules) {
      try {
        const parsed = JSON.parse(savedRules);
        setRules(Array.isArray(parsed) ? parsed : []);
      } catch (e) {
        setRules([]);
      }
    } else {
      setRules([]);
    }
  }, []);

  // Save to local state and local storage cache
  const saveAccountsLocally = (newAccounts: BankAccount[]) => {
    setAccounts(newAccounts);
    localStorage.setItem('bank_bonus_tracker_accounts', JSON.stringify(newAccounts));
  };

  // Custom Rules action
  const saveRules = (updatedRules: BankReEligibilityRule[]) => {
    setRules(updatedRules);
    localStorage.setItem('bank_reeligibility_rules', JSON.stringify(updatedRules));
  };

  // Callback to log progress directly
  const handleLogProgress = (accountId: string, requirementId: string, amount: number, description: string) => {
    const todayStr = new Date().toISOString().split('T')[0];
    let updatedAcc: BankAccount | null = null;
    
    const updated = accounts.map(acc => {
      if (acc.id === accountId) {
        const newLog: ProgressLog = {
          id: Math.random().toString(),
          requirementId,
          date: todayStr,
          amount,
          description: description || 'Progress recorded'
        };

        const updatedRequirements = acc.requirements.map(req => {
          if (req.id === requirementId) {
            const newValue = req.currentValue + amount;
            const isMet = newValue >= req.targetValue;
            return {
              ...req,
              currentValue: newValue,
              status: (isMet ? 'met' : 'in_progress') as any
            };
          }
          return req;
        });

        const allRequirementsMet = updatedRequirements.every(r => r.status === 'met');
        const updatedStatus = allRequirementsMet && acc.status === 'in_progress' ? 'met' : acc.status;

        updatedAcc = {
          ...acc,
          requirements: updatedRequirements,
          progressLogs: [...acc.progressLogs, newLog],
          status: updatedStatus as any
        };
        return updatedAcc;
      }
      return acc;
    });

    saveAccountsLocally(updated);
  };

  const handleUpdateAccount = (updatedAccount: BankAccount) => {
    const updated = accounts.map(a => a.id === updatedAccount.id ? updatedAccount : a);
    saveAccountsLocally(updated);
  };

  const handleDeleteAccount = (accountId: string) => {
    const updated = accounts.filter(a => a.id !== accountId);
    saveAccountsLocally(updated);
    if (selectedAccountId === accountId) {
      setSelectedAccountId(null);
    }
  };

  const handleClearAllAccounts = () => {
    saveAccountsLocally([]);
    setSelectedAccountId(null);
  };

  const handleSaveNewOrEditedAccount = (account: BankAccount) => {
    let updated: BankAccount[];
    if (accounts.some(a => a.id === account.id)) {
      updated = accounts.map(a => a.id === account.id ? account : a);
    } else {
      updated = [...accounts, account];
    }
    saveAccountsLocally(updated);
    setIsModalOpen(false);
    setAccountToEdit(undefined);
    setSelectedAccountId(account.id);
    setActiveTab('accounts');
  };

  // Count critical requirements (within 14 days)
  const today = new Date();
  const criticalRequirements = accounts.reduce((list, acc) => {
    if (acc.status === 'in_progress') {
      acc.requirements.forEach(req => {
        if (req.status === 'in_progress' || req.status === 'pending') {
          const deadline = new Date(req.deadlineDate);
          const diffTime = deadline.getTime() - today.getTime();
          const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (daysLeft <= 14) {
            list.push({
              bankName: acc.bankName,
              reqDesc: req.description,
              daysLeft
            });
          }
        }
      });
    }
    return list;
  }, [] as Array<{ bankName: string; reqDesc: string; daysLeft: number }>);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col antialiased">
      {/* Top Banner / Navbar */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 gap-4">
            
            {/* Logo & Brand */}
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black shadow-md shadow-indigo-100 shrink-0">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="font-extrabold text-slate-950 tracking-tight text-lg block">
                  AAD Tracker
                </span>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                  Bank Bonus & Re-Eligibility Manager
                </span>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex space-x-1">
              <button
                onClick={() => { setActiveTab('dashboard'); setSelectedAccountId(null); }}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Dashboard</span>
              </button>

              <button
                onClick={() => setActiveTab('accounts')}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeTab === 'accounts'
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>My Accounts</span>
              </button>

              <button
                onClick={() => { setActiveTab('playbook'); setSelectedAccountId(null); }}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeTab === 'playbook'
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>Playbook</span>
              </button>

              <button
                onClick={() => { setActiveTab('calculator'); setSelectedAccountId(null); }}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeTab === 'calculator'
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Calculator className="w-4 h-4" />
                <span>ROI Calculator</span>
              </button>
            </nav>

            {/* Right actions / Mode badge & New Tracker */}
            <div className="hidden md:flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-50 px-3 py-1.5 border border-slate-200/80 rounded-xl">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Guest Beta Mode</span>
              </div>

              <button
                onClick={() => { setAccountToEdit(undefined); setIsModalOpen(true); }}
                className="flex items-center gap-1 bg-slate-950 text-white font-semibold text-xs px-3 py-2 rounded-xl hover:bg-slate-800 transition shadow-sm cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> New Tracker
              </button>
            </div>

            {/* Mobile Menu Trigger */}
            <div className="flex md:hidden items-center gap-2">
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                {showMobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu panel */}
        {showMobileMenu && (
          <div className="md:hidden border-t border-slate-100 bg-white p-4 space-y-4">
            <div className="space-y-1">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block px-1 mb-1">Navigation Tabs</span>
              <button
                onClick={() => { setActiveTab('dashboard'); setSelectedAccountId(null); setShowMobileMenu(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold ${
                  activeTab === 'dashboard' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" /> Dashboard
              </button>
              <button
                onClick={() => { setActiveTab('accounts'); setShowMobileMenu(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold ${
                  activeTab === 'accounts' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600'
                }`}
              >
                <Building2 className="w-4 h-4" /> My Accounts
              </button>
              <button
                onClick={() => { setActiveTab('playbook'); setSelectedAccountId(null); setShowMobileMenu(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold ${
                  activeTab === 'playbook' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600'
                }`}
              >
                <BookOpen className="w-4 h-4" /> The Playbook
              </button>
              <button
                onClick={() => { setActiveTab('calculator'); setSelectedAccountId(null); setShowMobileMenu(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold ${
                  activeTab === 'calculator' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600'
                }`}
              >
                <Calculator className="w-4 h-4" /> ROI Calculator
              </button>
            </div>
            
            <div className="pt-4 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-50 py-2 border border-slate-100 rounded-lg">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Guest Beta Mode</span>
              </div>
              <button
                onClick={() => { setAccountToEdit(undefined); setIsModalOpen(true); setShowMobileMenu(false); }}
                className="w-full flex items-center justify-center gap-1.5 bg-slate-950 text-white font-semibold text-xs py-2 rounded-lg transition"
              >
                <Plus className="w-3.5 h-3.5" /> New Tracker
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Critical Alert Center (Nudge panel if deadlines are extremely close) */}
      {criticalRequirements.length > 0 && activeTab !== 'playbook' && (
        <div className="bg-amber-500 text-white border-b border-amber-600 py-2.5 px-4">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs sm:text-sm">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="w-4 h-4 text-white shrink-0 animate-bounce" />
              <span>
                <strong>Action Required:</strong> You have {criticalRequirements.length} qualifying deadlines within the next 14 days! Don't miss these bonuses.
              </span>
            </div>
            <button 
              onClick={() => setActiveTab('dashboard')} 
              className="underline text-amber-100 hover:text-white font-semibold flex items-center gap-1 shrink-0 cursor-pointer"
            >
              Check requirements now
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={`tracker-${activeTab}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'dashboard' && (
              <Dashboard
                accounts={accounts}
                onLogProgress={handleLogProgress}
                onSelectAccount={(id) => { setSelectedAccountId(id); setActiveTab('accounts'); }}
                onAddAccountClick={() => { setAccountToEdit(undefined); setInitialPreFill(undefined); setIsModalOpen(true); }}
                onTrackOfferClick={(offer) => { setAccountToEdit(undefined); setInitialPreFill(offer); setIsModalOpen(true); }}
                onSaveAccount={handleSaveNewOrEditedAccount}
                onGoToCalculator={() => setActiveTab('calculator')}
                onGoToAccounts={() => setActiveTab('accounts')}
              />
            )}

            {activeTab === 'accounts' && (
              <AccountList
                accounts={accounts}
                onSelectAccount={setSelectedAccountId}
                selectedAccountId={selectedAccountId}
                onUpdateAccount={handleUpdateAccount}
                onDeleteAccount={handleDeleteAccount}
                onAddAccountClick={() => { setAccountToEdit(undefined); setInitialPreFill(undefined); setIsModalOpen(true); }}
                onEditAccount={(acc) => { setAccountToEdit(acc); setIsModalOpen(true); }}
                onClearAllAccounts={handleClearAllAccounts}
              />
            )}

            {activeTab === 'playbook' && (
              <RuleBook 
                accounts={accounts} 
                rules={rules} 
                onSaveRules={saveRules} 
              />
            )}

            {activeTab === 'calculator' && (
              <ROICalculator 
                accounts={accounts}
                onSelectAccount={(id) => { setSelectedAccountId(id); setActiveTab('accounts'); }}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-100 py-6 text-center text-xs text-slate-400 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 AAD Tracker (Beta Release)</p>
          <div className="flex gap-4">
            <span className="font-mono text-slate-500 font-medium">
              Guest / Local Storage Mode
            </span>
          </div>
        </div>
      </footer>

      {/* Account Modal (Create / Edit Wizard) */}
      {isModalOpen && (
        <AccountModal
          onClose={() => { setIsModalOpen(false); setAccountToEdit(undefined); setInitialPreFill(undefined); }}
          onSave={handleSaveNewOrEditedAccount}
          accountToEdit={accountToEdit}
          initialPreFill={initialPreFill}
        />
      )}
    </div>
  );
}
