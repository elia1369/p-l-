import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calculator, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Scale, 
  Sparkles,
  ArrowRightLeft,
  CheckCircle2,
  Percent,
  Coins,
  RefreshCw,
  Activity
} from 'lucide-react';
import { AssetAnalysis, Language, CurrencyKind } from '../types';
import { translations, formatCurrency, formatPercent, formatNumber } from '../utils/i18n';
import { CurrencyLogo } from './CurrencyLogo';
import { fetchWallexMarkets, findWallexMarket, WallexMarket } from '../utils/wallexApi';

interface Props {
  assets?: AssetAnalysis[];
  lang: Language;
  customPrices?: Record<string, number>;
  onUpdatePrice?: (symbol: string, newPrice: number) => void;
  onLoadDemo?: () => void;
  isExcelLoaded: boolean;
}

/**
 * Normalizes input string containing Persian/Arabic/English digits and commas into a clean number.
 */
function parsePriceInput(val: string): number {
  if (!val) return 0;
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let clean = val;
  for (let i = 0; i < 10; i++) {
    clean = clean.split(persianDigits[i]).join(String(i));
    clean = clean.split(arabicDigits[i]).join(String(i));
  }
  clean = clean.replace(/,/g, '').replace(/\s+/g, '');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

export const CurrentPricePnLBox: React.FC<Props> = ({
  assets = [],
  lang,
  customPrices = {},
  onUpdatePrice,
  onLoadDemo,
  isExcelLoaded,
}) => {
  const t = translations[lang];

  // Active selected asset
  const [selectedSymbol, setSelectedSymbol] = useState<string>('');

  // Wallex Live Markets state (from GET /hector/web/v1/markets)
  const [wallexMarkets, setWallexMarkets] = useState<WallexMarket[]>([]);
  const [isLoadingWallex, setIsLoadingWallex] = useState<boolean>(false);
  const [wallexError, setWallexError] = useState<string | null>(null);
  const [lastLivePriceFetched, setLastLivePriceFetched] = useState<number | null>(null);
  const [isManualOverride, setIsManualOverride] = useState<boolean>(false);

  // Load Wallex markets on mount
  useEffect(() => {
    let isMounted = true;
    const loadMarkets = async () => {
      setIsLoadingWallex(true);
      setWallexError(null);
      try {
        const list = await fetchWallexMarkets();
        if (isMounted) {
          setWallexMarkets(list);
        }
      } catch (err: any) {
        if (isMounted) {
          setWallexError(err?.message || 'خطا در بارگذاری بازارهای والکس');
        }
      } finally {
        if (isMounted) {
          setIsLoadingWallex(false);
        }
      }
    };
    loadMarkets();
    return () => { isMounted = false; };
  }, []);

  // Keep selectedSymbol valid when assets list changes
  useEffect(() => {
    if (assets.length > 0) {
      if (!selectedSymbol || !assets.some(a => a.symbol === selectedSymbol)) {
        // Prioritize asset with open positions or first
        const openAsset = assets.find(a => a.netQty > 0.0001);
        setSelectedSymbol(openAsset ? openAsset.symbol : assets[0].symbol);
      }
    }
  }, [assets, selectedSymbol]);

  const activeAsset: AssetAnalysis | undefined = useMemo(() => {
    return assets.find(a => a.symbol === selectedSymbol) || assets[0];
  }, [assets, selectedSymbol]);

  // Find active Wallex market for current activeAsset
  const activeWallexMarket = useMemo(() => {
    if (!activeAsset || wallexMarkets.length === 0) return undefined;
    return findWallexMarket(wallexMarkets, activeAsset.symbol, activeAsset.currency);
  }, [activeAsset, wallexMarkets]);

  // Input state for Current Price
  const [priceInputText, setPriceInputText] = useState<string>('');

  // Automatically inject the live market price from GET /hector/web/v1/markets when asset or market loads!
  useEffect(() => {
    if (activeAsset && activeWallexMarket) {
      const livePrice = parseFloat(activeWallexMarket.price);
      if (livePrice > 0) {
        setPriceInputText(String(livePrice));
        setLastLivePriceFetched(livePrice);
        setIsManualOverride(false);
        if (onUpdatePrice) {
          onUpdatePrice(activeAsset.symbol, livePrice);
        }
      }
    } else if (activeAsset && !activeWallexMarket) {
      const current = customPrices[activeAsset.symbol] ?? activeAsset.currentPrice;
      if (current > 0) {
        setPriceInputText(String(current));
      } else {
        setPriceInputText('');
      }
    }
  }, [activeAsset?.symbol, activeWallexMarket?.symbol, activeWallexMarket?.price]);

  // Manual refresh of live price from API
  const handleRefreshLivePrice = async () => {
    if (!activeAsset) return;
    setIsLoadingWallex(true);
    setWallexError(null);
    try {
      const freshMarkets = await fetchWallexMarkets(true);
      setWallexMarkets(freshMarkets);
      const matched = findWallexMarket(freshMarkets, activeAsset.symbol, activeAsset.currency);
      if (matched) {
        const livePrice = parseFloat(matched.price);
        if (livePrice > 0) {
          setPriceInputText(String(livePrice));
          setLastLivePriceFetched(livePrice);
          setIsManualOverride(false);
          if (onUpdatePrice) {
            onUpdatePrice(activeAsset.symbol, livePrice);
          }
        }
      }
    } catch (err: any) {
      setWallexError(err?.message || 'خطا در بروزرسانی قیمت');
    } finally {
      setIsLoadingWallex(false);
    }
  };

  const handlePriceChange = (val: string) => {
    setPriceInputText(val);
    setIsManualOverride(true);
    const parsed = parsePriceInput(val);
    if (activeAsset && onUpdatePrice) {
      onUpdatePrice(activeAsset.symbol, parsed);
    }
  };

  const handleResetToLivePrice = () => {
    if (lastLivePriceFetched && lastLivePriceFetched > 0 && activeAsset) {
      setPriceInputText(String(lastLivePriceFetched));
      setIsManualOverride(false);
      if (onUpdatePrice) {
        onUpdatePrice(activeAsset.symbol, lastLivePriceFetched);
      }
    } else {
      handleRefreshLivePrice();
    }
  };

  const handleApplyPreset = (percentDelta: number) => {
    if (!activeAsset || activeAsset.avgBuyPrice <= 0) return;
    const base = activeAsset.avgBuyPrice;
    const target = Math.max(0, base * (1 + percentDelta / 100));
    const rounded = activeAsset.currency === 'TMN' ? Math.round(target) : parseFloat(target.toFixed(4));
    handlePriceChange(String(rounded));
  };

  const handleApplyBreakeven = () => {
    if (!activeAsset) return;
    const be = activeAsset.breakevenPrice || activeAsset.avgBuyPrice;
    const rounded = activeAsset.currency === 'TMN' ? Math.round(be) : parseFloat(be.toFixed(4));
    handlePriceChange(String(rounded));
  };

  // Real-time calculations
  const parsedPrice = parsePriceInput(priceInputText);
  const costBasis = activeAsset?.avgBuyPrice || 0;
  const breakeven = activeAsset?.breakevenPrice || costBasis;
  const netQty = activeAsset?.netQty || 0;

  const unitDifference = parsedPrice > 0 && costBasis > 0 ? parsedPrice - costBasis : 0;
  const percentChange = costBasis > 0 && parsedPrice > 0 ? ((parsedPrice - costBasis) / costBasis) * 100 : 0;
  
  // Position-wide P&L based on remaining held balance (or total buy quantity if fully closed)
  const isPositionOpen = netQty > 0.00001;
  const effectiveQty = isPositionOpen ? netQty : (activeAsset?.totalBuyQty || 1);
  const totalPositionPnL = parsedPrice > 0 ? (parsedPrice - breakeven) * effectiveQty : 0;
  const holdingMarketValue = parsedPrice > 0 ? parsedPrice * netQty : 0;

  const isProfit = unitDifference > 0.0001;
  const isLoss = unitDifference < -0.0001;

  return (
    <div 
      id="current-price-pnl-card"
      className="mt-5 rounded-2xl border border-emerald-500/25 dark:border-emerald-500/20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-4 sm:p-6 shadow-lg shadow-emerald-950/5 transition-all"
    >
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/15 text-emerald-600 dark:text-emerald-400 shadow-xs shadow-emerald-500/10">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm sm:text-base font-black bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 dark:from-emerald-400 dark:via-teal-300 dark:to-cyan-400 bg-clip-text text-transparent">
              {t.calcBoxTitle}
            </h4>
          </div>
        </div>

        {/* If multiple assets in Excel, asset switcher */}
        {assets.length > 1 && (
          <div className="flex items-center gap-1.5 self-start sm:self-auto overflow-x-auto max-w-full pb-1 sm:pb-0">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">
              {t.selectAsset}:
            </span>
            <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
              {assets.map(a => {
                const m = wallexMarkets.length > 0 ? findWallexMarket(wallexMarkets, a.symbol, a.currency) : undefined;
                const label = m?.fa_base_asset && lang === 'fa' ? `${m.fa_base_asset} (${a.symbol})` : a.symbol;
                return (
                  <button
                    key={a.symbol}
                    type="button"
                    onClick={() => setSelectedSymbol(a.symbol)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                      selectedSymbol === a.symbol
                        ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <CurrencyLogo currency={a.currency} lang={lang} size="xs" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {activeAsset ? (
        <div className="mt-4 space-y-4">
          {/* Row: Cost Basis (From Excel) + Current Price Input (User) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. Cost Basis Card (Auto-Calculated from Excel) */}
            <div 
              id="box-cost-basis-excel"
              className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                    <Coins className="w-4 h-4 text-amber-500" />
                    <span>{t.costBasisLabel}</span>
                  </div>
                  <CurrencyLogo currency={activeAsset.currency} lang={lang} size="xs" />
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-xl sm:text-2xl font-black font-mono tracking-tight text-slate-900 dark:text-slate-100">
                    {formatCurrency(activeAsset.avgBuyPrice, lang, activeAsset.currency)}
                  </span>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between gap-2">
                <span>
                  {lang === 'fa' ? 'حجم کل خرید در اکسل:' : 'Total Buy Volume:'}{' '}
                  <b className="font-mono text-slate-700 dark:text-slate-200">{formatNumber(activeAsset.totalBuyQty, lang)}</b>
                </span>
                <span>
                  {lang === 'fa' ? 'نقطه سر‌به‌سر (با کارمزد):' : 'Breakeven (w/ Fees):'}{' '}
                  <b className="font-mono text-slate-700 dark:text-slate-200">{formatCurrency(activeAsset.breakevenPrice, lang, activeAsset.currency)}</b>
                </span>
              </div>
            </div>

            {/* 2. User Input Field: "قیمت فعلی ارز" (Requested explicitly) */}
            <div 
              id="box-current-price-user-input"
              className="p-4 rounded-xl bg-white dark:bg-slate-800/90 border-2 border-emerald-500/40 dark:border-emerald-500/30 shadow-xs flex flex-col justify-between transition-all"
            >
              <div>
                {/* Header: Label and Live Wallex API Badge */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <label 
                      htmlFor="current-asset-price-input" 
                      className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-1.5"
                    >
                      <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>{t.currentAssetPriceLabel}:</span>
                    </label>
                  </div>

                  {/* Live Status Badge & Refresh from Wallex API */}
                  <div className="flex items-center gap-1.5">
                    {isLoadingWallex ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>{lang === 'fa' ? 'دریافت نرخ...' : 'Fetching...'}</span>
                      </span>
                    ) : activeWallexMarket ? (
                      <div className="flex items-center gap-1.5">
                        <span 
                          title="GET /hector/web/v1/markets"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded-md border border-emerald-500/20"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>{lang === 'fa' ? 'نرخ زنده والکس' : 'Wallex Live'}</span>
                        </span>
                        {typeof activeWallexMarket.change_24h === 'number' && (
                          <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded ${
                            activeWallexMarket.change_24h >= 0 
                              ? 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300' 
                              : 'text-rose-700 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-300'
                          }`}>
                            {activeWallexMarket.change_24h >= 0 ? '+' : ''}{activeWallexMarket.change_24h}%
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={handleRefreshLivePrice}
                          title={lang === 'fa' ? 'بروزرسانی مجدد از API والکس' : 'Refresh live price from API'}
                          className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-[11px] font-medium text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md">
                        {lang === 'fa' ? 'ورودی کاربر' : 'User Input'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Input Field directly in front of the label */}
                <div className="relative mt-1">
                  <input
                    id="current-asset-price-input"
                    type="text"
                    inputMode="decimal"
                    value={priceInputText}
                    onChange={(e) => handlePriceChange(e.target.value)}
                    placeholder={activeAsset.currency === 'TMN' ? 'مثلاً 21700' : 'مثلاً 0.0935'}
                    className="w-full font-mono text-lg sm:text-xl font-black py-2.5 px-3.5 pe-20 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100 transition"
                  />
                  <div className="absolute top-1/2 -translate-y-1/2 end-3 flex items-center gap-1 pointer-events-none text-xs font-bold text-slate-500 dark:text-slate-400">
                    <CurrencyLogo currency={activeAsset.currency} lang={lang} size="xs" />
                  </div>
                </div>

                {/* Live Wallex Market Details & Auto-Fill Feedback */}
                {activeWallexMarket && (
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {activeWallexMarket.symbol}
                      </span>
                      {activeWallexMarket.fa_base_asset && (
                        <span className="text-slate-600 dark:text-slate-300 font-medium">({activeWallexMarket.fa_base_asset})</span>
                      )}
                      <span className="text-slate-300 dark:text-slate-600">•</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                        <Activity className="w-3 h-3" />
                        <span>{lang === 'fa' ? 'ثبت خودکار از API والکس' : 'Auto-filled via Wallex API'}</span>
                      </span>
                    </div>

                    {isManualOverride && lastLivePriceFetched && (
                      <button
                        type="button"
                        onClick={handleResetToLivePrice}
                        className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-bold transition cursor-pointer"
                      >
                        {lang === 'fa' 
                          ? `بازگشت به نرخ زنده (${formatNumber(lastLivePriceFetched, lang)})` 
                          : `Reset to Live (${lastLivePriceFetched})`}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Quick Preset Buttons for rapid testing */}
              <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700/80 flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="text-slate-400">{lang === 'fa' ? 'تنظیم سریع:' : 'Quick Set:'}</span>
                {activeWallexMarket && (
                  <button
                    type="button"
                    onClick={handleResetToLivePrice}
                    className="px-2 py-0.5 rounded bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-bold transition cursor-pointer flex items-center gap-1"
                  >
                    <Activity className="w-3 h-3" />
                    <span>{lang === 'fa' ? 'نرخ لحظه‌ای والکس' : 'Live Wallex Price'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleApplyPreset(5)}
                  className="px-2 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-mono font-bold transition cursor-pointer"
                >
                  +5%
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset(10)}
                  className="px-2 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-mono font-bold transition cursor-pointer"
                >
                  +10%
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset(-5)}
                  className="px-2 py-0.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 font-mono font-bold transition cursor-pointer"
                >
                  -5%
                </button>
                <button
                  type="button"
                  onClick={handleApplyBreakeven}
                  className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-medium transition cursor-pointer"
                >
                  {lang === 'fa' ? 'نقطه سر‌به‌سر' : 'Breakeven'}
                </button>
              </div>
            </div>
          </div>

          {/* Automatic P&L Comparison Outcome Card */}
          <div 
            id="automatic-pnl-result-deck"
            className={`rounded-xl p-4 border transition-all ${
              isProfit
                ? 'bg-emerald-500/10 dark:bg-emerald-950/30 border-emerald-500/30'
                : isLoss
                ? 'bg-rose-500/10 dark:bg-rose-950/30 border-rose-500/30'
                : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${
                  isProfit ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : isLoss ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400' : 'bg-slate-200 dark:bg-slate-700 text-slate-600'
                }`}>
                  {isProfit ? <TrendingUp className="w-4 h-4" /> : isLoss ? <TrendingDown className="w-4 h-4" /> : <Scale className="w-4 h-4" />}
                </div>
                <span className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-200">
                  {t.calculatedPnL} ({activeAsset.symbol})
                </span>
              </div>

              {/* Profit / Loss status pill */}
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black font-mono ${
                  isProfit
                    ? 'bg-emerald-500 text-white shadow-xs'
                    : isLoss
                    ? 'bg-rose-500 text-white shadow-xs'
                    : 'bg-slate-500 text-white'
                }`}>
                  {isProfit ? '+' : ''}{formatPercent(percentChange, lang)}
                  <span className="font-sans text-[11px] font-bold">
                    {isProfit ? (lang === 'fa' ? 'سود' : 'Profit') : isLoss ? (lang === 'fa' ? 'زیان' : 'Loss') : (lang === 'fa' ? 'سر‌به‌سر' : 'Breakeven')}
                  </span>
                </span>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-200/60 dark:border-slate-700/60">
              {/* 1. Unit Difference */}
              <div className="space-y-0.5">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {t.unitProfitLoss}:
                </span>
                <div className={`font-mono text-sm sm:text-base font-black ${
                  isProfit ? 'text-emerald-600 dark:text-emerald-400' : isLoss ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'
                }`}>
                  {unitDifference > 0 ? '+' : ''}{formatCurrency(unitDifference, lang, activeAsset.currency)}
                </div>
              </div>

              {/* 2. Total Position P&L */}
              <div className="space-y-0.5">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {t.positionPnL} ({isPositionOpen ? (lang === 'fa' ? 'موجودی باز' : 'Open Balance') : (lang === 'fa' ? 'کل خرید' : 'Total Buy')}):
                </span>
                <div className={`font-mono text-sm sm:text-base font-black ${
                  totalPositionPnL > 0 ? 'text-emerald-600 dark:text-emerald-400' : totalPositionPnL < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'
                }`}>
                  {totalPositionPnL > 0 ? '+' : ''}{formatCurrency(totalPositionPnL, lang, activeAsset.currency)}
                </div>
              </div>

              {/* 3. Current Holding Market Value */}
              <div className="space-y-0.5">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {t.currentHoldingValue} ({formatNumber(netQty, lang)} {lang === 'fa' ? 'واحد' : 'Units'}):
                </span>
                <div className="font-mono text-sm sm:text-base font-black text-slate-900 dark:text-slate-100">
                  {formatCurrency(holdingMarketValue, lang, activeAsset.currency)}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Empty State before any Excel is uploaded */
        <div className="mt-4 p-5 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-300 dark:border-slate-700">
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-md mx-auto">
            {t.noExcelFileYet}
          </p>
          {onLoadDemo && (
            <button
              type="button"
              onClick={onLoadDemo}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>{t.loadDemoBtn}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
