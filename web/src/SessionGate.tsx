import { useCallback, useEffect, useRef, useState } from 'react';
import { App } from './App';
import { api, RequestError, SESSION_EXPIRED_EVENT } from './api';
import type { ControllerSession } from './generated/api';
import { pairBrowser } from './session';

export function PairingScreen({ busy = false, message, checking = false, checkAccess, connect }: {
  busy?: boolean; message?: string | null; checking?: boolean; checkAccess: () => void;
  connect: (code: string, name: string) => Promise<void>;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('iPhone or iPad');
  return <main className="connect-shell">
    <div className="connect-brand"><span className="brand-mark">a</span>appy</div>
    <div className="page-heading"><p className="eyebrow">Your personal workspace</p><h1>Connect to your Mac</h1><p className="lede">On your Mac, open Appy → Runner → Connect a phone to get a pairing code.</p></div>
    {message && <div className="notice error" role="alert"><p>{message}</p></div>}
    <form className="connect-form" onSubmit={(event) => { event.preventDefault(); if (/^[0-9]{8}$/.test(code) && name.trim()) void connect(code, name.trim()).finally(() => setCode('')); }}>
      <div className="field"><label htmlFor="pair-code">Pairing code</label><input id="pair-code" className="code-input" value={code} onChange={(event) => setCode(event.target.value.replace(/\s/g, '').replace(/[^0-9]/g, '').slice(0, 8))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{8}" maxLength={12} placeholder="0000 0000" required aria-describedby="pair-code-note" disabled={busy || checking} /><p id="pair-code-note" className="field-note">Eight digits. Your code is valid for five minutes.</p></div>
      <div className="field"><label htmlFor="browser-name">Name this browser</label><input id="browser-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={40} autoComplete="off" required disabled={busy || checking} /><p className="field-note">So you can recognize and disconnect it from your Mac.</p></div>
      <button className="btn primary" type="submit" disabled={busy || checking || code.length !== 8 || !name.trim()}>{busy ? 'Connecting…' : 'Connect to workspace'}</button>
    </form>
    <p className="help">Pairing gives this browser access to your tasks and reports for eight hours. Your Mac stays in control of access.</p>
    <button className="text-button" type="button" disabled={busy || checking} onClick={checkAccess}>{checking ? 'Checking access…' : 'Already connected? Check access'}</button>
  </main>;
}

export function SessionGate() {
  const [session, setSession] = useState<ControllerSession | null>(null);
  const [phase, setPhase] = useState<'checking' | 'ready' | 'logout'>('checking');
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(false);
  const sequence = useRef(0);
  const current = useRef(session);
  const logoutPending = useRef(false);
  const actionBusy = useRef(false);
  const polling = useRef(false);
  current.current = session;

  const accept = useCallback((fresh: ControllerSession) => {
    if (!fresh.authenticated) api.clearPending();
    setSession(fresh);
    setPhase('ready');
    setNotice(null);
  }, []);

  const refresh = useCallback(async (foreground = false) => {
    if (!mounted.current || logoutPending.current || actionBusy.current || polling.current) return;
    polling.current = true;
    const stamp = ++sequence.current;
    if (foreground && !current.current?.authenticated) { setPhase('checking'); setNotice(null); }
    try {
      const fresh = await api.request<ControllerSession>('/api/v1/session');
      if (!mounted.current || stamp !== sequence.current) return;
      const lostAccess = current.current?.authenticated && !fresh.authenticated;
      accept(fresh);
      if (lostAccess) setNotice('This browser’s access expired or was disconnected. Get a new code on your Mac to reconnect.');
    } catch {
      if (!mounted.current || stamp !== sequence.current) return;
      if (!current.current?.authenticated) {
        setPhase('ready');
        setNotice('Can’t reach your Mac. Check your private connection and that Appy is running, then check access.');
      }
    } finally { polling.current = false; }
  }, [accept]);

  useEffect(() => {
    mounted.current = true;
    void refresh(true);
    const interval = window.setInterval(() => { if (current.current?.authenticated && document.visibilityState === 'visible') void refresh(); }, 5000);
    const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
    const expire = () => {
      sequence.current += 1;
      api.clearPending();
      if (logoutPending.current) return;
      setSession({ mode: 'remote', authenticated: false, name: null, expires_at: null });
      setPhase('ready');
      setNotice('This browser’s access expired or was disconnected. Get a new code on your Mac to reconnect.');
    };
    document.addEventListener('visibilitychange', visible);
    window.addEventListener(SESSION_EXPIRED_EVENT, expire);
    return () => { mounted.current = false; window.clearInterval(interval); document.removeEventListener('visibilitychange', visible); window.removeEventListener(SESSION_EXPIRED_EVENT, expire); };
  }, [refresh]);

  async function connect(code: string, name: string) {
    if (!mounted.current || actionBusy.current || logoutPending.current) return;
    actionBusy.current = true;
    const stamp = ++sequence.current;
    setBusy(true); setNotice(null);
    try {
      const fresh = await pairBrowser(api.request, { code, name });
      if (mounted.current && stamp === sequence.current) accept(fresh);
    } catch (cause) {
      if (mounted.current && stamp === sequence.current) setNotice(cause instanceof RequestError ? cause.message : 'Couldn’t connect. Check the code on your Mac and try again.');
    } finally { actionBusy.current = false; if (mounted.current) setBusy(false); }
  }

  async function logout() {
    if (!mounted.current || actionBusy.current) return;
    actionBusy.current = true;
    logoutPending.current = true;
    sequence.current += 1;
    api.clearPending();
    setPhase('logout'); setBusy(true); setNotice(null);
    try {
      const fresh = await api.request<ControllerSession>('/api/v1/session/logout', {}, { ephemeral: true });
      if (mounted.current) { logoutPending.current = false; accept(fresh); setNotice('This browser is disconnected. Your tasks remain saved on your Mac.'); }
    } catch {
      // A logout response can be lost after revocation. Read status; do not repeat the POST.
      try {
        const fresh = await api.request<ControllerSession>('/api/v1/session');
        if (mounted.current && !fresh.authenticated) { logoutPending.current = false; accept(fresh); return; }
      } catch { /* Keep the workspace unmounted while disconnection is unconfirmed. */ }
      if (mounted.current) setNotice('Disconnection wasn’t confirmed. Reconnect to your Mac and try again, or disconnect this browser from the Mac’s access page.');
    } finally { actionBusy.current = false; if (mounted.current) setBusy(false); }
  }

  if (phase === 'logout') return <main className="connect-shell"><div className="connect-brand"><span className="brand-mark">a</span>appy</div><div className="page-heading"><h1>{busy ? 'Disconnecting this browser' : 'Confirm disconnection'}</h1><p className="lede">Your workspace is closed on this browser.</p></div>{notice && <div className="notice error" role="alert"><p>{notice}</p></div>}<button className="btn" disabled={busy} onClick={() => { void logout(); }}>{busy ? 'Disconnecting…' : 'Try disconnecting again'}</button></main>;
  if (session?.authenticated) return <App session={session} onLogout={() => { void logout(); }} />;
  if (phase === 'checking' && !session) return <main className="connect-shell"><div className="connect-brand"><span className="brand-mark">a</span>appy</div><div className="page-heading"><h1>Opening your workspace</h1><p className="lede" role="status">Checking your connection to Appy…</p></div></main>;
  return <PairingScreen busy={busy} checking={phase === 'checking'} message={notice} checkAccess={() => { void refresh(true); }} connect={connect} />;
}
