import React, { useState, useEffect } from 'react';
import { BankAccount, AccountType, BonusStatus, Requirement, RULE_TEMPLATES, RuleTemplate } from '../types';
import { X, Plus, Trash2, Calendar, ShieldCheck, RefreshCw, Sparkles, HelpCircle } from 'lucide-react';

interface AccountModalProps {
  onClose: () => void;
  onSave: (account: BankAccount) => void;
  accountToEdit?: BankAccount;
  initialPreFill?: { url?: string; bankName?: string; bonusAmount?: number };
}

export default function AccountModal({ onClose, onSave, accountToEdit, initialPreFill }: AccountModalProps) {
  // Account Form States
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('checking');
  const [openingDate, setOpeningDate] = useState(() => {
    return new Date('2026-07-04').toISOString().split('T')[0]; // Pre-fill with system date
  });
  const [bonusAmount, setBonusAmount] = useState<number>(0);
  const [offerLink, setOfferLink] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [expectedPayoutDate, setExpectedPayoutDate] = useState('');
  const [notes, setNotes] = useState('');

  // New Personal Tracker States
  const [annualFee, setAnnualFee] = useState<number>(0);
  const [annualFeeDecisionDate, setAnnualFeeDecisionDate] = useState('');
  const [clawbackMonths, setClawbackMonths] = useState<number>(0);
  const [clawbackDate, setClawbackDate] = useState('');
  const [bonusPostingDeadlineDate, setBonusPostingDeadlineDate] = useState('');
  const [excludeFromClosure, setExcludeFromClosure] = useState<boolean>(false);

  // Rules Form States (for creating multiple qualifying requirements)
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('dd');

  // Rule Creator Temp States
  const [tempType, setTempType] = useState<any>('direct_deposit');
  const [tempDesc, setTempDesc] = useState('');
  const [tempTarget, setTempTarget] = useState<number>(0);
  const [tempDays, setTempDays] = useState<number>(90);

  // AI Extraction States
  const [urlToImport, setUrlToImport] = useState('');
  const [textToImport, setTextToImport] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState('');
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuccess, setAiSuccess] = useState<{ bank: string; product: string; rulesCount: number; fetchedSuccess: boolean } | null>(null);
  const [showRawTextInput, setShowRawTextInput] = useState(false);

  // AI Extraction Handler
  const handleAIExtract = async () => {
    if (!urlToImport && !textToImport) {
      setAiError('Please enter an Offer URL or paste the fine prints to extract rules.');
      return;
    }

    setAiLoading(true);
    setAiError(null);
    setAiSuccess(null);
    setAiStatus('Fetching webpage terms...');

    try {
      const response = await fetch('/api/extract-rules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: urlToImport,
          rawText: textToImport
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        setShowRawTextInput(true);
        if (response.status === 404) {
          throw new Error(errData.error || 'Chase / Bank anti-bot security blocks automated link reading (404/403). Please paste the promotional terms or fine print text below!');
        }
        throw new Error(errData.error || `Failed to read link content (Status: ${response.status}). Please paste the promotional terms below.`);
      }

      setAiStatus('Auditing fine prints & extracting requirements...');
      const result = await response.json();

      if (result.success && result.data) {
        const extracted = result.data;
        
        // Auto-fill form states
        if (extracted.bankName) setBankName(extracted.bankName);
        if (extracted.accountName) setAccountName(extracted.accountName);
        if (extracted.accountType) setAccountType(extracted.accountType as AccountType);
        if (extracted.bonusAmount) setBonusAmount(extracted.bonusAmount);
        if (extracted.promoCode) setPromoCode(extracted.promoCode);
        if (extracted.notes) setNotes(extracted.notes);
        if (urlToImport) setOfferLink(urlToImport);
        
        // Add requirements
        if (Array.isArray(extracted.requirements) && extracted.requirements.length > 0) {
          const mappedRequirements: Requirement[] = extracted.requirements.map((req: any) => {
            const deadline = calculateDeadlineDate(openingDate, req.daysToComplete || 90);
            return {
              id: Math.random().toString(),
              type: req.type || 'other',
              description: req.description,
              targetValue: req.targetValue || 0,
              currentValue: 0,
              daysToComplete: req.daysToComplete || 90,
              deadlineDate: deadline,
              status: 'pending',
              notes: req.notes || undefined
            };
          });
          setRequirements(mappedRequirements);
        }

        setAiSuccess({
          bank: extracted.bankName,
          product: extracted.accountName,
          rulesCount: extracted.requirements?.length || 0,
          fetchedSuccess: result.fetchedUrlSuccess
        });

        // Clear import inputs on success
        setUrlToImport('');
        setTextToImport('');
      } else {
        throw new Error(result.error || 'Failed to extract terms from offer.');
      }
    } catch (err: any) {
      console.error('AI extraction error:', err);
      setAiError(err.message || 'An error occurred while connecting to the AI agent.');
    } finally {
      setAiLoading(false);
      setAiStatus('');
    }
  };

  // Initialize with account details if editing or initialPreFill
  useEffect(() => {
    if (accountToEdit) {
      setBankName(accountToEdit.bankName);
      setAccountName(accountToEdit.accountName);
      setAccountType(accountToEdit.accountType);
      setOpeningDate(accountToEdit.openingDate);
      setBonusAmount(accountToEdit.bonusAmount);
      setOfferLink(accountToEdit.offerLink || '');
      setPromoCode(accountToEdit.promoCode || '');
      setExpectedPayoutDate(accountToEdit.expectedPayoutDate || '');
      setNotes(accountToEdit.notes || '');
      setRequirements(accountToEdit.requirements);
      setAnnualFee(accountToEdit.annualFee || 0);
      setAnnualFeeDecisionDate(accountToEdit.annualFeeDecisionDate || '');
      setClawbackMonths(accountToEdit.clawbackMonths || 0);
      setClawbackDate(accountToEdit.clawbackDate || '');
      setBonusPostingDeadlineDate(accountToEdit.bonusPostingDeadlineDate || '');
      setExcludeFromClosure(!!accountToEdit.excludeFromClosure);
    } else {
      // Pre-fill initial requirement template details on load
      applyTemplate('dd', openingDate);
      
      if (initialPreFill) {
        if (initialPreFill.bankName) setBankName(initialPreFill.bankName);
        if (initialPreFill.bonusAmount) setBonusAmount(initialPreFill.bonusAmount);
        if (initialPreFill.url) {
          setOfferLink(initialPreFill.url);
          setUrlToImport(initialPreFill.url);
        }
      }
    }
  }, [accountToEdit, initialPreFill]);

  // Apply requirement template details
  const applyTemplate = (templateId: string, baseDate: string) => {
    const template = RULE_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;

    setTempType(template.type);
    setTempDesc(template.defaultDescription);
    setTempTarget(template.defaultTargetValue);
    setTempDays(template.defaultDaysToComplete);
  };

  // When opening date changes, recalculate deadlines of existing requirements
  const handleOpeningDateChange = (newDate: string) => {
    setOpeningDate(newDate);

    // Recalculate deadlines of all requirements being drafted
    const updated = requirements.map(req => {
      const deadline = calculateDeadlineDate(newDate, req.daysToComplete);
      return {
        ...req,
        deadlineDate: deadline
      };
    });
    setRequirements(updated);

    // Recalculate clawback date if clawbackMonths is specified
    if (clawbackMonths > 0) {
      setClawbackDate(calculateClawbackDate(newDate, clawbackMonths));
    }
  };

  const calculateClawbackDate = (start: string, months: number): string => {
    if (!start || months <= 0) return '';
    const date = new Date(start);
    date.setMonth(date.getMonth() + months);
    return date.toISOString().split('T')[0];
  };

  const handleClawbackMonthsChange = (monthsVal: number) => {
    setClawbackMonths(monthsVal);
    setClawbackDate(calculateClawbackDate(openingDate, monthsVal));
  };

  const calculateDeadlineDate = (start: string, days: number): string => {
    if (!start) return '';
    const date = new Date(start);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  };

  const handleTemplateSelectChange = (id: string) => {
    setSelectedTemplateId(id);
    applyTemplate(id, openingDate);
  };

  const handleAddRequirementDraft = () => {
    const deadline = calculateDeadlineDate(openingDate, tempDays);
    
    const newReq: Requirement = {
      id: Math.random().toString(),
      type: tempType,
      description: tempDesc,
      targetValue: tempTarget,
      currentValue: 0,
      daysToComplete: tempDays,
      deadlineDate: deadline,
      status: 'pending'
    };

    setRequirements([...requirements, newReq]);
    
    // Clear / Reset
    setSelectedTemplateId('dd');
    applyTemplate('dd', openingDate);
  };

  const handleRemoveRequirementDraft = (id: string) => {
    setRequirements(requirements.filter(r => r.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!bankName || !accountName || bonusAmount <= 0) {
      alert('Please fill out the Bank Name, Account Name, and Bonus Amount.');
      return;
    }

    const calculatedExpectedPayout = expectedPayoutDate || calculateDeadlineDate(openingDate, 120); // 120 days default expected payout

    const accountData: BankAccount = {
      id: accountToEdit ? accountToEdit.id : Math.random().toString(),
      bankName,
      accountName,
      accountType,
      openingDate,
      bonusAmount,
      offerLink: offerLink || undefined,
      promoCode: promoCode || undefined,
      expectedPayoutDate: calculatedExpectedPayout,
      notes: notes || undefined,
      requirements,
      progressLogs: accountToEdit ? accountToEdit.progressLogs : [],
      status: accountToEdit ? accountToEdit.status : 'in_progress',
      payoutReceivedDate: accountToEdit ? accountToEdit.payoutReceivedDate : undefined,
      missedReason: accountToEdit ? accountToEdit.missedReason : undefined,
      annualFee: annualFee || 0,
      annualFeeDecisionDate: annualFeeDecisionDate || undefined,
      clawbackMonths: clawbackMonths || 0,
      clawbackDate: clawbackDate || undefined,
      bonusPostingDeadlineDate: bonusPostingDeadlineDate || undefined,
      excludeFromClosure: excludeFromClosure
    };

    onSave(accountData);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100 flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-xl font-bold text-slate-900">
              {accountToEdit ? 'Edit Bank Offer Tracker' : 'Add New Bank Sign-up Offer'}
            </h3>
            <p className="text-slate-500 text-xs mt-1">
              Define the offer terms, opening date, and critical qualifying activities to automate compliance.
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg transition hover:bg-slate-50">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-8 flex-1">
          {/* Section 1: Basic Bank Offer Details */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider">01. Account & Offer Information</h4>
            
            {/* AI Auto-Fill Section */}
            <div className="bg-indigo-50/40 border border-indigo-100 rounded-2xl p-4 md:p-5 relative overflow-hidden space-y-3.5 shadow-xs">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none"></div>
              
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm">
                  <Sparkles className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h5 className="font-bold text-indigo-950 text-sm flex items-center gap-1.5">
                    AI Sign-up Offer Reader
                  </h5>
                  <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">
                    Automatically parse full promo rules, deadlines, targets, and monthly fee disclosures from any bank webpage link or copy-pasted fine print.
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-1">
                {/* Offer URL Input */}
                <div>
                  <label className="block text-[10px] font-bold uppercase text-indigo-850 mb-1">
                    Offer Page Link
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="e.g. https://www.chase.com/personal/checking/offer..."
                      value={urlToImport}
                      onChange={(e) => setUrlToImport(e.target.value)}
                      className="flex-1 px-3 py-2 border border-indigo-150 rounded-lg text-xs bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      disabled={aiLoading}
                      onClick={handleAIExtract}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold text-xs px-4 py-2 rounded-lg transition-all shrink-0 flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      {aiLoading ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Parsing...</span>
                        </>
                      ) : (
                        <span>Extract with AI</span>
                      )}
                    </button>
                  </div>
                </div>

                {/* Fine Print pasting option toggle */}
                <div className="pt-0.5">
                  <button
                    type="button"
                    onClick={() => setShowRawTextInput(!showRawTextInput)}
                    className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition flex items-center gap-1"
                  >
                    {showRawTextInput ? "Hide Fine Print box" : "Or copy-paste disclosures/fine print directly (fallback)"}
                  </button>

                  {showRawTextInput && (
                    <div className="mt-2 space-y-2">
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                        Pasted Promotion Terms / Fine Prints
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Copy and paste the full fine print, disclosure blocks, or entire text from the offer page here..."
                        value={textToImport}
                        onChange={(e) => setTextToImport(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-sans"
                      />
                      {!urlToImport && (
                        <div className="flex justify-end">
                          <button
                            type="button"
                            disabled={aiLoading}
                            onClick={handleAIExtract}
                            className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-semibold text-xs px-4 py-2 rounded-lg transition flex items-center gap-1"
                          >
                            {aiLoading ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <span>Extract from Pasted Text</span>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Loading status details */}
                {aiLoading && aiStatus && (
                  <div className="bg-white/80 border border-indigo-100 rounded-lg p-2.5 text-xs text-indigo-700 flex items-center gap-2 font-medium">
                    <RefreshCw className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
                    <span>{aiStatus}</span>
                  </div>
                )}

                {/* Success Feedback banner */}
                {aiSuccess && (
                  <div className="bg-emerald-50 border border-emerald-150 rounded-lg p-3 text-xs text-emerald-800 space-y-1">
                    <p className="font-bold flex items-center gap-1">
                      ✅ AI Sign-up Offer Successfully Loaded!
                    </p>
                    <p className="leading-relaxed">
                      We've identified <strong>{aiSuccess.bank} {aiSuccess.product}</strong> and successfully populated the offer details. We also added <strong>{aiSuccess.rulesCount} tracked qualifying rules</strong> to Section 2 of this form!
                    </p>
                    {!aiSuccess.fetchedSuccess && urlToImport && (
                      <p className="text-[10px] text-amber-700 font-semibold mt-1">
                        ⚠️ Note: Web link was blocked by bank crawlers, so the terms were parsed successfully using your pasted fine prints fallback.
                      </p>
                    )}
                  </div>
                )}

                {/* Error Feedback banner */}
                {aiError && (
                  <div className="bg-rose-50 border border-rose-150 rounded-lg p-3 text-xs text-rose-800 space-y-1.5">
                    <p className="font-bold flex items-center gap-1">
                      ❌ AI Parsing Failed
                    </p>
                    <p className="leading-relaxed">{aiError}</p>
                    <p className="text-[10px] text-rose-700">
                      Recommendation: Bank websites often employ strong anti-bot and Cloudflare security filters. Try copying and pasting the fine print details directly into the "fallback copy-paste" box above!
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Bank Institution Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Chase Bank, Capital One, Citi"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 text-sm rounded-lg focus:outline-indigo-500 bg-white text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Account Product Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Total Checking, 360 Performance Savings"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 text-sm rounded-lg focus:outline-indigo-500 bg-white text-slate-800"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Account Product Type</label>
                <select
                  value={accountType}
                  onChange={(e) => setAccountType(e.target.value as AccountType)}
                  className="w-full px-3 py-2 border border-slate-200 text-sm rounded-lg focus:outline-indigo-500 bg-white text-slate-800"
                >
                  <option value="checking">Checking Account</option>
                  <option value="savings">Savings Account</option>
                  <option value="business_checking">Business Checking</option>
                  <option value="business_savings">Business Savings</option>
                  <option value="credit_card">Credit Card</option>
                  <option value="other">Other Account</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Account Opening Date *</label>
                <input
                  type="date"
                  required
                  value={openingDate}
                  onChange={(e) => handleOpeningDateChange(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 text-sm rounded-lg focus:outline-indigo-500 bg-white text-slate-800 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Target Sign-up Bonus ($) *</label>
                <input
                  type="number"
                  required
                  min={1}
                  placeholder="e.g. 300"
                  value={bonusAmount || ''}
                  onChange={(e) => setBonusAmount(parseFloat(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 text-sm rounded-lg focus:outline-indigo-500 bg-white text-slate-800 font-mono font-bold text-indigo-600"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Promotion Code (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. BONUS300"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 text-sm rounded-lg focus:outline-indigo-500 bg-white text-slate-800 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Offer URL Link (Optional)</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={offerLink}
                  onChange={(e) => setOfferLink(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 text-sm rounded-lg focus:outline-indigo-500 bg-white text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Expected Payout Date</label>
                <input
                  type="date"
                  value={expectedPayoutDate}
                  onChange={(e) => setExpectedPayoutDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 text-sm rounded-lg focus:outline-indigo-500 bg-white text-slate-800 font-mono"
                />
              </div>
            </div>

            {/* New Tracker Enhancements Row */}
            <div className="grid md:grid-cols-3 gap-4 bg-slate-50/60 p-4 rounded-xl border border-slate-100">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Annual Fee ($)</label>
                <input
                  type="number"
                  min={0}
                  placeholder="e.g. 95"
                  value={annualFee || ''}
                  onChange={(e) => setAnnualFee(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-200 text-sm rounded-lg focus:outline-indigo-500 bg-white text-slate-800 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Fee Decision Date</label>
                <input
                  type="date"
                  value={annualFeeDecisionDate}
                  onChange={(e) => setAnnualFeeDecisionDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 text-sm rounded-lg focus:outline-indigo-500 bg-white text-slate-800 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Bonus Posting Deadline</label>
                <input
                  type="date"
                  value={bonusPostingDeadlineDate}
                  onChange={(e) => setBonusPostingDeadlineDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 text-sm rounded-lg focus:outline-indigo-500 bg-white text-slate-800 font-mono"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4 bg-slate-50/60 p-4 rounded-xl border border-slate-100">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Clawback Period (Months)</label>
                <input
                  type="number"
                  min={0}
                  placeholder="e.g. 6"
                  value={clawbackMonths || ''}
                  onChange={(e) => handleClawbackMonthsChange(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-200 text-sm rounded-lg focus:outline-indigo-500 bg-white text-slate-800 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Calculated Clawback Date</label>
                <input
                  type="date"
                  value={clawbackDate}
                  onChange={(e) => setClawbackDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 text-sm rounded-lg focus:outline-indigo-500 bg-white text-slate-800 font-mono"
                />
              </div>

              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={excludeFromClosure}
                    onChange={(e) => setExcludeFromClosure(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-slate-700 block">Anchor Account</span>
                    <span className="text-[10px] text-slate-400 font-normal">Exclude from closure list</span>
                  </div>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Special Instructions</label>
              <textarea
                rows={2}
                placeholder="Write any monthly fee waiver conditions, early termination rules, or special terms here..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 text-sm rounded-lg focus:outline-indigo-500 bg-white text-slate-800"
              />
            </div>
          </div>

          {/* Section 2: Requirements & Rules Creator Wizard */}
          <div className="space-y-4 border-t border-slate-100 pt-6">
            <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-500" />
              <span>02. Define Qualifying Activities (Rules)</span>
            </h4>
            <p className="text-slate-500 text-xs leading-relaxed">
              Define the milestones required to earn the bonus. We will automatically calculate the deadline calendar dates based on your <strong>Account Opening Date ({openingDate})</strong>.
            </p>

            {/* Template Selector Wizard card */}
            <div className="bg-slate-50 rounded-xl p-4 md:p-5 border border-slate-150 space-y-4">
              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between border-b border-slate-200 pb-4">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs">
                    +
                  </span>
                  <div>
                    <span className="font-semibold text-slate-800 text-xs block">Qualifying Rule Wizard</span>
                    <span className="text-[10px] text-slate-400">Pick a template to build a deadline-tracked rule.</span>
                  </div>
                </div>

                <select
                  value={selectedTemplateId}
                  onChange={(e) => handleTemplateSelectChange(e.target.value)}
                  className="px-3 py-1.5 border rounded-lg text-xs font-semibold focus:outline-indigo-500 bg-white text-slate-800"
                >
                  {RULE_TEMPLATES.map(t => (
                    <option key={t.id} value={t.id}>{t.name} Template</option>
                  ))}
                </select>
              </div>

              {/* Temp Rule Editor Form fields */}
              <div className="grid md:grid-cols-3 gap-4 pt-1">
                <div className="md:col-span-2">
                  <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Rule Description</label>
                  <input
                    type="text"
                    value={tempDesc}
                    onChange={(e) => setTempDesc(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 text-xs rounded focus:outline-indigo-500 bg-white text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">
                    {RULE_TEMPLATES.find(t => t.id === selectedTemplateId)?.unitLabel || 'Target Value'}
                  </label>
                  <input
                    type="number"
                    value={tempTarget || ''}
                    onChange={(e) => setTempTarget(parseFloat(e.target.value))}
                    className="w-full px-2.5 py-1.5 border border-slate-200 text-xs rounded focus:outline-indigo-500 bg-white text-slate-800 font-mono"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4 items-center">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Days to Complete</label>
                    <input
                      type="number"
                      value={tempDays || ''}
                      onChange={(e) => setTempDays(parseInt(e.target.value))}
                      className="w-full px-2.5 py-1.5 border border-slate-200 text-xs rounded focus:outline-indigo-500 bg-white text-slate-800 font-mono"
                    />
                  </div>
                  <div className="flex-1">
                    <span className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Calculated Deadline</span>
                    <span className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 px-2 py-1.5 rounded block text-center font-mono">
                      {calculateDeadlineDate(openingDate, tempDays) || 'Pending'}
                    </span>
                  </div>
                </div>

                <div className="flex justify-end pt-3 md:pt-0">
                  <button
                    type="button"
                    onClick={handleAddRequirementDraft}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2 rounded-lg flex items-center gap-1 transition"
                  >
                    Add This Rule to Account
                  </button>
                </div>
              </div>
            </div>

            {/* List of Requirements Drafted */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-700 block">Drafted Rules List ({requirements.length})</span>
              
              {requirements.length === 0 ? (
                <div className="text-center p-6 bg-slate-50 border border-dashed rounded-xl text-slate-400 text-xs">
                  No qualifying rules added yet. Use the Wizard above to add at least one rule to successfully track milestones!
                </div>
              ) : (
                <div className="space-y-2">
                  {requirements.map((req, index) => (
                    <div key={req.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg text-xs shadow-xs gap-4">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-indigo-500 font-mono">#{index + 1}</span>
                        <div>
                          <span className="font-semibold text-slate-800">{req.description}</span>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1">
                            <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono uppercase font-bold">{req.type.replace('_', ' ')}</span>
                            <span>•</span>
                            <span>Target: <strong className="font-mono text-slate-600">{req.targetValue}</strong></span>
                            <span>•</span>
                            <span>Days to complete: <strong className="font-mono text-slate-600">{req.daysToComplete}</strong></span>
                            <span>•</span>
                            <span className="text-rose-600 font-semibold font-mono">Deadline: {req.deadlineDate}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveRequirementDraft(req.id)}
                        className="text-slate-400 hover:text-rose-600 p-1.5 hover:bg-rose-50 rounded-lg transition shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg text-slate-600 hover:bg-slate-50 transition text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition text-sm font-semibold shadow-xs"
            >
              {accountToEdit ? 'Save Changes' : 'Create Offer Tracker'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
