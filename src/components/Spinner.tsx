import { Loader as Loader2 } from 'lucide-react';

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="spinner-center">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <Loader2 className="spin" size={26} />
        {label && <span style={{ fontSize: 13.5 }}>{label}</span>}
      </div>
    </div>
  );
}
