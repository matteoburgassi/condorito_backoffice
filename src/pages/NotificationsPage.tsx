import { useState, useEffect } from 'react';
import { Send, Users, Crown, User, Bell } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

type Notification = {
  id: string;
  target_user_id: string | null;
  segment: string;
  title: string;
  body: string | null;
  created_at: string;
  sent_by: string | null;
};

type UserProfile = {
  id: string;
  display_name: string | null;
  is_premium: boolean;
};

export function NotificationsPage() {
  const { session } = useAuth();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [segment, setSegment] = useState<'all' | 'premium' | 'free' | 'specific'>('all');
  const [targetUserId, setTargetUserId] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; error?: string; sent_to?: number } | null>(null);
  const [history, setHistory] = useState<Notification[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    loadHistory();
    loadProfiles();
  }, []);

  async function loadHistory() {
    setLoadingHistory(true);
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    setHistory(data || []);
    setLoadingHistory(false);
  }

  async function loadProfiles() {
    const { data } = await supabase
      .from('user_profiles')
      .select('id, display_name, is_premium');
    setProfiles(data || []);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setResult(null);

    const payload: Record<string, string> = { title, body, segment };
    if (segment === 'specific') payload.target_user_id = targetUserId;

    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-notification`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
        Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    if (!res.ok) {
      setResult({ error: json.error || 'Failed to send' });
    } else {
      setResult({ success: true, sent_to: json.sent_to });
      setTitle('');
      setBody('');
      loadHistory();
    }
    setSending(false);
  }

  const segmentOptions = [
    { value: 'all', label: 'All Users', icon: Users },
    { value: 'premium', label: 'Premium Users', icon: Crown },
    { value: 'free', label: 'Free Users', icon: User },
    { value: 'specific', label: 'Specific User', icon: User },
  ] as const;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">Push Notifications</h1>
          <p className="page-desc">Send real-time notifications to app users by segment or individually.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
        {/* Send Form */}
        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Send size={18} />
            Send Notification
          </h2>

          <form onSubmit={handleSend}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-muted)' }}>
                Target Segment
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {segmentOptions.map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSegment(opt.value)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: segment === opt.value ? '2px solid var(--accent)' : '2px solid var(--border)',
                        background: segment === opt.value ? 'var(--surface-2)' : 'transparent',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 500,
                        color: segment === opt.value ? 'var(--accent)' : 'var(--text)',
                        transition: 'all 0.15s',
                      }}
                    >
                      <Icon size={15} />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {segment === 'specific' && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-muted)' }}>
                  User
                </label>
                {profiles.length > 0 ? (
                  <select
                    value={targetUserId}
                    onChange={(e) => setTargetUserId(e.target.value)}
                    className="input"
                    required
                  >
                    <option value="">Select a user...</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.display_name || p.id.slice(0, 8)} {p.is_premium ? '(Premium)' : '(Free)'}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    className="input"
                    value={targetUserId}
                    onChange={(e) => setTargetUserId(e.target.value)}
                    placeholder="User ID (uuid)"
                    required
                  />
                )}
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-muted)' }}>
                Title
              </label>
              <input
                type="text"
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Notification title"
                required
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-muted)' }}>
                Body
              </label>
              <textarea
                className="input"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Notification body (optional)"
                rows={3}
                style={{ resize: 'vertical' }}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={sending || !title}
              style={{ width: '100%' }}
            >
              {sending ? 'Sending...' : 'Send Notification'}
            </button>
          </form>

          {result && (
            <div
              style={{
                marginTop: 16,
                padding: 12,
                borderRadius: 8,
                fontSize: 13,
                background: result.success ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                color: result.success ? '#16a34a' : '#dc2626',
                border: `1px solid ${result.success ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
              }}
            >
              {result.success
                ? `Notification sent to ${result.sent_to} user(s).`
                : `Error: ${result.error}`}
            </div>
          )}
        </div>

        {/* History */}
        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bell size={18} />
            Sent History
          </h2>

          {loadingHistory ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading...</p>
          ) : history.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No notifications sent yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 500, overflowY: 'auto' }}>
              {history.map((n) => (
                <div
                  key={n.id}
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--surface-2)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{n.title}</span>
                    <span
                      style={{
                        fontSize: 11,
                        padding: '2px 8px',
                        borderRadius: 12,
                        background: n.segment === 'premium' ? 'rgba(234,179,8,0.15)' : 'var(--surface-3)',
                        color: n.segment === 'premium' ? '#b45309' : 'var(--text-muted)',
                        fontWeight: 500,
                      }}
                    >
                      {n.segment}
                    </span>
                  </div>
                  {n.body && (
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>{n.body}</p>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 6 }}>
                    {new Date(n.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
