// 클라이언트 → 서버
export interface C2S_JoinGame  { nickname: string }
export interface C2S_Move      { pos1: { row: number; col: number }; pos2: { row: number; col: number } }

// 서버 → 클라이언트
export interface S2C_Waiting   { queueSize: number }
export interface S2C_GameStart { roomId: string; opponentNick: string; yourSide: 'A' | 'B' }
export interface S2C_StateSync {
  yourScore: number; yourHp: number; yourCombo: number;
  oppScore: number;  oppHp: number;
}
export interface S2C_GarbageIncoming { rows: number }
export interface S2C_GameOver  { winner: 'you' | 'opponent' | 'draw'; yourScore: number; oppScore: number }
export interface S2C_OppDisconnect {}

export type BlockType = 'red'|'blue'|'green'|'yellow'|'purple'|'orange';
export const BLOCK_TYPES: BlockType[] = ['red','blue','green','yellow','purple','orange'];
export const BOARD_ROWS = 8;
export const BOARD_COLS = 8;
export const GAME_TIME  = 60;
