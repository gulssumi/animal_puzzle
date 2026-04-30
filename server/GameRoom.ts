import { Server, Socket } from 'socket.io';
import { ServerBoard } from './Board';
import { GAME_TIME } from './types';

export interface Player {
  socket: Socket;
  nickname: string;
  side: 'A' | 'B';
  board: ServerBoard;
}

export class GameRoom {
  id: string;
  players: [Player, Player];
  private timer!: NodeJS.Timeout;
  private timeLeft = GAME_TIME;
  private ended = false;

  constructor(id: string, a: Player, b: Player) {
    this.id = id;
    this.players = [a, b];
  }

  start(io: Server) {
    const [A, B] = this.players;

    // 게임 시작 알림
    A.socket.emit('game_start', { roomId: this.id, opponentNick: B.nickname, yourSide: 'A' });
    B.socket.emit('game_start', { roomId: this.id, opponentNick: A.nickname, yourSide: 'B' });

    this.broadcastState();

    // 타이머
    this.timer = setInterval(() => {
      this.timeLeft--;
      io.to(this.id).emit('timer_tick', { timeLeft: this.timeLeft });
      if (this.timeLeft <= 0) this.endGame(io, 'time');
    }, 1000);
  }

  handleMove(io: Server, side: 'A' | 'B', pos1: { row: number; col: number }, pos2: { row: number; col: number }) {
    if (this.ended) return;

    const me  = this.players.find(p => p.side === side)!;
    const opp = this.players.find(p => p.side !== side)!;

    const power = me.board.swap(pos1, pos2);
    this.broadcastState();

    // 콤보 ≥ 2 이면 상대방에게 방해 블록
    if (power >= 2) {
      const garbageRows = Math.floor(power / 3) + 1;
      opp.board.addGarbage(garbageRows);
      opp.socket.emit('garbage_incoming', { rows: garbageRows });
      this.broadcastState();

      if (opp.board.hp <= 0) {
        this.endGame(io, 'hp');
        return;
      }
    }
  }

  private broadcastState() {
    const [A, B] = this.players;
    A.socket.emit('state_sync', {
      yourScore: A.board.score, yourHp: A.board.hp, yourCombo: A.board.combo,
      oppScore:  B.board.score, oppHp:  B.board.hp,
    });
    B.socket.emit('state_sync', {
      yourScore: B.board.score, yourHp: B.board.hp, yourCombo: B.board.combo,
      oppScore:  A.board.score, oppHp:  A.board.hp,
    });
  }

  private endGame(io: Server, reason: 'time' | 'hp') {
    if (this.ended) return;
    this.ended = true;
    clearInterval(this.timer);

    const [A, B] = this.players;
    let winnerSide: 'A' | 'B' | 'draw';

    if (reason === 'hp') {
      winnerSide = A.board.hp <= 0 ? 'B' : 'A';
    } else {
      if (A.board.score > B.board.score) winnerSide = 'A';
      else if (B.board.score > A.board.score) winnerSide = 'B';
      else winnerSide = 'draw';
    }

    const send = (p: Player) => {
      const result = winnerSide === 'draw' ? 'draw' : winnerSide === p.side ? 'you' : 'opponent';
      p.socket.emit('game_over', {
        winner: result,
        yourScore: p.board.score,
        oppScore: (p.side === 'A' ? B : A).board.score,
      });
    };
    send(A); send(B);
  }

  handleDisconnect(io: Server, side: 'A' | 'B') {
    if (this.ended) return;
    this.ended = true;
    clearInterval(this.timer);
    const opp = this.players.find(p => p.side !== side);
    opp?.socket.emit('opp_disconnect', {});
  }
}
