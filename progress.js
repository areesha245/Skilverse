// progress.js - history, weak topics, sharing
import { getSessions, getShares, saveShare, removeShare } from './storage.js';

// Every zone scores differently, so convert a session to a 0-100 percentage
export function sessionPercent(session) {
  if (session.zone === 'teachBack') return session.score;      // already out of 100
  if (session.zone === 'interview') return session.score * 10; // out of 10
  if (session.zone === 'story') {                               // result looks like "3/5"
    const match = /(\d+)\s*\/\s*(\d+)/.exec(session.result || '');
    return match && Number(match[2]) > 0 ? Math.round(100 * Number(match[1]) / Number(match[2])) : null;
  }
  return null;
}

// Newest first; zone 'all' returns every session
export function getHistory(userId, zone = 'all') {
  return getSessions(userId).filter(s => zone === 'all' || s.zone === zone).reverse();
}

export function averagePercent(sessions) {
  const values = sessions.map(sessionPercent).filter(v => v !== null);
  if (values.length === 0) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

// The topics a student missed most often
export function weakTopicCounts(sessions, limit = 5) {
  const counts = {};
  sessions.forEach(session => (session.weakTopics || []).forEach(topic => { counts[topic] = (counts[topic] || 0) + 1; }));
  return Object.entries(counts).map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count).slice(0, limit);
}

export function isSharing(userId) { return getShares().some(share => share.userId === userId); }

// The student chooses to share a short summary; only this summary is visible to teachers
export function shareProgress(user) {
  const sessions = getSessions(user.id);
  if (sessions.length === 0) return { ok: false, error: 'Complete at least one session before sharing.' };
  saveShare({
    userId: user.id, name: user.name, sessions: sessions.length,
    average: averagePercent(sessions), weakTopics: weakTopicCounts(sessions).map(w => w.topic),
    date: new Date().toLocaleDateString('en-GB')
  });
  return { ok: true };
}
export function stopSharing(userId) { removeShare(userId); }

export function getSharedSummaries() { return getShares().reverse(); }
