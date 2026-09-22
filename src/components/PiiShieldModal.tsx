import React from 'react';
import { ShieldCheck, Lock, EyeOff, ServerOff, CheckCircle2, X } from 'lucide-react';
import { Language, PIIReport } from '../types';
import { translations } from '../utils/i18n';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  piiReport: PIIReport | null;
}

export const PiiShieldModal: React.FC<Props> = ({ isOpen, onClose, lang, piiReport }) => {
  if (!isOpen) return null;
  const t = translations[lang];

  return (
    <div 
      id="pii-modal-backdrop" 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        id="pii-modal-content"
        dir={lang === 'fa' ? 'rtl' : 'ltr'}
        className="relative w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl transition-all"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {t.piiModalTitle}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t.privacyGuaranteed}
              </p>
            </div>
          </div>
          <button
            id="close-pii-modal-btn"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Core Guarantee */}
        <div className="my-5 p-4 rounded-xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20">
          <div className="flex items-start gap-3">
            <ServerOff className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-emerald-900 dark:text-emerald-300">
                {t.piiClientOnlyCheck}
              </div>
              <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80 mt-1 leading-relaxed">
                {t.piiModalDesc}
              </p>
            </div>
          </div>
        </div>

        {/* Protection Checklist */}
        <div className="space-y-3 mb-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {lang === 'fa' ? 'مکانیزم‌های فعال حریم خصوصی' : 'Active Privacy Mechanisms'}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>{lang === 'fa' ? 'پردازش ۱۰۰٪ درون مرورگر (In-Memory)' : '100% In-Browser Local Memory'}</span>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300">
              <Lock className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>{lang === 'fa' ? 'حذف خودکار ستون‌های هویتی و حساب' : 'Auto-Scrub Identity & Account Columns'}</span>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300">
              <EyeOff className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>{lang === 'fa' ? 'ماسک کردن شناسه‌های تراکنش طولانی' : 'Masking Long Order & TX IDs'}</span>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300">
              <ServerOff className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>{lang === 'fa' ? 'عدم ارسال حتی ۱ بایت به اینترنت' : 'Zero Network Payload Outbound'}</span>
            </div>
          </div>
        </div>

        {/* Scan Results */}
        {piiReport && (
          <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
              <span>{t.piiRowsScanned}</span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{piiReport.rowsScanned}</span>
            </div>

            {piiReport.columnsSanitized.length > 0 ? (
              <div>
                <div className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-1">
                  {t.piiStrippedNotice}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {piiReport.columnsSanitized.map((col, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs font-mono"
                    >
                      {col}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{t.piiNoneFound}</span>
              </div>
            )}
          </div>
        )}

        {/* Close button */}
        <div className="mt-6 flex justify-end">
          <button
            id="pii-modal-confirm-btn"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 transition cursor-pointer"
          >
            {lang === 'fa' ? 'متوجه شدم و تایید می‌کنم' : 'Understood & Verified'}
          </button>
        </div>
      </div>
    </div>
  );
};
