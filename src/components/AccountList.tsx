import React, { useState } from 'react';
import { BankAccount, AccountType, BonusStatus, Requirement, ProgressLog } from '../types';
import { 
  Plus, 
  Trash2, 
  ExternalLink, 
  Edit2, 
  DollarSign, 
  Calendar, 
  FileText, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Activity, 
  Clock, 
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Award,
  AlertTriangle,
  History,
  Tag,
  Sparkles,
  RefreshCw,
  Check,
  Link,
  CreditCard
} from 'lucide-react';

interface AccountListProps {
  accounts: BankAccount[];
  onSelectAccount: (accountId: string) => void;
  selectedAccountId: string | null;
  onUpdateAccount: (account: BankAccount) => void;
  onDeleteAccount: (accountId: string) => void;
  onAddAccountClick: () => void;
  onEditAccount: (account: BankAccount) => void;
  onClearAllAccounts?: () => void;
}

export default function AccountList({
  accounts,
  onSelectAccount,
  selectedAccountId,
  onUpdateAccount,
  onDeleteAccount,
  onAddAccountClick,
  onEditAccount,
  onClearAllAccounts
}: AccountListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Logs editing state
  const [activeReqIdForLog, setActiveReqIdForLog] = useState<string | null>(null);
  const [logAmount, setLogAmount] = useState<number>(0);
  const [logDesc, setLogDesc] = useState<string>('');
  const [logDate, setLogDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [showFailureInput, setShowFailureInput] = useState<boolean>(false);
  const [tempFailureReason, setTempFailureReason] = useState<string>('');

  // Bonus Payout Manual Confirmation State
  const [showEarnedConfirmation, setShowEarnedConfirmation] = useState<boolean>(false);
  const [payoutDateInput, setPayoutDateInput] = useState<string>(new Date().toISOString().split('T')[0]);
  const [payoutAmountInput, setPayoutAmountInput] = useState<number>(0);

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);

  // Plaid Sync States
  const [isPlaidModalOpen, setIsPlaidModalOpen] = useState(false);
  const [plaidStep, setPlaidStep] = useState<'select_bank' | 'credentials' | 'loading' | 'success'>('select_bank');
  const [selectedBankForLink, setSelectedBankForLink] = useState('');
  const [plaidUsername, setPlaidUsername] = useState('');
  const [plaidPassword, setPlaidPassword] = useState('');
  const [linkingError, setLinkingError] = useState<string | null>(null);
  
  const [syncedTransactions, setSyncedTransactions] = useState<any[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [autoMatchMessage, setAutoMatchMessage] = useState<string | null>(null);

  // Auto-fetch synced transactions when a linked account is selected
  React.useEffect(() => {
    if (selectedAccount && selectedAccount.plaidLinked) {
      fetchSyncedTransactions();
    } else {
      setSyncedTransactions([]);
    }
    setAutoMatchMessage(null);
  }, [selectedAccountId, selectedAccount?.plaidLinked]);

  const fetchSyncedTransactions = async () => {
    if (!selectedAccount) return;
    setLoadingTransactions(true);
    try {
      const response = await fetch('/api/plaid/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessToken: 'sim_access_token_' + selectedAccount.id,
          bankName: selectedAccount.bankName,
          requirements: selectedAccount.requirements
        })
      });
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.transactions) {
          setSyncedTransactions(result.transactions);
        }
      }
    } catch (err) {
      console.error('Error fetching transactions:', err);
    } finally {
      setLoadingTransactions(false);
    }
  };

  const handleSimulatePlaidLink = () => {
    if (!selectedAccount) return;
    
    // Simulate completing Plaid connection
    const updatedAccount: BankAccount = {
      ...selectedAccount,
      plaidLinked: true,
      plaidInstitutionName: selectedBankForLink || selectedAccount.bankName,
      plaidLastSyncDate: new Date('2026-07-04').toISOString().split('T')[0]
    };

    onUpdateAccount(updatedAccount);
    setIsPlaidModalOpen(false);
    
    // Reset wizard
    setPlaidStep('select_bank');
    setSelectedBankForLink('');
    setPlaidUsername('');
    setPlaidPassword('');
  };

  const isTransactionSynced = (txId: string) => {
    if (!selectedAccount) return false;
    return selectedAccount.progressLogs.some(log => log.description.includes(txId));
  };

  const handleSyncTransaction = (tx: any) => {
    if (!selectedAccount || isTransactionSynced(tx.id)) return;

    // Find the associated requirement
    const reqId = tx.matchedReqId || selectedAccount.requirements.find(r => r.type === tx.type)?.id;
    if (!reqId) return;

    const newLog: ProgressLog = {
      id: Math.random().toString(),
      requirementId: reqId,
      date: tx.date,
      amount: tx.type === 'debit_transactions' || tx.type === 'bill_pay' ? 1 : tx.amount, // Count for swipes/bill pays, amount for DD
      description: `[Plaid Sync: ${tx.id}] ${tx.name}`
    };

    const updatedRequirements = selectedAccount.requirements.map(req => {
      if (req.id === reqId) {
        const loggedVal = tx.type === 'debit_transactions' || tx.type === 'bill_pay' ? 1 : tx.amount;
        const newValue = req.currentValue + loggedVal;
        const metStatus = newValue >= req.targetValue ? 'met' : 'in_progress';
        return {
          ...req,
          currentValue: newValue,
          status: metStatus as any
        };
      }
      return req;
    });

    const allMet = updatedRequirements.every(r => r.status === 'met');
    const newStatus: BonusStatus = allMet && selectedAccount.status === 'in_progress' ? 'met' : selectedAccount.status;

    const updatedAccount: BankAccount = {
      ...selectedAccount,
      requirements: updatedRequirements,
      progressLogs: [...selectedAccount.progressLogs, newLog],
      status: newStatus
    };

    onUpdateAccount(updatedAccount);
  };

  const handleSyncAllTransactions = () => {
    if (!selectedAccount || syncedTransactions.length === 0) return;

    let updatedAccount = { ...selectedAccount };
    let syncCount = 0;

    syncedTransactions.forEach(tx => {
      if (isTransactionSynced(tx.id)) return;
      const reqId = tx.matchedReqId || updatedAccount.requirements.find(r => r.type === tx.type)?.id;
      if (!reqId) return;

      const newLog: ProgressLog = {
        id: Math.random().toString(),
        requirementId: reqId,
        date: tx.date,
        amount: tx.type === 'debit_transactions' || tx.type === 'bill_pay' ? 1 : tx.amount,
        description: `[Plaid Sync: ${tx.id}] ${tx.name}`
      };

      updatedAccount.requirements = updatedAccount.requirements.map(req => {
        if (req.id === reqId) {
          const loggedVal = tx.type === 'debit_transactions' || tx.type === 'bill_pay' ? 1 : tx.amount;
          const newValue = req.currentValue + loggedVal;
          const metStatus = newValue >= req.targetValue ? 'met' : 'in_progress';
          return {
            ...req,
            currentValue: newValue,
            status: metStatus as any
          };
        }
        return req;
      });

      updatedAccount.progressLogs = [...updatedAccount.progressLogs, newLog];
      syncCount++;
    });

    if (syncCount > 0) {
      const allMet = updatedAccount.requirements.every(r => r.status === 'met');
      if (allMet && updatedAccount.status === 'in_progress') {
        updatedAccount.status = 'met';
      }
      onUpdateAccount(updatedAccount);
      setAutoMatchMessage(`Successfully auto-matched and synchronized ${syncCount} qualifying activities into your compliance log!`);
    } else {
      setAutoMatchMessage('No new unsynchronized qualifying transactions found in the feed.');
    }
  };

  // Filters
  const filteredAccounts = accounts.filter(acc => {
    const matchesSearch = acc.bankName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          acc.accountName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || acc.status === statusFilter;
    const matchesType = typeFilter === 'all' || acc.accountType === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const getStatusBadge = (status: BonusStatus) => {
    switch (status) {
      case 'earned':
        return <span className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-full flex items-center gap-1"><Award className="w-3 h-3" /> Earned</span>;
      case 'in_progress':
        return <span className="px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 rounded-full flex items-center gap-1"><Clock className="w-3 h-3" /> In Progress</span>;
      case 'met':
        return <span className="px-2.5 py-1 text-xs font-semibold text-amber-700 bg-amber-50 rounded-full flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Met, Payout Pending</span>;
      case 'failed':
        return <span className="px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 rounded-full flex items-center gap-1"><XCircle className="w-3 h-3" /> Failed</span>;
      case 'cancelled':
        return <span className="px-2.5 py-1 text-xs font-semibold text-slate-500 bg-slate-100 rounded-full flex items-center gap-1">Cancelled</span>;
      case 'closed':
        return <span className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-200 rounded-full flex items-center gap-1"><History className="w-3 h-3" /> Closed (Archived)</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-semibold text-slate-600 bg-slate-50 rounded-full">Not Started</span>;
    }
  };

  const getAccountTypeLabel = (type: AccountType) => {
    switch (type) {
      case 'checking': return 'Checking';
      case 'savings': return 'Savings';
      case 'business_checking': return 'Biz Checking';
      case 'business_savings': return 'Biz Savings';
      case 'credit_card': return 'Credit Card';
      default: return 'Other';
    }
  };

  const handleAddLog = (requirementId: string) => {
    if (!selectedAccount || logAmount <= 0) return;

    const newLog: ProgressLog = {
      id: Math.random().toString(),
      requirementId,
      date: logDate || new Date().toISOString().split('T')[0],
      amount: logAmount,
      description: logDesc || 'Manual progress logging'
    };

    const updatedRequirements = selectedAccount.requirements.map(req => {
      if (req.id === requirementId) {
        const newValue = req.currentValue + logAmount;
        const metStatus = newValue >= req.targetValue ? 'met' : 'in_progress';
        return {
          ...req,
          currentValue: newValue,
          status: metStatus as any
        };
      }
      return req;
    });

    // Automatically evaluate if all requirements are met to suggest state change
    const allMet = updatedRequirements.every(r => r.status === 'met');
    const newStatus: BonusStatus = allMet && selectedAccount.status === 'in_progress' ? 'met' : selectedAccount.status;

    const updatedAccount: BankAccount = {
      ...selectedAccount,
      requirements: updatedRequirements,
      progressLogs: [...selectedAccount.progressLogs, newLog],
      status: newStatus
    };

    onUpdateAccount(updatedAccount);
    setLogAmount(0);
    setLogDesc('');
    setActiveReqIdForLog(null);
  };

  const handleConfirmBonusPayout = () => {
    if (!selectedAccount) return;

    const updatedAccount: BankAccount = {
      ...selectedAccount,
      status: 'earned',
      payoutReceivedDate: payoutDateInput || new Date().toISOString().split('T')[0],
      bonusAmount: payoutAmountInput > 0 ? payoutAmountInput : selectedAccount.bonusAmount,
      requirements: selectedAccount.requirements.map(r => ({ ...r, status: 'met', currentValue: r.targetValue }))
    };

    onUpdateAccount(updatedAccount);
    setShowEarnedConfirmation(false);
  };

  const handleUpdateStatus = (newStatus: BonusStatus) => {
    if (!selectedAccount) return;

    if (newStatus === 'failed') {
      setShowFailureInput(true);
      setTempFailureReason(selectedAccount.missedReason || '');
      return;
    }

    if (newStatus === 'earned') {
      setPayoutDateInput(selectedAccount.payoutReceivedDate || new Date().toISOString().split('T')[0]);
      setPayoutAmountInput(selectedAccount.bonusAmount);
      setShowEarnedConfirmation(true);
      return;
    }

    let updatedAccount: BankAccount = {
      ...selectedAccount,
      status: newStatus,
      missedReason: undefined
    };

    onUpdateAccount(updatedAccount);
  };

  const handleSaveFailureReason = () => {
    if (!selectedAccount) return;

    const updatedAccount: BankAccount = {
      ...selectedAccount,
      status: 'failed',
      missedReason: tempFailureReason || 'Failed to complete qualifying transactions.'
    };

    onUpdateAccount(updatedAccount);
    setShowFailureInput(false);
  };

  const handleDeleteLog = (logId: string, requirementId: string) => {
    if (!selectedAccount) return;

    const logToDelete = selectedAccount.progressLogs.find(l => l.id === logId);
    if (!logToDelete) return;

    const updatedRequirements = selectedAccount.requirements.map(req => {
      if (req.id === requirementId) {
        const newValue = Math.max(0, req.currentValue - logToDelete.amount);
        const metStatus = newValue >= req.targetValue ? 'met' : (newValue > 0 ? 'in_progress' : 'pending');
        return {
          ...req,
          currentValue: newValue,
          status: metStatus as any
        };
      }
      return req;
    });

    const updatedAccount: BankAccount = {
      ...selectedAccount,
      requirements: updatedRequirements,
      progressLogs: selectedAccount.progressLogs.filter(l => l.id !== logId),
      status: selectedAccount.status === 'met' ? 'in_progress' : selectedAccount.status
    };

    onUpdateAccount(updatedAccount);
  };

  return (
    <div className="grid lg:grid-cols-3 gap-8">
      {/* LEFT COLUMN: Bank Accounts List */}
      <div className="lg:col-span-1 space-y-4">
        {/* Header Action Bar */}
        <div className="flex items-center justify-between px-1">
          <h3 className="font-bold text-slate-900 text-sm">Your Accounts ({accounts.length})</h3>
          <button
            onClick={onAddAccountClick}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-3 py-1.5 rounded-lg transition cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" /> Add Bank Offer
          </button>
        </div>

        {/* Accounts Cards List */}
        <div className="space-y-3 overflow-y-auto max-h-[600px] pr-1">
          {filteredAccounts.length === 0 ? (
            <div className="text-center p-8 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-slate-500 text-xs space-y-2">
              <CreditCard className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-bold text-slate-700">No Accounts Found</p>
              <p className="text-slate-400 text-[11px]">
                {accounts.length === 0
                  ? "You don't have any accounts in your profile yet. Extract an offer from a bank link on the Dashboard or click '+ Add New Bank Offer'."
                  : "No accounts match your current search/filter criteria."}
              </p>
            </div>
          ) : (
            filteredAccounts.map(acc => {
              const isSelected = acc.id === selectedAccountId;
              return (
                <div
                  key={acc.id}
                  onClick={() => onSelectAccount(acc.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer text-left relative ${
                    isSelected 
                      ? 'border-indigo-600 bg-indigo-50/20 shadow-xs' 
                      : 'border-slate-100 bg-white hover:border-slate-200 hover:shadow-xs'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h4 className="font-semibold text-slate-900 text-sm leading-tight">{acc.bankName}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">{acc.accountName}</p>
                    </div>
                    <span className="text-sm font-bold text-indigo-600 font-mono shrink-0">
                      ${acc.bonusAmount}
                    </span>
                  </div>

                  <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-100/60 text-[10px] text-slate-400">
                    <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded uppercase font-medium">
                      {getAccountTypeLabel(acc.accountType)}
                    </span>
                    <div>
                      {getStatusBadge(acc.status)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Selected Account Details Drawer/Layout */}
      <div className="lg:col-span-2">
        {!selectedAccount ? (
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-12 text-center text-slate-500 text-sm flex flex-col items-center justify-center h-full min-h-[300px]">
            <Activity className="w-8 h-8 text-slate-300 mb-3" />
            <p>Select a bank account from the list to manage qualifying rules, record deposits, and track deadlines.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 p-6 md:p-8 shadow-xs space-y-8">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-slate-100 pb-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold">
                    {getAccountTypeLabel(selectedAccount.accountType)}
                  </span>
                  <span>{getStatusBadge(selectedAccount.status)}</span>
                </div>
                <h2 className="text-2xl font-bold text-slate-900">{selectedAccount.bankName}</h2>
                <p className="text-slate-500 text-sm">{selectedAccount.accountName}</p>
                
                {selectedAccount.promoCode && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-2 bg-slate-50 border px-2.5 py-1 rounded-lg w-max">
                    <Tag className="w-3.5 h-3.5 text-slate-400" />
                    <span>Promo Code: <strong className="font-mono text-indigo-600">{selectedAccount.promoCode}</strong></span>
                  </div>
                )}
              </div>

              <div className="flex flex-col items-start md:items-end justify-center gap-2 shrink-0">
                <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Bonus Value</span>
                <span className="text-3xl font-extrabold text-indigo-600 font-mono">${selectedAccount.bonusAmount}</span>
                
                {selectedAccount.offerLink && (
                  <a
                    href={selectedAccount.offerLink}
                    target="_blank"
                    referrerPolicy="no-referrer"
                    className="flex items-center gap-1 text-xs text-indigo-600 font-medium hover:underline mt-1"
                  >
                    Offer Page <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>

            {/* Quick Properties Block */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50/50 rounded-xl p-4 border border-slate-100">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Opened Date</span>
                <span className="text-xs text-slate-700 font-semibold mt-0.5 block">{selectedAccount.openingDate}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Expected Payout</span>
                <span className="text-xs text-slate-700 font-semibold mt-0.5 block">{selectedAccount.expectedPayoutDate || 'Not Specified'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Date Paid Out</span>
                <span className="text-xs text-slate-700 font-semibold mt-0.5 block">{selectedAccount.payoutReceivedDate || 'Pending'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Actions</span>
                <div className="flex gap-2.5 items-center mt-1">
                  <button
                    onClick={() => onEditAccount(selectedAccount)}
                    className="text-xs text-indigo-600 font-bold hover:underline"
                  >
                    Edit Details
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this bank account tracker?')) {
                        onDeleteAccount(selectedAccount.id);
                      }
                    }}
                    className="text-xs text-rose-600 font-medium hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>

            {/* MANUAL SIGN-UP BONUS RECEIPT CONFIRMATION CARD */}
            <div className={`rounded-2xl p-5 border transition-all ${
              selectedAccount.status === 'earned'
                ? 'bg-emerald-50/70 border-emerald-200'
                : 'bg-gradient-to-r from-emerald-50/90 via-indigo-50/30 to-slate-50 border-emerald-200/80 shadow-xs'
            }`}>
              {selectedAccount.status === 'earned' && !showEarnedConfirmation ? (
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs">
                      <Award className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-emerald-950 text-sm">Sign-Up Bonus Cash Confirmed!</h4>
                        <span className="bg-emerald-200 text-emerald-900 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                          Earned
                        </span>
                      </div>
                      <p className="text-xs text-emerald-800 mt-0.5">
                        Received <strong className="font-mono text-emerald-950">${selectedAccount.bonusAmount}</strong> on{' '}
                        <strong>{selectedAccount.payoutReceivedDate || 'Record Date'}</strong>
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPayoutDateInput(selectedAccount.payoutReceivedDate || new Date().toISOString().split('T')[0]);
                      setPayoutAmountInput(selectedAccount.bonusAmount);
                      setShowEarnedConfirmation(true);
                    }}
                    className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 underline cursor-pointer shrink-0"
                  >
                    Edit Payout Details
                  </button>
                </div>
              ) : showEarnedConfirmation ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-emerald-200/60 pb-2">
                    <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <Award className="w-5 h-5 text-emerald-600" /> Confirm Sign-Up Bonus Payout Received
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowEarnedConfirmation(false)}
                      className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    Enter the exact date and cash bonus amount deposited into your bank account. This will mark the account as <strong>Earned</strong> and update your profile dashboard earnings.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">
                        Bonus Payout Received Date
                      </label>
                      <input
                        type="date"
                        value={payoutDateInput}
                        onChange={(e) => setPayoutDateInput(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-emerald-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">
                        Bonus Amount Received ($)
                      </label>
                      <input
                        type="number"
                        value={payoutAmountInput}
                        onChange={(e) => setPayoutAmountInput(Number(e.target.value))}
                        className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-emerald-500 bg-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => setShowEarnedConfirmation(false)}
                      className="px-3 py-1.5 text-xs border rounded-lg text-slate-600 hover:bg-white cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmBonusPayout}
                      className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <Check className="w-4 h-4" /> Confirm & Mark as Earned
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="space-y-1">
                    <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                      <Award className="w-4.5 h-4.5 text-emerald-600" /> Manual Sign-Up Bonus Confirmation
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Did the bank deposit your sign-up bonus cash into this account? Confirm it here to mark as <strong>Earned</strong> and log your earnings.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPayoutDateInput(selectedAccount.payoutReceivedDate || new Date().toISOString().split('T')[0]);
                      setPayoutAmountInput(selectedAccount.bonusAmount);
                      setShowEarnedConfirmation(true);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition shadow-xs cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0"
                  >
                    <Award className="w-4 h-4" /> Confirm Bonus Received (${selectedAccount.bonusAmount})
                  </button>
                </div>
              )}
            </div>

            {/* Fees, Deadlines & Clawbacks Block */}
            {(((selectedAccount.annualFee !== undefined && selectedAccount.annualFee > 0) || selectedAccount.clawbackDate || selectedAccount.bonusPostingDeadlineDate || selectedAccount.excludeFromClosure)) && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-indigo-50/10 rounded-xl p-4 border border-indigo-50/30">
                {selectedAccount.annualFee !== undefined && selectedAccount.annualFee > 0 && (
                  <div>
                    <span className="text-[10px] text-indigo-500 font-bold uppercase block">Annual Fee</span>
                    <span className="text-xs text-slate-700 font-semibold mt-0.5 block font-mono">
                      ${selectedAccount.annualFee}
                    </span>
                  </div>
                )}
                {selectedAccount.annualFeeDecisionDate && (
                  <div>
                    <span className="text-[10px] text-indigo-500 font-bold uppercase block">Fee Decision Date</span>
                    <span className="text-xs text-slate-700 font-semibold mt-0.5 block font-mono">{selectedAccount.annualFeeDecisionDate}</span>
                  </div>
                )}
                {selectedAccount.clawbackDate && (
                  <div>
                    <span className="text-[10px] text-indigo-500 font-bold uppercase block">Clawback ({selectedAccount.clawbackMonths || 6}M)</span>
                    <span className="text-xs text-slate-700 font-semibold mt-0.5 block font-mono">{selectedAccount.clawbackDate}</span>
                  </div>
                )}
                {selectedAccount.bonusPostingDeadlineDate && (
                  <div>
                    <span className="text-[10px] text-indigo-500 font-bold uppercase block">Bonus Post Deadline</span>
                    <span className="text-xs text-slate-700 font-semibold mt-0.5 block font-mono">{selectedAccount.bonusPostingDeadlineDate}</span>
                  </div>
                )}
                {selectedAccount.excludeFromClosure && (
                  <div className="col-span-2 md:col-span-4 mt-1 bg-amber-50/50 p-2 rounded-lg border border-amber-100 flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                    <span className="text-[10px] font-bold text-amber-800">
                      Anchor Account: Excluded from Closure Recommendations (Never closes automatically)
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Note Panel */}
            {selectedAccount.notes && (
              <div className="bg-amber-50/50 border border-amber-100/50 rounded-xl p-4 text-xs text-slate-700 space-y-1">
                <span className="font-semibold text-amber-800">Account Tracker Notes:</span>
                <p className="leading-relaxed text-slate-600">{selectedAccount.notes}</p>
              </div>
            )}

            {/* Failure analysis feedback if Failed */}
            {selectedAccount.status === 'failed' && (
              <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 text-xs text-rose-800 space-y-1">
                <span className="font-semibold flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> What went wrong:</span>
                <p className="leading-relaxed">{selectedAccount.missedReason || 'Requirements not completed within deadline.'}</p>
              </div>
            )}

            {/* DIRECT ACTIVITY LINKING FEED (PLAID) */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 md:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-sm">
                    <Link className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                      Direct Bank Activity Feed
                    </h3>
                    <p className="text-slate-500 text-xs mt-0.5">
                      Automatically capture bank deposits, transfers, and swipes via Plaid.
                    </p>
                  </div>
                </div>

                {selectedAccount.plaidLinked ? (
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 rounded-full flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Linked: {selectedAccount.plaidInstitutionName}
                    </span>
                    <button
                      type="button"
                      onClick={fetchSyncedTransactions}
                      disabled={loadingTransactions}
                      className="text-slate-500 hover:text-indigo-600 p-1.5 rounded-lg hover:bg-slate-100 transition shrink-0"
                      title="Force Refresh Feed"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingTransactions ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                ) : (
                  <span className="px-2.5 py-1 text-[10px] font-bold text-slate-500 bg-slate-100 rounded-full">
                    Disconnected
                  </span>
                )}
              </div>

              {selectedAccount.plaidLinked ? (
                <div className="space-y-4 pt-1">
                  {autoMatchMessage && (
                    <div className="bg-indigo-50 border border-indigo-150 rounded-xl p-3 text-xs text-indigo-900 flex items-start gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                      <p>{autoMatchMessage}</p>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5 bg-indigo-50/40 p-3.5 rounded-xl border border-indigo-100">
                    <div className="space-y-1">
                      <span className="text-[10px] text-indigo-700 font-bold uppercase tracking-wider block">Smart Activity Automation</span>
                      <p className="text-slate-600 text-xs leading-relaxed">
                        Detect direct deposits, debit swipes, and utility payments. Let the agent parse and update your metrics.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleSyncAllTransactions}
                      disabled={syncedTransactions.length === 0}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-3.5 py-2 rounded-lg transition shadow-sm cursor-pointer whitespace-nowrap"
                    >
                      Match & Sync All Qualifying
                    </button>
                  </div>

                  {loadingTransactions ? (
                    <div className="py-8 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin" />
                      <span>Retrieving live transaction feed from Plaid...</span>
                    </div>
                  ) : syncedTransactions.length === 0 ? (
                    <div className="p-4 bg-white border rounded-xl text-center text-xs text-slate-400 italic">
                      No active transactions found on this feed in the last 30 days.
                    </div>
                  ) : (
                    <div className="border border-slate-100 rounded-xl overflow-hidden text-xs bg-white">
                      <div className="bg-slate-50 text-slate-400 font-semibold grid grid-cols-12 p-2.5 border-b uppercase text-[9px] tracking-wider">
                        <div className="col-span-3">Date</div>
                        <div className="col-span-5">Plaid Activity Description</div>
                        <div className="col-span-2 text-right">Value</div>
                        <div className="col-span-2 text-right">Sync State</div>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {syncedTransactions.map(tx => {
                          const isSynced = isTransactionSynced(tx.id);
                          const hasMatch = tx.matchedReqId !== null || selectedAccount.requirements.some(r => r.type === tx.type);
                          
                          return (
                            <div key={tx.id} className={`grid grid-cols-12 p-2.5 items-center ${isSynced ? 'bg-slate-50/50' : ''}`}>
                              <div className="col-span-3 text-slate-400 font-mono text-[11px]">{tx.date}</div>
                              <div className="col-span-5 space-y-0.5">
                                <span className="font-semibold text-slate-800 block truncate">{tx.name}</span>
                                {tx.type !== 'other' && (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.2 rounded capitalize">
                                    {tx.type.replace('_', ' ')} Detected
                                  </span>
                                )}
                              </div>
                              <div className="col-span-2 text-right font-semibold font-mono text-slate-800">
                                {tx.type === 'debit_transactions' || tx.type === 'bill_pay' ? '1 count' : `$${tx.amount}`}
                              </div>
                              <div className="col-span-2 text-right">
                                {isSynced ? (
                                  <span className="text-emerald-600 font-bold text-[11px] flex items-center justify-end gap-0.5">
                                    <Check className="w-3.5 h-3.5" /> Synced
                                  </span>
                                ) : hasMatch ? (
                                  <button
                                    type="button"
                                    onClick={() => handleSyncTransaction(tx)}
                                    className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] px-2 py-1 rounded cursor-pointer"
                                  >
                                    Log Sync
                                  </button>
                                ) : (
                                  <span className="text-slate-400 text-[10px] italic">No active rule</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-2xl p-5 border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-5">
                  <div className="space-y-1.5 max-w-lg">
                    <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      100% Automated Activity Tracking
                    </h4>
                    <p className="text-slate-500 text-xs leading-relaxed">
                      Connect your bank via a secure, read-only Plaid link. Our system scans incoming transactions to immediately qualify payroll direct deposits, debit purchases, and bill payments, checking off your rules in real-time.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedBankForLink(selectedAccount.bankName);
                      setIsPlaidModalOpen(true);
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition shadow-sm cursor-pointer whitespace-nowrap flex items-center gap-2"
                  >
                    <CreditCard className="w-4 h-4" /> Link Plaid Feed
                  </button>
                </div>
              )}
            </div>

            {/* Manage Status Panel */}
            <div className="space-y-3">
              <h3 className="font-semibold text-slate-900 text-sm">Update Bonus Tracker Status</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleUpdateStatus('in_progress')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                    selectedAccount.status === 'in_progress' 
                      ? 'bg-indigo-600 text-white border-indigo-600' 
                      : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'
                  }`}
                >
                  In Progress
                </button>
                <button
                  onClick={() => handleUpdateStatus('met')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                    selectedAccount.status === 'met' 
                      ? 'bg-amber-500 text-white border-amber-500' 
                      : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'
                  }`}
                >
                  Met (Payout Pending)
                </button>
                <button
                  onClick={() => handleUpdateStatus('earned')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                    selectedAccount.status === 'earned' 
                      ? 'bg-emerald-600 text-white border-emerald-600' 
                      : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'
                  }`}
                >
                  Earned
                </button>
                <button
                  onClick={() => handleUpdateStatus('failed')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                    selectedAccount.status === 'failed' 
                      ? 'bg-rose-600 text-white border-rose-600' 
                      : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'
                  }`}
                >
                  Failed / Missed
                </button>
                <button
                  onClick={() => handleUpdateStatus('cancelled')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                    selectedAccount.status === 'cancelled' 
                      ? 'bg-slate-600 text-white border-slate-600' 
                      : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'
                  }`}
                >
                  Cancelled
                </button>
                <button
                  onClick={() => handleUpdateStatus('closed')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                    selectedAccount.status === 'closed' 
                      ? 'bg-slate-700 text-white border-slate-700' 
                      : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'
                  }`}
                >
                  Closed (Archive)
                </button>
              </div>

              {/* Failure Input modal-style box */}
              {showFailureInput && (
                <div className="bg-slate-50 border rounded-xl p-4 mt-2 space-y-3">
                  <label className="block text-xs font-semibold text-slate-700">
                    Why did you fail or miss the qualifying activities? (Help build your dashboard audit history)
                  </label>
                  <textarea
                    rows={2}
                    value={tempFailureReason}
                    onChange={(e) => setTempFailureReason(e.target.value)}
                    placeholder="e.g. Forgot to complete the 15 transactions before the 60 day deadline, or payroll ACH transfer from Capital One didn't count as a direct deposit."
                    className="w-full text-xs p-2.5 border rounded-lg focus:outline-indigo-500 bg-white"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveFailureReason}
                      className="bg-indigo-600 text-white font-semibold text-xs px-3 py-1.5 rounded-lg"
                    >
                      Save Failure Reason
                    </button>
                    <button
                      onClick={() => setShowFailureInput(false)}
                      className="text-slate-500 text-xs px-3 py-1.5 border border-slate-200 rounded-lg bg-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Qualifying Rules & Requirement Cards list */}
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-900 text-base flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                <span>Active Qualifying Rules Checklist</span>
              </h3>

              <div className="space-y-4">
                {selectedAccount.requirements.map(req => {
                  const percent = Math.min(100, Math.round((req.currentValue / req.targetValue) * 100));
                  const isFinished = req.status === 'met';
                  
                  return (
                    <div key={req.id} className="border border-slate-100 rounded-xl p-4 md:p-5 bg-slate-50/20 space-y-3">
                      <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold uppercase font-mono">
                              {req.type.replace('_', ' ')}
                            </span>
                            <span className="text-slate-400 text-xs">•</span>
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" /> Deadline: {req.deadlineDate}
                            </span>
                          </div>
                          <p className="font-semibold text-slate-800 text-sm mt-1.5">{req.description}</p>
                        </div>

                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${
                          isFinished 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                        }`}>
                          {req.status}
                        </span>
                      </div>

                      {/* Progress slider / stats */}
                      <div className="space-y-1 pt-1">
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>
                            Progress: <strong className="text-slate-800 font-mono">
                              {req.type === 'debit_transactions' || req.type === 'bill_pay' ? `${req.currentValue} / ${req.targetValue}` : `$${req.currentValue} / $${req.targetValue}`}
                            </strong>
                          </span>
                          <span className="font-semibold">{percent}%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div 
                            className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>

                      {/* Add Activity Log directly to this rule */}
                      <div className="pt-2">
                        {activeReqIdForLog === req.id ? (
                          <div className="bg-white border rounded-lg p-3 space-y-3 shadow-xs">
                            <span className="text-xs font-semibold text-slate-800 block">Record Qualifying Event</span>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <div>
                                <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">
                                  Date Received / Processed
                                </label>
                                <input
                                  type="date"
                                  value={logDate}
                                  onChange={(e) => setLogDate(e.target.value)}
                                  className="w-full px-2.5 py-1 text-xs border rounded focus:outline-indigo-500 bg-white"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">
                                  {req.type === 'debit_transactions' || req.type === 'bill_pay' ? 'Transactions Count' : 'Transaction Amount ($)'}
                                </label>
                                <input
                                  type="number"
                                  placeholder={req.type === 'debit_transactions' || req.type === 'bill_pay' ? 'e.g. 5' : 'e.g. 500'}
                                  value={logAmount || ''}
                                  onChange={(e) => setLogAmount(parseFloat(e.target.value))}
                                  className="w-full px-2.5 py-1 text-xs border rounded focus:outline-indigo-500"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Description</label>
                                <input
                                  type="text"
                                  placeholder="e.g. Payroll direct deposit, Amazon swipe"
                                  value={logDesc}
                                  onChange={(e) => setLogDesc(e.target.value)}
                                  className="w-full px-2.5 py-1 text-xs border rounded focus:outline-indigo-500"
                                />
                              </div>
                            </div>
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => handleAddLog(req.id)}
                                className="bg-indigo-600 text-white font-semibold text-xs px-2.5 py-1 rounded-md cursor-pointer hover:bg-indigo-700 transition"
                              >
                                Save Activity
                              </button>
                              <button
                                onClick={() => setActiveReqIdForLog(null)}
                                className="text-slate-500 text-xs px-2.5 py-1 border rounded-md cursor-pointer hover:bg-slate-50 transition"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setActiveReqIdForLog(req.id);
                              setLogAmount(0);
                              setLogDesc('');
                              setLogDate(new Date().toISOString().split('T')[0]);
                            }}
                            className="text-xs text-indigo-600 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" /> Log qualifying deposit / transaction
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Progress Logs list */}
            <div className="space-y-4 border-t border-slate-100 pt-6">
              <h3 className="font-semibold text-slate-900 text-base flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-600" />
                <span>Qualifying Progress Audit History</span>
              </h3>

              {selectedAccount.progressLogs.length === 0 ? (
                <p className="text-slate-400 text-xs italic">No transactions or requirements logged yet for this account. Create logs above to populate history.</p>
              ) : (
                <div className="border border-slate-100 rounded-xl overflow-hidden text-xs">
                  <div className="bg-slate-50 text-slate-400 font-semibold grid grid-cols-12 p-2.5 border-b uppercase tracking-wider text-[10px]">
                    <div className="col-span-3">Date</div>
                    <div className="col-span-5">Activity Details</div>
                    <div className="col-span-2 text-right">Amount / Value</div>
                    <div className="col-span-2 text-right">Action</div>
                  </div>
                  <div className="divide-y divide-slate-50 bg-white">
                    {selectedAccount.progressLogs.map(log => {
                      const associatedReq = selectedAccount.requirements.find(r => r.id === log.requirementId);
                      return (
                        <div key={log.id} className="grid grid-cols-12 p-3 items-center text-slate-600">
                          <div className="col-span-3 text-slate-500 font-mono">{log.date}</div>
                          <div className="col-span-5">
                            <span className="font-medium text-slate-800 block">{log.description}</span>
                            {associatedReq && (
                              <span className="text-[10px] text-slate-400 block mt-0.5">
                                Rule: {associatedReq.description.substring(0, 30)}...
                              </span>
                            )}
                          </div>
                          <div className="col-span-2 text-right font-semibold font-mono text-slate-800">
                            {associatedReq?.type === 'debit_transactions' || associatedReq?.type === 'bill_pay' ? log.amount : `$${log.amount}`}
                          </div>
                          <div className="col-span-2 text-right">
                            <button
                              onClick={() => handleDeleteLog(log.id, log.requirementId)}
                              className="text-rose-500 hover:text-rose-700 font-semibold text-[11px]"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {/* PLAID CONNECTION MODAL / DIALOG */}
      {isPlaidModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col relative animate-in fade-in zoom-in-95 duration-200">
            {/* Plaid Header */}
            <div className="bg-slate-950 text-white p-6 relative overflow-hidden shrink-0">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-black text-sm shadow-inner">
                    P
                  </div>
                  <div>
                    <span className="font-bold text-sm tracking-tight block">Link Bank Account</span>
                    <span className="text-[10px] text-indigo-300 font-mono block">SECURE CONNECTOR VIA PLAID</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPlaidModalOpen(false)}
                  className="text-slate-400 hover:text-white text-xs p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body depending on step */}
            <div className="p-6 flex-1 overflow-y-auto space-y-4">
              {plaidStep === 'select_bank' && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h4 className="font-bold text-slate-800 text-sm">Select Your Banking Institution</h4>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      Select the bank you used to register the sign-up promotional offer.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {[
                      { name: 'Chase Bank', color: 'hover:border-blue-600 hover:bg-blue-50/10' },
                      { name: 'Capital One', color: 'hover:border-red-600 hover:bg-red-50/10' },
                      { name: 'Wells Fargo', color: 'hover:border-amber-600 hover:bg-amber-50/10' },
                      { name: 'Citi Bank', color: 'hover:border-blue-500 hover:bg-blue-50/10' },
                      { name: 'Bank of America', color: 'hover:border-red-500 hover:bg-red-50/10' },
                      { name: 'Discover Savings', color: 'hover:border-orange-500 hover:bg-orange-50/10' }
                    ].map(bank => (
                      <button
                        key={bank.name}
                        type="button"
                        onClick={() => {
                          setSelectedBankForLink(bank.name);
                          setPlaidStep('credentials');
                        }}
                        className={`p-3 border border-slate-100 rounded-xl bg-slate-50/50 text-left transition-all ${bank.color} group cursor-pointer`}
                      >
                        <span className="font-bold text-slate-800 text-xs block group-hover:text-slate-900">{bank.name}</span>
                        <span className="text-[9px] text-slate-400 block mt-0.5">Secure Link</span>
                      </button>
                    ))}
                  </div>

                  <div className="pt-2 text-center">
                    <span className="text-[10px] text-slate-400 block font-mono">🔒 SECURE AES-256 BANK-GRADE ENCRYPTION</span>
                  </div>
                </div>
              )}

              {plaidStep === 'credentials' && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h4 className="font-bold text-slate-800 text-sm">Sign in to {selectedBankForLink}</h4>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      Login securely with your bank credentials. Plaid never stores or shares your passwords.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                        Bank Username / ID
                      </label>
                      <input
                        type="text"
                        placeholder="Enter username"
                        value={plaidUsername}
                        onChange={(e) => setPlaidUsername(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50/50 focus:bg-white text-slate-800 focus:outline-indigo-500 font-sans"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                        Bank Password
                      </label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={plaidPassword}
                        onChange={(e) => setPlaidPassword(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50/50 focus:bg-white text-slate-800 focus:outline-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-[11px] text-amber-800 leading-relaxed">
                    <strong>Plaid Sandbox / Developer Mode Active:</strong> You can enter any mock credentials above to simulate immediate authorization and test compliance transaction sync!
                  </div>

                  <div className="flex gap-2 pt-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setPlaidStep('select_bank')}
                      className="text-slate-500 text-xs px-3.5 py-2 border border-slate-200 rounded-lg bg-white"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPlaidStep('loading');
                        setTimeout(() => {
                          setPlaidStep('success');
                        }, 1200);
                      }}
                      disabled={!plaidUsername || !plaidPassword}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold text-xs px-4 py-2 rounded-lg transition shadow-sm cursor-pointer"
                    >
                      Authorize Connector
                    </button>
                  </div>
                </div>
              )}

              {plaidStep === 'loading' && (
                <div className="py-12 text-center space-y-4">
                  <RefreshCw className="w-10 h-10 text-indigo-600 animate-spin mx-auto" />
                  <div className="space-y-1">
                    <span className="font-bold text-slate-800 text-sm block">Establishing Encrypted Connection</span>
                    <span className="text-slate-400 text-xs block">Verifying user tokens on bank gateways...</span>
                  </div>
                </div>
              )}

              {plaidStep === 'success' && (
                <div className="py-6 text-center space-y-4">
                  <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-600 border border-emerald-100">
                    <Check className="w-8 h-8" />
                  </div>
                  
                  <div className="space-y-1">
                    <span className="font-bold text-slate-900 text-base block">Connection Successful!</span>
                    <p className="text-slate-500 text-xs leading-relaxed px-4">
                      <strong>{selectedBankForLink}</strong> has been linked successfully. We've established a secure sync connection to fetch transaction updates automatically.
                    </p>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleSimulatePlaidLink}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition shadow-sm cursor-pointer"
                    >
                      Go to Activity Feed
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
