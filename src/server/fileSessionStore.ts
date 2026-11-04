import fs from 'fs';
import path from 'path';
import session from 'express-session';

interface StoredSession {
  session: session.SessionData;
  expires: number | null;
}

/**
 * Store de sesiones en archivos JSON (uno por sesión) dentro de un directorio persistente.
 * Reemplaza al MemoryStore para que los redespliegues no cierren la sesión de nadie.
 */
export class FileSessionStore extends session.Store {
  constructor(private readonly dir: string) {
    super();
    fs.mkdirSync(dir, { recursive: true });
    this.sweep();
    setInterval(() => this.sweep(), 60 * 60 * 1000).unref();
  }

  private file(sid: string): string | null {
    // Los sid de express-session son base64url; cualquier otra cosa se rechaza (evita path traversal).
    return /^[A-Za-z0-9_-]{8,128}$/.test(sid) ? path.join(this.dir, `${sid}.json`) : null;
  }

  private expiryOf(sess: session.SessionData): number | null {
    const e = sess.cookie?.expires;
    if (e) return new Date(e).getTime();
    const maxAge = sess.cookie?.maxAge;
    return typeof maxAge === 'number' ? Date.now() + maxAge : null;
  }

  private sweep() {
    try {
      for (const f of fs.readdirSync(this.dir)) {
        if (!f.endsWith('.json')) continue;
        const full = path.join(this.dir, f);
        try {
          const data = JSON.parse(fs.readFileSync(full, 'utf8')) as StoredSession;
          if (data.expires !== null && data.expires <= Date.now()) fs.unlinkSync(full);
        } catch {
          fs.rmSync(full, { force: true });
        }
      }
    } catch { /* directorio no disponible: se ignora */ }
  }

  get = (sid: string, cb: (err?: any, session?: session.SessionData | null) => void) => {
    const f = this.file(sid);
    if (!f) return cb(null, null);
    try {
      const data = JSON.parse(fs.readFileSync(f, 'utf8')) as StoredSession;
      if (data.expires !== null && data.expires <= Date.now()) {
        fs.rmSync(f, { force: true });
        return cb(null, null);
      }
      cb(null, data.session);
    } catch (e: any) {
      cb(e?.code === 'ENOENT' ? null : null, null);
    }
  };

  set = (sid: string, sess: session.SessionData, cb?: (err?: any) => void) => {
    const f = this.file(sid);
    if (!f) return cb?.(new Error('sid inválido'));
    try {
      const tmp = `${f}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify({ session: sess, expires: this.expiryOf(sess) } satisfies StoredSession), 'utf8');
      fs.renameSync(tmp, f);
      cb?.();
    } catch (e) {
      cb?.(e);
    }
  };

  destroy = (sid: string, cb?: (err?: any) => void) => {
    const f = this.file(sid);
    if (f) fs.rmSync(f, { force: true });
    cb?.();
  };

  touch = (sid: string, sess: session.SessionData, cb?: () => void) => {
    this.set(sid, sess, () => cb?.());
  };
}
