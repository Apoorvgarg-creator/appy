import { useCallback, useEffect, useRef, useState } from 'react';
import { api, RequestError } from './api';
import type { MobileAccess as AccessState } from './generated/api';

function expiry(value: string) { return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }

export function MobileAccess({ initialAccess = null }: { initialAccess?: AccessState | null } = {}) {
  const [access, setAccess] = useState<AccessState | null>(initialAccess);
  const [notice, setNotice] = useState<string | null>(null);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const [now, setNow] = useState(Date.now());
  const mounted = useRef(false);
  const mutationBusy = useRef(false);
  const polling = useRef(false);
  const sequence = useRef(0);

  const refresh = useCallback(async () => {
    if (!mounted.current || mutationBusy.current || polling.current) return;
    polling.current = true;
    const stamp = ++sequence.current;
    try {
      const fresh = await api.request<AccessState>('/api/v1/access');
      if (mounted.current && stamp === sequence.current) { setAccess(fresh); setOffline(false); }
    } catch {
      if (mounted.current && stamp === sequence.current) setOffline(true);
    } finally { polling.current = false; }
  }, []);

  useEffect(() => {
    mounted.current = true; void refresh();
    const interval = window.setInterval(() => { setNow(Date.now()); if (document.visibilityState === 'visible') void refresh(); }, 5000);
    const visible = () => { if (document.visibilityState === 'visible') { setNow(Date.now()); void refresh(); } };
    document.addEventListener('visibilitychange', visible);
    return () => { mounted.current = false; window.clearInterval(interval); document.removeEventListener('visibilitychange', visible); };
  }, [refresh]);

  async function change(path: string, body: unknown = {}) {
    if (!mounted.current || mutationBusy.current) return;
    mutationBusy.current = true; sequence.current += 1; setBusy(true); setNotice(null);
    try {
      const fresh = await api.request<AccessState>(path, body, { ephemeral: true });
      if (mounted.current) { setAccess(fresh); setOffline(false); }
    } catch (cause) {
      if (mounted.current) setNotice(cause instanceof RequestError && !cause.uncertain ? cause.message : 'The change wasn’t confirmed. Checking current access; review it before trying again.');
    } finally {
      mutationBusy.current = false;
      if (mounted.current) { setBusy(false); void refresh(); }
    }
  }

  async function copyAddress() {
    try { await navigator.clipboard.writeText(access?.origin ?? ''); setCopyNotice('Address copied.'); }
    catch { setCopyNotice('Couldn’t copy. Select and copy the address below.'); }
  }

  const invite = access?.invite && Date.parse(access.invite.expires_at) > now ? access.invite : null;
  const disabled = busy || offline;
  return <div className="access-focus">
    <div className="page-heading"><p className="eyebrow">iPhone & iPad</p><h1 tabIndex={-1}>Connect a phone</h1><p className="lede">Open your Mac’s workspace in Safari. Create tasks, review reports, and stay in control.</p></div>
    {offline && <div className="notice error" role="alert"><p>Can’t reach Appy. Access details may be out of date.</p><button className="btn" disabled={busy} onClick={() => { void refresh(); }}>Check connection</button></div>}
    {notice && <div className="notice error" role="alert"><p>{notice}</p></div>}
    {!access ? <p role="status" className="muted">Loading access settings…</p> : !access.enabled ? <section className="panel"><div className="panel-body"><h2>Set up your private connection</h2><p className="lede">Connect your Mac and phone through Tailscale, then enable mobile access when starting Appy.</p><p className="help">Follow “Connect your iPhone or iPad” in the project README on your Mac. Return here when setup is complete to create a pairing code.</p></div></section> : <>
      <section className="pairing-steps" aria-label="Connect your browser">
        <div className="pairing-step"><span className="step-number">1</span><div><h2>Open this address on your phone</h2><p className="muted">Keep Tailscale connected on both devices.</p><div className="address-row"><input aria-label="Private workspace address" readOnly value={access.origin ?? ''} onFocus={(event) => event.target.select()} /><button className="btn" onClick={() => { void copyAddress(); }}>Copy</button></div>{copyNotice && <p className="field-note" role="status">{copyNotice}</p>}</div></div>
        <div className="pairing-step"><span className="step-number">2</span><div><h2>Enter a pairing code</h2><p className="muted">Each code connects one browser. Only share it with a device you control.</p>{invite ? <div className="pairing-code-block"><output className="pairing-code" aria-label={`Pairing code ${invite.code.split('').join(' ')}`}>{invite.code.slice(0, 4)} {invite.code.slice(4)}</output><p className="field-note">Valid until {expiry(invite.expires_at)} · One use</p><button className="text-button" disabled={disabled} onClick={() => { void change('/api/v1/access/invite'); }}>Replace this code</button></div> : <div className="actions"><button className="btn primary" disabled={disabled} onClick={() => { void change('/api/v1/access/invite'); }}>{busy ? 'Creating…' : 'Create pairing code'}</button></div>}</div></div>
      </section>
      <section className="paired-browsers"><div className="section-heading"><h2>Connected browsers</h2>{(access.sessions.length > 0 || invite) && <button className="text-button" disabled={disabled} onClick={() => { void change('/api/v1/access/stop'); }}>Disconnect all</button>}</div>{access.sessions.length === 0 ? <p className="empty-access">Your connected iPhone and iPad browsers will appear here.</p> : <ul className="browser-list">{access.sessions.map((browser) => <li key={browser.id}><div><h3>{browser.name}</h3><p>Access until {expiry(browser.expires_at)}</p></div><button className="btn" disabled={disabled} aria-label={`Disconnect ${browser.name}`} onClick={() => { void change('/api/v1/access/revoke', { session_id: browser.id }); }}>Disconnect</button></li>)}</ul>}<p className="help">Disconnecting closes browser access. Tasks already started on your Mac keep running; use Stop all to cancel them.</p></section>
    </>}
  </div>;
}
