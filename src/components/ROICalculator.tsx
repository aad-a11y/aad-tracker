import React, { useState, useMemo } from 'react';
import { BankAccount } from '../types';
import { 
  Calculator, 
  DollarSign, 
  Calendar, 
  Percent, 
  ArrowUpRight, 
  TrendingUp, 
  HelpCircle, 
  Sparkles, 
  Info, 
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Coins,
  ChevronRight,
  Building2,
  CheckCircle2
} from 'lucide-react';
import { motion } from 'motion/react';

interface ROICalculatorProps {
  accounts?: BankAccount[];
  onSelectAccount?: (id: string) => void;
}

export default function ROICalculator({ accounts = [], onSelectAccount }: ROICalculatorProps) {
  const [selectedAccId, setSelectedAccId] = useState<string>('');
  const [bankName, setBankName] = useState<string>('');
  const [bonusAmount, setBonusAmount] = useState<number>(0);
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [holdPeriod, setHoldPeriod] = useState<number>(90);
  const [accountApy, setAccountApy] = useState<number>(0);
  const [alternativeApy, setAlternativeApy] = useState<number>(4.50);
  const [monthlyFee, setMonthlyFee] = useState<number>(0);
  const [taxRate, setTaxRate] = useState<number>(24);

  // Apply a user profile account configuration
  const applyUserAccount = (account: BankAccount) => {
    setSelectedAccId(account.id);
    setBankName(`${account.bankName} - ${account.accountName}`);
    setBonusAmount(account.bonusAmount);
    // Find required deposit/funding amount from requirements
    const depositReq = account.requirements?.find(r => r.type === 'minimum_balance' || r.type === 'account_funding');
    setDepositAmount(depositReq ? depositReq.targetValue : 0);
    // Find max hold period
    const maxDays = (account.requirements || []).reduce((max, r) => Math.max(max, r.daysToComplete || 90), 90);
    setHoldPeriod(maxDays);
    setAccountApy(0);
    setMonthlyFee(account.annualFee ? Math.round(account.annualFee / 12) : 0);
  };

  // Sync state when accounts prop changes or component mounts
  React.useEffect(() => {
    if (accounts.length > 0) {
      const active = accounts.find(a => a.id === selectedAccId) || accounts[0];
      applyUserAccount(active);
    } else {
      setBankName('');
      setBonusAmount(0);
      setDepositAmount(0);
      setHoldPeriod(90);
      setAccountApy(0);
      setMonthlyFee(0);
    }
  }, [accounts]);

  // Perform financial calculations
  const results = useMemo(() => {
    // Handle edge case of 0 deposit
    const activeDeposit = depositAmount > 0 ? depositAmount : 1; // avoid division by zero
    const years = holdPeriod / 365;

    // 1. Regular Interest Earned in Hold Period
    const baseInterest = depositAmount * (accountApy / 100) * years;

    // 2. Fees Incurred
    // Assuming 30 days per month
    const holdMonths = Math.max(1, Math.ceil(holdPeriod / 30));
    const totalFees = monthlyFee * holdMonths;

    // 3. Gross Earnings (Bonus + Interest)
    const grossEarnings = bonusAmount + baseInterest;

    // 4. Net Pre-Tax Profit
    const netPreTax = grossEarnings - totalFees;

    // 5. Taxes Paid (Bank bonuses & interest are treated as ordinary income)
    const taxes = netPreTax > 0 ? netPreTax * (taxRate / 100) : 0;

    // 6. Net After-Tax Profit
    const netAfterTax = netPreTax - taxes;

    // 7. Annualized APY equivalents
    // (Total Return / Deposit) * (365 / days)
    const annualizedBonusApy = (bonusAmount / activeDeposit) * (365 / holdPeriod) * 100;
    const annualizedNetPreTaxApy = (netPreTax / activeDeposit) * (365 / holdPeriod) * 100;
    const annualizedNetAfterTaxApy = (netAfterTax / activeDeposit) * (365 / holdPeriod) * 100;

    // 8. Alternative Opportunity Cost Earnings (e.g. keeping it in standard HYSA)
    const alternativeEarnings = depositAmount * (alternativeApy / 100) * years;
    const alternativeTaxes = alternativeEarnings * (taxRate / 100);
    const alternativeNet = alternativeEarnings - alternativeTaxes;

    // 9. Premium earned over Alternative
    const preTaxPremium = netPreTax - alternativeEarnings;
    const afterTaxPremium = netAfterTax - alternativeNet;

    // 10. Multiplier (How much better this is compared to the alternative)
    const multiplier = alternativeEarnings > 0 ? netPreTax / alternativeEarnings : 0;

    return {
      baseInterest,
      totalFees,
      grossEarnings,
      netPreTax,
      taxes,
      netAfterTax,
      annualizedBonusApy,
      annualizedNetPreTaxApy,
      annualizedNetAfterTaxApy,
      alternativeEarnings,
      alternativeTaxes,
      alternativeNet,
      preTaxPremium,
      afterTaxPremium,
      multiplier,
      holdMonths
    };
  }, [bonusAmount, depositAmount, holdPeriod, accountApy, alternativeApy, monthlyFee, taxRate]);

  // Determine comparison evaluation message
  const evaluation = useMemo(() => {
    const netApy = results.annualizedNetPreTaxApy;
    const altApy = alternativeApy;

    if (depositAmount === 0 || bonusAmount === 0) {
      return {
        title: "High Yield Return",
        color: "text-emerald-700 bg-emerald-50 border-emerald-100",
        desc: "Since you don't need a minimum deposit, this represents a near-infinite return on your capital. Highly recommended to fulfill!"
      };
    }

    if (netApy > altApy + 10) {
      return {
        title: "Spectacular Return!",
        color: "text-indigo-700 bg-indigo-50 border-indigo-100",
        desc: `At an annualized ${netApy.toFixed(2)}% APY, this bank bonus crushes your alternative HYSA by a massive ${(netApy - altApy).toFixed(1)}% absolute interest rate spread.`
      };
    } else if (netApy > altApy) {
      return {
        title: "Strong Performance",
        color: "text-emerald-700 bg-emerald-50 border-emerald-100",
        desc: `This bonus earns you $${results.preTaxPremium.toFixed(2)} more than standard HYSA storage, yielding a net rate of ${netApy.toFixed(2)}%. It is a smart pivot.`
      };
    } else if (netApy > 0) {
      return {
        title: "Suboptimal Play",
        color: "text-amber-700 bg-amber-50 border-amber-100",
        desc: `Keeping funds here yields ${netApy.toFixed(2)}% annualized, which is LESS than your ${altApy.toFixed(2)}% alternative HYSA. Consider skipping unless you need the relationship.`
      };
    } else {
      return {
        title: "Negative Return!",
        color: "text-red-700 bg-red-50 border-red-100",
        desc: "Account fees and holding limits are dragging your returns into negative territory. Avoid this promotion or find a fee waiver."
      };
    }
  }, [results, alternativeApy, depositAmount, bonusAmount]);

  return (
    <div className="space-y-8" id="roi-calculator-container">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl p-6 md:p-8 border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
              Yield Analyzer
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs text-slate-500 flex items-center gap-1 font-mono">
              <Calculator className="w-3.5 h-3.5" /> ROI Calculator
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
            Bank Bonus Return & ROI Calculator
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Compare bank signup incentives side-by-side with your standard high-yield savings yield. Calculate your annualized APY equivalents, tax effects, and net opportunity costs instantly.
          </p>
        </div>
        <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100 self-start md:self-auto shrink-0">
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-black shadow-md shadow-indigo-100">
            <Percent className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Current Alternative HYSA</span>
            <span className="text-base font-bold text-slate-800 font-mono">{alternativeApy.toFixed(2)}% APY</span>
          </div>
        </div>
      </div>

      {/* My Profile Accounts Quick Selector */}
      {accounts.length > 0 ? (
        <div className="bg-indigo-50/80 border border-indigo-200 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-indigo-900 font-bold uppercase tracking-wider">
              <Building2 className="w-4.5 h-4.5 text-indigo-600 shrink-0" />
              <span>Select From My Profile Accounts ({accounts.length})</span>
            </div>
            <span className="text-xs font-bold text-indigo-800 font-mono">
              Total Bonus Portfolio Value: ${accounts.reduce((sum, a) => sum + a.bonusAmount, 0)}
            </span>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {accounts.map((acc) => {
              const isSelected = selectedAccId === acc.id || bankName.includes(acc.bankName);
              return (
                <button
                  key={acc.id}
                  onClick={() => applyUserAccount(acc)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200'
                      : 'bg-white hover:bg-indigo-100/80 text-slate-800 border-indigo-200'
                  }`}
                >
                  <Building2 className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-indigo-600'}`} />
                  <span>{acc.bankName} - {acc.accountName} (${acc.bonusAmount})</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-slate-700 font-bold text-xs uppercase tracking-wider">
            <Building2 className="w-4 h-4 text-indigo-600" />
            <span>No Extracted Accounts Found</span>
          </div>
          <p className="text-slate-500 text-xs max-w-xl mx-auto">
            Extract an offer from a bank Web Link or add an account on the home page to automatically populate return parameters, APY boosts, and ROI calculations for your accounts.
          </p>
        </div>
      )}

      {/* Main Grid: Inputs on Left, Results on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Calculator Inputs */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-5">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Calculator className="w-4.5 h-4.5 text-indigo-600" />
              Scenario Parameters
            </h3>

            {/* Scenario Name */}
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1.5 uppercase">
                Scenario Name
              </label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="e.g. Chase Total Checking"
                className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:bg-white text-slate-800 text-sm font-semibold rounded-xl px-4 py-2.5 outline-none transition"
              />
            </div>

            {/* Bonus Amount */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase">
                  Cash Bonus Amount
                </label>
                <span className="text-[10px] font-mono text-indigo-600 font-bold">Taxable Interest</span>
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
                <input
                  type="number"
                  value={bonusAmount || ''}
                  onChange={(e) => setBonusAmount(Number(e.target.value))}
                  placeholder="0"
                  className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:bg-white text-slate-800 text-sm font-bold rounded-xl pl-8 pr-4 py-2.5 outline-none transition font-mono"
                />
              </div>
              <div className="flex gap-1.5 mt-2">
                {[150, 300, 500, 1000].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setBonusAmount(val)}
                    className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-600 text-[10px] font-bold py-1 px-1.5 rounded-lg border border-slate-200/50 transition cursor-pointer"
                  >
                    ${val}
                  </button>
                ))}
              </div>
            </div>

            {/* Required Deposit */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase">
                  Required Deposit / Hold
                </label>
                <span className="text-[10px] font-mono text-slate-400">Locked Capital</span>
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
                <input
                  type="number"
                  value={depositAmount || ''}
                  onChange={(e) => setDepositAmount(Number(e.target.value))}
                  placeholder="0"
                  className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:bg-white text-slate-800 text-sm font-bold rounded-xl pl-8 pr-4 py-2.5 outline-none transition font-mono"
                />
              </div>
              <div className="flex gap-1.5 mt-2">
                {[0, 10000, 25000, 50000, 100000].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setDepositAmount(val)}
                    className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-600 text-[10px] font-bold py-1 px-1.5 rounded-lg border border-slate-200/50 transition cursor-pointer"
                  >
                    {val === 0 ? '$0' : `$${val / 1000}k`}
                  </button>
                ))}
              </div>
            </div>

            {/* Hold Period */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase">
                  Hold Period (Days)
                </label>
                <span className="text-[11px] font-mono text-indigo-600 font-bold">
                  {holdPeriod} Days (~{results.holdMonths} Months)
                </span>
              </div>
              <div className="flex gap-3 items-center">
                <input
                  type="range"
                  min="30"
                  max="365"
                  step="5"
                  value={holdPeriod}
                  onChange={(e) => setHoldPeriod(Number(e.target.value))}
                  className="flex-1 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <input
                  type="number"
                  value={holdPeriod || ''}
                  onChange={(e) => setHoldPeriod(Number(e.target.value))}
                  className="w-20 text-center bg-slate-50 border border-slate-200 text-slate-800 text-sm font-semibold rounded-xl py-1.5 font-mono outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex gap-1.5 mt-2.5">
                {[30, 60, 90, 105, 120].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setHoldPeriod(val)}
                    className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-600 text-[10px] font-bold py-1 px-1.5 rounded-lg border border-slate-200/50 transition cursor-pointer"
                  >
                    {val}d
                  </button>
                ))}
              </div>
            </div>

            {/* Account Base APY */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase">
                  Account Base APY (%)
                </label>
                <span className="text-[10px] font-mono text-slate-400">Regular account interest</span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  step="0.05"
                  value={accountApy || ''}
                  onChange={(e) => setAccountApy(Number(e.target.value))}
                  placeholder="0.00"
                  className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:bg-white text-slate-800 text-sm font-bold rounded-xl px-4 py-2.5 outline-none transition font-mono"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">%</span>
              </div>
            </div>

            {/* Monthly Fee */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase">
                  Monthly Account Fee ($)
                </label>
                <span className="text-[10px] font-mono text-slate-400">If waiver not met</span>
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
                <input
                  type="number"
                  value={monthlyFee || ''}
                  onChange={(e) => setMonthlyFee(Number(e.target.value))}
                  placeholder="0"
                  className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:bg-white text-slate-800 text-sm font-bold rounded-xl pl-8 pr-4 py-2.5 outline-none transition font-mono"
                />
              </div>
            </div>

            {/* Opportunity Cost & Taxes Collapse Panel */}
            <div className="pt-2 border-t border-slate-100 space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                    Alternative APY (%)
                    <HelpCircle className="w-3.5 h-3.5 text-slate-300" title="What APY could you get if you just left the deposit in your high-yield savings account (HYSA)?" />
                  </label>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.05"
                    value={alternativeApy || ''}
                    onChange={(e) => setAlternativeApy(Number(e.target.value))}
                    placeholder="4.50"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-600 text-xs font-semibold rounded-xl px-4 py-2 outline-none transition font-mono focus:border-indigo-500"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">%</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                    Marginal Tax Rate (%)
                    <HelpCircle className="w-3.5 h-3.5 text-slate-300" title="Your federal + state marginal income tax rate. Both bonuses and bank interest are taxed as ordinary income." />
                  </label>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    value={taxRate || ''}
                    onChange={(e) => setTaxRate(Number(e.target.value))}
                    placeholder="24"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-600 text-xs font-semibold rounded-xl px-4 py-2 outline-none transition font-mono focus:border-indigo-500"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">%</span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Right Column: Dashboard Results */}
        <div className="lg:col-span-7 space-y-6">
          {/* Key Metric Hero Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Metric 1: Annualized ROI */}
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-full translate-x-12 -translate-y-12"></div>
              <div className="relative">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                  Annualized Yield (Pre-Tax)
                </span>
                <span className="text-3xl font-black text-indigo-600 tracking-tight block font-mono">
                  {depositAmount > 0 ? `${results.annualizedNetPreTaxApy.toFixed(2)}%` : 'Near-∞'}
                </span>
                <span className="text-[11px] text-slate-500 mt-2 block font-medium">
                  Equivalent to earning {results.annualizedNetPreTaxApy.toFixed(1)}% APY on the deposit.
                </span>
              </div>
            </div>

            {/* Metric 2: Net Profit After Fees */}
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50/40 rounded-full translate-x-12 -translate-y-12"></div>
              <div className="relative">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                  Net Profit (Pre-Tax)
                </span>
                <span className="text-3xl font-black text-emerald-600 tracking-tight block font-mono">
                  ${results.netPreTax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[11px] text-slate-500 mt-2 block font-medium">
                  Total cash reward minus account fees.
                </span>
              </div>
            </div>
          </div>

          {/* Smart Advisor Nudge */}
          <div className={`rounded-2xl p-5 border ${evaluation.color} flex gap-4 items-start shadow-sm transition-all duration-300`}>
            {results.annualizedNetPreTaxApy >= alternativeApy ? (
              <ShieldCheck className="w-5.5 h-5.5 shrink-0 text-indigo-600 mt-0.5" />
            ) : (
              <AlertCircle className="w-5.5 h-5.5 shrink-0 text-amber-500 mt-0.5" />
            )}
            <div>
              <h4 className="font-bold text-sm mb-1">{evaluation.title}</h4>
              <p className="text-xs leading-relaxed opacity-90">{evaluation.desc}</p>
            </div>
          </div>

          {/* Visual Return Comparison Chart (Interactive SVG Bars) */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Financial Return Comparison ({holdPeriod} Days)</span>
              <span className="font-mono text-[10px] text-slate-500">Capital: ${depositAmount.toLocaleString()}</span>
            </h4>

            <div className="space-y-4 pt-2">
              {/* Bank Bonus Strategy */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-indigo-600 rounded-full"></span>
                    Bank Bonus Promotion
                  </span>
                  <span className="font-bold text-slate-900 font-mono">
                    ${results.netPreTax.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                    <span className="text-[10px] text-slate-400 font-normal ml-1">
                      ({results.annualizedNetPreTaxApy.toFixed(1)}% APY)
                    </span>
                  </span>
                </div>
                {/* SVG/HTML Progress Bar */}
                <div className="w-full h-7 bg-slate-50 rounded-lg overflow-hidden border border-slate-100 flex">
                  <div 
                    className="h-full bg-indigo-600 flex items-center justify-end px-3 transition-all duration-500"
                    style={{ width: `${Math.max(12, Math.min(100, (results.netPreTax / (Math.max(results.netPreTax, results.alternativeEarnings, 1) * 1.15)) * 100))}%` }}
                  >
                    <span className="text-[10px] font-bold text-white font-mono">
                      {((results.netPreTax / (depositAmount || 1)) * 100).toFixed(2)}% return
                    </span>
                  </div>
                </div>
              </div>

              {/* Alternative HYSA Storage */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-500 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-slate-300 rounded-full"></span>
                    Standard HYSA Storage
                  </span>
                  <span className="font-bold text-slate-700 font-mono">
                    ${results.alternativeEarnings.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                    <span className="text-[10px] text-slate-400 font-normal ml-1">
                      ({alternativeApy.toFixed(1)}% APY)
                    </span>
                  </span>
                </div>
                {/* SVG/HTML Progress Bar */}
                <div className="w-full h-7 bg-slate-50 rounded-lg overflow-hidden border border-slate-100 flex">
                  <div 
                    className="h-full bg-slate-300 flex items-center justify-end px-3 transition-all duration-500"
                    style={{ width: `${Math.max(12, Math.min(100, (results.alternativeEarnings / (Math.max(results.netPreTax, results.alternativeEarnings, 1) * 1.15)) * 100))}%` }}
                  >
                    <span className="text-[10px] font-semibold text-slate-600 font-mono">
                      {((results.alternativeEarnings / (depositAmount || 1)) * 100).toFixed(2)}% return
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Premium Callout */}
            {results.preTaxPremium > 0 && (
              <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 flex items-center justify-between text-xs mt-2">
                <span className="text-slate-500 font-medium">Net Return Premium (Pre-Tax)</span>
                <span className="font-bold text-indigo-700 font-mono flex items-center gap-1">
                  <ArrowUpRight className="w-4 h-4 text-indigo-600" />
                  +${results.preTaxPremium.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} extra profit
                </span>
              </div>
            )}
          </div>

          {/* Detailed Cash-Flow Ledger (Table Breakdown) */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
              <Coins className="w-4 h-4 text-slate-400" />
              Detailed Returns Breakdown Ledger
            </h4>

            <div className="space-y-2 text-xs">
              {/* Row: Cash Bonus */}
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-500">Sign-Up Cash Bonus</span>
                <span className="font-mono font-bold text-slate-900">+${bonusAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>

              {/* Row: Base Interest */}
              {results.baseInterest > 0 && (
                <div className="flex justify-between py-1.5 border-b border-slate-50">
                  <span className="text-slate-500">Account APY Interest ({accountApy.toFixed(2)}%)</span>
                  <span className="font-mono font-semibold text-slate-700">+${results.baseInterest.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
              )}

              {/* Row: Monthly Fees */}
              {results.totalFees > 0 && (
                <div className="flex justify-between py-1.5 border-b border-slate-50 text-red-600 font-medium">
                  <span>Account Monthly Service Fees</span>
                  <span className="font-mono font-bold">-${results.totalFees.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
              )}

              {/* Row: Pre-Tax Profit */}
              <div className="flex justify-between py-2 border-b border-slate-100 font-bold bg-slate-50 px-2.5 rounded-lg -mx-1 text-slate-800">
                <span>Total Pre-Tax Net Profit</span>
                <span className="font-mono text-emerald-600">${results.netPreTax.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>

              {/* Row: Est Tax Drag */}
              {results.taxes > 0 && (
                <div className="flex justify-between py-1.5 border-b border-slate-50 text-slate-500">
                  <span>Est. Income Tax Drag ({taxRate}%)</span>
                  <span className="font-mono font-medium text-slate-600">-${results.taxes.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
              )}

              {/* Row: After-Tax Net Return */}
              <div className="flex justify-between py-2 border-b border-slate-100 font-bold">
                <span className="text-slate-800">After-Tax Net Return</span>
                <span className="font-mono text-slate-900">${results.netAfterTax.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>

              {/* Row: Alternative net return */}
              <div className="flex justify-between py-1.5 border-b border-slate-50 text-slate-400">
                <span>Alternative Net Return (After-Tax)</span>
                <span className="font-mono">${results.alternativeNet.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>

              {/* Row: Absolute After-Tax Premium */}
              <div className="flex justify-between py-2 font-bold text-indigo-700 bg-indigo-50/40 px-2.5 rounded-lg -mx-1">
                <span>Net After-Tax Bonus Premium</span>
                <span className="font-mono">
                  ${results.afterTaxPremium > 0 ? '+' : ''}
                  {results.afterTaxPremium.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Educational Quick Guide */}
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 text-xs text-slate-500 space-y-2.5">
            <h5 className="font-bold text-slate-700 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-indigo-600 shrink-0" />
              ROI Formula & Method Guide
            </h5>
            <p className="leading-relaxed">
              <strong>Annualized APY Equivalent:</strong> This measures what standard annual savings rate is required to duplicate the cash bonus. Because a bonus is paid for a short holding window, it behaves like an incredibly high interest rate. For instance, a <strong>$1,000</strong> bonus on a <strong>$100,000</strong> deposit held for <strong>105 days</strong> equals an annualized bonus APY of <strong>3.48%</strong>. Combined with E*TRADE's base APY of <strong>4.25%</strong>, your combined pre-tax ROI rate equals <strong>7.73% APY</strong>!
            </p>
            <p className="leading-relaxed">
              <strong>Taxation Rule:</strong> Bank account bonuses are taxed as <strong>ordinary interest income</strong> (IRS Form 1099-INT), not as lower capital gains rates. This calculator deducts your specified tax rate to show the true purchasing power gained.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
