// tests.js - in-browser test runner: white-box checks of the real Skillverse modules
import { register, login, getCurrentUser, validateRegistration } from './auth.js';
import { saveUsers, setSessionUserId, getUsers, getSessions, saveSession, getShares, getDailyUsage } from './storage.js';
import { levelFromXp, awardXP, unlockNextRoom } from './gamification.js';
import { scoreExplanation, requestFeedback, buildStory, requestStory } from './aiManager.js';
import { validateExplanation } from './teachBack.js';
import { validateStoryInput, generateStory, answerScene } from './storyRealm.js';
import { startRoom, submitAnswer, useHint } from './interviewRoom.js';
import { validateLimit, updateDailyLimit } from './admin.js';
import { sessionPercent, shareProgress, stopSharing, isSharing } from './progress.js';

const NOTES = 'Polymorphism lets objects of different classes respond to the same method call. Inheritance allows a child class to reuse the fields and methods of a parent class. Encapsulation hides internal data behind public methods. Abstraction exposes only the essential features of an object to the outside world. Constructors initialize new objects when they are created in memory.';
const GOOD = 'Photosynthesis happens in the chloroplasts. Chlorophyll captures sunlight, and the plant takes in carbon dioxide and water. For example, a leaf turns them into glucose and oxygen using light energy.';
const WEAK = 'Plants do something with leaves and then they grow bigger every day in the garden.';

// ---- tiny helpers ----
const ok = (condition, message) => { if (!condition) throw new Error(message || 'Assertion failed'); };
const eq = (actual, expected, label) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label || 'Value'}: expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
  }
};
const reset = () => localStorage.clear();
function loginAs() {
  reset();
  saveUsers([{ id: 'u1', name: 'Tester', email: 't@t.com', role: 'student', xp: 0, level: 1, streak: 0 }]);
  setSessionUserId('u1');
}
const loadRubrics = async () => (await (await fetch('data/rubrics.json')).json()).concepts[0];
const tenWords = 'one two three four five six seven eight nine ten';

// ---- the tests: [id, technique, description, function] ----
const TESTS = [
  ['WB-01', 'Branch', 'validateRegistration: empty name is rejected', () => ok(validateRegistration('  ', 'a@b.co', 'password1', 'student') !== '')],
  ['WB-02', 'Branch', 'validateRegistration: invalid email is rejected', () => ok(validateRegistration('A', 'abc', 'password1', 'student') !== '')],
  ['WB-03', 'Boundary', 'validateRegistration: 7-character password is rejected', () => ok(validateRegistration('A', 'a@b.co', '1234567', 'student') !== '')],
  ['WB-04', 'Boundary', 'validateRegistration: 8-character password is accepted', () => eq(validateRegistration('A', 'a@b.co', '12345678', 'student'), '')],
  ['WB-05', 'Branch', 'validateRegistration: unknown role is rejected', () => ok(validateRegistration('A', 'a@b.co', 'password1', 'hacker') !== '')],
  ['WB-06', 'Statement', 'register: stores a SHA-256 hash, not the plain password', async () => {
    reset();
    const r = await register('Areesha', 'a@b.com', 'password1', 'student');
    ok(r.ok, 'registration failed');
    ok(r.user.passwordHash !== 'password1' && r.user.passwordHash.length === 64, 'password is not hashed');
    eq(getCurrentUser().id, r.user.id, 'session user');
  }],
  ['WB-07', 'Branch', 'register: duplicate email (any letter case) is blocked', async () => {
    reset();
    await register('A', 'a@b.com', 'password1', 'student');
    const again = await register('B', 'A@B.COM', 'password1', 'student');
    ok(!again.ok && /already exists/.test(again.error), 'duplicate was accepted');
  }],
  ['WB-08', 'Branch', 'login: empty email or password is rejected', async () => {
    reset();
    ok(!(await login('', 'x')).ok && !(await login('a@b.com', '')).ok);
  }],
  ['WB-09', 'Condition', 'login: unknown email and wrong password give the same message', async () => {
    reset();
    await register('A', 'a@b.com', 'password1', 'student');
    const unknown = await login('nobody@b.com', 'password1');
    const wrong = await login('a@b.com', 'wrongpass1');
    ok(!unknown.ok && !wrong.ok);
    eq(unknown.error, wrong.error, 'messages');
  }],
  ['WB-10', 'Path', 'login: correct details start a session', async () => {
    reset();
    await register('A', 'a@b.com', 'password1', 'student');
    const r = await login(' A@B.com ', 'password1');
    ok(r.ok, 'login failed');
    eq(getCurrentUser().email, 'a@b.com', 'logged in email');
  }],
  ['WB-11', 'Boundary', 'levelFromXp: 0 and 199 XP are level 1, 200 XP is level 2, negative XP is level 1', () => {
    eq([levelFromXp(0), levelFromXp(199), levelFromXp(200), levelFromXp(-50)], [1, 1, 2, 1]);
  }],
  ['WB-12', 'Condition', 'awardXP: unknown user, 0, negative and decimal points are rejected', () => {
    loginAs();
    ok(!awardXP('nope', 10).ok, 'unknown user');
    ok(!awardXP('u1', 0).ok && !awardXP('u1', -5).ok && !awardXP('u1', 2.5).ok, 'invalid points');
    eq(getUsers()[0].xp, 0, 'xp unchanged');
  }],
  ['WB-13', 'Path', 'awardXP: 200 XP gives level 2, level-up flag and First Steps badge', () => {
    loginAs();
    const r = awardXP('u1', 200);
    eq([r.user.xp, r.user.level, r.leveledUp, r.newBadges.map(b => b.id)], [200, 2, true, ['first_steps']]);
  }],
  ['WB-14', 'Branch', 'awardXP: a badge is awarded only once', () => {
    loginAs();
    awardXP('u1', 10);
    eq(awardXP('u1', 10).newBadges.length, 0, 'second award badges');
  }],
  ['WB-15', 'Branch', 'unlockNextRoom: clearing the same room twice counts once', () => {
    loginAs();
    unlockNextRoom('u1', 'software-intern', 'hr');
    unlockNextRoom('u1', 'software-intern', 'hr');
    eq(getUsers()[0].stats.roomsCleared, 1, 'roomsCleared');
  }],
  ['WB-16', 'Boundary', 'validateExplanation: empty, 9 words, 10 words, 2000 and 2001 characters', () => {
    const at = n => `${Array(9).fill('x').join(' ')} ${'y'.repeat(n - 18)}`; // exactly n characters
    ok(validateExplanation('') !== '', 'empty');
    ok(validateExplanation('one two three four five six seven eight nine') !== '', '9 words');
    eq(validateExplanation(tenWords), '', '10 words');
    eq(validateExplanation(at(2000)), '', '2000 characters');
    ok(validateExplanation(at(2001)) !== '', '2001 characters');
  }],
  ['WB-17', 'Loop', 'scoreExplanation: loop over key points with none, some and many matched', async () => {
    const concept = await loadRubrics();
    const weak = scoreExplanation(concept, WEAK);
    const strong = scoreExplanation(concept, GOOD);
    eq(weak.gaps.length, 4, 'weak gaps');
    eq(strong.gaps.length, 0, 'strong gaps');
    ok(strong.score > weak.score, 'strong should beat weak');
    eq([weak.followUps.length, strong.followUps.length], [3, 3], 'follow-up count');
    eq(weak.followUps[0], concept.keyPoints[0].followUp, 'missing points come first');
  }],
  ['WB-18', 'Boundary', 'requestFeedback: request number 3 is blocked when the limit is 2', async () => {
    loginAs();
    ok(updateDailyLimit(2).ok);
    const concept = await loadRubrics();
    eq([1, 2, 3].map(() => requestFeedback('u1', concept, GOOD).ok), [true, true, false], 'results');
    eq(getDailyUsage('u1'), 2, 'usage count');
  }],
  ['WB-19', 'Boundary', 'validateLimit: 0 and 101 rejected; 1 and 100 accepted; 2.5 and NaN rejected', () => {
    eq([0, 1, 100, 101, 2.5, NaN].map(v => validateLimit(v) === ''), [false, true, true, false, false, false]);
  }],
  ['WB-20', 'Branch', 'startRoom: refuses when nobody is logged in', async () => {
    reset();
    const r = await startRoom('software-intern', 'medium');
    ok(!r.ok && r.error === 'Please log in again.');
  }],
  ['WB-21', 'Boundary', 'Interview: average exactly 6 passes Medium, clears the room and gives 40 XP', async () => {
    loginAs();
    await startRoom('software-intern', 'medium');
    submitAnswer('student learn project'); submitAnswer('strength weakness improve');
    const r = submitAnswer('grow goal learn');
    eq([r.result.passed, r.result.average, r.result.xpEarned], [true, 6, 40], 'result');
    eq(getUsers()[0].clearedRooms, { 'software-intern': ['hr'] }, 'cleared rooms');
  }],
  ['WB-22', 'Boundary', 'Interview: the same average 6 fails Hard (pass mark 7) with no XP', async () => {
    loginAs();
    await startRoom('software-intern', 'hard');
    submitAnswer('student learn project'); submitAnswer('strength weakness improve');
    const r = submitAnswer('grow goal learn');
    eq([r.result.passed, r.result.xpEarned], [false, 0], 'result');
    eq(getUsers()[0].xp, 0, 'xp');
  }],
  ['WB-23', 'Path', 'Interview: empty answer is rejected and a hint costs exactly 1 point', async () => {
    loginAs();
    await startRoom('software-intern', 'easy');
    ok(!submitAnswer('   ').ok, 'empty answer');
    ok(useHint().length > 0, 'hint text');
    eq(submitAnswer('student learn project').feedback.score, 5, 'score with hint');
    eq(submitAnswer('strength weakness improve').feedback.score, 6, 'score without hint');
  }],
  ['WB-24', 'Boundary', 'validateStoryInput: 29 words rejected, 30 words accepted, empty topic rejected', () => {
    ok(validateStoryInput('OOP', 'word '.repeat(29)) !== '', '29 words');
    eq(validateStoryInput('OOP', 'word '.repeat(30)), '', '30 words');
    ok(validateStoryInput(' ', NOTES) !== '', 'empty topic');
  }],
  ['WB-25', 'Branch', 'requestStory: notes without enough detail fail and use no AI request', () => {
    loginAs();
    const r = requestStory('u1', 'OOP', 'word '.repeat(40));
    ok(!r.ok, 'should fail');
    eq(getDailyUsage('u1'), 0, 'usage');
  }],
  ['WB-26', 'Loop', 'buildStory: 5 scenes, 4 options each, correct answer is among the options', () => {
    const story = buildStory('OOP', NOTES);
    ok(story.ok);
    eq(story.scenes.length, 5, 'scenes');
    story.scenes.forEach(s => {
      eq(s.options.length, 4, 'options');
      eq(s.options[s.answerIndex], s.term, 'answer position');
    });
  }],
  ['WB-27', 'Path', 'Story: all correct gives 5/5 and 50 XP', () => {
    loginAs();
    const start = generateStory('OOP', NOTES);
    ok(start.ok, 'story did not start');
    let res = null;
    for (let i = 0; i < start.total; i++) res = answerScene((i === 0 ? start.scene : res.next.scene).answerIndex);
    eq([res.finished, res.summary.score, res.summary.xpEarned], [true, 5, 50], 'summary');
  }],
  ['WB-28', 'Path', 'Story: all wrong gives 0/5, 10 XP, 5 weak topics, and rejects an empty choice', () => {
    loginAs();
    const start = generateStory('OOP', NOTES);
    ok(!answerScene(null).ok, 'null choice');
    let res = null;
    for (let i = 0; i < start.total; i++) {
      const scene = i === 0 ? start.scene : res.next.scene;
      res = answerScene((scene.answerIndex + 1) % 4);
    }
    eq([res.summary.score, res.summary.xpEarned, res.summary.weak.length], [0, 10, 5], 'summary');
    eq(getSessions('u1')[0].weakTopics.length, 5, 'saved weak topics');
  }],
  ['WB-29', 'Branch', 'sessionPercent: every zone branch plus unknown zone and 0/0', () => {
    eq([
      sessionPercent({ zone: 'teachBack', score: 82 }), sessionPercent({ zone: 'interview', score: 7.5 }),
      sessionPercent({ zone: 'story', result: '3/5' }), sessionPercent({ zone: 'story', result: '0/0' }),
      sessionPercent({ zone: 'other', score: 1 })
    ], [82, 75, 60, null, null]);
  }],
  ['WB-30', 'Path', 'shareProgress: no sessions is refused; sharing twice keeps one summary; stop removes it', () => {
    loginAs();
    ok(!shareProgress({ id: 'u1', name: 'T' }).ok, 'no sessions');
    saveSession({ userId: 'u1', zone: 'story', score: 3, result: '3/5', title: 'x', date: 'd' });
    ok(shareProgress({ id: 'u1', name: 'T' }).ok); shareProgress({ id: 'u1', name: 'T' });
    eq(getShares().length, 1, 'summaries');
    stopSharing('u1');
    ok(!isSharing('u1'), 'still sharing');
  }]
];

// ---- runner: your real data is backed up first and restored afterwards ----
function snapshot() {
  const saved = {};
  for (let i = 0; i < localStorage.length; i++) { const key = localStorage.key(i); saved[key] = localStorage.getItem(key); }
  return saved;
}
function restore(saved) {
  localStorage.clear();
  Object.entries(saved).forEach(([key, value]) => localStorage.setItem(key, value));
}

export async function runAll() {
  const saved = snapshot();
  const results = [];
  try {
    for (const [id, technique, name, fn] of TESTS) {
      reset();
      try { await fn(); results.push({ id, technique, name, pass: true }); }
      catch (error) { results.push({ id, technique, name, pass: false, error: error.message }); }
    }
  } finally { restore(saved); }
  return results;
}

function render(results) {
  const passed = results.filter(r => r.pass).length;
  document.getElementById('summary').textContent = `${passed} / ${results.length} tests passed`;
  const list = document.getElementById('results');
  list.replaceChildren();
  results.forEach(r => {
    const row = document.createElement('div');
    row.className = 'test-row';
    const cells = [r.id, r.technique, r.name, r.pass ? 'PASS' : `FAIL: ${r.error}`];
    cells.forEach((text, index) => {
      const cell = document.createElement('span');
      cell.textContent = text;
      if (index === 3) cell.className = r.pass ? 'test-pass' : 'test-fail';
      row.append(cell);
    });
    list.append(row);
  });
}

async function main() {
  const button = document.getElementById('runBtn');
  button.disabled = true;
  document.getElementById('summary').textContent = 'Running tests...';
  render(await runAll());
  button.disabled = false;
}

if (typeof document !== 'undefined') {
  document.getElementById('runBtn').addEventListener('click', main);
  main();
}
