import { useEffect } from 'react';
import { X } from 'lucide-react';

function getInitial(name) {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : '?';
}

export function SlotTooltip({ hoveredSlot, currentUserId, totalUsers }) {
  if (!hoveredSlot || !hoveredSlot.users || hoveredSlot.users.length === 0) {
    return null;
  }

  const { day, slot, users, rect } = hoveredSlot;
  const tooltipWidth = 244;
  const estimatedHeight = 80 + users.length * 28;
  const padding = 12;

  let left = rect.right + 10;
  if (left + tooltipWidth > window.innerWidth - padding) {
    left = Math.max(padding, rect.left - tooltipWidth - 10);
  }

  const top = Math.max(
    padding,
    Math.min(rect.top, window.innerHeight - estimatedHeight - padding),
  );

  const countLabel =
    totalUsers > 0
      ? `${users.length} / ${totalUsers} người rảnh`
      : `${users.length} người rảnh`;

  return (
    <div
      className="slot-tooltip"
      role="tooltip"
      style={{ top: `${top}px`, left: `${left}px` }}
    >
      <div className="slot-tooltip-header">
        {day.dayFull}, {day.dayNumber}/{day.monthNumber}
      </div>
      <div className="slot-tooltip-sub">
        {slot.range} · {countLabel}
      </div>
      <ul className="slot-tooltip-list">
        {users.map((user) => (
          <li key={user.id} className="slot-tooltip-item">
            <span className="slot-tooltip-dot" aria-hidden="true" />
            <span>{user.name}</span>
            {user.id === currentUserId && (
              <span className="slot-tooltip-you">Bạn</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SlotBottomSheet({
  inspectedSlot,
  currentUserId,
  totalUsers,
  onClose,
}) {
  useEffect(() => {
    if (!inspectedSlot) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inspectedSlot, onClose]);

  if (!inspectedSlot || !inspectedSlot.users?.length) {
    return null;
  }

  const { day, slot, users } = inspectedSlot;
  const countLabel =
    totalUsers > 0
      ? `${users.length} / ${totalUsers} người rảnh`
      : `${users.length} người rảnh`;

  return (
    <div
      className="sheet-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="slot-bottom-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="slot-sheet-title"
      >
        <div className="sheet-handle" aria-hidden="true" />

        <div className="sheet-header">
          <div>
            <h3 id="slot-sheet-title" className="sheet-title">
              {day.dayFull}, {day.dayNumber}/{day.monthNumber} · {slot.range}
            </h3>
            <p className="sheet-subtitle">{countLabel}</p>
          </div>
          <button
            type="button"
            className="btn btn--icon sheet-close-btn"
            aria-label="Đóng danh sách người rảnh"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        <ul className="sheet-user-list">
          {users.map((user) => (
            <li key={user.id} className="sheet-user-item">
              <span className="respondent-avatar" aria-hidden="true">
                {getInitial(user.name)}
              </span>
              <span className="sheet-user-name">{user.name}</span>
              {user.id === currentUserId && (
                <span className="slot-tooltip-you">Bạn</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
