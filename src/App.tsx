import React, { useState, useEffect, useMemo } from 'react';
import { Navbar } from './components/Navbar';
import { FileUploadArea } from './components/FileUploadArea';
import { OverviewCards } from './components/OverviewCards';
import { PortfolioCharts } from './components/PortfolioCharts';
import { AssetAnalyzer } from './components/AssetAnalyzer';
import { TradesTable } from './components/TradesTable';
import { PiiShieldModal } from './components/PiiShieldModal';
import { WhatIfSimulatorModal } from './components/WhatIfSimulatorModal';
import { 
  TradeRecord, 
  Language, 
  ThemeMode, 
  PIIReport, 
  AssetAnalysis 
} from './types';
import { 
  calculateAssetAnalyses, 
  calculatePortfolioSummary 
} from './utils/calculations';
import { 
  parseExcelFile, 
  getDemoTrades, 
  exportPnLReportToExcel 
} from './utils/excelParser';
import { translations } from './utils/i18n';
import { ShieldCheck, Sparkles, CheckCircle2 } from 'lucide-react';

export default function App() {
  // 1. Core State
  const [lang, setLang] = useState<Language>('fa');
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [customPrices, setCustomPrices] = useState<Record<string, number>>({
    'BTC/USDT': 97200,
    'ETH/USDT': 3450,
    'SOL/USDT': 215,
    'PAXG/USDT': 2920,
    'ICP/TMN': 690000,
  });
  const [piiReport, setPiiReport] = useState<PIIReport | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | undefined>(undefined);
  const [isLoadingFile, setIsLoadingFile] = useState<boolean>(false);

  // Modals state
  const [isPiiModalOpen, setIsPiiModalOpen] = useState(false);
  const [simulatorAsset, setSimulatorAsset] = useState<AssetAnalysis | null>(null);

  // 2. Initialize with Demo Trades on first mount so app looks rich and ready
  useEffect(() => {
    const demoTrades = getDemoTrades();
    setTrades(demoTrades);
    setPiiReport({
      columnsSanitized: ['Account_Number', 'Client_National_ID', 'User_IP'],
      rowsScanned: demoTrades.length,
      sensitiveValuesDetected: 33,
      clientOnlyVerified: true,
      scanTimestamp: new Date().toLocaleTimeString(),
    });
    setUploadedFileName('demo_trades_portfolio.xlsx');
  }, []);

  // 3. Sync Language & RTL direction
  useEffect(() => {
    document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  // 4. Sync Dark/Light Mode
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleLanguage = () => {
    setLang(prev => (prev === 'fa' ? 'en' : 'fa'));
  };

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  // 5. Excel File Handler
  const handleFileSelected = async (file: File) => {
    setIsLoadingFile(true);
    try {
      const result = await parseExcelFile(file);
      setTrades(result.trades);
      setPiiReport(result.piiReport);
      setUploadedFileName(result.fileName);
      
      // Auto-open PII modal if sensitive columns were found
      if (result.piiReport.columnsSanitized.length > 0) {
        setIsPiiModalOpen(true);
      }
    } catch (err: any) {
      alert(err?.message || (lang === 'fa' ? 'خطا در خواندن فایل اکسل' : 'Error parsing Excel file'));
    } finally {
      setIsLoadingFile(false);
    }
  };

  const handleLoadDemo = () => {
    const demoTrades = getDemoTrades();
    setTrades(demoTrades);
    setPiiReport({
      columnsSanitized: ['Account_Number', 'Client_National_ID', 'User_IP'],
      rowsScanned: demoTrades.length,
      sensitiveValuesDetected: 33,
      clientOnlyVerified: true,
      scanTimestamp: new Date().toLocaleTimeString(),
    });
    setUploadedFileName('demo_trades_portfolio.xlsx');
  };

  const handleClearData = () => {
    setTrades([]);
    setPiiReport(null);
    setUploadedFileName(undefined);
  };

  // 6. Real-time Market Price Update
  const handleUpdatePrice = (symbol: string, newPrice: number) => {
    setCustomPrices(prev => ({
      ...prev,
      [symbol]: newPrice,
    }));
  };

  // 7. Manual Trade Operations
  const handleAddTrade = (newTrade: Omit<TradeRecord, 'id'>) => {
    const tradeWithId: TradeRecord = {
      ...newTrade,
      id: `trade-${Date.now()}-${Math.random()}`,
    };
    setTrades(prev => [tradeWithId, ...prev]);
  };

  const handleDeleteTrade = (id: string) => {
    setTrades(prev => prev.filter(t => t.id !== id));
  };

  const handleToggleTradeSide = (id: string) => {
    setTrades(prev => prev.map(t => {
      if (t.id === id) {
        return {
          ...t,
          side: t.side === 'BUY' ? 'SELL' : 'BUY',
        };
      }
      return t;
    }));
  };

  const handleApplyManualData = (newTrades: TradeRecord[], symbol: string, _currency: string) => {
    setTrades(newTrades);
    setUploadedFileName(`دستی_${symbol.replace('/', '_')}`);
    setPiiReport({
      columnsSanitized: [],
      rowsScanned: newTrades.length,
      sensitiveValuesDetected: 0,
      clientOnlyVerified: true,
      scanTimestamp: new Date().toLocaleTimeString(),
    });
  };

  // 8. Derived Calculations
  const assetAnalyses = useMemo(() => {
    return calculateAssetAnalyses(trades, customPrices);
  }, [trades, customPrices]);

  const portfolioSummary = useMemo(() => {
    return calculatePortfolioSummary(assetAnalyses, trades);
  }, [assetAnalyses, trades]);

  // 9. Export to Excel
  const handleExportExcel = () => {
    exportPnLReportToExcel(trades, assetAnalyses, portfolioSummary);
  };

  const t = translations[lang];

  return (
    <div 
      className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200"
      dir={lang === 'fa' ? 'rtl' : 'ltr'}
    >
      {/* Navigation Bar */}
      <Navbar
        lang={lang}
        onToggleLang={toggleLanguage}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenPiiModal={() => setIsPiiModalOpen(true)}
        piiReport={piiReport}
        onLoadDemo={handleLoadDemo}
        onClear={handleClearData}
        hasTrades={trades.length > 0}
        onExportExcel={handleExportExcel}
      />

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6 sm:space-y-8">
        {/* PII Privacy Shield Notification Banner */}
        <div className="flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-medium leading-relaxed">
              {lang === 'fa' 
                ? 'امنیت PII تضمین شده: کلیه پردازش‌های فایل اکسل بدون ذخیره‌سازی، به صورت ۱۰۰٪ محلی در مرورگر شما انجام می‌شود.' 
                : 'Guaranteed PII Security: Excel analysis is performed 100% locally in your browser with zero server persistence.'}
            </span>
          </div>
          <button
            onClick={() => setIsPiiModalOpen(true)}
            className="text-xs font-bold underline hover:opacity-80 shrink-0 px-2 py-1 cursor-pointer"
          >
            {lang === 'fa' ? 'مشاهده گزارش امنیتی' : 'View Security Report'}
          </button>
        </div>

        {/* Upload & Drag-Drop Area with Current Price P&L Calculator */}
        <FileUploadArea
          lang={lang}
          onFileSelected={handleFileSelected}
          onLoadDemo={handleLoadDemo}
          isLoading={isLoadingFile}
          fileName={uploadedFileName}
          assets={assetAnalyses}
          customPrices={customPrices}
          onUpdatePrice={handleUpdatePrice}
          onApplyManualData={handleApplyManualData}
        />

        {/* Overview Metrics Cards */}
        {trades.length > 0 && (
          <OverviewCards summary={portfolioSummary} lang={lang} />
        )}

        {/* Visual Portfolio Distribution Pie Chart & Trade History Trend Line Chart */}
        {trades.length > 0 && (
          <PortfolioCharts 
            assets={assetAnalyses} 
            trades={trades} 
            lang={lang} 
          />
        )}

        {/* Asset Performance Breakdown & Live Market Price Comparison */}
        {trades.length > 0 && (
          <AssetAnalyzer
            assets={assetAnalyses}
            lang={lang}
            onUpdatePrice={handleUpdatePrice}
            onOpenSimulator={(asset) => setSimulatorAsset(asset)}
          />
        )}

        {/* Detailed Extracted Trades Table */}
        {trades.length > 0 && (
          <TradesTable
            trades={trades}
            lang={lang}
            onDeleteTrade={handleDeleteTrade}
            onAddTrade={handleAddTrade}
            onExportExcel={handleExportExcel}
            onToggleSide={handleToggleTradeSide}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="mt-12 border-t border-slate-200 dark:border-slate-800 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>{t.appTitle} - {t.privacyGuaranteed}</span>
          <span>{t.disclaimer}</span>
        </div>
      </footer>

      {/* PII Security Shield Modal */}
      <PiiShieldModal
        isOpen={isPiiModalOpen}
        onClose={() => setIsPiiModalOpen(false)}
        lang={lang}
        piiReport={piiReport}
      />

      {/* What-If Simulator Modal */}
      <WhatIfSimulatorModal
        isOpen={simulatorAsset !== null}
        onClose={() => setSimulatorAsset(null)}
        asset={simulatorAsset}
        lang={lang}
      />
    </div>
  );
}
