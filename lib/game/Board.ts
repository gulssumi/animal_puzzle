import {
  Block,
  BlockType,
  BLOCK_TYPES,
  BOARD_COLS,
  BOARD_ROWS,
  INITIAL_HP,
  MatchGroup,
  Position,
  SwapResult,
} from './types';

let blockIdCounter = 0;

function makeBlock(type: BlockType, row: number, col: number): Block {
  return { type, row, col, id: `b${blockIdCounter++}` };
}

function randomBlockType(): BlockType {
  return BLOCK_TYPES[Math.floor(Math.random() * BLOCK_TYPES.length)];
}

export class Board {
  grid: (Block | null)[][];
  score: number;
  combo: number;
  hp: number;

  constructor() {
    this.score = 0;
    this.combo = 0;
    this.hp = INITIAL_HP;
    this.grid = this.createInitialGrid();
  }

  private createInitialGrid(): (Block | null)[][] {
    let grid: (Block | null)[][];
    do {
      grid = Array.from({ length: BOARD_ROWS }, (_, r) =>
        Array.from({ length: BOARD_COLS }, (_, c) => makeBlock(randomBlockType(), r, c))
      );
      this.resolveInitialMatches(grid);
    } while (this.findMatches(grid).length > 0);
    return grid;
  }

  private resolveInitialMatches(grid: (Block | null)[][]): void {
    let changed = true;
    while (changed) {
      changed = false;
      const matches = this.findMatches(grid);
      for (const match of matches) {
        for (const pos of match.positions) {
          const newType = this.safeRandomType(grid, pos.row, pos.col);
          grid[pos.row][pos.col] = makeBlock(newType, pos.row, pos.col);
          changed = true;
        }
      }
    }
  }

  private safeRandomType(grid: (Block | null)[][], row: number, col: number): BlockType {
    const forbidden = new Set<BlockType>();
    if (col >= 2) {
      const l1 = grid[row][col - 1]?.type;
      const l2 = grid[row][col - 2]?.type;
      if (l1 && l1 === l2) forbidden.add(l1);
    }
    if (row >= 2) {
      const u1 = grid[row - 1][col]?.type;
      const u2 = grid[row - 2][col]?.type;
      if (u1 && u1 === u2) forbidden.add(u1);
    }
    const available = BLOCK_TYPES.filter((t) => !forbidden.has(t));
    return available[Math.floor(Math.random() * available.length)];
  }

  findMatches(grid: (Block | null)[][]): MatchGroup[] {
    const matched: boolean[][] = Array.from({ length: BOARD_ROWS }, () =>
      Array(BOARD_COLS).fill(false)
    );
    const groups: MatchGroup[] = [];

    // 가로 탐색
    for (let r = 0; r < BOARD_ROWS; r++) {
      let c = 0;
      while (c < BOARD_COLS) {
        const block = grid[r][c];
        if (!block) { c++; continue; }
        let end = c + 1;
        while (end < BOARD_COLS && grid[r][end]?.type === block.type) end++;
        if (end - c >= 3) {
          const positions: Position[] = [];
          for (let k = c; k < end; k++) { matched[r][k] = true; positions.push({ row: r, col: k }); }
          groups.push({ positions, type: block.type });
        }
        c = end;
      }
    }

    // 세로 탐색
    for (let c = 0; c < BOARD_COLS; c++) {
      let r = 0;
      while (r < BOARD_ROWS) {
        const block = grid[r][c];
        if (!block) { r++; continue; }
        let end = r + 1;
        while (end < BOARD_ROWS && grid[end][c]?.type === block.type) end++;
        if (end - r >= 3) {
          const positions: Position[] = [];
          for (let k = r; k < end; k++) { matched[k][c] = true; positions.push({ row: k, col: c }); }
          groups.push({ positions, type: block.type });
        }
        r = end;
      }
    }

    // 중복 제거: 같은 타입이 가로+세로 겹치는 경우 병합
    return this.mergeGroups(groups);
  }

  private mergeGroups(groups: MatchGroup[]): MatchGroup[] {
    const seen = new Set<string>();
    return groups.map((g) => ({
      ...g,
      positions: g.positions.filter((p) => {
        const key = `${p.row},${p.col}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
    })).filter((g) => g.positions.length >= 3);
  }

  swap(pos1: Position, pos2: Position): SwapResult {
    if (!this.isAdjacent(pos1, pos2)) {
      return { valid: false, matches: [], combo: 0, scoreGained: 0 };
    }

    this.swapBlocks(this.grid, pos1, pos2);
    const matches = this.findMatches(this.grid);

    if (matches.length === 0) {
      this.swapBlocks(this.grid, pos1, pos2);
      return { valid: false, matches: [], combo: 0, scoreGained: 0 };
    }

    this.combo = 0;
    const scoreGained = this.processMatches(matches);
    return { valid: true, matches, combo: this.combo, scoreGained };
  }

  private processMatches(initialMatches: MatchGroup[]): number {
    let totalScore = 0;
    let matches = initialMatches;

    while (matches.length > 0) {
      this.combo++;
      totalScore += this.calcScore(matches, this.combo);
      this.removeBlocks(matches);
      this.applyGravity();
      this.fillEmpty();
      matches = this.findMatches(this.grid);
    }

    this.score += totalScore;
    return totalScore;
  }

  processChain(): { matches: MatchGroup[]; scoreGained: number } {
    const matches = this.findMatches(this.grid);
    if (matches.length === 0) return { matches: [], scoreGained: 0 };
    this.combo++;
    const scoreGained = this.calcScore(matches, this.combo);
    this.score += scoreGained;
    this.removeBlocks(matches);
    this.applyGravity();
    this.fillEmpty();
    return { matches, scoreGained };
  }

  private calcScore(matches: MatchGroup[], combo: number): number {
    const blockCount = matches.reduce((sum, m) => sum + m.positions.length, 0);
    return blockCount * 10 * combo;
  }

  private removeBlocks(matches: MatchGroup[]): void {
    for (const match of matches) {
      for (const pos of match.positions) {
        this.grid[pos.row][pos.col] = null;
      }
    }
  }

  applyGravity(): void {
    for (let c = 0; c < BOARD_COLS; c++) {
      let writeRow = BOARD_ROWS - 1;
      for (let r = BOARD_ROWS - 1; r >= 0; r--) {
        if (this.grid[r][c] !== null) {
          const block = this.grid[r][c]!;
          block.row = writeRow;
          this.grid[writeRow][c] = block;
          if (writeRow !== r) this.grid[r][c] = null;
          writeRow--;
        }
      }
      for (let r = writeRow; r >= 0; r--) {
        this.grid[r][c] = null;
      }
    }
  }

  fillEmpty(): void {
    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        if (this.grid[r][c] === null) {
          this.grid[r][c] = makeBlock(randomBlockType(), r, c);
        }
      }
    }
  }

  addGarbageRow(count: number = 1): void {
    for (let i = 0; i < count; i++) {
      // 위로 한 칸씩 밀어올리기
      for (let r = 0; r < BOARD_ROWS - 1; r++) {
        this.grid[r] = this.grid[r + 1];
        this.grid[r].forEach((b) => { if (b) b.row = r; });
      }
      // 맨 아래 행을 방해 블록(회색 random)으로 채우기
      this.grid[BOARD_ROWS - 1] = Array.from({ length: BOARD_COLS }, (_, c) =>
        makeBlock(randomBlockType(), BOARD_ROWS - 1, c)
      );
      this.hp = Math.max(0, this.hp - 10);
    }
  }

  private swapBlocks(grid: (Block | null)[][], p1: Position, p2: Position): void {
    const tmp = grid[p1.row][p1.col];
    grid[p1.row][p1.col] = grid[p2.row][p2.col];
    grid[p2.row][p2.col] = tmp;
    if (grid[p1.row][p1.col]) { grid[p1.row][p1.col]!.row = p1.row; grid[p1.row][p1.col]!.col = p1.col; }
    if (grid[p2.row][p2.col]) { grid[p2.row][p2.col]!.row = p2.row; grid[p2.row][p2.col]!.col = p2.col; }
  }

  private isAdjacent(p1: Position, p2: Position): boolean {
    const dr = Math.abs(p1.row - p2.row);
    const dc = Math.abs(p1.col - p2.col);
    return (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
  }

  hasPossibleMoves(): boolean {
    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        if (c + 1 < BOARD_COLS) {
          this.swapBlocks(this.grid, { row: r, col: c }, { row: r, col: c + 1 });
          const has = this.findMatches(this.grid).length > 0;
          this.swapBlocks(this.grid, { row: r, col: c }, { row: r, col: c + 1 });
          if (has) return true;
        }
        if (r + 1 < BOARD_ROWS) {
          this.swapBlocks(this.grid, { row: r, col: c }, { row: r + 1, col: c });
          const has = this.findMatches(this.grid).length > 0;
          this.swapBlocks(this.grid, { row: r, col: c }, { row: r + 1, col: c });
          if (has) return true;
        }
      }
    }
    return false;
  }

  /** 자동 솔버용: 매치가 생기는 첫 번째 스왑을 반환 */
  findNextMove(): { pos1: Position; pos2: Position } | null {
    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        for (const [dr, dc] of [[0, 1], [1, 0]]) {
          const r2 = r + dr, c2 = c + dc;
          if (r2 >= BOARD_ROWS || c2 >= BOARD_COLS) continue;
          this.swapBlocks(this.grid, { row: r, col: c }, { row: r2, col: c2 });
          const has = this.findMatches(this.grid).length > 0;
          this.swapBlocks(this.grid, { row: r, col: c }, { row: r2, col: c2 });
          if (has) return { pos1: { row: r, col: c }, pos2: { row: r2, col: c2 } };
        }
      }
    }
    return null;
  }

  shuffle(): void {
    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        const r2 = Math.floor(Math.random() * BOARD_ROWS);
        const c2 = Math.floor(Math.random() * BOARD_COLS);
        this.swapBlocks(this.grid, { row: r, col: c }, { row: r2, col: c2 });
      }
    }
    while (this.findMatches(this.grid).length > 0 || !this.hasPossibleMoves()) {
      for (let r = 0; r < BOARD_ROWS; r++) {
        for (let c = 0; c < BOARD_COLS; c++) {
          this.grid[r][c] = makeBlock(randomBlockType(), r, c);
        }
      }
      this.resolveInitialMatches(this.grid);
    }
  }
}
