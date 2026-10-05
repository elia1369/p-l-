import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, 
  Sun, 
  Moon, 
  Languages, 
  FileSpreadsheet, 
  Download,
  RotateCcw,
  User,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { Language, ThemeMode, PIIReport } from '../types';
import { translations } from '../utils/i18n';
import { downloadExcelTemplate } from '../utils/excelParser';
import { useAuth } from '../utils/authContext';
import { fetchWallexMarkets, WallexMarket } from '../utils/wallexApi';

interface Props {
  lang: Language;
  onToggleLang: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onOpenPiiModal: () => void;
  piiReport: PIIReport | null;
  onLoadDemo: () => void;
  onClear: () => void;
  hasTrades: boolean;
  onExportExcel: () => void;
}

export const Navbar: React.FC<Props> = ({
  lang,
  onToggleLang,
  theme,
  onToggleTheme,
  onOpenPiiModal,
  piiReport,
  onLoadDemo,
  onClear,
  hasTrades,
  onExportExcel,
}) => {
  const t = translations[lang];
  const { user, openAuthModal, openPortal } = useAuth();

  // Wallex Live Ticker State
  const [wallexMarkets, setWallexMarkets] = useState<WallexMarket[]>([]);
  const [isLoadingWallex, setIsLoadingWallex] = useState<boolean>(false);

  const loadWallexData = async (force = false) => {
    setIsLoadingWallex(true);
    try {
      const list = await fetchWallexMarkets(force);
      setWallexMarkets(list);
    } catch (err) {
      console.warn('Could not fetch Wallex ticker in Navbar:', err);
    } finally {
      setIsLoadingWallex(false);
    }
  };

  useEffect(() => {
    loadWallexData();
    const interval = setInterval(() => {
      loadWallexData();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const tickerMarkets = useMemo(() => {
    if (!wallexMarkets || wallexMarkets.length === 0) {
      return [
        { symbol: 'BTC/TMN', price: '6,450,000,000', change: 2.1 },
        { symbol: 'USDT/TMN', price: '94,500', change: 0.4 },
        { symbol: 'TON/TMN', price: '480,000', change: 3.2 },
        { symbol: 'SOL/TMN', price: '21,500,000', change: -1.1 },
      ];
    }
    const picks = ['BTCTMN', 'USDTTMN', 'TONTMN', 'SOLTMN', 'ETHTMN'];
    const matched = wallexMarkets.filter(m => picks.includes(m.symbol.toUpperCase()));
    if (matched.length === 0) return wallexMarkets.slice(0, 4);
    return matched.map(m => ({
      symbol: `${m.base_asset}/${m.quote_asset}`,
      price: Number(m.price).toLocaleString(),
      change: m.change_24h || 0,
    }));
  }, [wallexMarkets]);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-[#101418]/90 backdrop-blur-xl transition-colors shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        {/* Left: Logo & Brand Title */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#00C853] via-emerald-500 to-teal-500 flex items-center justify-center text-slate-950 shadow-lg shadow-[#00C853]/20 ring-2 ring-[#00C853]/30">
            <TrendingUp className="w-5 h-5 drop-shadow-xs stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white">
                <span className="text-[#00C853]">TradeSmart</span>
              </h1>
            </div>
          </div>
        </div>

        {/* Center: Wallex Live API Ticker */}
        <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/80 dark:bg-[#151d26] border border-slate-200/80 dark:border-[#233346] text-xs font-mono shadow-2xs">
          <div className="flex items-center gap-1.5 text-emerald-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-sans font-bold text-slate-700 dark:text-slate-300">
              {lang === 'fa' ? 'نرخ زنده والکس:' : 'Wallex Live API:'}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-700 dark:text-slate-300">
            {tickerMarkets.slice(0, 4).map(m => (
              <span key={m.symbol} className="flex items-center gap-1">
                <span className="font-bold text-slate-900 dark:text-white">{m.symbol}</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">{m.price}</span>
                <span className={`text-[9px] font-semibold ${m.change >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                  ({m.change >= 0 ? '+' : ''}{m.change}%)
                </span>
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={() => loadWallexData(true)}
            disabled={isLoadingWallex}
            title={lang === 'fa' ? 'بروزرسانی قیمت‌های زنده' : 'Refresh live prices'}
            className="p-1 rounded text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[#1e2a38] transition cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${isLoadingWallex ? 'animate-spin text-emerald-500' : ''}`} />
          </button>
        </div>

        {/* Right: Controls, Prominent Language Toggle, Theme & Account */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {/* Load demo / Clear button */}
          {!hasTrades ? (
            <button
              id="load-demo-nav-btn"
              onClick={onLoadDemo}
              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition cursor-pointer"
            >
              {t.loadDemoBtn}
            </button>
          ) : (
            <button
              id="clear-data-nav-btn"
              onClick={onClear}
              title={t.clearData}
              className="p-1.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}

          {/* Prominent Language Toggle "فارسی | EN" */}
          <div className="flex items-center p-1 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-100/90 dark:bg-[#161c22] shadow-2xs">
            <button
              id="lang-toggle-fa-btn"
              type="button"
              onClick={() => lang !== 'fa' && onToggleLang()}
              aria-pressed={lang === 'fa'}
              className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                lang === 'fa'
                  ? 'bg-[#00C853] text-slate-950 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              فارسی
            </button>
            <span className="text-slate-300 dark:text-slate-700 text-xs px-0.5 select-none font-light">|</span>
            <button
              id="lang-toggle-en-btn"
              type="button"
              onClick={() => lang !== 'en' && onToggleLang()}
              aria-pressed={lang === 'en'}
              className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer font-sans ${
                lang === 'en'
                  ? 'bg-[#00C853] text-slate-950 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              EN
            </button>
          </div>

          {/* PII Shield Notification Trigger */}
          <button
            type="button"
            onClick={onOpenPiiModal}
            title={lang === 'fa' ? 'گزارش امنیتی PII Shield' : 'PII Security & Privacy'}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition relative cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            {piiReport && piiReport.sensitiveValuesDetected > 0 && (
              <span className="absolute top-1.5 end-1.5 w-2 h-2 rounded-full bg-[#00C853] ring-2 ring-white dark:ring-[#101418]" />
            )}
          </button>

          {/* Theme Toggle */}
          <button
            id="theme-toggle-btn"
            onClick={onToggleTheme}
            aria-label="Toggle theme"
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition cursor-pointer"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600" />
            )}
          </button>

          {/* User Account / Auth Section (Separate & Optional for Guests) */}
          {!user ? (
            <button
              id="nav-login-btn"
              type="button"
              onClick={() => openAuthModal('login')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white text-xs font-bold shadow-sm shadow-emerald-500/25 active:scale-95 transition cursor-pointer ms-1"
            >
              <User className="w-3.5 h-3.5" />
              <span>{lang === 'fa' ? 'ورود / عضویت' : 'Sign In'}</span>
            </button>
          ) : (
            <button
              id="nav-user-portal-btn"
              type="button"
              onClick={openPortal}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-indigo-500/20 hover:from-emerald-500/30 hover:to-indigo-500/30 border border-emerald-500/40 text-emerald-800 dark:text-emerald-300 text-xs font-black shadow-xs transition cursor-pointer ms-1"
              title={lang === 'fa' ? 'ورود به پنل کاربری اختصاصی' : 'Open User Panel'}
            >
              <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center text-white text-[11px] font-black shadow-xs">
                {user.name ? user.name[0].toUpperCase() : user.email[0].toUpperCase()}
              </div>
              <span className="font-extrabold">{lang === 'fa' ? 'پنل کاربری من' : 'My User Panel'}</span>
              <span className="hidden sm:inline px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-200">
                {user.memberTier || 'Pro'}
              </span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
