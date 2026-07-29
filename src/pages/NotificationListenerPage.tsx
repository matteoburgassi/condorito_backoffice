import { useState, useEffect, useRef } from 'react';
import { Radio, Bell, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

type IncomingNotification = {
  title: string;
  body?: string;
  segment: string;
  received_at: string;
};

type StoredNotification = {
  id: string;
  title: string;
  body: string | null;
  segment: string;
  is_read: boolean;
  created_at: string;
};

export function NotificationListenerPage() {
  const { user } = useAuth();
  const [live, setLive] = useState<IncomingNotification[]>([]);
  const [stored, setStored] = useState<StoredNotification[]>([]);
  const [connected, setConnected] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!user) return;

    loadStored();

    const channel = supabase.channel(`user-notifications:${user.id}`);
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'new-notification' }, (payload) => {
        const data = payload.payload as { title: string; body?: string; segment: string };
        setLive((prev) => [
          { ...data, received_at: new Date().toISOString() },
          ...prev,
        ]);
        loadStored();
      })
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
      });

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [user]);

  async function loadStored() {
    const { data } = await supabase
      .from('notifications')
      .select('id, title, body, segment, is_read, created_at')
      .order('created_at', { ascending: false })
      .limit(30);
    setStored(data || []);
  }

  async function markAsRead(id: string) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    loadStored();
  }

  async function clearLive() {
    setLive([]);
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">Notification Listener</h1>
          <p className="page-desc">
            Simulates the mobile app receiving real-time notifications. Keep this open while sending from the Notifications page.
          </p>
        </div>
      </div>

      {/* Connection Status */}
      <div
        className="card"
        style={{
          padding: '12px 18px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: connected ? '#22c55e' : '#ef4444',
            boxShadow: connected ? '0 0 8px rgba(34,197,94,0.5)' : 'none',
            transition: 'all 0.3s',
          }}
        />
        <span style={{ fontSize: 13, fontWeight: 500 }}>
          {connected ? 'Connected' : 'Connecting...'}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-faint)', marginLeft: 8 }}>
          Channel: user-notifications:{user?.id?.slice(0, 8)}...
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
        {/* Live Stream */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Radio size={18} style={{ color: connected ? '#22c55e' : 'var(--text-muted)' }} />
              Live Stream
            </h2>
            {live.length > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={clearLive}>
                <Trash2 size={14} />
                Clear
              </button>
            )}
          </div>

          {live.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              <Bell size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
              <p style={{ fontSize: 13 }}>Waiting for notifications...</p>
              <p style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                Send one from the Notifications page to see it appear here instantly.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 400, overflowY: 'auto' }}>
              {live.map((n, i) => (
                <div
                  key={i}
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    border: '1px solid rgba(34,197,94,0.3)',
                    background: 'rgba(34,197,94,0.05)',
                    animation: 'fadeIn 0.3s ease-out',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{n.title}</div>
                  {n.body && <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>{n.body}</p>}
                  <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 6 }}>
                    Received: {new Date(n.received_at).toLocaleTimeString()} | Segment: {n.segment}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stored Notifications (DB) */}
        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bell size={18} />
            Inbox (from Database)
          </h2>

          {stored.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No notifications stored yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 400, overflowY: 'auto' }}>
              {stored.map((n) => (
                <div
                  key={n.id}
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: n.is_read ? 'transparent' : 'var(--surface-2)',
                    opacity: n.is_read ? 0.6 : 1,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: n.is_read ? 400 : 600, fontSize: 14 }}>{n.title}</span>
                    {!n.is_read && (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => markAsRead(n.id)}
                        style={{ fontSize: 11 }}
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                  {n.body && <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>{n.body}</p>}
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
