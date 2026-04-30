export const BLOCK_TYPES = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'] as const;
export type BlockType = typeof BLOCK_TYPES[number];

export interface Block {
  type: BlockType;
  row: number;
  col: number;
  id: string;
}

export interface Position {
  row: number;
  col: number;
}

export interface MatchGroup {
  positions: Position[];
  type: BlockType;
}

export interface SwapResult {
  valid: boolean;
  matches: MatchGroup[];
  combo: number;
  scoreGained: number;
}

export interface BoardState {
  grid: (Block | null)[][];
  score: number;
  combo: number;
  hp: number;
}

export const BOARD_ROWS = 8;
export const BOARD_COLS = 8;
export const INITIAL_HP = 100;

export const BLOCK_COLORS: Record<BlockType, number> = {
  red: 0xe74c3c,
  blue: 0x3498db,
  green: 0x2ecc71,
  yellow: 0xf1c40f,
  purple: 0x9b59b6,
  orange: 0xe67e22,
};
