import { translations, Locale, TranslationKey } from './i18n';

/** Phaser 씬에서 window.__gameLocale__ 을 읽어 현재 언어를 가져옴 */
export function getLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  return ((window as unknown as Record<string, unknown>).__gameLocale__ as Locale) ?? 'en';
}

/** Phaser 씬 전용 번역 함수 */
export function gt(key: TranslationKey, vars?: Record<string, string | number>): string {
  const locale = getLocale();
  let str = (translations[locale][key] ?? translations.en[key] ?? key) as string;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(`{${k}}`, String(v));
    }
  }
  return str;
}
