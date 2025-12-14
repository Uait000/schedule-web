import { useLocalStorage } from './useLocalStorage';
import { getDayIndex, getWeekNumber, getCurrentDayIndex } from '../utils/dateUtils';
import { useEffect, useCallback } from 'react';
import { addDays, getDay, startOfWeek } from 'date-fns';

// 🔥 ОБНОВЛЕННАЯ ЛОГИКА:
// 1. Если сегодня Суббота (6) или Воскресенье (0) -> ставим дату на ближайший Понедельник.
// 2. Вычисляем неделю именно от этой "целевой" даты (то есть следующей).
const calculateDefaultState = () => {
  const today = new Date();
  const dayOfWeek = getDay(today); // 0 = Вс, 1 = Пн, ..., 6 = Сб

  let targetDate = today;
  let targetDayIndex = getCurrentDayIndex();

  // Если Суббота или Воскресенье
  if (dayOfWeek === 6 || dayOfWeek === 0) {
    // Если Сб, добавляем 2 дня, если Вс - 1 день, чтобы попасть на Пн
    const daysToAdd = dayOfWeek === 6 ? 2 : 1;
    targetDate = startOfWeek(addDays(today, daysToAdd), { weekStartsOn: 1 });
    targetDayIndex = 0; // Понедельник
  }

  return {
    dayIndex: targetDayIndex, // Будет 0 (Пн) в выходные
    weekIndex: getWeekNumber(targetDate), // Номер недели берем от targetDate (след. недели в вых)
    date: targetDate
  };
};

export function useScheduleState() {
  const getCurrentProfileId = (): string => {
    return localStorage.getItem('selectedId') || 'default';
  };

  const profileId = getCurrentProfileId();
  const defaults = calculateDefaultState();

  // Состояния с привязкой к профилю
  const [activeDayIndex, setActiveDayIndex] = useLocalStorage(
    `schedule-active-day-${profileId}`,
    defaults.dayIndex
  );

  const [activeWeekIndex, setActiveWeekIndex] = useLocalStorage(
    `schedule-active-week-${profileId}`,
    defaults.weekIndex
  );

  const [applyOverrides, setApplyOverrides] = useLocalStorage(
    `applyOverrides-${profileId}`,
    true
  );

  const [selectedDate, setSelectedDate] = useLocalStorage(
    `selected-date-${profileId}`,
    defaults.date.toISOString()
  );

  // Ограничение свайпа
  const setActiveDayIndexWithLimit = (value: number | ((val: number) => number)) => {
    const newValue = typeof value === 'function' ? value(activeDayIndex) : value;
    
    // Блокируем выход за границы Пн-Пт
    if (newValue > 4) { // Исправил на 4 (Пятница), так как сб/вс скрыты
      return;
    }
    if (newValue < 0) {
      return;
    }
    setActiveDayIndex(newValue);
  };

  const setActiveWeekIndexWithSave = (value: number | ((val: number) => number)) => {
    setActiveWeekIndex(value);
  };

  const setApplyOverridesWithSave = (value: boolean | ((val: boolean) => boolean)) => {
    setApplyOverrides(value);
  };

  const setSelectedDateWithSave = (value: Date | ((val: Date) => Date)) => {
    if (value instanceof Date) {
      setSelectedDate(value.toISOString());
    } else {
      const newDate = value(new Date(selectedDate));
      setSelectedDate(newDate.toISOString());
    }
  };

  // 🔥 ФУНКЦИЯ СБРОСА: Теперь учитывает логику "Выходные -> Понедельник"
  const resetToToday = useCallback(() => {
    const current = calculateDefaultState();
    
    setActiveDayIndex(current.dayIndex);
    setActiveWeekIndex(current.weekIndex);
    setSelectedDate(current.date.toISOString());
  }, [setActiveDayIndex, setActiveWeekIndex, setSelectedDate]);

  // Миграция данных (без изменений)
  useEffect(() => {
    const migrateOldData = () => {
      if (profileId === 'default') return;
      const oldKeys = ['schedule-active-day', 'schedule-active-week', 'applyOverrides'];
      oldKeys.forEach(key => {
        const oldValue = localStorage.getItem(key);
        if (oldValue) {
          const newKey = `${key}-${profileId}`;
          if (!localStorage.getItem(newKey)) {
            localStorage.setItem(newKey, oldValue);
          }
          localStorage.removeItem(key);
        }
      });
      const oldDate = localStorage.getItem('selected-date');
      if (oldDate) {
        const newDateKey = `selected-date-${profileId}`;
        if (!localStorage.getItem(newDateKey)) {
          localStorage.setItem(newDateKey, oldDate);
        }
        localStorage.removeItem('selected-date');
      }
    };
    migrateOldData();
  }, [profileId]);

  // Проверка актуальности при загрузке
  useEffect(() => {
    const currentState = calculateDefaultState();
    
    // Если сохраненный день отличается от расчетного (например, наступила суббота,
    // а сохранен был старый день), делаем сброс.
    // Добавлена проверка даты, чтобы не сбрасывать, если пользователь просто гуляет по расписанию внутри недели
    const savedDate = new Date(selectedDate);
    const isSavedDateWeekend = getDay(savedDate) === 0 || getDay(savedDate) === 6;

    if (isSavedDateWeekend) {
        // Если вдруг сохранена суббота/воскресенье - принудительно сбрасываем
        resetToToday();
    }
  }, []);

  return {
    activeDayIndex,
    setActiveDayIndex: setActiveDayIndexWithLimit,
    activeWeekIndex, 
    setActiveWeekIndex: setActiveWeekIndexWithSave,
    applyOverrides,
    setApplyOverrides: setApplyOverridesWithSave,
    selectedDate: new Date(selectedDate),
    setSelectedDate: setSelectedDateWithSave,
    resetToToday
  };
}