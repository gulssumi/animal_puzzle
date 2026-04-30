'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import { useI18n } from '@/lib/i18n';

const MultiCanvas = dynamic(() => import('./MultiCanvas'), { ssr: false });

type Stage = 'form' | 'waiting' | 'playing';

export default function Lobby() {
  const { t } = useI18n();
  const [stage,    setStage]    = useState<Stage>('form');
  const [nickname, setNickname] = useState('');
  const [input,    setInput]    = useState('');
  const [queueSz,  setQueueSz]  = useState(0);
  const [oppNick,  setOppNick]  = useState('');
  const dots = useDotsAnim(stage === 'waiting');

  const join = () => {
    const nick = input.trim() || `Player${Math.floor(Math.random() * 1000)}`;
    setNickname(nick);
    const s = connectSocket();
    s.on('waiting',    ({ queueSize }: { queueSize: number }) => { setQueueSz(queueSize); setStage('waiting'); });
    s.on('game_start', ({ opponentNick }: { opponentNick: string }) => { setOppNick(opponentNick); setStage('playing'); });
    s.emit('join_game', { nickname: nick });
  };

  const cancel = () => { disconnectSocket(); setStage('form'); };

  /* ── FORM ── */
  if (stage === 'form') return (
    <div className="flex flex-col items-center gap-5 w-full max-w-sm">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-1">{t('multiTitle')}</h2>
        <p className="text-sm text-white/50">{t('multiDesc')}</p>
      </div>
      <input
        className="w-full rounded-xl px-4 py-3 bg-white/10 text-white placeholder-white/30 border border-white/20 focus:outline-none focus:border-yellow-400 text-lg"
        placeholder={t('nickPlaceholder')}
        maxLength={20}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && join()}
      />
      <button
        onClick={join}
        className="w-full py-3 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-[#1a0533] font-bold text-lg transition-colors"
      >
        {t('startMatch')}
      </button>
    </div>
  );

  /* ── WAITING ── */
  if (stage === 'waiting') return (
    <div className="flex flex-col items-center gap-6">
      <div className="text-4xl animate-bounce">🔍</div>
      <p className="text-white text-xl font-bold">{t('searching')}{dots}</p>
      <p className="text-white/50 text-sm">{t('waitingPlayers')}: {queueSz}</p>
      <div className="flex gap-1">
        {['🐶','🐱','🐸','🐥','🐰','🦊'].map((e, i) => (
          <span key={i} className="text-2xl animate-pulse" style={{ animationDelay: `${i * 0.15}s` }}>{e}</span>
        ))}
      </div>
      <button
        onClick={cancel}
        className="px-6 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/70 text-sm transition-colors"
      >
        {t('cancel')}
      </button>
    </div>
  );

  /* ── PLAYING ── */
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-3 text-sm text-white/60">
        <span className="text-yellow-400 font-bold">{nickname}</span>
        <span>{t('vsLabel')}</span>
        <span className="text-red-400 font-bold">{oppNick}</span>
      </div>
      <MultiCanvas nickname={nickname} />
    </div>
  );
}

function useDotsAnim(active: boolean) {
  const [n, setN] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!active) return;
    ref.current = setInterval(() => setN(p => (p + 1) % 4), 500);
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [active]);
  return '.'.repeat(n);
}
