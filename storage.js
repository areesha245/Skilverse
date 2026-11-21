// storage.js - the ONLY module that touches localStorage and JSON files (Data Tier)
const KEYS = { users: 'sv_users', session: 'sv_session', usage: 'sv_usage', sessions: 'sv_sessions', reports: 'sv_reports' };

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
export function getUserById(id) { return getUsers().find(u => u.id === id) || null; }
export function updateUser(id, changes) {
  const users = getUsers();
  const index = users.findIndex(u => u.id === id);
  if (index === -1) return null;
  users[index] = { ...users[index], ...changes };
  saveUsers(users);
  return users[index];
}
export function getSessionUserId() { return read(KEYS.session, null); }
export function setSessionUserId(id) { write(KEYS.session, id); }
export function clearSession() { localStorage.removeItem(KEYS.session); }

// ---- daily AI usage (resets every day) ----
const today = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD, local time
export function getDailyUsage(userId) {
  const entry = read(KEYS.usage, {})[userId];
  return entry && entry.date === today() ? entry.count : 0;
}
export function updateUsage(userId) {
  const all = read(KEYS.usage, {});
  all[userId] = { date: today(), count: getDailyUsage(userId) + 1 };
  write(KEYS.usage, all);
  return all[userId].count;
}

// ---- learning sessions (history) ----
export function saveSession(session) {
  const all = read(KEYS.sessions, []);
  all.push(session);
  write(KEYS.sessions, all);
}
export function getSessions(userId) { return read(KEYS.sessions, []).filter(s => s.userId === userId); }

// ---- AI answer reports (sent to the admin) ----
export function saveReport(report) {
  const all = read(KEYS.reports, []);
  all.push(report);
  write(KEYS.reports, all);
}

// ---- JSON data files ----
export async function loadRubrics() {
  const response = await fetch('data/rubrics.json');
  if (!response.ok) throw new Error('Could not load rubrics');
  return response.json();
}

// Interview questions are loaded once and kept in memory
let questionData = null;
async function loadQuestionData() {
  if (questionData) return questionData;
  const response = await fetch('data/questions.json');
  if (!response.ok) throw new Error('Could not load questions');
  questionData = await response.json();
  return questionData;
}
export async function loadRoles() { return (await loadQuestionData()).roles; }
export async function loadQuestions(roleId) {
  return (await loadRoles()).find(role => role.id === roleId) || null;
}
