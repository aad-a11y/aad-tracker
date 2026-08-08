import React, { useState } from 'react';
import { 
  BookOpen, 
  AlertTriangle, 
  Sparkles, 
  CheckCircle2, 
  ShieldCheck, 
  DollarSign, 
  RefreshCw, 
  Smartphone, 
  Plus, 
  Trash2, 
  Save, 
  RotateCcw, 
  Check, 
  Calendar, 
  History, 
  UserCheck, 
  Sliders, 
  Info,
  Clock
} from 'lucide-react';
import { BankAccount, BankReEligibilityRule, DEFAULT_RE_ELIGIBILITY_RULES, KNOWN_BANK_RULE_PRESETS } from '../types';

interface RuleBookProps {
  accounts?: BankAccount[];
  rules?: BankReEligibilityRule[];
  onSaveRules?: (rules: BankReEligibilityRule[]) => void;
}

export default function RuleBook({ accounts = [], rules: propsRules, onSaveRules }: RuleBookProps) {
  const [activeTab, setActiveTab] = useState<'dd' | 'debit' | 'fees' | 'close' | 'reeligibility'>('dd');

  // Load rules from localStorage
  const [localRules, setLocalRules] = useState<BankReEligibilityRule[]>(() => {
    const saved = localStorage.getItem('bank_reeligibility_rules');
    if (saved) {
      try {
        const parsed: BankReEligibilityRule[] = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const rawRules = propsRules || localRules;

  // Calculate effective rules based ONLY on accounts the user has added + custom user rules
  const rules = React.useMemo(() => {
    const userBankNames = Array.from(
      new Set(accounts.map(acc => acc.bankName?.trim()).filter(Boolean))
    );

    const mergedList: BankReEligibilityRule[] = [...rawRules];

    // For any bank in active accounts, ensure a rule exists
    userBankNames.forEach(bankName => {
      const bankLower = bankName.toLowerCase();
      const exists = mergedList.some(r =>
        r.bankName.toLowerCase() === bankLower ||
        bankLower.includes(r.bankName.toLowerCase()) ||
        r.bankName.toLowerCase().includes(bankLower)
      );

      if (!exists) {
        const presetKey = Object.keys(KNOWN_BANK_RULE_PRESETS).find(k => bankLower.includes(k) || k.includes(bankLower));
        const preset = presetKey ? KNOWN_BANK_RULE_PRESETS[presetKey] : null;

        mergedList.push({
          id: `rule-auto-${bankLower.replace(/[^a-z0-9]/g, '')}`,
          bankName: bankName,
          coolingOffPeriodMonths: preset?.coolingOffPeriodMonths || 24,
          clockStartsFrom: preset?.clockStartsFrom || 'bonus_received_date',
          scope: preset?.scope || 'account_type_specific',
          notes: preset?.notes || `Cooling-off policy rule for ${bankName}.`
        });
      }
    });

    // Filter out static preset rules if the bank is NOT in the user's accounts and was NOT manually added
    return mergedList.filter(r => {
      const matchesUserAccount = userBankNames.some(b =>
        b.toLowerCase().includes(r.bankName.toLowerCase()) ||
        r.bankName.toLowerCase().includes(b.toLowerCase())
      );
      const isCustomRule = r.id.startsWith('rule-custom-') || r.id.startsWith('rule-user-') || r.id.startsWith('rule-1');

      return matchesUserAccount || isCustomRule;
    });
  }, [accounts, rawRules]);


  // State for rules editor
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [editBankName, setEditBankName] = useState('');
  const [editMonths, setEditMonths] = useState<number>(24);
  const [editClockStart, setEditClockStart] = useState<'open_date' | 'close_date' | 'bonus_received_date'>('bonus_received_date');
  const [editScope, setEditScope] = useState<'account_type_specific' | 'entire_relationship'>('account_type_specific');
  const [editNotes, setEditNotes] = useState('');

  const [isAddingRule, setIsAddingRule] = useState(false);

  const saveRules = (updatedRules: BankReEligibilityRule[]) => {
    if (onSaveRules) {
      onSaveRules(updatedRules);
    } else {
      setLocalRules(updatedRules);
      localStorage.setItem('bank_reeligibility_rules', JSON.stringify(updatedRules));
    }
  };

  const handleStartEdit = (rule: BankReEligibilityRule) => {
    setEditingRuleId(rule.id);
    setEditBankName(rule.bankName);
    setEditMonths(rule.coolingOffPeriodMonths);
    setEditClockStart(rule.clockStartsFrom);
    setEditScope(rule.scope);
    setEditNotes(rule.notes || '');
  };

  const handleSaveEdit = (id: string) => {
    const updated = rawRules.map(r => r.id === id ? {
      ...r,
      bankName: editBankName,
      coolingOffPeriodMonths: editMonths,
      clockStartsFrom: editClockStart,
      scope: editScope,
      notes: editNotes
    } : r);
    saveRules(updated);
    setEditingRuleId(null);
  };

  const handleDeleteRule = (id: string) => {
    if (confirm('Are you sure you want to delete this rule?')) {
      const updated = rawRules.filter(r => r.id !== id);
      saveRules(updated);
    }
  };

  const handleAddRule = () => {
    if (!editBankName) {
      alert('Please enter a bank name.');
      return;
    }
    const newRule: BankReEligibilityRule = {
      id: `rule-custom-${Date.now()}`,
      bankName: editBankName,
      coolingOffPeriodMonths: editMonths,
      clockStartsFrom: editClockStart,
      scope: editScope,
      notes: editNotes
    };
    saveRules([...rawRules, newRule]);
    setIsAddingRule(false);
    // Reset fields
    setEditBankName('');
    setEditMonths(24);
    setEditClockStart('bonus_received_date');
    setEditScope('account_type_specific');
    setEditNotes('');
  };

  const handleResetRules = () => {
    if (confirm('Are you sure you want to reset all custom rules? Rules will revert to match your active accounts.')) {
      saveRules([]);
    }
  };

  const ddTips = [
    {
      bank: 'Chase',
      counts: ['Employer Payroll', 'Government Benefits', 'Fidelity Brokerage Transfers', 'Schwab Brokerage Transfers'],
      doesNotCount: ['Zelle', 'Venmo/PayPal', 'Standard ACH from Wells Fargo/BoA', 'ATM Deposits'],
      difficulty: 'Medium'
    },
    {
      bank: 'Capital One',
      counts: ['Employer Payroll', 'Allied Irish ACH', 'Discover Bank Transfers', 'Fidelity ACH Out'],
      doesNotCount: ['Venmo', 'Cash App', 'Local bank cash transfer'],
      difficulty: 'Easy'
    },
    {
      bank: 'Citi',
      counts: ['Employer Payroll', 'Vanguard Brokerage', 'E*TRADE', 'Standard External Bank ACH (often works)'],
      doesNotCount: ['P2P Transfers', 'Zelle'],
      difficulty: 'Low'
    }
  ];

  // Calculation of eligibility timeline based on current rules and accounts
  const today = new Date('2026-07-04');
  
  const getRuleForBank = (bankName: string): BankReEligibilityRule => {
    const match = rules.find(r => r.bankName.toLowerCase() === bankName.toLowerCase() || bankName.toLowerCase().includes(r.bankName.toLowerCase()) || r.bankName.toLowerCase().includes(bankName.toLowerCase()));
    if (match) return match;
    // Default fallback rule
    return {
      id: 'default-fallback',
      bankName: bankName,
      coolingOffPeriodMonths: 24,
      clockStartsFrom: 'close_date',
      scope: 'account_type_specific',
      notes: 'Standard fallback 24-month cooling-off rule'
    };
  };

  const plannedAccounts = accounts.map(acc => {
    const rule = getRuleForBank(acc.bankName);
    
    // Determine clock start base date
    let baseDate: Date;
    let clockStartText = '';
    if (rule.clockStartsFrom === 'open_date') {
      baseDate = new Date(acc.openingDate);
      clockStartText = `Account Open Date (${acc.openingDate})`;
    } else if (rule.clockStartsFrom === 'bonus_received_date') {
      baseDate = acc.payoutReceivedDate ? new Date(acc.payoutReceivedDate) : (acc.expectedPayoutDate ? new Date(acc.expectedPayoutDate) : new Date(acc.openingDate));
      clockStartText = acc.payoutReceivedDate 
        ? `Bonus Received Date (${acc.payoutReceivedDate})`
        : `Est. Bonus Date (${acc.expectedPayoutDate || acc.openingDate})`;
    } else {
      // close_date
      // if account is marked 'closed', we assume it closed around the fee decision date or 180 days after opening
      if (acc.status === 'closed' && acc.annualFeeDecisionDate) {
        baseDate = new Date(acc.annualFeeDecisionDate);
        clockStartText = `Fee Decision/Close Date (${acc.annualFeeDecisionDate})`;
      } else {
        const openDate = new Date(acc.openingDate);
        baseDate = new Date(openDate);
        baseDate.setMonth(baseDate.getMonth() + 6); // default 6M life
        clockStartText = `Est. Close Date (6M after open: ${baseDate.toISOString().split('T')[0]})`;
      }
    }

    const eligibleDate = new Date(baseDate);
    eligibleDate.setMonth(eligibleDate.getMonth() + rule.coolingOffPeriodMonths);
    
    const diffTime = eligibleDate.getTime() - today.getTime();
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const isEligibleNow = daysLeft <= 0;

    return {
      account: acc,
      rule,
      clockStartText,
      eligibleDateStr: eligibleDate.toISOString().split('T')[0],
      daysLeft,
      isEligibleNow
    };
  });

  // Grouped results
  const eligibleNow = plannedAccounts.filter(p => p.isEligibleNow && p.account.status !== 'cancelled');
  const coolingOffActive = plannedAccounts.filter(p => !p.isEligibleNow && p.account.status !== 'cancelled');

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 md:p-8 shadow-xs space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-6">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 font-medium text-sm tracking-wider uppercase mb-1">
            <BookOpen className="w-4 h-4" />
            <span>Rules & Education Hub</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">The Churning Playbook & Planner</h2>
          <p className="text-slate-500 text-sm mt-1">
            Keep track of bank rules, configure cooling-off limits, and check your re-eligibility status dynamically.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex flex-wrap p-1 bg-slate-100 rounded-xl self-start gap-0.5">
          <button
            onClick={() => setActiveTab('dd')}
            className={`px-3 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'dd' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Direct Deposits
          </button>
          <button
            onClick={() => setActiveTab('debit')}
            className={`px-3 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'debit' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Debit Swipes
          </button>
          <button
            onClick={() => setActiveTab('fees')}
            className={`px-3 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'fees' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Fee Avoidance
          </button>
          <button
            onClick={() => setActiveTab('close')}
            className={`px-3 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'close' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Account Closure
          </button>
          <button
            onClick={() => setActiveTab('reeligibility')}
            className={`px-3 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'reeligibility' ? 'bg-indigo-600 text-white shadow-xs' : 'text-indigo-600 hover:text-indigo-900 hover:bg-slate-50/50'
            }`}
          >
            Re-Eligibility Planner
          </button>
        </div>
      </div>

      {activeTab === 'dd' && (
        <div className="space-y-6">
          <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-amber-900 text-sm">Why do users fail Direct Deposit rules?</h4>
              <p className="text-amber-800 text-xs mt-1 leading-relaxed">
                Most banks require a "Qualifying Direct Deposit" (usually a real payroll or government benefit ACH deposit). Simply transferring money from your personal account at another local bank (e.g., Wells Fargo to Chase) usually does <strong>not</strong> trigger the bonus flag.
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-medium text-slate-900 mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                <span>ACH Workarounds (How to Fake it)</span>
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-4">
                If you cannot easily split your employer payroll, certain brokerage accounts or treasury payments register as "Direct Deposits" at many major banks.
              </p>
              <div className="space-y-3">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                  <span className="font-semibold text-slate-800 block mb-1">Method 1: Brokerage Transfers</span>
                  <p className="text-slate-600">Initiating a withdrawal or transfer from <strong>Fidelity, Charles Schwab, or Vanguard</strong> to your new checking account frequently triggers the Direct Deposit flag.</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                  <span className="font-semibold text-slate-800 block mb-1">Method 2: Small Business Payroll</span>
                  <p className="text-slate-600">If you have a side hustle, using payroll services like Stripe, Square, or Gusto to pay yourself will always qualify as a direct deposit.</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium text-slate-900 mb-3 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>Known Bank Trigger Checklist</span>
              </h3>
              <div className="space-y-3">
                {ddTips.map((tip) => (
                  <div key={tip.bank} className="border border-slate-100 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-slate-800 text-sm">{tip.bank}</span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                        Difficulty: {tip.difficulty}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-emerald-600 font-medium block mb-0.5">Known to work:</span>
                        <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
                          {tip.counts.slice(0, 2).map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <span className="text-rose-600 font-medium block mb-0.5">Does NOT work:</span>
                        <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
                          {tip.doesNotCount.slice(0, 2).map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'debit' && (
        <div className="space-y-6">
          <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-emerald-900 text-sm">Hacking Debit Card Transaction Count</h4>
              <p className="text-emerald-800 text-xs mt-1 leading-relaxed">
                Many checking account bonuses require you to make 10 to 15 debit card transactions within 60 days. You do not need to spend significant money; you just need to trigger transactions!
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
              <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center mb-3">
                <DollarSign className="w-4 h-4 text-indigo-600" />
              </div>
              <h4 className="font-semibold text-slate-900 text-sm mb-1">Amazon Reloads</h4>
              <p className="text-slate-600 text-xs leading-relaxed">
                Go to Amazon {"->"} Accounts {"->"} Gift Card Balance {"->"} Reload. Use your new debit card to load separate transactions of <strong>$1.00</strong> each. This triggers immediately and satisfies the rule at very low cost.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
              <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center mb-3">
                <RefreshCw className="w-4 h-4 text-indigo-600" />
              </div>
              <h4 className="font-semibold text-slate-900 text-sm mb-1">Self-Checkout Splitting</h4>
              <p className="text-slate-600 text-xs leading-relaxed">
                When buying groceries or everyday items, go to a self-checkout lane and split the payment. Swipe your new debit card for multiple small $0.50 - $1.00 transactions.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
              <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center mb-3">
                <Smartphone className="w-4 h-4 text-indigo-600" />
              </div>
              <h4 className="font-semibold text-slate-900 text-sm mb-1">App Balances</h4>
              <p className="text-slate-600 text-xs leading-relaxed">
                Add your new debit card to apps you already use, such as Starbucks, Dunkin, or transit cards, and load $2 to $5 multiple times. This satisfies transaction count rules without waste.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'fees' && (
        <div className="space-y-6">
          <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-indigo-900 text-sm">Prevent Monthly Fees Eating Your Bonus</h4>
              <p className="text-indigo-800 text-xs mt-1 leading-relaxed">
                Checking accounts often carry a $12-$15 monthly maintenance fee unless you meet waiver criteria. Don't let fees slowly drain your sign-up bonus!
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex gap-4 items-start border-b border-slate-100 pb-3">
              <span className="text-lg font-bold text-slate-300 font-mono">01</span>
              <div>
                <h5 className="font-semibold text-slate-800 text-sm">Paperless Statements</h5>
                <p className="text-slate-600 text-xs mt-0.5">Most banks charge $2-$3 per month just to mail you paper statements. Opt-in to paperless online statements on day one of opening the account.</p>
              </div>
            </div>

            <div className="flex gap-4 items-start border-b border-slate-100 pb-3">
              <span className="text-lg font-bold text-slate-300 font-mono">02</span>
              <div>
                <h5 className="font-semibold text-slate-800 text-sm">Minimum Balance Waivers</h5>
                <p className="text-slate-600 text-xs mt-0.5">If the account has a minimum balance fee waiver (e.g., maintain $1,500 daily balance), ensure you transfer this buffer immediately and keep it there. Do not touch this money until your bonus is paid out.</p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <span className="text-lg font-bold text-slate-300 font-mono">03</span>
              <div>
                <h5 className="font-semibold text-slate-800 text-sm">Automated Transfer Loops</h5>
                <p className="text-slate-600 text-xs mt-0.5">If a bank requires $500 monthly deposit to waive the fee, set up an automated monthly ACH transfer of $500 from your primary external checking account on the 1st, and an automated transfer back to your primary account on the 5th.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'close' && (
        <div className="space-y-6">
          <div className="p-4 bg-rose-50 rounded-xl border border-rose-100 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-rose-900 text-sm">The 6-Month Rule (Early Account Closure Fee)</h4>
              <p className="text-rose-800 text-xs mt-1 leading-relaxed">
                Most banks have a strict penalty in their fine print: if you close your account within 180 days (6 months) of opening it, they will <strong>reclaim your entire sign-up bonus</strong> or charge an early closure fee.
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6 text-sm">
            <div className="space-y-3">
              <h4 className="font-semibold text-slate-800">Before Closing Checklist</h4>
              <ul className="space-y-2 text-slate-600 text-xs">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>Verify the bonus payout has actually cleared and is in your account.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>Ensure at least 180 days have elapsed since the official opening date.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>Transfer your remaining balance back to your primary hub account.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>Download all PDF bank statements and tax forms (1099-INT) for your records.</span>
                </li>
              </ul>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <h4 className="font-semibold text-slate-800 mb-2">Tax Implications Note</h4>
              <p className="text-slate-600 text-xs leading-relaxed">
                Bank bonuses are considered <strong>Interest Income</strong> by the IRS, not rebates/cash back. The bank will mail you a Form 1099-INT at the end of the year if your earnings exceed $10. Keep this in mind during tax season, as this income is taxable.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'reeligibility' && (
        <div className="space-y-8 animate-fade-in">
          {/* Section 1: Intro Callout */}
          <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-xl flex items-start gap-3">
            <Sliders className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-bold text-indigo-900 text-sm">Interactive Cooling-Off Rules & Re-Eligibility Planner</h4>
              <p className="text-slate-600 text-xs leading-relaxed">
                Banks restrict sign-up bonuses to once every 12, 24, or 36 months. Maintain your rulebook below. The planner dynamically cross-references your archived accounts to identify exactly when you are eligible to safely open a new account and claim another bonus.
              </p>
            </div>
          </div>

          {/* Section 2: Proactive Planner Timeline Board */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-indigo-600" />
              <span>Personal Re-Eligibility Planner Board</span>
            </h3>

            {accounts.length === 0 ? (
              <div className="text-center p-8 bg-slate-50 rounded-2xl border text-xs text-slate-500">
                You haven't tracked any accounts yet. Once you add accounts and close or complete them, their cooling-off re-eligibility dates will map here proactively!
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {/* Board Column A: Eligible Again Now (Green) */}
                <div className="bg-emerald-50/20 border border-emerald-100 rounded-2xl p-5 space-y-4">
                  <div className="flex justify-between items-center border-b border-emerald-100/50 pb-2.5">
                    <span className="font-bold text-emerald-900 text-sm flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>Ready to Re-Open ({eligibleNow.length})</span>
                    </span>
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Clean Period</span>
                  </div>

                  {eligibleNow.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No previous accounts have fully completed their cooling-off cycles yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {eligibleNow.map(({ account, rule, clockStartText, eligibleDateStr }) => (
                        <div key={account.id} className="bg-white p-3.5 rounded-xl border border-emerald-150/50 shadow-xs space-y-1">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="font-bold text-slate-900 text-xs">{account.bankName}</span>
                              <p className="text-[10px] text-slate-500">{account.accountName} • {account.accountType.replace('_', ' ')}</p>
                            </div>
                            <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-100">
                              ✓ Eligible Now!
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 pt-1.5 border-t border-slate-50 space-y-1">
                            <p><strong>Cooling Rule:</strong> {rule.coolingOffPeriodMonths} Months from {rule.clockStartsFrom.replace('_', ' ')} ({rule.scope === 'entire_relationship' ? 'Relationship' : 'Type Specific'})</p>
                            <p><strong>Clock Anchored:</strong> {clockStartText}</p>
                            <p className="text-emerald-700 font-bold">Eligibility date passed: {eligibleDateStr}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Board Column B: Cooling-off Period Active (Indigo/Amber) */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-200/60 pb-2.5">
                    <span className="font-bold text-slate-700 text-sm flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-slate-500" />
                      <span>Cooling Off Active ({coolingOffActive.length})</span>
                    </span>
                    <span className="bg-slate-200 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Waiting</span>
                  </div>

                  {coolingOffActive.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No accounts are currently in active cooling-off states.</p>
                  ) : (
                    <div className="space-y-3">
                      {coolingOffActive.map(({ account, rule, clockStartText, eligibleDateStr, daysLeft }) => (
                        <div key={account.id} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-1">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="font-bold text-slate-950 text-xs">{account.bankName}</span>
                              <p className="text-[10px] text-slate-500">{account.accountName} • {account.accountType.replace('_', ' ')}</p>
                            </div>
                            <span className="bg-amber-50 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-100 font-mono">
                              {daysLeft} days left
                            </span>
                          </div>
                          
                          <div className="text-[10px] text-slate-500 pt-1.5 border-t border-slate-50 space-y-1">
                            <p><strong>Rule:</strong> {rule.coolingOffPeriodMonths} Months from {rule.clockStartsFrom.replace('_', ' ')}</p>
                            <p><strong>Clock Anchored:</strong> {clockStartText}</p>
                            <p className="text-indigo-600 font-bold">Eligible again on: {eligibleDateStr}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Interactive Rules Editor Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
            <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Maintain Policy Rules Table</h4>
                <p className="text-xs text-slate-500 mt-0.5">Add or update cooling-off periods and trigger events as bank terms evolve.</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleResetRules}
                  type="button"
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border rounded-lg hover:bg-slate-50 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reset Defaults
                </button>
                <button
                  onClick={() => {
                    setIsAddingRule(true);
                    setEditingRuleId(null);
                    setEditBankName('');
                    setEditMonths(24);
                    setEditClockStart('bonus_received_date');
                    setEditScope('account_type_specific');
                    setEditNotes('');
                  }}
                  type="button"
                  className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Bank Policy
                </button>
              </div>
            </div>

            {/* Rule form (if adding or editing) */}
            {(isAddingRule || editingRuleId !== null) && (
              <div className="p-5 border-b border-slate-200 bg-indigo-50/20 space-y-4">
                <h5 className="font-bold text-slate-900 text-xs">
                  {isAddingRule ? 'Add New Bank Policy Rule' : 'Edit Bank Policy Rule'}
                </h5>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Bank Name</label>
                    <input
                      type="text"
                      value={editBankName}
                      onChange={(e) => setEditBankName(e.target.value)}
                      placeholder="e.g. Citibank"
                      className="w-full text-xs px-3 py-2 border rounded-lg bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Cooling Period (Months)</label>
                    <input
                      type="number"
                      value={editMonths}
                      onChange={(e) => setEditMonths(parseInt(e.target.value) || 0)}
                      placeholder="e.g. 24"
                      className="w-full text-xs px-3 py-2 border rounded-lg bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Clock Starts From</label>
                    <select
                      value={editClockStart}
                      onChange={(e: any) => setEditClockStart(e.target.value)}
                      className="w-full text-xs px-3 py-2 border rounded-lg bg-white"
                    >
                      <option value="open_date">Account Open Date</option>
                      <option value="close_date">Account Close Date</option>
                      <option value="bonus_received_date">Bonus Received Date</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Scope</label>
                    <select
                      value={editScope}
                      onChange={(e: any) => setEditScope(e.target.value)}
                      className="w-full text-xs px-3 py-2 border rounded-lg bg-white"
                    >
                      <option value="account_type_specific">Account Type Specific</option>
                      <option value="entire_relationship">Entire Relationship</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Rule notes & fine print details</label>
                  <input
                    type="text"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="e.g. Limit 1 bonus per Wells Fargo relationship per 12 months."
                    className="w-full text-xs px-3 py-2 border rounded-lg bg-white"
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => { setIsAddingRule(false); setEditingRuleId(null); }}
                    type="button"
                    className="px-3.5 py-1.5 text-xs bg-white border text-slate-600 rounded-lg hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (isAddingRule) handleAddRule();
                      else if (editingRuleId) handleSaveEdit(editingRuleId);
                    }}
                    type="button"
                    className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 flex items-center gap-1"
                  >
                    <Save className="w-3.5 h-3.5" /> Save Rule
                  </button>
                </div>
              </div>
            )}

            {/* Table layout */}
            {rules.length === 0 ? (
              <div className="p-8 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200 my-2">
                <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700">No Bank Policy Rules Configured</p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                  Policy rules automatically appear when you add bank accounts under <strong>My Accounts</strong>, or you can click <strong>"+ Add Bank Policy"</strong> above to add custom rules.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left text-slate-600">
                  <thead className="bg-slate-50 text-[10px] text-slate-400 font-bold uppercase tracking-wider border-b">
                    <tr>
                      <th className="px-5 py-3">Bank Name</th>
                      <th className="px-5 py-3">Cooling Limit</th>
                      <th className="px-5 py-3">Clock Start Event</th>
                      <th className="px-5 py-3">Scope Boundary</th>
                      <th className="px-5 py-3">Rule Guidelines</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rules.map(rule => (
                      <tr key={rule.id} className="hover:bg-slate-50/50">
                        <td className="px-5 py-3.5 font-semibold text-slate-800">{rule.bankName}</td>
                        <td className="px-5 py-3.5 font-mono font-medium text-slate-800">{rule.coolingOffPeriodMonths} Months</td>
                        <td className="px-5 py-3.5">
                          <span className="bg-indigo-50 text-indigo-700 text-[10px] font-semibold px-2 py-0.5 rounded capitalize">
                            {rule.clockStartsFrom.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 capitalize">{rule.scope.replace(/_/g, ' ')}</td>
                        <td className="px-5 py-3.5 text-slate-500 italic max-w-xs truncate" title={rule.notes}>{rule.notes || 'No specified details'}</td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex justify-end gap-2.5">
                            <button
                              onClick={() => handleStartEdit(rule)}
                              className="text-indigo-600 hover:text-indigo-900 font-semibold cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteRule(rule.id)}
                              className="text-rose-600 hover:text-rose-800 font-medium cursor-pointer"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
