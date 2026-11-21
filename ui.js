// ui.js - DOM rendering and event listeners (no inline JS in HTML)
import { register, login, logout, getCurrentUser } from './auth.js';

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

function initDashboard() {
  const user = getCurrentUser();
  if (!user) { window.location.href = 'login.html'; return; } // not logged in
  document.getElementById('userName').textContent = user.name;
  document.getElementById('userLevel').textContent = user.level;
  document.getElementById('userXp').textContent = user.xp;
  document.getElementById('userStreak').textContent = user.streak;
  document.getElementById('logoutBtn').addEventListener('click', () => {
    logout();
    window.location.href = 'login.html';
  });
}

// Each HTML page sets data-page on <body>; run the matching setup
const pages = { login: initLogin, signup: initSignup, dashboard: initDashboard };
const init = pages[document.body.dataset.page];
if (init) init();
