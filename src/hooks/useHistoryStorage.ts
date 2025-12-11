import { useState, useCallback, useEffect } from 'react';
import { HistoryEntry, OverridesResponse } from '../types';
import { dataStore } from '../utils/DataStore';

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
    if (!newEntryData.overrides || newEntryData.overrides.length === 0 || 
        newEntryData.day === undefined || newEntryData.month === undefined || newEntryData.year === undefined) {
      console.log("History: Пропуск записи, нет замен или даты.", newEntryData);
      return;
    }

    // Создаем новую запись
    const newEntry: HistoryEntry = {
      ...newEntryData,
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