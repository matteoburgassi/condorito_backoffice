import { TriangleAlert as AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
  busy,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={busy}>
            {busy ? 'Working...' : confirmLabel}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <div style={{ color: 'var(--error)', flexShrink: 0, marginTop: 2 }}>
          <AlertTriangle size={22} />
        </div>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.55 }}>{message}</p>
      </div>
    </Modal>
  );
}
