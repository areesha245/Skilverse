// gamification.js - XP, levels, badges, streaks
import { getUserById, updateUser } from './storage.js';

export const XP_PER_LEVEL = 200;
export const BADGES = [
  { id: 'first_steps', name: 'First Steps', description: 'Earn your first XP', test: u => u.xp >= 1 },
  { id: 'story_starter', name: 'Story Starter', description: 'Finish a Story Realm', test: u => u.stats.storiesCompleted >= 1 },
  { id: 'clear_speaker', name: 'Clear Speaker', description: 'Score 80% or more in Teach-Back', test: u => u.stats.bestClarity >= 80 },
  { id: 'room_cleared', name: 'Room Cleared', description: 'Clear an interview room', test: u => u.stats.roomsCleared >= 1 },
  { id: 'streak_5', name: '5-Day Streak', description: 'Study 5 days in a row', test: u => u.streak >= 5 }
];

export function levelFromXp(xp) { return Math.floor(Math.max(0, xp) / XP_PER_LEVEL) + 1; }
export function xpProgress(xp) { return { into: Math.max(0, xp) % XP_PER_LEVEL, needed: XP_PER_LEVEL }; }

// Older accounts may not have badges/stats yet, so fill in safe defaults
export function getProfile(user) {
  const stats = { storiesCompleted: 0, bestClarity: 0, roomsCleared: 0, ...(user.stats || {}) };
  return { ...user, badges: user.badges || [], stats };
}

// Adds every badge whose condition is now true (and not already owned)
function collectBadges(user) {
  const earned = BADGES.filter(b => !user.badges.includes(b.id) && b.test(user));
  earned.forEach(b => user.badges.push(b.id));
  return earned;
}

export function awardXP(userId, points) {
  const found = getUserById(userId);
  if (!found || !Number.isInteger(points) || points <= 0) return { ok: false, error: 'Invalid user or points.' };
  const user = getProfile(found);
  const oldLevel = levelFromXp(user.xp);
  user.xp += points;
  user.level = levelFromXp(user.xp);
  const newBadges = collectBadges(user);
  updateUser(userId, { xp: user.xp, level: user.level, badges: user.badges, stats: user.stats });
  return { ok: true, user, leveledUp: user.level > oldLevel, newBadges };
}

// Records a statistic (add by default, or keep the best value) and checks badges
export function recordStat(userId, name, value, keepBest = false) {
  const found = getUserById(userId);
  if (!found) return { ok: false, error: 'User not found.' };
  const user = getProfile(found);
  const old = user.stats[name] || 0;
  user.stats[name] = keepBest ? Math.max(old, value) : old + value;
  const newBadges = collectBadges(user);
  updateUser(userId, { stats: user.stats, badges: user.badges });
  return { ok: true, user, newBadges };
}

export function checkBadges(userId) {
  const found = getUserById(userId);
  if (!found) return [];
  const user = getProfile(found);
  const earned = collectBadges(user);
  updateUser(userId, { badges: user.badges, stats: user.stats });
  return earned;
}

export function getClearedRooms(user, roleId) { return (user.clearedRooms || {})[roleId] || []; }

// Marks a room as cleared (only counts the first time) and checks badges
export function unlockNextRoom(userId, roleId, roomId) {
  const found = getUserById(userId);
  if (!found) return { ok: false, newBadges: [] };
  const cleared = getClearedRooms(found, roleId);
  if (cleared.includes(roomId)) return { ok: true, newBadges: [] }; // already cleared before
  updateUser(userId, { clearedRooms: { ...(found.clearedRooms || {}), [roleId]: [...cleared, roomId] } });
  return recordStat(userId, 'roomsCleared', 1);
}
