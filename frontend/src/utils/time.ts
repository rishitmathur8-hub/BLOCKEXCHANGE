/**
 * Utilities for 24-Hour Indian Standard Time (IST) operations.
 * Backend stores day time as integer minutes from midnight (0 to 1439).
 */

export function fmtMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || isNaN(minutes)) {
    return '--:--';
  }
  const m = Math.round(minutes);
  const hrs = Math.floor(m / 60) % 24;
  const mins = m % 60;
  const nextDay = m >= 1440 ? ' (+1d)' : '';
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}${nextDay}`;
}

export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [hrs, mins] = timeStr.split(':').map(Number);
  if (isNaN(hrs) || isNaN(mins)) return 0;
  return hrs * 60 + mins;
}

export function minutesToTimeString(minutes: number): string {
  const m = Math.max(0, Math.round(minutes)) % 1440;
  const hrs = Math.floor(m / 60);
  const mins = m % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export function getNowMinute(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

export function formatDuration(durationMinutes: number): string {
  if (durationMinutes < 60) {
    return `${durationMinutes}m`;
  }
  const hrs = Math.floor(durationMinutes / 60);
  const mins = durationMinutes % 60;
  return mins === 0 ? `${hrs}h` : `${hrs}h ${mins}m`;
}

export function formatDateTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour12: false,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}
