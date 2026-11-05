import React, { useCallback, useEffect, useState } from 'react';
import { Users, Bug, RefreshCw, Check, Undo2, Trash2, Mic, FileText, MessageSquare } from 'lucide-react';

interface UserRow {
  email: string; name: string; avatar?: string; firstSeen: string; lastSeen: string; logins: number;
  audioSeconds: number; usage: { transcribeChunks: number; processes: number; chats: number; reports: number };
}
interface ReportRow {
  id: string; createdAt: string; email: string; name: string; message: string; status: 'open' | 'resolved';
  context: { tab?: string; asrProvider?: string; lastError?: string; url?: string; userAgent?: string };
}

const fmtDate = (iso: string) => new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
const fmtAudio = (s: number) => (s >= 3600 ? `${(s / 3600).toFixed(1)} h` : `${Math.round(s / 60)} min`);

export default function AdminPanel() {
  const [view, setView] = useState<'users' | 'reports'>('users');
  const [users, setUsers] = useState<UserRow[]>([]);
  const [totals, setTotals] = useState<{ chunks: number; processes: number; chats: number; audioSeconds: number } | null>(null);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [showResolved, setShowResolved] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [u, r] = await Promise.all([fetch('/api/admin/users'), fetch('/api/admin/reports')]);
      if (!u.ok || !r.ok) throw new Error('No tenés permiso o la sesión expiró.');
      const ud = await u.json();
      setUsers(ud.users);
      setTotals(ud.totals);
      setReports((await r.json()).reports);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (id: string, status: 'open' | 'resolved') => {
    await fetch(`/api/admin/reports/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    setReports((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
  };
  const remove = async (id: string) => {
    if (!window.confirm('¿Borrar este reporte?')) return;
    await fetch(`/api/admin/reports/${id}`, { method: 'DELETE' });
    setReports((rs) => rs.filter((r) => r.id !== id));
  };

  const openCount = reports.filter((r) => r.status === 'open').length;
  const shownReports = reports.filter((r) => showResolved || r.status === 'open');

  return (
    <div className="max-w-5xl mx-auto w-full p-md md:p-xl pt-6 pb-10 space-y-lg">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-headline text-headline-lg font-bold text-on-surface">Panel de superusuario</h2>
          <p className="text-body-md text-on-surface-variant mt-xs">Cuentas, uso y reportes de fallas de la beta.</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 bg-surface-container-high rounded-xl text-sm text-on-surface-variant hover:text-white cursor-pointer">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualizar
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {totals && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Cuentas', value: users.length, icon: <Users size={16} /> },
            { label: 'Audio transcripto', value: fmtAudio(totals.audioSeconds), icon: <Mic size={16} /> },
            { label: 'Notas generadas', value: totals.processes, icon: <FileText size={16} /> },
            { label: 'Mensajes de chat', value: totals.chats, icon: <MessageSquare size={16} /> },
            { label: 'Reportes abiertos', value: openCount, icon: <Bug size={16} /> },
          ].map((c) => (
            <div key={c.label} className="bg-surface-container rounded-xl border border-white/5 p-3">
              <div className="flex items-center gap-1.5 text-on-surface-variant text-[11px] uppercase tracking-wider font-bold">{c.icon}{c.label}</div>
              <div className="text-2xl font-black text-white mt-1">{c.value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        {(['users', 'reports'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-2 rounded-xl text-sm font-bold cursor-pointer transition-colors ${view === v ? 'bg-primary text-black' : 'bg-surface-container-high text-on-surface-variant hover:text-white'}`}
          >
            {v === 'users' ? `Cuentas (${users.length})` : `Reportes (${openCount} abiertos)`}
          </button>
        ))}
      </div>

      {view === 'users' ? (
        <div className="bg-surface-container rounded-xl border border-white/5 overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-on-surface-variant border-b border-white/5">
                <th className="p-3">Cuenta</th><th className="p-3">Último acceso</th><th className="p-3 text-right">Ingresos</th>
                <th className="p-3 text-right">Audio</th><th className="p-3 text-right">Notas</th><th className="p-3 text-right">Chats</th><th className="p-3 text-right">Reportes</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.email} className="border-b border-white/5 last:border-0">
                  <td className="p-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {u.avatar
                        ? <img referrerPolicy="no-referrer" src={u.avatar} alt="" className="w-7 h-7 rounded-full shrink-0" />
                        : <div className="w-7 h-7 rounded-full bg-primary/20 text-primary text-xs font-black flex items-center justify-center shrink-0">{u.name.charAt(0).toUpperCase()}</div>}
                      <div className="min-w-0"><div className="text-white font-semibold truncate">{u.name}</div><div className="text-[11px] text-on-surface-variant truncate">{u.email}</div></div>
                    </div>
                  </td>
                  <td className="p-3 text-on-surface-variant whitespace-nowrap">{fmtDate(u.lastSeen)}</td>
                  <td className="p-3 text-right">{u.logins}</td>
                  <td className="p-3 text-right">{fmtAudio(u.audioSeconds)}</td>
                  <td className="p-3 text-right">{u.usage.processes}</td>
                  <td className="p-3 text-right">{u.usage.chats}</td>
                  <td className="p-3 text-right">{u.usage.reports}</td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-on-surface-variant">Todavía no hay cuentas registradas.</td></tr>}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm text-on-surface-variant cursor-pointer w-fit">
            <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} /> Mostrar resueltos
          </label>
          {shownReports.map((r) => (
            <div key={r.id} className={`bg-surface-container rounded-xl border p-4 ${r.status === 'open' ? 'border-amber-400/30' : 'border-white/5 opacity-70'}`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="text-xs text-on-surface-variant">
                  <b className="text-white">{r.name || r.email}</b> · {r.email} · {fmtDate(r.createdAt)}
                </div>
                <div className="flex gap-1.5">
                  {r.status === 'open'
                    ? <button onClick={() => setStatus(r.id, 'resolved')} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-500/15 text-green-300 text-xs font-bold cursor-pointer"><Check size={13} /> Resuelto</button>
                    : <button onClick={() => setStatus(r.id, 'open')} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 text-white/70 text-xs font-bold cursor-pointer"><Undo2 size={13} /> Reabrir</button>}
                  <button onClick={() => remove(r.id)} className="p-1.5 rounded-lg text-red-300/70 hover:text-red-300 hover:bg-red-500/10 cursor-pointer" aria-label="Borrar"><Trash2 size={14} /></button>
                </div>
              </div>
              <p className="text-sm text-white mt-2 whitespace-pre-wrap break-words">{r.message}</p>
              <p className="text-[11px] text-on-surface-variant/70 mt-2 break-words">
                Pantalla: {r.context.tab || '—'} · Motor: {r.context.asrProvider || '—'}
                {r.context.lastError ? <> · Último error: <span className="text-amber-200/80">{r.context.lastError}</span></> : null}
                {r.context.userAgent ? <> · {r.context.userAgent}</> : null}
              </p>
            </div>
          ))}
          {shownReports.length === 0 && <p className="text-center text-on-surface-variant py-8">No hay reportes {showResolved ? '' : 'abiertos'}. 🎉</p>}
        </div>
      )}
    </div>
  );
}
