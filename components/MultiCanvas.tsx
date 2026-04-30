'use client';

import { useEffect, useRef } from 'react';

const GAME_WIDTH  = 820;
const GAME_HEIGHT = 510;

// Phaser 씬 init()에 nickname을 넘기기 위한 모듈 변수
let pendingNickname = '';

export default function MultiCanvas({ nickname }: { nickname: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef      = useRef<unknown>(null);

  useEffect(() => {
    if (gameRef.current || !containerRef.current) return;

    pendingNickname = nickname;
    let game: unknown;

    const init = async () => {
      const Phaser = await import('phaser');
      const { MultiScene } = await import('@/lib/game/MultiScene');

      // MultiScene 만 등록 — GameScene 없이 단독 실행
      game = new Phaser.Game({
        type: Phaser.AUTO,
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        transparent: true,
        scene: [MultiScene],          // ← GameScene 제거
        parent: containerRef.current!,
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        render: { antialias: true },
      });

      gameRef.current = game;
    };

    init();

    return () => {
      (game as { destroy?: (v: boolean) => void })?.destroy?.(true);
      gameRef.current = null;
    };
  }, [nickname]);

  return (
    <div
      ref={containerRef}
      style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}
      className="rounded-2xl overflow-hidden shadow-2xl"
    />
  );
}

/** MultiScene.init() 에서 nickname 을 읽어가는 헬퍼 */
export function getPendingNickname(): string {
  return pendingNickname;
}
