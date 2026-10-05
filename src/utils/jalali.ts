/**
 * Exact Jalali (Persian / Solar Hijri) Calendar Conversion Utilities
 * Handles leap years, date formatting, and bi-directional Gregorian <-> Jalali conversion.
 */

export interface JalaliDate {
  jy: number;
  jm: number;
  jd: number;
}

export interface GregorianDate {
  gy: number;
  gm: number;
  gd: number;
}

const JALALI_MONTH_NAMES = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند'
];

/**
 * Converts Gregorian date (year, month 1-12, day 1-31) to Jalali date
 */
export function gregorianToJalali(gy: number, gm: number, gd: number): JalaliDate {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let gy2 = (gm > 2) ? (gy + 1) : gy;
  let days = 355666 + (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd + g_d_m[gm - 1];
  let jy = -1595 + (33 * Math.floor(days / 12053));
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let jm: number;
  let jd: number;
  if (days < 186) {
    jm = 1 + Math.floor(days / 31);
    jd = 1 + (days % 31);
  } else {
    jm = 7 + Math.floor((days - 186) / 30);
    jd = 1 + ((days - 186) % 30);
  }
  return { jy, jm, jd };
}

/**
 * Converts Jalali date (year, month 1-12, day 1-31) to Gregorian date
 */
export function jalaliToGregorian(jy: number, jm: number, jd: number): GregorianDate {
  jy = jy - 979;
  jm = jm - 1;
  jd = jd - 1;

  let j_day_no = 365 * jy + Math.floor(jy / 33) * 8 + Math.floor(((jy % 33) + 3) / 4);
  for (let i = 0; i < jm; ++i) {
    if (i < 6) j_day_no += 31;
    else j_day_no += 30;
  }
  j_day_no += jd;

  let g_day_no = j_day_no + 79;

  let gy = 1600 + 400 * Math.floor(g_day_no / 146097); /* 146097 = 365*400 + 400/4 - 400/100 + 400/400 */
  g_day_no = g_day_no % 146097;

  let leap = true;
  if (g_day_no >= 36525) { /* 36525 = 365*100 + 100/4 */
    g_day_no--;
    gy += 100 * Math.floor(g_day_no / 36524); /* 36524 = 365*100 + 100/4 - 100/100 */
    g_day_no = g_day_no % 36524;

    if (g_day_no >= 365) {
      g_day_no++;
    } else {
      leap = false;
    }
  }

  gy += 4 * Math.floor(g_day_no / 1461); /* 1461 = 365*4 + 4/4 */
  g_day_no %= 1461;

  if (g_day_no >= 366) {
    leap = false;
    g_day_no--;
    gy += Math.floor(g_day_no / 365);
    g_day_no = g_day_no % 365;
  }

  const g_days_in_month = [31, (leap ? 29 : 28), 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  for (let i = 0; i < 12; i++) {
    if (g_day_no < g_days_in_month[i]) {
      gm = i + 1;
      break;
    }
    g_day_no -= g_days_in_month[i];
  }
  let gd = g_day_no + 1;

  return { gy, gm, gd };
}

/**
 * Convert ISO / Gregorian date string (e.g. "2024-03-15" or "2024-03-15 14:30:00") to formatted Jalali string "1402/12/25"
 */
export function formatToJalali(dateInput?: string | Date | null): string {
  if (!dateInput) return '';
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return typeof dateInput === 'string' ? dateInput : '';

  const { jy, jm, jd } = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  const mm = String(jm).padStart(2, '0');
  const dd = String(jd).padStart(2, '0');
  return `${jy}/${mm}/${dd}`;
}

/**
 * Format to Persian verbal date (e.g. "۲۵ اسفند ۱۴۰۲")
 */
export function formatToJalaliVerbose(dateInput?: string | Date | null): string {
  if (!dateInput) return '';
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '';

  const { jy, jm, jd } = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  const monthName = JALALI_MONTH_NAMES[jm - 1] || '';
  return `${jd} ${monthName} ${jy}`;
}

/**
 * Parse Shamsi / Jalali string "1402/12/25" or "1402-12-25" to Gregorian ISO "2024-03-15"
 */
export function parseJalaliToGregorianISO(jalaliStr: string): string {
  if (!jalaliStr) return '';
  const clean = jalaliStr.trim().replace(/-/g, '/');
  const parts = clean.split('/');
  if (parts.length !== 3) return '';

  const jy = parseInt(parts[0], 10);
  const jm = parseInt(parts[1], 10);
  const jd = parseInt(parts[2], 10);

  if (isNaN(jy) || isNaN(jm) || isNaN(jd)) return '';
  if (jm < 1 || jm > 12 || jd < 1 || jd > 31) return '';

  const { gy, gm, gd } = jalaliToGregorian(jy, jm, jd);
  const mm = String(gm).padStart(2, '0');
  const dd = String(gd).padStart(2, '0');
  return `${gy}-${mm}-${dd}`;
}

/**
 * Helper to convert English digits to Persian digits
 */
export function toPersianDigits(str: string | number): string {
  if (str === null || str === undefined) return '';
  const pDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(str).replace(/\d/g, (d) => pDigits[parseInt(d, 10)]);
}
