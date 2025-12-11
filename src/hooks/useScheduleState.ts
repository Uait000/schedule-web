import { useLocalStorage } from './useLocalStorage';
import { getDayIndex, getWeekNumber, getCurrentDayIndex } from '../utils/dateUtils';
import { useEffect, useCallback } from 'react';

// 🔥 ПРОСТАЯ И ПРАВИЛЬНАЯ ЛОГИКА: всегда показываем текущий день
const calculateDefaultState = () => {
  const today = new Date();
  
  return {
    dayIndex: getCurrentDayIndex(), // Текущий день недели (0-5)
    weekIndex: getWeekNumber(today), // Текущая неделя
    date: today // Сегодняшняя дата
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
    
    if (newValue > 5) {
      console.log('🚫 Достигнута суббота - свайп заблокирован');
      return;
    }
    if (newValue < 0) {
      console.log('🚫 Достигнут понедельник - свайп заблокирован');
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

  // 🔥 ПРОСТАЯ ФУНКЦИЯ СБРОСА: всегда на текущий день
  const resetToToday = useCallback(() => {
    const current = calculateDefaultState();
    console.log('🔄 Reset to today:', {
      dayIndex: current.dayIndex,
      dayName: ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'][current.dayIndex],
      date: current.date.toLocaleDateString('ru-RU')
    });
    setActiveDayIndex(current.dayIndex);
    setActiveWeekIndex(current.weekIndex);
    setSelectedDate(current.date.toISOString());
  }, [setActiveDayIndex, setActiveWeekIndex, setSelectedDate]);

  // Миграция данных
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

  // 🔥 ВАЖНО: При загрузке проверяем, не устарели ли данные
  useEffect(() => {
    const now = new Date();
    const currentState = calculateDefaultState();
    
    // Если в хранилище записан не сегодняшний день - сбрасываем
    if (activeDayIndex !== currentState.dayIndex) {
      console.log('🔄 Обнаружено несоответствие дня, сбрасываем на сегодня');
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