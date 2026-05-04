import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

export interface ScoreEntry {
  id: string;
  nickname: string;
  score: number;
  playedAt: string; // ISO 8601
}

export type Period = 'world' | 'monthly' | 'daily' | 'hourly';

const DATA_FILE = process.env.DATA_FILE ?? join('/tmp', 'scores.json');

function load(): ScoreEntry[] {
  if (!existsSync(DATA_FILE)) return [];
  try { return JSON.parse(readFileSync(DATA_FILE, 'utf-8')) as ScoreEntry[]; }
  catch { return []; }
}

function save(entries: ScoreEntry[]): void {
  writeFileSync(DATA_FILE, JSON.stringify(entries, null, 2), 'utf-8');
}

export function addScore(nickname: string, score: number): { entry: ScoreEntry; ranks: Record<Period, number> } {
  const entries = load();
  const entry: ScoreEntry = {
    id: randomUUID(),
    nickname: nickname.trim().slice(0, 20) || 'Anonymous',
    score,
    playedAt: new Date().toISOString(),
  };
  entries.push(entry);
  save(entries);

  const ranks: Record<Period, number> = {
    world:   getRankFromEntries(entries, score, 'world'),
    monthly: getRankFromEntries(entries, score, 'monthly'),
    daily:   getRankFromEntries(entries, score, 'daily'),
    hourly:  getRankFromEntries(entries, score, 'hourly'),
  };

  return { entry, ranks };
}

function inPeriod(entry: ScoreEntry, period: Period): boolean {
  const now = new Date();
  const d   = new Date(entry.playedAt);
  switch (period) {
    case 'world':   return true;
    case 'monthly': return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    case 'daily':   return d.toDateString() === now.toDateString();
    case 'hourly':
      return d.getFullYear() === now.getFullYear()
          && d.getMonth()    === now.getMonth()
          && d.getDate()     === now.getDate()
          && d.getHours()    === now.getHours();
  }
}

function getRankFromEntries(entries: ScoreEntry[], score: number, period: Period): number {
  return entries.filter(e => inPeriod(e, period) && e.score > score).length + 1;
}

export function getLeaderboard(period: Period, limit = 30): ScoreEntry[] {
  const entries = load();
  return entries
    .filter(e => inPeriod(e, period))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
