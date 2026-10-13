import html2canvas from 'html2canvas';
import { toCanvas } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { TradeRecord, AssetAnalysis, PortfolioSummary, Language } from '../types';
import { WallexAccountBalancesResult } from './wallexApi';
import { formatToJalali } from './jalali';

export interface PortfolioDataBackup {
  version: string;
  app: string;
  exportedAt: string;
  exportedAtJalali: string;
  source: string;
  accountLabel?: string;
  notes?: string;
  accountBalances?: WallexAccountBalancesResult | null;
  portfolioSummary?: PortfolioSummary | null;
  assetAnalyses?: AssetAnalysis[];
  trades: TradeRecord[];
}

/**
 * Universal browser-safe blob downloader that works across iframes and all browsers
 */
export function downloadBlob(blob: Blob, fileName: string): string {
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.style.display = 'none';
  link.setAttribute('href', blobUrl);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  
  // Trigger click
  link.click();

  // Clean up
  setTimeout(() => {
    try {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
    } catch {
      // ignore
    }
  }, 5000);

  return blobUrl;
}

/**
 * Downloads a complete JSON snapshot file of trades, balances, and P&L calculations.
 */
export function exportPortfolioDataBackup(params: {
  trades: TradeRecord[];
  assetAnalyses?: AssetAnalysis[];
  portfolioSummary?: PortfolioSummary | null;
  accountBalances?: WallexAccountBalancesResult | null;
  accountLabel?: string;
  fileName?: string;
}): string {
  const now = new Date();
  const jalaliDateStr = formatToJalali(now);
  const isoDate = now.toISOString();

  const backupData: PortfolioDataBackup = {
    version: '2.0',
    app: 'TradeSmart - Wallex PnL & Portfolio Tracker',
    exportedAt: isoDate,
    exportedAtJalali: jalaliDateStr,
    source: 'Wallex Private API / Exchange Ledger',
    accountLabel: params.accountLabel || 'حساب کاربری والکس',
    accountBalances: params.accountBalances || null,
    portfolioSummary: params.portfolioSummary || null,
    assetAnalyses: params.assetAnalyses || [],
    trades: params.trades,
  };

  const jsonString = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
  const dateTag = now.toISOString().slice(0, 10).replace(/-/g, '');
  const defaultFileName = params.fileName || `wallex-trades-backup-${dateTag}.json`;
  
  return downloadBlob(blob, defaultFileName);
}

/**
 * Parses and validates an uploaded JSON backup file.
 */
export function parsePortfolioDataBackup(jsonText: string): {
  success: boolean;
  data?: PortfolioDataBackup;
  error?: string;
} {
  try {
    const parsed = JSON.parse(jsonText);
    if (!parsed || (!Array.isArray(parsed.trades) && !Array.isArray(parsed))) {
      return {
        success: false,
        error: 'فرمت فایل معتبر نیست. آرایه معاملات در فایل یافت نشد.',
      };
    }

    const trades: TradeRecord[] = Array.isArray(parsed.trades) ? parsed.trades : parsed;
    const validTrades = trades.filter(t => t && t.symbol && typeof t.price === 'number');
    if (validTrades.length === 0) {
      return {
        success: false,
        error: 'هیچ رکورد معامله معتبری در فایل پشتیبان شناسایی نشد.',
      };
    }

    return {
      success: true,
      data: {
        version: parsed.version || '1.0',
        app: parsed.app || 'TradeSmart',
        exportedAt: parsed.exportedAt || new Date().toISOString(),
        exportedAtJalali: parsed.exportedAtJalali || formatToJalali(new Date()),
        source: parsed.source || 'JSON Backup',
        accountLabel: parsed.accountLabel,
        accountBalances: parsed.accountBalances || null,
        portfolioSummary: parsed.portfolioSummary || null,
        assetAnalyses: parsed.assetAnalyses || [],
        trades: validTrades,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: `خطا در بازخوانی فایل JSON: ${err?.message || 'قالب نامعتبر'}`,
    };
  }
}

/**
 * Merges two arrays of trade records without duplicate order IDs or identical trades.
 */
export function mergeTradesWithoutDuplicates(
  existingTrades: TradeRecord[],
  newTrades: TradeRecord[]
): TradeRecord[] {
  const existingKeys = new Set<string>();

  existingTrades.forEach(t => {
    const key = t.orderId ? `ID:${t.orderId}` : `${t.symbol}_${t.date}_${t.side}_${t.price}_${t.quantity}`;
    existingKeys.add(key);
  });

  const merged = [...existingTrades];

  newTrades.forEach(t => {
    const key = t.orderId ? `ID:${t.orderId}` : `${t.symbol}_${t.date}_${t.side}_${t.price}_${t.quantity}`;
    if (!existingKeys.has(key)) {
      existingKeys.add(key);
      merged.push(t);
    }
  });

  return merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * Generates a high-resolution, multi-page PDF directly from a designed HTML container.
 * Combines html-to-image and html2canvas with a bulletproof fallback,
 * slicing into standard A4 pages and downloading via safe blob link.
 */
export async function exportReportElementToPdf(params: {
  elementId: string;
  fileName?: string;
  onProgress?: (status: string) => void;
}): Promise<{ success: boolean; blob: Blob; blobUrl: string }> {
  const { elementId, fileName = 'wallex-financial-report.pdf', onProgress } = params;
  const targetElement = document.getElementById(elementId);

  if (!targetElement) {
    throw new Error(`عنصر شناسه ${elementId} برای تهیه خروجی PDF یافت نشد.`);
  }

  onProgress?.('در حال آماده‌سازی سند گزارش مالی...');

  // Ensure high quality width
  const originalWidth = targetElement.style.width;
  targetElement.style.width = '1080px';

  let canvas: HTMLCanvasElement | null = null;

  try {
    onProgress?.('در حال رندر گرافیکی نمودارها و جداول...');
    await new Promise(r => setTimeout(r, 150));

    // Engine 1: html-to-image (Native browser rendering, handles modern colors like oklch perfectly)
    try {
      canvas = await toCanvas(targetElement, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        quality: 0.95,
      });
    } catch (e1) {
      console.warn('toCanvas failed, attempting fallback to html2canvas:', e1);
    }

    // Engine 2: html2canvas fallback
    if (!canvas) {
      onProgress?.('در حال پردازش ثانویه گرافیک سند...');
      canvas = await html2canvas(targetElement, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1200,
      });
    }

    if (!canvas || canvas.width === 0 || canvas.height === 0) {
      throw new Error('خطا در تبدیل سند به تصویر برای فایل PDF');
    }

    onProgress?.('در حال تنظیم صفحات استاندارد A4 در سند PDF...');

    // A4 dimensions in mm: 210 x 297
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 8;
    const contentWidth = pageWidth - (margin * 2);
    const contentHeight = pageHeight - (margin * 2);

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const totalPdfHeight = (canvasHeight * contentWidth) / canvasWidth;

    if (totalPdfHeight <= contentHeight) {
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      pdf.addImage(imgData, 'JPEG', margin, margin, contentWidth, totalPdfHeight);
    } else {
      // Multi-page slicing: slice canvas by proportional page heights
      const pxPerPage = (canvasWidth * contentHeight) / contentWidth;
      let renderedHeightPx = 0;
      let pageNumber = 1;

      while (renderedHeightPx < canvasHeight) {
        const sliceHeightPx = Math.min(pxPerPage, canvasHeight - renderedHeightPx);
        
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvasWidth;
        pageCanvas.height = sliceHeightPx;
        const pageCtx = pageCanvas.getContext('2d');

        if (pageCtx) {
          pageCtx.fillStyle = '#ffffff';
          pageCtx.fillRect(0, 0, canvasWidth, sliceHeightPx);
          pageCtx.drawImage(
            canvas,
            0,
            renderedHeightPx,
            canvasWidth,
            sliceHeightPx,
            0,
            0,
            canvasWidth,
            sliceHeightPx
          );

          const pageImgData = pageCanvas.toDataURL('image/jpeg', 0.95);
          const slicePdfHeight = (sliceHeightPx * contentWidth) / canvasWidth;

          if (pageNumber > 1) {
            pdf.addPage();
          }

          pdf.addImage(pageImgData, 'JPEG', margin, margin, contentWidth, slicePdfHeight);
        }

        renderedHeightPx += sliceHeightPx;
        pageNumber++;
      }
    }

    onProgress?.('در حال دانلود و ذخیره فایل PDF روی رایانه شما...');
    const pdfBlob = pdf.output('blob');
    const blobUrl = downloadBlob(pdfBlob, fileName);

    return {
      success: true,
      blob: pdfBlob,
      blobUrl,
    };
  } finally {
    targetElement.style.width = originalWidth;
  }
}
