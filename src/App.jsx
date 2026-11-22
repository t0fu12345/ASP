import { useCallback, useMemo, useRef, useState } from 'react';
import { Info, X } from 'lucide-react';
import { Header } from './components/Header';
import { RespondentsList } from './components/RespondentsList';
import { SlotTooltip } from './components/SlotTooltip';
import { UserSetupPanel } from './components/UserSetupPanel';
import { WeeklyGrid } from './components/WeeklyGrid';
import { addWeeks, getStartOfWeek, getWeekDays } from './constants/schedule';
import { useScheduleSync } from './hooks/useScheduleSync';

export default function App() {
  const {
    roomId,
    syncMode,
    syncStatus,
    users,
    currentUser,
    updateProfile,
    toggleSlots,
    clearMyWeekSlots,
    getShareUrl,
  } = useScheduleSync();

  const [weekStart, setWeekStart] = useState(() => getStartOfWeek(new Date()));
  const [hoveredSlot, setHoveredSlot] = useState(null);
  const [pinnedHighlightUserId, setPinnedHighlightUserId] = useState(null);
  const [hoverHighlightUserId, setHoverHighlightUserId] = useState(null);
  const [nameError, setNameError] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const nameInputRef = useRef(null);
  const toastTimerRef = useRef(null);

  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      setToastMessage('');
    }, 3200);
  }, []);

  const weekIsoDates = useMemo(
    () => getWeekDays(weekStart).map((d) => d.isoDate),
    [weekStart],
  );

  const myWeekSlotCount = useMemo(() => {
    const dateSet = new Set(weekIsoDates);
    return currentUser.slots.filter((slotKey) => {
      const [isoDate] = slotKey.split('_');
      return dateSet.has(isoDate);
    }).length;
  }, [currentUser.slots, weekIsoDates]);

  const handleRequireName = useCallback(() => {
    setNameError('Vui lòng nhập tên của bạn trước khi tô lịch.');
    nameInputRef.current?.focus();
    showToast('Nhập tên của bạn ở cột bên phải để bắt đầu tô lịch.');
  }, [showToast]);

  const handleCopyLink = useCallback(async () => {
    const shareUrl = getShareUrl();
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast(
        syncMode === 'firebase'
          ? 'Đã sao chép link phòng! Gửi cho bạn bè để cùng tô lịch realtime.'
          : 'Đã sao chép link kèm dữ liệu lịch hiện tại.',
      );
      return true;
    } catch {
      showToast('Không thể tự động sao chép, hãy copy URL trên thanh địa chỉ.');
      return false;
    }
  }, [getShareUrl, showToast, syncMode]);

  const handleClearWeek = useCallback(() => {
    clearMyWeekSlots(weekIsoDates);
    showToast('Đã xóa các khung giờ bạn chọn trong tuần này.');
  }, [clearMyWeekSlots, showToast, weekIsoDates]);

  const handleHighlightUser = useCallback((userId, isHoverOnly = false) => {
    if (isHoverOnly) {
      setHoverHighlightUserId(userId);
    } else {
      setPinnedHighlightUserId(userId);
      if (!userId) {
        setHoverHighlightUserId(null);
      }
    }
  }, []);

  const activeHighlightedUserId = pinnedHighlightUserId || hoverHighlightUserId;

  return (
    <div className="app-shell">
      <Header
        roomId={roomId}
        syncMode={syncMode}
        syncStatus={syncStatus}
        weekStart={weekStart}
        onPrevWeek={() => setWeekStart((prev) => addWeeks(prev, -1))}
        onTodayWeek={() => setWeekStart(getStartOfWeek(new Date()))}
        onNextWeek={() => setWeekStart((prev) => addWeeks(prev, 1))}
        onCopyLink={handleCopyLink}
      />

      {syncMode === 'local' && !bannerDismissed && (
        <div className="mode-banner" role="status">
          <div className="mode-banner-content">
            <Info size={18} className="mode-banner-icon" aria-hidden="true" />
            <span>
              Đang chạy ở <strong>Local Mode</strong> (tự đồng bộ giữa các tab trên cùng máy). Để đồng bộ realtime qua nhiều thiết bị khác nhau, hãy điền <code>VITE_FIREBASE_DATABASE_URL</code> vào file <code>.env</code> theo hướng dẫn trong <code>README.md</code>.
            </span>
          </div>
          <button
            type="button"
            className="btn btn--icon"
            aria-label="Đóng thông báo"
            onClick={() => setBannerDismissed(true)}
          >
            <X size={16} />
          </button>
        </div>
      )}

      <main className="main-layout">
        <WeeklyGrid
          weekStart={weekStart}
          users={users}
          currentUser={currentUser}
          highlightedUserId={activeHighlightedUserId}
          onToggleSlots={toggleSlots}
          onRequireName={handleRequireName}
          onHoverSlot={setHoveredSlot}
          onLeaveSlot={() => setHoveredSlot(null)}
        />

        <aside className="sidebar" aria-label="Cài đặt cá nhân và thành viên">
          <UserSetupPanel
            nameInputRef={nameInputRef}
            nameError={nameError}
            onClearNameError={() => setNameError('')}
            currentUser={currentUser}
            weekSlotCount={myWeekSlotCount}
            onUpdateProfile={updateProfile}
            onClearWeek={handleClearWeek}
          />

          <RespondentsList
            users={users}
            currentUserId={currentUser.id}
            weekIsoDates={weekIsoDates}
            hoveredSlot={hoveredSlot}
            highlightedUserId={pinnedHighlightUserId}
            onHighlightUser={handleHighlightUser}
          />
        </aside>
      </main>

      <SlotTooltip hoveredSlot={hoveredSlot} currentUserId={currentUser.id} />

      {toastMessage && (
        <div className="toast" role="status" aria-live="polite">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
