import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Info, X } from 'lucide-react';
import { Header } from './components/Header';
import { RespondentsList } from './components/RespondentsList';
import { SlotEffectsOverlay } from './components/SlotEffectsOverlay';
import { SlotBottomSheet, SlotTooltip } from './components/SlotTooltip';
import { UserSetupPanel } from './components/UserSetupPanel';
import { WeeklyGrid } from './components/WeeklyGrid';
import {
  ANIMATION_EFFECTS,
  addWeeks,
  getStartOfWeek,
  getWeekDays,
} from './constants/schedule';
import { useScheduleSync } from './hooks/useScheduleSync';

const MOBILE_QUERY = '(max-width: 960px)';
const FX_STORAGE_KEY = 'timescheduling_fx';

function getInitialIsMobile() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(MOBILE_QUERY).matches;
}

function getInitialEffectStyle() {
  try {
    const saved = localStorage.getItem(FX_STORAGE_KEY);
    if (saved && ANIMATION_EFFECTS.some((item) => item.id === saved)) {
      return saved;
    }
  } catch {
    // Ignore storage read error
  }
  return 'slash';
}

export default function App() {
  const {
    roomId,
    syncMode,
    users,
    currentUser,
    updateProfile,
    toggleSlots,
    clearMyWeekSlots,
    getShareUrl,
  } = useScheduleSync();

  const [weekStart, setWeekStart] = useState(() => getStartOfWeek(new Date()));
  const [hoveredSlot, setHoveredSlot] = useState(null);
  const [inspectedSlot, setInspectedSlot] = useState(null);
  const [interactionMode, setInteractionMode] = useState('paint');
  const [effectStyle, setEffectStyle] = useState(getInitialEffectStyle);
  const [isMobileViewport, setIsMobileViewport] = useState(getInitialIsMobile);
  const [pinnedHighlightUserId, setPinnedHighlightUserId] = useState(null);
  const [hoverHighlightUserId, setHoverHighlightUserId] = useState(null);
  const [nameError, setNameError] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const nameInputRef = useRef(null);
  const toastTimerRef = useRef(null);
  const effectsRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mql = window.matchMedia(MOBILE_QUERY);
    const handleChange = (event) => {
      setIsMobileViewport(event.matches);
      if (!event.matches) {
        setInspectedSlot(null);
      }
    };
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);

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
    showToast('Nhập tên của bạn trước khi đánh dấu giờ rảnh.');
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

  const handleChangeWeek = useCallback((updater) => {
    setInspectedSlot(null);
    setHoveredSlot(null);
    setWeekStart(updater);
  }, []);

  const handleChangeInteractionMode = useCallback((nextMode) => {
    setInteractionMode(nextMode);
    if (nextMode === 'paint') {
      setInspectedSlot(null);
    }
  }, []);

  const handleInspectEmpty = useCallback(() => {
    showToast('Khung giờ này chưa có ai chọn.');
  }, [showToast]);

  const handleChangeEffectStyle = useCallback((nextStyle) => {
    setEffectStyle(nextStyle);
    try {
      localStorage.setItem(FX_STORAGE_KEY, nextStyle);
    } catch {
      // Ignore storage write error
    }
  }, []);

  const activeHighlightedUserId = pinnedHighlightUserId || hoverHighlightUserId;

  return (
    <div className="app-shell">
      <Header
        roomId={roomId}
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
        <div className="layout-grid">
          <WeeklyGrid
            weekStart={weekStart}
            users={users}
            currentUser={currentUser}
            highlightedUserId={activeHighlightedUserId}
            interactionMode={interactionMode}
            isMobileViewport={isMobileViewport}
            effectsRef={effectsRef}
            onChangeInteractionMode={handleChangeInteractionMode}
            onPrevWeek={() => handleChangeWeek((prev) => addWeeks(prev, -1))}
            onTodayWeek={() => handleChangeWeek(getStartOfWeek(new Date()))}
            onNextWeek={() => handleChangeWeek((prev) => addWeeks(prev, 1))}
            onToggleSlots={toggleSlots}
            onRequireName={handleRequireName}
            onHoverSlot={setHoveredSlot}
            onLeaveSlot={() => setHoveredSlot(null)}
            onInspectSlot={setInspectedSlot}
            onInspectEmpty={handleInspectEmpty}
          />
        </div>

        <div className="layout-setup">
          <UserSetupPanel
            nameInputRef={nameInputRef}
            nameError={nameError}
            onClearNameError={() => setNameError('')}
            currentUser={currentUser}
            weekSlotCount={myWeekSlotCount}
            effectStyle={effectStyle}
            onChangeEffectStyle={handleChangeEffectStyle}
            onUpdateProfile={updateProfile}
            onClearWeek={handleClearWeek}
          />
        </div>

        <div className="layout-respondents">
          <RespondentsList
            users={users}
            currentUserId={currentUser.id}
            weekIsoDates={weekIsoDates}
            hoveredSlot={hoveredSlot}
            highlightedUserId={pinnedHighlightUserId}
            onHighlightUser={handleHighlightUser}
          />
        </div>
      </main>

      {!isMobileViewport ? (
        <SlotTooltip
          hoveredSlot={hoveredSlot}
          currentUserId={currentUser.id}
          totalUsers={users.length}
        />
      ) : (
        <SlotBottomSheet
          inspectedSlot={inspectedSlot}
          currentUserId={currentUser.id}
          totalUsers={users.length}
          onClose={() => setInspectedSlot(null)}
        />
      )}

      <SlotEffectsOverlay ref={effectsRef} effectStyle={effectStyle} />

      {toastMessage && (
        <div className="toast" role="status" aria-live="polite">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
