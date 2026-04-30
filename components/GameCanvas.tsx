'use client';

import { useEffect, useRef } from 'react';

const GAME_WIDTH = 700;
const GAME_HEIGHT = 560;

export default function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<unknown>(null);

  useEffect(() => {
    if (gameRef.current || !containerRef.current) return;

    let game: unknown;

    const initPhaser = async () => {
      const Phaser = await import('phaser');
      const { GameScene } = await import('@/lib/game/GameScene');

      game = new Phaser.Game({
        type: Phaser.AUTO,
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        transparent: true,
        scene: [GameScene],
        parent: containerRef.current!,
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        render: {
          antialias: true,
        },
      });

      gameRef.current = game;
    };

    initPhaser();

    return () => {
      (game as { destroy?: (v: boolean) => void })?.destroy?.(true);
      gameRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}
      className="rounded-xl overflow-hidden shadow-2xl"
    />
  );
}
