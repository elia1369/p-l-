import React, { useState, useMemo } from 'react';
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
  TrendingDown,
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
  DollarSign,
  Percent,
  Calculator,
  ArrowRightLeft,
  Timer,
  Zap,
  Target,
  Award
} from 'lucide-react';
import { useAuth } from '../utils/authContext';
import { 
  Language, 
  TradeRecord, 
  PortfolioSummary, 
  PriceAlert, 
  TradeJournalEntry,
  MarginTrade,
  MarginPositionType
} from '../types';

interface Props {
  lang: Language;
  currentTrades: TradeRecord[];
  currentSummary: PortfolioSummary;
  onRestorePortfolio: (trades: TradeRecord[]) => void;
  embedded?: boolean;
}

type PortalTab = 'MARGIN_TRADES' | 'WALLEX_API' | 'ALERTS' | 'JOURNAL' | 'PORTFOLIOS';

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

  // Active Tab: Default to MARGIN_TRADES as requested by user
  const [activeTab, setActiveTab] = useState<PortalTab>('MARGIN_TRADES');

  // Feedback notifications
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // -------------------------------------------------------------
  // Margin Trading (معاملات تعهدی والکس) State
  // -------------------------------------------------------------
  const [marginSymbol, setMarginSymbol] = useState('BTC/TMN');
  const [marginPosType, setMarginPosType] = useState<MarginPositionType>('LONG');
  const [marginEntryPrice, setMarginEntryPrice] = useState('');
  const [marginExitPrice, setMarginExitPrice] = useState('');
  const [marginCollateral, setMarginCollateral] = useState('10000000'); // default 10M Toman
  const [marginLeverageInput, setMarginLeverageInput] = useState<string>('10');
  const [marginLeverageMode, setMarginLeverageMode] = useState<'RATIO' | 'PERCENT'>('RATIO');
  const [marginDurationHours, setMarginDurationHours] = useState('8');
  const [marginCurrency, setMarginCurrency] = useState<'TMN' | 'USD'>('TMN');
  const [marginNote, setMarginNote] = useState('');
  const [isSubmittingMargin, setIsSubmittingMargin] = useState(false);

  // -------------------------------------------------------------
  // Wallex API State
  // -------------------------------------------------------------
  const [apiKeyInput, setApiKeyInput] = useState(user?.wallexApi?.apiKey || '');
  const [apiSecretInput, setApiSecretInput] = useState(user?.wallexApi?.apiSecret || '');
  const [showApiSecret, setShowApiSecret] = useState(false);
  const [autoSync, setAutoSync] = useState(user?.wallexApi?.autoSyncEnabled ?? true);
  const [isSyncingApi, setIsSyncingApi] = useState(false);
  const [isSavingApi, setIsSavingApi] = useState(false);

  // -------------------------------------------------------------
  // Price & P&L Alerts State
  // -------------------------------------------------------------
  const [alertSymbol, setAlertSymbol] = useState('TON/TMN');
  const [alertCondition, setAlertCondition] = useState<PriceAlert['condition']>('ABOVE');
  const [alertTargetValue, setAlertTargetValue] = useState('');
  const [alertNote, setAlertNote] = useState('');
  const [phoneNumberInput, setPhoneNumberInput] = useState(user?.phoneNumber || '');

  // -------------------------------------------------------------
  // Trading Journal State
  // -------------------------------------------------------------
  const [journalSymbol, setJournalSymbol] = useState('ICP/TMN');
  const [journalAction, setJournalAction] = useState<TradeJournalEntry['action']>('BUY');
  const [journalPnl, setJournalPnl] = useState('');
  const [journalEmotion, setJournalEmotion] = useState<TradeJournalEntry['emotion']>('LOGICAL');
  const [journalLesson, setJournalLesson] = useState('');
  const [journalTag, setJournalTag] = useState('حمایت/مقاومت');

  // -------------------------------------------------------------
  // Cloud Portfolio Snapshots State
  // -------------------------------------------------------------
  const [portfolioName, setPortfolioName] = useState('');
  const [isSavingPortfolio, setIsSavingPortfolio] = useState(false);

  if (!user) return null;
  if (!embedded && (!isPortalOpen || activeView === 'USER_PANEL')) return null;

  const isFa = lang === 'fa';

  // -------------------------------------------------------------
  // Margin Realtime Live Calculations
  // -------------------------------------------------------------
  const marginPreview = useMemo(() => {
    const entry = parseFloat(marginEntryPrice) || 0;
    const exit = parseFloat(marginExitPrice) || 0;
    const collateral = parseFloat(marginCollateral) || 0;
    const hours = Math.max(0, parseFloat(marginDurationHours) || 0);

    const rawLev = parseFloat(marginLeverageInput) || 1;
    const effectiveLeverage = marginLeverageMode === 'PERCENT'
      ? Math.max(0.01, rawLev / 100)
      : Math.max(0.01, rawLev);

    // 1. Total Volume = Initial Collateral * Leverage Ratio
    const totalVolume = collateral * effectiveLeverage;

    // 2. 4-Hour Periods count
    const fourHourPeriodsCount = Math.max(1, Math.ceil(hours / 4));

    // 3. Exact Fees per user prompt:
    // - 0.015% Activation Fee on total volume
    const activationFee = totalVolume * 0.00015;
    // - 0.015% Position Holding Fee per 4 hours on total volume
    const holdingFee = totalVolume * 0.00015 * fourHourPeriodsCount;
    // - 0.25% Entry Trade Fee on total volume
    const entryFee = totalVolume * 0.0025;
    // - 0.25% Exit Trade Fee on total volume
    const exitFee = totalVolume * 0.0025;
    // Sum of all fees
    const totalFees = activationFee + holdingFee + entryFee + exitFee;

    // 4. Gross P&L
    let grossPnL = 0;
    let priceChangePct = 0;

    if (entry > 0 && exit > 0) {
      if (marginPosType === 'LONG') {
        priceChangePct = ((exit - entry) / entry) * 100;
        grossPnL = totalVolume * ((exit - entry) / entry);
      } else {
        priceChangePct = ((entry - exit) / entry) * 100;
        grossPnL = totalVolume * ((entry - exit) / entry);
      }
    }

    // 5. Net P&L = Gross PnL - Total Fees
    const netPnL = grossPnL - totalFees;
    // Return on Equity % (بازده روی وثیقه اولیه)
    const roePercent = collateral > 0 ? (netPnL / collateral) * 100 : 0;
    const isWin = netPnL > 0;

    return {
      totalVolume,
      fourHourPeriodsCount,
      activationFee,
      holdingFee,
      entryFee,
      exitFee,
      totalFees,
      priceChangePct,
      grossPnL,
      netPnL,
      roePercent,
      isWin,
      hasValidPrices: entry > 0 && exit > 0 && collateral > 0,
    };
  }, [marginEntryPrice, marginExitPrice, marginCollateral, marginLeverageInput, marginLeverageMode, marginDurationHours, marginPosType]);

  // Overall Margin Trades Performance Summary
  const marginSummary = useMemo(() => {
    const list: MarginTrade[] = user.marginTrades || [];
    const totalTrades = list.length;
    const winTrades = list.filter(t => t.isWin || t.netPnL > 0).length;
    const lossTrades = list.filter(t => !t.isWin && t.netPnL <= 0).length;
    const winRate = totalTrades > 0 ? (winTrades / totalTrades) * 100 : 0;

    const totalNetPnL = list.reduce((acc, t) => acc + (t.netPnL || 0), 0);
    const totalGrossPnL = list.reduce((acc, t) => acc + (t.grossPnL || 0), 0);
    const totalFeesPaid = list.reduce((acc, t) => acc + (t.totalFees || 0), 0);
    const totalVolumeTraded = list.reduce((acc, t) => acc + (t.totalVolume || 0), 0);
    const totalCollateralCommitted = list.reduce((acc, t) => acc + (t.initialCollateral || 0), 0);

    const winSum = list.filter(t => t.netPnL > 0).reduce((acc, t) => acc + t.netPnL, 0);
    const lossSum = Math.abs(list.filter(t => t.netPnL < 0).reduce((acc, t) => acc + t.netPnL, 0));
    const profitFactor = lossSum > 0 ? (winSum / lossSum) : winSum > 0 ? winSum : 0;

    return {
      totalTrades,
      winTrades,
      lossTrades,
      winRate,
      totalNetPnL,
      totalGrossPnL,
      totalFeesPaid,
      totalVolumeTraded,
      totalCollateralCommitted,
      profitFactor,
    };
  }, [user.marginTrades]);

  // Add Margin Trade to User Profile
  const handleAddMarginTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    const entry = parseFloat(marginEntryPrice);
    const exit = parseFloat(marginExitPrice);
    const collateral = parseFloat(marginCollateral);
    const hours = parseFloat(marginDurationHours);
    const rawLev = parseFloat(marginLeverageInput);

    if (!entry || entry <= 0 || !exit || exit <= 0 || !collateral || collateral <= 0 || isNaN(hours) || hours < 0 || isNaN(rawLev) || rawLev <= 0) {
      setErrorMsg(isFa ? 'لطفاً مقادیر معتبر برای قیمت ورود، خروج، وثیقه، نسبت اعتبار و ساعت وارد نمایید.' : 'Please enter valid inputs for prices, collateral, leverage, and duration.');
      return;
    }

    const effectiveLeverage = marginLeverageMode === 'PERCENT'
      ? Math.max(0.01, rawLev / 100)
      : Math.max(0.01, rawLev);

    setIsSubmittingMargin(true);
    setErrorMsg(null);

    const newMarginTrade: MarginTrade = {
      id: 'mrg_' + Date.now(),
      symbol: marginSymbol.trim().toUpperCase(),
      positionType: marginPosType,
      entryPrice: entry,
      exitPrice: exit,
      initialCollateral: collateral,
      leverageRatio: effectiveLeverage,
      totalVolume: marginPreview.totalVolume,
      durationHours: hours,
      fourHourPeriodsCount: marginPreview.fourHourPeriodsCount,
      activationFee: marginPreview.activationFee,
      holdingFee: marginPreview.holdingFee,
      entryFee: marginPreview.entryFee,
      exitFee: marginPreview.exitFee,
      totalFees: marginPreview.totalFees,
      grossPnL: marginPreview.grossPnL,
      netPnL: marginPreview.netPnL,
      roePercent: marginPreview.roePercent,
      isWin: marginPreview.isWin,
      date: new Date().toISOString(),
      currency: marginCurrency,
      note: marginNote.trim(),
    };

    const updatedList = [newMarginTrade, ...(user.marginTrades || [])];
    const res = await updateUserProfile({ marginTrades: updatedList });
    setIsSubmittingMargin(false);

    if (res.success) {
      setSuccessMsg(isFa ? 'معامله تعهدی با موفقیت ثبت و کارمزدها و سود/زیان محاسبه گردید.' : 'Margin trade recorded successfully.');
      setMarginEntryPrice('');
      setMarginExitPrice('');
      setMarginNote('');
      setTimeout(() => setSuccessMsg(null), 3500);
    } else {
      setErrorMsg(res.error || 'خطا در ثبت معامله تعهدی.');
    }
  };

  const handleDeleteMarginTrade = async (id: string) => {
    const updated = (user.marginTrades || []).filter(t => t.id !== id);
    await updateUserProfile({ marginTrades: updated });
    setSuccessMsg(isFa ? 'معامله تعهدی حذف شد.' : 'Margin trade removed.');
    setTimeout(() => setSuccessMsg(null), 2500);
  };

  // Wallex API Configuration Handlers
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
      setSuccessMsg(isFa ? 'تنظیمات کلید API والکس ذخیره شد.' : 'Wallex API credentials saved.');
      setTimeout(() => setSuccessMsg(null), 3500);
    } else {
      setErrorMsg(res.error || 'خطا در ذخیره API.');
    }
  };

  const handleTriggerSync = async () => {
    setIsSyncingApi(true);
    setErrorMsg(null);
    const res = await syncWallexApi();
    setIsSyncingApi(false);

    if (res.success) {
      setSuccessMsg(isFa ? 'همگام‌سازی زنده معاملات از حساب والکس با موفقیت انجام شد.' : 'Live Wallex sync completed.');
      setTimeout(() => setSuccessMsg(null), 3500);
    } else {
      setErrorMsg(res.error || 'خطا در برقراری ارتباط با والکس.');
    }
  };

  // Price & P&L Alerts Handlers
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

  // Journal Handlers
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

  // Cloud Portfolio Handlers
  const handleSavePortfolio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portfolioName.trim()) return;

    setIsSavingPortfolio(true);
    setErrorMsg(null);

    const res = await saveCurrentPortfolio(portfolioName, currentTrades, currentSummary);
    setIsSavingPortfolio(false);

    if (res.success) {
      setSuccessMsg(isFa ? 'پورتفوی فعلی با موفقیت در حساب کاربری شما ذخیره شد.' : 'Portfolio snapshot saved.');
      setPortfolioName('');
      setTimeout(() => setSuccessMsg(null), 4000);
    } else {
      setErrorMsg(res.error || 'خطا در ذخیره‌سازی.');
    }
  };

  return (
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
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/25 ring-2 ring-emerald-500/20 text-xl font-black">
              {user.name ? user.name[0].toUpperCase() : user.email[0].toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100">
                  {lang === 'fa' ? 'پنل کاربری اختصاصی والکس' : 'Personal Member Dashboard'}
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

        {/* 5 Quick Feature Tabs with Margin Trades as the Lead Feature */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-2.5 mt-5">
          {/* 1. MARGIN TRADES (معاملات تعهدی) */}
          <button
            type="button"
            onClick={() => setActiveTab('MARGIN_TRADES')}
            className={`p-3 rounded-2xl border text-start transition cursor-pointer col-span-2 sm:col-span-1 ${
              activeTab === 'MARGIN_TRADES'
                ? 'bg-gradient-to-tr from-amber-600 to-orange-500 text-white border-amber-600 shadow-md shadow-orange-500/30'
                : 'bg-white/80 dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700 hover:border-amber-500/50 text-slate-800 dark:text-slate-200'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <Zap className="w-4 h-4" />
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full font-bold ${
                activeTab === 'MARGIN_TRADES' ? 'bg-amber-800 text-white' : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
              }`}>
                WR: {marginSummary.winRate.toFixed(0)}%
              </span>
            </div>
            <div className="text-xs font-black truncate">{isFa ? '۱. معاملات تعهدی' : '1. Margin Trades'}</div>
            <div className={`text-[10px] mt-0.5 truncate font-mono ${activeTab === 'MARGIN_TRADES' ? 'text-amber-100' : 'text-slate-400'}`}>
              {marginSummary.totalTrades} {isFa ? 'معامله ثبت‌شده' : 'trades'}
            </div>
          </button>

          {/* 2. WALLEX API */}
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
            <div className="text-xs font-bold truncate">{isFa ? '۲. اتصال API والکس' : '2. Wallex API'}</div>
            <div className={`text-[10px] mt-0.5 truncate ${activeTab === 'WALLEX_API' ? 'text-indigo-100' : 'text-slate-400'}`}>
              {user.wallexApi?.isConnected ? (isFa ? 'متصل و فعال' : 'Connected') : (isFa ? 'تنظیم کلید' : 'Setup')}
            </div>
          </button>

          {/* 3. ALERTS */}
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

          {/* 4. JOURNAL */}
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

          {/* 5. PORTFOLIOS */}
          <button
            type="button"
            onClick={() => setActiveTab('PORTFOLIOS')}
            className={`p-3 rounded-2xl border text-start transition cursor-pointer ${
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
        {/* Alerts & Notifications */}
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
        {/* TAB 1: MARGIN TRADES (معاملات تعهدی والکس)                 */}
        {/* ======================================================== */}
        {activeTab === 'MARGIN_TRADES' && (
          <div className="space-y-6">
            {/* Overall Margin Performance Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* 1. Total Net P&L */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-white to-slate-50 dark:from-slate-800/90 dark:to-slate-900 border border-slate-200/80 dark:border-slate-700 shadow-xs space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>{isFa ? 'سود/زیان خالص کل تعهدی' : 'Total Margin Net P&L'}</span>
                  {marginSummary.totalNetPnL >= 0 ? (
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-rose-500" />
                  )}
                </div>
                <div className={`text-base sm:text-xl font-mono font-black ${
                  marginSummary.totalNetPnL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}>
                  {marginSummary.totalNetPnL >= 0 ? '+' : ''}{marginSummary.totalNetPnL.toLocaleString()} {isFa ? 'تومان' : 'TMN'}
                </div>
              </div>

              {/* 2. Win Rate */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-white to-slate-50 dark:from-slate-800/90 dark:to-slate-900 border border-slate-200/80 dark:border-slate-700 shadow-xs space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>{isFa ? 'نرخ برد (Win Rate)' : 'Win Rate'}</span>
                  <Target className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-base sm:text-xl font-mono font-black text-amber-600 dark:text-amber-400">
                  {marginSummary.winRate.toFixed(1)}%
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                  <span className="text-emerald-600 font-bold">{marginSummary.winTrades} {isFa ? 'برد' : 'Wins'}</span>
                  <span> / </span>
                  <span className="text-rose-600 font-bold">{marginSummary.lossTrades} {isFa ? 'باخت' : 'Losses'}</span>
                </div>
              </div>

              {/* 3. Total Fees Paid */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-white to-slate-50 dark:from-slate-800/90 dark:to-slate-900 border border-slate-200/80 dark:border-slate-700 shadow-xs space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>{isFa ? 'کل کارمزد و هزینه نگهداری' : 'Total Fees & Overnight'}</span>
                  <Receipt className="w-4 h-4 text-indigo-500" />
                </div>
                <div className="text-base sm:text-lg font-mono font-black text-indigo-600 dark:text-indigo-400">
                  {marginSummary.totalFeesPaid.toLocaleString()} {isFa ? 'تومان' : 'TMN'}
                </div>
              </div>

              {/* 4. Total Volume Traded */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-white to-slate-50 dark:from-slate-800/90 dark:to-slate-900 border border-slate-200/80 dark:border-slate-700 shadow-xs space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>{isFa ? 'حجم کل موقعیت‌ها' : 'Total Positions Volume'}</span>
                  <Award className="w-4 h-4 text-teal-500" />
                </div>
                <div className="text-base sm:text-lg font-mono font-black text-slate-900 dark:text-slate-100">
                  {marginSummary.totalVolumeTraded.toLocaleString()} {isFa ? 'تومان' : 'TMN'}
                </div>
              </div>
            </div>

            {/* FORM: Record New Margin Trade */}
            <div className="p-5 sm:p-6 rounded-3xl border border-amber-500/30 bg-gradient-to-b from-amber-500/5 to-transparent dark:bg-amber-950/20 backdrop-blur-md space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-gradient-to-tr from-amber-600 to-orange-500 text-white shadow-md shadow-orange-500/25">
                    <Calculator className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
                      {isFa ? 'ثبت و محاسبه دقیق معامله تعهدی جدید (Wallex Margin)' : 'Record & Calculate New Margin Trade'}
                    </h3>
                  </div>
                </div>

                {/* LONG / SHORT Toggle */}
                <div className="flex items-center p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setMarginPosType('LONG')}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                      marginPosType === 'LONG'
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <TrendingUp className="w-4 h-4" />
                    <span>{isFa ? 'خرید تعهدی (LONG)' : 'LONG'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMarginPosType('SHORT')}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                      marginPosType === 'SHORT'
                        ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <TrendingDown className="w-4 h-4" />
                    <span>{isFa ? 'فروش تعهدی (SHORT)' : 'SHORT'}</span>
                  </button>
                </div>
              </div>

              {/* Input Fields Grid */}
              <form onSubmit={handleAddMarginTrade} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {/* 1. Symbol */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      {isFa ? 'نماد معامله:' : 'Symbol:'}
                    </label>
                    <input
                      type="text"
                      required
                      value={marginSymbol}
                      onChange={e => setMarginSymbol(e.target.value)}
                      placeholder="BTC/TMN"
                      className="w-full py-2.5 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold uppercase focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  {/* 2. Entry Price */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      {isFa ? '۱. قیمت ورود:' : '1. Entry Price:'}
                    </label>
                    <input
                      type="number"
                      required
                      step="any"
                      value={marginEntryPrice}
                      onChange={e => setMarginEntryPrice(e.target.value)}
                      placeholder="مثلاً 6400000000"
                      className="w-full py-2.5 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  {/* 3. Exit Price */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      {isFa ? '۲. قیمت خروج:' : '2. Exit Price:'}
                    </label>
                    <input
                      type="number"
                      required
                      step="any"
                      value={marginExitPrice}
                      onChange={e => setMarginExitPrice(e.target.value)}
                      placeholder="مثلاً 6650000000"
                      className="w-full py-2.5 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  {/* 4. Initial Collateral */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      {isFa ? '۳. وثیقه اولیه (تومان):' : '3. Initial Collateral:'}
                    </label>
                    <input
                      type="number"
                      required
                      step="any"
                      value={marginCollateral}
                      onChange={e => setMarginCollateral(e.target.value)}
                      placeholder="10000000"
                      className="w-full py-2.5 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  {/* 5. Leverage / Credit Ratio */}
                  <div className="col-span-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      {isFa ? '۴. نسبت اعتبار:' : '4. Credit Ratio:'}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        min="0.01"
                        required
                        value={marginLeverageInput}
                        onChange={e => setMarginLeverageInput(e.target.value)}
                        placeholder="مثلاً 10"
                        className="w-full py-2.5 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold focus:ring-2 focus:ring-amber-500 pe-7"
                      />
                      <span className="absolute top-1/2 -translate-y-1/2 end-2 text-xs font-bold text-slate-400 font-mono">
                        {marginLeverageMode === 'RATIO' ? 'x' : '%'}
                      </span>
                    </div>
                  </div>

                  {/* 6. Duration Hours (Custom Open Number with step="any") */}
                  <div className="col-span-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      {isFa ? '۵. مدت زمان (ساعت):' : '5. Duration (Hours):'}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        required
                        value={marginDurationHours}
                        onChange={e => setMarginDurationHours(e.target.value)}
                        placeholder="مثلاً 8 یا 24"
                        className="w-full py-2.5 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold focus:ring-2 focus:ring-amber-500 pe-8"
                      />
                      <Clock className="w-4 h-4 absolute top-1/2 -translate-y-1/2 end-2.5 text-slate-400" />
                    </div>
                  </div>
                </div>

                {/* LIVE AUTOMATIC CALCULATION BREAKDOWN PREVIEW */}
                <div className="p-4 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-amber-500/40 shadow-xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 dark:border-slate-800 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <span className="text-xs font-black text-slate-900 dark:text-slate-100">
                        {isFa ? 'پیش‌نمایش خودکار محاسبات حجم و کارمزدهای معامله تعهدی:' : 'Live Automatic Fee & P&L Calculation:'}
                      </span>
                    </div>

                    <div className="text-xs font-mono">
                      <span className="font-extrabold text-amber-600 dark:text-amber-400 text-sm">
                        {marginPreview.totalVolume.toLocaleString()} {isFa ? 'تومان' : 'TMN'}
                      </span>
                    </div>
                  </div>

                  {/* Fee Breakdown Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
                    {/* Activation Fee */}
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                      <span className="text-[10px] text-slate-500 block">{isFa ? 'هزینه فعال‌سازی (0.015%):' : 'Activation Fee (0.015%):'}</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {Math.round(marginPreview.activationFee).toLocaleString()} {isFa ? 'تومان' : ''}
                      </span>
                    </div>

                    {/* Holding Fee */}
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                      <span className="text-[10px] text-slate-500 block">
                        {isFa ? `نگهداری (${marginPreview.fourHourPeriodsCount} دوره ۴ ساعته):` : `Holding (${marginPreview.fourHourPeriodsCount}x 4h):`}
                      </span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {Math.round(marginPreview.holdingFee).toLocaleString()} {isFa ? 'تومان' : ''}
                      </span>
                    </div>

                    {/* Entry Trade Fee */}
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                      <span className="text-[10px] text-slate-500 block">{isFa ? 'کارمزد معامله اول (0.25%):' : 'Entry Fee (0.25%):'}</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {Math.round(marginPreview.entryFee).toLocaleString()} {isFa ? 'تومان' : ''}
                      </span>
                    </div>

                    {/* Exit Trade Fee */}
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                      <span className="text-[10px] text-slate-500 block">{isFa ? 'کارمزد معامله دوم (0.25%):' : 'Exit Fee (0.25%):'}</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {Math.round(marginPreview.exitFee).toLocaleString()} {isFa ? 'تومان' : ''}
                      </span>
                    </div>

                    {/* Total All Fees */}
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 col-span-2 sm:col-span-1">
                      <span className="text-[10px] text-amber-800 dark:text-amber-300 font-bold block">{isFa ? 'مجموع کل کارمزدها:' : 'Total Fees:'}</span>
                      <span className="font-mono font-black text-amber-700 dark:text-amber-300">
                        {Math.round(marginPreview.totalFees).toLocaleString()} {isFa ? 'تومان' : ''}
                      </span>
                    </div>
                  </div>

                  {/* Net P&L & ROE Result Strip */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-200/60 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="text-xs">
                        <span className="text-slate-500">{isFa ? 'تغییر قیمت مارکت: ' : 'Price Change: '}</span>
                        <span className={`font-mono font-bold ${marginPreview.priceChangePct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {marginPreview.priceChangePct >= 0 ? '+' : ''}{marginPreview.priceChangePct.toFixed(2)}%
                        </span>
                      </div>

                      <div className="text-xs">
                        <span className="text-slate-500">{isFa ? 'سود/زیان ناخالص: ' : 'Gross P&L: '}</span>
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                          {Math.round(marginPreview.grossPnL).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-xs">
                        <span className="text-slate-500 font-bold">{isFa ? 'سود/زیان خالص پس از کسر کارمزد: ' : 'Net P&L: '}</span>
                        <span className={`font-mono text-sm sm:text-base font-black ${
                          marginPreview.netPnL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                        }`}>
                          {marginPreview.netPnL >= 0 ? '+' : ''}{Math.round(marginPreview.netPnL).toLocaleString()} {isFa ? 'تومان' : 'TMN'}
                        </span>
                      </div>

                      <div className={`px-2.5 py-1 rounded-xl text-xs font-mono font-black ${
                        marginPreview.roePercent >= 0 ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' : 'bg-rose-500/20 text-rose-700 dark:text-rose-300'
                      }`}>
                        ROE: {marginPreview.roePercent >= 0 ? '+' : ''}{marginPreview.roePercent.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* Optional Note & Submit Button */}
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <input
                    type="text"
                    value={marginNote}
                    onChange={e => setMarginNote(e.target.value)}
                    placeholder={isFa ? 'یادداشت دلخواه برای این معامله تعهدی (اختیاری: دلیل ورود، شکست خط مقاومت...)' : 'Trade note / strategy reason'}
                    className="w-full flex-1 py-2.5 px-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs"
                  />

                  <button
                    type="submit"
                    disabled={isSubmittingMargin || !marginPreview.hasValidPrices}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs shadow-md shadow-orange-500/25 active:scale-95 transition cursor-pointer disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isSubmittingMargin ? (isFa ? 'در حال ثبت...' : 'Saving...') : (isFa ? 'ثبت در تاریخچه معاملات تعهدی' : 'Record Margin Trade')}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* LIST OF RECORDED MARGIN TRADES */}
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-600" />
                  <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-slate-100">
                    {isFa ? 'تاریخچه معاملات تعهدی ثبت‌شده شما' : 'Your Recorded Margin Trades History'}
                  </h4>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold">
                    {user.marginTrades?.length || 0}
                  </span>
                </div>
              </div>

              {(!user.marginTrades || user.marginTrades.length === 0) ? (
                <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-500 text-xs">
                  {isFa ? 'هنوز هیچ معامله تعهدی ثبت نشده است. از فرم بالا برای ثبت اولین معامله تعهدی خود استفاده فرمایید.' : 'No margin trades recorded yet.'}
                </div>
              ) : (
                <div className="space-y-3">
                  {user.marginTrades.map((t: MarginTrade) => (
                    <div
                      key={t.id}
                      className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/85 dark:bg-slate-800/60 backdrop-blur-md shadow-xs space-y-3 hover:border-amber-500/40 transition"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className={`px-2.5 py-1 rounded-xl text-xs font-black flex items-center gap-1 ${
                            t.positionType === 'LONG' 
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30' 
                              : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                          }`}>
                            {t.positionType === 'LONG' ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                            <span>{t.positionType}</span>
                          </span>

                          <span className="font-mono font-extrabold text-sm text-slate-900 dark:text-slate-100">
                            {t.symbol}
                          </span>

                          <span className="px-2 py-0.5 rounded-lg text-xs font-bold font-mono bg-amber-500/15 text-amber-700 dark:text-amber-300">
                            {t.leverageRatio}x اهرم
                          </span>

                          <span className="text-[11px] text-slate-400 font-mono">
                            {new Date(t.date).toLocaleDateString(isFa ? 'fa-IR' : 'en-US')}
                          </span>
                        </div>

                        {/* Net Result and Delete */}
                        <div className="flex items-center gap-3">
                          <div className="text-end">
                            <span className={`text-sm sm:text-base font-mono font-black ${
                              t.netPnL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                            }`}>
                              {t.netPnL >= 0 ? '+' : ''}{Math.round(t.netPnL).toLocaleString()} {isFa ? 'تومان' : 'TMN'}
                            </span>
                            <span className={`block text-[10px] font-mono font-bold ${
                              t.roePercent >= 0 ? 'text-emerald-600' : 'text-rose-600'
                            }`}>
                              ROE: {t.roePercent >= 0 ? '+' : ''}{t.roePercent.toFixed(1)}%
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeleteMarginTrade(t.id)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition cursor-pointer"
                            title={isFa ? 'حذف معامله' : 'Delete'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Detail Metrics Strip */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs pt-2 border-t border-slate-100 dark:border-slate-700/60">
                        <div>
                          <span className="text-[10px] text-slate-400 block">{isFa ? 'قیمت ورود:' : 'Entry:'}</span>
                          <span className="font-mono font-bold">{t.entryPrice.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">{isFa ? 'قیمت خروج:' : 'Exit:'}</span>
                          <span className="font-mono font-bold">{t.exitPrice.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">{isFa ? 'وثیقه اولیه:' : 'Collateral:'}</span>
                          <span className="font-mono font-bold">{t.initialCollateral.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">{isFa ? 'حجم کل موقعیت:' : 'Total Volume:'}</span>
                          <span className="font-mono font-bold text-amber-600">{t.totalVolume.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">
                            {isFa ? `کل کارمزد (${t.durationHours}ساعت):` : `Fees (${t.durationHours}h):`}
                          </span>
                          <span className="font-mono font-bold text-rose-500">
                            {Math.round(t.totalFees).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {t.note && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/60 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                          {t.note}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: WALLEX DIRECT API SYNC                            */}
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
        {/* TAB 3: PRICE & P&L ALERTS                                */}
        {/* ======================================================== */}
        {activeTab === 'ALERTS' && (
          <div className="space-y-6">
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
                <Bell className="w-3.5 h-3.5 text-cyan-600" />
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
                <Brain className="w-3.5 h-3.5 text-purple-600" />
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
                          <Trash2 className="w-3.5 h-3.5" />
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
            <div className="p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-800/40 backdrop-blur-md space-y-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <FolderPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-100">
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
                              closePortal();
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
};
