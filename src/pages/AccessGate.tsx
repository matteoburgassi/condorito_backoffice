import { useState } from 'react';
import { ShieldAlert, LogOut, Copy, Check, RefreshCw } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';

export function AccessGate() {
  const { user, signOut, refreshAdmin } = useAuth();
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);

  const copy = async () => {
    if (!user) return;
    await navigator.clipboard.writeText(user.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const recheck = async () => {
    setChecking(true);
    await refreshAdmin();
    setChecking(false);
  };

  return (
    <div className="gate">
      <div className="gate-box">
        <div style={{ color: 'var(--warning)', marginBottom: 16 }}>
          <ShieldAlert size={44} />
        </div>
        <h1 style={{ fontSize: 22, marginBottom: 10 }}>Access pending</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6 }}>
          You are signed in as <strong style={{ color: 'var(--text)' }}>{user?.email}</strong>, but this account is not
          yet an admin. Ask an existing admin to grant access using your user ID below.
        </p>

        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <span className="code-chip">{user?.id}</span>
          <button className="btn btn-ghost btn-sm" onClick={copy}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy user ID'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 26 }}>
          <button className="btn btn-primary btn-sm" onClick={recheck} disabled={checking}>
            <RefreshCw size={14} className={checking ? 'spin' : undefined} />
            Check again
          </button>
          <button className="btn btn-ghost btn-sm" onClick={signOut}>
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
