import React, { useState } from 'react';
import { BankAccount, AccountType, Requirement, ProgressLog } from '../types';
import { 
  DollarSign, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Calendar, 
  AlertCircle, 
  TrendingUp, 
  ArrowRight,
  PlusCircle,
  TrendingDown,
  Info,
  AlertTriangle,
  History,
  Link as LinkIcon,
  Sparkles,
  Search,
  Check,
  FileText,
  Calculator,
  Building2,
  ExternalLink,
  ShieldCheck,
  Loader2,
  Upload,
  FileUp,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DashboardProps {
  accounts: BankAccount[];
  onLogProgress: (accountId: string, requirementId: string, amount: number, description: string) => void;
  onSelectAccount: (accountId: string) => void;
  onAddAccountClick: () => void;
  onTrackOfferClick?: (offer: { bankName: string; bonusAmount: number; url: string }) => void;
  onSaveAccount?: (account: BankAccount) => void;
  onGoToCalculator?: () => void;
  onGoToAccounts?: () => void;
}

export default function Dashboard({ 
  accounts, 
  onLogProgress, 
  onSelectAccount,
  onAddAccountClick,
  onTrackOfferClick,
  onSaveAccount,
  onGoToCalculator,
  onGoToAccounts
}: DashboardProps) {
  const [loggingReqId, setLoggingReqId] = useState<{ accountId: string; reqId: string } | null>(null);
  const [logAmount, setLogAmount] = useState<number>(0);
  const [logDesc, setLogDesc] = useState<string>('');

  // Extractor States
  const [rawText, setRawText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  // File Upload State (PDF or Image)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [fileMimeType, setFileMimeType] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp'
    ];

    const isPdf = file.name.toLowerCase().endsWith('.pdf');
    const isImg = /\.(png|jpe?g|webp)$/i.test(file.name);

    if (!validTypes.includes(file.type) && !isPdf && !isImg) {
      setExtractError('Please upload a valid PDF document or image file (.pdf, .png, .jpg, .webp).');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setExtractError('File size is too large (max 20MB).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setFileBase64(result);
      setFileMimeType(file.type || (isPdf ? 'application/pdf' : 'image/png'));
      setFileName(file.name);
      setUploadedFile(file);
      setExtractError(null);
    };
    reader.onerror = () => {
      setExtractError('Failed to read the selected file.');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    setFileBase64(null);
    setFileMimeType(null);
    setFileName(null);
  };

  // Extracted Offer State for review & confirmation
  const [extractedOffer, setExtractedOffer] = useState<{
    bankName: string;
    accountName: string;
    accountType: AccountType;
    bonusAmount: number;
    promoCode: string;
    openingDate: string;
    requirements: Requirement[];
    notes: string;
    offerLink: string;
  } | null>(null);

  const [addedSuccessMsg, setAddedSuccessMsg] = useState<string | null>(null);

  // Handle Extraction via AI
  const handleExtractOffer = async () => {
    if (!fileBase64 && (!rawText || !rawText.trim())) {
      setExtractError('Please upload an offer document (PDF or Image) or paste the fine print text.');
      return;
    }

    setIsExtracting(true);
    setExtractError(null);
    setExtractedOffer(null);
    setAddedSuccessMsg(null);

    try {
      const response = await fetch('/api/extract-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileBase64,
          fileMimeType,
          fileName,
          rawText
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Extraction failed (Status: ${response.status}). Please check your uploaded document or fine print text.`);
      }

      const result = await response.json();
      if (result.success && result.data) {
        const d = result.data;
        const todayStr = new Date('2026-07-04').toISOString().split('T')[0];

        // Map requirements
        const mappedReqs: Requirement[] = (d.requirements || []).map((r: any, idx: number) => {
          const days = r.daysToComplete || 90;
          const deadline = new Date('2026-07-04');
          deadline.setDate(deadline.getDate() + days);

          return {
            id: `req-ext-${Date.now()}-${idx}`,
            type: r.type || 'other',
            description: r.description || 'Complete qualifying requirement',
            targetValue: r.targetValue || 0,
            currentValue: 0,
            daysToComplete: days,
            deadlineDate: deadline.toISOString().split('T')[0],
            status: 'in_progress',
            notes: r.notes || ''
          };
        });

        setExtractedOffer({
          bankName: d.bankName || 'Bank Institution',
          accountName: d.accountName || 'Checking Account',
          accountType: (d.accountType as AccountType) || 'checking',
          bonusAmount: d.bonusAmount || 0,
          promoCode: d.promoCode || '',
          openingDate: todayStr,
          requirements: mappedReqs,
          notes: d.notes || '',
          offerLink: fileName ? `Document: ${fileName}` : 'Pasted Fine Print'
        });
      } else {
        throw new Error('Could not parse promotion terms from the provided input.');
      }
    } catch (err: any) {
      console.error('[Offer Extractor] Error:', err);
      setExtractError(err.message || 'Failed to extract offer details. Please upload a PDF/Image or paste the fine print text.');
    } finally {
      setIsExtracting(false);
    }
  };

  // Confirm and Save Extracted Account to User Profile
  const handleConfirmExtractedAccount = () => {
    if (!extractedOffer) return;

    const newAccount: BankAccount = {
      id: `acc-${Date.now()}`,
      bankName: extractedOffer.bankName,
      accountName: extractedOffer.accountName,
      accountType: extractedOffer.accountType,
      openingDate: extractedOffer.openingDate,
      bonusAmount: extractedOffer.bonusAmount,
      offerLink: extractedOffer.offerLink,
      promoCode: extractedOffer.promoCode,
      notes: extractedOffer.notes,
      status: 'in_progress',
      requirements: extractedOffer.requirements,
      progressLogs: []
    };

    if (onSaveAccount) {
      onSaveAccount(newAccount);
    }

    setAddedSuccessMsg(`Successfully added ${newAccount.bankName} (${newAccount.accountName}) with $${newAccount.bonusAmount} bonus to your profile!`);
    setExtractedOffer(null);
    setRawText('');
    setUploadedFile(null);
    setFileBase64(null);
    setFileMimeType(null);
    setFileName(null);
  };

  // Calculations
  const activeAccounts = accounts.filter(a => a.status === 'in_progress' || a.status === 'met' || a.status === 'not_started');
  
  const totalEarned = accounts
    .filter(a => a.status === 'earned')
    .reduce((sum, a) => sum + a.bonusAmount, 0);

  const totalInprogress = accounts
    .filter(a => a.status === 'in_progress' || a.status === 'met')
    .reduce((sum, a) => sum + a.bonusAmount, 0);

  const totalFailed = accounts
    .filter(a => a.status === 'failed')
    .reduce((sum, a) => sum + a.bonusAmount, 0);

  const today = new Date('2026-07-04');

  // Smart Alert Check
  const isSafeToClose = (acc: BankAccount): boolean => {
    if (acc.excludeFromClosure) return false;
    if (acc.status !== 'earned') return false;
    if (!acc.payoutReceivedDate) return false;
    
    if (acc.clawbackDate) {
      const clawDate = new Date(acc.clawbackDate);
      return today.getTime() >= clawDate.getTime();
    } else {
      const openDate = new Date(acc.openingDate);
      const diffTime = today.getTime() - openDate.getTime();
      const daysSinceOpen = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return daysSinceOpen >= 180;
    }
  };

  const safeToCloseAccounts = accounts.filter(isSafeToClose);

  const totalValueAtRisk = accounts
    .filter(a => (a.status === 'in_progress' || a.status === 'not_started'))
    .filter(a => a.requirements.some(r => {
      if (r.status === 'in_progress' || r.status === 'pending') {
        const deadline = new Date(r.deadlineDate);
        const diffTime = deadline.getTime() - today.getTime();
        const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return daysLeft >= 0 && daysLeft <= 30;
      }
      return false;
    }))
    .reduce((sum, a) => sum + a.bonusAmount, 0);

  // Fee & Clawback & Posting Alerts
  interface SmartAlert {
    id: string;
    type: 'fee' | 'clawback' | 'posting_delay';
    severity: 'high' | 'medium' | 'info';
    title: string;
    description: string;
    accountId: string;
  }
  const smartAlerts: SmartAlert[] = [];

  accounts.forEach(acc => {
    if (acc.annualFeeDecisionDate && acc.status !== 'closed' && acc.status !== 'cancelled') {
      const decisionDate = new Date(acc.annualFeeDecisionDate);
      const diffTime = decisionDate.getTime() - today.getTime();
      const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (daysLeft >= -7 && daysLeft <= 30) {
        smartAlerts.push({
          id: `fee-${acc.id}`,
          type: 'fee',
          severity: daysLeft <= 7 ? 'high' : 'medium',
          title: `Annual Fee Action Required: ${acc.bankName}`,
          description: daysLeft < 0 
            ? `Annual Fee decision date was ${Math.abs(daysLeft)} days ago (${acc.annualFeeDecisionDate}). Check if fee of $${acc.annualFee || 0} posted!`
            : `Annual Fee of $${acc.annualFee || 0} decision deadline in ${daysLeft} days (${acc.annualFeeDecisionDate}). Determine if you should close or keep.`,
          accountId: acc.id
        });
      }
    }

    if (acc.status === 'earned') {
      let clawbackEnd: Date;
      let daysLeft: number;
      if (acc.clawbackDate) {
        clawbackEnd = new Date(acc.clawbackDate);
        const diffTime = clawbackEnd.getTime() - today.getTime();
        daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      } else {
        const openDate = new Date(acc.openingDate);
        clawbackEnd = new Date(openDate);
        clawbackEnd.setDate(clawbackEnd.getDate() + 180);
        const diffTime = clawbackEnd.getTime() - today.getTime();
        daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }

      if (daysLeft > 0 && daysLeft <= 60) {
        smartAlerts.push({
          id: `clawback-${acc.id}`,
          type: 'clawback',
          severity: 'medium',
          title: `Active Clawback Window: ${acc.bankName}`,
          description: `Do not close this account yet! Clawback period active for another ${daysLeft} days (ends ${acc.clawbackDate || clawbackEnd.toISOString().split('T')[0]}). Early closure will trigger bonus forfeiture.`,
          accountId: acc.id
        });
      }
    }

    if (acc.status === 'met' && !acc.payoutReceivedDate) {
      const targetDateStr = acc.bonusPostingDeadlineDate || acc.expectedPayoutDate;
      if (targetDateStr) {
        const targetDate = new Date(targetDateStr);
        const diffTime = targetDate.getTime() - today.getTime();
        const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (daysLeft <= 14) {
          smartAlerts.push({
            id: `post-${acc.id}`,
            type: 'posting_delay',
            severity: daysLeft < 0 ? 'high' : 'medium',
            title: `Bonus Posting Outstanding: ${acc.bankName}`,
            description: daysLeft < 0
              ? `Bonus posting is overdue by ${Math.abs(daysLeft)} days (expected ${targetDateStr}). Consider contacting bank support to verify compliance.`
              : `Expected bonus posting deadline is in ${daysLeft} days (${targetDateStr}). Keep tracking.`,
            accountId: acc.id
          });
        }
      }
    }
  });

  interface ActiveReqItem {
    account: BankAccount;
    requirement: Requirement;
    daysLeft: number;
    isOverdue: boolean;
  }

  const activeRequirements: ActiveReqItem[] = [];

  accounts.forEach(acc => {
    if (acc.status === 'in_progress' || acc.status === 'not_started') {
      acc.requirements.forEach(req => {
        if (req.status === 'in_progress' || req.status === 'pending') {
          const deadline = new Date(req.deadlineDate);
          const diffTime = deadline.getTime() - today.getTime();
          const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          activeRequirements.push({
            account: acc,
            requirement: req,
            daysLeft,
            isOverdue: daysLeft < 0
          });
        }
      });
    }
  });

  activeRequirements.sort((a, b) => a.daysLeft - b.daysLeft);

  const handleQuickLogSubmit = (e: React.FormEvent, accountId: string, reqId: string) => {
    e.preventDefault();
    if (logAmount <= 0) return;
    onLogProgress(accountId, reqId, logAmount, logDesc || 'Quick progress update');
    setLoggingReqId(null);
    setLogAmount(0);
    setLogDesc('');
  };

  const getUrgencyColor = (days: number) => {
    if (days < 0) return 'text-rose-600 bg-rose-50 border-rose-100';
    if (days <= 14) return 'text-amber-700 bg-amber-50 border-amber-100';
    return 'text-slate-600 bg-slate-50 border-slate-100';
  };

  return (
    <div className="space-y-8">
      {/* Primary Hero Section: AI Offer Document & Fine Print Extractor */}
      <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 rounded-3xl p-6 md:p-8 text-white shadow-xl border border-indigo-800/40 space-y-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 border border-indigo-400/30 rounded-full text-indigo-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
            <span>AI Offer Intelligence & Automatic Extractor</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
            Extract Bank Offer Details with AI
          </h2>
          <p className="text-indigo-200/80 text-xs md:text-sm max-w-2xl leading-relaxed">
            Upload an offer document (PDF or screenshot image) or paste the fine print text below. AI will scan the offer, extract the cash bonus amount, qualification milestones, and deadlines, and add it directly to your profile.
          </p>
        </div>

        {/* Dual Input Options Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Option 1: File Upload (PDF or Image) */}
          <div className="bg-slate-900/80 border border-indigo-500/30 rounded-2xl p-4 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <label className="text-xs font-bold text-indigo-200 flex items-center gap-1.5">
                  <Upload className="w-4 h-4 text-indigo-400" />
                  <span>Option 1: Upload Offer PDF or Image</span>
                </label>
                <span className="text-[10px] text-indigo-300/70">.pdf, .png, .jpg, .webp (max 20MB)</span>
              </div>

              {!uploadedFile ? (
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-indigo-500/40 hover:border-indigo-400 bg-indigo-950/30 hover:bg-indigo-900/40 rounded-xl p-5 cursor-pointer transition text-center group min-h-[120px]">
                  <input 
                    type="file" 
                    accept="application/pdf,image/png,image/jpeg,image/jpg,image/webp,.pdf,.png,.jpg,.jpeg,.webp" 
                    onChange={handleFileChange} 
                    className="hidden" 
                  />
                  <div className="flex flex-col items-center gap-2 text-indigo-300 group-hover:text-white font-semibold text-xs">
                    <FileUp className="w-6 h-6 text-indigo-400 group-hover:scale-110 transition" />
                    <span>Drop or click to upload offer PDF / Image</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    (Webpage saved as PDF or screenshot of offer page)
                  </p>
                </label>
              ) : (
                <div className="flex items-center justify-between bg-indigo-950/90 border border-emerald-500/40 rounded-xl p-3">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="p-2.5 bg-emerald-500/20 rounded-xl text-emerald-400 shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="truncate">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white truncate">{fileName}</span>
                        <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold rounded-full border border-emerald-500/30 shrink-0">
                          Ready
                        </span>
                      </div>
                      <p className="text-[11px] text-indigo-300 mt-0.5">
                        {(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB &bull; Attached
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-rose-400 rounded-lg transition shrink-0"
                    title="Remove File"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Option 2: Fine Print Textarea */}
          <div className="bg-slate-900/80 border border-indigo-500/30 rounded-2xl p-4 flex flex-col justify-between space-y-3">
            <div>
              <label className="text-xs font-bold text-indigo-200 flex items-center gap-1.5 mb-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                <span>Option 2: Paste Fine Print Text</span>
              </label>
              <textarea
                rows={4}
                placeholder="Paste promotional terms, fine print disclosures, requirement rules, or offer details here..."
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                className="w-full p-3 bg-slate-950/80 border border-indigo-500/30 rounded-xl text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 transition"
              />
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-indigo-800/40">
          <p className="text-xs text-indigo-200/70">
            {uploadedFile && rawText
              ? 'Analyzing attached file + pasted notes'
              : uploadedFile
              ? `Ready to extract from ${fileName}`
              : rawText
              ? 'Ready to extract from pasted fine print text'
              : 'Upload a PDF/Image file or paste fine print text above'}
          </p>

          <button
            type="button"
            onClick={handleExtractOffer}
            disabled={isExtracting || (!uploadedFile && !rawText.trim())}
            className="w-full sm:w-auto px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-sm rounded-2xl transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isExtracting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-white" />
                <span>Extracting Offer Details...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 text-indigo-200" />
                <span>Extract Offer Details</span>
              </>
            )}
          </button>
        </div>

        {/* Error Banner */}
        {extractError && (
          <div className="p-4 bg-rose-950/80 border border-rose-600/50 rounded-2xl text-rose-200 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-sm block">Extraction Notice</span>
              <p>{extractError}</p>
            </div>
          </div>
        )}
      </div>

      {/* Success Notification Banner */}
      {addedSuccessMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
              <Check className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <span className="font-bold text-sm block">{addedSuccessMsg}</span>
              <p className="text-xs text-emerald-700">Account terms, qualifying deadlines, and return metrics are now synced.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onGoToAccounts && (
              <button
                onClick={onGoToAccounts}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                View in My Accounts
              </button>
            )}
            {onGoToCalculator && (
              <button
                onClick={onGoToCalculator}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition flex items-center gap-1 cursor-pointer"
              >
                <Calculator className="w-3.5 h-3.5 text-indigo-400" />
                <span>Check ROI Calculator</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Extracted Offer Preview Card & Confirmation Form */}
      {extractedOffer && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border-2 border-indigo-500/30 rounded-3xl p-6 md:p-8 shadow-xl space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-1">
                <CheckCircle className="w-4 h-4 text-emerald-500" /> AI Extracted Offer Terms
              </span>
              <h3 className="text-xl font-extrabold text-slate-900 mt-1">Review Extracted Bank Details</h3>
            </div>
            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-full border border-emerald-200 self-start sm:self-auto">
              Ready to Save
            </span>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Bank Name</label>
              <input
                type="text"
                value={extractedOffer.bankName}
                onChange={(e) => setExtractedOffer({ ...extractedOffer, bankName: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl font-semibold text-slate-900 text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Product Name</label>
              <input
                type="text"
                value={extractedOffer.accountName}
                onChange={(e) => setExtractedOffer({ ...extractedOffer, accountName: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl font-semibold text-slate-900 text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Account Type</label>
              <select
                value={extractedOffer.accountType}
                onChange={(e) => setExtractedOffer({ ...extractedOffer, accountType: e.target.value as AccountType })}
                className="w-full px-3 py-2 border rounded-xl font-semibold text-slate-900 text-sm focus:ring-2 focus:ring-indigo-500"
              >
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
                <option value="business_checking">Business Checking</option>
                <option value="business_savings">Business Savings</option>
                <option value="credit_card">Credit Card</option>
                <option value="other">Other / Investment</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Cash Bonus ($)</label>
              <input
                type="number"
                value={extractedOffer.bonusAmount}
                onChange={(e) => setExtractedOffer({ ...extractedOffer, bonusAmount: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded-xl font-extrabold text-emerald-600 text-sm focus:ring-2 focus:ring-indigo-500 font-mono"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Account Opening Date</label>
              <input
                type="date"
                value={extractedOffer.openingDate}
                onChange={(e) => {
                  const newDate = e.target.value;
                  // recalculate requirement deadlines relative to new opening date
                  const updatedReqs = extractedOffer.requirements.map(req => {
                    const d = new Date(newDate);
                    d.setDate(d.getDate() + req.daysToComplete);
                    return { ...req, deadlineDate: d.toISOString().split('T')[0] };
                  });
                  setExtractedOffer({ ...extractedOffer, openingDate: newDate, requirements: updatedReqs });
                }}
                className="w-full px-3 py-2 border rounded-xl text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Promo Code (Optional)</label>
              <input
                type="text"
                placeholder="e.g. CHASE300"
                value={extractedOffer.promoCode}
                onChange={(e) => setExtractedOffer({ ...extractedOffer, promoCode: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Extracted Requirements List */}
          <div className="space-y-3">
            <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span>Extracted Qualifying Requirements ({extractedOffer.requirements.length})</span>
            </h4>

            {extractedOffer.requirements.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-xl">No explicit activity requirements extracted. You can edit requirements later in My Accounts.</p>
            ) : (
              <div className="space-y-2">
                {extractedOffer.requirements.map((req, index) => (
                  <div key={req.id} className="p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-indigo-900 uppercase text-[10px] bg-indigo-100 px-2 py-0.5 rounded">
                          {req.type.replace('_', ' ')}
                        </span>
                        <span className="font-semibold text-slate-800">{req.description}</span>
                      </div>
                      {req.notes && <p className="text-slate-500 text-[11px]">{req.notes}</p>}
                    </div>
                    <div className="flex items-center gap-3 shrink-0 text-slate-600 font-mono">
                      <span>Target: <strong>${req.targetValue}</strong></span>
                      <span>Days: <strong>{req.daysToComplete}d</strong> (Deadline: {req.deadlineDate})</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {extractedOffer.notes && (
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-600 space-y-1">
              <strong className="text-slate-800">Additional Audit Notes:</strong>
              <p>{extractedOffer.notes}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setExtractedOffer(null)}
              className="w-full sm:w-auto px-5 py-2.5 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              Discard & Clear
            </button>
            <button
              type="button"
              onClick={handleConfirmExtractedAccount}
              className="w-full sm:w-auto px-6 py-2.5 bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>Confirm & Add to Profile (My Accounts & ROI Calculator)</span>
            </button>
          </div>
        </motion.div>
      )}

      {/* Visual Analytics Hub */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Earned */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block">Total Cash Earned</span>
            <span className="text-3xl font-bold text-emerald-600 mt-1 block font-mono">${totalEarned}</span>
            <span className="text-[10px] text-slate-400 mt-2 block flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 font-mono"></span>
              Secured in pockets
            </span>
          </div>
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-emerald-600" />
          </div>
        </div>

        {/* Total Value at Risk */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block">Value At Risk (30d)</span>
            <span className="text-3xl font-bold text-amber-600 mt-1 block font-mono">${totalValueAtRisk}</span>
            <span className="text-[10px] text-slate-400 mt-2 block flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 font-mono"></span>
              Approaching deadlines
            </span>
          </div>
          <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center">
            <Clock className="w-6 h-6 text-amber-600" />
          </div>
        </div>

        {/* Safe to Close */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block">Safe To Close</span>
            <span className="text-3xl font-bold text-indigo-600 mt-1 block font-mono">{safeToCloseAccounts.length}</span>
            <span className="text-[10px] text-slate-400 mt-2 block flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 font-mono"></span>
              Clawback periods ended
            </span>
          </div>
          <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-indigo-600" />
          </div>
        </div>

        {/* Failed / Missed Cash */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block">Missed / Failed Cash</span>
            <span className="text-3xl font-bold text-rose-500 mt-1 block font-mono">${totalFailed}</span>
            <span className="text-[10px] text-rose-500 mt-2 block flex items-center gap-1 font-medium">
              ⚠️ Attention required
            </span>
          </div>
          <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center">
            <TrendingDown className="w-6 h-6 text-rose-500" />
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Critical Tasks & Timeline - Urgent Requirements (left 2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Smart Fee, Clawback & Posting Alerts */}
          {smartAlerts.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Fee & Compliance Warnings</h3>
              <div className="space-y-2">
                {smartAlerts.map(alert => (
                  <div 
                    key={alert.id}
                    className={`p-4 rounded-xl border flex gap-3 items-start transition-all ${
                      alert.severity === 'high' 
                        ? 'bg-rose-50 border-rose-100 text-rose-800' 
                        : 'bg-amber-50/70 border-amber-100 text-amber-800'
                    }`}
                  >
                    <AlertTriangle className={`w-5 h-5 shrink-0 ${alert.severity === 'high' ? 'text-rose-600' : 'text-amber-600'}`} />
                    <div className="space-y-0.5 flex-1">
                      <span className="font-bold text-sm block text-slate-900">{alert.title}</span>
                      <p className="text-xs text-slate-600 leading-relaxed">{alert.description}</p>
                    </div>
                    <button
                      onClick={() => onSelectAccount(alert.accountId)}
                      className="text-xs font-semibold text-indigo-600 hover:underline shrink-0"
                    >
                      Manage
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Account Closure Recommendations Engine */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 md:p-6 shadow-xs space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-950 tracking-tight flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-600" />
                <span>Closure Recommendation Engine</span>
              </h3>
              <p className="text-slate-500 text-xs mt-0.5">
                Evaluates compliant accounts ready to be shut down safely without sacrificing any bonuses.
              </p>
            </div>

            {safeToCloseAccounts.length === 0 ? (
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-500 leading-relaxed">
                No active accounts are recommended for closure right now. Accounts are only recommended for closure if requirements are met, the bonus is earned, the clawback window has passed, and they are not flagged as anchor accounts.
              </div>
            ) : (
              <div className="space-y-2.5">
                {safeToCloseAccounts.map(acc => {
                  let feeInfo = '';
                  if (acc.annualFee && acc.annualFee > 0) {
                    feeInfo = ` • $${acc.annualFee} Annual Fee decision approaches on ${acc.annualFeeDecisionDate || 'soon'}`;
                  }
                  return (
                    <div key={acc.id} className="p-3.5 bg-emerald-50/40 border border-emerald-100 rounded-xl flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-emerald-950 text-xs">{acc.bankName}</span>
                          <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase font-mono">Safe to Close</span>
                        </div>
                        <p className="text-slate-600 text-xs">
                          {acc.accountName} • Opened: {acc.openingDate} • Paid: {acc.payoutReceivedDate || 'N/A'} {feeInfo}
                        </p>
                        <p className="text-[11px] text-emerald-800 font-semibold flex items-center gap-1 mt-1">
                          ✓ Bonus posted and clawback period of {acc.clawbackMonths || 6} months has passed securely.
                        </p>
                      </div>
                      <button
                        onClick={() => onSelectAccount(acc.id)}
                        className="text-xs font-bold text-indigo-600 hover:underline shrink-0"
                      >
                        Details
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 tracking-tight">Qualifying Activity Deadlines</h3>
              <p className="text-slate-500 text-xs mt-0.5">Chronologically ordered milestones required to qualify for bonuses.</p>
            </div>
            {accounts.length === 0 && (
              <button
                onClick={onAddAccountClick}
                className="flex items-center gap-1.5 text-xs text-indigo-600 font-semibold hover:text-indigo-800 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" /> Add Manually
              </button>
            )}
          </div>

          <div className="space-y-4">
            {accounts.length === 0 ? (
              <div className="bg-indigo-50/40 border-2 border-dashed border-indigo-200 rounded-2xl p-8 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mx-auto text-indigo-600">
                  <Building2 className="w-6 h-6" />
                </div>
                <div className="space-y-1 max-w-md mx-auto">
                  <h4 className="font-bold text-slate-900 text-sm">No Accounts Tracked Yet</h4>
                  <p className="text-slate-500 text-xs leading-relaxed">
                    Paste the Web Link of a bank offer in the card above to extract terms with AI, or click below to manually add a bank account.
                  </p>
                </div>
                <button
                  onClick={onAddAccountClick}
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition shadow-sm cursor-pointer"
                >
                  Create Account Manually
                </button>
              </div>
            ) : activeRequirements.length === 0 ? (
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-8 text-center space-y-3">
                <p className="text-slate-500 text-sm">All qualifying requirements are met or up to date!</p>
              </div>
            ) : (
              activeRequirements.map(({ account, requirement, daysLeft, isOverdue }) => (
                <div 
                  key={requirement.id}
                  className="bg-white border border-slate-100 rounded-2xl p-5 hover:border-slate-200 transition-all shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                        {account.bankName}
                      </span>
                      <span className="text-slate-400 text-xs">•</span>
                      <span className="text-slate-500 text-xs">{account.accountName}</span>
                    </div>

                    <h4 className="font-semibold text-slate-900 text-sm">
                      {requirement.description}
                    </h4>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-slate-500">
                        <span>Progress: <strong className="text-slate-800 font-mono">{requirement.type === 'debit_transactions' || requirement.type === 'bill_pay' ? `${requirement.currentValue}/${requirement.targetValue}` : `$${requirement.currentValue}/$${requirement.targetValue}`}</strong></span>
                        <span>{Math.min(100, Math.round((requirement.currentValue / requirement.targetValue) * 100))}%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-indigo-600 h-full rounded-full transition-all duration-500" 
                          style={{ width: `${Math.min(100, (requirement.currentValue / requirement.targetValue) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Actions & Alerts */}
                  <div className="flex md:flex-col items-start md:items-end justify-between md:justify-center gap-3 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-slate-50">
                    <div className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 ${getUrgencyColor(daysLeft)}`}>
                      <Calendar className="w-3.5 h-3.5" />
                      <span>
                        {isOverdue 
                          ? `Overdue by ${Math.abs(daysLeft)} days!` 
                          : daysLeft === 0 
                            ? 'Deadline Today!' 
                            : `${daysLeft} days remaining`}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onSelectAccount(account.id)}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-800 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition"
                      >
                        View Account
                      </button>

                      {loggingReqId?.reqId === requirement.id ? (
                        <form onSubmit={(e) => handleQuickLogSubmit(e, account.id, requirement.id)} className="flex items-center gap-1 absolute md:relative z-10 bg-white p-3 border border-slate-200 rounded-xl shadow-lg md:shadow-none md:p-0 md:border-0">
                          <input
                            type="number"
                            required
                            placeholder={requirement.type === 'debit_transactions' || requirement.type === 'bill_pay' ? 'Swipes count' : 'Amount ($)'}
                            value={logAmount || ''}
                            onChange={(e) => setLogAmount(parseFloat(e.target.value))}
                            className="w-20 px-2 py-1 text-xs border rounded-lg focus:outline-indigo-500"
                          />
                          <button
                            type="submit"
                            className="bg-indigo-600 text-white px-2.5 py-1 rounded-lg text-xs hover:bg-indigo-700 font-semibold"
                          >
                            Log
                          </button>
                          <button
                            type="button"
                            onClick={() => setLoggingReqId(null)}
                            className="text-slate-400 hover:text-slate-600 text-xs px-1"
                          >
                            Cancel
                          </button>
                        </form>
                      ) : (
                        <button
                          onClick={() => setLoggingReqId({ accountId: account.id, reqId: requirement.id })}
                          className="flex items-center gap-1 text-xs bg-slate-900 text-white font-medium hover:bg-slate-800 px-3 py-1.5 rounded-lg transition"
                        >
                          <PlusCircle className="w-3.5 h-3.5" /> Log Activity
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Lessons Learned & Pro Tips */}
        <div className="space-y-6">
          <div className="bg-slate-900 rounded-2xl p-6 text-white space-y-4">
            <div className="flex items-center gap-2 text-indigo-400 font-medium text-xs tracking-wider uppercase">
              <AlertCircle className="w-4 h-4 text-indigo-400" />
              <span>Lessons Learned</span>
            </div>
            <h3 className="text-lg font-semibold tracking-tight">Qualifying Failures</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              Analyzing previous failures builds discipline. Here are your historical missed bonuses and what blocked them:
            </p>

            <div className="space-y-3 pt-2">
              {accounts.filter(a => a.status === 'failed').length === 0 ? (
                <p className="text-slate-500 text-xs italic">No failures registered yet! Keep tracking to maintain an active streak.</p>
              ) : (
                accounts.filter(a => a.status === 'failed').map(failedAcc => (
                  <div key={failedAcc.id} className="bg-slate-800/80 rounded-xl p-3 border border-slate-800 text-xs space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-slate-300">{failedAcc.bankName}</span>
                      <span className="text-rose-400 font-mono font-semibold">-${failedAcc.bonusAmount}</span>
                    </div>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      <strong>Mistake:</strong> {failedAcc.missedReason || 'Requirements not completed within timeline.'}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick-Tips sidebar cards */}
          <div className="bg-indigo-50/50 rounded-2xl p-6 border border-indigo-100/50 space-y-4">
            <h4 className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
              <Info className="w-4 h-4 text-indigo-600" />
              <span>Sign-up Pro-Tips</span>
            </h4>
            
            <div className="space-y-3 text-xs text-slate-600">
              <div className="flex gap-2">
                <span className="text-indigo-600 font-bold">•</span>
                <p><strong>Track early closures:</strong> Never close a bank account within 180 days of opening, or they may reclaim the bonus.</p>
              </div>
              <div className="flex gap-2">
                <span className="text-indigo-600 font-bold">•</span>
                <p><strong>Small Amazon reloads:</strong> Easily meet debit swipe requirements by executing ten $1.00 Amazon balance reloads.</p>
              </div>
              <div className="flex gap-2">
                <span className="text-indigo-600 font-bold">•</span>
                <p><strong>Brokerage ACH:</strong> If payroll is tough to split, transfer from Fidelity or Schwab; it often codes as a direct deposit.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
