import React from 'react';
import { 
  TrendingUp, 
  Sun, 
  Moon, 
  Languages, 
  FileSpreadsheet, 
  Download,
  RotateCcw,
  User,
  ShieldCheck
} from 'lucide-react';
import { Language, ThemeMode, PIIReport } from '../types';
import { translations } from '../utils/i18n';
import { downloadExcelTemplate } from '../utils/excelParser';
import { useAuth } from '../utils/authContext';

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

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl transition-colors shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
        {/* Left: Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/25 ring-2 ring-emerald-500/20">
            <TrendingUp className="w-5 h-5 drop-shadow-xs" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black tracking-tight bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 dark:from-emerald-400 dark:via-teal-300 dark:to-cyan-400 bg-clip-text text-transparent">
                {t.appTitle}
              </h1>
            </div>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 hidden sm:block truncate max-w-sm md:max-w-md">
              {t.privacyGuaranteed}
            </p>
          </div>
        </div>

        {/* Right: Controls & Badges */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Template Download */}
          <button
            id="download-template-nav-btn"
            onClick={downloadExcelTemplate}
            title={t.downloadTemplateBtn}
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>{t.downloadTemplateBtn}</span>
          </button>

          {/* Export button if trades exist */}
          {hasTrades && (
            <button
              id="export-excel-nav-btn"
              onClick={onExportExcel}
              title={t.exportReport}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{t.exportReport}</span>
            </button>
          )}

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

          {/* Language Toggle */}
          <button
            id="lang-toggle-btn"
            onClick={onToggleLang}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition cursor-pointer"
          >
            <Languages className="w-3.5 h-3.5 text-slate-500" />
            <span>{lang === 'fa' ? 'EN' : 'فا'}</span>
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
              <span>{lang === 'fa' ? 'ورود / ثبت‌نام' : 'Sign In / Register'}</span>
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
