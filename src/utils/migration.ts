import { dataStore } from './DataStore';
import { HistoryEntry } from '../types';
import { ProfileType } from '../types/profiles';

export function migrateOldDataToDataStore(): void {
  const currentState = dataStore.getState();
  
  console.log('🔄 Начинаем миграцию данных...');

  // Миграция профилей
  const oldProfiles = localStorage.getItem('profiles');
  if (oldProfiles) {
    try {
      const profiles = JSON.parse(oldProfiles);
      // Проверяем, есть ли смысл мигрировать (если в сторе пусто)
      const needMigration = (profiles.student && !currentState.profiles.student) || 
                            (profiles.teacher && !currentState.profiles.teacher);
      
      if (needMigration) {
        dataStore.updateData(state => ({
          ...state,
          profiles: { 
            ...state.profiles, 
            // Аккуратно объединяем, приоритет у существующих данных в Store (если они есть)
            student: state.profiles.student || profiles.student,
            teacher: state.profiles.teacher || profiles.teacher,
            lastUsed: state.profiles.lastUsed // Не перезаписываем текущий выбор
          }
        }));
        console.log('✅ Мигрированы старые профили');
        localStorage.removeItem('profiles');
      }
    } catch (e) {
      console.error('❌ Ошибка миграции профилей:', e);
    }
  }

  // Миграция истории замен
  const oldHistory = localStorage.getItem('replacementsHistory');
  if (oldHistory) {
    try {
      const historyData = JSON.parse(oldHistory);
      const allEntries: HistoryEntry[] = [];
      
      Object.entries(historyData).forEach(([profileId, entries]) => {
        if (Array.isArray(entries)) {
          (entries as any[]).forEach((entry: any) => {
            // Создаем корректную запись истории ОБЯЗАТЕЛЬНО с profileId
            const historyEntry: HistoryEntry = {
              profileId: profileId, // 🔥 Это поле критически важно
              timestamp: entry.timestamp || Date.now(),
              weekNum: entry.weekNum || 0,
              weekDay: entry.weekDay || 0,
              overrides: entry.overrides || [],
              day: entry.day,
              month: entry.month, 
              year: entry.year
            };
            allEntries.push(historyEntry);
          });
        }
      });
      
      if (allEntries.length > 0) {
        dataStore.updateData(state => ({
          ...state,
          // Добавляем старые записи в конец списка
          overrideHistory: [...state.overrideHistory, ...allEntries].slice(0, 50)
        }));
        console.log('✅ Мигрирована история замен:', allEntries.length);
        localStorage.removeItem('replacementsHistory');
      }
    } catch (e) {
      console.error('❌ Ошибка миграции истории:', e);
    }
  }

  // Миграция feedbackSent
  const oldFeedback = localStorage.getItem('feedbackSent');
  if (oldFeedback && !currentState.feedbackSent) {
    try {
      const feedbackSent = JSON.parse(oldFeedback);
      if (feedbackSent) {
        dataStore.updateData(state => ({ ...state, feedbackSent: true }));
        localStorage.removeItem('feedbackSent');
      }
    } catch (e) {}
  }

  // Миграция lastUsed
  const oldLastUsed = localStorage.getItem('userType');
  if (oldLastUsed && currentState.lastUsed === ProfileType.STUDENT) {
    const lastUsed = oldLastUsed as ProfileType;
    if (lastUsed === ProfileType.TEACHER) {
       dataStore.setLastUsed(ProfileType.TEACHER);
    }
  }

  console.log('🎉 Миграция завершена');
}