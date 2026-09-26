import React, { useState } from 'react';
import { 
  User, 
  X, 
  ShieldCheck, 
  Sparkles, 
  FolderPlus, 
  FolderArchive, 
  Trash2, 
  ArrowUpRight, 
  Clock, 
  FileText, 
  LogOut, 
  CheckCircle2, 
  Star, 
  Plus, 
  Save, 
  BookOpen,
  TrendingUp,
  Activity,
  Layers,
  HelpCircle,
  Key,
  RefreshCw,
  Bell,
  Receipt,
  FileCheck2,
  Calendar,
  AlertTriangle,
  Brain,
  Download,
  Phone,
  Eye,
  EyeOff,
  Sliders,
  DollarSign
} from 'lucide-react';
import { useAuth } from '../utils/authContext';
import { 
  Language, 
  TradeRecord, 
  PortfolioSummary, 
  PriceAlert, 
  TradeJournalEntry 
} from '../types';
import { formatCurrency, formatNumber } from '../utils/i18n';

interface Props {
  lang: Language;
  currentTrades: TradeRecord[];
  currentSummary: PortfolioSummary;
  onRestorePortfolio: (trades: TradeRecord[]) => void;
  embedded?: boolean;
}

type PortalTab = 'WALLEX_API' | 'TAX_REPORT' | 'ALERTS' | 'JOURNAL' | 'PORTFOLIOS';

export const PersonalizedUserPortal: React.FC<Props> = ({
  lang,
  currentTrades,
  currentSummary,
  onRestorePortfolio,
  embedded = false,
}) => {
  const { 
    user, 
    isPortalOpen, 
    closePortal, 
    activeView,
    logout, 
    saveCurrentPortfolio, 
    deleteSavedPortfolio, 
    updateUserProfile,
    syncWallexApi 
  } = useAuth();

  // Default to WALLEX_API or the first specialized feature so it's immediately visible
  const [activeTab, setActiveTab] = useState<PortalTab>('WALLEX_API');

  // Portfolio Snapshot State
  const [portfolioName, setPortfolioName] = useState('');
  const [isSavingPortfolio, setIsSavingPortfolio] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Wallex API State
  const [apiKeyInput, setApiKeyInput] = useState(user?.wallexApi?.apiKey || '');
  const [apiSecretInput, setApiSecretInput] = useState(user?.wallexApi?.apiSecret || '');
  const [showApiSecret, setShowApiSecret] = useState(false);
  const [autoSync, setAutoSync] = useState(user?.wallexApi?.autoSyncEnabled ?? true);
  const [isSyncingApi, setIsSyncingApi] = useState(false);
  const [isSavingApi, setIsSavingApi] = useState(false);

  // Tax Calculator State
  const [taxFiscalYear, setTaxFiscalYear] = useState('1404');
  const [taxRatePercent, setTaxRatePercent] = useState<number>(10);
  const [taxDeductFees, setTaxDeductFees] = useState(true);

  // Alerts State
  const [alertSymbol, setAlertSymbol] = useState('TON/TMN');
  const [alertCondition, setAlertCondition] = useState<PriceAlert['condition']>('ABOVE');
  const [alertTargetValue, setAlertTargetValue] = useState('');
  const [alertNote, setAlertNote] = useState('');
  const [phoneNumberInput, setPhoneNumberInput] = useState(user?.phoneNumber || '');

  // Journal State
  const [journalSymbol, setJournalSymbol] = useState('ICP/TMN');
  const [journalAction, setJournalAction] = useState<TradeJournalEntry['action']>('BUY');
  const [journalPnl, setJournalPnl] = useState('');
  const [journalEmotion, setJournalEmotion] = useState<TradeJournalEntry['emotion']>('LOGICAL');
  const [journalLesson, setJournalLesson] = useState('');
  const [journalTag, setJournalTag] = useState('حمایت/مقاومت');

  // If not embedded and modal is closed, don't render
  if (!user) return null;
  if (!embedded && (!isPortalOpen || activeView === 'USER_PANEL')) return null;

  const isFa = lang === 'fa';

  // 1. Save Current Active Portfolio
  const handleSavePortfolio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portfolioName.trim()) return;

    setIsSavingPortfolio(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = await saveCurrentPortfolio(portfolioName, currentTrades, currentSummary);
    setIsSavingPortfolio(false);

    if (res.success) {
      setSuccessMsg(isFa ? 'پورتفوی فعلی با موفقیت در حساب کاربری شما ذخیره شد.' : 'Portfolio snapshot saved successfully.');
      setPortfolioName('');
      setTimeout(() => setSuccessMsg(null), 4000);
    } else {
      setErrorMsg(res.error || 'خطا در ذخیره‌سازی.');
    }
  };

  // 2. Save Wallex API Configuration
  const handleSaveWallexApi = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingApi(true);
    setErrorMsg(null);

    const res = await updateUserProfile({
      wallexApi: {
        apiKey: apiKeyInput.trim(),
        apiSecret: apiSecretInput.trim(),
        isConnected: Boolean(apiKeyInput.trim()),
        lastSyncAt: user.wallexApi?.lastSyncAt || new Date().toISOString(),
        autoSyncEnabled: autoSync,
      },
    });

    setIsSavingApi(false);
    if (res.success) {
      setSuccessMsg(isFa ? 'تنظیمات کلید API والکس با موفقیت ذخیره شد.' : 'Wallex API credentials saved.');
      setTimeout(() => setSuccessMsg(null), 3500);
    } else {
      setErrorMsg(res.error || 'خطا در ذخیره تنظیمات API.');
    }
  };

  // 3. Trigger Wallex Live Sync
  const handleTriggerSync = async () => {
    setIsSyncingApi(true);
    setErrorMsg(null);
    const res = await syncWallexApi();
    setIsSyncingApi(false);

    if (res.success) {
      setSuccessMsg(isFa ? 'همگام‌سازی زنده معاملات از حساب والکس با موفقیت انجام شد.' : 'Live Wallex sync completed.');
      setTimeout(() => setSuccessMsg(null), 4000);
    } else {
      setErrorMsg(res.error || 'خطا در برقراری ارتباط با والکس.');
    }
  };

  // 4. Save Phone Number & Add Price Alert
  const handleAddAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertTargetValue || isNaN(Number(alertTargetValue))) {
      setErrorMsg(isFa ? 'لطفاً مقدار معتبر برای تارگت هشدار وارد نمایید.' : 'Enter valid target value.');
      return;
    }

    const isToman = alertSymbol.endsWith('TMN');
    const newAlert: PriceAlert = {
      id: 'alt_' + Date.now(),
      symbol: alertSymbol.trim().toUpperCase(),
      condition: alertCondition,
      targetValue: Number(alertTargetValue),
      currency: isToman ? 'TMN' : 'USD',
      note: alertNote.trim(),
      createdAt: new Date().toISOString(),
      isActive: true,
    };

    const updatedAlerts = [newAlert, ...(user.alerts || [])];
    const res = await updateUserProfile({
      alerts: updatedAlerts,
      phoneNumber: phoneNumberInput.trim(),
    });

    if (res.success) {
      setSuccessMsg(isFa ? 'هشدار قیمت با موفقیت فعال گردید.' : 'Price alert added.');
      setAlertTargetValue('');
      setAlertNote('');
      setTimeout(() => setSuccessMsg(null), 3000);
    } else {
      setErrorMsg(res.error || 'خطا در ذخیره هشدار.');
    }
  };

  const handleToggleAlert = async (id: string) => {
    const updated = (user.alerts || []).map(a => a.id === id ? { ...a, isActive: !a.isActive } : a);
    await updateUserProfile({ alerts: updated });
  };

  const handleDeleteAlert = async (id: string) => {
    const updated = (user.alerts || []).filter(a => a.id !== id);
    await updateUserProfile({ alerts: updated });
  };

  // 5. Add Trade Journal Entry
  const handleAddJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!journalLesson.trim()) {
      setErrorMsg(isFa ? 'لطفاً شرح استراتژی یا درس آموخته‌شده را یادداشت فرمایید.' : 'Enter strategy lesson.');
      return;
    }

    const newEntry: TradeJournalEntry = {
      id: 'jrn_' + Date.now(),
      date: new Date().toISOString(),
      symbol: journalSymbol.trim().toUpperCase(),
      action: journalAction,
      pnl: journalPnl ? Number(journalPnl) : undefined,
      emotion: journalEmotion,
      lesson: journalLesson.trim(),
      strategyTag: journalTag.trim() || 'General',
    };

    const updatedJournal = [newEntry, ...(user.journalEntries || [])];
    const res = await updateUserProfile({ journalEntries: updatedJournal });

    if (res.success) {
      setSuccessMsg(isFa ? 'تحلیل و درس معامله در ژورنال شخصی شما ثبت شد.' : 'Journal entry recorded.');
      setJournalLesson('');
      setJournalPnl('');
      setTimeout(() => setSuccessMsg(null), 3000);
    } else {
      setErrorMsg(res.error || 'خطا در ثبت ژورنال.');
    }
  };

  const handleDeleteJournal = async (id: string) => {
    const updated = (user.journalEntries || []).filter(j => j.id !== id);
    await updateUserProfile({ journalEntries: updated });
  };

  // Tax calculations based on current summary
  const realizedProfit = Math.max(0, currentSummary.realizedPnL);
  const realizedLoss = Math.abs(Math.min(0, currentSummary.realizedPnL));
  const deductibleFees = taxDeductFees ? currentSummary.totalFeesPaid : 0;
  const taxableBase = Math.max(0, realizedProfit - realizedLoss - deductibleFees);
  const estimatedTax = Math.round((taxableBase * taxRatePercent) / 100);

  const handlePrintTaxStatement = () => {
    window.print();
  };

  const innerContent = (
    <div className={`relative w-full ${embedded ? 'rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl shadow-xl' : 'max-w-5xl my-auto rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl shadow-2xl max-h-[90vh] flex flex-col'} overflow-hidden transition-all`} dir={isFa ? 'rtl' : 'ltr'}>
      {/* Top Header Banner */}
      <div className="relative p-5 sm:p-6 bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-indigo-500/15 border-b border-slate-200/80 dark:border-slate-800 shrink-0">
        {!embedded && (
          <button
            type="button"
            onClick={closePortal}
            className="absolute top-5 end-5 p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pe-4 sm:pe-8">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/25 ring-2 ring-emerald-500/20 text-xl font-black">
              {user.name ? user.name[0].toUpperCase() : user.email[0].toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100">
                  {lang === 'fa' ? 'پنل کاربری اختصاصی' : 'Personal Member Dashboard'}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                  {user.memberTier || 'Pro Trader'}
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono text-emerald-600 dark:text-emerald-300 bg-emerald-500/10">
                  {isFa ? 'حساب کاربری فعال' : 'Active Account'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono" dir="ltr">
                {user.email} {user.name ? `(${user.name})` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer border border-rose-200/50 dark:border-rose-900/40"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{isFa ? 'خروج از حساب' : 'Sign Out'}</span>
            </button>
          </div>
        </div>

        {/* 5 Quick Feature Overview Cards (Clickable) */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-2.5 mt-5">
          {/* 1. API Wallex */}
          <button
            type="button"
            onClick={() => setActiveTab('WALLEX_API')}
            className={`p-3 rounded-2xl border text-start transition cursor-pointer ${
              activeTab === 'WALLEX_API'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/30'
                : 'bg-white/80 dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700 hover:border-indigo-500/50 text-slate-800 dark:text-slate-200'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <Key className="w-4 h-4" />
              <span className={`w-2 h-2 rounded-full ${user.wallexApi?.isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            </div>
            <div className="text-xs font-bold truncate">{isFa ? '۱. اتصال API والکس' : '1. Wallex API'}</div>
            <div className={`text-[10px] mt-0.5 truncate ${activeTab === 'WALLEX_API' ? 'text-indigo-100' : 'text-slate-400'}`}>
              {user.wallexApi?.isConnected ? (isFa ? 'متصل و فعال' : 'Connected') : (isFa ? 'تنظیم کلید' : 'Setup')}
            </div>
          </button>

          {/* 2. Tax Report */}
          <button
            type="button"
            onClick={() => setActiveTab('TAX_REPORT')}
            className={`p-3 rounded-2xl border text-start transition cursor-pointer ${
              activeTab === 'TAX_REPORT'
                ? 'bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-600/30'
                : 'bg-white/80 dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700 hover:border-amber-500/50 text-slate-800 dark:text-slate-200'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <Receipt className="w-4 h-4" />
              <span className={`text-[10px] font-mono px-1 rounded ${activeTab === 'TAX_REPORT' ? 'bg-amber-700' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}>
                {taxFiscalYear}
              </span>
            </div>
            <div className="text-xs font-bold truncate">{isFa ? '۲. گزارش مالیاتی' : '2. Tax Statement'}</div>
            <div className={`text-[10px] mt-0.5 truncate ${activeTab === 'TAX_REPORT' ? 'text-amber-100' : 'text-slate-400'}`}>
              {isFa ? 'محاسبه رسمی سود' : 'Capital Gains'}
            </div>
          </button>

          {/* 3. Alerts */}
          <button
            type="button"
            onClick={() => setActiveTab('ALERTS')}
            className={`p-3 rounded-2xl border text-start transition cursor-pointer ${
              activeTab === 'ALERTS'
                ? 'bg-cyan-600 text-white border-cyan-600 shadow-md shadow-cyan-600/30'
                : 'bg-white/80 dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700 hover:border-cyan-500/50 text-slate-800 dark:text-slate-200'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <Bell className="w-4 h-4" />
              <span className={`text-[10px] font-mono px-1.5 rounded-full ${activeTab === 'ALERTS' ? 'bg-cyan-700' : 'bg-cyan-500/20 text-cyan-600'}`}>
                {user.alerts?.length || 0}
              </span>
            </div>
            <div className="text-xs font-bold truncate">{isFa ? '۳. هشدارهای سود' : '3. Price Alerts'}</div>
            <div className={`text-[10px] mt-0.5 truncate ${activeTab === 'ALERTS' ? 'text-cyan-100' : 'text-slate-400'}`}>
              {isFa ? 'تارگت و حد ضرر' : 'Triggers'}
            </div>
          </button>

          {/* 4. Journal */}
          <button
            type="button"
            onClick={() => setActiveTab('JOURNAL')}
            className={`p-3 rounded-2xl border text-start transition cursor-pointer ${
              activeTab === 'JOURNAL'
                ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-600/30'
                : 'bg-white/80 dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700 hover:border-purple-500/50 text-slate-800 dark:text-slate-200'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <Brain className="w-4 h-4" />
              <span className={`text-[10px] font-mono px-1.5 rounded-full ${activeTab === 'JOURNAL' ? 'bg-purple-700' : 'bg-purple-500/20 text-purple-600'}`}>
                {user.journalEntries?.length || 0}
              </span>
            </div>
            <div className="text-xs font-bold truncate">{isFa ? '۴. ژورنال روانشناسی' : '4. Trade Journal'}</div>
            <div className={`text-[10px] mt-0.5 truncate ${activeTab === 'JOURNAL' ? 'text-purple-100' : 'text-slate-400'}`}>
              {isFa ? 'مدیریت احساسات' : 'Psychology'}
            </div>
          </button>

          {/* 5. Cloud Portfolios */}
          <button
            type="button"
            onClick={() => setActiveTab('PORTFOLIOS')}
            className={`p-3 rounded-2xl border text-start transition cursor-pointer col-span-2 sm:col-span-1 ${
              activeTab === 'PORTFOLIOS'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/30'
                : 'bg-white/80 dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700 hover:border-emerald-500/50 text-slate-800 dark:text-slate-200'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <FolderArchive className="w-4 h-4" />
              <span className={`text-[10px] font-mono px-1.5 rounded-full ${activeTab === 'PORTFOLIOS' ? 'bg-emerald-700' : 'bg-emerald-500/20 text-emerald-600'}`}>
                {user.savedPortfolios?.length || 0}
              </span>
            </div>
            <div className="text-xs font-bold truncate">{isFa ? '۵. پورتفوهای ابری' : '5. Cloud Vault'}</div>
            <div className={`text-[10px] mt-0.5 truncate ${activeTab === 'PORTFOLIOS' ? 'text-emerald-100' : 'text-slate-400'}`}>
              {isFa ? 'بکاپ و بازیابی' : 'Saved Sets'}
            </div>
          </button>
        </div>
      </div>

      {/* Portal Body Content */}
      <div className={`p-4 sm:p-6 space-y-6 ${embedded ? '' : 'overflow-y-auto flex-1'}`}>
        {/* Notification Messages */}
        {successMsg && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
            <span className="font-semibold">{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <X className="w-4 h-4 shrink-0 text-rose-500" />
            <span className="font-semibold">{errorMsg}</span>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 1: WALLEX DIRECT API SYNC                            */}
        {/* ======================================================== */}
        {activeTab === 'WALLEX_API' && (
          <div className="space-y-6">
            <div className="p-5 sm:p-6 rounded-2xl border border-indigo-500/25 bg-indigo-500/5 dark:bg-indigo-950/20 backdrop-blur-md space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-600/25">
                    <Key className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
                      {isFa ? 'اتصال مستقیم به صرافی والکس با کلید API' : 'Wallex Direct API Integration'}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {isFa 
                        ? 'همگام‌سازی خودکار سفارش‌ها و معاملات انجام‌شده در صرافی والکس بدون نیاز به دانلود فایل اکسل یا بارگذاری دستی عکس.' 
                        : 'Auto-sync trades directly from Wallex exchange account.'}
                    </p>
                  </div>
                </div>

                {user.wallexApi?.isConnected && (
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{isFa ? 'متصل به حساب والکس' : 'Connected to Wallex'}</span>
                  </div>
                )}
              </div>

              <form onSubmit={handleSaveWallexApi} className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    {isFa ? 'کلید عمومی API Key والکس:' : 'Wallex API Key:'}
                  </label>
                  <input
                    type="text"
                    value={apiKeyInput}
                    onChange={e => setApiKeyInput(e.target.value)}
                    placeholder="wlx_live_..."
                    className="w-full py-2.5 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 font-mono focus:ring-2 focus:ring-indigo-500"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    {isFa ? 'کلید محرمانه API Secret:' : 'Wallex Secret Key:'}
                  </label>
                  <div className="relative">
                    <input
                      type={showApiSecret ? 'text' : 'password'}
                      value={apiSecretInput}
                      onChange={e => setApiSecretInput(e.target.value)}
                      placeholder="••••••••••••••••"
                      className="w-full py-2.5 px-3.5 pe-10 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 font-mono focus:ring-2 focus:ring-indigo-500"
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiSecret(!showApiSecret)}
                      className="absolute top-1/2 -translate-y-1/2 end-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showApiSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="autoSyncCheck"
                    checked={autoSync}
                    onChange={e => setAutoSync(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <label htmlFor="autoSyncCheck" className="text-xs text-slate-600 dark:text-slate-300 cursor-pointer font-medium">
                    {isFa ? 'همگام‌سازی خودکار روزانه معاملات در پس‌زمینه' : 'Enable automated daily background sync'}
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={isSavingApi}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/25 active:scale-95 transition cursor-pointer"
                  >
                    {isSavingApi ? (isFa ? 'در حال ذخیره...' : 'Saving...') : (isFa ? 'ذخیره کلیدهای API' : 'Save API Keys')}
                  </button>

                  <button
                    type="button"
                    onClick={handleTriggerSync}
                    disabled={isSyncingApi}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/25 active:scale-95 transition cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingApi ? 'animate-spin' : ''}`} />
                    <span>{isSyncingApi ? (isFa ? 'در حال دریافت اطلاعات از والکس...' : 'Syncing...') : (isFa ? 'همگام‌سازی آنی معاملات جدید' : 'Sync Now')}</span>
                  </button>
                </div>
              </form>

              {user.wallexApi?.lastSyncAt && (
                <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-3 border-t border-indigo-200/40 dark:border-indigo-900/40 flex items-center justify-between">
                  <span>{isFa ? 'آخرین همگام‌سازی موفق با سرور والکس:' : 'Last successful sync:'}</span>
                  <span className="font-mono font-bold text-indigo-700 dark:text-indigo-300">{new Date(user.wallexApi.lastSyncAt).toLocaleString(isFa ? 'fa-IR' : 'en-US')}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: FORMAL TAX & CAPITAL GAINS STATEMENT              */}
        {/* ======================================================== */}
        {activeTab === 'TAX_REPORT' && (
          <div className="space-y-6">
            <div className="p-5 sm:p-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/20 backdrop-blur-md space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-700 dark:text-amber-400">
                    <Receipt className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
                      {isFa ? 'صورت‌حساب رسمی سود/زیان و برآورد مالیات بر عایدی سرمایه' : 'Official Fiscal & Capital Gains Tax Statement'}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {isFa 
                        ? 'محاسبه سود خالص مشمول، جبران زیان‌های دوره و کسر قانونی کارمزدهای معاملات به عنوان هزینه تجاری قابل قبول.' 
                        : 'Capital gains tax calculation and deductible trading fee accounting.'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handlePrintTaxStatement}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-md shadow-amber-600/20 transition cursor-pointer self-start sm:self-auto"
                >
                  <Download className="w-4 h-4" />
                  <span>{isFa ? 'چاپ و خروجی صورت‌حساب' : 'Print Statement'}</span>
                </button>
              </div>

              {/* Fiscal Parameters */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    {isFa ? 'سال مالیاتی:' : 'Fiscal Year:'}
                  </label>
                  <select
                    value={taxFiscalYear}
                    onChange={e => setTaxFiscalYear(e.target.value)}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-bold"
                  >
                    <option value="1404">سال مالی ۱۴۰۴ (۲۰۲۵ - ۲۰۲۶)</option>
                    <option value="1403">سال مالی ۱۴۰۳ (۲۰۲۴ - ۲۰۲۵)</option>
                    <option value="1402">سال مالی ۱۴۰۲ (۲۰۲۳ - ۲۰۲۴)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    {isFa ? 'نرخ مالیاتی بر سود (%):' : 'Tax Bracket (%):'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={35}
                    value={taxRatePercent}
                    onChange={e => setTaxRatePercent(Number(e.target.value))}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-bold font-mono"
                  />
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="deductFeeCheck"
                    checked={taxDeductFees}
                    onChange={e => setTaxDeductFees(e.target.checked)}
                    className="rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                  />
                  <label htmlFor="deductFeeCheck" className="text-xs text-slate-600 dark:text-slate-300 cursor-pointer font-medium">
                    {isFa ? 'کسر کارمزدهای معاملات از مبنای مشمول' : 'Deduct exchange fees from taxable base'}
                  </label>
                </div>
              </div>

              {/* Fiscal Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-[11px] text-slate-500 block mb-1">{isFa ? 'سود ناخالص محقق‌شده:' : 'Gross Realized Gain:'}</span>
                  <span className="text-base font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {realizedProfit.toLocaleString()}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-[11px] text-slate-500 block mb-1">{isFa ? 'زیان قابل جبران:' : 'Allowable Loss Offsets:'}</span>
                  <span className="text-base font-mono font-bold text-rose-600 dark:text-rose-400">
                    {realizedLoss.toLocaleString()}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-[11px] text-slate-500 block mb-1">{isFa ? 'کارمزد قابل کسر هزینه:' : 'Deductible Fees:'}</span>
                  <span className="text-base font-mono font-bold text-amber-600 dark:text-amber-400">
                    {deductibleFees.toLocaleString()}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-amber-500/5 border border-amber-500/40">
                  <span className="text-[11px] text-amber-800 dark:text-amber-300 font-bold block mb-1">{isFa ? 'برآورد مالیات تکلیفی:' : 'Estimated Tax Due:'}</span>
                  <span className="text-lg font-mono font-black text-amber-700 dark:text-amber-300">
                    {estimatedTax.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: PRICE & P&L ALERTS                                */}
        {/* ======================================================== */}
        {activeTab === 'ALERTS' && (
          <div className="space-y-6">
            {/* Alert Creation Form */}
            <div className="p-5 sm:p-6 rounded-2xl border border-cyan-500/30 bg-cyan-500/5 dark:bg-cyan-950/20 backdrop-blur-md space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-cyan-500/20 text-cyan-600 dark:text-cyan-400">
                  <Bell className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
                    {isFa ? 'افزودن هشدار هوشمند قیمت و پوزیشن' : 'Set Price & P&L Alerts'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {isFa ? 'دریافت اعلان به محض رسیدن قیمت به تارگت‌های سود یا حد ضرر معامله.' : 'Instant notification on price triggers'}
                  </p>
                </div>
              </div>

              <form onSubmit={handleAddAlert} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    {isFa ? 'نماد معامله:' : 'Symbol:'}
                  </label>
                  <input
                    type="text"
                    value={alertSymbol}
                    onChange={e => setAlertSymbol(e.target.value)}
                    placeholder="TON/TMN"
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    {isFa ? 'شرط اعلان:' : 'Condition:'}
                  </label>
                  <select
                    value={alertCondition}
                    onChange={e => setAlertCondition(e.target.value as PriceAlert['condition'])}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-bold"
                  >
                    <option value="ABOVE">{isFa ? 'قیمت بالاتر یا مساوی' : 'Price >= Target'}</option>
                    <option value="BELOW">{isFa ? 'قیمت پایین‌تر یا مساوی' : 'Price <= Target'}</option>
                    <option value="PNL_PROFIT">{isFa ? 'سود پوزیشن بیشتر از' : 'Position Profit > Target'}</option>
                    <option value="PNL_LOSS">{isFa ? 'زیان پوزیشن بیشتر از' : 'Position Loss > Target'}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    {isFa ? 'مبلغ تارگت (قیمت):' : 'Target Amount:'}
                  </label>
                  <input
                    type="number"
                    required
                    value={alertTargetValue}
                    onChange={e => setAlertTargetValue(e.target.value)}
                    placeholder="480000"
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    {isFa ? 'شماره موبایل جهت پیامک:' : 'Mobile Number:'}
                  </label>
                  <input
                    type="tel"
                    value={phoneNumberInput}
                    onChange={e => setPhoneNumberInput(e.target.value)}
                    placeholder="0912..."
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold"
                    dir="ltr"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    {isFa ? 'یادداشت یا دلیل هشدار:' : 'Alert note:'}
                  </label>
                  <input
                    type="text"
                    value={alertNote}
                    onChange={e => setAlertNote(e.target.value)}
                    placeholder={isFa ? 'تارگت اول مقاومت روزانه - ذخیره ۳۰٪ سود' : 'Take profit note'}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs"
                  />
                </div>

                <div className="sm:col-span-1 flex items-end">
                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-md shadow-cyan-600/25 active:scale-95 transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isFa ? 'ثبت هشدار' : 'Add Alert'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Active Alerts List */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Bell className="w-4 h-4 text-cyan-600" />
                <span>{isFa ? 'هشدارهای فعال شما' : 'Active Alerts'}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">
                  {user.alerts?.length || 0}
                </span>
              </h4>

              {(!user.alerts || user.alerts.length === 0) ? (
                <div className="p-6 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-500 text-xs">
                  {isFa ? 'هنوز هشداری تنظیم نکرده‌اید.' : 'No alerts configured.'}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {user.alerts.map((alt) => (
                    <div
                      key={alt.id}
                      className={`p-4 rounded-2xl border flex items-center justify-between gap-3 transition ${
                        alt.isActive 
                          ? 'bg-white dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700' 
                          : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200/40 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleToggleAlert(alt.id)}
                          className={`w-5 h-5 rounded-full border-2 transition cursor-pointer ${
                            alt.isActive ? 'border-cyan-500 bg-cyan-500' : 'border-slate-400'
                          }`}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-slate-900 dark:text-slate-100">{alt.symbol}</span>
                            <span className="text-[11px] text-cyan-700 dark:text-cyan-300 font-medium">
                              {alt.condition === 'ABOVE' ? 'بالاتر از' : 'پایین‌تر از'} {alt.targetValue.toLocaleString()} {alt.currency === 'TMN' ? 'تومان' : '$'}
                            </span>
                          </div>
                          {alt.note && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{alt.note}</p>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteAlert(alt.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 4: TRADE PSYCHOLOGY & JOURNAL                        */}
        {/* ======================================================== */}
        {activeTab === 'JOURNAL' && (
          <div className="space-y-6">
            {/* Journal Entry Form */}
            <div className="p-5 sm:p-6 rounded-2xl border border-purple-500/30 bg-purple-500/5 dark:bg-purple-950/20 backdrop-blur-md space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-purple-500/20 text-purple-600 dark:text-purple-400">
                  <Brain className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
                    {isFa ? 'ژورنال روانشناسی معامله‌گر و ثبت دلایل ورود/خروج' : 'Trading Psychology & Strategy Journal'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {isFa ? 'ثبت وضعیت روحی، احساسات (فومو، طمع، منطق) و یادگیری از معاملات گذشته.' : 'Track psychological biases and trade learnings.'}
                  </p>
                </div>
              </div>

              <form onSubmit={handleAddJournal} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    {isFa ? 'نماد معامله:' : 'Symbol:'}
                  </label>
                  <input
                    type="text"
                    value={journalSymbol}
                    onChange={e => setJournalSymbol(e.target.value)}
                    placeholder="ICP/TMN"
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    {isFa ? 'نوع اقدام:' : 'Action:'}
                  </label>
                  <select
                    value={journalAction}
                    onChange={e => setJournalAction(e.target.value as TradeJournalEntry['action'])}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-bold"
                  >
                    <option value="BUY">{isFa ? 'خرید (Buy)' : 'Buy'}</option>
                    <option value="SELL">{isFa ? 'فروش (Sell)' : 'Sell'}</option>
                    <option value="HOLD">{isFa ? 'نگهداری (Hold)' : 'Hold'}</option>
                    <option value="REVIEW">{isFa ? 'مرور استراتژی' : 'Review'}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    {isFa ? 'وضعیت روحی / احساس معامله:' : 'Emotional State:'}
                  </label>
                  <select
                    value={journalEmotion}
                    onChange={e => setJournalEmotion(e.target.value as TradeJournalEntry['emotion'])}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-bold"
                  >
                    <option value="LOGICAL">{isFa ? 'منطقی و طبق استراتژی' : 'Logical / Planned'}</option>
                    <option value="DISCIPLINED">{isFa ? 'انضباط کامل و بدون طمع' : 'Disciplined'}</option>
                    <option value="FOMO">{isFa ? 'ترس از جا ماندن (FOMO)' : 'FOMO'}</option>
                    <option value="GREED">{isFa ? 'طمع و انتظار سود غیرواقعی' : 'Greed'}</option>
                    <option value="FEAR">{isFa ? 'ترس و خروج زودهنگام' : 'Fear'}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    {isFa ? 'سود/زیان محقق‌شده:' : 'P&L amount:'}
                  </label>
                  <input
                    type="number"
                    value={journalPnl}
                    onChange={e => setJournalPnl(e.target.value)}
                    placeholder="+14200000"
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    {isFa ? 'درس آموخته‌شده و شرح معامله:' : 'Lesson / Trade Summary:'}
                  </label>
                  <input
                    type="text"
                    required
                    value={journalLesson}
                    onChange={e => setJournalLesson(e.target.value)}
                    placeholder={isFa ? 'ورود پله‌ای پس از تایید کندل برگشتی؛ حفظ حد ضرر بدون جابجایی.' : 'Key takeaway'}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs"
                  />
                </div>

                <div className="sm:col-span-1 flex items-end">
                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-600/25 active:scale-95 transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isFa ? 'ثبت در ژورنال' : 'Record'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Journal History */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-600" />
                <span>{isFa ? 'یادداشت‌های ژورنال شما' : 'Journal Entries'}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">
                  {user.journalEntries?.length || 0}
                </span>
              </h4>

              {(!user.journalEntries || user.journalEntries.length === 0) ? (
                <div className="p-6 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-500 text-xs">
                  {isFa ? 'هنوز یادداشتی در ژورنال ثبت نشده است.' : 'No journal records yet.'}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {user.journalEntries.map((j) => (
                    <div
                      key={j.id}
                      className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-800/60 backdrop-blur-md space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-xs text-slate-900 dark:text-slate-100">{j.symbol}</span>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            j.action === 'BUY' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                          }`}>
                            {j.action}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/15 text-purple-700 dark:text-purple-300">
                            {j.emotion === 'LOGICAL' ? 'منطقی' : j.emotion === 'FOMO' ? 'فومو' : j.emotion === 'GREED' ? 'طمع' : 'ترس'}
                          </span>
                          {j.pnl !== undefined && (
                            <span className={`font-mono text-xs font-bold ${j.pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {j.pnl >= 0 ? '+' : ''}{j.pnl.toLocaleString()}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteJournal(j.id)}
                          className="p-1 text-slate-400 hover:text-rose-500 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                        {j.lesson}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 5: SAVED CLOUD PORTFOLIOS                            */}
        {/* ======================================================== */}
        {activeTab === 'PORTFOLIOS' && (
          <div className="space-y-6">
            {/* Snapshot Saver Box */}
            <div className="p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-800/40 backdrop-blur-md space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <FolderPlus className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
                    {isFa ? 'ذخیره‌سازی وضعیت فعلی معاملات در حساب من' : 'Save Current Analysis Snapshot'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {isFa 
                      ? `هم‌اکنون ${currentTrades.length} معامله در ابزار فعال است.` 
                      : `${currentTrades.length} trade(s) currently active in workspace.`}
                  </p>
                </div>
              </div>

              <form onSubmit={handleSavePortfolio} className="flex flex-col sm:flex-row items-center gap-2.5">
                <input
                  type="text"
                  value={portfolioName}
                  onChange={e => setPortfolioName(e.target.value)}
                  placeholder={isFa ? 'نام پورتفو (مثلاً پورتفوی نوسان‌گیری بهاره والکس)' : 'Portfolio label'}
                  className="w-full flex-1 py-2.5 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="submit"
                  disabled={isSavingPortfolio || currentTrades.length === 0}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-500/20 active:scale-95 transition cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingPortfolio ? (isFa ? 'در حال ذخیره...' : 'Saving...') : (isFa ? 'ذخیره در آرشیو ابری' : 'Save Snapshot')}</span>
                </button>
              </form>
            </div>

            {/* Saved Portfolios List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FolderArchive className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {isFa ? 'پورتفوهای ابری ذخیره‌شده شما' : 'Your Cloud Saved Portfolios'}
                  </h3>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                    {user.savedPortfolios?.length || 0}
                  </span>
                </div>
              </div>

              {(!user.savedPortfolios || user.savedPortfolios.length === 0) ? (
                <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs">
                  {isFa 
                    ? 'هنوز پورتفویی ذخیره نشده است. با زدن دکمه بالا می‌توانید وضعیت جاری معاملات را ذخیره فرمایید.' 
                    : 'No saved portfolios yet. Save current trades above to access them anytime.'}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {user.savedPortfolios.map((p) => (
                    <div
                      key={p.id}
                      className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-800/60 backdrop-blur-md shadow-xs space-y-3 hover:border-emerald-500/40 transition"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                            {p.name}
                          </h4>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                            <Clock className="w-3 h-3" />
                            <span>{new Date(p.savedAt).toLocaleDateString(isFa ? 'fa-IR' : 'en-US')}</span>
                            <span>·</span>
                            <span>{p.tradesCount} {isFa ? 'معامله' : 'trades'}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => deleteSavedPortfolio(p.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                          title={isFa ? 'حذف این پورتفو' : 'Delete'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-700/60">
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 text-[10px] block">{isFa ? 'سود/زیان خالص:' : 'Net P&L:'}</span>
                          <span className={`font-mono font-bold ${p.netPnL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {p.netPnL.toLocaleString()}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (p.trades && p.trades.length > 0) {
                              onRestorePortfolio(p.trades);
                              if (!embedded) closePortal();
                            }
                          }}
                          disabled={!p.trades || p.trades.length === 0}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-600 hover:text-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition cursor-pointer"
                        >
                          <ArrowUpRight className="w-3.5 h-3.5" />
                          <span>{isFa ? 'بازیابی در ابزار' : 'Restore'}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (embedded) {
    return innerContent;
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto"
      dir={isFa ? 'rtl' : 'ltr'}
      onClick={closePortal}
    >
      {innerContent}
    </div>
  );
};
