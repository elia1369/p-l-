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
import { Sparkles, CheckCircle2 } from 'lucide-react';
import bgWallpaperDark from './assets/images/crypto_fintech_bg_1790403820718.jpg';
import bgWallpaperLight from './assets/images/fintech_light_bg_1790404497815.jpg';
import { AuthProvider, useAuth } from './utils/authContext';
import { AuthModal } from './components/AuthModal';
import { PersonalizedUserPortal } from './components/PersonalizedUserPortal';

function MainDashboard() {
  const { user, activeView, setActiveView } = useAuth();

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
    setCustomPrices(prev => {
      if (prev[symbol] === newPrice) return prev;
      return {
        ...prev,
        [symbol]: newPrice,
      };
    });
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
      className="relative min-h-screen bg-slate-100/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200 overflow-x-hidden selection:bg-emerald-500/20 selection:text-emerald-400"
      dir={lang === 'fa' ? 'rtl' : 'ltr'}
    >
      {/* Ambient Visual Background: High-Def Light and Dark Mode Wallpapers */}
      <div 
        className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
        aria-hidden="true"
      >
        {/* Light Mode Wallpaper */}
        <img 
          src={bgWallpaperLight}
          alt=""
          referrerPolicy="no-referrer"
          className="dark:hidden w-full h-full object-cover object-top opacity-60 filter contrast-105"
        />
        {/* Dark Mode Wallpaper */}
        <img 
          src={bgWallpaperDark}
          alt=""
          referrerPolicy="no-referrer"
          className="hidden dark:block w-full h-full object-cover object-top opacity-35 filter contrast-110"
        />

        {/* Dynamic Light Theme Overlays */}
        <div className="dark:hidden absolute inset-0 bg-gradient-to-b from-white/30 via-slate-50/50 to-slate-100/70" />
        <div className="dark:hidden absolute -top-24 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-r from-emerald-400/20 via-teal-400/20 to-cyan-400/20 rounded-full blur-3xl pointer-events-none" />

        {/* Dynamic Dark Theme Overlays */}
        <div className="hidden dark:block absolute inset-0 bg-gradient-to-b from-slate-950/70 via-slate-950/85 to-slate-950" />
        <div className="hidden dark:block absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-gradient-to-br from-emerald-500/15 via-cyan-500/15 to-indigo-500/0 rounded-full blur-3xl pointer-events-none" />
        <div className="hidden dark:block absolute top-1/3 -right-24 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Navigation Bar */}
      <div className="relative z-20">
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
      </div>

      {/* Main Content Area */}
      <main className="relative z-10 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6 sm:space-y-8">
        {/* Member Mode Switcher (Visible ONLY when user is logged in) */}
        {user && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-emerald-500/30 shadow-md">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <div className="text-xs">
                <span className="font-extrabold text-slate-900 dark:text-slate-100">
                  {lang === 'fa' ? 'حساب کاربری فعال: ' : 'Active Account: '}
                </span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400">
                  {user.name || user.email}
                </span>
                <span className="ms-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                  {user.memberTier || 'Pro Trader'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setActiveView('WORKSPACE')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeView === 'WORKSPACE'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
                }`}
              >
                <span>{lang === 'fa' ? '📊 میز کار تحلیل عمومی' : '📊 Analysis Workspace'}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveView('USER_PANEL')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeView === 'USER_PANEL'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
                }`}
              >
                <span>{lang === 'fa' ? '👤 پنل کاربری اختصاصی' : '👤 My User Panel'}</span>
              </button>
            </div>
          </div>
        )}

        {/* View 1: When user is in USER_PANEL view (Registered Users Only) */}
        {user && activeView === 'USER_PANEL' ? (
          <PersonalizedUserPortal
            lang={lang}
            currentTrades={trades}
            currentSummary={portfolioSummary}
            onRestorePortfolio={(restoredTrades) => {
              setTrades(restoredTrades);
              setUploadedFileName('پورتفوی ابری بازیابی‌شده');
              setActiveView('WORKSPACE');
            }}
            embedded={true}
          />
        ) : (
          /* View 2: Normal Analysis Workspace (for Guests & Member analysis) */
          <>
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
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 mt-12 border-t border-slate-200/80 dark:border-slate-800/80 py-6 text-center text-xs text-slate-500 dark:text-slate-400 bg-white/40 dark:bg-slate-950/40 backdrop-blur-xs">
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

      {/* User Login & Registration Modal */}
      <AuthModal lang={lang} />

      {/* Personalized Member Portal */}
      <PersonalizedUserPortal
        lang={lang}
        currentTrades={trades}
        currentSummary={portfolioSummary}
        onRestorePortfolio={(restoredTrades) => {
          setTrades(restoredTrades);
          setUploadedFileName('پورتفوی ابری بازیابی‌شده');
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainDashboard />
    </AuthProvider>
  );
}

