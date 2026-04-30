'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

export const LOCALES = ['en', 'ko', 'ja'] as const;
export type Locale = typeof LOCALES[number];

export const LOCALE_META: Record<Locale, { flag: string; label: string }> = {
  en: { flag: '🇺🇸', label: 'English' },
  ko: { flag: '🇰🇷', label: '한국어' },
  ja: { flag: '🇯🇵', label: '日本語' },
};

export type TranslationKey = keyof typeof translations.en;

export const translations = {
  en: {
    // 페이지 타이틀
    gameTitle:   'ANIMAL PUZZLE',
    gameSubtitle:'🐶🐱🐸🐥🐰🦊 Match 3 or more animals!',
    // 탭
    singlePlay:  '🎮 Single Play',
    multiPlay:   '⚔️ Multiplayer',
    // 힌트
    hint:        'Click twice to swap · R to shuffle · Beat the 60s high score!',
    // 로비
    multiTitle:  '🐾 Animal Puzzle — Multiplayer',
    multiDesc:   'Real-time Match-3 battle with players worldwide!',
    nickPlaceholder: 'Enter nickname (max 20 chars)',
    startMatch:  '🎮 Start Match',
    searching:   'Finding opponent',
    waitingPlayers: 'In queue',
    cancel:      'Cancel',
    // 인게임 HUD
    score:       'SCORE',
    best:        'BEST',
    time:        'TIME',
    hp:          'HP',
    you:         'YOU',
    opponent:    'OPPONENT',
    // 인게임 메시지
    combo:       'COMBO',
    shuffled:    'Shuffled! 🔀',
    noMoves:     'No moves! Shuffled! 🔀',
    gameOver:    'GAME OVER',
    newBest:     '🏆 NEW BEST!',
    restart:     'Restart',
    // 멀티플레이어
    win:         '🏆 WIN!',
    lose:        '💀 LOSE',
    draw:        '🤝 DRAW',
    backToLobby: 'Back to Lobby',
    myScore:     'My Score',
    oppScore:    'Opponent',
    garbageWarn: '⚠️ Garbage +{n} rows!',
    oppLeft:     'Opponent left 🏆 WIN!',
    vsLabel:     'VS',
  },
  ko: {
    gameTitle:   'ANIMAL PUZZLE',
    gameSubtitle:'🐶🐱🐸🐥🐰🦊 동물들을 3마리 이상 맞춰보세요!',
    singlePlay:  '🎮 싱글플레이',
    multiPlay:   '⚔️ 멀티플레이',
    hint:        '클릭 2번: 교환 · R: 셔플 · 60초 안에 최고점수 도전!',
    multiTitle:  '🐾 Animal Puzzle — 멀티플레이어',
    multiDesc:   '전 세계 플레이어와 실시간 매치-3 대결!',
    nickPlaceholder: '닉네임 입력 (최대 20자)',
    startMatch:  '🎮 매칭 시작',
    searching:   '상대방을 찾는 중',
    waitingPlayers: '대기 인원',
    cancel:      '취소',
    score:       'SCORE',
    best:        'BEST',
    time:        'TIME',
    hp:          'HP',
    you:         'YOU',
    opponent:    'OPPONENT',
    combo:       'COMBO',
    shuffled:    '셔플 완료 🔀',
    noMoves:     '이동 불가! 셔플 완료 🔀',
    gameOver:    'GAME OVER',
    newBest:     '🏆 신기록!',
    restart:     '다시 시작',
    win:         '🏆 승리!',
    lose:        '💀 패배',
    draw:        '🤝 무승부',
    backToLobby: '로비로 돌아가기',
    myScore:     '내 점수',
    oppScore:    '상대방',
    garbageWarn: '⚠️ 방해 블록 +{n}줄!',
    oppLeft:     '상대방이 나갔습니다 🏆 승리!',
    vsLabel:     'VS',
  },
  ja: {
    gameTitle:   'ANIMAL PUZZLE',
    gameSubtitle:'🐶🐱🐸🐥🐰🦊 動物を3匹以上並べよう！',
    singlePlay:  '🎮 シングルプレイ',
    multiPlay:   '⚔️ マルチプレイ',
    hint:        '2回クリックで入れ替え · Rでシャッフル · 60秒で高得点！',
    multiTitle:  '🐾 Animal Puzzle — マルチプレイ',
    multiDesc:   '世界中のプレイヤーとリアルタイム対戦！',
    nickPlaceholder: 'ニックネームを入力 (最大20文字)',
    startMatch:  '🎮 マッチング開始',
    searching:   '対戦相手を検索中',
    waitingPlayers: '待機人数',
    cancel:      'キャンセル',
    score:       'SCORE',
    best:        'BEST',
    time:        'TIME',
    hp:          'HP',
    you:         'YOU',
    opponent:    '相手',
    combo:       'COMBO',
    shuffled:    'シャッフル完了 🔀',
    noMoves:     '手がない！シャッフル 🔀',
    gameOver:    'GAME OVER',
    newBest:     '🏆 新記録！',
    restart:     'リスタート',
    win:         '🏆 勝利！',
    lose:        '💀 敗北',
    draw:        '🤝 引き分け',
    backToLobby: 'ロビーに戻る',
    myScore:     '自分のスコア',
    oppScore:    '相手',
    garbageWarn: '⚠️ 邪魔ブロック +{n}行！',
    oppLeft:     '相手が退出しました 🏆 勝利！',
    vsLabel:     'VS',
  },
} as const;

/* ── Context ── */
interface I18nCtx {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nCtx>({
  locale: 'en',
  setLocale: () => {},
  t: (k) => String(k),
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    // Phaser 씬도 동기화
    if (typeof window !== 'undefined') {
      (window as unknown as Record<string, unknown>).__gameLocale__ = l;
    }
  };

  const t = (key: TranslationKey, vars?: Record<string, string | number>): string => {
    let str = translations[locale][key] as string ?? translations.en[key] as string ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replace(`{${k}}`, String(v));
      }
    }
    return str;
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export const useI18n = () => useContext(I18nContext);
