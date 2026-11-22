export const TIME_SLOTS = [
  { hour: 6, label: '06:00', endLabel: '08:00', range: '06:00 – 08:00' },
  { hour: 8, label: '08:00', endLabel: '10:00', range: '08:00 – 10:00' },
  { hour: 10, label: '10:00', endLabel: '12:00', range: '10:00 – 12:00' },
  { hour: 12, label: '12:00', endLabel: '14:00', range: '12:00 – 14:00' },
  { hour: 14, label: '14:00', endLabel: '16:00', range: '14:00 – 16:00' },
  { hour: 16, label: '16:00', endLabel: '18:00', range: '16:00 – 18:00' },
  { hour: 18, label: '18:00', endLabel: '20:00', range: '18:00 – 20:00' },
  { hour: 20, label: '20:00', endLabel: '22:00', range: '20:00 – 22:00' },
  { hour: 22, label: '22:00', endLabel: '24:00', range: '22:00 – 24:00' },
];

export const USER_COLORS = [
  { hex: '#10B981', name: 'Xanh lá' },
  { hex: '#3B82F6', name: 'Xanh dương' },
  { hex: '#F97316', name: 'Cam san hô' },
  { hex: '#8B5CF6', name: 'Tím' },
  { hex: '#EC4899', name: 'Hồng' },
  { hex: '#F59E0B', name: 'Vàng hổ phách' },
  { hex: '#14B8A6', name: 'Xanh ngọc' },
  { hex: '#6366F1', name: 'Chàm' },
  { hex: '#EF4444', name: 'Đỏ' },
  { hex: '#475569', name: 'Xám đá' },
];

const DAY_META = [
  { short: 'T2', full: 'Thứ 2' },
  { short: 'T3', full: 'Thứ 3' },
  { short: 'T4', full: 'Thứ 4' },
  { short: 'T5', full: 'Thứ 5' },
  { short: 'T6', full: 'Thứ 6' },
  { short: 'T7', full: 'Thứ 7' },
  { short: 'CN', full: 'Chủ Nhật' },
];

function toLocalIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getStartOfWeek(date = new Date()) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayOfWeek = copy.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  copy.setDate(copy.getDate() + diffToMonday);
  return copy;
}

export function addWeeks(date, delta) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() + delta * 7);
  return copy;
}

export function getWeekDays(weekStart) {
  const todayIso = toLocalIsoDate(new Date());
  return DAY_META.map((meta, index) => {
    const dayDate = new Date(
      weekStart.getFullYear(),
      weekStart.getMonth(),
      weekStart.getDate() + index,
    );
    const isoDate = toLocalIsoDate(dayDate);
    return {
      date: dayDate,
      isoDate,
      dayShort: meta.short,
      dayFull: meta.full,
      dayNumber: dayDate.getDate(),
      monthNumber: dayDate.getMonth() + 1,
      isToday: isoDate === todayIso,
    };
  });
}

export function formatWeekRange(weekStart) {
  const weekEnd = new Date(
    weekStart.getFullYear(),
    weekStart.getMonth(),
    weekStart.getDate() + 6,
  );
  const startDay = String(weekStart.getDate()).padStart(2, '0');
  const startMonth = String(weekStart.getMonth() + 1).padStart(2, '0');
  const endDay = String(weekEnd.getDate()).padStart(2, '0');
  const endMonth = String(weekEnd.getMonth() + 1).padStart(2, '0');
  const endYear = weekEnd.getFullYear();

  if (weekStart.getFullYear() !== endYear) {
    return `${startDay}/${startMonth}/${weekStart.getFullYear()} – ${endDay}/${endMonth}/${endYear}`;
  }
  return `${startDay}/${startMonth} – ${endDay}/${endMonth}/${endYear}`;
}

export function formatMonthTitle(weekStart) {
  const weekEnd = new Date(
    weekStart.getFullYear(),
    weekStart.getMonth(),
    weekStart.getDate() + 6,
  );
  const startMonth = weekStart.getMonth() + 1;
  const endMonth = weekEnd.getMonth() + 1;
  const startYear = weekStart.getFullYear();
  const endYear = weekEnd.getFullYear();

  if (startMonth === endMonth && startYear === endYear) {
    return `Tháng ${startMonth}, ${startYear}`;
  }
  if (startYear === endYear) {
    return `Tháng ${startMonth} – ${endMonth}, ${startYear}`;
  }
  return `Tháng ${startMonth}/${startYear} – Tháng ${endMonth}/${endYear}`;
}

export function makeSlotKey(isoDate, hour) {
  return `${isoDate}_${String(hour).padStart(2, '0')}`;
}

export function hexToRgba(hex, alpha = 0.16) {
  if (typeof hex !== 'string') return `rgba(37, 99, 235, ${alpha})`;
  const cleaned = hex.replace('#', '').trim();
  const full =
    cleaned.length === 3
      ? cleaned
          .split('')
          .map((ch) => ch + ch)
          .join('')
      : cleaned;

  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    return `rgba(37, 99, 235, ${alpha})`;
  }

  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
