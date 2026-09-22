import React from 'react';
import { 
  TrendingUp, 
  ShieldCheck, 
  Sun, 
  Moon, 
  Languages, 
  FileSpreadsheet, 
  Download,
  RotateCcw
} from 'lucide-react';
import { Language, ThemeMode, PIIReport } from '../types';
import { translations } from '../utils/i18n';
import { downloadExcelTemplate } from '../utils/excelParser';

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

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
        {/* Left: Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-50 tracking-tight">
                {t.appTitle}
              </h1>
              <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                P&L Engine v2.0
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block truncate max-w-sm md:max-w-md">
              {t.privacyGuaranteed}
            </p>
          </div>
        </div>

        {/* Right: Controls & Badges */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* PII Privacy Shield Button */}
          <button
            id="pii-shield-status-btn"
            onClick={onOpenPiiModal}
            title={t.piiBadge}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 transition cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="hidden sm:inline">{t.piiBadge}</span>
            <span className="sm:hidden">PII</span>
            {piiReport && piiReport.columnsSanitized.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            )}
          </button>

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
        </div>
      </div>
    </header>
  );
};
