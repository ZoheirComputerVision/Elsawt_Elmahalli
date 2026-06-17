const crypto = require('crypto');
const db = require('../database');

const TABLE = 'users';
const ROLE_HIERARCHY = { publisher: 3, editor_in_chief: 2, journalist: 1 };
const VALID_STATUSES = ['active', 'suspended', 'archived'];
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEYLEN = 64;
const PBKDF2_DIGEST = 'sha512';
const MIN_PASSWORD_LENGTH = 8;
const INACTIVITY_TTL = 30 * 60 * 1000;
const MAX_TTL = 24 * 60 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000;

function hashPassword(password, salt) {
  const useSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, useSalt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST).toString('hex');
  return { hash, salt: useSalt };
}

function constantTimeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

class SessionStore {
  constructor() {
    this.sessions = new Map();
  }
  set(token, data) {
    this.sessions.set(token, { data, createdAt: Date.now(), lastAccess: Date.now() });
  }
  get(token) {
    const entry = this.sessions.get(token);
    if (!entry) return null;
    if (Date.now() - entry.createdAt > MAX_TTL) { this.sessions.delete(token); return null; }
    if (Date.now() - entry.lastAccess > INACTIVITY_TTL) { this.sessions.delete(token); return null; }
    entry.lastAccess = Date.now();
    return entry.data;
  }
  delete(token) { this.sessions.delete(token); }
  getByUserId(userId) {
    for (const [token, entry] of this.sessions) {
      if (entry.data.userId === userId) return { token, ...entry.data };
    }
    return null;
  }
  invalidateUser(userId) {
    for (const [token, entry] of this.sessions) {
      if (entry.data.userId === userId) this.sessions.delete(token);
    }
  }
}

const sessions = new SessionStore();

class RateLimiter {
  constructor() {
    this.attempts = new Map();
  }
  check(ip) {
    const now = Date.now();
    const record = this.attempts.get(ip);
    if (!record) return { allowed: true };
    if (record.lockedUntil && now < record.lockedUntil) {
      return { allowed: false, remaining: Math.ceil((record.lockedUntil - now) / 1000) };
    }
    if (record.lockedUntil && now >= record.lockedUntil) {
      this.attempts.delete(ip);
      return { allowed: true };
    }
    return { allowed: true };
  }
  recordFailure(ip) {
    const now = Date.now();
    const record = this.attempts.get(ip) || { count: 0, lockedUntil: null };
    record.count = (record.count || 0) + 1;
    if (record.count >= MAX_LOGIN_ATTEMPTS) {
      record.lockedUntil = now + LOCKOUT_DURATION;
    }
    this.attempts.set(ip, record);
  }
  recordSuccess(ip) {
    this.attempts.delete(ip);
  }
}

const rateLimiter = new RateLimiter();

class UserManager {
  createUser({ fullName, username, email, phone, password, role, createdBy }) {
    if (!username || !password || !fullName) throw new Error('اسم المستخدم، كلمة المرور، والاسم الكامل مطلوبون');
    if (password.length < MIN_PASSWORD_LENGTH) throw new Error(`كلمة المرور يجب أن تكون ${MIN_PASSWORD_LENGTH} أحرف على الأقل`);
    if (!['publisher', 'editor_in_chief', 'journalist'].includes(role)) throw new Error('الدور غير صالح');
    const existing = db.findOne(TABLE, u => u.username === username);
    if (existing) throw new Error('اسم المستخدم موجود مسبقاً');
    const { hash, salt } = hashPassword(password);
    const record = db.insert(TABLE, {
      fullName,
      username,
      email: email || null,
      phone: phone || null,
      passwordHash: hash,
      passwordSalt: salt,
      role,
      status: 'active',
      lastLoginAt: null,
      createdBy: createdBy || 'system',
    });
    const { passwordHash, passwordSalt, ...safe } = record;
    return safe;
  }

  updateUser(id, updates) {
    const allowed = ['fullName', 'email', 'phone', 'role', 'status'];
    const clean = {};
    for (const key of allowed) {
      if (updates[key] !== undefined) clean[key] = updates[key];
    }
    if (clean.role && !['publisher', 'editor_in_chief', 'journalist'].includes(clean.role)) {
      throw new Error('الدور غير صالح');
    }
    if (clean.status && !VALID_STATUSES.includes(clean.status)) {
      throw new Error('الحالة غير صالحة');
    }
    const prev = db.get(TABLE, id);
    if (!prev) throw new Error('المستخدم غير موجود');
    const updated = db.update(TABLE, id, clean);
    if (clean.status === 'suspended' || clean.status === 'archived') sessions.invalidateUser(id);
    const { passwordHash, passwordSalt, ...safe } = updated;
    return safe;
  }

  suspendUser(id) { return this.updateUser(id, { status: 'suspended' }); }
  activateUser(id) { return this.updateUser(id, { status: 'active' }); }
  archiveUser(id) { return this.updateUser(id, { status: 'archived' }); }
  restoreUser(id) { return this.updateUser(id, { status: 'active' }); }
  changeRole(id, role) { return this.updateUser(id, { role }); }

  resetPassword(id, newPassword) {
    if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) throw new Error(`كلمة المرور يجب أن تكون ${MIN_PASSWORD_LENGTH} أحرف على الأقل`);
    const prev = db.get(TABLE, id);
    if (!prev) throw new Error('المستخدم غير موجود');
    const { hash, salt } = hashPassword(newPassword);
    const updated = db.update(TABLE, id, { passwordHash: hash, passwordSalt: salt });
    sessions.invalidateUser(id);
    const { passwordHash, passwordSalt, ...safe } = updated;
    return safe;
  }

  listUsers(filters = {}) {
    let items = db.query(TABLE);
    if (filters.role) items = items.filter(u => u.role === filters.role);
    if (filters.status) items = items.filter(u => u.status === filters.status);
    if (filters.search) {
      const s = filters.search.toLowerCase();
      items = items.filter(u =>
        u.fullName.toLowerCase().includes(s) ||
        u.username.toLowerCase().includes(s) ||
        (u.email && u.email.toLowerCase().includes(s))
      );
    }
    items.sort((a, b) => (b.created_at || '').localeCompare((a.created_at || '')));
    const total = items.length;
    const limit = parseInt(filters.limit) || 50;
    const offset = parseInt(filters.offset) || 0;
    items = items.slice(offset, offset + limit);
    return { items: items.map(({ passwordHash, passwordSalt, ...safe }) => safe), total };
  }

  getUser(id) {
    const user = db.get(TABLE, parseInt(id));
    if (!user) return null;
    const { passwordHash, passwordSalt, ...safe } = user;
    return safe;
  }

  getUserByUsername(username) {
    const user = db.findOne(TABLE, u => u.username === username);
    if (!user) return null;
    const { passwordHash, passwordSalt, ...safe } = user;
    return safe;
  }

  validateUser(username, password, ip) {
    const user = db.findOne(TABLE, u => u.username === username && u.status === 'active');
    if (!user) return null;
    const limitCheck = rateLimiter.check(ip || 'unknown');
    if (!limitCheck.allowed) return null;
    const inputHash = hashPassword(password, user.passwordSalt);
    if (!constantTimeCompare(user.passwordHash, inputHash.hash)) {
      rateLimiter.recordFailure(ip || 'unknown');
      return null;
    }
    rateLimiter.recordSuccess(ip || 'unknown');
    const updated = db.update(TABLE, user.id, { lastLoginAt: new Date().toISOString() });
    const { passwordHash, passwordSalt, ...safe } = updated;
    return safe;
  }

  getRateLimitStatus(ip) {
    return rateLimiter.check(ip || 'unknown');
  }

  login(username, password, ip) {
    const user = this.validateUser(username, password, ip);
    if (!user) return null;
    const existing = sessions.getByUserId(user.id);
    if (existing) return { token: existing.token, user };
    const token = generateToken();
    sessions.set(token, { userId: user.id, username: user.username, role: user.role, createdAt: new Date().toISOString() });
    return { token, user };
  }

  logout(token) { sessions.delete(token); }

  authenticate(token) {
    const session = sessions.get(token);
    if (!session) return null;
    const user = db.get(TABLE, session.userId);
    if (!user || user.status !== 'active') {
      sessions.delete(token);
      return null;
    }
    return { id: user.id, username: user.username, fullName: user.fullName, role: user.role };
  }

  isAuthorized(userRole, requiredRole) {
    return (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[requiredRole] || 0);
  }

  get ROLE_HIERARCHY() { return ROLE_HIERARCHY; }
}

// ── Migration: active boolean → status field ──
(function migrate() {
  const items = db.query(TABLE);
  let migrated = 0;
  for (const u of items) {
    if (u.status === undefined || u.status === null) {
      u.status = u.active === false ? 'suspended' : 'active';
      delete u.active;
      migrated++;
    }
  }
  if (migrated > 0) {
    db.saveNow(TABLE);
    console.log(`[Users] تم ترحيل ${migrated} مستخدم (active → status)`);
  }
})();

module.exports = new UserManager();
module.exports.UserManager = UserManager;
module.exports.ROLE_HIERARCHY = ROLE_HIERARCHY;