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
import { translations, formatCurrency, formatPercent } from '../utils/i18n';
import { CurrencyLogo } from './CurrencyLogo';

interface Props {
  summary: PortfolioSummary;
  lang: Language;
}

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
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {lang === 'fa' ? '(معاملات تومانی و دلاری تفکیک شدند)' : '(Toman & USD trades isolated)'}
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Total Net P&L Card */}
        <div 
          id="card-net-pnl"
          className={`relative overflow-hidden rounded-2xl p-5 border transition-all ${
            isNetProfit
              ? 'bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-500/30'
              : 'bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-transparent border-rose-500/30'
          } bg-white dark:bg-slate-900 shadow-xs`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {t.netPnL}
              </span>
              <CurrencyLogo currency={activeCurrency} lang={lang} size="xs" />
            </div>
            <div className={`p-2 rounded-xl ${
              isNetProfit ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
            }`}>
              {isNetProfit ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            </div>
          </div>

          <div className="flex items-baseline gap-2 mb-2">
            <span className={`text-2xl sm:text-3xl font-black tracking-tight font-mono ${
              isNetProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}>
              {formatCurrency(activeSummary.totalNetPnL, lang, activeCurrency)}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400">{t.roi}</span>
            <span className={`font-mono font-bold px-2 py-0.5 rounded-md ${
              isNetProfit 
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' 
                : 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
            }`}>
              {formatPercent(activeSummary.netPortfolioReturn, lang)}
            </span>
          </div>
        </div>

        {/* 2. Total Fees Paid Card */}
        <div 
          id="card-total-fees"
          className="rounded-2xl p-5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {t.totalFeesPaid}
              </span>
              <CurrencyLogo currency={activeCurrency} lang={lang} size="xs" />
            </div>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Receipt className="w-5 h-5" />
            </div>
          </div>

          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-slate-100">
              {formatCurrency(activeSummary.totalFeesPaid, lang, activeCurrency)}
            </span>
          </div>

          {(activeSummary.buyFeesPaid !== undefined || activeSummary.sellFeesPaid !== undefined) && (
            <div className="flex items-center justify-between text-[11px] mb-2 font-mono text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <span>{t.buyFees}:</span>
                <span className="font-semibold">{formatCurrency(activeSummary.buyFeesPaid || 0, lang, activeCurrency)}</span>
              </span>
              <span className="flex items-center gap-1 text-rose-500 dark:text-rose-400">
                <span>{t.sellFees}:</span>
                <span className="font-semibold">{formatCurrency(activeSummary.sellFeesPaid || 0, lang, activeCurrency)}</span>
              </span>
            </div>
          )}

          <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400">
              {lang === 'fa' ? 'سهم از گردش مالی' : 'Fee Ratio'}
            </span>
            <span className="font-mono text-amber-600 dark:text-amber-400 font-medium">
              {activeSummary.totalBuyValue + activeSummary.totalSellValue > 0
                ? `${((activeSummary.totalFeesPaid / (activeSummary.totalBuyValue + activeSummary.totalSellValue)) * 100).toFixed(2)}%`
                : '0%'}
            </span>
          </div>
        </div>

        {/* 3. Realized vs Unrealized Breakdown Card */}
        <div 
          id="card-realized-unrealized"
          className="rounded-2xl p-5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {t.realizedPnL} / {t.unrealizedPnL}
              </span>
              <CurrencyLogo currency={activeCurrency} lang={lang} size="xs" />
            </div>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Scale className="w-5 h-5" />
            </div>
          </div>

          <div className="space-y-1.5 mb-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 dark:text-slate-400">{t.realizedPnL}:</span>
              <span className={`font-mono font-semibold ${
                activeSummary.realizedPnL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}>
                {formatCurrency(activeSummary.realizedPnL, lang, activeCurrency)}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 dark:text-slate-400">{t.unrealizedPnL}:</span>
              <span className={`font-mono font-semibold ${
                activeSummary.unrealizedPnL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}>
                {formatCurrency(activeSummary.unrealizedPnL, lang, activeCurrency)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400">{t.openPositions}</span>
            <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
              {summary.openPositionsCount} {lang === 'fa' ? 'نماد' : 'Assets'}
            </span>
          </div>
        </div>

        {/* 4. Total Volume & Turnover Card */}
        <div 
          id="card-turnover"
          className="rounded-2xl p-5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {t.totalVolume}
              </span>
              <CurrencyLogo currency={activeCurrency} lang={lang} size="xs" />
            </div>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Layers className="w-5 h-5" />
            </div>
          </div>

          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-slate-100">
              {formatCurrency(activeSummary.totalBuyValue + activeSummary.totalSellValue, lang, activeCurrency)}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <ArrowDownRight className="w-3.5 h-3.5" />
              <span>{formatCurrency(activeSummary.totalBuyValue, lang, activeCurrency)}</span>
            </span>
            <span className="flex items-center gap-1 text-rose-500 dark:text-rose-400">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>{formatCurrency(activeSummary.totalSellValue, lang, activeCurrency)}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
