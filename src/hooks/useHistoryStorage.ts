import { useState, useCallback, useEffect } from 'react';
import { HistoryEntry, OverridesResponse, Lesson } from '../types';
import { dataStore } from '../utils/DataStore';

// 🔥 Дублируем функцию normalizeLesson здесь
function normalizeLesson(lesson: any): Lesson {
  if (lesson == null || lesson === 'null' || (typeof lesson === 'object' && Object.keys(lesson).length === 0)) {
    return { noLesson: {} };
  }

  const findGroupAnywhere = (obj: any): string | undefined => {
    if (!obj) return undefined;
    if (typeof obj === 'string') return obj; 
    if (typeof obj !== 'object') return undefined;
    const candidates = ['group', 'Group', 'studentGroup', 'StudentGroup', 'className', 'targetGroup', 'target'];
    for (const key of candidates) {
        const val = obj[key];
        if (val) {
            if (typeof val === 'string' && val.trim().length > 0) return val;
            if (typeof val === 'object' && val.name) return val.name;
            if (typeof val === 'object' && val.group) return val.group;
        }
    }
    if (obj.CommonLesson) return findGroupAnywhere(obj.CommonLesson);
    if (obj.commonLesson) return findGroupAnywhere(obj.commonLesson);
    if (obj.willBe) return findGroupAnywhere(obj.willBe);
    return undefined;
  };

  const globalGroup = findGroupAnywhere(lesson);

  const common = lesson.CommonLesson || lesson.commonLesson;
  if (common) {
    const localGroup = findGroupAnywhere(common);
    return {
      commonLesson: {
        name: common.name || '',
        teacher: common.teacher || '',
        room: common.room || '',
        group: localGroup || globalGroup 
      }
    };
  }

  const subgrouped = lesson.SubgroupedLesson || lesson.subgroupedLesson;
  if (subgrouped) {
    return {
      subgroupedLesson: {
        name: subgrouped.name || '',
        subgroups: (subgrouped.subgroups || []).map((sub: any) => {
          const subLocalGroup = findGroupAnywhere(sub);
          return {
            teacher: sub.teacher || '',
            room: sub.room || '',
            subgroup_index: sub.subgroup_index || 0,
            group: subLocalGroup || globalGroup 
          };
        })
      }
    };
  }
  
  if (lesson.name || lesson.teacher || lesson.room) {
    if (lesson.subgroup_index !== undefined) {
      return {
        subgroupedLesson: {
          name: lesson.name || '',
          subgroups: [{
            teacher: lesson.teacher || '',
            room: lesson.room || '',
            subgroup_index: lesson.subgroup_index || 1,
            group: lesson.group || ''
          }]
        }
      };
    }
    return {
      commonLesson: {
        name: lesson.name || '',
        teacher: lesson.teacher || '',
        room: lesson.room || '',
        group: lesson.group || globalGroup
      }
    };
  }
  
  return { noLesson: {} };
}

export function useHistoryStorage(profileId: string | null) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const loadHistory = useCallback((pid: string) => {
    const fullHistory = dataStore.getState().overrideHistory;
    const profileHistory = fullHistory.filter(entry => entry.profileId === pid);
    // Сортируем: сначала новые (по timestamp)
    profileHistory.sort((a, b) => b.timestamp - a.timestamp);
    setHistory(profileHistory);
  }, []);

  // Добавление новой записи о заменах
  const addHistoryEntry = useCallback((newEntryData: OverridesResponse) => {
    if (!profileId) return;

    // Проверяем, что в записи есть дата и сами замены
    if (!newEntryData || !newEntryData.overrides || !Array.isArray(newEntryData.overrides) || newEntryData.overrides.length === 0) {
      console.log("History: Пропуск записи, нет замен.", newEntryData);
      return;
    }

    // Проверяем наличие даты
    if (newEntryData.day === undefined || newEntryData.month === undefined || newEntryData.year === undefined) {
      console.log("History: Пропуск записи, нет даты.", newEntryData);
      return;
    }

    // 🔥 ИСПРАВЛЕНО: нормализуем данные перед сохранением
    const normalizedEntryData = {
      ...newEntryData,
      overrides: newEntryData.overrides.map(override => ({
        ...override,
        shouldBe: override.shouldBe ? normalizeLesson(override.shouldBe) : { noLesson: {} },
        willBe: override.willBe ? normalizeLesson(override.willBe) : { noLesson: {} }
      }))
    };

    // Создаем новую запись
    const newEntry: HistoryEntry = {
      ...normalizedEntryData,
      profileId: profileId,
      timestamp: Date.now()
    };

    dataStore.addOverrideHistory(newEntry);
    
    // Обновляем локальное состояние
    const updatedHistory = [newEntry, ...history.filter(h => 
      !(h.profileId === profileId && 
        h.day === newEntryData.day && 
        h.month === newEntryData.month && 
        h.year === newEntryData.year)
    )];
    updatedHistory.sort((a, b) => b.timestamp - a.timestamp);
    
    setHistory(updatedHistory);
    
    console.log("✅ History: Добавлена новая запись.", newEntry);
  }, [profileId, history]);

  // Загружаем/обновляем историю при смене profileId
  useEffect(() => {
    if (profileId) {
      loadHistory(profileId);
    } else {
      setHistory([]);
    }
  }, [profileId, loadHistory]);

  return { history, addHistoryEntry };
}