'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import LanguageSwitcher from './LanguageSwitcher';
import Leaderboard from './Leaderboard';
import ScoreSubmitModal from './ScoreSubmitModal';
import { useI18n } from '@/lib/i18n';

const GameCanvas = dynamic(() => import('./GameCanvas'), { ssr: false });

type Tab = 'play' | 'records';

interface RankResult {
  nickname: string;
  ranks: Record<string, number>;
}

export default function GamePage() {
  const { t, locale } = useI18n();
  const [tab,          setTab]          = useState<Tab>('play');
  const [gameOverScore, setGameOverScore] = useState<number | null>(null);
  const [rankResult,   setRankResult]   = useState<RankResult | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const score = (e as CustomEvent<{ score: number }>).detail.score;
      setGameOverScore(score);
      setRankResult(null);
    };
    window.addEventListener('animal-puzzle:gameover', handler);
    return () => window.removeEventListener('animal-puzzle:gameover', handler);
  }, []);

  const handleSubmitted = (nickname: string, ranks: Record<string, number>) => {
    setGameOverScore(null);
    setRankResult({ nickname, ranks });
    setTab('records');
  };

  const handleSkip = () => {
    setGameOverScore(null);
    setRankResult(null);
  };

  const recLabel = locale === 'ko' ? '🏆 기록' : locale === 'ja' ? '🏆 記録' : '🏆 Records';

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center gap-4 px-3 py-6 sm:gap-5 sm:px-4 sm:py-8"
      style={{ background: 'linear-gradient(135deg, #1a0533 0%, #0d1b4b 40%, #0a2e1a 100%)' }}
    >
      {/* 언어 스위처 */}
      <div className="fixed top-3 right-3 z-50 sm:top-4 sm:right-4">
        <LanguageSwitcher />
      </div>

      {/* 타이틀 */}
      <div className="text-center">
        <h1 className="text-2xl sm:text-4xl font-bold text-white tracking-widest mb-1">
          🐾 ANIMAL<span className="text-yellow-300"> PUZZLE</span>
        </h1>
        <p className="text-xs text-white/40">{t('gameSubtitle')}</p>
      </div>

      {/* 탭 */}
      <div className="flex rounded-xl overflow-hidden border border-white/10">
        {([['play', t('singlePlay')], ['records', recLabel]] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-5 py-2 text-sm font-bold transition-colors sm:px-6 ${
              tab === key
                ? 'bg-yellow-400 text-[#1a0533]'
                : 'bg-white/5 text-white/50 hover:bg-white/10'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 컨텐츠 */}
      {tab === 'play' ? (
        <>
          {/* 게임 캔버스 — 모바일에서 전체 너비, 데스크탑은 최대 700px */}
          <div
            className="w-full max-w-[700px] rounded-2xl overflow-hidden shadow-2xl"
            style={{
              background:    'rgba(255,255,255,0.05)',
              backdropFilter: 'blur(12px)',
              border:        '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <GameCanvas />
          </div>

          <p className="text-xs text-white/30 text-center px-4">{t('hint')}</p>

          {/* 등록 완료 후 순위 뱃지 */}
          {rankResult && (
            <div className="flex flex-wrap items-center justify-center gap-2 px-4 py-3 rounded-xl bg-yellow-400/10 border border-yellow-400/20 text-sm">
              <span className="text-yellow-400 font-bold">{rankResult.nickname}</span>
              <span className="text-white/50">|</span>
              <span className="text-white/70">
                {locale === 'ko' ? '세계' : 'World'} #{rankResult.ranks.world}
              </span>
              <span className="text-white/50">·</span>
              <span className="text-white/70">
                {locale === 'ko' ? '오늘' : 'Today'} #{rankResult.ranks.daily}
              </span>
              <button
                onClick={() => setTab('records')}
                className="ml-1 text-yellow-400 text-xs underline"
              >
                {locale === 'ko' ? '기록 보기' : locale === 'ja' ? '記録を見る' : 'View Records'}
              </button>
            </div>
          )}
        </>
      ) : (
        <div
          className="w-full max-w-lg rounded-2xl p-4 sm:p-5 shadow-2xl"
          style={{
            background:    'rgba(255,255,255,0.05)',
            backdropFilter: 'blur(12px)',
            border:        '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <Leaderboard highlightScore={rankResult ? undefined : undefined} />
        </div>
      )}

      {/* 점수 등록 모달 */}
      {gameOverScore !== null && (
        <ScoreSubmitModal
          score={gameOverScore}
          onSubmitted={handleSubmitted}
          onSkip={handleSkip}
        />
      )}
    </main>
  );
}
