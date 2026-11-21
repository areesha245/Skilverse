// ui.js - DOM rendering and event listeners (no inline JS in HTML)
import { register, login, logout, getCurrentUser } from './auth.js';
import { getDailyUsage, getSessions } from './storage.js';
import { DAILY_LIMIT } from './aiManager.js';
import { BADGES, XP_PER_LEVEL, levelFromXp, xpProgress, getProfile } from './gamification.js';

export function showMessage(text) {
  const box = document.getElementById('formError');
  if (!box) return;
  box.textContent = text;
  box.hidden = text === '';
}

function initLogin() {
  if (getCurrentUser()) { window.location.href = 'dashboard.html'; return; }
  const form = document.getElementById('loginForm');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const result = await login(form.elements.email.value, form.elements.password.value);
    if (result.ok) window.location.href = 'dashboard.html';
    else showMessage(result.error);
  });
}

function initSignup() {
  const form = document.getElementById('signupForm');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const e = form.elements;
    const result = await register(e.name.value, e.email.value, e.password.value, e.role.value);
    if (result.ok) window.location.href = 'dashboard.html';
    else showMessage(result.error);
  });
}

function setText(id, value) { document.getElementById(id).textContent = value; }

// One circle per badge; earned badges are highlighted
function renderBadges(user) {
  const list = document.getElementById('badgeList');
  list.replaceChildren();
  BADGES.forEach(badge => {
    const item = document.createElement('div');
    item.className = 'badge' + (user.badges.includes(badge.id) ? ' badge-earned' : '');
    item.title = badge.description;
    const icon = document.createElement('span');
    icon.className = 'badge-icon';
    const name = document.createElement('span');
    name.textContent = badge.name;
    item.append(icon, name);
    list.append(item);
  });
}

// Shows the 3 newest sessions, or a friendly message when there are none
function renderSessions(userId) {
  const list = document.getElementById('sessionList');
  list.replaceChildren();
  const sessions = getSessions(userId).slice(-3).reverse();
  if (sessions.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'No sessions yet. Start a zone to begin!';
    list.append(empty);
    return;
  }
  sessions.forEach(session => {
    const row = document.createElement('div');
    row.className = 'session-row';
    [session.title, session.result, session.date].forEach(value => {
      const cell = document.createElement('span');
      cell.textContent = value;
      row.append(cell);
    });
    list.append(row);
  });
}

function initDashboard() {
  const found = getCurrentUser();
  if (!found) { window.location.href = 'login.html'; return; } // not logged in
  const user = getProfile(found);
  const progress = xpProgress(user.xp);

  setText('userName', user.name);
  setText('userLevel', levelFromXp(user.xp));
  setText('userXp', user.xp);
  setText('userStreak', user.streak);
  setText('xpText', `${progress.into} / ${XP_PER_LEVEL} XP to next level`);
  const bar = document.getElementById('xpBar');
  bar.max = XP_PER_LEVEL;
  bar.value = progress.into;
  setText('aiLeft', `AI requests left: ${Math.max(0, DAILY_LIMIT - getDailyUsage(user.id))}/${DAILY_LIMIT}`);

  renderBadges(user);
  renderSessions(user.id);
  document.getElementById('logoutBtn').addEventListener('click', () => {
    logout();
    window.location.href = 'login.html';
  });
}

// Each HTML page sets data-page on <body>; run the matching setup
const pages = { login: initLogin, signup: initSignup, dashboard: initDashboard };
const init = pages[document.body.dataset.page];
if (init) init();
