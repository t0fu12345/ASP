import { useState } from 'react';
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Hash,
} from 'lucide-react';
import { formatWeekRange } from '../constants/schedule';

function getSyncPillInfo(syncMode, syncStatus) {
  if (syncMode === 'local') {
    return {
      className: 'sync-pill sync-pill--local',
      label: 'Local Mode',
      title: 'Đồng bộ giữa các tab trình duyệt. Kết nối Firebase để đồng bộ nhiều thiết bị.',
    };
  }

  switch (syncStatus) {
    case 'synced':
      return {
        className: 'sync-pill sync-pill--synced',
        label: 'Realtime',
        title: 'Đã kết nối Firebase Realtime Database',
      };
    case 'syncing':
      return {
        className: 'sync-pill sync-pill--syncing',
        label: 'Đang đồng bộ...',
        title: 'Đang đồng bộ dữ liệu lên Firebase',
      };
    case 'offline':
      return {
        className: 'sync-pill sync-pill--offline',
        label: 'Mất kết nối',
        title: 'Đang mất kết nối mạng tới Firebase',
      };
    default:
      return {
        className: 'sync-pill sync-pill--error',
        label: 'Lỗi đồng bộ',
        title: 'Không thể kết nối Firebase Realtime Database. Kiểm tra cấu hình hoặc Rules.',
      };
  }
}

export function Header({
  roomId,
  syncMode,
  syncStatus,
  weekStart,
  onPrevWeek,
  onTodayWeek,
  onNextWeek,
  onCopyLink,
}) {
  const [copied, setCopied] = useState(false);
  const pill = getSyncPillInfo(syncMode, syncStatus);
  const weekRangeLabel = formatWeekRange(weekStart);

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

          <span className={pill.className} title={pill.title}>
            <span className="sync-dot" aria-hidden="true" />
            <span>{pill.label}</span>
          </span>
        </div>

        <div className="header-actions">
          <nav className="week-nav" aria-label="Điều hướng tuần">
            <button
              type="button"
              className="btn btn--icon"
              onClick={onPrevWeek}
              aria-label="Tuần trước"
              title="Tuần trước"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={onTodayWeek}
              title="Quay về tuần hiện tại"
            >
              Tuần này
            </button>
            <span className="week-nav-range">{weekRangeLabel}</span>
            <button
              type="button"
              className="btn btn--icon"
              onClick={onNextWeek}
              aria-label="Tuần sau"
              title="Tuần sau"
            >
              <ChevronRight size={18} />
            </button>
          </nav>

          <button
            type="button"
            className={`btn btn--copy-link ${copied ? 'btn--success' : 'btn--primary'}`}
            onClick={handleCopy}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            <span>{copied ? 'Đã sao chép' : 'Copy link mời'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
