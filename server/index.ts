import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { addScore, getLeaderboard, Period } from './ScoreStore';

const PORT          = process.env.PORT          ?? 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? 'http://localhost:3010';

const app  = express();
const http = createServer(app);

const allowedOrigins = CLIENT_ORIGIN.split(',').map(o => o.trim());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error(`CORS: ${origin} not allowed`));
  },
}));
app.use(express.json());

// ── Health ────────────────────────────────────
app.get('/health', (_, res) => res.json({ ok: true, time: Date.now() }));

// ── 점수 등록 ─────────────────────────────────
// POST /scores  { nickname: string, score: number }
app.post('/scores', (req, res) => {
  const { nickname, score } = req.body as { nickname?: string; score?: number };

  if (typeof score !== 'number' || score < 0) {
    res.status(400).json({ error: 'invalid score' });
    return;
  }

  const result = addScore(nickname ?? 'Anonymous', score);
  console.log(`[score] ${result.entry.nickname}  ${result.entry.score}  world#${result.ranks.world}`);
  res.json(result);
});

// ── 리더보드 조회 ──────────────────────────────
// GET /leaderboard?period=world|monthly|daily|hourly&limit=30
app.get('/leaderboard', (req, res) => {
  const period = (req.query.period as Period) ?? 'world';
  const limit  = Math.min(parseInt(req.query.limit as string ?? '30', 10), 100);

  const validPeriods: Period[] = ['world', 'monthly', 'daily', 'hourly'];
  if (!validPeriods.includes(period)) {
    res.status(400).json({ error: 'invalid period' });
    return;
  }

  const entries = getLeaderboard(period, limit);
  res.json({ period, entries });
});

http.listen(PORT, () => console.log(`[server] listening on :${PORT}`));
