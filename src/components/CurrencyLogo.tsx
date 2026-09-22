import React from 'react';
import { CurrencyKind, detectCurrency } from '../utils/i18n';
import { Language } from '../types';

interface Props {
  symbolOrCurrency?: string;
  currency?: CurrencyKind;
  lang?: Language;
  size?: 'xs' | 'sm' | 'md';
  showLabel?: boolean;
}

export const CurrencyLogo: React.FC<Props> = ({
  symbolOrCurrency,
  currency,
  lang = 'fa',
  size = 'sm',
  showLabel = true,
}) => {
  const activeCurrency = currency || detectCurrency(symbolOrCurrency);
  const isToman = activeCurrency === 'TMN';

  const sizeClasses = {
    xs: 'text-[10px] px-1.5 py-0.5 h-5 min-w-5',
    sm: 'text-xs px-2 py-0.5 h-6 min-w-6',
    md: 'text-sm px-2.5 py-1 h-7 min-w-7',
  };

  if (isToman) {
    return (
      <span
        title={lang === 'fa' ? 'واحد ارزی: تومان' : 'Currency: Toman (TMN)'}
        className={`inline-flex items-center justify-center gap-1 rounded-lg font-bold transition-all select-none ${
          sizeClasses[size]
        } bg-amber-500/15 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 shadow-2xs`}
        dir={lang === 'fa' ? 'rtl' : 'ltr'}
      >
        {/* Toman Symbol / Coin Graphic */}
        <span className="w-3.5 h-3.5 rounded-full bg-amber-500/30 dark:bg-amber-400/30 flex items-center justify-center text-[9px] font-black shrink-0 font-sans">
          ت
        </span>
        {showLabel && (
          <span className="font-semibold whitespace-nowrap">
            {lang === 'fa' ? 'تومان' : 'TMN'}
          </span>
        )}
      </span>
    );
  }

  return (
    <span
      title={lang === 'fa' ? 'واحد ارزی: دلار / تتر' : 'Currency: Dollar / USDT ($)'}
      className={`inline-flex items-center justify-center gap-1 rounded-lg font-bold transition-all select-none ${
        sizeClasses[size]
      } bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shadow-2xs font-mono`}
      dir="ltr"
    >
      <span className="w-3.5 h-3.5 rounded-full bg-emerald-500/30 dark:bg-emerald-400/30 flex items-center justify-center text-[10px] font-black shrink-0 font-mono">
        $
      </span>
      {showLabel && (
        <span className="font-semibold whitespace-nowrap">
          {lang === 'fa' ? 'دلار' : 'USD'}
        </span>
      )}
    </span>
  );
};
