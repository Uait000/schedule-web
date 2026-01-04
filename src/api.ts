// src/api.ts
import { InfoResponse } from './types';

const API_BASE_URL = 'https://schedulettgt.ru';
const CACHE_DURATION = 5 * 60 * 1000;

function getFromCache<T>(key: string): T | null {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp > CACHE_DURATION) return null;
    return data;
  } catch { return null; }
}

function saveToCache(key: string, data: any): void {
  try {
    localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
  } catch (e) { console.error(e); }
}

export function normalizeLessonForApi(lesson: any): any {
  if (!lesson || lesson === 'null' || (typeof lesson === 'object' && Object.keys(lesson).length === 0)) {
    return { noLesson: {} };
  }
  if (lesson.commonLesson || lesson.subgroupedLesson || lesson.noLesson) return lesson;
  
  if (lesson.name || lesson.teacher || lesson.room) {
    return {
      commonLesson: {
        name: lesson.name || '',
        teacher: lesson.teacher || '',
        room: lesson.room || '',
        group: lesson.group || ''
      }
    };
  }
  return { noLesson: {} };
}

export const scheduleApi = {
  getItems: async () => {
    const cacheKey = 'api_items';
    const cached = getFromCache<any>(cacheKey);
    if (cached) return cached;

    const response = await fetch(`${API_BASE_URL}/schedule/items`);
    const data = await response.json();
    saveToCache(cacheKey, data);
    return data;
  },

  getSchedule: async (id: string) => {
    const response = await fetch(`${API_BASE_URL}/schedule/${encodeURIComponent(id)}/schedule`);
    const data = await response.json();
    if (data.weeks) {
      data.weeks = data.weeks.map((week: any) => ({
        ...week,
        days: week.days.map((day: any) => ({
          ...day,
          lessons: (day.lessons || []).map(normalizeLessonForApi)
        }))
      }));
    }
    return data;
  },

  getInfo: async (id: string, overridesDate: string, scheduleUpdate: number = 0, eventsHash: string = "") => {
    const params = new URLSearchParams({
      overrides_date: overridesDate,
      schedule_update: scheduleUpdate.toString(),
      events_hash: eventsHash
    });
    const response = await fetch(`${API_BASE_URL}/schedule/${encodeURIComponent(id)}/info?${params.toString()}`);
    if (!response.ok) throw new Error(`Status: ${response.status}`);
    const data = await response.json();

    if (data.schedule?.weeks) {
      data.schedule.weeks = data.schedule.weeks.map((week: any) => ({
        ...week,
        days: week.days.map((day: any) => ({
          ...day,
          lessons: (day.lessons || []).map(normalizeLessonForApi)
        }))
      }));
    }
    return data;
  },

  postRate: async (data: any) => {
    const response = await fetch(`${API_BASE_URL}/schedule/rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return response.json();
  }
};

/**
 * 🔥 ФУНКЦИЯ ДЛЯ СОВМЕСТИМОСТИ (Welcome.tsx её требует)
 */
export async function fetchData(endpoint: string): Promise<any> {
  const clean = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
  
  if (clean === 'items') {
    return scheduleApi.getItems();
  }
  
  const parts = clean.split('/');
  if (parts.length >= 2 && parts[1] === 'schedule') {
    return scheduleApi.getSchedule(decodeURIComponent(parts[0]));
  }

  // Универсальный фолбэк для остальных запросов
  const response = await fetch(`${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`);
  return response.json();
}

export default scheduleApi;