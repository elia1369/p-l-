import React, { useState, useEffect } from 'react';
import { Calculator, X, TrendingUp, TrendingDown, Target, Sparkles } from 'lucide-react';
import { AssetAnalysis, Language } from '../types';
import { translations, formatCurrency, formatPercent, formatNumber } from '../utils/i18n';
import { CurrencyLogo } from './CurrencyLogo';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  asset: AssetAnalysis | null;
  lang: Language;
}

export const WhatIfSimulatorModal: React.FC<Props> = ({
  isOpen,
  onClose,
  asset,
  lang,
}) => {
  if (!isOpen || !asset) return null;
  const t = translations[lang];

  const [targetPrice, setTargetPrice] = useState<number>(asset.currentPrice || asset.breakevenPrice || 100);
  const [estimatedExitFeePercent, setEstimatedExitFeePercent] = useState<number>(0.1); // 0.1% typical exchange fee

  useEffect(() => {
    if (asset) {
      setTargetPrice(asset.currentPrice || asset.breakevenPrice || 100);
    }
  }, [asset]);

  const netQty = Math.abs(asset.netQty);
  const totalExitRevenue = targetPrice * netQty;
  const estimatedExitFee = (totalExitRevenue * estimatedExitFeePercent) / 100;
  
  // Projected Net P&L from selling remaining position at target price
  // Projected Unrealized = (targetPrice - asset.breakevenPrice) * asset.netQty - estimatedExitFee
  const projectedPositionPnL = (targetPrice - asset.breakevenPrice) * asset.netQty - estimatedExitFee;
  const projectedTotalNetPnL = asset.realizedPnL + projectedPositionPnL;
  const isProfit = projectedTotalNetPnL >= 0;

  const diffFromBreakeven = asset.breakevenPrice > 0 
    ? ((targetPrice - asset.breakevenPrice) / asset.breakevenPrice) * 100 
    : 0;

  return (
    <div 
      id="simulator-modal-backdrop" 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        id="simulator-modal-content"
        dir={lang === 'fa' ? 'rtl' : 'ltr'}
        className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl transition-all"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>{t.simulatorTitle}</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 text-sm font-semibold">({asset.symbol})</span>
                <CurrencyLogo symbolOrCurrency={asset.symbol} lang={lang} size="xs" />
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t.simulatorDesc}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current State Quick Summary */}
        <div className="grid grid-cols-2 gap-3 my-5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs">
          <div>
            <span className="text-slate-500 dark:text-slate-400 block">{t.netPosition}</span>
            <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
              {formatNumber(asset.netQty, lang)}
            </span>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400 block">{t.breakevenPrice}</span>
            <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
              {formatCurrency(asset.breakevenPrice, lang, asset.symbol)}
            </span>
          </div>
        </div>

        {/* Input: Target Exit Price */}
        <div className="space-y-3 mb-6">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
            <span>{t.targetPrice}</span>
            <span className={`font-mono font-bold ${
              diffFromBreakeven >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}>
              {formatPercent(diffFromBreakeven, lang)} {lang === 'fa' ? 'نسبت به سر‌به‌سر' : 'vs breakeven'}
            </span>
          </label>

          <div className="relative">
            <input
              id="simulator-target-price-input"
              type="number"
              step="any"
              value={targetPrice || ''}
              onChange={e => setTargetPrice(parseFloat(e.target.value) || 0)}
              className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono text-base font-bold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden text-left"
              dir="ltr"
            />
          </div>

          {/* Quick Target Multipliers */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => setTargetPrice(asset.breakevenPrice)}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
            >
              {lang === 'fa' ? 'قیمت سر‌به‌سر' : 'Breakeven'}
            </button>
            <button
              type="button"
              onClick={() => setTargetPrice(asset.breakevenPrice * 1.05)}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 transition cursor-pointer"
            >
              +5%
            </button>
            <button
              type="button"
              onClick={() => setTargetPrice(asset.breakevenPrice * 1.10)}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 transition cursor-pointer"
            >
              +10%
            </button>
            <button
              type="button"
              onClick={() => setTargetPrice(asset.breakevenPrice * 1.25)}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 transition cursor-pointer"
            >
              +25%
            </button>
          </div>
        </div>

        {/* Projected Outcome Card */}
        <div className={`p-4 rounded-xl border transition-all ${
          isProfit 
            ? 'bg-emerald-500/10 border-emerald-500/30' 
            : 'bg-rose-500/10 border-rose-500/30'
        }`}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-semibold text-slate-600 dark:text-slate-300">
              {t.projectedPnL}
            </span>
            <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
              isProfit 
                ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' 
                : 'bg-rose-500/20 text-rose-700 dark:text-rose-300'
            }`}>
              {isProfit ? (lang === 'fa' ? 'سود پیش‌بینی‌شده' : 'Projected Profit') : (lang === 'fa' ? 'زیان پیش‌بینی‌شده' : 'Projected Loss')}
            </span>
          </div>

          <div className={`text-2xl sm:text-3xl font-black font-mono tracking-tight my-2 ${
            isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
          }`}>
            {formatCurrency(projectedTotalNetPnL, lang, asset.symbol)}
          </div>

          <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200/40 dark:border-slate-800/60 text-slate-500 dark:text-slate-400">
            <span>{lang === 'fa' ? 'کارمزد تخمینی خروج:' : 'Estimated Exit Fee:'}</span>
            <span className="font-mono text-amber-600 dark:text-amber-400 font-semibold">
              {formatCurrency(estimatedExitFee, lang, asset.symbol)} (0.1%)
            </span>
          </div>
        </div>

        {/* Modal Action */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-xs font-semibold transition cursor-pointer"
          >
            {lang === 'fa' ? 'بستن شبیه‌ساز' : 'Close Simulator'}
          </button>
        </div>
      </div>
    </div>
  );
};
