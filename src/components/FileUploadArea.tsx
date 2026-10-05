import React, { useState } from 'react';
import { 
  Key, 
  FileSpreadsheet, 
  Camera,
  ClipboardPaste,
  Sparkles
} from 'lucide-react';
import { Language, AssetAnalysis, TradeRecord, CurrencyKind, PIIReport } from '../types';
import { translations } from '../utils/i18n';
import { downloadExcelTemplate } from '../utils/excelParser';
import { CurrentPricePnLBox } from './CurrentPricePnLBox';
import { ImageTradeExtractorCard } from './ImageTradeExtractorCard';
import { ManualBatchInputCard } from './ManualBatchInputCard';
import { FileUploader } from './ui/file-uploader';
import { ExchangeApiInputHub } from './ExchangeApiInputHub';

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
  onTradesSyncedFromApi?: (trades: TradeRecord[], exchangeName: string, currency: CurrencyKind) => void;
  onOpenPiiModal?: () => void;
  piiReport?: PIIReport | null;
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
  onTradesSyncedFromApi,
  onOpenPiiModal,
  piiReport,
}) => {
  const isRtl = lang === 'fa';
  const t = translations[lang];
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Default and Primary tab is now API Connection
  const [activeTab, setActiveTab] = useState<'API' | 'EXCEL' | 'IMAGE_OCR'>('API');
  const [showManualTextFallback, setShowManualTextFallback] = useState(false);

  const handleFileProcess = (file: File) => {
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

  return (
    <div className="w-full space-y-5">
      {/* Top Mode Selector Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/70 dark:border-slate-800/70 pb-3">
        <div className="inline-flex p-1.5 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 shadow-sm gap-1">
          {/* Primary Option: Exchange API & Private Key */}
          <button
            id="tab-exchange-api"
            type="button"
            onClick={() => setActiveTab('API')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
              activeTab === 'API'
                ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white shadow-md shadow-emerald-600/25 ring-2 ring-emerald-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/60 dark:hover:bg-slate-800/60'
            }`}
          >
            <Key className="w-4 h-4" />
            <span>{isRtl ? 'اتصال با کلید خصوصی' : 'Private API Key'}</span>
            <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-white/20 text-white font-mono">
              {isRtl ? 'پیش‌فرض' : 'Default'}
            </span>
          </button>

          {/* Backup Option 1: Excel File */}
          <button
            id="tab-excel-upload"
            type="button"
            onClick={() => setActiveTab('EXCEL')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'EXCEL'
                ? 'bg-gradient-to-r from-sky-600 to-blue-600 text-white shadow-md shadow-sky-600/25'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/60 dark:hover:bg-slate-800/60'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{isRtl ? 'فایل اکسل' : 'Excel File'}</span>
          </button>

          {/* Backup Option 2: Image OCR */}
          <button
            id="tab-image-ocr"
            type="button"
            onClick={() => setActiveTab('IMAGE_OCR')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'IMAGE_OCR'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-600/25'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/60 dark:hover:bg-slate-800/60'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>{isRtl ? 'تصویر و ثبت دستی' : 'Image & Manual'}</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Primary API Key & Secret Hub */}
      {activeTab === 'API' && (
        <div className="space-y-4">
          <ExchangeApiInputHub
            lang={lang}
            isLoading={isLoading}
            onLoadDemo={onLoadDemo}
            onOpenPiiModal={onOpenPiiModal}
            piiReport={piiReport}
            onTradesSynced={(syncedTrades, exchangeName, currency) => {
              if (onTradesSyncedFromApi) {
                onTradesSyncedFromApi(syncedTrades, exchangeName, currency);
              } else if (onApplyManualData) {
                onApplyManualData(syncedTrades, exchangeName, currency);
              }
            }}
          />

          {/* Dedicated Section for Current Price Input & Automatic P&L Comparison */}
          <CurrentPricePnLBox
            assets={assets}
            lang={lang}
            customPrices={customPrices}
            onUpdatePrice={onUpdatePrice}
            onLoadDemo={onLoadDemo}
            isExcelLoaded={Boolean(fileName || (assets && assets.length > 0))}
          />
        </div>
      )}

      {/* Tab 2: Excel Dropzone Fallback */}
      {activeTab === 'EXCEL' && (
        <div className="space-y-4">
          <FileUploader
            id="excel-dropzone"
            accept=".xlsx, .xls, .csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, text/csv"
            maxSizeMB={25}
            isLoading={isLoading}
            fileName={fileName}
            errorMessage={errorMessage}
            onFileSelect={handleFileProcess}
            onDownloadTemplate={downloadExcelTemplate}
            title={t.uploadZoneTitle}
            description={t.uploadZoneDesc}
            uploadButtonText={t.uploadBtn}
            downloadButtonText={t.downloadTemplateBtn}
            isRtl={lang === 'fa'}
          />

          <CurrentPricePnLBox
            assets={assets}
            lang={lang}
            customPrices={customPrices}
            onUpdatePrice={onUpdatePrice}
            onLoadDemo={onLoadDemo}
            isExcelLoaded={Boolean(fileName || (assets && assets.length > 0))}
          />
        </div>
      )}

      {/* Tab 3: AI Image OCR & Manual Trade Input Fallback */}
      {activeTab === 'IMAGE_OCR' && (
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
