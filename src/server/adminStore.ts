import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Registro de usuarios (con su uso) y reportes de fallas, en archivos JSON dentro del volumen persistente.
 * Es liviano a propósito: durante la beta alcanza con contadores por cuenta.
 */

export type UsageKey = 'transcribeChunks' | 'processes' | 'chats' | 'reports';

export interface UserRecord {
  email: string;
  name: string;
  avatar?: string;
  firstSeen: string;
  lastSeen: string;
  logins: number;
  usage: Record<UsageKey, number>;
  /** Segundos de audio enviados a transcribir (aprox.: cada chunk dura ~5 s). */
  audioSeconds: number;
}

export interface ReportRecord {
  id: string;
  createdAt: string;
  email: string;
  name: string;
  message: string;
  status: 'open' | 'resolved';
  context: Record<string, unknown>;
}

const EMPTY_USAGE: Record<UsageKey, number> = { transcribeChunks: 0, processes: 0, chats: 0, reports: 0 };

export class AdminStore {
  private users: Record<string, UserRecord> = {};
  private reports: ReportRecord[] = [];
  private dirty = false;
  private readonly usersFile: string;
  private readonly reportsFile: string;

  constructor(private readonly dir: string) {
    fs.mkdirSync(dir, { recursive: true });
    this.usersFile = path.join(dir, 'usage.json');
    this.reportsFile = path.join(dir, 'reports.json');
    this.users = this.load(this.usersFile, {});
    this.reports = this.load(this.reportsFile, []);
    setInterval(() => this.flush(), 15_000).unref();
    process.on('SIGTERM', () => this.flush());
  }

  private load<T>(file: string, fallback: T): T {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
    } catch {
      return fallback;
    }
  }

  private write(file: string, data: unknown) {
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, file);
  }

  flush() {
    if (!this.dirty) return;
    try {
      this.write(this.usersFile, this.users);
      this.write(this.reportsFile, this.reports);
      this.dirty = false;
    } catch (e) {
      console.error('[adminStore] no se pudo guardar:', (e as Error).message);
    }
  }

  private ensure(email: string, name?: string, avatar?: string): UserRecord {
    const key = email.toLowerCase();
    const now = new Date().toISOString();
    let u = this.users[key];
    if (!u) {
      u = this.users[key] = {
        email: key, name: name || key, avatar, firstSeen: now, lastSeen: now,
        logins: 0, usage: { ...EMPTY_USAGE }, audioSeconds: 0,
      };
    }
    if (name) u.name = name;
    if (avatar) u.avatar = avatar;
    u.usage = { ...EMPTY_USAGE, ...u.usage };
    return u;
  }

  recordLogin(email: string, name?: string, avatar?: string) {
    const u = this.ensure(email, name, avatar);
    u.logins += 1;
    u.lastSeen = new Date().toISOString();
    this.dirty = true;
  }

  touch(email: string, name?: string, avatar?: string) {
    const u = this.ensure(email, name, avatar);
    u.lastSeen = new Date().toISOString();
    this.dirty = true;
  }

  recordUsage(email: string, key: UsageKey, audioSeconds = 0) {
    const u = this.ensure(email);
    u.usage[key] += 1;
    u.audioSeconds += audioSeconds;
    u.lastSeen = new Date().toISOString();
    this.dirty = true;
  }

  listUsers(): UserRecord[] {
    return Object.values(this.users).sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
  }

  addReport(input: { email: string; name: string; message: string; context: Record<string, unknown> }): ReportRecord {
    const r: ReportRecord = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      email: input.email,
      name: input.name,
      message: input.message,
      status: 'open',
      context: input.context,
    };
    this.reports.unshift(r);
    if (this.reports.length > 1000) this.reports.length = 1000;
    this.recordUsage(input.email, 'reports');
    this.flush();
    return r;
  }

  listReports(): ReportRecord[] {
    return this.reports;
  }

  setReportStatus(id: string, status: 'open' | 'resolved'): boolean {
    const r = this.reports.find((x) => x.id === id);
    if (!r) return false;
    r.status = status;
    this.dirty = true;
    this.flush();
    return true;
  }

  deleteReport(id: string): boolean {
    const i = this.reports.findIndex((x) => x.id === id);
    if (i < 0) return false;
    this.reports.splice(i, 1);
    this.dirty = true;
    this.flush();
    return true;
  }
}
