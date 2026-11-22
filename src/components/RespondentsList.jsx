import { useMemo } from 'react';

export function RespondentsList({
  users,
  currentUserId,
  weekIsoDates,
  hoveredSlot,
  highlightedUserId,
  onHighlightUser,
}) {
  const weekDateSet = useMemo(() => new Set(weekIsoDates), [weekIsoDates]);

  const hoveredUserIdSet = useMemo(() => {
    if (!hoveredSlot || !hoveredSlot.users?.length) return null;
    return new Set(hoveredSlot.users.map((u) => u.id));
  }, [hoveredSlot]);

  return (
    <section className="card sidebar-card" aria-labelledby="respondents-title">
      <h2 id="respondents-title" className="sidebar-card-title">
        <span>Thành viên</span>
        <span className="count-pill">{users.length}</span>
      </h2>

      {users.length === 0 ? (
        <div className="respondents-empty">
          Chưa có ai điền lịch. Nhập tên của bạn ở trên và kéo chọn khung giờ
          rảnh đầu tiên.
        </div>
      ) : (
        <>
          <ul className="respondents-list">
            {users.map((user) => {
              const weekSlotCount = user.slots.filter((slotKey) => {
                const [isoDate] = slotKey.split('_');
                return weekDateSet.has(isoDate);
              }).length;

              const isMatchedByHover = hoveredUserIdSet
                ? hoveredUserIdSet.has(user.id)
                : false;
              const isDimmedByHover = hoveredUserIdSet
                ? !isMatchedByHover
                : false;
              const isSelectedFilter = highlightedUserId === user.id;

              const itemClasses = [
                'respondent-item',
                isSelectedFilter ? 'respondent-item--active' : '',
                isMatchedByHover ? 'respondent-item--matched' : '',
                isDimmedByHover ? 'respondent-item--dimmed' : '',
              ]
                .filter(Boolean)
                .join(' ');

              return (
                <li key={user.id}>
                  <button
                    type="button"
                    className={itemClasses}
                    aria-pressed={isSelectedFilter}
                    onClick={() =>
                      onHighlightUser(isSelectedFilter ? null : user.id)
                    }
                    onMouseEnter={() => {
                      if (!highlightedUserId) onHighlightUser(user.id, true);
                    }}
                    onMouseLeave={() => {
                      if (!highlightedUserId) onHighlightUser(null, true);
                    }}
                  >
                    <span
                      className="color-dot"
                      style={{ backgroundColor: user.color }}
                      aria-hidden="true"
                    />
                    <span className="respondent-name">{user.name}</span>
                    {user.id === currentUserId && (
                      <span className="respondent-tag">Bạn</span>
                    )}
                    <span
                      className="respondent-count"
                      title="Số khung giờ rảnh trong tuần đang xem"
                    >
                      {weekSlotCount} ô
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="respondents-tip">
            Nhấn hoặc di chuột vào tên thành viên để lọc lịch riêng trên bảng.
          </p>
        </>
      )}
    </section>
  );
}
