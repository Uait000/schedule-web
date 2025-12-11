import { useState, useEffect, useCallback } from 'react';
import { getDayIndex, getWeekNumber } from '../utils/dateUtils';

// 🔥 ИСПРАВЛЕННАЯ ЛОГИКА: Всегда остаемся на текущей неделе
const calculateDefaultState = () => {
  const today = new Date();
  const todayDayIndex = getDayIndex(today);

  // 🔥 ВРЕМЕННОЕ ИСПРАВЛЕНИЕ: В выходные НЕ переключаем на след. неделю
  // Оставляем текущий день и текущую неделю
  if (todayDayIndex === 5 || todayDayIndex === 6) {
    return {
      dayIndex: todayDayIndex, // Оставляем текущий день (сб/вс)
      weekIndex: 0, // 🔥 ВСЕГДА первая неделя вместо getWeekNumber(today)
      date: today
    };
  }

  return {
    dayIndex: todayDayIndex,
    weekIndex: 0, // 🔥 ВСЕГДА первая неделя вместо getWeekNumber(today)
    date: today
  };
};

export function useScheduleStateFixed() {
  const getCurrentProfileId = (): string => {
    return localStorage.getItem('selectedId') || 'default';
  };

  const profileId = getCurrentProfileId();
  const defaults = calculateDefaultState();

  const getStoredValue = <T,>(key: string, defaultValue: T): T => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      return defaultValue;
    }
  };

  const setStoredValue = useCallback(<T,>(key: string, value: T) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }, []);

  const [activeDayIndex, setActiveDayIndexState] = useState(() => 
    getStoredValue(`schedule-active-day-${profileId}`, defaults.dayIndex)
  );

  const [activeWeekIndex, setActiveWeekIndexState] = useState(() => 
    getStoredValue(`schedule-active-week-${profileId}`, defaults.weekIndex)
  );

  const [applyOverrides, setApplyOverridesState] = useState(() => 
    getStoredValue(`applyOverrides-${profileId}`, true)
  );

  const [selectedDate, setSelectedDateState] = useState(() => {
    const stored = getStoredValue(`selected-date-${profileId}`, defaults.date.toISOString());
    return new Date(stored);
  });

  const [scrollPosition, setScrollPositionState] = useState(() => 
    getStoredValue(`scroll-position-${profileId}`, 0)
  );

  const [subgroups, setSubgroupsState] = useState<Record<string, number>>(() => 
    getStoredValue(`subgroups-${profileId}`, {})
  );

  // Обертки для set функций
  const setActiveDayIndex = useCallback((value: number | ((val: number) => number)) => {
    setActiveDayIndexState(prev => {
      const newValue = typeof value === 'function' ? value(prev) : value;
      setStoredValue(`schedule-active-day-${profileId}`, newValue);
      return newValue;
    });
  }, [profileId, setStoredValue]);

  const setActiveWeekIndex = useCallback((value: number | ((val: number) => number)) => {
    setActiveWeekIndexState(prev => {
      const newValue = typeof value === 'function' ? value(prev) : value;
      setStoredValue(`schedule-active-week-${profileId}`, newValue);
      return newValue;
    });
  }, [profileId, setStoredValue]);

  const setApplyOverrides = useCallback((value: boolean | ((val: boolean) => boolean)) => {
    setApplyOverridesState(prev => {
      const newValue = typeof value === 'function' ? value(prev) : value;
      setStoredValue(`applyOverrides-${profileId}`, newValue);
      return newValue;
    });
  }, [profileId, setStoredValue]);

  const setSelectedDate = useCallback((value: Date | ((val: Date) => Date)) => {
    setSelectedDateState(prev => {
      const newValue = typeof value === 'function' ? value(prev) : value;
      setStoredValue(`selected-date-${profileId}`, newValue.toISOString());
      return newValue;
    });
  }, [profileId, setStoredValue]);

  const setScrollPosition = useCallback((value: number | ((val: number) => number)) => {
    setScrollPositionState(prev => {
      const newValue = typeof value === 'function' ? value(prev) : value;
      setStoredValue(`scroll-position-${profileId}`, newValue);
      return newValue;
    });
  }, [profileId, setStoredValue]);

  const setSubgroup = useCallback((lessonKey: string, subgroup: number) => {
    setSubgroupsState(prev => {
      const newSubgroups = { ...prev, [lessonKey]: subgroup };
      setStoredValue(`subgroups-${profileId}`, newSubgroups);
      return newSubgroups;
    });
  }, [profileId, setStoredValue]);

  const getSubgroup = useCallback((lessonKey: string): number => {
    return subgroups[lessonKey] || 0;
  }, [subgroups]);

  // ❗️ НОВАЯ ФУНКЦИЯ: Сброс на текущий день
  const resetToToday = useCallback(() => {
    const current = calculateDefaultState();
    setActiveDayIndexState(current.dayIndex);
    setStoredValue(`schedule-active-day-${profileId}`, current.dayIndex);

    setActiveWeekIndexState(current.weekIndex);
    setStoredValue(`schedule-active-week-${profileId}`, current.weekIndex);

    setSelectedDateState(current.date);
    setStoredValue(`selected-date-${profileId}`, current.date.toISOString());
  }, [profileId, setStoredValue]);

  // Миграция
  useEffect(() => {
    if (profileId === 'default') return;
    const oldKeys = ['schedule-active-day', 'schedule-active-week', 'applyOverrides'];
    oldKeys.forEach(key => {
      const oldValue = localStorage.getItem(key);
      if (oldValue) {
        const newKey = `${key}-${profileId}`;
        if (!localStorage.getItem(newKey)) localStorage.setItem(newKey, oldValue);
        localStorage.removeItem(key);
      }
    });
  }, [profileId]);

  return {
    activeDayIndex, setActiveDayIndex,
    activeWeekIndex, setActiveWeekIndex,
    applyOverrides, setApplyOverrides,
    selectedDate, setSelectedDate,
    scrollPosition, setScrollPosition,
    subgroups, setSubgroup, getSubgroup,
    resetToToday // Экспорт функции
  };
}