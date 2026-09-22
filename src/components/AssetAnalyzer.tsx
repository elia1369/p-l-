import React, { useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Percent, 
  RefreshCw, 
  Calculator, 
  CheckCircle2, 
  AlertTriangle,
  ArrowRightLeft,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { AssetAnalysis, Language } from '../types';
import { translations, formatCurrency, formatNumber, formatPercent } from '../utils/i18n';
import { CurrencyLogo } from './CurrencyLogo';

interface Props {
  assets: AssetAnalysis[];
  lang: Language;
  onUpdatePrice: (symbol: string, price: number) => void;
  onOpenSimulator: (asset: AssetAnalysis) => void;
}

export const AssetAnalyzer: React.FC<Props> = ({
  assets,
  lang,
  onUpdatePrice,
  onOpenSimulator,
}) => {
  const t = translations[lang];
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);

  if (!assets || assets.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Calculator className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span>{t.assetAnalysisTitle}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t.assetAnalysisSubtitle}
          </p>
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 self-start sm:self-auto bg-slate-100 dark:bg-slate-800/80 px-3 py-1.5 rounded-lg">
          {assets.length} {lang === 'fa' ? 'دارایی تحلیل‌شده' : 'Analyzed Assets'}
        </div>
      </div>

      {/* Asset Cards List */}
      <div className="grid grid-cols-1 gap-4">
        {assets.map((asset) => {
          const isProfit = asset.netPnL >= 0;
          const hasOpenPosition = Math.abs(asset.netQty) > 0.00001;
          
          // Distance between current price and breakeven cost basis
          const diffFromBreakeven = asset.breakevenPrice > 0 
            ? ((asset.currentPrice - asset.breakevenPrice) / asset.breakevenPrice) * 100 
            : 0;
          const isAboveBreakeven = diffFromBreakeven >= 0;
          const isExpanded = expandedSymbol === asset.symbol;

          return (
            <div
              key={asset.symbol}
              id={`asset-card-${asset.symbol.replace(/[^a-zA-Z0-9]/g, '-')}`}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all overflow-hidden"
            >
              {/* Card Main Bar */}
              <div className="p-4 sm:p-5">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  {/* Symbol & Core Status */}
                  <div className="flex items-start sm:items-center justify-between lg:justify-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-mono font-bold text-base text-slate-800 dark:text-slate-200 shrink-0 border border-slate-200/50 dark:border-slate-700/50">
                      {asset.symbol.split('/')[0].slice(0, 4)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base sm:text-lg font-bold font-mono text-slate-900 dark:text-slate-100">
                          {asset.symbol}
                        </h3>
                        <CurrencyLogo symbolOrCurrency={asset.symbol} lang={lang} size="xs" />
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          isProfit 
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20' 
                            : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20'
                        }`}>
                          {isProfit ? t.profit : t.loss}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
                        <span>{asset.tradesCount} {lang === 'fa' ? 'معامله' : 'trades'}</span>
                        <span>•</span>
                        <span>
                          {hasOpenPosition 
                            ? `${t.netPosition}: ${formatNumber(asset.netQty, lang)}` 
                            : (lang === 'fa' ? 'پوزیشن بسته شد' : 'Closed Position')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Live Price Input & Quick Adjustments */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {t.currentPrice}:
                      </label>
                      <div className="relative flex-1 sm:w-36">
                        <input
                          id={`input-current-price-${asset.symbol.replace(/[^a-zA-Z0-9]/g, '-')}`}
                          type="number"
                          step="any"
                          value={asset.currentPrice || ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            onUpdatePrice(asset.symbol, isNaN(val) ? 0 : val);
                          }}
                          placeholder={t.currentPriceInputPlaceholder}
                          className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono text-sm font-bold text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 transition text-left"
                          dir="ltr"
                        />
                      </div>
                    </div>

                    {/* Quick percentage adjustment buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onUpdatePrice(asset.symbol, asset.currentPrice * 1.01)}
                        title="+1%"
                        className="px-1.5 py-1 rounded-md text-[10px] font-mono font-medium bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 transition cursor-pointer"
                      >
                        +1%
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdatePrice(asset.symbol, asset.currentPrice * 1.05)}
                        title="+5%"
                        className="px-1.5 py-1 rounded-md text-[10px] font-mono font-medium bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 transition cursor-pointer"
                      >
                        +5%
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdatePrice(asset.symbol, asset.currentPrice * 0.99)}
                        title="-1%"
                        className="px-1.5 py-1 rounded-md text-[10px] font-mono font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 transition cursor-pointer"
                      >
                        -1%
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdatePrice(asset.symbol, asset.currentPrice * 0.95)}
                        title="-5%"
                        className="px-1.5 py-1 rounded-md text-[10px] font-mono font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 transition cursor-pointer"
                      >
                        -5%
                      </button>
                    </div>
                  </div>

                  {/* Net P&L Display */}
                  <div className="flex items-center justify-between sm:justify-end gap-4">
                    <div className="text-right sm:text-left">
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {t.netPnL}
                      </div>
                      <div className={`text-lg sm:text-xl font-black font-mono tracking-tight ${
                        isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}>
                        {formatCurrency(asset.netPnL, lang, asset.symbol)}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onOpenSimulator(asset)}
                        title={t.simulatorTitle}
                        className="px-2.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Calculator className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{lang === 'fa' ? 'شبیه‌ساز' : 'Simulate'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setExpandedSymbol(isExpanded ? null : asset.symbol)}
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                      >
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Comparison Bar: Current Price vs Breakeven Cost-Basis */}
                {hasOpenPosition && (
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                          {t.breakevenPrice}:
                        </span>
                        <span className="text-xs font-bold font-mono text-slate-900 dark:text-slate-100">
                          {formatCurrency(asset.breakevenPrice, lang, asset.symbol)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold font-mono ${
                          isAboveBreakeven 
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' 
                            : 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
                        }`}>
                          {isAboveBreakeven ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          <span>
                            {Math.abs(diffFromBreakeven).toFixed(2)}% {isAboveBreakeven ? t.aboveBreakeven : t.belowBreakeven}
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* Visual Comparison Gauge */}
                    <div className="relative w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-300 ${
                          isAboveBreakeven ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                        style={{
                          width: `${Math.min(100, Math.max(10, 50 + diffFromBreakeven))}%`
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Detailed Metrics Drawer / Expanded Breakdown */}
              {isExpanded && (
                <div className="p-4 sm:p-5 bg-slate-50/80 dark:bg-slate-800/40 border-t border-slate-200/60 dark:border-slate-800 text-xs transition-all">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {/* 1. Avg Buy Price */}
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                      <span className="text-slate-400 block mb-1">{t.avgBuyPrice}</span>
                      <span className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100">
                        {formatCurrency(asset.avgBuyPrice, lang, asset.symbol)}
                      </span>
                      <span className="block text-[11px] text-slate-500 mt-1">
                        {t.totalBuyQty}: {formatNumber(asset.totalBuyQty, lang)}
                      </span>
                    </div>

                    {/* 2. Avg Sell Price */}
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                      <span className="text-slate-400 block mb-1">{t.avgSellPrice}</span>
                      <span className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100">
                        {asset.avgSellPrice > 0 ? formatCurrency(asset.avgSellPrice, lang, asset.symbol) : '-'}
                      </span>
                      <span className="block text-[11px] text-slate-500 mt-1">
                        {t.totalSellQty}: {formatNumber(asset.totalSellQty, lang)}
                      </span>
                    </div>

                    {/* 3. Total Fees for this asset */}
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-slate-400 block">{t.totalFeesPaid}</span>
                        {asset.totalBuyCost > 0 && asset.totalFees > 0 && (
                          <span 
                            className="px-1 py-0.2 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20"
                            title={lang === 'fa' ? 'درصد کارمزد از کل حجم خرید' : 'Fee % of total buy cost'}
                          >
                            {((asset.totalFees / asset.totalBuyCost) * 100).toFixed(2)}%
                          </span>
                        )}
                      </div>
                      <span className="font-mono font-bold text-sm text-amber-600 dark:text-amber-400">
                        {formatCurrency(asset.totalFees, lang, asset.symbol)}
                      </span>
                      <div className="flex flex-col gap-0.5 text-[10px] text-slate-500 dark:text-slate-400 mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-center">
                          <span className="text-emerald-600 dark:text-emerald-400">{t.buyFees}:</span>
                          <span className="font-mono font-medium">{formatCurrency(asset.buyFees || 0, lang, asset.symbol)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-rose-500 dark:text-rose-400">{t.sellFees}:</span>
                          <span className="font-mono font-medium">{formatCurrency(asset.sellFees || 0, lang, asset.symbol)}</span>
                        </div>
                      </div>
                    </div>

                    {/* 4. Realized P&L */}
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                      <span className="text-slate-400 block mb-1">{t.realizedPnL}</span>
                      <span className={`font-mono font-bold text-sm ${
                        asset.realizedPnL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}>
                        {formatCurrency(asset.realizedPnL, lang, asset.symbol)}
                      </span>
                      <span className="block text-[11px] text-slate-500 mt-1">
                        {asset.sellTradesCount} {lang === 'fa' ? 'معامله فروش' : 'sell orders'}
                      </span>
                    </div>

                    {/* 5. Unrealized P&L */}
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                      <span className="text-slate-400 block mb-1">{t.unrealizedPnL}</span>
                      <span className={`font-mono font-bold text-sm ${
                        asset.unrealizedPnL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}>
                        {formatCurrency(asset.unrealizedPnL, lang, asset.symbol)}
                      </span>
                      <span className="block text-[11px] text-slate-500 mt-1">
                        {t.roi}: {formatPercent(asset.roiPercent, lang)}
                      </span>
                    </div>

                    {/* 6. Breakeven Price with Fees */}
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                      <span className="text-slate-400 block mb-1">{t.breakevenPrice}</span>
                      <span className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100">
                        {formatCurrency(asset.breakevenPrice, lang, asset.symbol)}
                      </span>
                      <span className="block text-[11px] text-slate-500 mt-1">
                        {t.breakevenNotice}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
