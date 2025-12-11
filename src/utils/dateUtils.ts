import { getISOWeek, getDay } from 'date-fns';

export function getWeekNumber(date: Date): number {
  const weekOfYear = getISOWeek(date);
  return weekOfYear % 2 === 0 ? 0 : 1;
}

export function getDayIndex(date: Date): number {
  const day = getDay(date);
  // getDay возвращает: 0=воскресенье, 1=понедельник, 6=суббота
  // Мы хотим: 0=понедельник, 1=вторник, ..., 5=суббота
  return day === 0 ? 6 : day - 1; // 0(вс)->6, 1(пн)->0, 2(вт)->1, ..., 6(сб)->5
}

// 🔥 Функция для получения текущего дня недели (0-5)
export function getCurrentDayIndex(): number {
  const today = new Date();
  return getDayIndex(today);
}

// 🔥 Функция проверки, совпадает ли выбранный день с текущим
export function isCurrentDay(selectedDayIndex: number): boolean {
  const currentDayIndex = getCurrentDayIndex();
  return selectedDayIndex === currentDayIndex;
}