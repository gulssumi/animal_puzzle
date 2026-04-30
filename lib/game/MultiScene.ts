import * as Phaser from 'phaser';
import { Board } from './Board';
import { AudioManager } from './AudioManager';
import { BOARD_COLS, BOARD_ROWS, Block, BlockType, MatchGroup, Position } from './types';
import { connectSocket, disconnectSocket } from '../socket';
import { gt } from '../gameLocale';
import type { Socket } from 'socket.io-client';

// MultiCanvas 에서 설정한 nickname 을 읽어오는 지연 import (SSR 방지)
async function fetchNickname(): Promise<string> {
  const mod = await import('../../components/MultiCanvas');
  return mod.getPendingNickname();
}

const CELL    = 56;
const PAD     = 28;
const OPP_X   = PAD + BOARD_COLS * CELL + 180;  // 상대 미니보드 X 오프셋
const MINI_SZ = 18;                               // 미니보드 셀 크기
const GAME_TIME = 60;

type BlockSprite = Phaser.GameObjects.Container & { blockData: Block };

const ANIMAL_EMOJI: Record<BlockType, string> = {
  red:'🐶', blue:'🐱', green:'🐸', yellow:'🐥', purple:'🐰', orange:'🦊',
};
const BLOCK_COLORS: Record<BlockType, number> = {
  red:0xe74c3c, blue:0x3498db, green:0x2ecc71, yellow:0xf1c40f, purple:0x9b59b6, orange:0xe67e22,
};

export class MultiScene extends Phaser.Scene {
  private board!: Board;
  private sprites: (BlockSprite | null)[][] = [];
  private selected: Position | null = null;
  private busy = false;
  private audio!: AudioManager;
  private socket!: Socket;

  // HUD
  private scoreText!: Phaser.GameObjects.Text;
  private oppScoreText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private timerBar!: Phaser.GameObjects.Rectangle;
  private hpBar!: Phaser.GameObjects.Rectangle;
  private oppHpBar!: Phaser.GameObjects.Rectangle;

  // 미니 상대방 보드 (색상 점으로만 표시)
  private miniDots: Phaser.GameObjects.Rectangle[][] = [];

  private gameEnded = false;
  private opponentNick = 'Opponent';

  constructor() { super({ key: 'MultiScene' }); }

  init() {
    // nickname 은 create() 에서 비동기로 읽음
  }

  async create() {
    this.board = new Board();
    this.audio = new AudioManager();
    this.audio.preload();
    this.sprites = Array.from({ length: BOARD_ROWS }, () => Array(BOARD_COLS).fill(null));

    // nickname 읽기
    const nick = await fetchNickname();
    this.registry.set('nickname', nick || 'You');

    this.drawBackground();
    this.renderBoard();
    this.drawHUD();
    this.drawMiniBoard();
    this.setupSocket();
  }

  /* ─────────────────── 배경 ─────────────────── */
  private drawBackground() {
    for (let r = 0; r < BOARD_ROWS; r++)
      for (let c = 0; c < BOARD_COLS; c++) {
        const alpha = (r + c) % 2 === 0 ? 0.08 : 0.04;
        const rect = this.add.rectangle(
          PAD + c*CELL + CELL/2, PAD + r*CELL + CELL/2, CELL-3, CELL-3, 0xffffff, alpha
        ).setDepth(0);
        rect.setStrokeStyle(1, 0xffffff, 0.05);
      }
  }

  private renderBoard() {
    for (let r = 0; r < BOARD_ROWS; r++)
      for (let c = 0; c < BOARD_COLS; c++) {
        const b = this.board.grid[r][c];
        if (b) this.createSprite(b, r, c);
      }
  }

  private createSprite(block: Block, row: number, col: number): BlockSprite {
    const x = PAD + col*CELL + CELL/2;
    const y = PAD + row*CELL + CELL/2;
    const container = this.add.container(x, y) as BlockSprite;
    container.blockData = block;

    const bg    = this.add.rectangle(0, 0, CELL-4, CELL-4, 0xffffff, 0);
    const label = this.add.text(0, 1, ANIMAL_EMOJI[block.type], { fontSize: '36px' }).setOrigin(0.5);

    container.add([bg, label]);
    container.setDepth(1).setSize(CELL, CELL).setInteractive();

    container.on('pointerover', () => {
      if (this.busy || this.gameEnded) return;
      bg.setFillStyle(0xffffff, 0.15).setStrokeStyle(2, 0xffffff, 0.5);
      label.setScale(1.12);
    });
    container.on('pointerout', () => {
      bg.setFillStyle(0xffffff, 0).setStrokeStyle(0);
      label.setScale(1);
    });
    container.on('pointerdown', () => this.onBlockClick({ row, col }));

    this.sprites[row][col] = container;
    return container;
  }

  /* ─────────────────── HUD ─────────────────── */
  private drawHUD() {
    const bw = BOARD_COLS * CELL;
    const hx = PAD + bw + 14;

    // 내 정보
    this.add.text(hx, PAD, gt('you'), { fontSize: '12px', color: '#aaaaaa' });
    this.scoreText = this.add.text(hx, PAD+14, '0', { fontSize: '24px', color: '#f1c40f', fontStyle:'bold' });
    this.add.rectangle(hx+44, PAD+50, 88, 11, 0x333333).setOrigin(0, 0.5);
    this.hpBar = this.add.rectangle(hx+44, PAD+50, 88, 11, 0x2ecc71).setOrigin(0, 0.5);

    // 콤보
    this.comboText = this.add.text(hx, PAD+66, '', { fontSize: '16px', color: '#ff6b6b', fontStyle:'bold' });

    // 타이머
    this.add.text(hx, PAD+100, gt('time'), { fontSize: '12px', color: '#aaaaaa' });
    this.timerText = this.add.text(hx+44, PAD+114, `${GAME_TIME}`, {
      fontSize: '28px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    this.add.rectangle(hx+44, PAD+152, 88, 10, 0x333333).setOrigin(0.5, 0.5);
    this.timerBar = this.add.rectangle(hx+44, PAD+152, 88, 10, 0x3498db).setOrigin(0.5, 0.5);

    // 상대방 정보 (미니보드 위)
    this.add.text(OPP_X, PAD, gt('opponent'), { fontSize: '12px', color: '#ff8888' });
    this.oppScoreText = this.add.text(OPP_X, PAD+14, '0', { fontSize: '20px', color: '#ffaaaa' });
    this.add.rectangle(OPP_X+44, PAD+44, 88, 10, 0x333333).setOrigin(0, 0.5);
    this.oppHpBar = this.add.rectangle(OPP_X+44, PAD+44, 88, 10, 0xe74c3c).setOrigin(0, 0.5);
  }

  /* ─────────────────── 미니 상대 보드 ─────────────────── */
  private drawMiniBoard() {
    this.miniDots = Array.from({ length: BOARD_ROWS }, (_, r) =>
      Array.from({ length: BOARD_COLS }, (_, c) =>
        this.add.rectangle(
          OPP_X + c * MINI_SZ + MINI_SZ/2,
          PAD + 60 + r * MINI_SZ + MINI_SZ/2,
          MINI_SZ - 2, MINI_SZ - 2, 0x333333, 0.7
        ).setDepth(1)
      )
    );
  }

  private updateMiniBoard(grid: { type: BlockType }[][]) {
    for (let r = 0; r < BOARD_ROWS; r++)
      for (let c = 0; c < BOARD_COLS; c++) {
        const color = grid[r]?.[c] ? BLOCK_COLORS[grid[r][c].type] : 0x333333;
        this.miniDots[r][c].setFillStyle(color, 0.85);
      }
  }

  /* ─────────────────── 소켓 ─────────────────── */
  private setupSocket() {
    this.socket = connectSocket();

    this.socket.on('state_sync', (data: {
      yourScore: number; yourHp: number; yourCombo: number;
      oppScore: number;  oppHp: number;
    }) => {
      this.scoreText.setText(data.yourScore.toLocaleString());
      this.oppScoreText.setText(data.oppScore.toLocaleString());

      const myPct  = Math.max(0, data.yourHp / 100);
      const oppPct = Math.max(0, data.oppHp  / 100);
      this.hpBar.setDisplaySize(88 * myPct,  11);
      this.hpBar.setFillStyle(myPct > 0.5 ? 0x2ecc71 : myPct > 0.2 ? 0xf39c12 : 0xe74c3c);
      this.oppHpBar.setDisplaySize(88 * oppPct, 10);

      if (data.yourCombo > 1) {
        this.comboText.setText(`COMBO ×${data.yourCombo}!`);
        this.time.delayedCall(1200, () => this.comboText.setText(''));
      }
    });

    this.socket.on('timer_tick', ({ timeLeft }: { timeLeft: number }) => {
      this.timerText.setText(String(timeLeft));
      const pct = timeLeft / GAME_TIME;
      this.timerBar.setDisplaySize(88 * pct, 10);
      this.timerBar.setFillStyle(pct > 0.5 ? 0x3498db : pct > 0.25 ? 0xf39c12 : 0xe74c3c);
    });

    this.socket.on('garbage_incoming', ({ rows }: { rows: number }) => {
      this.board.addGarbageRow(rows);
      this.refreshSprites();
      this.showMsg(gt('garbageWarn', { n: rows }), '#ff4444');
    });

    this.socket.on('game_over', (data: { winner: string; yourScore: number; oppScore: number }) => {
      this.gameEnded = true;
      this.busy = true;
      this.showEndOverlay(data.winner, data.yourScore, data.oppScore);
    });

    this.socket.on('opp_disconnect', () => {
      this.gameEnded = true;
      this.busy = true;
      this.showMsg(gt('oppLeft'), '#f1c40f');
    });
  }

  /* ─────────────────── 입력 ─────────────────── */
  private async onBlockClick(pos: Position) {
    if (this.busy || this.gameEnded) return;

    if (!this.selected) {
      this.selected = pos;
      this.highlightCell(pos, true);
      return;
    }
    if (this.selected.row === pos.row && this.selected.col === pos.col) {
      this.highlightCell(this.selected, false);
      this.selected = null;
      return;
    }

    const prev = this.selected;
    this.highlightCell(prev, false);
    this.selected = null;
    this.busy = true;

    await this.animSwap(prev, pos);
    const result = this.board.swap(prev, pos);

    if (!result.valid) {
      await this.animSwap(pos, prev);
    } else {
      // 서버에 이동 전송
      this.socket.emit('move', { pos1: prev, pos2: pos });
      await this.processChainLoop(result.matches);
    }
    this.busy = false;
  }

  private async processChainLoop(firstMatches: MatchGroup[]) {
    let matches = firstMatches;
    while (matches.length > 0) {
      await this.animPop(matches);
      this.refreshSprites();
      await this.delay(40);
      const chain = this.board.processChain();
      if (chain.matches.length === 0) break;
      matches = chain.matches;
    }
  }

  /* ─────────────────── 스프라이트 갱신 ─────────────────── */
  private refreshSprites() {
    for (let r = 0; r < BOARD_ROWS; r++)
      for (let c = 0; c < BOARD_COLS; c++) {
        this.sprites[r][c]?.destroy();
        this.sprites[r][c] = null;
      }
    for (let r = 0; r < BOARD_ROWS; r++)
      for (let c = 0; c < BOARD_COLS; c++) {
        const b = this.board.grid[r][c];
        if (b) this.createSprite(b, r, c);
      }
  }

  /* ─────────────────── 하이라이트 ─────────────────── */
  private highlightCell(pos: Position, on: boolean) {
    const sp = this.sprites[pos.row][pos.col];
    if (!sp) return;
    const bg    = sp.list[0] as Phaser.GameObjects.Rectangle;
    const label = sp.list[1] as Phaser.GameObjects.Text;
    if (on) {
      bg.setFillStyle(0xffffff, 0.2).setStrokeStyle(3, 0xffff88, 1);
      label.setScale(1.18);
    } else {
      bg.setFillStyle(0xffffff, 0).setStrokeStyle(0);
      label.setScale(1);
    }
  }

  /* ─────────────────── 애니메이션 ─────────────────── */
  private animSwap(p1: Position, p2: Position): Promise<void> {
    return new Promise(resolve => {
      const sp1 = this.sprites[p1.row][p1.col];
      const sp2 = this.sprites[p2.row][p2.col];
      if (!sp1 || !sp2) { resolve(); return; }
      const x1 = PAD+p2.col*CELL+CELL/2, y1 = PAD+p2.row*CELL+CELL/2;
      const x2 = PAD+p1.col*CELL+CELL/2, y2 = PAD+p1.row*CELL+CELL/2;
      let done = 0;
      const fin = () => { if (++done===2) resolve(); };
      this.tweens.add({ targets:sp1, x:x1, y:y1, duration:110, ease:'Power2', onComplete:fin });
      this.tweens.add({ targets:sp2, x:x2, y:y2, duration:110, ease:'Power2', onComplete:fin });
      this.sprites[p1.row][p1.col] = sp2;
      this.sprites[p2.row][p2.col] = sp1;
    });
  }

  private animPop(matches: MatchGroup[]): Promise<void> {
    return new Promise(resolve => {
      const positions = matches.flatMap(m => m.positions);
      if (!positions.length) { resolve(); return; }
      this.audio.playGroup(matches.map(m => m.type));
      let done = 0;
      const fin = () => { if (++done===positions.length) resolve(); };
      for (const pos of positions) {
        const sp = this.sprites[pos.row][pos.col];
        if (!sp) { fin(); continue; }
        const blockType = matches.find(m => m.positions.some(p=>p.row===pos.row&&p.col===pos.col))?.type ?? 'red';
        this.spawnParticles(PAD+pos.col*CELL+CELL/2, PAD+pos.row*CELL+CELL/2, BLOCK_COLORS[blockType]);
        this.tweens.add({
          targets:sp, scaleX:0, scaleY:0, alpha:0, duration:100, ease:'Back.easeIn',
          onComplete:() => { sp.destroy(); this.sprites[pos.row][pos.col]=null; fin(); },
        });
      }
    });
  }

  private spawnParticles(x: number, y: number, color: number) {
    for (const [dx,dy] of [[-1,-1],[1,-1],[-1,1],[1,1],[0,-1],[0,1]]) {
      const dot = this.add.circle(x, y, 4, color, 0.9).setDepth(5);
      this.tweens.add({
        targets:dot, x:x+dx*24, y:y+dy*24, alpha:0, scaleX:0.2, scaleY:0.2,
        duration:280+Math.random()*100, ease:'Power2',
        onComplete:()=>dot.destroy(),
      });
    }
  }

  /* ─────────────────── 게임 종료 오버레이 ─────────────────── */
  private showEndOverlay(winner: string, myScore: number, oppScore: number) {
    const bw = BOARD_COLS * CELL, bh = BOARD_ROWS * CELL;
    const cx = PAD + bw/2, cy = PAD + bh/2;

    this.add.rectangle(cx, cy, bw, bh, 0x000000, 0.75).setDepth(20);
    const panel = this.add.rectangle(cx, cy, 280, 200, 0x1a0533, 0.95).setDepth(21);
    panel.setStrokeStyle(2, winner === 'you' ? 0xf1c40f : 0xff4444, 1);
    panel.setScale(0.4);
    this.tweens.add({ targets: panel, scaleX:1, scaleY:1, duration:300, ease:'Back.easeOut' });

    this.time.delayedCall(200, () => {
      const title = winner==='you' ? gt('win') : winner==='draw' ? gt('draw') : gt('lose');
      const color = winner==='you' ? '#f1c40f' : winner==='draw' ? '#aaaaff' : '#ff6b6b';
      this.add.text(cx, cy-72, title, { fontSize:'30px', color, fontStyle:'bold' }).setOrigin(0.5).setDepth(22);
      this.add.text(cx, cy-34, `내 점수: ${myScore.toLocaleString()}`, { fontSize:'18px', color:'#ffffff' }).setOrigin(0.5).setDepth(22);
      this.add.text(cx, cy-8,  `상대: ${oppScore.toLocaleString()}`,    { fontSize:'16px', color:'#aaaaaa' }).setOrigin(0.5).setDepth(22);

      // 로비로 돌아가기
      const btn = this.add.rectangle(cx, cy+50, 160, 40, 0x3498db).setDepth(22).setInteractive();
      this.add.text(cx, cy+50, gt('backToLobby'), { fontSize:'16px', color:'#ffffff', fontStyle:'bold' }).setOrigin(0.5).setDepth(23);
      btn.on('pointerdown', () => {
        disconnectSocket();
        this.scene.start('GameScene');
      });
    });
  }

  private showMsg(text: string, color = '#ffffff') {
    const bw = BOARD_COLS*CELL;
    const t = this.add.text(PAD+bw/2, PAD+40, text, {
      fontSize:'20px', color,
      backgroundColor:'#000000bb', padding:{x:12,y:6},
    }).setOrigin(0.5).setDepth(10);
    this.tweens.add({ targets:t, alpha:0, y:t.y-40, duration:2000, ease:'Power2', onComplete:()=>t.destroy() });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(r => this.time.delayedCall(ms, r));
  }

  shutdown() {
    this.socket?.off('state_sync');
    this.socket?.off('timer_tick');
    this.socket?.off('garbage_incoming');
    this.socket?.off('game_over');
    this.socket?.off('opp_disconnect');
  }
}
