import React, { useRef, useState } from 'react';
import { 
  UploadCloud, 
  FileSpreadsheet, 
  Download, 
  Sparkles, 
  ShieldCheck, 
  AlertCircle,
  Camera,
  ClipboardPaste
} from 'lucide-react';
import { Language, AssetAnalysis, TradeRecord, CurrencyKind } from '../types';
import { translations } from '../utils/i18n';
import { downloadExcelTemplate } from '../utils/excelParser';
import { CurrentPricePnLBox } from './CurrentPricePnLBox';
import { ImageTradeExtractorCard } from './ImageTradeExtractorCard';
import { ManualBatchInputCard } from './ManualBatchInputCard';

interface Props {
  lang: Language;
  onFileSelected: (file: File) => void;
  onLoadDemo: () => void;
  isLoading: boolean;
  fileName?: string;
  assets?: AssetAnalysis[];
  customPrices?: Record<string, number>;
  onUpdatePrice?: (symbol: string, newPrice: number) => void;
  onApplyManualData?: (trades: TradeRecord[], symbol: string, currency: CurrencyKind) => void;
}

export const FileUploadArea: React.FC<Props> = ({
  lang,
  onFileSelected,
  onLoadDemo,
  isLoading,
  fileName,
  assets = [],
  customPrices = {},
  onUpdatePrice,
  onApplyManualData,
}) => {
  const t = translations[lang];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'EXCEL' | 'IMAGE_OCR'>('IMAGE_OCR');
  const [showManualTextFallback, setShowManualTextFallback] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const processFile = (file: File) => {
    setErrorMessage(null);
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const hasValidExt = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

    if (!hasValidExt) {
      setErrorMessage(
        lang === 'fa' 
          ? 'لطفاً فقط فایل‌های اکسل (.xlsx, .xls) یا CSV معتبر انتخاب فرمایید.' 
          : 'Please select a valid Excel (.xlsx, .xls) or CSV file.'
      );
      return;
    }

    onFileSelected(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Top Method Switcher: Excel Upload vs AI Image OCR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="inline-flex p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 shadow-xs">
          <button
            id="tab-image-ocr"
            type="button"
            onClick={() => setActiveTab('IMAGE_OCR')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
              activeTab === 'IMAGE_OCR'
                ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Camera className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>{t.tabManualInput}</span>
            <span className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300">
              <Sparkles className="w-3 h-3" />
              <span>{t.tabManualBadge}</span>
            </span>
          </button>

          <button
            id="tab-excel-upload"
            type="button"
            onClick={() => setActiveTab('EXCEL')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
              activeTab === 'EXCEL'
                ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{t.tabExcelUpload}</span>
          </button>
        </div>

        {/* Quick helper note */}
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {activeTab === 'IMAGE_OCR'
            ? (lang === 'fa' ? 'آپلود اسکرین‌شات از صرافی یا فشردن Ctrl+V برای استخراج خودکار قیمت و کارمزدها' : 'Upload screenshot or press Ctrl+V for auto extraction')
            : (lang === 'fa' ? 'محاسبه خودکار از تمام سطرهای فایل اکسل' : 'Auto-analysis from Excel trade rows')}
        </span>
      </div>

      {activeTab === 'EXCEL' ? (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx, .xls, .csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, text/csv"
            className="hidden"
            onChange={handleInputChange}
          />

          <div
            id="excel-dropzone"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-2xl p-6 sm:p-10 text-center transition-all cursor-pointer ${
              isDragging
                ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 scale-[1.008]'
                : 'border-slate-300 dark:border-slate-700 hover:border-emerald-500/70 bg-white dark:bg-slate-900/60 shadow-xs'
            }`}
          >
            <div className="flex flex-col items-center justify-center max-w-lg mx-auto">
              {/* Main Icon */}
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/15 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-4 transition-transform group-hover:scale-105">
                <UploadCloud className="w-8 h-8" />
              </div>

              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">
                {fileName ? `${t.fileLoaded}: ${fileName}` : t.uploadTitle}
              </h3>

              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed max-w-md">
                {t.uploadDesc}
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-3" onClick={e => e.stopPropagation()}>
                <button
                  id="browse-file-btn"
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs sm:text-sm font-semibold shadow-xs transition cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>{t.uploadBtn}</span>
                </button>

                <button
                  id="load-demo-btn"
                  type="button"
                  onClick={onLoadDemo}
                  disabled={isLoading}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs sm:text-sm font-semibold border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>{t.loadDemoBtn}</span>
                </button>

                <button
                  id="download-template-btn"
                  type="button"
                  onClick={downloadExcelTemplate}
                  className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 text-xs sm:text-sm font-medium transition cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>{t.downloadTemplateBtn}</span>
                </button>
              </div>

              {/* Privacy Security Note */}
              <div className="mt-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs border border-emerald-500/20">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{t.privacyGuaranteed}</span>
              </div>
            </div>

            {/* Error Feedback */}
            {errorMessage && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-center gap-2 max-w-md mx-auto">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>

          {/* Dedicated Section for Current Price Input & Automatic P&L Comparison */}
          <CurrentPricePnLBox
            assets={assets}
            lang={lang}
            customPrices={customPrices}
            onUpdatePrice={onUpdatePrice}
            onLoadDemo={onLoadDemo}
            isExcelLoaded={Boolean(fileName || (assets && assets.length > 0))}
          />
        </>
      ) : (
        /* AI Image OCR & Auto Calculation Mode */
        <div className="space-y-4">
          <ImageTradeExtractorCard
            lang={lang}
            onApplyManualData={(trades, symbol, curr) => {
              if (onApplyManualData) {
                onApplyManualData(trades, symbol, curr);
              }
            }}
            customPrices={customPrices}
            onUpdatePrice={onUpdatePrice}
          />

          {/* Optional Fallback to Text Copy-Paste */}
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => setShowManualTextFallback(prev => !prev)}
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 underline cursor-pointer"
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              <span>
                {showManualTextFallback
                  ? (lang === 'fa' ? 'بستن فرم ورود دستی متنی' : 'Hide manual text input')
                  : (lang === 'fa' ? 'نیاز به ورود دستی یا پیست متنی اعداد دارید؟ کلیک کنید' : 'Need manual numeric text paste? Click here')}
              </span>
            </button>
          </div>

          {showManualTextFallback && (
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
              <ManualBatchInputCard
                lang={lang}
                onApplyManualData={(trades, symbol, curr) => {
                  if (onApplyManualData) {
                    onApplyManualData(trades, symbol, curr);
                  }
                }}
                customPrices={customPrices}
                onUpdatePrice={onUpdatePrice}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
