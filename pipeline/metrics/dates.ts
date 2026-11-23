/** Date arithmetic on ISO dates (yyyy-mm-dd). No clock: every date is a parameter. */

const MS_PER_DAY = 86_400_000;

export function dayNumber(iso: string): number {
  return Math.round(Date.parse(`${iso}T00:00:00Z`) / MS_PER_DAY);
}

export function isoFromDayNumber(day: number): string {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return isoFromDayNumber(dayNumber(iso) + days);
}

export function minDate(a: string, b: string): string {
  return a <= b ? a : b;
}

export function maxDate(a: string, b: string): string {
  return a >= b ? a : b;
}

/** Days in [from, to], both included; 0 when the range is empty. */
export function daysInclusive(from: string, to: string): number {
  return from > to ? 0 : dayNumber(to) - dayNumber(from) + 1;
}

/** Days shared by two inclusive ranges. */
export function overlapDays(aFrom: string, aTo: string, bFrom: string, bTo: string): number {
  return daysInclusive(maxDate(aFrom, bFrom), minDate(aTo, bTo));
}

/** "yyyy-mm" of every month touched by [from, to]. */
export function monthsBetween(from: string, to: string): string[] {
  const months: string[] = [];
  let year = Number(from.slice(0, 4));
  let month = Number(from.slice(5, 7));
  const last = to.slice(0, 7);
  for (;;) {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    if (key > last) break;
    months.push(key);
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  return months;
}

export interface LegislaturaDates {
  inicio: string;
  /** Day of the dissolution; undefined while the legislature is running. */
  fin: string | undefined;
}

export interface PeriodWindow {
  /** First and last day, both included. */
  desde: string;
  hasta: string;
  dias: number;
}

/**
 * Window of a period as of `fechaCalculo`, clipped to the legislature. `dias`
 * undefined means the whole legislature. Returns undefined when nothing is left
 * (for example, "last month" after the legislature ended).
 */
export function periodWindow(
  dias: number | undefined,
  fechaCalculo: string,
  legislatura: LegislaturaDates,
): PeriodWindow | undefined {
  const hasta = legislatura.fin === undefined ? fechaCalculo : minDate(fechaCalculo, legislatura.fin);
  const desde =
    dias === undefined ? legislatura.inicio : maxDate(legislatura.inicio, addDays(fechaCalculo, -(dias - 1)));
  if (desde > hasta) return undefined;
  return { desde, hasta, dias: daysInclusive(desde, hasta) };
}
