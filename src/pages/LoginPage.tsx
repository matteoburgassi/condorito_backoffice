import { useState } from 'react';
import { Loader as Loader2 } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';

/** Simple Microsoft logo mark for the SSO button. */
function MicrosoftLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 21 21" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

export function LoginPage() {
  const { signIn, signUp, signInWithMicrosoft } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!email || !password) {
      setError('Enter your email and password.');
      return;
    }
    if (mode === 'signup' && password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setBusy(true);
    const fn = mode === 'signin' ? signIn : signUp;
    const { error } = await fn(email.trim(), password);
    setBusy(false);
    if (error) {
      setError(error);
      return;
    }
    if (mode === 'signup') {
      setInfo('Account created. If you are not yet an admin, ask an existing admin to grant access.');
    }
  };

  const onMicrosoft = async () => {
    setError(null);
    setInfo(null);
    setOauthBusy(true);
    const { error } = await signInWithMicrosoft();
    // On success the browser redirects to Microsoft; only clear busy on failure.
    if (error) {
      setOauthBusy(false);
      setError(error);
    }
  };

  const anyBusy = busy || oauthBusy;

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="brand-mark">C</div>
          <div>
            <div className="auth-title">Condorito Backoffice</div>
            <div className="auth-sub">{mode === 'signin' ? 'Sign in to manage content' : 'Create an admin account'}</div>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {info && <div className="alert alert-info">{info}</div>}

        {mode === 'signin' && (
          <>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ width: '100%', justifyContent: 'center', gap: 10 }}
              onClick={onMicrosoft}
              disabled={anyBusy}
            >
              {oauthBusy ? <Loader2 className="spin" size={16} /> : <MicrosoftLogo />}
              Sign in with Microsoft
            </button>
            <div className="auth-divider">
              <span>or continue with email</span>
            </div>
          </>
        )}

        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@condorito.app"
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={anyBusy}>
            {busy && <Loader2 className="spin" size={16} />}
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div className="auth-switch">
          {mode === 'signin' ? (
            <>
              Need an account?{' '}
              <button onClick={() => { setMode('signup'); setError(null); setInfo(null); }}>Sign up</button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button onClick={() => { setMode('signin'); setError(null); setInfo(null); }}>Sign in</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
