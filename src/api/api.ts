// src/api/api.ts
import { InfoResponse } from '../types';

const API_BASE_URL = import.meta.env.DEV ? '/api' : 'https://schedulettgt.ru';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // Увеличим до суток для надежного офлайна

/**
 * 🔥 ГЕНЕРАТОР КЛЮЧЕЙ (Resilience Layer)
 * Гарантирует, что "КС-1-2", "кс-1-2" и "%D0%9A..." превратятся в один и тот же ключ.
 */
const makeKey = (type: 'schedule' | 'info' | 'items', id: string = '', date: string = '') => {
  const cleanId = decodeURIComponent(id).trim().toLowerCase();
  if (type === 'items') return 'api_items';
  if (type === 'schedule') return `api_schedule_${cleanId}`;
  return `api_info_${cleanId}_${date}`; // Ключ для замен на конкретную дату
};

async function fetchWithTimeout(resource: RequestInfo | URL, options: RequestInit & { timeout?: number } = {}) {
  const { timeout = 8000 } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(resource, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error: any) {
    clearTimeout(id);
    if (error.name === 'AbortError') throw new Error('Timeout: Сервер долго не отвечает');
    throw error;
  }
}

function getFromCache<T>(key: string, isOffline: boolean = false): T | null {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    const { data, timestamp } = JSON.parse(cached);
    // В офлайне игнорируем срок годности (CACHE_DURATION)
    if (!isOffline && (Date.now() - timestamp > CACHE_DURATION)) return null;
    console.log(`[API] Достали из кэша: ${key}`);
    return data;
  } catch { return null; }
}

function saveToCache(key: string, data: any): void {
  try {
    localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
  } catch (e) {
    console.warn("[API] Переполнение памяти, чистим старый кэш...");
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith('api_info_')) localStorage.removeItem(k);
    });
    try { localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() })); } catch(e2) {}
  }
}

export function normalizeLessonForApi(lesson: any): any {
  if (!lesson || lesson === 'null' || (typeof lesson === 'object' && Object.keys(lesson).length === 0)) return { noLesson: {} };
  if (lesson.commonLesson || lesson.subgroupedLesson || lesson.noLesson) return lesson;
  if (lesson.name || lesson.teacher || lesson.room) {
    return { commonLesson: { name: lesson.name || '', teacher: lesson.teacher || '', room: lesson.room || '', group: lesson.group || '' } };
  }
  return { noLesson: {} };
}

export const scheduleApi = {
  getItems: async () => {
    const key = makeKey('items');
    try {
      const response = await fetchWithTimeout(`${API_BASE_URL}/schedule/items`, { mode: 'cors' });
      const data = await response.json();
      saveToCache(key, data);
      return data;
    } catch (err) {
      return getFromCache<any>(key, true) || { groups: [], teachers: [] };
    }
  },

  getSchedule: async (id: string) => {
    const key = makeKey('schedule', id);
    try {
      const response = await fetchWithTimeout(`${API_BASE_URL}/schedule/${encodeURIComponent(id)}/schedule`, { mode: 'cors' });
      if (!response.ok) throw new Error(`Error: ${response.status}`);
      const data = await response.json();
      
      saveToCache(key, data);
      
      if (data.weeks) {
        data.weeks = data.weeks.map((week: any) => ({
          ...week,
          days: week.days.map((day: any) => ({ ...day, lessons: (day.lessons || []).map(normalizeLessonForApi) }))
        }));
      }
      return data;
    } catch (error) {
      const cached = getFromCache<any>(key, true);
      if (cached) {
        if (cached.weeks) {
          cached.weeks = cached.weeks.map((week: any) => ({
            ...week,
            days: week.days.map((day: any) => ({ ...day, lessons: (day.lessons || []).map(normalizeLessonForApi) }))
          }));
        }
        return cached;
      }
      throw error;
    }
  },

  getInfo: async (id: string, overridesDate: string, scheduleUpdate: number = 0, eventsHash: string = "") => {
    const params = new URLSearchParams({ overrides_date: overridesDate, schedule_update: scheduleUpdate.toString(), events_hash: eventsHash });
    const url = `${API_BASE_URL}/schedule/${encodeURIComponent(id)}/info?${params.toString()}`;
    const keyInfo = makeKey('info', id, overridesDate);
    const keySched = makeKey('schedule', id);

    try {
      const response = await fetchWithTimeout(url, { mode: 'cors' });
      if (!response.ok) throw new Error(`Status: ${response.status}`);
      const data = await response.json();

      saveToCache(keyInfo, data);
      // 🔥 МАГИЧЕСКИЙ ТРЮК: Если пришло расписание в info, сохраняем его как базу
      if (data.schedule) saveToCache(keySched, data.schedule);

      if (data.schedule?.weeks) {
        data.schedule.weeks = data.schedule.weeks.map((week: any) => ({
          ...week,
          days: week.days.map((day: any) => ({ ...day, lessons: (day.lessons || []).map(normalizeLessonForApi) }))
        }));
      }
      return data;
    } catch (error) {
      const cached = getFromCache<any>(keyInfo, true);
      if (cached) {
        if (cached.schedule?.weeks) {
          cached.schedule.weeks = cached.schedule.weeks.map((week: any) => ({
            ...week,
            days: week.days.map((day: any) => ({ ...day, lessons: (day.lessons || []).map(normalizeLessonForApi) }))
          }));
        }
        return cached; 
      }
      // Если нет замен, пробуем вернуть хотя бы чистое расписание
      return { schedule: getFromCache(keySched, true), overrides: null, events: [] };
    }
  },

  postRate: async (data: any) => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/schedule/rate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), mode: 'cors'
    });
    return response.json();
  }
};

// Хелпер для обратной совместимости с Welcome.tsx
export async function fetchData(endpoint: string): Promise<any> {
  const clean = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
  if (clean === 'items' || clean === 'schedule/items') return scheduleApi.getItems();
  
  const parts = clean.split('/');
  if (parts.length >= 2 && parts[parts.length - 1] === 'schedule') {
    return scheduleApi.getSchedule(parts[0]);
  }
  return scheduleApi.getItems();
}

export default scheduleApi;