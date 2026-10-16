import React, { useState, useRef, useMemo } from 'react';
import { 
  FileDown, 
  FileSpreadsheet, 
  Printer, 
  X, 
  CheckCircle2, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  Coins, 
  Wallet, 
  Layers, 
  ArrowDownRight, 
  ArrowUpRight, 
  AlertCircle,
  PieChart as PieChartIcon,
  BarChart3,
  Activity,
  Download
} from 'lucide-react';
import { TradeRecord, AssetAnalysis, PortfolioSummary, Language } from '../types';
import { WallexAccountBalancesResult } from '../utils/wallexApi';
import { formatCurrency, formatNumber, formatPercent } from '../utils/i18n';
import { formatToJalali, toPersianDigits } from '../utils/jalali';
import { exportReportElementToPdf } from '../utils/pdfExport';
import { exportPnLReportToExcel } from '../utils/excelParser';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  trades: TradeRecord[];
  assets: AssetAnalysis[];
  summary: PortfolioSummary;
  accountBalances?: WallexAccountBalancesResult | null;
  accountLabel?: string;
  onExportExcel?: () => void;
}

// Color palette for charts in PDF
const DONUT_COLORS = [
  '#10b981', // Emerald
  '#0284c7', // Sky Blue
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#6366f1', // Indigo
];

export const ReportExportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  lang,
  trades,
  assets,
  summary,
  accountBalances,
  accountLabel,
  onExportExcel,
}) => {
  const isRtl = lang === 'fa';
  const reportRef = useRef<HTMLDivElement>(null);

  // Export states
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<string>('');
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadBlobUrl, setDownloadBlobUrl] = useState<string | null>(null);
  const [downloadFileName, setDownloadFileName] = useState<string>('');

  // Configuration options for the report
  const [includeCharts, setIncludeCharts] = useState(true);
  const [includeBalances, setIncludeBalances] = useState(true);
  const [includeAssetBreakdown, setIncludeAssetBreakdown] = useState(true);
  const [includeTradeLedger, setIncludeTradeLedger] = useState(true);

  // Metadata
  const reportDate = useMemo(() => new Date(), []);
  const jalaliDateStr = useMemo(() => {
    const raw = formatToJalali(reportDate);
    return isRtl ? toPersianDigits(raw) : raw;
  }, [reportDate, isRtl]);

  // Date range of the trades formatted in Shamsi / Jalali
  const tradeDates = useMemo(() => {
    if (!trades.length) return { start: '-', end: '-' };
    const sorted = [...trades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const startDate = sorted[0]?.date;
    const endDate = sorted[sorted.length - 1]?.date;

    const startJalali = formatToJalali(startDate);
    const endJalali = formatToJalali(endDate);

    return {
      start: isRtl ? toPersianDigits(startJalali || startDate) : (startJalali || startDate),
      end: isRtl ? toPersianDigits(endJalali || endDate) : (endJalali || endDate),
    };
  }, [trades, isRtl]);

  // Chronological trades with running balances
  const chronologicalTrades = useMemo(() => {
    const sorted = [...trades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const runningMap: Record<string, number> = {};
    return sorted.map((t, idx) => {
      const isBuy = t.side === 'BUY';
      const prev = runningMap[t.symbol] || 0;
      const current = isBuy ? prev + t.quantity : prev - t.quantity;
      runningMap[t.symbol] = current;
      return {
        ...t,
        rowNumber: idx + 1,
        runningBalance: current,
      };
    });
  }, [trades]);

  // Include all trades in report ledger
  const displayedTrades = chronologicalTrades;

  // 1. Donut Chart Data Calculation
  const donutData = useMemo(() => {
    const totalCostAll = summary.totalBuyValue || 1;
    const items = assets
      .filter((a) => a.totalBuyCost > 0)
      .sort((a, b) => b.totalBuyCost - a.totalBuyCost)
      .slice(0, 6)
      .map((asset, idx) => {
        const pct = (asset.totalBuyCost / totalCostAll) * 100;
        return {
          symbol: asset.symbol,
          cost: asset.totalBuyCost,
          currency: asset.currency,
          percentage: pct,
          color: DONUT_COLORS[idx % DONUT_COLORS.length],
        };
      });

    return items;
  }, [assets, summary.totalBuyValue]);

  // SVG Donut Arc Paths
  const donutSvgPaths = useMemo(() => {
    if (!donutData.length) return [];
    const cx = 110;
    const cy = 110;
    const r = 85;
    const innerR = 52;
    let accumulatedAngle = -Math.PI / 2;

    return donutData.map((slice) => {
      const angle = (slice.percentage / 100) * 2 * Math.PI;
      const startAngle = accumulatedAngle;
      const endAngle = accumulatedAngle + angle;
      accumulatedAngle = endAngle;

      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);

      const x3 = cx + innerR * Math.cos(endAngle);
      const y3 = cy + innerR * Math.sin(endAngle);
      const x4 = cx + innerR * Math.cos(startAngle);
      const y4 = cy + innerR * Math.sin(startAngle);

      const largeArc = angle > Math.PI ? 1 : 0;

      const d = `
        M ${x1.toFixed(2)} ${y1.toFixed(2)}
        A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}
        L ${x3.toFixed(2)} ${y3.toFixed(2)}
        A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4.toFixed(2)} ${y4.toFixed(2)}
        Z
      `;

      return {
        ...slice,
        d,
      };
    });
  }, [donutData]);

  // 2. Trend Line Calculation for Trade Volume History
  const trendLinePoints = useMemo(() => {
    if (!chronologicalTrades.length) return '';
    const sampleSize = Math.min(24, chronologicalTrades.length);
    const step = Math.max(1, Math.floor(chronologicalTrades.length / sampleSize));
    const sampled: number[] = [];
    let runningVal = 0;

    for (let i = 0; i < chronologicalTrades.length; i += step) {
      runningVal += chronologicalTrades[i].total || 0;
      sampled.push(runningVal);
    }
    if (sampled.length === 0) sampled.push(0);

    const maxVal = Math.max(...sampled, 1);
    const minVal = Math.min(...sampled, 0);
    const range = maxVal - minVal || 1;

    const width = 420;
    const height = 120;
    const paddingX = 20;
    const paddingY = 15;

    const points = sampled.map((val, idx) => {
      const x = paddingX + (idx / Math.max(1, sampled.length - 1)) * (width - 2 * paddingX);
      const y = height - paddingY - ((val - minVal) / range) * (height - 2 * paddingY);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    return points.join(' ');
  }, [chronologicalTrades]);

  // Handle PDF Export
  const handleDownloadPdf = async () => {
    try {
      setIsExportingPdf(true);
      setPdfProgress(isRtl ? 'در حال آماده‌سازی سند گزارش و تبدیل نمودارها...' : 'Preparing report document...');
      setDownloadSuccess(null);
      setDownloadError(null);

      const d = reportDate.toISOString().slice(0, 10).replace(/-/g, '');
      const fileName = `wallex-report-${d}.pdf`;
      setDownloadFileName(fileName);

      const result = await exportReportElementToPdf({
        elementId: 'wallex-designed-pdf-document',
        fileName,
        onProgress: (status) => setPdfProgress(status),
      });

      if (result && result.blobUrl) {
        setDownloadBlobUrl(result.blobUrl);
      }

      setDownloadSuccess(
        isRtl 
          ? `فایل PDF با موفقیت آماده و دانلود شد (${fileName}).` 
          : `PDF file (${fileName}) generated and downloaded successfully.`
      );
    } catch (err: any) {
      console.error('PDF export error:', err);
      setDownloadError(err?.message || (isRtl ? 'خطا در ایجاد و دانلود فایل PDF' : 'Error generating PDF file'));
    } finally {
      setIsExportingPdf(false);
      setPdfProgress('');
    }
  };

  // Handle Excel Export
  const handleDownloadExcel = () => {
    if (onExportExcel) {
      onExportExcel();
    } else {
      exportPnLReportToExcel(trades, assets, summary);
    }
    setDownloadSuccess(isRtl ? 'فایل گزارش اکسل دانلود شد.' : 'Excel report downloaded.');
    setTimeout(() => setDownloadSuccess(null), 4000);
  };

  // Handle Browser Native Print
  const handleNativePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div 
        className="relative w-full max-w-5xl my-4 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        {/* Top Modal Header & Primary Actions */}
        <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500 flex items-center justify-center text-slate-950 shadow-md shadow-emerald-500/20">
              <FileDown className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>{isRtl ? 'مرکز صدور خروجی PDF و گزارش مالی' : 'Financial PDF Report Hub'}</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isRtl 
                  ? 'تهیه گزارش رسمی و تحلیلی PDF شامل نمودارها، خلاصه بالانس، نقطه سر‌به‌سر و صورتحساب معاملات' 
                  : 'High-res PDF report with charts, breakeven formulas, balance summary & trade ledger'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
            {/* Download PDF Button */}
            <button
              id="export-pdf-action-btn"
              type="button"
              disabled={isExportingPdf}
              onClick={handleDownloadPdf}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white text-xs sm:text-sm font-black shadow-md shadow-emerald-600/25 active:scale-95 transition cursor-pointer disabled:opacity-60"
            >
              <FileDown className={`w-4 h-4 ${isExportingPdf ? 'animate-bounce' : ''}`} />
              <span>{isExportingPdf ? (pdfProgress || (isRtl ? 'در حال ساخت فایل...' : 'Generating...')) : (isRtl ? 'دانلود فایل PDF' : 'Download PDF')}</span>
            </button>

            {/* Download Excel Button */}
            <button
              id="export-excel-modal-btn"
              type="button"
              onClick={handleDownloadExcel}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300/80 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>{isRtl ? 'اکسل' : 'Excel'}</span>
            </button>

            {/* Print Button */}
            <button
              type="button"
              onClick={handleNativePrint}
              title={isRtl ? 'چاپ مرورگر / ذخیره با چاپگر سیستم' : 'Print via browser'}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer ms-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Success Feedback & Direct Download Link */}
        {downloadSuccess && (
          <div className="mx-4 mt-3 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{downloadSuccess}</span>
            </div>
            {downloadBlobUrl && (
              <a
                href={downloadBlobUrl}
                download={downloadFileName || 'wallex-financial-report.pdf'}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px] hover:bg-emerald-700 transition"
              >
                <Download className="w-3 h-3" />
                <span>{isRtl ? 'دانلود مجدد فایل' : 'Download Again'}</span>
              </a>
            )}
          </div>
        )}

        {/* Error Feedback Banner */}
        {downloadError && (
          <div className="mx-4 mt-3 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-500/30 text-xs text-rose-800 dark:text-rose-300 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{downloadError}</span>
            </div>
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold text-[11px] hover:bg-rose-700 transition"
            >
              {isRtl ? 'تلاش مجدد' : 'Retry'}
            </button>
          </div>
        )}

        {/* Report Customization Controls Bar (Selectors 5 & 6 limit removed as requested) */}
        <div className="px-4 py-2.5 bg-slate-100/70 dark:bg-slate-800/50 border-b border-slate-200/80 dark:border-slate-800 text-xs flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="font-bold text-slate-600 dark:text-slate-400">
              {isRtl ? 'تنظیمات محتوای گزارش:' : 'Report Options:'}
            </span>

            <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300 select-none">
              <input 
                type="checkbox" 
                checked={includeCharts} 
                onChange={(e) => setIncludeCharts(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500" 
              />
              <span>{isRtl ? 'نمودارهای بصری' : 'Charts'}</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300 select-none">
              <input 
                type="checkbox" 
                checked={includeBalances} 
                onChange={(e) => setIncludeBalances(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500" 
              />
              <span>{isRtl ? 'بالانس لحظه‌ای حساب' : 'Wallex Balances'}</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300 select-none">
              <input 
                type="checkbox" 
                checked={includeAssetBreakdown} 
                onChange={(e) => setIncludeAssetBreakdown(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500" 
              />
              <span>{isRtl ? 'تفکیک ارزها و نقطه سر‌به‌سر' : 'Asset Breakdown'}</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300 select-none">
              <input 
                type="checkbox" 
                checked={includeTradeLedger} 
                onChange={(e) => setIncludeTradeLedger(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500" 
              />
              <span>{isRtl ? 'صورتحساب ریز معاملات' : 'Trades Ledger'}</span>
            </label>
          </div>

          <div className="text-[11px] font-mono font-bold text-slate-500">
            {isRtl ? `شامل تمامی ${trades.length} معامله` : `All ${trades.length} trades included`}
          </div>
        </div>

        {/* Scrollable Preview Container for the High-Fidelity Report */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-200/60 dark:bg-slate-950/60">
          <div className="max-w-[1020px] mx-auto shadow-xl rounded-2xl overflow-hidden bg-white text-slate-900">
            
            {/* The Dedicated Printable & PDF Target Element */}
            <div 
              id="wallex-designed-pdf-document" 
              ref={reportRef}
              className="bg-white text-slate-900 p-8 sm:p-10 space-y-7 font-sans"
              dir={isRtl ? 'rtl' : 'ltr'}
              style={{ minHeight: '1100px' }}
            >
              {/* Document Header (Cleaned up: Report ID and API subtitle removed per Selectors 2, 3, 4) */}
              <div className="border-b-2 border-emerald-600 pb-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  {/* Left Brand Branding */}
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-cyan-600 flex items-center justify-center text-white shadow-md">
                      <TrendingUp className="w-7 h-7 stroke-[2.5]" />
                    </div>
                    <div>
                      <h1 className="text-xl font-black tracking-tight text-slate-900">
                        {isRtl ? 'گزارش رسمی و تحلیلی معاملات و سود/زیان' : 'Official Financial & Trade Audit Report'}
                      </h1>
                    </div>
                  </div>

                  {/* Document Meta Info Stamp (Report ID removed per Selector 2) */}
                  <div className="text-end text-xs space-y-1 font-mono text-slate-600">
                    <div>
                      <span className="font-sans text-[11px] text-slate-500">{isRtl ? 'تاریخ صدور شمسی:' : 'Jalali Date:'} </span>
                      <span className="font-bold text-slate-900">{jalaliDateStr}</span>
                    </div>
                    <div>
                      <span className="font-sans text-[11px] text-slate-500">{isRtl ? 'میلادی:' : 'Gregorian:'} </span>
                      <span>{reportDate.toISOString().replace('T', ' ').substring(0, 19)}</span>
                    </div>
                    <div>
                      <span className="font-sans text-[11px] text-slate-500">{isRtl ? 'حساب مبدأ:' : 'Account:'} </span>
                      <span className="font-bold text-emerald-700">{accountLabel || 'والکس (کلید خصوصی)'}</span>
                    </div>
                  </div>
                </div>

                {/* Scope & Audit Summary Bar (Selector 1: Date is now formatted in Shamsi) */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                      <strong className="text-slate-700">{isRtl ? 'بازه زمانی استخراج‌شده:' : 'Time Scope:'}</strong>
                      <span className="font-mono font-bold text-slate-900">{tradeDates.start} {isRtl ? 'تا' : 'to'} {tradeDates.end}</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-3 font-mono font-bold text-slate-700">
                    <span>{trades.length} {isRtl ? 'معامله ثبت‌شده' : 'trades'}</span>
                    <span>•</span>
                    <span>{assets.length} {isRtl ? 'نماد ارزی' : 'assets'}</span>
                  </div>
                </div>
              </div>

              {/* 1. Executive Summary & KPIs */}
              <div className="space-y-3">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2 border-s-4 border-emerald-600 ps-2.5">
                  <span>{isRtl ? '۱. خلاصه شاخص‌های مالی و عملکرد پورتفوی' : '1. Executive Portfolio Metrics'}</span>
                </h3>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {/* Card 1: Live Balances (if available) */}
                  {includeBalances && accountBalances ? (
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                      <span className="text-[11px] font-bold text-slate-500 block">
                        {isRtl ? 'ارزش کل بالانس کیف پول' : 'Total Wallet Balance'}
                      </span>
                      <div className="text-base font-black font-mono text-emerald-700">
                        {formatCurrency(accountBalances.totalPortfolioTmn, lang, 'TMN')}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        ≈ {formatCurrency(accountBalances.totalPortfolioUsd, lang, 'USD')} ({accountBalances.activeAssetsCount} دارایی)
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                      <span className="text-[11px] font-bold text-slate-500 block">
                        {isRtl ? 'تعداد کل معاملات' : 'Total Trades'}
                      </span>
                      <div className="text-base font-black font-mono text-slate-900">
                        {trades.length}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {summary.openPositionsCount} موقعیت باز
                      </div>
                    </div>
                  )}

                  {/* Card 2: Net P&L */}
                  <div className={`p-3.5 rounded-xl border space-y-1 ${
                    summary.totalNetPnL >= 0 
                      ? 'bg-emerald-50/70 border-emerald-300 text-emerald-900' 
                      : 'bg-rose-50/70 border-rose-300 text-rose-900'
                  }`}>
                    <span className="text-[11px] font-bold text-slate-600 block">
                      {isRtl ? 'سود / زیان خالص کل' : 'Total Net P&L'}
                    </span>
                    <div className={`text-base font-black font-mono ${
                      summary.totalNetPnL >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}>
                      {summary.totalNetPnL >= 0 ? '+' : ''}{formatCurrency(summary.totalNetPnL, lang, summary.primaryCurrency)}
                    </div>
                    <div className="text-[10px] font-bold font-mono">
                      بازدهی کل: {formatPercent(summary.netPortfolioReturn, lang)}
                    </div>
                  </div>

                  {/* Card 3: Total Inflow vs Outflow */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <span className="text-[11px] font-bold text-slate-500 block">
                      {isRtl ? 'حجم کل ورودی (خرید)' : 'Total Buy Inflow'}
                    </span>
                    <div className="text-base font-black font-mono text-slate-900">
                      {formatCurrency(summary.totalBuyValue, lang, summary.primaryCurrency)}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      خروجی (فروش): {formatCurrency(summary.totalSellValue, lang, summary.primaryCurrency)}
                    </div>
                  </div>

                  {/* Card 4: Total Fees */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <span className="text-[11px] font-bold text-slate-500 block">
                      {isRtl ? 'مجموع کارمزد پرداختی' : 'Total Fees Paid'}
                    </span>
                    <div className="text-base font-black font-mono text-amber-700">
                      {formatCurrency(summary.totalFeesPaid, lang, summary.primaryCurrency)}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      محاسبه دقیق کارمزد خرید و فروش
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Visual Charts & Distribution Section (Enhanced with Real Vector SVG Charts for PDF export) */}
              {includeCharts && (
                <div className="space-y-4 pt-2">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2 border-s-4 border-cyan-600 ps-2.5">
                    <span>{isRtl ? '۲. نمودارهای تحلیلی توزیع دارایی‌ها و جریان نقدی' : '2. Portfolio Visual Analytics & Cash Flow'}</span>
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Chart 1: Donut Chart for Asset Allocation */}
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
                      <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <PieChartIcon className="w-3.5 h-3.5 text-cyan-600" />
                          <span>{isRtl ? 'نمودار توزیع پورتفوی بر مبنای ارزش دارایی‌ها' : 'Asset Allocation Distribution'}</span>
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">{donutData.length} دارایی برتر</span>
                      </div>

                      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
                        {/* SVG Donut Graphic */}
                        <div className="relative w-[180px] h-[180px] shrink-0">
                          <svg width="180" height="180" viewBox="0 0 220 220" className="overflow-visible">
                            {donutSvgPaths.length > 0 ? (
                              donutSvgPaths.map((slice, i) => (
                                <path
                                  key={i}
                                  d={slice.d}
                                  fill={slice.color}
                                  stroke="#ffffff"
                                  strokeWidth="2"
                                  className="transition-all hover:opacity-90"
                                />
                              ))
                            ) : (
                              <circle cx="110" cy="110" r="70" fill="none" stroke="#e2e8f0" strokeWidth="25" />
                            )}
                            {/* Center hole text */}
                            <circle cx="110" cy="110" r="48" fill="#ffffff" />
                            <text
                              x="110"
                              y="105"
                              textAnchor="middle"
                              className="text-[11px] font-bold fill-slate-500 font-sans"
                            >
                              {isRtl ? 'ارزش کل' : 'Total'}
                            </text>
                            <text
                              x="110"
                              y="125"
                              textAnchor="middle"
                              className="text-[10px] font-black fill-slate-800 font-mono"
                            >
                              {summary.primaryCurrency}
                            </text>
                          </svg>
                        </div>

                        {/* Legend */}
                        <div className="flex-1 w-full space-y-1.5 text-xs">
                          {donutData.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-[11px]">
                              <div className="flex items-center gap-1.5">
                                <span 
                                  className="w-2.5 h-2.5 rounded-full shrink-0" 
                                  style={{ backgroundColor: item.color }} 
                                />
                                <span className="font-bold text-slate-900 font-mono">{item.symbol}</span>
                              </div>
                              <div className="font-mono text-slate-600 flex items-center gap-1.5">
                                <span className="font-bold text-slate-800">{item.percentage.toFixed(1)}%</span>
                                <span className="text-[10px] text-slate-400">({formatCurrency(item.cost, lang, item.currency)})</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Chart 2: Cash Flow Inflow vs Outflow Comparison Bar Chart */}
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
                      <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <BarChart3 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{isRtl ? 'نمودار مقایسه تراز نقدینگی خرید و فروش' : 'Cash Flow Balance Comparison'}</span>
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {summary.totalNetPnL >= 0 ? 'تراز مثبت' : 'تراز منفی'}
                        </span>
                      </div>

                      {/* SVG Bar Chart Graphic */}
                      <div className="pt-2 flex justify-center">
                        <svg width="380" height="150" viewBox="0 0 380 150" style={{ width: '100%', maxWidth: '380px', height: '150px' }} className="overflow-visible">
                          {/* Grid horizontal lines */}
                          <line x1="40" y1="20" x2="360" y2="20" stroke="#e2e8f0" strokeDasharray="3 3" />
                          <line x1="40" y1="60" x2="360" y2="60" stroke="#e2e8f0" strokeDasharray="3 3" />
                          <line x1="40" y1="100" x2="360" y2="100" stroke="#e2e8f0" strokeDasharray="3 3" />
                          <line x1="40" y1="120" x2="360" y2="120" stroke="#cbd5e1" strokeWidth="1.5" />

                          {(() => {
                            const maxVal = Math.max(summary.totalBuyValue, summary.totalSellValue, summary.totalFeesPaid, 1);
                            const buyH = Math.max(10, (summary.totalBuyValue / maxVal) * 90);
                            const sellH = Math.max(10, (summary.totalSellValue / maxVal) * 90);
                            const feeH = Math.max(8, (summary.totalFeesPaid / maxVal) * 90);

                            return (
                              <>
                                {/* Buy Bar */}
                                <g>
                                  <rect
                                    x="80"
                                    y={120 - buyH}
                                    width="50"
                                    height={buyH}
                                    rx="5"
                                    fill="#10b981"
                                  />
                                  <text x="105" y={112 - buyH} textAnchor="middle" className="text-[9px] font-bold fill-emerald-800 font-mono">
                                    {formatCurrency(summary.totalBuyValue, lang, summary.primaryCurrency)}
                                  </text>
                                  <text x="105" y="136" textAnchor="middle" className="text-[10px] font-bold fill-slate-700 font-sans">
                                    {isRtl ? 'ورودی خرید' : 'Buy'}
                                  </text>
                                </g>

                                {/* Sell Bar */}
                                <g>
                                  <rect
                                    x="170"
                                    y={120 - sellH}
                                    width="50"
                                    height={sellH}
                                    rx="5"
                                    fill="#f43f5e"
                                  />
                                  <text x="195" y={112 - sellH} textAnchor="middle" className="text-[9px] font-bold fill-rose-800 font-mono">
                                    {formatCurrency(summary.totalSellValue, lang, summary.primaryCurrency)}
                                  </text>
                                  <text x="195" y="136" textAnchor="middle" className="text-[10px] font-bold fill-slate-700 font-sans">
                                    {isRtl ? 'خروجی فروش' : 'Sell'}
                                  </text>
                                </g>

                                {/* Fee Bar */}
                                <g>
                                  <rect
                                    x="260"
                                    y={120 - feeH}
                                    width="50"
                                    height={feeH}
                                    rx="5"
                                    fill="#f59e0b"
                                  />
                                  <text x="285" y={112 - feeH} textAnchor="middle" className="text-[9px] font-bold fill-amber-800 font-mono">
                                    {formatCurrency(summary.totalFeesPaid, lang, summary.primaryCurrency)}
                                  </text>
                                  <text x="285" y="136" textAnchor="middle" className="text-[10px] font-bold fill-slate-700 font-sans">
                                    {isRtl ? 'کارمزد کل' : 'Fees'}
                                  </text>
                                </g>
                              </>
                            );
                          })()}
                        </svg>
                      </div>

                      <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-600 flex justify-between">
                        <span>{isRtl ? 'مجموع کارمزد پرداختی معاملات:' : 'Total Trading Fees Paid:'}</span>
                        <span className="font-mono font-bold text-amber-700">
                          {formatCurrency(summary.totalFeesPaid, lang, summary.primaryCurrency)}
                        </span>
                      </div>
                    </div>

                  </div>

                  {/* Chart 3: Historical Cumulative Trade Volume Progression */}
                  {chronologicalTrades.length > 1 && (
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
                      <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5 text-indigo-600" />
                          <span>{isRtl ? 'نمودار پیوسته روند تجمیعی ارزش معاملات در طول زمان' : 'Cumulative Trade Volume Trend'}</span>
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {chronologicalTrades.length} معامله
                        </span>
                      </div>

                      <div className="pt-2 flex justify-center">
                        <svg width="460" height="130" viewBox="0 0 460 130" style={{ width: '100%', maxWidth: '460px', height: '130px' }} className="overflow-visible">
                          <defs>
                            <linearGradient id="trendGradientPdf" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                            </linearGradient>
                          </defs>

                          {/* Gridlines */}
                          <line x1="20" y1="20" x2="440" y2="20" stroke="#f1f5f9" />
                          <line x1="20" y1="60" x2="440" y2="60" stroke="#f1f5f9" />
                          <line x1="20" y1="100" x2="440" y2="100" stroke="#f1f5f9" />
                          <line x1="20" y1="110" x2="440" y2="110" stroke="#cbd5e1" strokeWidth="1" />

                          {/* Spline Area & Line */}
                          {trendLinePoints && (
                            <>
                              <polygon
                                points={`20,110 ${trendLinePoints} 440,110`}
                                fill="url(#trendGradientPdf)"
                              />
                              <polyline
                                points={trendLinePoints}
                                fill="none"
                                stroke="#10b981"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </>
                          )}

                          {/* Start and End Date Labels */}
                          <text x="20" y="124" className="text-[9px] fill-slate-400 font-mono font-bold">
                            {tradeDates.start}
                          </text>
                          <text x="440" y="124" textAnchor="end" className="text-[9px] fill-slate-400 font-mono font-bold">
                            {tradeDates.end}
                          </text>
                        </svg>
                      </div>
                    </div>
                  )}

                </div>
              )}

              {/* 3. Asset-by-Asset Breakeven & P&L Analysis */}
              {includeAssetBreakdown && (
                <div className="space-y-3 pt-2">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2 border-s-4 border-amber-600 ps-2.5">
                    <span>{isRtl ? '۳. جدول تحلیل نقطه سر‌به‌سر و سود/زیان هر نماد' : '3. Asset Performance & Breakeven Ledger'}</span>
                  </h3>

                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-xs text-start">
                      <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                        <tr>
                          <th className="py-2.5 px-3 text-start">نماد</th>
                          <th className="py-2.5 px-3 text-end">قیمت سر‌به‌سر</th>
                          <th className="py-2.5 px-3 text-end">قیمت بازار</th>
                          <th className="py-2.5 px-3 text-end">میانگین خرید</th>
                          <th className="py-2.5 px-3 text-end">مانده موجودی باز</th>
                          <th className="py-2.5 px-3 text-end">کارمزد کل</th>
                          <th className="py-2.5 px-3 text-end">سود/زیان نهایی</th>
                          <th className="py-2.5 px-3 text-center">وضعیت</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                        {assets.map((a) => {
                          const isProfit = a.netPnL >= 0;
                          return (
                            <tr key={a.symbol} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-bold text-slate-900">{a.symbol}</td>
                              <td className="py-2 px-3 text-end font-bold text-amber-700 bg-amber-50/40">
                                {formatCurrency(a.breakevenPrice, lang, a.currency)}
                              </td>
                              <td className="py-2 px-3 text-end text-slate-700">
                                {formatCurrency(a.currentPrice, lang, a.currency)}
                              </td>
                              <td className="py-2 px-3 text-end text-slate-600">
                                {formatCurrency(a.avgBuyPrice, lang, a.currency)}
                              </td>
                              <td className="py-2 px-3 text-end font-bold text-slate-900">
                                {formatNumber(a.netQty, lang)}
                              </td>
                              <td className="py-2 px-3 text-end text-slate-500">
                                {formatCurrency(a.totalFees, lang, a.currency)}
                              </td>
                              <td className={`py-2 px-3 text-end font-black ${
                                isProfit ? 'text-emerald-700' : 'text-rose-700'
                              }`}>
                                {isProfit ? '+' : ''}{formatCurrency(a.netPnL, lang, a.currency)}
                              </td>
                              <td className="py-2 px-3 text-center font-sans font-bold">
                                <span className={`px-2 py-0.5 rounded text-[10px] ${
                                  a.isClosed 
                                    ? 'bg-slate-100 text-slate-600'
                                    : isProfit 
                                      ? 'bg-emerald-100 text-emerald-800' 
                                      : 'bg-rose-100 text-rose-800'
                                }`}>
                                  {a.isClosed ? 'بسته‌شده' : (isProfit ? 'سودده' : 'زیان‌ده')}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 4. Comprehensive Trades Ledger (All Trades Included) */}
              {includeTradeLedger && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2 border-s-4 border-indigo-600 ps-2.5">
                      <span>{isRtl ? '۴. صورتحساب گردش معاملات و مانده موجودی' : '4. Detailed Trades Ledger'}</span>
                    </h3>
                    <span className="text-xs font-mono text-slate-500">
                      {trades.length} {isRtl ? 'معامله ثبت‌شده' : 'trades'}
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-xs text-start">
                      <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[10px]">
                        <tr>
                          <th className="py-2 px-2.5 text-center">ردیف</th>
                          <th className="py-2 px-2.5 text-start">تاریخ و ساعت</th>
                          <th className="py-2 px-2.5 text-start">نماد</th>
                          <th className="py-2 px-2.5 text-center">نوع</th>
                          <th className="py-2 px-2.5 text-end">قیمت واحد</th>
                          <th className="py-2 px-2.5 text-end text-emerald-800 bg-emerald-50/50">ورودی (خرید)</th>
                          <th className="py-2 px-2.5 text-end text-rose-800 bg-rose-50/50">خروجی (فروش)</th>
                          <th className="py-2 px-2.5 text-end font-bold bg-slate-200/50">مانده سهم</th>
                          <th className="py-2 px-2.5 text-end">کارمزد</th>
                          <th className="py-2 px-2.5 text-end">ارزش کل</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-[10px]">
                        {displayedTrades.map((t) => {
                          const isBuy = t.side === 'BUY';
                          const dateDisplay = isRtl ? toPersianDigits(formatToJalali(t.date) || t.date) : t.date;
                          return (
                            <tr key={t.id || t.orderId} className="hover:bg-slate-50">
                              <td className="py-1.5 px-2.5 text-center text-slate-400 font-mono">{t.rowNumber}</td>
                              <td className="py-1.5 px-2.5 text-start text-slate-600 whitespace-nowrap">{dateDisplay}</td>
                              <td className="py-1.5 px-2.5 text-start font-bold text-slate-900">{t.symbol}</td>
                              <td className="py-1.5 px-2.5 text-center font-sans font-bold">
                                <span className={`px-1.5 py-0.5 rounded text-[9px] ${
                                  isBuy ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                }`}>
                                  {isBuy ? 'خرید' : 'فروش'}
                                </span>
                              </td>
                              <td className="py-1.5 px-2.5 text-end text-slate-700">
                                {formatNumber(t.price, lang)}
                              </td>
                              <td className="py-1.5 px-2.5 text-end font-bold text-emerald-700 bg-emerald-50/20">
                                {isBuy ? `+${formatNumber(t.quantity, lang)}` : '-'}
                              </td>
                              <td className="py-1.5 px-2.5 text-end font-bold text-rose-700 bg-rose-50/20">
                                {!isBuy ? `-${formatNumber(t.quantity, lang)}` : '-'}
                              </td>
                              <td className="py-1.5 px-2.5 text-end font-bold text-slate-900 bg-slate-50">
                                {formatNumber(t.runningBalance, lang)}
                              </td>
                              <td className="py-1.5 px-2.5 text-end text-slate-500">
                                {formatNumber(t.fee, lang)}
                              </td>
                              <td className="py-1.5 px-2.5 text-end font-bold text-slate-800">
                                {formatNumber(t.total, lang)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 border-t border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              {isRtl 
                ? 'فایل خروجی PDF به صورت چندصفحه‌ای A4 و سازگار با چاپگر و آرشیو اداری ذخیره خواهد شد.'
                : 'PDF will be generated with standard multi-page A4 sizing suitable for archiving.'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              {isRtl ? 'بستن پنجره' : 'Close'}
            </button>

            <button
              type="button"
              disabled={isExportingPdf}
              onClick={handleDownloadPdf}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-md shadow-emerald-600/25 transition cursor-pointer disabled:opacity-60"
            >
              <FileDown className="w-4 h-4" />
              <span>{isRtl ? 'دانلود مستقیم فایل PDF' : 'Download PDF Now'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
