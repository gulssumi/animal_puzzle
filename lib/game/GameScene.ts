import * as Phaser from 'phaser';
import { Board } from './Board';
import { AudioManager } from './AudioManager';
import { BOARD_COLS, BOARD_ROWS, Block, BlockType, MatchGroup, Position } from './types';
import { gt } from '../gameLocale';

const CELL = 64;
const PAD  = 40;
const ANIM_SWAP = 120;
const ANIM_POP  = 110;
const GAME_TIME = 60; // seconds

type BlockSprite = Phaser.GameObjects.Container & { blockData: Block };

const ANIMAL_EMOJI: Record<BlockType, string> = {
  red:    '🐶',
  blue:   '🐱',
  green:  '🐸',
  yellow: '🐥',
  purple: '🐰',
  orange: '🦊',
};

const BLOCK_COLORS: Record<BlockType, number> = {
  red: 0xe74c3c, blue: 0x3498db, green: 0x2ecc71,
  yellow: 0xf1c40f, purple: 0x9b59b6, orange: 0xe67e22,
};

export class GameScene extends Phaser.Scene {
  private board!: Board;
  private sprites: (BlockSprite | null)[][] = [];
  private selected: Position | null = null;
  private busy = false;
  private audio!: AudioManager;

  // HUD
  private scoreText!: Phaser.GameObjects.Text;
  private bestText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private timerBar!: Phaser.GameObjects.Rectangle;
  private timerLabel!: Phaser.GameObjects.Text;
  private hpBar!: Phaser.GameObjects.Rectangle;
  private hpText!: Phaser.GameObjects.Text;
  private hpLabel!: Phaser.GameObjects.Text;

  // 타이머
  private timeLeft = GAME_TIME;
  private timerEvent!: Phaser.Time.TimerEvent;
  private gameOver = false;
  private gameStarted = false;

  // 위험 상태 애니메이션 (중복 방지)
  private timerBlinking = false;
  private hpPulsing     = false;

  // 관리자(금단) 모드
  private secretBuffer: string[] = [];
  private readonly SECRET_SEQ   = ['q', 'w', 'e', 'r'];
  private adminActive   = false;   // 모드 활성 여부
  private adminRunning  = false;   // 자동 솔버 실행 중
  private adminBtn?: Phaser.GameObjects.Container;
  private adminBtnLabel?: Phaser.GameObjects.Text;

  constructor() { super({ key: 'GameScene' }); }

  create() {
    // scene.restart() reuses the same instance — class field initializers don't re-run,
    // so manually reset every volatile field here.
    this.selected      = null;
    this.busy          = false;
    this.gameOver      = false;
    this.timeLeft      = GAME_TIME;
    this.secretBuffer  = [];
    this.adminActive   = false;
    this.adminRunning  = false;
    this.adminBtn      = undefined;
    this.adminBtnLabel = undefined;
    this.gameStarted   = false;
    this.timerBlinking = false;
    this.hpPulsing     = false;

    this.board  = new Board();
    this.audio  = new AudioManager();
    this.audio.preload();
    this.sprites = Array.from({ length: BOARD_ROWS }, () => Array(BOARD_COLS).fill(null));

    this.drawBackground();
    this.renderBoard();
    this.drawHUD();
    this.setupInput();
    this.showStartOverlay();   // 타이머는 시작 버튼 이후에 시작
  }

  /* ─────────────────── 배경 ─────────────────── */
  private drawBackground() {
    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        const alpha = (r + c) % 2 === 0 ? 0.08 : 0.04;
        const rect = this.add.rectangle(
          PAD + c * CELL + CELL / 2, PAD + r * CELL + CELL / 2,
          CELL - 4, CELL - 4, 0xffffff, alpha
        ).setDepth(0);
        rect.setStrokeStyle(1, 0xffffff, 0.06);
      }
    }
  }

  /* ─────────────────── 보드 렌더 ─────────────────── */
  private renderBoard() {
    for (let r = 0; r < BOARD_ROWS; r++)
      for (let c = 0; c < BOARD_COLS; c++) {
        const b = this.board.grid[r][c];
        if (b) this.createSprite(b, r, c);
      }
  }

  private createSprite(block: Block, row: number, col: number): BlockSprite {
    const x = PAD + col * CELL + CELL / 2;
    const y = PAD + row * CELL + CELL / 2;

    const container = this.add.container(x, y) as BlockSprite;
    container.blockData = block;

    const hoverBg = this.add.rectangle(0, 0, CELL - 6, CELL - 6, 0xffffff, 0);
    const label   = this.add.text(0, 2, ANIMAL_EMOJI[block.type], { fontSize: '44px' }).setOrigin(0.5);

    container.add([hoverBg, label]);
    container.setDepth(1).setSize(CELL, CELL).setInteractive();

    container.on('pointerover', () => {
      if (this.busy || this.gameOver) return;
      hoverBg.setFillStyle(0xffffff, 0.15).setStrokeStyle(2, 0xffffff, 0.6);
      label.setScale(1.15);
    });
    container.on('pointerout', () => {
      hoverBg.setFillStyle(0xffffff, 0).setStrokeStyle(0);
      label.setScale(1);
    });
    container.on('pointerdown', () => this.onBlockClick({ row, col }));

    this.sprites[row][col] = container;
    return container;
  }

  /* ─────────────────── HUD ─────────────────── */
  private drawHUD() {
    const GAME_W = 700;
    const boardW = BOARD_COLS * CELL;
    const hudX   = PAD + boardW + 20;
    const BAR_W  = GAME_W - hudX - 14;   // 114px
    const barL   = hudX + 7;             // bar left edge
    const barCX  = barL + BAR_W / 2;     // bar center x

    // ── 점수 ──────────────────────────────────
    this.add.text(hudX, PAD, gt('score'), { fontSize: '13px', color: '#888899' });
    this.scoreText = this.add.text(hudX, PAD + 18, '0', {
      fontSize: '30px', color: '#f1c40f', fontStyle: 'bold',
    });

    // ── 최고점수 ───────────────────────────────
    const best = this.getBestScore();
    this.add.text(hudX, PAD + 62, gt('best'), { fontSize: '13px', color: '#888899' });
    this.bestText = this.add.text(hudX, PAD + 78, String(best), {
      fontSize: '22px', color: '#aaaaff',
    });

    // ── 콤보 ──────────────────────────────────
    this.comboText = this.add.text(hudX, PAD + 122, '', {
      fontSize: '20px', color: '#ff6b6b', fontStyle: 'bold',
    });

    // ── HP ────────────────────────────────────
    // 구분선
    this.add.rectangle(barCX, PAD + 162, BAR_W + 8, 1, 0xffffff, 0.12);

    // 레이블 + 수치 (우측 정렬)
    this.hpLabel = this.add.text(hudX, PAD + 168, '❤️  HP', {
      fontSize: '14px', color: '#ff6b6b', fontStyle: 'bold',
    });
    this.hpText = this.add.text(GAME_W - 14, PAD + 168, '100', {
      fontSize: '13px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(1, 0);

    // 트랙 (배경)
    this.add.rectangle(barL, PAD + 192, BAR_W, 22, 0x0d0d1a)
      .setOrigin(0, 0.5)
      .setStrokeStyle(1.5, 0xff6b6b, 0.35);

    // 채움바 (원점: 왼쪽-중앙 → 오른쪽으로 줄어듦)
    this.hpBar = this.add.rectangle(barL, PAD + 192, BAR_W, 22, 0x2ecc71)
      .setOrigin(0, 0.5)
      .setDepth(1);

    // ── TIMER ──────────────────────────────────
    // 구분선
    this.add.rectangle(barCX, PAD + 224, BAR_W + 8, 1, 0xffffff, 0.12);

    // 레이블
    this.timerLabel = this.add.text(hudX, PAD + 230, '⏱  TIME', {
      fontSize: '14px', color: '#74b9ff', fontStyle: 'bold',
    });

    // 큰 숫자 (스트로크 추가로 가시성 향상)
    this.timerText = this.add.text(barCX, PAD + 252, `${GAME_TIME}`, {
      fontSize: '46px', color: '#ffffff', fontStyle: 'bold',
      stroke: '#001a55', strokeThickness: 5,
    }).setOrigin(0.5, 0).setDepth(2);

    // 트랙 (배경)
    this.add.rectangle(barL, PAD + 314, BAR_W, 22, 0x0d0d1a)
      .setOrigin(0, 0.5)
      .setStrokeStyle(1.5, 0x3498db, 0.35);

    // 채움바
    this.timerBar = this.add.rectangle(barL, PAD + 314, BAR_W, 22, 0x3498db)
      .setOrigin(0, 0.5)
      .setDepth(1);

    // ── 조작 안내 ────────────────────────────
    this.add.text(hudX, PAD + 348, '클릭 2번: 교환\nR: 셔플', {
      fontSize: '11px', color: '#555577', lineSpacing: 4,
    });
  }

  /* ─────────────────── 타이머 ─────────────────── */
  private startTimer() {
    this.timerEvent = this.time.addEvent({
      delay: 1000, loop: true,
      callback: () => {
        if (this.gameOver) return;
        this.timeLeft = Math.max(0, this.timeLeft - 1);
        this.updateTimerHUD();
        if (this.timeLeft === 0) this.triggerGameOver();
      },
    });
  }

  private updateTimerHUD() {
    const GAME_W = 700;
    const hudX   = PAD + BOARD_COLS * CELL + 20;
    const BAR_W  = GAME_W - hudX - 14;

    this.timerText.setText(String(this.timeLeft));
    const pct = this.timeLeft / GAME_TIME;
    this.timerBar.setDisplaySize(Math.max(0, BAR_W * pct), 22);

    if (pct > 0.5) {
      // 파랑: 안전
      this.timerBar.setFillStyle(0x3498db);
      this.timerText.setColor('#ffffff').setStroke('#001a55', 5);
      this.timerLabel.setColor('#74b9ff');
    } else if (pct > 0.25) {
      // 주황: 경고
      this.timerBar.setFillStyle(0xf39c12);
      this.timerText.setColor('#f39c12').setStroke('#5a3800', 5);
      this.timerLabel.setColor('#f39c12');
    } else {
      // 빨강: 위험
      this.timerBar.setFillStyle(0xe74c3c);
      this.timerText.setColor('#ff4444').setStroke('#660000', 6);
      this.timerLabel.setColor('#ff4444');

      // 숫자 펄스 — 딱 한 번만 tween 생성
      if (!this.timerBlinking) {
        this.timerBlinking = true;
        this.tweens.add({
          targets: this.timerText,
          scaleX: 1.18, scaleY: 1.18,
          yoyo: true, repeat: -1,
          duration: 350, ease: 'Sine.easeInOut',
        });
        // 바 자체도 깜빡임
        this.tweens.add({
          targets: this.timerBar,
          alpha: 0.45, yoyo: true, repeat: -1,
          duration: 350, ease: 'Sine.easeInOut',
        });
      }
    }
  }

  /* ─────────────────── 게임 오버 ─────────────────── */
  private triggerGameOver() {
    this.gameOver = true;
    this.busy = true;
    this.timerEvent.remove();
    this.saveBestScore(this.board.score);
    this.showGameOverOverlay();

    // React 레이어에 점수 전달 → 점수 등록 모달 표시
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('animal-puzzle:gameover', { detail: { score: this.board.score } })
      );
    }
  }

  private showGameOverOverlay() {
    const boardW = BOARD_COLS * CELL;
    const boardH = BOARD_ROWS * CELL;
    const cx = PAD + boardW / 2;
    const cy = PAD + boardH / 2;

    // 어두운 오버레이
    const overlay = this.add.rectangle(cx, cy, boardW, boardH, 0x000000, 0).setDepth(20);
    this.tweens.add({ targets: overlay, fillAlpha: 0.72, duration: 400 });

    // 결과 패널
    const panel = this.add.rectangle(cx, cy, 300, 220, 0x1a0533, 0.95).setDepth(21);
    panel.setStrokeStyle(2, 0xf1c40f, 1);
    panel.setScale(0.5);
    this.tweens.add({ targets: panel, scaleX: 1, scaleY: 1, duration: 350, ease: 'Back.easeOut' });

    this.time.delayedCall(200, () => {
      const best = this.getBestScore();
      const isNew = this.board.score >= best;

      this.add.text(cx, cy - 80, gt('gameOver'), {
        fontSize: '26px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(22);

      this.add.text(cx, cy - 40, `SCORE  ${this.board.score.toLocaleString()}`, {
        fontSize: '22px', color: '#f1c40f', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(22);

      this.add.text(cx, cy - 8, isNew ? gt('newBest') : `${gt('best')}  ${best.toLocaleString()}`, {
        fontSize: '16px', color: isNew ? '#ffd700' : '#aaaaff',
      }).setOrigin(0.5).setDepth(22);

      // 동물 퍼레이드
      this.add.text(cx, cy + 24, '🐶🐱🐸🐥🐰🦊', { fontSize: '24px' }).setOrigin(0.5).setDepth(22);

      // 재시작 버튼
      const btn = this.add.rectangle(cx, cy + 70, 140, 40, 0xf1c40f).setDepth(22).setInteractive();
      btn.setStrokeStyle(2, 0xffffff, 0.6);
      this.add.text(cx, cy + 70, gt('restart'), {
        fontSize: '18px', color: '#1a0533', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(23);

      btn.on('pointerover', () => btn.setFillStyle(0xffd700));
      btn.on('pointerout',  () => btn.setFillStyle(0xf1c40f));
      btn.on('pointerdown', () => this.scene.restart());
    });
  }

  /* ─────────────────── 입력 ─────────────────── */
  private setupInput() {
    this.input.keyboard?.on('keydown-R', () => {
      if (!this.gameStarted || this.busy || this.gameOver) return;
      this.reshuffleBoard(true);
    });

    // 금단의 모드 시퀀스 감지: q → w → e → r
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      this.secretBuffer.push(event.key.toLowerCase());
      if (this.secretBuffer.length > this.SECRET_SEQ.length) this.secretBuffer.shift();
      if (this.secretBuffer.join('') === this.SECRET_SEQ.join('') && !this.adminActive) {
        this.secretBuffer = [];
        this.showAdminConfirm();
      }
    });
  }

  /* ─────────────────── 시작 오버레이 ─────────────────── */
  private showStartOverlay() {
    const boardW = BOARD_COLS * CELL;
    const boardH = BOARD_ROWS * CELL;
    const cx = PAD + boardW / 2;
    const cy = PAD + boardH / 2;

    // 반투명 배경
    const backdrop = this.add.rectangle(cx, cy, boardW, boardH, 0x000000, 0.55)
      .setDepth(40);

    // 패널
    const panel = this.add.rectangle(cx, cy, 300, 220, 0x1a0533, 0.96)
      .setDepth(41);
    panel.setStrokeStyle(2, 0xf1c40f, 1);
    panel.setScale(0.5);
    this.tweens.add({ targets: panel, scaleX: 1, scaleY: 1, duration: 280, ease: 'Back.easeOut' });

    // 타이틀
    const title = this.add.text(cx, cy - 72, '🐾 ANIMAL PUZZLE', {
      fontSize: '20px', color: '#f1c40f', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(42);

    // 안내 텍스트
    const desc = this.add.text(cx, cy - 22, `제한시간 ${GAME_TIME}초\n클릭 2번으로 블록을 교환하세요`, {
      fontSize: '14px', color: '#cccccc', align: 'center', lineSpacing: 6,
    }).setOrigin(0.5).setDepth(42);

    // 시작 버튼
    const btn = this.add.rectangle(cx, cy + 68, 140, 44, 0xf1c40f)
      .setDepth(42).setInteractive();
    btn.setStrokeStyle(2, 0xffffff, 0.5);
    const btnLabel = this.add.text(cx, cy + 68, '▶  시작', {
      fontSize: '18px', color: '#1a0533', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(43);

    // 버튼 hover 효과
    btn.on('pointerover', () => btn.setFillStyle(0xffd700));
    btn.on('pointerout',  () => btn.setFillStyle(0xf1c40f));

    // 클릭 → 오버레이 제거 후 게임 시작
    btn.on('pointerdown', () => {
      [backdrop, panel, title, desc, btn, btnLabel].forEach(o => o.destroy());
      this.gameStarted = true;
      this.startTimer();
    });

    // 버튼 살짝 펄스 애니메이션
    this.tweens.add({
      targets: [btn, btnLabel],
      scaleX: 1.05, scaleY: 1.05,
      yoyo: true, repeat: -1,
      duration: 700, ease: 'Sine.easeInOut',
    });
  }

  /* ─────────────────── 관리자 모드: 확인 오버레이 ─────────────────── */
  private showAdminConfirm() {
    const boardW = BOARD_COLS * CELL;
    const boardH = BOARD_ROWS * CELL;
    const cx = PAD + boardW / 2;
    const cy = PAD + boardH / 2;

    const backdrop = this.add.rectangle(cx, cy, boardW, boardH, 0x000000, 0.65)
      .setDepth(30).setInteractive();

    const panel = this.add.rectangle(cx, cy, 330, 200, 0x1a0533, 1).setDepth(31);
    panel.setStrokeStyle(2, 0xff3333, 1);
    panel.setScale(0.4);
    this.tweens.add({ targets: panel, scaleX: 1, scaleY: 1, duration: 260, ease: 'Back.easeOut' });

    const titleTxt = this.add.text(cx, cy - 62, '⚠️  금단의 모드', {
      fontSize: '19px', color: '#ff4444', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(32);

    const msgTxt = this.add.text(cx, cy - 18, '금단의 모드를\n실행하시겠습니까?', {
      fontSize: '15px', color: '#eeeeee', align: 'center', lineSpacing: 6,
    }).setOrigin(0.5).setDepth(32);

    const yesBtn  = this.add.rectangle(cx - 68, cy + 60, 110, 38, 0xcc2222).setDepth(32).setInteractive();
    yesBtn.setStrokeStyle(1, 0xff6666, 0.8);
    const yesLbl  = this.add.text(cx - 68, cy + 60, '수락', {
      fontSize: '15px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(33);

    const noBtn   = this.add.rectangle(cx + 68, cy + 60, 110, 38, 0x333344).setDepth(32).setInteractive();
    noBtn.setStrokeStyle(1, 0x8888aa, 0.8);
    const noLbl   = this.add.text(cx + 68, cy + 60, '취소', {
      fontSize: '15px', color: '#aaaaaa',
    }).setOrigin(0.5).setDepth(33);

    const closeAll = () => {
      [backdrop, panel, titleTxt, msgTxt, yesBtn, yesLbl, noBtn, noLbl].forEach(o => o.destroy());
    };

    yesBtn.on('pointerover', () => yesBtn.setFillStyle(0xff4444));
    yesBtn.on('pointerout',  () => yesBtn.setFillStyle(0xcc2222));
    yesBtn.on('pointerdown', () => { closeAll(); this.activateAdminMode(); });

    noBtn.on('pointerover',  () => noBtn.setFillStyle(0x555566));
    noBtn.on('pointerout',   () => noBtn.setFillStyle(0x333344));
    noBtn.on('pointerdown',  () => closeAll());
    backdrop.on('pointerdown', () => closeAll());
  }

  /* ─────────────────── 관리자 모드: 활성화 ─────────────────── */
  private activateAdminMode() {
    this.adminActive = true;
    this.createAdminButton();
    this.showMsg('⚠️ 금단의 모드 활성화');
    // 수락 즉시 자동 솔버 시작
    this.toggleAdminAuto();
  }

  private createAdminButton() {
    const boardW = BOARD_COLS * CELL;
    const hudX   = PAD + boardW + 20;
    const bx = hudX + 46;
    const by = PAD + 345;

    this.adminBtn = this.add.container(bx, by).setDepth(10);

    const bg = this.add.rectangle(0, 0, 76, 38, 0xcc2222);
    bg.setStrokeStyle(2, 0xff6666, 1);
    bg.setInteractive().on('pointerover', () => bg.setFillStyle(0xff3333))
                        .on('pointerout',  () => bg.setFillStyle(this.adminRunning ? 0x661111 : 0xcc2222))
                        .on('pointerdown', () => this.toggleAdminAuto());

    this.adminBtnLabel = this.add.text(0, 0, '▶  A', {
      fontSize: '16px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.adminBtn.add([bg, this.adminBtnLabel]);

    // 살짝 깜빡이는 glow
    this.tweens.add({
      targets: this.adminBtn, alpha: 0.72, yoyo: true, repeat: -1,
      duration: 900, ease: 'Sine.easeInOut',
    });
  }

  /* ─────────────────── 관리자 모드: 토글 / 자동 솔버 ─────────────────── */
  private toggleAdminAuto() {
    if (this.gameOver) return;
    const bg = this.adminBtn?.list[0] as Phaser.GameObjects.Rectangle | undefined;
    if (this.adminRunning) {
      this.adminRunning = false;
      this.adminBtnLabel?.setText('▶  A');
      bg?.setFillStyle(0xcc2222);
    } else {
      this.adminRunning = true;
      this.adminBtnLabel?.setText('■  A');
      bg?.setFillStyle(0x661111);
      this.runAdminAuto();
    }
  }

  private async runAdminAuto() {
    while (this.adminRunning && !this.gameOver) {
      // 다른 애니메이션 대기
      if (this.busy) { await this.delay(80); continue; }

      const move = this.board.findNextMove();
      if (!move) {
        // 가능한 수 없음 → 자동 셔플
        this.board.shuffle();
        this.refreshSprites();
        await this.delay(350);
        continue;
      }

      this.busy = true;
      await this.animSwap(move.pos1, move.pos2);
      const result = this.board.swap(move.pos1, move.pos2);

      if (result.valid) {
        await this.processChainLoop(result.matches, move.pos1, move.pos2);
        this.updateHUD();
        if (!this.gameOver) this.checkDeadlock();
      }

      this.busy = false;
      await this.delay(180);   // 각 수 사이 짧은 간격
    }

    // 루프 종료 시 버튼 상태 초기화
    if (!this.gameOver) {
      this.adminRunning = false;
      this.adminBtnLabel?.setText('▶  A');
      const bg = this.adminBtn?.list[0] as Phaser.GameObjects.Rectangle | undefined;
      bg?.setFillStyle(0xcc2222);
    }
  }

  private async onBlockClick(pos: Position) {
    if (!this.gameStarted || this.busy || this.gameOver) return;

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
      this.busy = false;
      return;
    }

    await this.processChainLoop(result.matches, prev, pos);
    this.updateHUD();
    if (!this.gameOver) {
      this.checkDeadlock();
      this.busy = false;
    }
  }

  /* ─────────────────── 체인 처리 ─────────────────── */
  private async processChainLoop(firstMatches: MatchGroup[], p1?: Position, p2?: Position) {
    let matches = firstMatches;
    while (matches.length > 0) {
      await this.animPop(matches, p1, p2);
      p1 = undefined; p2 = undefined;
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
      label.setScale(1.2);
    } else {
      bg.setFillStyle(0xffffff, 0).setStrokeStyle(0);
      label.setScale(1);
    }
  }

  /* ─────────────────── 애니메이션 ─────────────────── */
  private animSwap(p1: Position, p2: Position): Promise<void> {
    return new Promise((resolve) => {
      const sp1 = this.sprites[p1.row][p1.col];
      const sp2 = this.sprites[p2.row][p2.col];
      if (!sp1 || !sp2) { resolve(); return; }

      const x1 = PAD + p2.col * CELL + CELL / 2, y1 = PAD + p2.row * CELL + CELL / 2;
      const x2 = PAD + p1.col * CELL + CELL / 2, y2 = PAD + p1.row * CELL + CELL / 2;
      let done = 0;
      const fin = () => { if (++done === 2) resolve(); };

      this.tweens.add({ targets: sp1, x: x1, y: y1, duration: ANIM_SWAP, ease: 'Power2', onComplete: fin });
      this.tweens.add({ targets: sp2, x: x2, y: y2, duration: ANIM_SWAP, ease: 'Power2', onComplete: fin });
      this.sprites[p1.row][p1.col] = sp2;
      this.sprites[p2.row][p2.col] = sp1;
    });
  }

  private animPop(matches: MatchGroup[], _p1?: Position, _p2?: Position): Promise<void> {
    return new Promise((resolve) => {
      const positions = matches.flatMap(m => m.positions);
      if (!positions.length) { resolve(); return; }

      this.audio.playGroup(matches.map(m => m.type));

      let done = 0;
      const fin = () => { if (++done === positions.length) resolve(); };

      for (const pos of positions) {
        const sp = this.sprites[pos.row][pos.col];
        if (!sp) { fin(); continue; }

        const wx = PAD + pos.col * CELL + CELL / 2;
        const wy = PAD + pos.row * CELL + CELL / 2;

        // 파티클: 작은 원 4개 사방으로
        const blockType = this.board.grid[pos.row][pos.col]?.type
          ?? (matches.find(m => m.positions.some(p => p.row === pos.row && p.col === pos.col))?.type ?? 'red');
        this.spawnParticles(wx, wy, BLOCK_COLORS[blockType as BlockType]);

        // 플로팅 점수
        const pts = 10 * this.board.combo;
        this.spawnFloatingScore(wx, wy, `+${pts}`);

        this.tweens.add({
          targets: sp, scaleX: 0, scaleY: 0, alpha: 0,
          duration: ANIM_POP, ease: 'Back.easeIn',
          onComplete: () => { sp.destroy(); this.sprites[pos.row][pos.col] = null; fin(); },
        });
      }
    });
  }

  /* ─────────────────── 파티클 ─────────────────── */
  private spawnParticles(x: number, y: number, color: number) {
    const dirs = [[-1,-1],[1,-1],[-1,1],[1,1],[0,-1],[0,1],[-1,0],[1,0]];
    for (const [dx, dy] of dirs) {
      const dot = this.add.circle(x, y, 5, color, 0.9).setDepth(5);
      this.tweens.add({
        targets: dot,
        x: x + dx * (28 + Math.random() * 18),
        y: y + dy * (28 + Math.random() * 18),
        alpha: 0, scaleX: 0.3, scaleY: 0.3,
        duration: 320 + Math.random() * 120,
        ease: 'Power2',
        onComplete: () => dot.destroy(),
      });
    }
  }

  /* ─────────────────── 플로팅 점수 ─────────────────── */
  private spawnFloatingScore(x: number, y: number, text: string) {
    const t = this.add.text(x, y, text, {
      fontSize: '18px', color: '#ffffff', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(6);

    this.tweens.add({
      targets: t, y: y - 48, alpha: 0,
      duration: 700, ease: 'Power2',
      onComplete: () => t.destroy(),
    });
  }

  /* ─────────────────── HUD 갱신 ─────────────────── */
  private updateHUD() {
    this.scoreText.setText(this.board.score.toLocaleString());

    const best = this.getBestScore();
    this.bestText.setText(String(Math.max(best, this.board.score)));

    if (this.board.combo > 1) {
      this.comboText.setText(`COMBO ×${this.board.combo}!`);
      this.tweens.add({
        targets: this.comboText, scaleX: 1.35, scaleY: 1.35,
        yoyo: true, duration: 180, ease: 'Power2',
      });
      this.time.delayedCall(1400, () => this.comboText.setText(''));
    }

    const GAME_W = 700;
    const hudX   = PAD + BOARD_COLS * CELL + 20;
    const BAR_W  = GAME_W - hudX - 14;

    const pct = Math.max(0, this.board.hp / 100);
    this.hpBar.setDisplaySize(Math.max(0, BAR_W * pct), 22);
    this.hpText.setText(String(Math.max(0, Math.round(this.board.hp))));

    if (pct > 0.5) {
      // 초록: 안전
      this.hpBar.setFillStyle(0x2ecc71);
      this.hpText.setColor('#ffffff');
      this.hpLabel.setColor('#ff6b6b');
    } else if (pct > 0.2) {
      // 주황: 경고
      this.hpBar.setFillStyle(0xf39c12);
      this.hpText.setColor('#f39c12');
      this.hpLabel.setColor('#f39c12');
    } else {
      // 빨강: 위험
      this.hpBar.setFillStyle(0xe74c3c);
      this.hpText.setColor('#ff4444');
      this.hpLabel.setColor('#ff4444');

      // HP 레이블 펄스 — 딱 한 번만 tween 생성
      if (!this.hpPulsing) {
        this.hpPulsing = true;
        this.tweens.add({
          targets: this.hpLabel,
          alpha: 0.3, yoyo: true, repeat: -1,
          duration: 450, ease: 'Sine.easeInOut',
        });
        this.tweens.add({
          targets: this.hpBar,
          alpha: 0.5, yoyo: true, repeat: -1,
          duration: 450, ease: 'Sine.easeInOut',
        });
      }
    }
  }

  /* ─────────────────── 데드락 / 셔플 ─────────────────── */
  private checkDeadlock() {
    if (!this.board.hasPossibleMoves()) {
      this.board.shuffle();
      this.refreshSprites();
      this.showMsg(gt('noMoves'));
    }
  }

  private reshuffleBoard(force = false) {
    if (force || !this.board.hasPossibleMoves()) {
      this.board.shuffle();
      this.refreshSprites();
      this.showMsg(gt('shuffled'));
    }
  }

  private showMsg(text: string) {
    const bw = BOARD_COLS * CELL, bh = BOARD_ROWS * CELL;
    const t = this.add.text(PAD + bw / 2, PAD + bh / 2, text, {
      fontSize: '28px', color: '#ffffff',
      backgroundColor: '#000000bb', padding: { x: 14, y: 8 },
    }).setOrigin(0.5).setDepth(10);
    this.tweens.add({ targets: t, alpha: 0, y: t.y - 50, duration: 1400, ease: 'Power2', onComplete: () => t.destroy() });
  }

  /* ─────────────────── 최고점수 (localStorage) ─────────────────── */
  private getBestScore(): number {
    try { return parseInt(localStorage.getItem('match3_best') ?? '0', 10) || 0; }
    catch { return 0; }
  }
  private saveBestScore(score: number) {
    try {
      const prev = this.getBestScore();
      if (score > prev) localStorage.setItem('match3_best', String(score));
    } catch { /* noop */ }
  }

  /* ─────────────────── 유틸 ─────────────────── */
  private delay(ms: number): Promise<void> {
    return new Promise(r => this.time.delayedCall(ms, r));
  }

  getBoard(): Board { return this.board; }
}
