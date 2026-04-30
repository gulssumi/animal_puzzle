import { BlockType } from './types';

const SOUND_FILES: Record<BlockType, string> = {
  red:    '/sounds/dog.mp3',
  blue:   '/sounds/cat.mp3',
  green:  '/sounds/frog.mp3',
  yellow: '/sounds/chick.mp3',
  purple: '/sounds/rabbit.mp3',
  orange: '/sounds/fox.mp3',
};

export class AudioManager {
  private ctx: AudioContext | null = null;
  private buffers: Partial<Record<BlockType, AudioBuffer>> = {};
  private loaded = false;

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    return this.ctx;
  }

  /** 게임 시작 시 모든 사운드를 미리 로딩 */
  async preload(): Promise<void> {
    if (this.loaded) return;
    const ctx = this.getCtx();
    const types = Object.keys(SOUND_FILES) as BlockType[];

    await Promise.all(
      types.map(async (type) => {
        try {
          const res = await fetch(SOUND_FILES[type]);
          const arrayBuffer = await res.arrayBuffer();
          this.buffers[type] = await ctx.decodeAudioData(arrayBuffer);
        } catch (e) {
          console.warn(`[AudioManager] ${type} 사운드 로드 실패:`, e);
        }
      })
    );
    this.loaded = true;
  }

  play(type: BlockType, volume = 0.7): void {
    const ctx = this.getCtx();
    const buffer = this.buffers[type];
    if (!buffer) return;

    try {
      if (ctx.state === 'suspended') ctx.resume();

      const source = ctx.createBufferSource();
      const gain = ctx.createGain();

      source.buffer = buffer;
      gain.gain.value = volume;

      source.connect(gain);
      gain.connect(ctx.destination);
      source.start(0);
    } catch (e) {
      console.warn('[AudioManager] 재생 실패:', e);
    }
  }

  /** 여러 타입을 60ms 간격으로 순차 재생 (중복 방지) */
  playGroup(types: BlockType[]): void {
    const unique = [...new Set(types)];
    unique.forEach((t, i) => {
      setTimeout(() => this.play(t), i * 60);
    });
  }
}
