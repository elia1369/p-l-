import React, { useState } from 'react';
import { 
  X, 
  Mail, 
  Lock, 
  User, 
  ArrowLeft, 
  ArrowRight,
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  Eye,
  EyeOff,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { useAuth } from '../utils/authContext';
import { Language } from '../types';

interface Props {
  lang: Language;
}

export const AuthModal: React.FC<Props> = ({ lang }) => {
  const { 
    isAuthModalOpen, 
    closeAuthModal, 
    login, 
    register, 
    isLoading,
    authModalMode 
  } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>(authModalMode || 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sync mode when modal opens
  React.useEffect(() => {
    if (isAuthModalOpen) {
      setMode(authModalMode);
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [isAuthModalOpen, authModalMode]);

  if (!isAuthModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email || !email.includes('@')) {
      setErrorMessage(lang === 'fa' ? 'لطفاً یک ایمیل معتبر وارد فرمایید.' : 'Please enter a valid email address.');
      return;
    }

    if (!password || password.length < 5) {
      setErrorMessage(lang === 'fa' ? 'رمز عبور باید حداقل ۵ کاراکتر باشد.' : 'Password must be at least 5 characters.');
      return;
    }

    if (mode === 'login') {
      const res = await login(email, password);
      if (!res.success) {
        setErrorMessage(res.error || (lang === 'fa' ? 'خطا در ورود.' : 'Login failed.'));
      }
    } else {
      const res = await register(email, password, name);
      if (!res.success) {
        setErrorMessage(res.error || (lang === 'fa' ? 'خطا در ثبت‌نام.' : 'Registration failed.'));
      }
    }
  };

  const handleQuickDemoLogin = async () => {
    setEmail('trader@wallex.net');
    setPassword('wallex123');
    setErrorMessage(null);
    const res = await login('trader@wallex.net', 'wallex123');
    if (!res.success) {
      setErrorMessage(res.error || 'خطا در ورود آزمایشی.');
    }
  };

  const isFa = lang === 'fa';

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md transition-opacity duration-300"
      dir={isFa ? 'rtl' : 'ltr'}
      onClick={closeAuthModal}
    >
      <div 
        className="relative w-full max-w-md rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl shadow-2xl p-6 sm:p-8 overflow-hidden transition-all transform scale-100"
        onClick={e => e.stopPropagation()}
      >
        {/* Ambient Top Glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-36 bg-gradient-to-r from-emerald-500/20 via-cyan-500/20 to-indigo-500/20 rounded-full blur-2xl pointer-events-none" />

        {/* Close Button */}
        <button
          type="button"
          onClick={closeAuthModal}
          className="absolute top-5 end-5 p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          title={isFa ? 'بستن' : 'Close'}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex p-3 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/15 text-emerald-600 dark:text-emerald-400 mb-3 shadow-sm shadow-emerald-500/10">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 dark:from-emerald-400 dark:via-teal-300 dark:to-cyan-400 bg-clip-text text-transparent">
            {mode === 'login' 
              ? (isFa ? 'ورود به حساب کاربری' : 'Sign in to Account')
              : (isFa ? 'ایجاد حساب کاربری جدید' : 'Create New Account')}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
            {isFa 
              ? 'ورود جهت دسترسی به پرتال اختصاصی، ذخیره ابری پورتفوها و دیده‌بان شخصی'
              : 'Sign in to access personalized portfolio vaults and watchlist'}
          </p>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex p-1 mb-5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80">
          <button
            type="button"
            onClick={() => { setMode('login'); setErrorMessage(null); }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
              mode === 'login'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            {isFa ? 'ورود به حساب' : 'Log In'}
          </button>
          <button
            type="button"
            onClick={() => { setMode('register'); setErrorMessage(null); }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
              mode === 'register'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            {isFa ? 'ثبت‌نام جدید' : 'Register'}
          </button>
        </div>

        {/* Free Guest Reassurance Banner */}
        <div className="mb-4 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-[11px] flex items-start gap-2">
          <Sparkles className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
          <span className="leading-relaxed">
            {isFa 
              ? 'استفاده عمومی و محاسبات کامل بدون نیاز به ثبت‌نام آزاد است. ورود به حساب، قابلیت‌های ذخیره‌سازی ابری و پرتال اختصاصی را اضافه می‌نماید.'
              : 'All calculation tools remain completely free for guests. Signing in unlocks cloud portfolio backups.'}
          </span>
        </div>

        {/* Error Feedback */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Success Feedback */}
        {successMessage && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {isFa ? 'نام و نام‌خانوادگی (اختیاری):' : 'Full Name (Optional):'}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={isFa ? 'مثلاً علی حسینی' : 'e.g. Alex Trader'}
                  className={`w-full py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition ${
                    isFa ? 'pr-9 pl-3' : 'pl-9 pr-3'
                  }`}
                />
                <User className={`w-4 h-4 absolute top-1/2 -translate-y-1/2 text-slate-400 ${isFa ? 'right-3' : 'left-3'}`} />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {isFa ? 'آدرس ایمیل:' : 'Email Address:'}
            </label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@example.com"
                className={`w-full py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition font-mono ${
                  isFa ? 'pr-9 pl-3 text-left' : 'pl-9 pr-3'
                }`}
                dir="ltr"
              />
              <Mail className={`w-4 h-4 absolute top-1/2 -translate-y-1/2 text-slate-400 ${isFa ? 'right-3' : 'left-3'}`} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {isFa ? 'رمز عبور:' : 'Password:'}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`w-full py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition font-mono ${
                  isFa ? 'pr-9 pl-10 text-left' : 'pl-9 pr-10'
                }`}
                dir="ltr"
              />
              <Lock className={`w-4 h-4 absolute top-1/2 -translate-y-1/2 text-slate-400 ${isFa ? 'right-3' : 'left-3'}`} />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={`absolute top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer ${
                  isFa ? 'left-3' : 'right-3'
                }`}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Action Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-500/25 active:scale-[0.99] transition cursor-pointer flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <span>{isFa ? 'در حال برقراری ارتباط...' : 'Processing...'}</span>
            ) : mode === 'login' ? (
              <>
                <span>{isFa ? 'ورود به حساب' : 'Log In'}</span>
                {isFa ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              </>
            ) : (
              <>
                <span>{isFa ? 'ثبت‌نام و ورود به سامانه' : 'Register & Enter'}</span>
                {isFa ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              </>
            )}
          </button>
        </form>

        {/* Quick Demo Login Option */}
        <div className="mt-5 pt-4 border-t border-slate-200/80 dark:border-slate-800 text-center">
          <button
            type="button"
            onClick={handleQuickDemoLogin}
            disabled={isLoading}
            className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200/80 dark:border-slate-700 transition cursor-pointer flex items-center justify-center gap-2"
          >
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>{isFa ? 'ورود سریع با حساب آزمایشی (Demo 1-Click)' : '1-Click Demo Login (trader@wallex.net)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
