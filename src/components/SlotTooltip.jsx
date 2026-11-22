export function SlotTooltip({ hoveredSlot, currentUserId }) {
  if (!hoveredSlot || !hoveredSlot.users || hoveredSlot.users.length === 0) {
    return null;
  }

  const { day, slot, users, rect } = hoveredSlot;
  const tooltipWidth = 240;
  const estimatedHeight = 76 + users.length * 26;
  const padding = 12;

  let left = rect.right + 10;
  if (left + tooltipWidth > window.innerWidth - padding) {
    left = Math.max(padding, rect.left - tooltipWidth - 10);
  }

  const top = Math.max(
    padding,
    Math.min(rect.top, window.innerHeight - estimatedHeight - padding),
  );

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
        {slot.range} · {users.length} người rảnh
      </div>
      <ul className="slot-tooltip-list">
        {users.map((user) => (
          <li key={user.id} className="slot-tooltip-item">
            <span
              className="color-dot"
              style={{ backgroundColor: user.color }}
              aria-hidden="true"
            />
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
