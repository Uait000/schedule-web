import { getDay, differenceInCalendarWeeks } from 'date-fns';
export function getWeekNumber(date: Date): number {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0 = Январь, 8 = Сентябрь
  let anchorDate: Date;
  if (month >= 8) {
    anchorDate = new Date(year, 8, 1);
  } else {
    anchorDate = new Date(year, 0, 1);
  }
  const weeksDiff = differenceInCalendarWeeks(date, anchorDate, { weekStartsOn: 1 });
  return Math.abs(weeksDiff % 2);
}
export function getDayIndex(date: Date): number {
  const day = getDay(date);
  return day === 0 ? 6 : day - 1;
}
export function getCurrentDayIndex(): number {
  return getDayIndex(new Date());
}
export function isCurrentDay(selectedDayIndex: number): boolean {
  return selectedDayIndex === getCurrentDayIndex();
}