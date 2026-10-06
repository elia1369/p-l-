import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Receipt, 
  Layers, 
  ArrowUpRight, 
  ArrowDownRight,
  Scale
} from 'lucide-react';
import { PortfolioSummary, Language, CurrencyKind } from '../types';
import { translations, formatPercent } from '../utils/i18n';
import { CurrencyLogo } from './CurrencyLogo';

interface Props {
  summary: PortfolioSummary;
  lang: Language;
}

interface FormattedOverviewAmountProps {
  amount: number;
  currency: CurrencyKind;
  lang: Language;
  colorClass?: string;
  size?: 'main' | 'sub';
}

const FormattedOverviewAmount: React.FC<FormattedOverviewAmountProps> = ({
  amount,
  currency,
  lang,
  colorClass,
  size = 'main'
}) => {
  const isToman = currency === 'TMN';
  const absNum = Math.abs(amount || 0);
  const sign = amount < 0 ? '-' : (amount > 0 && size === 'sub' && (colorClass?.includes('emerald') || colorClass?.includes('rose')) ? '' : '');

  // Decimals handling:
  // For Toman, small numbers (<100) keep 2 decimals, large amounts (>=100k) don't need decimals
  let maxDec = 2;
  let minDec = 0;
  if (isToman) {
    maxDec = absNum >= 100000 ? (Number.isInteger(absNum) ? 0 : 2) : 2;
    minDec = 0;
  } else {
    maxDec = absNum < 0.01 && absNum > 0 ? 6 : (absNum < 1 && absNum > 0 ? 4 : 2);
    minDec = 2;
  }

  const numStr = absNum.toLocaleString('en-US', {
    maximumFractionDigits: maxDec,
    minimumFractionDigits: minDec,
  });

  const fullDisplay = `${sign}${numStr}`;
  const unit = isToman ? (lang === 'fa' ? 'تومان' : 'TMN') : '$';

  // Responsive font sizes so numbers stay legible and complete without being truncated
  let textSizeClass = 'text-sm sm:text-base lg:text-lg';
  if (size === 'main') {
    if (fullDisplay.length > 14) {
      textSizeClass = 'text-xs sm:text-sm lg:text-base';
    } else if (fullDisplay.length > 10) {
      textSizeClass = 'text-sm sm:text-base lg:text-lg';
    } else if (fullDisplay.length > 7) {
      textSizeClass = 'text-base sm:text-lg lg:text-xl';
    } else {
      textSizeClass = 'text-lg sm:text-xl lg:text-2xl';
    }
  } else {
    // sub rows - clear, readable and never truncated
    textSizeClass = 'text-[11px] sm:text-xs';
  }

  return (
    <span 
      className="inline-flex items-baseline gap-1 min-w-0"
      title={`${sign}${absNum.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${unit}`}
    >
      <span className={`font-mono font-black tracking-tight whitespace-nowrap ${textSizeClass} ${colorClass || ''}`}>
        {isToman ? fullDisplay : `${sign}$${numStr}`}
      </span>
      {isToman && (
        <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 dark:text-slate-400 shrink-0 whitespace-nowrap select-none">
          {unit}
        </span>
      )}
    </span>
  );
};

export const OverviewCards: React.FC<Props> = ({ summary, lang }) => {
  const t = translations[lang];
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyKind>(summary.primaryCurrency || 'TMN');

  // Keep selected currency synced when dominant currency changes
  useEffect(() => {
    if (summary.primaryCurrency) {
      setSelectedCurrency(summary.primaryCurrency);
    }
  }, [summary.primaryCurrency]);

  const activeCurrency: CurrencyKind = (summary.hasTomanTrades && summary.hasUsdTrades) 
    ? selectedCurrency 
    : (summary.primaryCurrency || 'TMN');

  const activeSummary = activeCurrency === 'TMN' && summary.tmnSummary
    ? summary.tmnSummary
    : (activeCurrency === 'USD' && summary.usdSummary ? summary.usdSummary : summary);

  const isNetProfit = activeSummary.totalNetPnL >= 0;

  return (
    <div className="space-y-3">
      {/* Multi-Currency Toggle Bar if both TMN and USD exist */}
      {summary.hasTomanTrades && summary.hasUsdTrades && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {lang === 'fa' ? 'تفکیک ارزهای محاسبه‌شده:' : 'Portfolio Currency:'}
            </span>
          </div>

          <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 text-xs">
            <button
              id="select-currency-tmn-btn"
              type="button"
              onClick={() => setSelectedCurrency('TMN')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition cursor-pointer ${
                activeCurrency === 'TMN'
                  ? 'bg-white dark:bg-slate-700 text-amber-700 dark:text-amber-300 shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <CurrencyLogo currency="TMN" lang={lang} size="xs" />
            </button>
            <button
              id="select-currency-usd-btn"
              type="button"
              onClick={() => setSelectedCurrency('USD')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition cursor-pointer ${
                activeCurrency === 'USD'
                  ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <CurrencyLogo currency="USD" lang={lang} size="xs" />
            </button>
          </div>
        </div>
      )}

      {/* 4 Core Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* 1. Total Net P&L Card */}
        <div 
          id="card-net-pnl"
          className={`relative overflow-hidden min-w-0 rounded-2xl p-4 sm:p-5 border transition-all ${
            isNetProfit
              ? 'border-emerald-500/40 dark:border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-white/90 dark:to-slate-900/90 shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20'
              : 'border-rose-500/40 dark:border-rose-500/30 bg-gradient-to-br from-rose-500/15 via-rose-500/5 to-white/90 dark:to-slate-900/90 shadow-lg shadow-rose-500/10 hover:shadow-rose-500/20'
          } backdrop-blur-xl`}
        >
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">
                {t.netPnL}
              </span>
              <CurrencyLogo currency={activeCurrency} lang={lang} size="xs" />
            </div>
          </div>

          <div className="flex items-baseline gap-2 mb-2 min-w-0 overflow-hidden">
            <FormattedOverviewAmount
              amount={activeSummary.totalNetPnL}
              currency={activeCurrency}
              lang={lang}
              colorClass={isNetProfit ? 'text-emerald-600 dark:text-emerald-400 drop-shadow-xs' : 'text-rose-600 dark:text-rose-400 drop-shadow-xs'}
              size="main"
            />
          </div>

          <div className="flex items-center justify-between text-[11px] sm:text-xs pt-2 border-t border-slate-200/60 dark:border-slate-800/80">
            <span className="text-slate-500 dark:text-slate-400 font-medium">{t.roi}</span>
            <span className={`font-mono font-bold px-2 py-0.5 rounded-lg border ${
              isNetProfit 
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' 
                : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
            }`}>
              {formatPercent(activeSummary.netPortfolioReturn, lang)}
            </span>
          </div>
        </div>

        {/* 2. Total Fees Paid Card */}
        <div 
          id="card-total-fees"
          className="relative overflow-hidden min-w-0 rounded-2xl p-4 sm:p-5 border border-amber-500/30 dark:border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-white/90 dark:to-slate-900/90 backdrop-blur-xl shadow-md shadow-amber-500/5 hover:shadow-amber-500/10 transition-all"
        >
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">
                {t.totalFeesPaid}
              </span>
              <CurrencyLogo currency={activeCurrency} lang={lang} size="xs" />
            </div>
          </div>

          <div className="flex items-baseline gap-2 mb-2 min-w-0 overflow-hidden">
            <FormattedOverviewAmount
              amount={activeSummary.totalFeesPaid}
              currency={activeCurrency}
              lang={lang}
              colorClass="text-amber-600 dark:text-amber-400 font-extrabold"
              size="main"
            />
          </div>

          {(activeSummary.buyFeesPaid !== undefined || activeSummary.sellFeesPaid !== undefined) && (
            <div className="flex flex-col gap-1.5 mb-2 bg-amber-50/50 dark:bg-amber-950/20 p-2 rounded-xl border border-amber-200/50 dark:border-amber-900/40">
              <div className="flex items-center justify-between gap-1 text-[10px] sm:text-[11px] min-w-0">
                <span className="text-slate-500 dark:text-slate-400 shrink-0">{t.buyFees}:</span>
                <FormattedOverviewAmount
                  amount={activeSummary.buyFeesPaid || 0}
                  currency={activeCurrency}
                  lang={lang}
                  colorClass="text-emerald-600 dark:text-emerald-400 font-semibold"
                  size="sub"
                />
              </div>
              <div className="flex items-center justify-between gap-1 text-[10px] sm:text-[11px] min-w-0">
                <span className="text-slate-500 dark:text-slate-400 shrink-0">{t.sellFees}:</span>
                <FormattedOverviewAmount
                  amount={activeSummary.sellFeesPaid || 0}
                  currency={activeCurrency}
                  lang={lang}
                  colorClass="text-rose-500 dark:text-rose-400 font-semibold"
                  size="sub"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between text-[11px] sm:text-xs pt-2 border-t border-slate-200/60 dark:border-slate-800/80">
            <span className="text-slate-500 dark:text-slate-400">
              {lang === 'fa' ? 'سهم از گردش مالی' : 'Fee Ratio'}
            </span>
            <span className="font-mono text-amber-600 dark:text-amber-400 font-bold px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
              {activeSummary.totalBuyValue + activeSummary.totalSellValue > 0
                ? `${((activeSummary.totalFeesPaid / (activeSummary.totalBuyValue + activeSummary.totalSellValue)) * 100).toFixed(2)}%`
                : '0%'}
            </span>
          </div>
        </div>

        {/* 3. Realized vs Unrealized Breakdown Card */}
        <div 
          id="card-realized-unrealized"
          className="relative overflow-hidden min-w-0 rounded-2xl p-4 sm:p-5 border border-cyan-500/30 dark:border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 via-blue-500/5 to-white/90 dark:to-slate-900/90 backdrop-blur-xl shadow-md shadow-cyan-500/5 hover:shadow-cyan-500/10 transition-all flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">
                  {t.realizedPnL} / {t.unrealizedPnL}
                </span>
                <CurrencyLogo currency={activeCurrency} lang={lang} size="xs" />
              </div>
            </div>

            <div className="space-y-2 mb-3 bg-cyan-50/60 dark:bg-slate-800/80 p-2.5 rounded-xl border border-cyan-200/60 dark:border-cyan-900/40">
              <div className="flex justify-between items-center text-xs gap-2 min-w-0">
                <span className="text-slate-600 dark:text-slate-400 font-medium shrink-0 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 shrink-0" />
                  {t.realizedPnL}:
                </span>
                <FormattedOverviewAmount
                  amount={activeSummary.realizedPnL}
                  currency={activeCurrency}
                  lang={lang}
                  colorClass={activeSummary.realizedPnL >= 0 ? 'text-emerald-600 dark:text-emerald-400 font-extrabold' : 'text-rose-600 dark:text-rose-400 font-extrabold'}
                  size="sub"
                />
              </div>
              <div className="flex justify-between items-center text-xs gap-2 min-w-0 pt-1.5 border-t border-cyan-100 dark:border-slate-700/60">
                <span className="text-slate-600 dark:text-slate-400 font-medium shrink-0 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                  {t.unrealizedPnL}:
                </span>
                <FormattedOverviewAmount
                  amount={activeSummary.unrealizedPnL}
                  currency={activeCurrency}
                  lang={lang}
                  colorClass={activeSummary.unrealizedPnL >= 0 ? 'text-emerald-600 dark:text-emerald-400 font-extrabold' : 'text-rose-600 dark:text-rose-400 font-extrabold'}
                  size="sub"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] sm:text-xs pt-2 border-t border-slate-200/60 dark:border-slate-800/80 mt-auto">
            <span className="text-slate-500 dark:text-slate-400">{t.openPositions}</span>
            <span className="font-mono font-bold text-cyan-700 dark:text-cyan-300 px-2 py-0.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              {summary.openPositionsCount} {lang === 'fa' ? 'نماد' : 'Assets'}
            </span>
          </div>
        </div>

        {/* 4. Total Volume & Turnover Card */}
        <div 
          id="card-turnover"
          className="relative overflow-hidden min-w-0 rounded-2xl p-4 sm:p-5 border border-purple-500/30 dark:border-purple-500/20 bg-gradient-to-br from-purple-500/10 via-indigo-500/5 to-white/90 dark:to-slate-900/90 backdrop-blur-xl shadow-md shadow-purple-500/5 hover:shadow-purple-500/10 transition-all flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">
                  {t.totalVolume}
                </span>
                <CurrencyLogo currency={activeCurrency} lang={lang} size="xs" />
              </div>
            </div>

            <div className="flex items-baseline gap-2 mb-2.5 min-w-0">
              <FormattedOverviewAmount
                amount={activeSummary.totalBuyValue + activeSummary.totalSellValue}
                currency={activeCurrency}
                lang={lang}
                colorClass="text-purple-700 dark:text-purple-300 font-extrabold"
                size="main"
              />
            </div>

            <div className="space-y-1.5 mb-2 bg-purple-50/50 dark:bg-slate-800/70 p-2 rounded-xl border border-purple-200/50 dark:border-purple-900/30">
              <div className="flex items-center justify-between text-xs min-w-0">
                <span className="text-slate-500 dark:text-slate-400 shrink-0 flex items-center gap-1 font-medium">
                  <ArrowDownRight className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  {t.buy}:
                </span>
                <FormattedOverviewAmount
                  amount={activeSummary.totalBuyValue}
                  currency={activeCurrency}
                  lang={lang}
                  colorClass="text-emerald-600 dark:text-emerald-400 font-bold"
                  size="sub"
                />
              </div>
              <div className="flex items-center justify-between text-xs min-w-0 pt-1 border-t border-purple-100 dark:border-slate-700/60">
                <span className="text-slate-500 dark:text-slate-400 shrink-0 flex items-center gap-1 font-medium">
                  <ArrowUpRight className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  {t.sell}:
                </span>
                <FormattedOverviewAmount
                  amount={activeSummary.totalSellValue}
                  currency={activeCurrency}
                  lang={lang}
                  colorClass="text-rose-500 dark:text-rose-400 font-bold"
                  size="sub"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] sm:text-xs pt-2 border-t border-slate-200/60 dark:border-slate-800/80 mt-auto">
            <span className="text-slate-500 dark:text-slate-400">
              {lang === 'fa' ? 'نسبت خرید به فروش' : 'Buy/Sell Ratio'}
            </span>
            <span className="font-mono text-purple-700 dark:text-purple-300 font-bold px-2 py-0.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
              {activeSummary.totalSellValue > 0 
                ? `${(activeSummary.totalBuyValue / activeSummary.totalSellValue).toFixed(2)}x`
                : '1.00x'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
