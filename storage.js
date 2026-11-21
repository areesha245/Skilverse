// storage.js - the ONLY module that touches localStorage and JSON files (Data Tier)
const KEYS = { users: 'sv_users', session: 'sv_session' };

export function read(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch (error) {
    return fallback; // corrupted data: fall back instead of crashing
  }
}
export function write(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

// ---- users and session ----
export function getUsers() { return read(KEYS.users, []); }
export function saveUsers(users) { write(KEYS.users, users); }
export function getSessionUserId() { return read(KEYS.session, null); }
export function setSessionUserId(id) { write(KEYS.session, id); }
export function clearSession() { localStorage.removeItem(KEYS.session); }

// ---- to be written later ----
export function getDailyUsage(userId) { /* TODO */ }
export function updateUsage(userId) { /* TODO */ }
export function saveSession(session) { /* TODO */ }
export async function loadQuestions(role, level) { /* TODO: fetch('data/questions.json') */ }
