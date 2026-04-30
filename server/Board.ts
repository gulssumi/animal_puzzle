import { BlockType, BLOCK_TYPES, BOARD_COLS, BOARD_ROWS } from './types';

interface Block { type: BlockType; row: number; col: number }
interface Pos    { row: number; col: number }
interface Match  { positions: Pos[]; type: BlockType }

let uid = 0;
const mkBlock = (t: BlockType, r: number, c: number): Block => ({ type: t, row: r, col: c });
const rnd = (): BlockType => BLOCK_TYPES[Math.floor(Math.random() * BLOCK_TYPES.length)];

export class ServerBoard {
  grid: (Block | null)[][];
  score  = 0;
  combo  = 0;
  hp     = 100;

  constructor() {
    this.grid = this.initGrid();
  }

  private initGrid(): (Block | null)[][] {
    let g: (Block | null)[][];
    do {
      g = Array.from({ length: BOARD_ROWS }, (_, r) =>
        Array.from({ length: BOARD_COLS }, (_, c) => mkBlock(rnd(), r, c))
      );
      this.clearInitMatches(g);
    } while (this.findMatches(g).length > 0);
    return g;
  }

  private clearInitMatches(g: (Block | null)[][]): void {
    let changed = true;
    while (changed) {
      changed = false;
      for (const m of this.findMatches(g)) {
        for (const p of m.positions) {
          const forbidden = new Set<BlockType>();
          if (p.col >= 2) { const a = g[p.row][p.col-1]?.type, b = g[p.row][p.col-2]?.type; if (a && a===b) forbidden.add(a); }
          if (p.row >= 2) { const a = g[p.row-1][p.col]?.type, b = g[p.row-2][p.col]?.type; if (a && a===b) forbidden.add(a); }
          const avail = BLOCK_TYPES.filter(t => !forbidden.has(t));
          g[p.row][p.col] = mkBlock(avail[Math.floor(Math.random()*avail.length)], p.row, p.col);
          changed = true;
        }
      }
    }
  }

  findMatches(g: (Block|null)[][]): Match[] {
    const groups: Match[] = [];
    for (let r = 0; r < BOARD_ROWS; r++) {
      let c = 0;
      while (c < BOARD_COLS) {
        const b = g[r][c]; if (!b) { c++; continue; }
        let e = c+1;
        while (e < BOARD_COLS && g[r][e]?.type === b.type) e++;
        if (e-c >= 3) groups.push({ positions: Array.from({length:e-c},(_,i)=>({row:r,col:c+i})), type:b.type });
        c = e;
      }
    }
    for (let c = 0; c < BOARD_COLS; c++) {
      let r = 0;
      while (r < BOARD_ROWS) {
        const b = g[r][c]; if (!b) { r++; continue; }
        let e = r+1;
        while (e < BOARD_ROWS && g[e][c]?.type === b.type) e++;
        if (e-r >= 3) groups.push({ positions: Array.from({length:e-r},(_,i)=>({row:r+i,col:c})), type:b.type });
        r = e;
      }
    }
    return groups;
  }

  private swapBlocks(g: (Block|null)[][], p1: Pos, p2: Pos) {
    const t = g[p1.row][p1.col];
    g[p1.row][p1.col] = g[p2.row][p2.col];
    g[p2.row][p2.col] = t;
    if (g[p1.row][p1.col]) { g[p1.row][p1.col]!.row=p1.row; g[p1.row][p1.col]!.col=p1.col; }
    if (g[p2.row][p2.col]) { g[p2.row][p2.col]!.row=p2.row; g[p2.row][p2.col]!.col=p2.col; }
  }

  private isAdj(p1: Pos, p2: Pos) {
    return (Math.abs(p1.row-p2.row)+Math.abs(p1.col-p2.col)) === 1;
  }

  /** 스왑 처리 → 콤보 수 반환 (공격에 사용) */
  swap(p1: Pos, p2: Pos): number {
    if (!this.isAdj(p1,p2)) return 0;
    this.swapBlocks(this.grid, p1, p2);
    const m = this.findMatches(this.grid);
    if (!m.length) { this.swapBlocks(this.grid, p1, p2); return 0; }
    this.combo = 0;
    return this.processAll();
  }

  private processAll(): number {
    let total = 0;
    let ms = this.findMatches(this.grid);
    while (ms.length) {
      this.combo++;
      total += this.combo;
      for (const m of ms) for (const p of m.positions) this.grid[p.row][p.col] = null;
      this.applyGravity(); this.fillEmpty();
      ms = this.findMatches(this.grid);
    }
    this.score += total * 10;
    return total;          // 공격력 = 총 매치 수 × 콤보 가중치
  }

  applyGravity() {
    for (let c = 0; c < BOARD_COLS; c++) {
      let w = BOARD_ROWS-1;
      for (let r = BOARD_ROWS-1; r >= 0; r--) {
        if (this.grid[r][c]) {
          this.grid[r][c]!.row = w;
          this.grid[w][c] = this.grid[r][c];
          if (w!==r) this.grid[r][c] = null;
          w--;
        }
      }
      for (let r = w; r >= 0; r--) this.grid[r][c] = null;
    }
  }

  fillEmpty() {
    for (let r = 0; r < BOARD_ROWS; r++)
      for (let c = 0; c < BOARD_COLS; c++)
        if (!this.grid[r][c]) this.grid[r][c] = mkBlock(rnd(), r, c);
  }

  addGarbage(rows: number) {
    for (let i = 0; i < rows; i++) {
      for (let r = 0; r < BOARD_ROWS-1; r++) {
        this.grid[r] = this.grid[r+1];
        this.grid[r].forEach(b => { if (b) b.row = r; });
      }
      this.grid[BOARD_ROWS-1] = Array.from({length:BOARD_COLS},(_,c) => mkBlock(rnd(), BOARD_ROWS-1, c));
      this.hp = Math.max(0, this.hp - 10);
    }
  }

  hasMoves(): boolean {
    for (let r = 0; r < BOARD_ROWS; r++)
      for (let c = 0; c < BOARD_COLS; c++) {
        for (const [dr,dc] of [[0,1],[1,0]]) {
          const r2=r+dr, c2=c+dc;
          if (r2>=BOARD_ROWS||c2>=BOARD_COLS) continue;
          this.swapBlocks(this.grid,{row:r,col:c},{row:r2,col:c2});
          const ok = this.findMatches(this.grid).length > 0;
          this.swapBlocks(this.grid,{row:r,col:c},{row:r2,col:c2});
          if (ok) return true;
        }
      }
    return false;
  }
}
