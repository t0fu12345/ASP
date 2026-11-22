import { useState } from 'react';
import { CalendarDays, Check, Copy, Hash } from 'lucide-react';

export function Header({ roomId, onCopyLink }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await onCopyLink();
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <div className="brand-group">
          <div className="brand-logo">
            <span className="brand-icon" aria-hidden="true">
              <CalendarDays size={18} strokeWidth={2} />
            </span>
            <h1 className="brand-title">TimeScheduling</h1>
          </div>

          <span className="room-badge" title="Mã phòng dùng chung">
            <Hash size={13} aria-hidden="true" />
            <span>{roomId}</span>
          </span>
        </div>

        <button
          type="button"
          className={`btn btn--copy-link ${copied ? 'btn--success' : 'btn--primary'}`}
          onClick={handleCopy}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          <span>{copied ? 'Đã sao chép' : 'Copy link mời'}</span>
        </button>
      </div>
    </header>
  );
}
