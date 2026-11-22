import { Trash2 } from 'lucide-react';

export function UserSetupPanel({
  nameInputRef,
  nameError,
  onClearNameError,
  currentUser,
  weekSlotCount,
  onUpdateProfile,
  onClearWeek,
}) {
  return (
    <section
      className="card sidebar-card user-setup-card"
      aria-labelledby="user-setup-title"
    >
      <div className="sidebar-card-title">
        <h2 id="user-setup-title" className="sidebar-card-heading">
          Tên của bạn
        </h2>
        <span className="count-pill" title="Số ô bạn đã chọn trong tuần này">
          {weekSlotCount} ô tuần này
        </span>
      </div>

      <div className="setup-controls-row">
        <div className="field-group field-group--compact">
          <label htmlFor="user-name-input" className="field-label sr-only-mobile">
            Tên hiển thị *
          </label>
          <input
            ref={nameInputRef}
            id="user-name-input"
            type="text"
            maxLength={32}
            placeholder="Nhập tên của bạn (vd: Minh)"
            className={`text-input ${nameError ? 'text-input--error' : ''}`}
            value={currentUser.name}
            aria-invalid={Boolean(nameError)}
            aria-describedby={nameError ? 'user-name-error' : 'user-name-helper'}
            onChange={(e) => {
              if (nameError && e.target.value.trim()) {
                onClearNameError();
              }
              onUpdateProfile({ name: e.target.value });
            }}
          />
          {nameError ? (
            <p id="user-name-error" className="field-error" role="alert">
              {nameError}
            </p>
          ) : (
            <p id="user-name-helper" className="field-helper">
              Nhập tên xong, nhấn hoặc kéo trên lịch để đánh dấu giờ rảnh.
            </p>
          )}
        </div>

        <button
          type="button"
          className="btn btn--danger-outline btn--clear-week"
          disabled={weekSlotCount === 0}
          onClick={onClearWeek}
        >
          <Trash2 size={15} aria-hidden="true" />
          <span>Xóa lịch tuần này</span>
        </button>
      </div>
    </section>
  );
}
