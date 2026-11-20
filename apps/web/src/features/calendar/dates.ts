export function dayKey(value: Date) {
  return `${String(value.getFullYear()).padStart(4, '0')}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}
export function addDays(value: Date, count: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + count);
  return next;
}
export function monthStart(value: Date) {
  const next = new Date(value);
  next.setDate(1);
  next.setHours(0, 0, 0, 0);
  return next;
}
export function monthGrid(value: Date) {
  const first = monthStart(value);
  const start = addDays(first, -((first.getDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}
export function overlapsDay(start: string, end: string, day: Date) {
  return Date.parse(start) < addDays(day, 1).getTime() && Date.parse(end) > day.getTime();
}
