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
  ShieldCheck,
  LogOut,
  User as UserIcon,
  Cloud,
  Loader2,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, signInWithGoogle, logOut } from './lib/firebase';
import { 
  saveUserProfile, 
  fetchAccountsFromFirestore, 
  saveAccountToFirestore, 
  saveAllAccountsToFirestore, 
  deleteAccountFromFirestore, 
  fetchRulesFromFirestore, 
  saveAllRulesToFirestore 
} from './lib/sync';

const GoogleIcon = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

export default function App() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [rules, setRules] = useState<BankReEligibilityRule[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'accounts' | 'playbook' | 'calculator'>('dashboard');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [accountToEdit, setAccountToEdit] = useState<BankAccount | undefined>(undefined);
  const [initialPreFill, setInitialPreFill] = useState<{ url?: string; bankName?: string; bonusAmount?: number } | undefined>(undefined);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // User Authentication & Firestore Sync State
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

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

  // Auth & Sync Initialization
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setSyncing(true);
        try {
          // 1. Create or update basic user profile doc in Firestore (no PII beyond Auth standard metadata)
          await saveUserProfile(currentUser.uid, {
            email: currentUser.email,
            displayName: currentUser.displayName,
            photoURL: currentUser.photoURL
          });

          // 2. Fetch user's persistent extracted offers from Firestore
          const remoteAccounts = await fetchAccountsFromFirestore(currentUser.uid);

          // Get local storage accounts
          const localSaved = localStorage.getItem('bank_bonus_tracker_accounts');
          let localAccounts: BankAccount[] = [];
          if (localSaved) {
            try {
              localAccounts = JSON.parse(localSaved).filter((a: BankAccount) => !isSampleAccount(a));
            } catch (e) {
              localAccounts = [];
            }
          }

          // Merge: keep all remote accounts, upload any local offers extracted prior to logging in
          const remoteIds = new Set(remoteAccounts.map(a => a.id));
          const unsyncedLocal = localAccounts.filter(a => !remoteIds.has(a.id));
          const mergedAccounts = [...remoteAccounts, ...unsyncedLocal];

          setAccounts(mergedAccounts);
          localStorage.setItem('bank_bonus_tracker_accounts', JSON.stringify(mergedAccounts));

          if (unsyncedLocal.length > 0) {
            await saveAllAccountsToFirestore(currentUser.uid, mergedAccounts);
          }

          // 3. Sync Rules
          const remoteRules = await fetchRulesFromFirestore(currentUser.uid);
          if (remoteRules.length > 0) {
            setRules(remoteRules);
            localStorage.setItem('bank_reeligibility_rules', JSON.stringify(remoteRules));
          } else {
            const savedRules = localStorage.getItem('bank_reeligibility_rules');
            if (savedRules) {
              try {
                const parsedRules = JSON.parse(savedRules);
                if (parsedRules.length > 0) {
                  setRules(parsedRules);
                  await saveAllRulesToFirestore(currentUser.uid, parsedRules);
                }
              } catch (e) {}
            }
          }
        } catch (err) {
          console.error("Error syncing profile with Firestore:", err);
        } finally {
          setSyncing(false);
        }
      } else {
        // Guest mode fallback
        const saved = localStorage.getItem('bank_bonus_tracker_accounts');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            const clean = (Array.isArray(parsed) ? parsed : []).filter((acc: BankAccount) => !isSampleAccount(acc));
            setAccounts(clean);
          } catch (e) {
            setAccounts([]);
          }
        } else {
          setAccounts([]);
        }

        const savedRules = localStorage.getItem('bank_reeligibility_rules');
        if (savedRules) {
          try {
            setRules(JSON.parse(savedRules));
          } catch (e) {
            setRules([]);
          }
        } else {
          setRules([]);
        }
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Save to local state and local storage cache
  const saveAccountsLocally = (newAccounts: BankAccount[]) => {
    setAccounts(newAccounts);
    localStorage.setItem('bank_bonus_tracker_accounts', JSON.stringify(newAccounts));
  };

  // Custom Rules action
  const saveRules = async (updatedRules: BankReEligibilityRule[]) => {
    setRules(updatedRules);
    localStorage.setItem('bank_reeligibility_rules', JSON.stringify(updatedRules));
    if (user?.uid) {
      await saveAllRulesToFirestore(user.uid, updatedRules);
    }
  };

  // Callback to log progress directly
  const handleLogProgress = async (accountId: string, requirementId: string, amount: number, description: string) => {
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
    if (user?.uid && updatedAcc) {
      await saveAccountToFirestore(user.uid, updatedAcc);
    }
  };

  const handleUpdateAccount = async (updatedAccount: BankAccount) => {
    const updated = accounts.map(a => a.id === updatedAccount.id ? updatedAccount : a);
    saveAccountsLocally(updated);
    if (user?.uid) {
      await saveAccountToFirestore(user.uid, updatedAccount);
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    const updated = accounts.filter(a => a.id !== accountId);
    saveAccountsLocally(updated);
    if (selectedAccountId === accountId) {
      setSelectedAccountId(null);
    }
    if (user?.uid) {
      await deleteAccountFromFirestore(user.uid, accountId);
    }
  };

  const handleClearAllAccounts = async () => {
    saveAccountsLocally([]);
    setSelectedAccountId(null);
    if (user?.uid) {
      await saveAllAccountsToFirestore(user.uid, []);
    }
  };

  const handleSaveNewOrEditedAccount = async (account: BankAccount) => {
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

    if (user?.uid) {
      await saveAccountToFirestore(user.uid, account);
    }
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

            {/* Right actions / Google Auth & New Tracker */}
            <div className="hidden md:flex items-center gap-3 shrink-0">
              {authLoading ? (
                <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-400 bg-slate-50 border border-slate-200/80 rounded-xl">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                  <span>Checking status...</span>
                </div>
              ) : user ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                    className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-xl px-3 py-1.5 transition text-left cursor-pointer"
                  >
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName || 'User'}
                        className="w-6 h-6 rounded-full object-cover border border-indigo-200"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center">
                        {(user.displayName || user.email || 'U')[0].toUpperCase()}
                      </div>
                    )}
                    <div className="hidden sm:block">
                      <span className="block text-xs font-bold text-slate-800 leading-tight truncate max-w-[120px]">
                        {user.displayName || user.email?.split('@')[0]}
                      </span>
                      <span className="block text-[9px] font-semibold text-emerald-600 flex items-center gap-0.5">
                        <Cloud className="w-2.5 h-2.5" />
                        <span>Cloud Saved</span>
                      </span>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </button>

                  {userDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50">
                      <div className="px-4 py-2 border-b border-slate-100">
                        <p className="text-xs font-bold text-slate-900 truncate">{user.displayName || 'User Profile'}</p>
                        <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
                        <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                          <Cloud className="w-3 h-3 text-emerald-600" />
                          <span>Offers linked to Google Profile</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={async () => {
                          setUserDropdownOpen(false);
                          await logOut();
                        }}
                        className="w-full text-left px-4 py-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition flex items-center gap-2 cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await signInWithGoogle();
                    } catch (err: any) {
                      console.error('Sign in failed', err);
                    }
                  }}
                  className="flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold px-3 py-2 rounded-xl transition shadow-xs cursor-pointer"
                >
                  <GoogleIcon />
                  <span>Sign in with Google</span>
                </button>
              )}

              <button
                onClick={() => { setAccountToEdit(undefined); setIsModalOpen(true); }}
                className="flex items-center gap-1 bg-slate-950 text-white font-semibold text-xs px-3.5 py-2 rounded-xl hover:bg-slate-800 transition shadow-sm cursor-pointer"
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
              {user ? (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 overflow-hidden">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="" className="w-7 h-7 rounded-full shrink-0" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                        {(user.displayName || user.email || 'U')[0].toUpperCase()}
                      </div>
                    )}
                    <div className="truncate">
                      <p className="text-xs font-bold text-slate-900 truncate">{user.displayName || user.email}</p>
                      <p className="text-[10px] text-emerald-600 font-medium">Offers saved to profile</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      setShowMobileMenu(false);
                      await logOut();
                    }}
                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg shrink-0 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    setShowMobileMenu(false);
                    try {
                      await signInWithGoogle();
                    } catch (e) {}
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-800 font-bold text-xs py-2.5 rounded-xl shadow-xs"
                >
                  <GoogleIcon />
                  <span>Sign in with Google</span>
                </button>
              )}

              <button
                onClick={() => { setAccountToEdit(undefined); setIsModalOpen(true); setShowMobileMenu(false); }}
                className="w-full flex items-center justify-center gap-1.5 bg-slate-950 text-white font-semibold text-xs py-2.5 rounded-xl transition"
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
          <p>© 2026 MaxMyVacay / AAD Tracker</p>
          <div className="flex items-center gap-2">
            {user ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-150">
                <Cloud className="w-3.5 h-3.5 text-emerald-600" />
                <span>Google Profile Cloud Sync Active ({user.email})</span>
              </span>
            ) : (
              <span className="font-mono text-slate-500 font-medium">
                Guest Mode (Sign in with Google to enable Cloud Profile persistence)
              </span>
            )}
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
