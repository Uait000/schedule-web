import { useLocalStorage } from './useLocalStorage';
import { getDayIndex, getWeekNumber, getCurrentDayIndex } from '../utils/dateUtils';
import { useEffect, useCallback, useState } from 'react';
import { addDays, getDay, startOfWeek } from 'date-fns';

const calculateDefaultState = () => {
  const today = new Date();
  const dayOfWeek = getDay(today);

  let targetDate = today;
  let targetDayIndex = getCurrentDayIndex();

  if (dayOfWeek === 6 || dayOfWeek === 0) {
    const daysToAdd = dayOfWeek === 6 ? 2 : 1;
    targetDate = startOfWeek(addDays(today, daysToAdd), { weekStartsOn: 1 });
    targetDayIndex = 0;
  }

  return {
    dayIndex: targetDayIndex,
    weekIndex: getWeekNumber(targetDate),
    date: targetDate
  };
};

export function useScheduleState() {
  // 🔥 Реактивное состояние для profileId
  const [profileId, setProfileId] = useState(() => localStorage.getItem('selectedId') || 'default');

  // 🔥 Следим за событием переключения профиля
  useEffect(() => {
    const handleProfileChange = () => {
      const newId = localStorage.getItem('selectedId') || 'default';
      if (newId !== profileId) {
        setProfileId(newId);
      }
    };

    window.addEventListener('profileChanged', handleProfileChange);
    window.addEventListener('storage', handleProfileChange);
    
    return () => {
      window.removeEventListener('profileChanged', handleProfileChange);
      window.removeEventListener('storage', handleProfileChange);
    };
  }, [profileId]);

  const defaults = calculateDefaultState();

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

  const setActiveDayIndexWithLimit = (value: number | ((val: number) => number)) => {
    const newValue = typeof value === 'function' ? value(activeDayIndex) : value;
    if (newValue > 4 || newValue < 0) return;
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

  const resetToToday = useCallback(() => {
    const current = calculateDefaultState();
    setActiveDayIndex(current.dayIndex);
    setActiveWeekIndex(current.weekIndex);
    setSelectedDate(current.date.toISOString());
  }, [setActiveDayIndex, setActiveWeekIndex, setSelectedDate]);

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
    };
    migrateOldData();
  }, [profileId]);

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