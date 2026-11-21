// ui.js - DOM rendering and event listeners (no inline JS in HTML)
import { register, login, logout, getCurrentUser } from './auth.js';
import { getDailyUsage, getSessions, loadRubrics, loadRoles, saveReport } from './storage.js';
import { submitExplanation } from './teachBack.js';
import { generateStory, answerScene } from './storyRealm.js';
import { getHistory, averagePercent, weakTopicCounts, sessionPercent, isSharing, shareProgress, stopSharing, getSharedSummaries } from './progress.js';
import { startRoom, submitAnswer, useHint, THRESHOLDS } from './interviewRoom.js';
import { DAILY_LIMIT } from './aiManager.js';
import { BADGES, XP_PER_LEVEL, levelFromXp, xpProgress, getProfile, getClearedRooms } from './gamification.js';

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

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value; // some pages do not have every element
}

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
  if (found.role === 'teacher') { window.location.href = 'shared-progress.html'; return; }
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

  initShell(user);
  renderBadges(user);
  renderSessions(user.id);
}

// Shared by every logged-in page: AI requests pill and Log out button
function refreshAiLeft(user) {
  setText('aiLeft', `AI requests left: ${Math.max(0, DAILY_LIMIT - getDailyUsage(user.id))}/${DAILY_LIMIT}`);
}
function initShell(user) {
  refreshAiLeft(user);
  document.getElementById('logoutBtn').addEventListener('click', () => {
    logout();
    window.location.href = 'login.html';
  });
}

function renderList(id, items) {
  const list = document.getElementById(id);
  list.replaceChildren();
  items.forEach(text => {
    const li = document.createElement('li');
    li.textContent = text;
    list.append(li);
  });
}

function renderTeachBackResult(result) {
  setText('scoreValue', `${result.score}%`);
  document.getElementById('scoreBar').value = result.score;
  renderList('gapList', result.gaps.length ? result.gaps : ['None, great explanation!']);
  renderList('followUpList', result.followUps);
  document.getElementById('followUps').hidden = false;
  let reward = `+${result.xpEarned} XP`;
  if (result.leveledUp) reward += ' - Level up!';
  if (result.newBadges.length) reward += ` - New badge: ${result.newBadges.map(b => b.name).join(', ')}`;
  setText('rewardText', reward);
}

async function initTeachBack() {
  const user = getCurrentUser();
  if (!user) { window.location.href = 'login.html'; return; }
  initShell(user);

  let concepts;
  try { concepts = (await loadRubrics()).concepts; }
  catch (error) { showMessage('Could not load concepts. Please refresh the page.'); return; }

  const form = document.getElementById('teachForm');
  const reportBtn = document.getElementById('reportBtn');
  concepts.forEach((concept, index) => {
    const label = document.createElement('label');
    label.className = 'chip';
    const input = document.createElement('input');
    input.type = 'radio'; input.name = 'concept'; input.value = concept.id; input.checked = index === 0;
    const span = document.createElement('span');
    span.textContent = concept.name;
    label.append(input, span);
    document.getElementById('conceptList').append(label);
  });

  let last = null; // the latest concept and result, used by "Report AI answer"
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    showMessage('');
    const concept = concepts.find(c => c.id === form.elements.concept.value);
    const result = submitExplanation(concept, form.elements.explanation.value);
    refreshAiLeft(user);
    if (!result.ok) { showMessage(result.error); return; }
    renderTeachBackResult(result);
    last = { concept, result };
    reportBtn.disabled = false;
  });
  reportBtn.addEventListener('click', () => {
    saveReport({ userId: user.id, concept: last.concept.id, score: last.result.score, date: new Date().toISOString() });
    setText('rewardText', 'Thanks! This answer was reported for review.');
    reportBtn.disabled = true;
  });
}

// ---------- Interview Escape Room ----------
function addChip(containerId, group, value, text, checked) {
  const label = document.createElement('label');
  label.className = 'chip';
  const input = document.createElement('input');
  input.type = 'radio'; input.name = group; input.value = value; input.checked = checked;
  const span = document.createElement('span');
  span.textContent = text;
  label.append(input, span);
  document.getElementById(containerId).append(label);
}

// One card per room: Cleared, Next (can be started) or Locked
function renderRooms(role) {
  const cleared = getClearedRooms(getCurrentUser(), role.id);
  const grid = document.getElementById('roomGrid');
  grid.replaceChildren();
  let nextFound = false;
  role.rooms.forEach(room => {
    let status = 'Locked';
    if (cleared.includes(room.id)) status = 'Cleared';
    else if (!nextFound) { status = 'Next'; nextFound = true; }
    const card = document.createElement('div');
    card.className = `card room-card room-${status.toLowerCase()}`;
    const name = document.createElement('strong');
    name.textContent = room.name;
    const label = document.createElement('span');
    label.textContent = status;
    card.append(name, label);
    grid.append(card);
  });
}

function showQuestion(info) {
  document.getElementById('questionCard').hidden = false;
  setText('questionCount', `${info.room.name} - Question ${info.number} of ${info.total}`);
  setText('questionText', info.question.text);
  const hint = document.getElementById('hintText');
  hint.hidden = true;
  hint.textContent = '';
  document.getElementById('answerForm').reset();
}

function showFeedback(feedback) {
  document.getElementById('feedbackCard').hidden = false;
  setText('feedbackScore', `Your last answer: ${feedback.score}/10`);
  renderList('feedbackTips', feedback.tips.length ? feedback.tips : ['Great answer!']);
}

function showRoomResult(result) {
  document.getElementById('questionCard').hidden = true;
  document.getElementById('resultCard').hidden = false;
  setText('resultTitle', result.passed ? `${result.roomName} cleared!` : 'Not yet - try this room again');
  setText('resultText', `Average score ${result.average}/10 (pass mark ${result.threshold})`);
  document.getElementById('resultBar').value = result.average;
  let reward = result.passed ? `+${result.xpEarned} XP. The next room is unlocked.` : 'Read the tips above and try again.';
  if (result.leveledUp) reward += ' Level up!';
  if (result.newBadges.length) reward += ` New badge: ${result.newBadges.map(b => b.name).join(', ')}`;
  setText('resultReward', reward);
}

async function initInterview() {
  const user = getCurrentUser();
  if (!user) { window.location.href = 'login.html'; return; }
  initShell(user);

  let roles;
  try { roles = await loadRoles(); }
  catch (error) { showMessage('Could not load interview questions. Please refresh the page.'); return; }

  roles.forEach((role, index) => addChip('roleList', 'role', role.id, role.name, index === 0));
  Object.keys(THRESHOLDS).forEach(level =>
    addChip('difficultyList', 'difficulty', level, `${level[0].toUpperCase()}${level.slice(1)} (pass ${THRESHOLDS[level]}/10)`, level === 'medium'));

  const form = document.getElementById('interviewForm');
  const answerForm = document.getElementById('answerForm');
  const selectedRole = () => roles.find(role => role.id === form.elements.role.value);
  renderRooms(selectedRole());
  form.elements.role.forEach(radio => radio.addEventListener('change', () => renderRooms(selectedRole())));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    showMessage('');
    document.getElementById('resultCard').hidden = true;
    document.getElementById('feedbackCard').hidden = true;
    const result = await startRoom(selectedRole().id, form.elements.difficulty.value);
    if (!result.ok) { showMessage(result.error); return; }
    showQuestion(result);
  });

  answerForm.addEventListener('submit', (event) => {
    event.preventDefault();
    showMessage('');
    const result = submitAnswer(answerForm.elements.answer.value);
    if (!result.ok) { showMessage(result.error); return; }
    showFeedback(result.feedback);
    if (result.finished) { showRoomResult(result.result); renderRooms(selectedRole()); }
    else showQuestion(result);
  });

  document.getElementById('hintBtn').addEventListener('click', () => {
    const hint = document.getElementById('hintText');
    hint.textContent = `Hint: ${useHint()}`;
    hint.hidden = false;
  });
}

// ---------- Story Realm ----------
function showScene(info) {
  document.getElementById('sceneCard').hidden = false;
  document.getElementById('sceneFeedback').hidden = true;
  document.getElementById('answerBtn').disabled = false;
  setText('sceneCount', `Scene ${info.number} of ${info.total}`);
  setText('sceneNarrative', info.scene.narrative);
  setText('sceneQuestion', info.scene.question);
  const list = document.getElementById('optionList');
  list.replaceChildren();
  info.scene.options.forEach((option, index) => {
    const label = document.createElement('label');
    label.className = 'option';
    const input = document.createElement('input');
    input.type = 'radio'; input.name = 'choice'; input.value = index;
    const span = document.createElement('span');
    span.textContent = option;
    label.append(input, span);
    list.append(label);
  });
}

function showSummary(summary) {
  document.getElementById('sceneCard').hidden = true;
  document.getElementById('summaryCard').hidden = false;
  setText('summaryTitle', 'Story complete!');
  setText('summaryText', `You answered ${summary.score} of ${summary.total} scenes correctly.`);
  renderList('weakList', summary.weak.length ? summary.weak : ['No weak topics. Great job!']);
  let reward = `+${summary.xpEarned} XP`;
  if (summary.leveledUp) reward += ' - Level up!';
  if (summary.newBadges.length) reward += ` - New badge: ${summary.newBadges.map(b => b.name).join(', ')}`;
  setText('summaryReward', reward);
}

function initStory() {
  const user = getCurrentUser();
  if (!user) { window.location.href = 'login.html'; return; }
  initShell(user);

  const storyForm = document.getElementById('storyForm');
  const sceneForm = document.getElementById('sceneForm');
  let pending = null; // what the Continue button shows next: the next scene or the summary

  storyForm.addEventListener('submit', (event) => {
    event.preventDefault();
    showMessage('');
    const result = generateStory(storyForm.elements.topic.value, storyForm.elements.notes.value);
    refreshAiLeft(user);
    if (!result.ok) { showMessage(result.error); return; }
    document.getElementById('summaryCard').hidden = true;
    showScene(result);
  });

  sceneForm.addEventListener('submit', (event) => {
    event.preventDefault();
    showMessage('');
    const raw = sceneForm.elements.choice.value; // '' when nothing is selected
    const result = answerScene(raw === '' ? null : Number(raw));
    if (!result.ok) { showMessage(result.error); return; }
    const { feedback } = result;
    setText('feedbackTitle', feedback.correct ? 'Correct! The scroll glows.' : `Recovery scene: the missing word was "${feedback.answer}"`);
    setText('feedbackText', feedback.correct ? feedback.explanation : `The scroll reveals: "${feedback.explanation}"`);
    document.getElementById('answerBtn').disabled = true;
    document.getElementById('sceneFeedback').hidden = false;
    setText('continueBtn', result.finished ? 'See results' : 'Continue');
    pending = result.finished ? { summary: result.summary } : { next: result.next };
  });

  document.getElementById('continueBtn').addEventListener('click', () => {
    if (pending.summary) showSummary(pending.summary);
    else showScene(pending.next);
  });
}

// ---------- Progress and Share Progress ----------
const ZONE_NAMES = { story: 'Story Realm', teachBack: 'Teach-Back', interview: 'Interview Room' };

function makeRow(className, values) {
  const row = document.createElement('div');
  row.className = className;
  values.forEach(value => {
    const cell = document.createElement('span');
    cell.textContent = value;
    row.append(cell);
  });
  return row;
}

// Line chart drawn with SVG (last 10 sessions, oldest to newest)
function renderTrend(sessions) {
  const holder = document.getElementById('trendChart');
  holder.replaceChildren();
  const values = sessions.map(sessionPercent).filter(v => v !== null).slice(-10);
  if (values.length < 2) {
    const note = document.createElement('p');
    note.className = 'muted';
    note.textContent = 'Complete at least 2 sessions to see your trend.';
    holder.append(note);
    return;
  }
  const ns = 'http://www.w3.org/2000/svg';
  const width = 600, height = 220, pad = 24;
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('class', 'chart');
  [0, 50, 100].forEach(level => {
    const y = height - pad - (level / 100) * (height - 2 * pad);
    const grid = document.createElementNS(ns, 'line');
    grid.setAttribute('x1', pad); grid.setAttribute('x2', width - pad);
    grid.setAttribute('y1', y); grid.setAttribute('y2', y);
    grid.setAttribute('class', 'chart-grid');
    svg.append(grid);
  });
  const points = values.map((value, i) => [
    pad + i * (width - 2 * pad) / (values.length - 1),
    height - pad - (value / 100) * (height - 2 * pad)
  ]);
  const line = document.createElementNS(ns, 'polyline');
  line.setAttribute('points', points.map(p => p.join(',')).join(' '));
  line.setAttribute('class', 'chart-line');
  svg.append(line);
  points.forEach(([x, y]) => {
    const dot = document.createElementNS(ns, 'circle');
    dot.setAttribute('cx', x); dot.setAttribute('cy', y); dot.setAttribute('r', 5);
    dot.setAttribute('class', 'chart-dot');
    svg.append(dot);
  });
  holder.append(svg);
}

function renderHistory(userId, zone) {
  const list = document.getElementById('historyList');
  list.replaceChildren();
  const sessions = getHistory(userId, zone);
  if (sessions.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'No sessions to show yet.';
    list.append(empty);
    return;
  }
  list.append(makeRow('history-row history-head', ['Zone', 'Topic', 'Result', 'Date']));
  sessions.forEach(s => list.append(makeRow('history-row', [ZONE_NAMES[s.zone] || s.zone, s.title, s.result, s.date])));
}

function refreshShareState(user) {
  const sharing = isSharing(user.id);
  setText('shareStatus', sharing ? 'Your summary is currently shared with teachers.' : 'You are not sharing your progress.');
  document.getElementById('shareBtn').textContent = sharing ? 'Update shared summary' : 'Share summary';
  document.getElementById('stopShareBtn').hidden = !sharing;
}

function initProgress() {
  const found = getCurrentUser();
  if (!found) { window.location.href = 'login.html'; return; }
  if (found.role === 'teacher') { window.location.href = 'shared-progress.html'; return; }
  initShell(found);

  const all = getHistory(found.id).reverse(); // oldest first, used for stats and chart
  const average = averagePercent(all);
  const weak = weakTopicCounts(all);
  setText('statSessions', all.length);
  setText('statAverage', average === null ? '--' : `${average}%`);
  setText('statWeak', weak.length);
  renderTrend(all);
  renderList('weakList', weak.length ? weak.map(w => `${w.topic} (missed ${w.count}x)`) : ['No weak topics yet.']);

  const filter = document.getElementById('zoneFilter');
  renderHistory(found.id, 'all');
  filter.addEventListener('change', () => renderHistory(found.id, filter.value));

  const error = document.getElementById('shareError');
  refreshShareState(found);
  document.getElementById('shareBtn').addEventListener('click', () => {
    const result = shareProgress(found);
    error.hidden = result.ok;
    error.textContent = result.ok ? '' : result.error;
    refreshShareState(found);
  });
  document.getElementById('stopShareBtn').addEventListener('click', () => {
    stopSharing(found.id);
    refreshShareState(found);
  });
}

function initShared() {
  const found = getCurrentUser();
  if (!found) { window.location.href = 'login.html'; return; }
  if (found.role !== 'teacher') { window.location.href = 'dashboard.html'; return; } // students cannot open this page
  initShell(found);

  const list = document.getElementById('shareList');
  const shares = getSharedSummaries();
  if (shares.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'No student has shared progress yet.';
    list.append(empty);
    return;
  }
  list.append(makeRow('share-row history-head', ['Student', 'Weak topics', 'Average', 'Sessions', 'Shared on']));
  shares.forEach(s => list.append(makeRow('share-row', [
    s.name, s.weakTopics.length ? s.weakTopics.join(', ') : 'None',
    s.average === null ? '--' : `${s.average}%`, s.sessions, s.date
  ])));
}

// Each HTML page sets data-page on <body>; run the matching setup
const pages = { login: initLogin, signup: initSignup, dashboard: initDashboard, teachback: initTeachBack, interview: initInterview, story: initStory, progress: initProgress, shared: initShared };
const init = pages[document.body.dataset.page];
if (init) init();
