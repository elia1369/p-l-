import * as React from "react";
import { 
  UploadCloud, 
  FileSpreadsheet, 
  CheckCircle2, 
  X, 
  AlertCircle, 
  Download, 
  RefreshCw,
  FileCheck,
  FileType
} from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "./button";
import { Badge } from "./badge";
import { Progress } from "./progress";

export interface FileUploaderProps extends React.HTMLAttributes<HTMLDivElement> {
  accept?: string;
  maxSizeMB?: number;
  isLoading?: boolean;
  progressValue?: number;
  fileName?: string;
  fileSize?: number;
  errorMessage?: string | null;
  onFileSelect: (file: File) => void;
  onClearFile?: () => void;
  onDownloadTemplate?: () => void;
  title?: string;
  description?: string;
  uploadButtonText?: string;
  downloadButtonText?: string;
  isRtl?: boolean;
}

export const FileUploader = React.forwardRef<HTMLDivElement, FileUploaderProps>(
  (
    {
      className,
      accept = ".xlsx, .xls, .csv",
      maxSizeMB = 25,
      isLoading = false,
      progressValue,
      fileName,
      fileSize,
      errorMessage,
      onFileSelect,
      onClearFile,
      onDownloadTemplate,
      title,
      description,
      uploadButtonText,
      downloadButtonText,
      isRtl = true,
      ...props
    },
    ref
  ) => {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const [isDragOver, setIsDragOver] = React.useState(false);
    const [localError, setLocalError] = React.useState<string | null>(null);

    const activeError = errorMessage || localError;

    const formatBytes = (bytes?: number) => {
      if (!bytes || bytes === 0) return "0 KB";
      const k = 1024;
      const sizes = ["Bytes", "KB", "MB", "GB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
    };

    const handleFileValidation = (file: File) => {
      setLocalError(null);
      const maxSizeBytes = maxSizeMB * 1024 * 1024;
      if (file.size > maxSizeBytes) {
        setLocalError(
          isRtl
            ? `حجم فایل بیشتر از حد مجاز (${maxSizeMB} مگابایت) است.`
            : `File size exceeds the allowed limit of ${maxSizeMB}MB.`
        );
        return false;
      }

      const allowedExts = accept
        .split(",")
        .map((ext) => ext.trim().toLowerCase().replace(/^\./, ""));
      
      const fileExt = file.name.split(".").pop()?.toLowerCase() || "";
      if (allowedExts.length > 0 && !allowedExts.includes(fileExt)) {
        setLocalError(
          isRtl
            ? `فرمت فایل پشتیبانی نمی‌شود. فرمت‌های مجاز: ${allowedExts.join(", ")}`
            : `Unsupported file format. Allowed formats: ${allowedExts.join(", ")}`
        );
        return false;
      }

      return true;
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      if (isLoading) return;

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (handleFileValidation(file)) {
          onFileSelect(file);
        }
      }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (!isLoading) {
        setIsDragOver(true);
      }
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0];
        if (handleFileValidation(file)) {
          onFileSelect(file);
        }
      }
      // Reset input value to allow re-uploading same file
      if (e.target) {
        e.target.value = "";
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        inputRef.current?.click();
      }
    };

    return (
      <div
        ref={ref}
        id="excel-dropzone"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "group relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 sm:p-10 transition-all duration-200 outline-none select-none cursor-pointer",
          "bg-white/70 dark:bg-slate-900/60 backdrop-blur-md shadow-xs",
          "focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950",
          isDragOver
            ? "border-sky-500 bg-sky-50/70 dark:bg-sky-950/30 scale-[1.01] shadow-lg shadow-sky-500/10"
            : "border-slate-300/80 hover:border-sky-500/70 dark:border-slate-700/80 dark:hover:border-sky-500/50",
          isLoading && "pointer-events-none opacity-85",
          className
        )}
        {...props}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={handleInputChange}
          disabled={isLoading}
        />

        {/* Dropzone Graphic & Status */}
        <div className="flex flex-col items-center text-center max-w-md mx-auto w-full">
          {/* Top Icon with animated ring on drag/hover */}
          <div
            className={cn(
              "relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl transition-all duration-300",
              isDragOver
                ? "bg-sky-500 text-white shadow-lg shadow-sky-500/30 scale-110"
                : "bg-sky-500/10 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400 group-hover:scale-105 group-hover:bg-sky-500/20"
            )}
          >
            {isLoading ? (
              <RefreshCw className="h-8 w-8 animate-spin" />
            ) : fileName ? (
              <FileCheck className="h-8 w-8" />
            ) : (
              <UploadCloud className="h-8 w-8 transition-transform group-hover:-translate-y-0.5" />
            )}
          </div>

          {/* Heading */}
          <h3 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {title ||
              (isRtl
                ? "فایل خروجی اکسل یا گزارش معاملات خود را اینجا رها کنید"
                : "Drop your Excel trade report file here")}
          </h3>

          {/* Loaded File Card Preview (if a file is selected) */}
          {fileName && (
            <div
              className="mt-4 w-full rounded-xl border border-sky-200/80 bg-sky-50/90 p-3 text-left dark:border-sky-900/60 dark:bg-sky-950/40 backdrop-blur-xs transition-all animate-in fade-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/20 text-sky-600 dark:text-sky-300">
                    <FileSpreadsheet className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs sm:text-sm font-semibold text-sky-900 dark:text-sky-100">
                      {fileName}
                    </p>
                    {fileSize ? (
                      <p className="text-[11px] text-sky-700/80 dark:text-sky-300/80">
                        {formatBytes(fileSize)}
                      </p>
                    ) : (
                      <p className="text-[11px] text-sky-700/80 dark:text-sky-300/80 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500 inline" />
                        {isRtl ? "آماده تحلیل و محاسبه" : "Ready for calculation"}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge variant="sky" className="text-[10px]">
                    {isRtl ? "بارگذاری شد" : "Loaded"}
                  </Badge>
                  {onClearFile && (
                    <button
                      type="button"
                      aria-label="Remove file"
                      onClick={(e) => {
                        e.stopPropagation();
                        onClearFile();
                      }}
                      className="rounded-md p-1 text-slate-500 hover:bg-slate-200/60 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer transition"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Progress bar if analyzing / uploading */}
              {isLoading && (
                <div className="mt-2.5 space-y-1">
                  <Progress value={progressValue ?? 75} className="h-1.5" />
                  <div className="flex justify-between text-[10px] text-sky-700 dark:text-sky-300">
                    <span>{isRtl ? "در حال پردازش و دسته‌بندی اقلام..." : "Processing records..."}</span>
                    <span>{progressValue ? `${progressValue}%` : "..."}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons (shadcn UI Buttons) */}
          <div
            className="mt-4 flex flex-wrap items-center justify-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              id="browse-file-btn"
              type="button"
              variant="primary"
              size="default"
              disabled={isLoading}
              onClick={() => inputRef.current?.click()}
              className="gap-2 font-semibold shadow-md shadow-sky-600/25"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>{uploadButtonText || (isRtl ? "انتخاب فایل اکسل" : "Browse Excel File")}</span>
            </Button>
          </div>

          {/* Error Message banner */}
          {activeError && (
            <div
              className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50/90 p-3 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300 backdrop-blur-xs w-full text-left"
              onClick={(e) => e.stopPropagation()}
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
              <span className="flex-1">{activeError}</span>
              <button
                type="button"
                onClick={() => setLocalError(null)}
                className="shrink-0 text-red-600 hover:text-red-800 dark:text-red-400"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }
);

FileUploader.displayName = "FileUploader";
