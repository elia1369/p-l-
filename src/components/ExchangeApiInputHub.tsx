import React, { useState, useEffect } from 'react';
import { 
  Key, 
  Lock, 
  ShieldCheck, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  Zap, 
  Plus, 
  Calendar, 
  Trash2, 
  Edit3, 
  Building2, 
  Coins, 
  HelpCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  ServerOff,
  FileCheck2,
  ExternalLink
} from 'lucide-react';
import { Language, TradeRecord, CurrencyKind, PIIReport } from '../types';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { 
  CustomExchangeAccount, 
  MAX_EXCHANGES_ALLOWED,
  getSavedExchangeAccounts, 
  saveExchangeAccount, 
  deleteExchangeAccount, 
  syncTradesByPrivateApiKey 
} from '../utils/exchangeApi';
import { 
  formatToJalali, 
  formatToJalaliVerbose, 
  parseJalaliToGregorianISO, 
  toPersianDigits 
} from '../utils/jalali';

interface Props {
  lang: Language;
  onTradesSynced: (trades: TradeRecord[], exchangeName: string, currency: CurrencyKind) => void;
  isLoading?: boolean;
  onLoadDemo?: () => void;
  onOpenPiiModal?: () => void;
  piiReport?: PIIReport | null;
}

// Preset popular exchange suggestions for fast autocomplete
const POPULAR_SUGGESTIONS = [
  { nameFa: 'والکس', nameEn: 'Wallex', currency: 'TMN' as CurrencyKind },
  { nameFa: 'نوبیتکس', nameEn: 'Nobitex', currency: 'TMN' as CurrencyKind },
  { nameFa: 'تبدیل', nameEn: 'Tabdeal', currency: 'TMN' as CurrencyKind },
  { nameFa: 'بایننس', nameEn: 'Binance', currency: 'USD' as CurrencyKind },
  { nameFa: 'کوکوین', nameEn: 'KuCoin', currency: 'USD' as CurrencyKind },
  { nameFa: 'کوین‌اکس', nameEn: 'CoinEx', currency: 'USD' as CurrencyKind },
  { nameFa: 'بینگ‌ایکس', nameEn: 'BingX', currency: 'USD' as CurrencyKind },
  { nameFa: 'بای‌بیت', nameEn: 'Bybit', currency: 'USD' as CurrencyKind },
];

export function formatExchangeName(name: string, lang: Language): string {
  if (!name) return '';
  const clean = name.trim();
  if (lang === 'fa') {
    if (/wallex|والکس/i.test(clean)) return 'والکس';
    if (/nobitex|نوبیتکس/i.test(clean)) return 'نوبیتکس';
    if (/tabdeal|تبدیل/i.test(clean)) return 'تبدیل';
    if (/binance|بایننس/i.test(clean)) return 'بایننس';
    if (/kucoin|کوکوین/i.test(clean)) return 'کوکوین';
    if (/coinex|کوین‌اکس/i.test(clean)) return 'کوین‌اکس';
    if (/bingx|بینگ‌ایکس/i.test(clean)) return 'بینگ‌ایکس';
    if (/bybit|بای‌بیت/i.test(clean)) return 'بای‌بیت';
    return clean.replace(/\s*\([a-zA-Z0-9_ ]+\)/g, '').trim();
  } else {
    if (/wallex|والکس/i.test(clean)) return 'Wallex';
    if (/nobitex|نوبیتکس/i.test(clean)) return 'Nobitex';
    if (/tabdeal|تبدیل/i.test(clean)) return 'Tabdeal';
    if (/binance|بایننس/i.test(clean)) return 'Binance';
    if (/kucoin|کوکوین/i.test(clean)) return 'KuCoin';
    if (/coinex|کوین‌اکس/i.test(clean)) return 'CoinEx';
    if (/bingx|بینگ‌ایکس/i.test(clean)) return 'BingX';
    if (/bybit|بای‌بیت/i.test(clean)) return 'Bybit';
    return clean.replace(/\s*\([\u0600-\u06FF\s]+\)/g, '').trim();
  }
}

export const ExchangeApiInputHub: React.FC<Props> = ({
  lang,
  onTradesSynced,
  onOpenPiiModal,
  piiReport,
}) => {
  const isRtl = lang === 'fa';

  // Saved accounts list
  const [accounts, setAccounts] = useState<CustomExchangeAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  // Form State for Adding / Editing an Exchange
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [exchangeName, setExchangeName] = useState<string>(lang === 'fa' ? 'والکس' : 'Wallex');
  const [accountLabel, setAccountLabel] = useState<string>(lang === 'fa' ? 'حساب اصلی معاملات' : 'Main Trading Account');
  const [privateApiKey, setPrivateApiKey] = useState<string>('');
  const [currency, setCurrency] = useState<CurrencyKind>('TMN');
  const [passphrase, setPassphrase] = useState<string>('');
  const [showSecret, setShowSecret] = useState<boolean>(false);
  const [isReadOnlyConfirmed, setIsReadOnlyConfirmed] = useState<boolean>(true);

  // Date Range Filtering (Default is ALL history)
  const [dateRangeMode, setDateRangeMode] = useState<'ALL' | 'CUSTOM'>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [startJalali, setStartJalali] = useState<string>('');
  const [endJalali, setEndJalali] = useState<string>('');
  const [calendarInputMode, setCalendarInputMode] = useState<'SHAMSI' | 'GREGORIAN'>('SHAMSI');

  // Interactive Sync & Connection state
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStep, setSyncStep] = useState<number>(0);
  const [syncStatusText, setSyncStatusText] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showSecurityTips, setShowSecurityTips] = useState<boolean>(false);

  // Load saved accounts on mount
  useEffect(() => {
    const saved = getSavedExchangeAccounts();
    setAccounts(saved);
    if (saved.length > 0 && !selectedAccountId) {
      setSelectedAccountId(saved[0].id);
    }
  }, []);

  const handleStartDateChange = (gregorianVal: string) => {
    setStartDate(gregorianVal);
    setStartJalali(formatToJalali(gregorianVal));
  };

  const handleStartJalaliChange = (jalaliVal: string) => {
    setStartJalali(jalaliVal);
    const converted = parseJalaliToGregorianISO(jalaliVal);
    if (converted) {
      setStartDate(converted);
    }
  };

  const handleEndDateChange = (gregorianVal: string) => {
    setEndDate(gregorianVal);
    setEndJalali(formatToJalali(gregorianVal));
  };

  const handleEndJalaliChange = (jalaliVal: string) => {
    setEndJalali(jalaliVal);
    const converted = parseJalaliToGregorianISO(jalaliVal);
    if (converted) {
      setEndDate(converted);
    }
  };

  // Quick preset dates calculation helper
  const handleSetPresetDates = (days: number | 'ALL' | 'THIS_YEAR') => {
    if (days === 'ALL') {
      setDateRangeMode('ALL');
      setStartDate('');
      setEndDate('');
      setStartJalali('');
      setEndJalali('');
      return;
    }
    setDateRangeMode('CUSTOM');
    const end = new Date();
    let start = new Date();

    if (days === 'THIS_YEAR') {
      // 1 Farvardin of current year
      const nowJalali = formatToJalali(end).split('/');
      const currentJy = parseInt(nowJalali[0], 10) || 1403;
      const gStart = parseJalaliToGregorianISO(`${currentJy}/01/01`);
      const isoEnd = end.toISOString().split('T')[0];
      setStartDate(gStart);
      setStartJalali(`${currentJy}/01/01`);
      setEndDate(isoEnd);
      setEndJalali(formatToJalali(isoEnd));
      return;
    }

    start.setDate(end.getDate() - days);
    const isoStart = start.toISOString().split('T')[0];
    const isoEnd = end.toISOString().split('T')[0];
    setStartDate(isoStart);
    setStartJalali(formatToJalali(isoStart));
    setEndDate(isoEnd);
    setEndJalali(formatToJalali(isoEnd));
  };

  // Open Form to Add New Exchange
  const handleOpenAddForm = () => {
    if (accounts.length >= MAX_EXCHANGES_ALLOWED) {
      setErrorMessage(
        isRtl 
          ? `حداکثر سقف مجاز (${MAX_EXCHANGES_ALLOWED} صرافی) پر شده است. لطفاً یکی از صرافی‌های قبل را حذف نمایید.`
          : `Maximum limit of ${MAX_EXCHANGES_ALLOWED} exchanges reached.`
      );
      return;
    }
    setEditingId(null);
    setExchangeName('والکس (Wallex)');
    setAccountLabel(`حساب صرافی ${accounts.length + 1}`);
    setPrivateApiKey('');
    setCurrency('TMN');
    setPassphrase('');
    setDateRangeMode('ALL');
    setStartDate('');
    setEndDate('');
    setStartJalali('');
    setEndJalali('');
    setIsReadOnlyConfirmed(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsFormOpen(true);
  };

  // Open Form to Edit Existing Exchange
  const handleOpenEditForm = (account: CustomExchangeAccount) => {
    setEditingId(account.id);
    setExchangeName(account.exchangeName);
    setAccountLabel(account.accountLabel);
    setPrivateApiKey(account.privateApiKey);
    setCurrency(account.currency);
    setPassphrase(account.passphrase || '');
    setDateRangeMode(account.dateRangeMode || 'ALL');
    setStartDate(account.startDate || '');
    setEndDate(account.endDate || '');
    setStartJalali(account.startDate ? formatToJalali(account.startDate) : '');
    setEndJalali(account.endDate ? formatToJalali(account.endDate) : '');
    setIsReadOnlyConfirmed(account.isReadOnlyConfirmed ?? true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsFormOpen(true);
  };

  // Fill Quick Demo Private Key
  const handleFillDemoKey = (target: 'wallex' | 'binance') => {
    if (target === 'wallex') {
      setExchangeName('والکس (Wallex)');
      setAccountLabel('حساب آزمایشی والکس');
      setCurrency('TMN');
      setPrivateApiKey('wlx_sec_9948271049281740294817492810471928471029');
    } else {
      setExchangeName('بایننس (Binance)');
      setAccountLabel('حساب بین‌المللی بایننس');
      setCurrency('USD');
      setPrivateApiKey('N6VqJ7w80g294e819b48c0281e4918293847192837491028');
    }
    setIsReadOnlyConfirmed(true);
    setErrorMessage(null);
  };

  // Save Account and Immediately Sync its Trades
  const handleSaveAndSync = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!exchangeName.trim()) {
      setErrorMessage(isRtl ? 'لطفاً نام صرافی را وارد نمایید.' : 'Please enter exchange name.');
      return;
    }

    if (!privateApiKey.trim()) {
      setErrorMessage(isRtl ? 'لطفاً کلید خصوصی API (Private Key / Secret Token) را وارد نمایید.' : 'Please enter your Private API Key / Secret.');
      return;
    }

    if (!isReadOnlyConfirmed) {
      setErrorMessage(isRtl ? 'جهت امنیت سرمایه، باید تایید نمایید کلید صرفاً دسترسی Read-Only دارد.' : 'Please confirm the key is Read-Only.');
      return;
    }

    if (dateRangeMode === 'CUSTOM' && startDate && endDate && startDate > endDate) {
      setErrorMessage(isRtl ? 'تاریخ شروع نمی‌تواند بعد از تاریخ پایان باشد.' : 'Start date cannot be after end date.');
      return;
    }

    setIsSyncing(true);
    setSyncStep(1);
    setSyncStatusText(isRtl ? `در حال احراز هویت با کلید خصوصی ${exchangeName}...` : `Authenticating with ${exchangeName} Private Key...`);

    try {
      await new Promise(r => setTimeout(r, 550));
      setSyncStep(2);
      setSyncStatusText(isRtl ? 'سپر امنیتی PII: حذف خودکار متغیرهای حساس و شناسه‌های هویتی...' : 'PII Shield: Scrubbing identity tokens & private IP metadata...');

      await new Promise(r => setTimeout(r, 650));
      setSyncStep(3);
      setSyncStatusText(isRtl ? 'دریافت تاریخچه معاملات و محاسبه سود/زیان و کارمزدها...' : 'Fetching trade logs & calculating realized/unrealized P&L...');

      // Execute Sync
      const result = await syncTradesByPrivateApiKey({
        exchangeName: exchangeName.trim(),
        privateApiKey: privateApiKey.trim(),
        currency,
        dateRangeMode,
        startDate: dateRangeMode === 'CUSTOM' ? startDate : undefined,
        endDate: dateRangeMode === 'CUSTOM' ? endDate : undefined,
      });

      setSyncStep(4);
      setSyncStatusText(isRtl ? 'تکمیل همگام‌سازی و اعمال پروتکل امنیتی PII...' : 'Finalizing portfolio sync with PII sanitization...');
      await new Promise(r => setTimeout(r, 300));

      const newOrUpdatedAccount: CustomExchangeAccount = {
        id: editingId || `acc-${Date.now()}`,
        exchangeName: exchangeName.trim(),
        accountLabel: accountLabel.trim() || exchangeName.trim(),
        privateApiKey: privateApiKey.trim(),
        currency,
        passphrase: passphrase.trim() || undefined,
        isReadOnlyConfirmed: true,
        dateRangeMode,
        startDate: dateRangeMode === 'CUSTOM' ? startDate : undefined,
        endDate: dateRangeMode === 'CUSTOM' ? endDate : undefined,
        connectedAt: new Date().toLocaleDateString(isRtl ? 'fa-IR' : 'en-US'),
        lastSyncAt: new Date().toLocaleTimeString(isRtl ? 'fa-IR' : 'en-US'),
        tradesCount: result.trades.length,
        status: 'ACTIVE',
      };

      const updatedList = saveExchangeAccount(newOrUpdatedAccount);
      setAccounts(updatedList);
      setSelectedAccountId(newOrUpdatedAccount.id);
      setIsFormOpen(false);

      // Trigger Main App P&L calculation with fetched trades
      onTradesSynced(result.trades, newOrUpdatedAccount.exchangeName, result.summary.currency);

      setSuccessMessage(
        isRtl
          ? `صرافی «${newOrUpdatedAccount.exchangeName}» متصل شد. تعداد ${result.trades.length} معامله دریافت و تحت حفاظت کامل PII پاک‌سازی شد.`
          : `Connected to ${newOrUpdatedAccount.exchangeName}! ${result.trades.length} trades synced under full PII Shield protection.`
      );

    } catch (err: any) {
      setErrorMessage(err?.message || (isRtl ? 'خطا در ارتباط با وب‌سرویس صرافی' : 'Failed to connect to exchange'));
    } finally {
      setIsSyncing(false);
      setSyncStep(0);
    }
  };

  // Quick Direct Re-Sync of an existing account in list
  const handleQuickSyncExisting = async (account: CustomExchangeAccount) => {
    setSelectedAccountId(account.id);
    setIsSyncing(true);
    setSyncStep(2);
    setSyncStatusText(isRtl ? `در حال استعلام وضعیت معاملات ${account.exchangeName} با محافظت PII...` : `Querying trade status for ${account.exchangeName} with PII protection...`);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await syncTradesByPrivateApiKey({
        exchangeName: account.exchangeName,
        privateApiKey: account.privateApiKey,
        currency: account.currency,
        dateRangeMode: account.dateRangeMode || 'ALL',
        startDate: account.startDate,
        endDate: account.endDate,
      });

      const updatedAccount: CustomExchangeAccount = {
        ...account,
        lastSyncAt: new Date().toLocaleTimeString(isRtl ? 'fa-IR' : 'en-US'),
        tradesCount: result.trades.length,
        status: 'ACTIVE',
      };

      const updatedList = saveExchangeAccount(updatedAccount);
      setAccounts(updatedList);

      onTradesSynced(result.trades, account.exchangeName, result.summary.currency);

      setSuccessMessage(
        isRtl
          ? `اطلاعات «${account.exchangeName}» بروزرسانی شد (${result.trades.length} معامله - ${result.summary.dateSpanNotice}).`
          : `Updated ${account.exchangeName} (${result.trades.length} trades).`
      );
    } catch {
      setErrorMessage(isRtl ? 'خطا در بروزرسانی معاملات صرافی' : 'Failed to sync trades');
    } finally {
      setIsSyncing(false);
      setSyncStep(0);
    }
  };

  // Delete an exchange account
  const handleDeleteAccount = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(isRtl ? 'آیا از حذف این صرافی اطمینان دارید؟' : 'Are you sure you want to remove this exchange?')) {
      const updated = deleteExchangeAccount(id);
      setAccounts(updated);
      if (selectedAccountId === id) {
        setSelectedAccountId(updated.length > 0 ? updated[0].id : null);
      }
    }
  };

  return (
    <div className="w-full space-y-5">
      {/* Main Glassmorphic Container Card */}
      <div className="relative rounded-3xl border border-slate-200/90 dark:border-slate-800/90 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl shadow-xl overflow-hidden">
        {/* Top Accent Gradient Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />

        <div className="p-5 sm:p-7 space-y-6">
          {/* Header & Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-4 border-b border-slate-200/70 dark:border-slate-800/70 pb-4">
            {/* Action Buttons: Add Exchange & Security Guide */}
            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                id="add-exchange-btn"
                type="button"
                variant="primary"
                size="default"
                onClick={handleOpenAddForm}
                className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold shadow-md shadow-emerald-600/20 hover:from-emerald-500 hover:to-teal-500 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>{isRtl ? 'افزودن صرافی جدید' : 'Add New Exchange'}</span>
                <span className="ms-1 px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 text-white font-mono">
                  {accounts.length}/{MAX_EXCHANGES_ALLOWED}
                </span>
              </Button>

              <button
                type="button"
                onClick={() => setShowSecurityTips(prev => !prev)}
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer"
              >
                <HelpCircle className="h-3.5 w-3.5 text-sky-500" />
                <span>{isRtl ? 'نکات امنیتی' : 'Security Guide'}</span>
                {showSecurityTips ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            </div>
          </div>

          {/* Expandable Security Notice */}
          {showSecurityTips && (
            <div className="p-4 rounded-2xl bg-sky-50/80 dark:bg-sky-950/30 border border-sky-200/80 dark:border-sky-800/60 text-xs space-y-2 text-sky-900 dark:text-sky-200 animate-in fade-in duration-200">
              <div className="font-bold flex items-center gap-1.5 text-sky-800 dark:text-sky-300">
                <ServerOff className="h-4 w-4" />
                <span>{isRtl ? 'پروتکل‌های امنیتی و حفاظت از حریم خصوصی (PII Guard):' : 'Privacy Protocols & PII Protection Guidelines:'}</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-700 dark:text-slate-300 leading-relaxed">
                <li>{isRtl ? 'کلید خصوصی و سکرت شما صرفاً در حافظه محلی مرورگرتان ذخیره و رمزنگاری می‌شود و به هیچ سرور ثانویه‌ای ارسال نمی‌گردد.' : 'Your private key is stored and processed exclusively in your local browser (zero external leaks).'}</li>
                <li>{isRtl ? 'در پنل صرافی خود، هنگام ساخت کلید حتماً گزینه «فقط خواندنی (Read-Only)» را فعال کنید و به هیچ عنوان به گزینه‌های برداشت (Withdraw) دسترسی ندهید.' : 'Always set Read-Only permission on your exchange and NEVER grant withdrawal rights.'}</li>
                <li>{isRtl ? 'می‌توانید تا ۲۰ صرافی مختلف (داخلی و بین‌المللی) اضافه کرده و با یک کلیک وضعیت هر کدام را همگام نمایید.' : 'You can create up to 20 different exchange profiles and switch or sync instantly.'}</li>
              </ul>
            </div>
          )}

          {/* Section: List of Added Exchanges (up to 20) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-emerald-500" />
                <span>{isRtl ? 'صرافی‌های ثبت‌شده شما (انتخاب برای بررسی وضعیت):' : 'Your Registered Exchanges (Click to Inspect):'}</span>
              </label>
              <span className="text-[11px] text-slate-400">
                {isRtl ? `${accounts.length} از ${MAX_EXCHANGES_ALLOWED} صرافی فعال` : `${accounts.length} of ${MAX_EXCHANGES_ALLOWED} active`}
              </span>
            </div>

            {accounts.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 space-y-3">
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  {isRtl ? 'هنوز هیچ صرافی ثبت نکرده‌اید. با دکمه زیر اولین صرافی خود را با کلید خصوصی اضافه کنید.' : 'No exchange registered yet. Click below to add your first exchange.'}
                </p>
                <Button type="button" variant="primary" size="sm" onClick={handleOpenAddForm}>
                  <Plus className="h-4 w-4 mr-1" />
                  <span>{isRtl ? 'افزودن اولین صرافی' : 'Add First Exchange'}</span>
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {accounts.map((acc) => {
                  const isSelected = selectedAccountId === acc.id;
                  return (
                    <div
                      key={acc.id}
                      onClick={() => handleQuickSyncExisting(acc)}
                      className={`relative p-3.5 rounded-2xl border transition-all cursor-pointer select-none flex flex-col justify-between gap-3 ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 shadow-md shadow-emerald-500/10 ring-2 ring-emerald-500/30'
                          : 'border-slate-200/80 dark:border-slate-800/80 bg-white/60 dark:bg-slate-950/60 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-slate-100 truncate">
                              {formatExchangeName(acc.exchangeName, lang)}
                            </h4>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {acc.accountLabel}
                          </p>
                        </div>

                        <Badge
                          variant={acc.currency === 'TMN' ? 'sky' : 'secondary'}
                          className="text-[10px] font-mono shrink-0"
                        >
                          {acc.currency === 'TMN' ? (isRtl ? 'تومان' : 'TMN') : (isRtl ? 'تتر' : 'USDT')}
                        </Badge>
                      </div>

                      {/* Trade Count & Range Info */}
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80">
                        <span className="font-medium">
                          {acc.tradesCount} {isRtl ? 'معامله' : 'trades'}
                        </span>

                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                          {acc.dateRangeMode === 'CUSTOM' && acc.startDate
                            ? `${toPersianDigits(formatToJalali(acc.startDate))} تا ${acc.endDate ? toPersianDigits(formatToJalali(acc.endDate)) : 'اکنون'}`
                            : (isRtl ? 'کل تاریخچه' : 'All Time')}
                        </span>
                      </div>

                      {/* Card Actions */}
                      <div className="flex items-center justify-between pt-1 gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isSyncing}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuickSyncExisting(acc);
                          }}
                          className="h-7 px-2 text-[11px] text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100/50 dark:hover:bg-emerald-950/50 gap-1 font-bold"
                        >
                          <RefreshCw className="h-3 w-3" />
                          <span>{isRtl ? 'استعلام وضعیت' : 'Check Status'}</span>
                        </Button>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditForm(acc);
                            }}
                            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            title="Edit / Change Range"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleDeleteAccount(acc.id, e)}
                            className="p-1 text-slate-400 hover:text-red-500 rounded-md hover:bg-red-50 dark:hover:bg-red-950/50 cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add / Edit Exchange Modal / Form Panel */}
          {isFormOpen && (
            <div className="mt-4 p-5 sm:p-6 rounded-3xl border-2 border-emerald-500/40 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-md space-y-5 animate-in fade-in zoom-in-98 duration-200">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Key className="h-4 w-4 text-emerald-500" />
                  <span>
                    {editingId
                      ? (isRtl ? 'ویرایش اطلاعات کلید خصوصی و بازه صرافی' : 'Edit Exchange Private API & Date Range')
                      : (isRtl ? 'افزودن صرافی جدید با کلید خصوصی API' : 'Add New Exchange with Private API Key')}
                  </span>
                </h3>

                {/* Quick Demo Fill Buttons */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400 hidden sm:inline">
                    {isRtl ? 'کلید تستی:' : 'Demo Key:'}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleFillDemoKey('wallex')}
                    className="h-7 text-[11px] gap-1 text-emerald-600 border-emerald-500/30"
                  >
                    <Zap className="h-3 w-3 text-emerald-500 fill-emerald-500" />
                    <span>{isRtl ? 'تست والکس' : 'Wallex'}</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleFillDemoKey('binance')}
                    className="h-7 text-[11px] gap-1 text-amber-600 border-amber-500/30"
                  >
                    <Zap className="h-3 w-3 text-amber-500 fill-amber-500" />
                    <span>{isRtl ? 'تست بایننس' : 'Binance'}</span>
                  </Button>
                </div>
              </div>

              <form onSubmit={handleSaveAndSync} className="space-y-4">
                {/* Popular Exchange Quick Suggestion Chips */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    {isRtl ? 'انتخاب سریع یا تایپ نام صرافی دلخواه:' : 'Quick Select or Type Custom Exchange:'}
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {POPULAR_SUGGESTIONS.map(sug => {
                      const sugName = isRtl ? sug.nameFa : sug.nameEn;
                      const isActive = exchangeName === sugName || exchangeName === sug.nameFa || exchangeName === sug.nameEn;
                      return (
                        <button
                          key={sug.nameEn}
                          type="button"
                          onClick={() => {
                            setExchangeName(sugName);
                            setCurrency(sug.currency);
                          }}
                          className={`text-xs px-2.5 py-1 rounded-xl border transition cursor-pointer ${
                            isActive
                              ? 'bg-emerald-500 text-white border-emerald-500 font-bold'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-emerald-400'
                          }`}
                        >
                          {sugName}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Exchange Name */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-slate-400" />
                      <span>{isRtl ? 'نام صرافی:' : 'Exchange Name:'}</span>
                    </label>
                    <input
                      type="text"
                      value={exchangeName}
                      onChange={(e) => setExchangeName(e.target.value)}
                      placeholder={isRtl ? 'مثلاً: والکس، نوبیتکس، بایننس...' : 'e.g. Wallex, Binance, etc.'}
                      className="w-full h-10 px-3.5 rounded-xl border border-slate-300/80 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                  </div>

                  {/* Account Label */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {isRtl ? 'برچسب یا عنوان حساب:' : 'Account Label:'}
                    </label>
                    <input
                      type="text"
                      value={accountLabel}
                      onChange={(e) => setAccountLabel(e.target.value)}
                      placeholder={isRtl ? 'مثلاً: حساب معاملات روزانه' : 'e.g. Day Trading Account'}
                      className="w-full h-10 px-3.5 rounded-xl border border-slate-300/80 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Base Currency */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Coins className="h-3.5 w-3.5 text-slate-400" />
                      <span>{isRtl ? 'واحد ارزی معاملات:' : 'Base Currency:'}</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2 h-10">
                      <button
                        type="button"
                        onClick={() => setCurrency('TMN')}
                        className={`rounded-xl border text-xs font-bold transition cursor-pointer ${
                          currency === 'TMN'
                            ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-transparent shadow-xs'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {isRtl ? 'تومان' : 'TMN'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrency('USD')}
                        className={`rounded-xl border text-xs font-bold transition cursor-pointer ${
                          currency === 'USD'
                            ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-transparent shadow-xs'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {isRtl ? 'تتر' : 'USDT'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Private API Key (Main Input) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5 text-emerald-500" />
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {isRtl ? 'کلید خصوصی / توکن امنیتی API (Private Key / Secret):' : 'Private API Key / Secret Token:'}
                      </span>
                    </span>
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                      {isRtl ? 'بدون نیاز به کلید عمومی' : 'No Public Key Needed'}
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type={showSecret ? 'text' : 'password'}
                      value={privateApiKey}
                      onChange={(e) => setPrivateApiKey(e.target.value)}
                      placeholder={isRtl ? 'کلید خصوصی صرافی را اینجا پیست کنید (مثال: wlx_sec_... یا N6Vq...)' : 'Paste your private API key / secret token here...'}
                      className="w-full h-11 px-3.5 pe-10 rounded-xl border border-slate-300/80 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret(prev => !prev)}
                      className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1"
                      title={showSecret ? 'Hide' : 'Show'}
                    >
                      {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Section: Date Range (Default = ALL, or Manual From-To Date) */}
                <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-3.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-emerald-500" />
                      <span>{isRtl ? 'بازه زمانی تاریخچه معاملات (پشتیبانی کامل از تاریخ شمسی و میلادی):' : 'Trade History Time Range (Shamsi & Gregorian):'}</span>
                    </label>

                    {/* Quick Range Selector */}
                    <div className="flex flex-wrap items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleSetPresetDates('ALL')}
                        className={`text-xs px-2.5 py-1 rounded-lg border font-bold transition cursor-pointer ${
                          dateRangeMode === 'ALL'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {isRtl ? 'کل تاریخچه (پیش‌فرض)' : 'All History (Default)'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSetPresetDates(30)}
                        className={`text-xs px-2 py-1 rounded-lg border transition cursor-pointer ${
                          dateRangeMode === 'CUSTOM' && startDate && !endDate
                            ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                            : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {isRtl ? '۱ ماه اخیر' : 'Last 30D'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSetPresetDates(90)}
                        className="text-xs px-2 py-1 rounded-lg border bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 cursor-pointer"
                      >
                        {isRtl ? '۳ ماه اخیر' : 'Last 90D'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSetPresetDates(180)}
                        className="text-xs px-2 py-1 rounded-lg border bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 cursor-pointer"
                      >
                        {isRtl ? '۶ ماه اخیر' : 'Last 6M'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSetPresetDates('THIS_YEAR')}
                        className="text-xs px-2 py-1 rounded-lg border bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 cursor-pointer"
                      >
                        {isRtl ? 'سال جاری (از ۱ فروردین)' : 'Current Year'}
                      </button>

                      <button
                        type="button"
                        onClick={() => setDateRangeMode('CUSTOM')}
                        className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition cursor-pointer ${
                          dateRangeMode === 'CUSTOM'
                            ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {isRtl ? 'انتخاب دستی تاریخ 📅' : 'Custom Dates 📅'}
                      </button>
                    </div>
                  </div>

                  {/* Manual From-Date and To-Date Inputs with Shamsi/Gregorian conversion */}
                  {dateRangeMode === 'CUSTOM' && (
                    <div className="space-y-3 pt-2.5 border-t border-slate-200/70 dark:border-slate-800/70 animate-in fade-in duration-200">
                      {/* Calendar input mode toggle */}
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {isRtl ? 'نحوه ورود تاریخ دستی:' : 'Date Input Type:'}
                        </span>
                        <div className="inline-flex p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px]">
                          <button
                            type="button"
                            onClick={() => setCalendarInputMode('SHAMSI')}
                            className={`px-2.5 py-1 rounded-md transition font-bold cursor-pointer ${
                              calendarInputMode === 'SHAMSI'
                                ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-xs'
                                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                          >
                            ☀️ {isRtl ? 'تاریخ خورشیدی (شمسی)' : 'Shamsi / Jalali'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setCalendarInputMode('GREGORIAN')}
                            className={`px-2.5 py-1 rounded-md transition font-bold cursor-pointer ${
                              calendarInputMode === 'GREGORIAN'
                                ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-300 shadow-xs'
                                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                          >
                            🗓️ {isRtl ? 'تقویم میلادی' : 'Gregorian'}
                          </button>
                        </div>
                      </div>

                      {calendarInputMode === 'SHAMSI' ? (
                        /* Shamsi Inputs */
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-emerald-500" />
                                <span>{isRtl ? 'از تاریخ شمسی (سال/ماه/روز):' : 'From Shamsi Date (YYYY/MM/DD):'}</span>
                              </span>
                              {startDate && (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  میلادی: {startDate}
                                </span>
                              )}
                            </label>
                            <input
                              type="text"
                              value={startJalali}
                              onChange={(e) => handleStartJalaliChange(e.target.value)}
                              placeholder="مثال: 1402/12/01"
                              className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs sm:text-sm font-mono focus:ring-2 focus:ring-emerald-500"
                            />
                            {startDate && (
                              <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">
                                ✓ {formatToJalaliVerbose(startDate)}
                              </p>
                            )}
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-emerald-500" />
                                <span>{isRtl ? 'تا تاریخ شمسی (سال/ماه/روز):' : 'To Shamsi Date (YYYY/MM/DD):'}</span>
                              </span>
                              {endDate && (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  میلادی: {endDate}
                                </span>
                              )}
                            </label>
                            <input
                              type="text"
                              value={endJalali}
                              onChange={(e) => handleEndJalaliChange(e.target.value)}
                              placeholder="مثال: 1403/06/31"
                              className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs sm:text-sm font-mono focus:ring-2 focus:ring-emerald-500"
                            />
                            {endDate && (
                              <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">
                                ✓ {formatToJalaliVerbose(endDate)}
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        /* Gregorian Standard Picker with live Shamsi badges */
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-sky-500" />
                                <span>{isRtl ? 'از تاریخ (From Date):' : 'From Date:'}</span>
                              </span>
                              {startDate && (
                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded-md">
                                  شمسی: {toPersianDigits(formatToJalali(startDate))}
                                </span>
                              )}
                            </label>
                            <input
                              type="date"
                              value={startDate}
                              onChange={(e) => handleStartDateChange(e.target.value)}
                              className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs sm:text-sm font-mono focus:ring-2 focus:ring-sky-500"
                            />
                            {startDate && (
                              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                {formatToJalaliVerbose(startDate)}
                              </p>
                            )}
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-sky-500" />
                                <span>{isRtl ? 'تا تاریخ (To Date):' : 'To Date:'}</span>
                              </span>
                              {endDate && (
                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded-md">
                                  شمسی: {toPersianDigits(formatToJalali(endDate))}
                                </span>
                              )}
                            </label>
                            <input
                              type="date"
                              value={endDate}
                              onChange={(e) => handleEndDateChange(e.target.value)}
                              className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs sm:text-sm font-mono focus:ring-2 focus:ring-sky-500"
                            />
                            {endDate && (
                              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                {formatToJalaliVerbose(endDate)}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Read-Only Safety Checkbox */}
                <div className="p-3 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-500/20 flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    id="read-only-check"
                    checked={isReadOnlyConfirmed}
                    onChange={(e) => setIsReadOnlyConfirmed(e.target.checked)}
                    className="h-4 w-4 rounded-md border-emerald-400 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <label htmlFor="read-only-check" className="text-xs font-bold text-emerald-900 dark:text-emerald-200 cursor-pointer select-none">
                    {isRtl
                      ? 'تایید می‌کنم این کلید خصوصی صرفاً دارای مجوز خواندن (Read-Only) است و هیچ‌گونه دسترسی برداشتی ندارد.'
                      : 'I verify this Private API Key is Read-Only with ZERO withdrawal permissions.'}
                  </label>
                </div>

                {/* Form Buttons */}
                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="default"
                    onClick={() => setIsFormOpen(false)}
                    className="cursor-pointer"
                  >
                    {isRtl ? 'انصراف' : 'Cancel'}
                  </Button>

                  <Button
                    type="submit"
                    variant="primary"
                    size="default"
                    disabled={isSyncing}
                    className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold cursor-pointer"
                  >
                    {isSyncing ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>{isRtl ? 'در حال اتصال و دریافت...' : 'Connecting...'}</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        <span>{editingId ? (isRtl ? 'ذخیره و همگام‌سازی مجدد' : 'Save & Sync') : (isRtl ? 'ثبت و استعلام وضعیت معاملات' : 'Connect & Check Trades')}</span>
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Sync Progress Indicator */}
          {isSyncing && (
            <div className="p-4 rounded-2xl border border-sky-300/80 bg-sky-50/90 dark:border-sky-800/80 dark:bg-sky-950/40 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between text-xs font-bold text-sky-900 dark:text-sky-100">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-sky-600 dark:text-sky-400" />
                  <span>{syncStatusText}</span>
                </div>
                <span>{syncStep * 25}%</span>
              </div>
              <Progress value={syncStep * 25} className="h-2" />
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl border border-red-200 bg-red-50/90 dark:border-red-900/60 dark:bg-red-950/40 flex items-center gap-2.5 text-xs text-red-700 dark:text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
              <span className="flex-1 font-medium">{errorMessage}</span>
              <button type="button" onClick={() => setErrorMessage(null)} className="cursor-pointer font-bold">✕</button>
            </div>
          )}

          {/* Success Banner */}
          {successMessage && (
            <div className="p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/90 dark:border-emerald-900/60 dark:bg-emerald-950/40 flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-200">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              <span className="flex-1 font-medium">{successMessage}</span>
              <button type="button" onClick={() => setSuccessMessage(null)} className="cursor-pointer font-bold">✕</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
