import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
} from 'lucide-react';
import {
  TIME_SLOTS,
  formatMonthTitle,
  formatWeekRange,
  getHeatLevel,
  getWeekDays,
  makeSlotKey,
} from '../constants/schedule';

export function WeeklyGrid({
  weekStart,
  users,
  currentUser,
  highlightedUserId,
  interactionMode,
  isMobileViewport,
  onChangeInteractionMode,
  onPrevWeek,
  onTodayWeek,
  onNextWeek,
  onToggleSlots,
  onRequireName,
  onHoverSlot,
  onLeaveSlot,
  onInspectSlot,
  onInspectEmpty,
}) {
  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);
  const monthTitle = useMemo(() => formatMonthTitle(weekStart), [weekStart]);
  const weekRangeLabel = useMemo(() => formatWeekRange(weekStart), [weekStart]);

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

  const maxOverlapInWeek = useMemo(() => {
    let max = 0;
    for (const day of weekDays) {
      for (const slot of TIME_SLOTS) {
        const key = makeSlotKey(day.isoDate, slot.hour);
        const count = slotUsersMap.get(key)?.length || 0;
        if (count > max) max = count;
      }
    }
    return max;
  }, [slotUsersMap, weekDays]);

  const heatMaxCount = useMemo(
    () => Math.max(maxOverlapInWeek, Math.min(users.length, 5), 1),
    [maxOverlapInWeek, users.length],
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
        const { slotKey, day, slot, users: cellUsers, x, y, shouldSelect, mode } =
          touchStartRef.current;
        touchStartRef.current = null;
        const dist = Math.hypot(event.clientX - x, event.clientY - y);
        if (dist < 10) {
          if (mode === 'inspect') {
            if (cellUsers.length > 0) {
              onInspectSlot({ slotKey, day, slot, users: cellUsers });
            } else {
              onInspectEmpty?.();
            }
          } else {
            onToggleSlots([slotKey], shouldSelect);
          }
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
  }, [onInspectEmpty, onInspectSlot, onToggleSlots]);

  const effectiveMode = isMobileViewport ? interactionMode : 'paint';

  const handleCellPointerDown = (event, { slotKey, day, slot, displayUsers }) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    if (effectiveMode === 'inspect') {
      if (event.pointerType === 'touch') {
        touchStartRef.current = {
          slotKey,
          day,
          slot,
          users: displayUsers,
          x: event.clientX,
          y: event.clientY,
          mode: 'inspect',
        };
        return;
      }

      if (displayUsers.length > 0) {
        onInspectSlot({ slotKey, day, slot, users: displayUsers });
      } else {
        onInspectEmpty?.();
      }
      return;
    }

    if (!currentUser.name.trim()) {
      onRequireName();
      return;
    }

    onLeaveSlot();
    const isSelected = currentUserSlotSet.has(slotKey);
    const paintMode = isSelected ? 'remove' : 'add';

    if (event.pointerType === 'touch') {
      touchStartRef.current = {
        slotKey,
        day,
        slot,
        users: displayUsers,
        x: event.clientX,
        y: event.clientY,
        shouldSelect: paintMode === 'add',
        mode: 'paint',
      };
      return;
    }

    const visited = new Set([slotKey]);
    dragRef.current = { mode: paintMode, visited };
    setDragState({ mode: paintMode, visited: new Set(visited) });
  };

  const handleCellKeyDown = (event, { slotKey, day, slot, displayUsers }) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();

    if (effectiveMode === 'inspect') {
      if (displayUsers.length > 0) {
        onInspectSlot({ slotKey, day, slot, users: displayUsers });
      } else {
        onInspectEmpty?.();
      }
      return;
    }

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

  const handleSwitchMode = (nextMode) => {
    if (nextMode === interactionMode) return;
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(10);
    }
    onChangeInteractionMode(nextMode);
  };

  return (
    <section className="card weekly-grid-card" aria-label="Lịch rảnh theo tuần">
      <div className="grid-topbar">
        <div className="grid-title-group">
          <h2 className="grid-month-title">{monthTitle}</h2>
          <p className="grid-hint">
            {isMobileViewport
              ? effectiveMode === 'inspect'
                ? 'Chạm vào ô màu xanh để xem những ai rảnh.'
                : 'Chạm vào ô lịch để đánh dấu khung giờ rảnh (2 tiếng/ô).'
              : 'Nhấn hoặc kéo nhiều ô để tô giờ rảnh · Di chuột vào ô đã tô để xem chi tiết.'}
          </p>
        </div>

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
      </div>

      <div
        className="mobile-mode-switch"
        role="group"
        aria-label="Chế độ thao tác trên mobile"
      >
        <button
          type="button"
          className={`mode-switch-btn ${
            interactionMode === 'paint' ? 'mode-switch-btn--active' : ''
          }`}
          aria-pressed={interactionMode === 'paint'}
          onClick={() => handleSwitchMode('paint')}
        >
          <Pencil size={16} aria-hidden="true" />
          <span>Tô lịch</span>
        </button>
        <button
          type="button"
          className={`mode-switch-btn ${
            interactionMode === 'inspect' ? 'mode-switch-btn--active' : ''
          }`}
          aria-pressed={interactionMode === 'inspect'}
          onClick={() => handleSwitchMode('inspect')}
        >
          <Eye size={16} aria-hidden="true" />
          <span>Xem ai rảnh</span>
        </button>
      </div>

      <div className="calendar-scroll-frame">
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
                    const count = displayUsers.length;
                    const heatLevel = getHeatLevel(count, heatMaxCount);

                    const isHighlightedMatch =
                      highlightedUserId &&
                      displayUsers.some((u) => u.id === highlightedUserId);
                    const isDimmed =
                      Boolean(highlightedUserId) && !isHighlightedMatch;

                    const cellClasses = [
                      'slot-cell',
                      colIndex === 0 ? 'slot-cell--first-col' : '',
                      rowIndex === 0 ? 'slot-cell--first-row' : '',
                      heatLevel > 0 ? `slot-cell--heat-${heatLevel}` : '',
                      isHighlightedMatch ? 'slot-cell--highlighted' : '',
                      isDimmed ? 'slot-cell--dimmed' : '',
                    ]
                      .filter(Boolean)
                      .join(' ');

                    const namesList = displayUsers.map((u) => u.name).join(', ');
                    const ariaLabel =
                      count > 0
                        ? `${day.dayFull} ${day.dayNumber}/${day.monthNumber}, ${slot.range}, ${count} người rảnh: ${namesList}`
                        : `${day.dayFull} ${day.dayNumber}/${day.monthNumber}, ${slot.range}, chưa có người chọn`;

                    const handleShowTooltip = (event) => {
                      if (isMobileViewport || dragRef.current || count === 0) {
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
                        aria-label={ariaLabel}
                        aria-pressed={effectiveMode === 'paint' ? isMine : undefined}
                        onPointerDown={(e) =>
                          handleCellPointerDown(e, {
                            slotKey,
                            day,
                            slot,
                            displayUsers,
                          })
                        }
                        onKeyDown={(e) =>
                          handleCellKeyDown(e, {
                            slotKey,
                            day,
                            slot,
                            displayUsers,
                          })
                        }
                        onMouseEnter={handleShowTooltip}
                        onFocus={handleShowTooltip}
                        onMouseLeave={onLeaveSlot}
                        onBlur={onLeaveSlot}
                      >
                        {count >= 2 && (
                          <span className="slot-count-num">{count}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid-legend">
        <div className="grid-legend-items">
          <div className="heatmap-legend" aria-label="Thang mức độ trùng lịch">
            <span className="heatmap-legend-text">Ít người</span>
            <div className="heatmap-legend-scale" aria-hidden="true">
              <span className="heatmap-swatch heatmap-swatch--1" />
              <span className="heatmap-swatch heatmap-swatch--2" />
              <span className="heatmap-swatch heatmap-swatch--3" />
              <span className="heatmap-swatch heatmap-swatch--4" />
              <span className="heatmap-swatch heatmap-swatch--5" />
            </div>
            <span className="heatmap-legend-text">Nhiều người</span>
          </div>
        </div>
      </div>
    </section>
  );
}
