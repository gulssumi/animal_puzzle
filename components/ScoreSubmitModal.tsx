'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n';

interface Props {
  score: number;
  onSubmitted: (nickname: string, ranks: Record<string, number>) => void;
  onSkip: () => void;
}

const SERVER = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:4000';

export default function ScoreSubmitModal({ score, onSubmitted, onSkip }: Props) {
  const { locale } = useI18n();
  const [nick,    setNick]    = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const lbl = {
    title:       locale === 'ko' ? '기록 등록' : locale === 'ja' ? '記録登録' : 'Submit Score',
    yourScore:   locale === 'ko' ? '내 점수' : locale === 'ja' ? 'スコア' : 'Your Score',
    placeholder: locale === 'ko' ? '닉네임 입력 (최대 20자)' : locale === 'ja' ? 'ニックネームを入力' : 'Enter nickname',
    submit:      locale === 'ko' ? '기록 등록하기' : locale === 'ja' ? '記録を登録' : 'Submit',
    skip:        locale === 'ko' ? '건너뛰기' : locale === 'ja' ? 'スキップ' : 'Skip',
    submitting:  locale === 'ko' ? '등록 중...' : locale === 'ja' ? '登録中...' : 'Submitting...',
    serverErr:   locale === 'ko' ? '서버 오류. 나중에 다시 시도하세요.' : locale === 'ja' ? 'サーバーエラー' : 'Server error. Try again later.',
    worldRank:   locale === 'ko' ? '세계 순위' : locale === 'ja' ? '世界順位' : 'World Rank',
    dailyRank:   locale === 'ko' ? '오늘 순위' : locale === 'ja' ? '本日順位' : 'Daily Rank',
  };

  const handleSubmit = async () => {
    const nickname = nick.trim() || `Player${Math.floor(Math.random() * 10000)}`;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${SERVER}/scores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname, score }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json() as { ranks: Record<string, number> };
      onSubmitted(nickname, data.ranks);
    } catch {
      setError(lbl.serverErr);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
         style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}>
      <div
        className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4 shadow-2xl border border-white/15"
        style={{ background: 'rgba(20,10,50,0.97)' }}
      >
        {/* 타이틀 */}
        <div className="text-center">
          <p className="text-3xl mb-1">🏆</p>
          <h2 className="text-xl font-bold text-white">{lbl.title}</h2>
        </div>

        {/* 점수 뱃지 */}
        <div className="flex items-center justify-center gap-3 py-3 rounded-xl bg-yellow-400/10 border border-yellow-400/20">
          <span className="text-white/50 text-sm">{lbl.yourScore}</span>
          <span className="text-yellow-400 font-black text-3xl tabular-nums">{score.toLocaleString()}</span>
        </div>

        {/* 닉네임 입력 */}
        <input
          className="w-full rounded-xl px-4 py-3 bg-white/8 text-white placeholder-white/30 border border-white/20
                     focus:outline-none focus:border-yellow-400 text-base"
          placeholder={lbl.placeholder}
          maxLength={20}
          value={nick}
          onChange={e => setNick(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !loading && handleSubmit()}
        />

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

        {/* 버튼 */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-3 rounded-xl bg-yellow-400 hover:bg-yellow-300 disabled:opacity-60
                     text-[#1a0533] font-bold text-base transition-colors"
        >
          {loading ? lbl.submitting : lbl.submit}
        </button>

        <button
          onClick={onSkip}
          className="text-white/30 hover:text-white/60 text-sm text-center transition-colors"
        >
          {lbl.skip}
        </button>
      </div>
    </div>
  );
}
