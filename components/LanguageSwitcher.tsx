'use client';

import { useState, useRef, useEffect } from 'react';
import { useI18n, LOCALES, LOCALE_META, Locale } from '@/lib/i18n';

export default function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (l: Locale) => {
    setLocale(l);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative select-none">
      {/* 현재 언어 버튼 */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 transition-colors text-sm text-white"
        aria-label="Change language"
      >
        <span className="text-lg leading-none">{LOCALE_META[locale].flag}</span>
        <span className="hidden sm:inline text-white/70">{LOCALE_META[locale].label}</span>
        <svg
          className={`w-3 h-3 text-white/50 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* 드롭다운 */}
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-36 rounded-xl overflow-hidden border border-white/15 shadow-xl z-50"
          style={{ background: 'rgba(20,10,50,0.95)', backdropFilter: 'blur(12px)' }}
        >
          {LOCALES.map(l => (
            <button
              key={l}
              onClick={() => handleSelect(l)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors
                ${locale === l
                  ? 'bg-yellow-400/20 text-yellow-300'
                  : 'text-white/70 hover:bg-white/10'}`}
            >
              <span className="text-lg leading-none">{LOCALE_META[l].flag}</span>
              <span>{LOCALE_META[l].label}</span>
              {locale === l && (
                <svg className="ml-auto w-3.5 h-3.5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
