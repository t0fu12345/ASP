import { useEffect, useMemo, useRef, useState } from 'react';
import {
  TIME_SLOTS,
  formatMonthTitle,
  getWeekDays,
  hexToRgba,
  makeSlotKey,
} from '../constants/schedule';

export function WeeklyGrid({
  weekStart,
  users,
  currentUser,
  highlightedUserId,
  onToggleSlots,
  onRequireName,
  onHoverSlot,
  onLeaveSlot,
}) {
  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);
  const monthTitle = useMemo(() => formatMonthTitle(weekStart), [weekStart]);

  const [dragState, setDragState] = useState(null);
  const dragRef = useRef(null);
  const touchStartRef = useRef(null);

  const slotUsersMap = useMemo(() => {
    const map = new Map();
    for (const user of users) {
      for (const slotKey of user.slots) {
        if (!map.has(slotKey)) {
          map.set(slotKey, []);
        }
        map.get(slotKey).push(user);
      }
    }
    return map;
  }, [users]);

  const currentUserSlotSet = useMemo(
    () => new Set(currentUser.slots || []),
    [currentUser.slots],
  );

  useEffect(() => {
    const handlePointerMove = (event) => {
      if (!dragRef.current) return;
      const target = document.elementFromPoint(event.clientX, event.clientY);
      const cellEl = target?.closest?.('[data-slot-key]');
      const slotKey = cellEl?.getAttribute('data-slot-key');
      if (!slotKey || dragRef.current.visited.has(slotKey)) return;

      dragRef.current.visited.add(slotKey);
      setDragState({
        mode: dragRef.current.mode,
        visited: new Set(dragRef.current.visited),
      });
    };

    const handlePointerUp = (event) => {
      if (touchStartRef.current) {
        const { slotKey, x, y, shouldSelect } = touchStartRef.current;
        touchStartRef.current = null;
        const dist = Math.hypot(event.clientX - x, event.clientY - y);
        if (dist < 10) {
          onToggleSlots([slotKey], shouldSelect);
        }
      }

      if (!dragRef.current) return;
      const { mode, visited } = dragRef.current;
      dragRef.current = null;
      setDragState(null);
      if (visited.size > 0) {
        onToggleSlots(Array.from(visited), mode === 'add');
      }
    };

    const handlePointerCancel = () => {
      touchStartRef.current = null;
      if (!dragRef.current) return;
      dragRef.current = null;
      setDragState(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
    };
  }, [onToggleSlots]);

  const handleCellPointerDown = (event, slotKey) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    if (!currentUser.name.trim()) {
      onRequireName();
      return;
    }

    onLeaveSlot();
    const isSelected = currentUserSlotSet.has(slotKey);
    const mode = isSelected ? 'remove' : 'add';

    if (event.pointerType === 'touch') {
      touchStartRef.current = {
        slotKey,
        x: event.clientX,
        y: event.clientY,
        shouldSelect: mode === 'add',
      };
      return;
    }

    const visited = new Set([slotKey]);
    dragRef.current = { mode, visited };
    setDragState({ mode, visited: new Set(visited) });
  };

  const handleCellKeyDown = (event, slotKey) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    if (!currentUser.name.trim()) {
      onRequireName();
      return;
    }
    const isSelected = currentUserSlotSet.has(slotKey);
    onToggleSlots([slotKey], !isSelected);
  };

  const getCellDisplayUsers = (slotKey) => {
    const savedUsers = slotUsersMap.get(slotKey) || [];
    if (!dragState || !dragState.visited.has(slotKey)) {
      return {
        displayUsers: savedUsers,
        isMine: currentUserSlotSet.has(slotKey),
      };
    }

    const withoutMe = savedUsers.filter((u) => u.id !== currentUser.id);
    if (dragState.mode === 'add') {
      const meEntry = {
        id: currentUser.id,
        name: currentUser.name.trim(),
        color: currentUser.color,
      };
      return {
        displayUsers: [meEntry, ...withoutMe],
        isMine: true,
      };
    }

    return {
      displayUsers: withoutMe,
      isMine: false,
    };
  };

  return (
    <section className="card weekly-grid-card" aria-label="Lịch rảnh theo tuần">
      <div className="grid-topbar">
        <h2 className="grid-month-title">{monthTitle}</h2>
        <p className="grid-hint">Nhấn hoặc kéo qua nhiều ô để tô khung giờ rảnh (2 tiếng/ô)</p>
      </div>

      <div className="calendar-scroll-wrapper">
        <div
          className={`calendar-grid ${dragState ? 'calendar-grid--painting' : ''}`}
          role="grid"
          aria-label={`Lịch tuần ${monthTitle}`}
        >
          <div className="calendar-corner" aria-hidden="true" />

          {weekDays.map((day) => (
            <div
              key={day.isoDate}
              className={`day-header ${day.isToday ? 'day-header--today' : ''}`}
            >
              <span className="day-header-short">{day.dayShort}</span>
              <span className="day-header-num">{day.dayNumber}</span>
            </div>
          ))}

          {TIME_SLOTS.map((slot, rowIndex) => {
            const isLastRow = rowIndex === TIME_SLOTS.length - 1;

            return (
              <div key={slot.hour} style={{ display: 'contents' }}>
                <div className="time-axis-cell" aria-hidden="true">
                  <span className="time-axis-start">{slot.label}</span>
                  {isLastRow && (
                    <span className="time-axis-end">{slot.endLabel}</span>
                  )}
                </div>

                {weekDays.map((day, colIndex) => {
                  const slotKey = makeSlotKey(day.isoDate, slot.hour);
                  const { displayUsers, isMine } = getCellDisplayUsers(slotKey);
                  const hasUsers = displayUsers.length > 0;

                  const isHighlightedMatch =
                    highlightedUserId &&
                    displayUsers.some((u) => u.id === highlightedUserId);
                  const isDimmed =
                    Boolean(highlightedUserId) && !isHighlightedMatch;

                  const tintColor = isMine
                    ? currentUser.color
                    : displayUsers[0]?.color;

                  const cellStyle = hasUsers
                    ? {
                        backgroundColor: hexToRgba(
                          tintColor,
                          isMine ? 0.2 : 0.14,
                        ),
                      }
                    : undefined;

                  const cellClasses = [
                    'slot-cell',
                    colIndex === 0 ? 'slot-cell--first-col' : '',
                    rowIndex === 0 ? 'slot-cell--first-row' : '',
                    isMine ? 'slot-cell--mine' : '',
                    isHighlightedMatch ? 'slot-cell--highlighted' : '',
                    isDimmed ? 'slot-cell--dimmed' : '',
                  ]
                    .filter(Boolean)
                    .join(' ');

                  const namesList = displayUsers.map((u) => u.name).join(', ');
                  const ariaLabel = hasUsers
                    ? `${day.dayFull} ${day.dayNumber}/${day.monthNumber}, ${slot.range}, ${displayUsers.length} người rảnh: ${namesList}`
                    : `${day.dayFull} ${day.dayNumber}/${day.monthNumber}, ${slot.range}, chưa có người chọn`;

                  const handleShowTooltip = (event) => {
                    if (dragRef.current || !hasUsers) {
                      onLeaveSlot();
                      return;
                    }
                    onHoverSlot({
                      slotKey,
                      day,
                      slot,
                      users: displayUsers,
                      rect: event.currentTarget.getBoundingClientRect(),
                    });
                  };

                  return (
                    <button
                      key={slotKey}
                      type="button"
                      data-slot-key={slotKey}
                      className={cellClasses}
                      style={cellStyle}
                      aria-label={ariaLabel}
                      aria-pressed={isMine}
                      onPointerDown={(e) => handleCellPointerDown(e, slotKey)}
                      onKeyDown={(e) => handleCellKeyDown(e, slotKey)}
                      onMouseEnter={handleShowTooltip}
                      onFocus={handleShowTooltip}
                      onMouseLeave={onLeaveSlot}
                      onBlur={onLeaveSlot}
                    >
                      <span className="slot-cell-top">
                        {isMine && <span className="slot-mine-tag">Bạn</span>}
                        {displayUsers.length >= 2 && (
                          <span className="slot-count-badge">
                            {displayUsers.length}
                          </span>
                        )}
                      </span>

                      {hasUsers && (
                        <span className="slot-bars" aria-hidden="true">
                          {displayUsers.slice(0, 6).map((u) => (
                            <span
                              key={u.id}
                              className="slot-bar-segment"
                              style={{ backgroundColor: u.color }}
                            />
                          ))}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid-legend">
        <div className="grid-legend-items">
          <span className="legend-item">
            <span className="legend-swatch legend-swatch--mine" aria-hidden="true" />
            <span>Viền đậm: lịch bạn đã chọn</span>
          </span>
          <span className="legend-item">
            <span className="slot-count-badge" aria-hidden="true">
              2+
            </span>
            <span>Số người rảnh cùng khung giờ</span>
          </span>
        </div>
        <span>Di chuột vào ô đã tô để xem chi tiết</span>
      </div>
    </section>
  );
}
