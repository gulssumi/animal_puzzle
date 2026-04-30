'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/lib/i18n';

type Period = 'world' | 'monthly' | 'daily' | 'hourly';

interface ScoreEntry {
  id: string;
  nickname: string;
  score: number;
  playedAt: string;
}

const SERVER = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:4000';

const PERIOD_META: Record<Period, { icon: string; labelEn: string; labelKo: string; labelJa: string }> = {
  world:   { icon: '🌍', labelEn: 'All Time',  labelKo: '전체 기록',  labelJa: '全期間' },
  monthly: { icon: '📅', labelEn: 'This Month', labelKo: '이번 달',  labelJa: '今月' },
  daily:   { icon: '📆', labelEn: 'Today',       labelKo: '오늘',      labelJa: '今日' },
  hourly:  { icon: '⏰', labelEn: 'This Hour',   labelKo: '이번 시간', labelJa: '今時間' },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const RANK_STYLE: Record<number, string> = {
  1: 'text-yellow-400 font-black text-lg',
  2: 'text-gray-300  font-bold  text-base',
  3: 'text-amber-600 font-bold  text-base',
};
const RANK_MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export default function Leaderboard({ highlightScore }: { highlightScore?: number }) {
  const { locale } = useI18n();
  const [period,  setPeriod]  = useState<Period>('daily');
  const [entries, setEntries] = useState<ScoreEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const periodLabel = (p: Period) => {
    const m = PERIOD_META[p];
    return locale === 'ko' ? m.labelKo : locale === 'ja' ? m.labelJa : m.labelEn;
  };

  const fetchBoard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${SERVER}/leaderboard?period=${period}&limit=30`);
      if (!res.ok) throw new Error('서버 오류');
      const data = await res.json() as { entries: ScoreEntry[] };
      setEntries(data.entries);
    } catch {
      setError(locale === 'ko' ? '서버에 연결할 수 없습니다' : locale === 'ja' ? 'サーバーに接続できません' : 'Cannot connect to server');
    } finally {
      setLoading(false);
    }
  }, [period, locale]);

  useEffect(() => { fetchBoard(); }, [fetchBoard]);

  // 30초마다 자동 갱신
  useEffect(() => {
    const id = setInterval(fetchBoard, 30_000);
    return () => clearInterval(id);
  }, [fetchBoard]);

  return (
    <div className="w-full max-w-lg flex flex-col gap-3">
      {/* 기간 탭 */}
      <div className="flex rounded-xl overflow-hidden border border-white/10">
        {(Object.keys(PERIOD_META) as Period[]).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs font-bold transition-colors
              ${period === p ? 'bg-yellow-400 text-[#1a0533]' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}
          >
            <span>{PERIOD_META[p].icon}</span>
            <span className="hidden sm:inline">{periodLabel(p)}</span>
          </button>
        ))}
      </div>

      {/* 순위표 */}
      <div
        className="rounded-xl overflow-hidden border border-white/10"
        style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(8px)' }}
      >
        {/* 헤더 */}
        <div className="flex items-center px-4 py-2 border-b border-white/10 text-xs text-white/40 font-medium">
          <span className="w-8">#</span>
          <span className="flex-1">
            {locale === 'ko' ? '닉네임' : locale === 'ja' ? 'ニックネーム' : 'Nickname'}
          </span>
          <span className="w-20 text-right">
            {locale === 'ko' ? '점수' : locale === 'ja' ? 'スコア' : 'Score'}
          </span>
          <span className="w-20 text-right">
            {locale === 'ko' ? '시간' : locale === 'ja' ? '時間' : 'Time'}
          </span>
        </div>

        {/* 로딩 */}
        {loading && (
          <div className="flex items-center justify-center py-10 text-white/30 text-sm gap-2">
            <span className="animate-spin text-lg">⏳</span>
            <span>{locale === 'ko' ? '불러오는 중...' : locale === 'ja' ? '読み込み中...' : 'Loading...'}</span>
          </div>
        )}

        {/* 오류 */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <span className="text-2xl">🔌</span>
            <p className="text-white/40 text-sm">{error}</p>
            <button onClick={fetchBoard} className="text-yellow-400 text-xs underline">
              {locale === 'ko' ? '다시 시도' : locale === 'ja' ? '再試行' : 'Retry'}
            </button>
          </div>
        )}

        {/* 빈 데이터 */}
        {!loading && !error && entries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <span className="text-3xl">🐾</span>
            <p className="text-white/40 text-sm">
              {locale === 'ko' ? '아직 기록이 없습니다. 첫 번째 도전자가 되세요!' :
               locale === 'ja' ? 'まだ記録がありません。最初の挑戦者になろう！' :
               'No records yet. Be the first!'}
            </p>
          </div>
        )}

        {/* 순위 목록 */}
        {!loading && !error && entries.map((e, i) => {
          const rank = i + 1;
          const isHighlight = highlightScore !== undefined && e.score === highlightScore;
          return (
            <div
              key={e.id}
              className={`flex items-center px-4 py-2.5 border-b border-white/5 last:border-0 transition-colors
                ${isHighlight ? 'bg-yellow-400/10 border-yellow-400/20' : 'hover:bg-white/5'}`}
            >
              {/* 순위 */}
              <span className={`w-8 ${RANK_STYLE[rank] ?? 'text-white/40 text-sm'}`}>
                {RANK_MEDAL[rank] ?? rank}
              </span>

              {/* 닉네임 */}
              <span className={`flex-1 text-sm truncate ${isHighlight ? 'text-yellow-300 font-bold' : 'text-white/80'}`}>
                {e.nickname}
                {isHighlight && <span className="ml-1 text-xs text-yellow-400">← YOU</span>}
              </span>

              {/* 점수 */}
              <span className={`w-20 text-right font-bold tabular-nums
                ${rank === 1 ? 'text-yellow-400' : rank <= 3 ? 'text-white' : 'text-white/70'}`}>
                {e.score.toLocaleString()}
              </span>

              {/* 시간 */}
              <span className="w-20 text-right text-xs text-white/30">{timeAgo(e.playedAt)}</span>
            </div>
          );
        })}
      </div>

      {/* 새로고침 */}
      <button
        onClick={fetchBoard}
        disabled={loading}
        className="self-end text-xs text-white/30 hover:text-white/60 transition-colors flex items-center gap-1"
      >
        <span className={loading ? 'animate-spin' : ''}>🔄</span>
        {locale === 'ko' ? '새로고침' : locale === 'ja' ? '更新' : 'Refresh'}
      </button>
    </div>
  );
}
