// auth.js - register, login, logout, current session
import { getUsers, saveUsers, getSessionUserId, setSessionUserId, clearSession } from './storage.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD_LENGTH = 8;

// Returns an error message, or '' when everything is valid
export function validateRegistration(name, email, password, role) {
  if (!name.trim()) return 'Please enter your full name.';
  if (!EMAIL_PATTERN.test(email.trim())) return 'Please enter a valid email address.';
  if (password.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (role !== 'student' && role !== 'teacher') return 'Please choose a role.';
  return '';
}

// SHA-256 hash so the plain password is never stored (prototype-level protection)
async function hashPassword(password) {
  const bytes = new TextEncoder().encode(password);
  const buffer = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function register(name, email, password, role) {
  const error = validateRegistration(name, email, password, role);
  if (error) return { ok: false, error };

  const users = getUsers();
  const cleanEmail = email.trim().toLowerCase();
  if (users.some(u => u.email === cleanEmail)) {
    return { ok: false, error: 'An account with this email already exists.' };
  }
  const user = {
    id: 'u' + Date.now(), name: name.trim(), email: cleanEmail,
    passwordHash: await hashPassword(password), role,
    xp: 0, level: 1, streak: 0, createdAt: new Date().toISOString()
  };
  users.push(user);
  saveUsers(users);
  setSessionUserId(user.id);
  return { ok: true, user };
}

export async function login(email, password) {
  if (!email.trim() || !password) return { ok: false, error: 'Please enter your email and password.' };
  const user = getUsers().find(u => u.email === email.trim().toLowerCase());
  // same message for unknown email and wrong password (does not reveal which one failed)
  if (!user || user.passwordHash !== await hashPassword(password)) {
    return { ok: false, error: 'Incorrect email or password.' };
  }
  setSessionUserId(user.id);
  return { ok: true, user };
}

export function logout() { clearSession(); }

export function getCurrentUser() {
  const id = getSessionUserId();
  return id ? getUsers().find(u => u.id === id) || null : null;
}
