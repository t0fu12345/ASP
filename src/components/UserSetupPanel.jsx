import { Check, Palette, Trash2 } from 'lucide-react';
import { USER_COLORS } from '../constants/schedule';

export function UserSetupPanel({
  nameInputRef,
  nameError,
  onClearNameError,
  currentUser,
  weekSlotCount,
  onUpdateProfile,
  onClearWeek,
}) {
  const isPresetColor = USER_COLORS.some(
    (c) => c.hex.toLowerCase() === currentUser.color.toLowerCase(),
  );

  return (
    <section className="card sidebar-card" aria-labelledby="user-setup-title">
      <h2 id="user-setup-title" className="sidebar-card-title">
        <span>Thông tin của bạn</span>
        <span
          className="color-dot"
          style={{
            backgroundColor: currentUser.color,
            width: '14px',
            height: '14px',
          }}
          aria-hidden="true"
        />
      </h2>

      <div className="field-group">
        <label htmlFor="user-name-input" className="field-label">
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
            Tên và màu của bạn sẽ tự động đồng bộ cho cả nhóm.
          </p>
        )}
      </div>

      <div className="field-group">
        <span className="field-label">Màu đại diện</span>
        <div className="color-swatches" role="radiogroup" aria-label="Chọn màu đại diện">
          {USER_COLORS.map((swatch) => {
            const active =
              swatch.hex.toLowerCase() === currentUser.color.toLowerCase();
            return (
              <button
                key={swatch.hex}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={`Chọn màu ${swatch.name}`}
                title={swatch.name}
                className={`color-swatch-btn ${
                  active ? 'color-swatch-btn--active' : ''
                }`}
                style={{ backgroundColor: swatch.hex }}
                onClick={() => onUpdateProfile({ color: swatch.hex })}
              >
                {active && <Check size={16} strokeWidth={2.5} />}
              </button>
            );
          })}

          <label
            className="custom-color-label"
            title="Chọn màu tùy chỉnh"
            style={
              !isPresetColor
                ? {
                    backgroundColor: currentUser.color,
                    borderStyle: 'solid',
                    borderColor: 'var(--color-ink)',
                  }
                : undefined
            }
          >
            <Palette
              size={16}
              style={!isPresetColor ? { color: '#FFFFFF' } : undefined}
              aria-hidden="true"
            />
            <input
              type="color"
              className="custom-color-input"
              aria-label="Chọn mã màu tùy chỉnh"
              value={currentUser.color}
              onChange={(e) => onUpdateProfile({ color: e.target.value })}
            />
          </label>
        </div>
      </div>

      <div className="user-actions">
        <span className="user-slot-summary">
          Tuần này bạn đã chọn: <strong>{weekSlotCount}</strong> khung giờ
        </span>
        <button
          type="button"
          className="btn btn--danger-outline"
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
