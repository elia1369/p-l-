import React, { useState } from 'react';
import { 
  User, 
  X, 
  ShieldCheck, 
  Sparkles, 
  FolderPlus, 
  FolderArchive, 
  Trash2, 
  ArrowUpRight, 
  Clock, 
  FileText, 
  LogOut, 
  CheckCircle2, 
  Star, 
  Plus, 
  Save, 
  BookOpen,
  TrendingUp,
  Activity,
  Layers,
  HelpCircle
} from 'lucide-react';
import { useAuth } from '../utils/authContext';
import { Language, TradeRecord, PortfolioSummary } from '../types';
import { formatCurrency, formatNumber } from '../utils/i18n';

interface Props {
  lang: Language;
  currentTrades: TradeRecord[];
  currentSummary: PortfolioSummary;
  onRestorePortfolio: (trades: TradeRecord[]) => void;
}

export const PersonalizedUserPortal: React.FC<Props> = ({
  lang,
  currentTrades,
  currentSummary,
  onRestorePortfolio,
}) => {
  const { 
    user, 
    isPortalOpen, 
    closePortal, 
    logout, 
    saveCurrentPortfolio, 
    deleteSavedPortfolio, 
    updateUserProfile 
  } = useAuth();

  const [portfolioName, setPortfolioName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Notes state
  const [notesText, setNotesText] = useState(user?.notes || '');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  // Watchlist new item input
  const [newSymbol, setNewSymbol] = useState('');

  if (!isPortalOpen || !user) return null;

  const isFa = lang === 'fa';

  const handleSavePortfolio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portfolioName.trim()) return;

    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = await saveCurrentPortfolio(portfolioName, currentTrades, currentSummary);
    setIsSaving(false);

    if (res.success) {
      setSuccessMsg(isFa ? 'پورتفوی فعلی با موفقیت در حساب کاربری شما ذخیره شد.' : 'Portfolio snapshot saved successfully.');
      setPortfolioName('');
      setTimeout(() => setSuccessMsg(null), 4000);
    } else {
      setErrorMsg(res.error || 'خطا در ذخیره‌سازی.');
    }
  };

  const handleSaveNotes = async () => {
    setIsSavingNotes(true);
    await updateUserProfile({ notes: notesText });
    setIsSavingNotes(false);
    setSuccessMsg(isFa ? 'یادداشت‌های معاملاتی بروزرسانی شد.' : 'Notes updated successfully.');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleAddWatchlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSymbol.trim()) return;
    const cleanSym = newSymbol.trim().toUpperCase();
    const currentList = user.watchlist || [];
    if (!currentList.includes(cleanSym)) {
      const updated = [...currentList, cleanSym];
      await updateUserProfile({ watchlist: updated });
    }
    setNewSymbol('');
  };

  const handleRemoveWatchlist = async (sym: string) => {
    const updated = (user.watchlist || []).filter(s => s !== sym);
    await updateUserProfile({ watchlist: updated });
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md overflow-y-auto"
      dir={isFa ? 'rtl' : 'ltr'}
      onClick={closePortal}
    >
      <div 
        className="relative w-full max-w-4xl my-auto rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl shadow-2xl overflow-hidden transition-all"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Header Banner */}
        <div className="relative p-5 sm:p-6 bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-indigo-500/10 border-b border-slate-200/80 dark:border-slate-800">
          <button
            type="button"
            onClick={closePortal}
            className="absolute top-5 end-5 p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pe-10">
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/25 ring-2 ring-emerald-500/20 text-xl font-black">
                {user.name ? user.name[0].toUpperCase() : user.email[0].toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100">
                    {user.name || user.email.split('@')[0]}
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                    {user.memberTier || 'Pro Trader'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono" dir="ltr">
                  {user.email}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>{isFa ? 'خروج از حساب' : 'Sign Out'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Portal Body Content */}
        <div className="p-5 sm:p-7 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Notification Messages */}
          {successMsg && (
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <X className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 1: Save Current Active Portfolio Snapshot */}
          <div className="p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-800/40 backdrop-blur-md space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <FolderPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-100">
                    {isFa ? 'ذخیره‌سازی وضعیت فعلی معاملات در حساب من' : 'Save Current Analysis Snapshot'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {isFa 
                      ? `هم‌اکنون ${currentTrades.length} معامله در ابزار فعال است.` 
                      : `${currentTrades.length} trade(s) currently active in workspace.`}
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSavePortfolio} className="flex flex-col sm:flex-row items-center gap-2.5">
              <input
                type="text"
                value={portfolioName}
                onChange={e => setPortfolioName(e.target.value)}
                placeholder={isFa ? 'نام پورتفو (مثلاً معاملات اسفند ماه والکس)' : 'Portfolio label / date'}
                className="w-full flex-1 py-2.5 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="submit"
                disabled={isSaving || currentTrades.length === 0}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-500/20 active:scale-95 transition cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? (isFa ? 'در حال ذخیره...' : 'Saving...') : (isFa ? 'ذخیره در آرشیو من' : 'Save Snapshot')}</span>
              </button>
            </form>
          </div>

          {/* Section 2: Vault of Saved Portfolios */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <FolderArchive className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {isFa ? 'پورتفوهای ابری ذخیره‌شده شما' : 'Your Cloud Saved Portfolios'}
              </h3>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                {user.savedPortfolios?.length || 0}
              </span>
            </div>

            {(!user.savedPortfolios || user.savedPortfolios.length === 0) ? (
              <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs">
                {isFa 
                  ? 'هنوز پورتفویی ذخیره نشده است. با زدن دکمه بالا می‌توانید وضعیت جاری معاملات را ذخیره فرمایید.' 
                  : 'No saved portfolios yet. Save current trades above to access them anytime.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {user.savedPortfolios.map((p) => (
                  <div
                    key={p.id}
                    className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-800/60 backdrop-blur-md shadow-xs space-y-3 hover:border-emerald-500/40 transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                          {p.name}
                        </h4>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(p.savedAt).toLocaleDateString(isFa ? 'fa-IR' : 'en-US')}</span>
                          <span>·</span>
                          <span>{p.tradesCount} {isFa ? 'معامله' : 'trades'}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => deleteSavedPortfolio(p.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                        title={isFa ? 'حذف این پورتفو' : 'Delete'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-700/60">
                      <div>
                        <span className="text-slate-500 dark:text-slate-400 text-[10px] block">{isFa ? 'سود/زیان خالص:' : 'Net P&L:'}</span>
                        <span className={`font-mono font-bold ${p.netPnL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {p.netPnL.toLocaleString()}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (p.trades && p.trades.length > 0) {
                            onRestorePortfolio(p.trades);
                            closePortal();
                          }
                        }}
                        disabled={!p.trades || p.trades.length === 0}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-600 hover:text-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition cursor-pointer"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        <span>{isFa ? 'بارگذاری در ابزار' : 'Restore'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 3: Personalized Watchlist & Notes Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Watchlist */}
            <div className="p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-800/40 backdrop-blur-md space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                    {isFa ? 'دیده‌بان رمزارزهای من (Watchlist)' : 'Personal Watchlist'}
                  </h3>
                </div>
              </div>

              <form onSubmit={handleAddWatchlist} className="flex items-center gap-2">
                <input
                  type="text"
                  value={newSymbol}
                  onChange={e => setNewSymbol(e.target.value)}
                  placeholder="SOL/TMN"
                  className="w-full flex-1 py-1.5 px-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono uppercase"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-xs font-bold transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </form>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {(user.watchlist || []).map((sym) => (
                  <span
                    key={sym}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-semibold"
                  >
                    <span>{sym}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveWatchlist(sym)}
                      className="text-slate-400 hover:text-rose-500 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Notes / Trade Journal */}
            <div className="p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-800/40 backdrop-blur-md space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-indigo-500" />
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                    {isFa ? 'یادداشت‌های اختصاصی و استراتژی معامله' : 'Trading Journal & Notes'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={handleSaveNotes}
                  disabled={isSavingNotes}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  <Save className="w-3 h-3" />
                  <span>{isSavingNotes ? (isFa ? 'ذخیره...' : 'Saving...') : (isFa ? 'ذخیره یادداشت' : 'Save')}</span>
                </button>
              </div>

              <textarea
                rows={3}
                value={notesText}
                onChange={e => setNotesText(e.target.value)}
                placeholder={isFa ? 'استراتژی ورود و خروج، حد ضررها یا پلن خرید پله‌ای...' : 'Your entry/exit rules, stop loss notes...'}
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Section 4: Personalized Extension Bridge Notice */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-cyan-500/10 border border-indigo-500/20 text-xs space-y-1">
            <div className="flex items-center gap-2 font-bold text-indigo-700 dark:text-indigo-300">
              <Sparkles className="w-4 h-4" />
              <span>{isFa ? 'پرتال اختصاصی کاربری شما فعال است' : 'Personalized Member Hub Active'}</span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
              {isFa 
                ? 'پایگاه داده حساب کاربری شما با موفقیت راه‌اندازی شد. در گام‌های بعدی می‌توانید هر ویژگی شخصی‌سازی‌شده دیگری (مانند اتصال خودکار API والکس، گزارش‌های مالیاتی، هشدار پیامکی سود و غیره) را که مد نظرتان است، به این پرتال اضافه فرمایید.'
                : 'Your member portal is ready. Any future custom features can be layered on top of this foundation.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
