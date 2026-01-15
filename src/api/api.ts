// src/api.ts
import { InfoResponse } from '../types';

// 🔥 СОВЕТ: Если работаешь локально, используй http://127.0.0.1:8000
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

    try {
        const response = await fetch(`${API_BASE_URL}/schedule/items`, {
            mode: 'cors',
            credentials: 'include'
        });
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        const data = await response.json();
        saveToCache(cacheKey, data);
        return data;
    } catch (err) {
        console.error("Fetch items failed:", err);
        throw err;
    }
  },

  getSchedule: async (id: string) => {
    const response = await fetch(`${API_BASE_URL}/schedule/${encodeURIComponent(id)}/schedule`, {
        mode: 'cors',
        credentials: 'include'
    });
    if (!response.ok) throw new Error(`Schedule fetch error: ${response.status}`);
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
    const response = await fetch(`${API_BASE_URL}/schedule/${encodeURIComponent(id)}/info?${params.toString()}`, {
        mode: 'cors',
        credentials: 'include'
    });
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
      body: JSON.stringify(data),
      mode: 'cors',
      credentials: 'include'
    });
    return response.json();
  },

  subscribePush: async (subscription: any, itemName: string, active: boolean = true) => {
    const response = await fetch(`${API_BASE_URL}/schedule/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        subscription, 
        item_name: itemName,
        active: active 
      }),
      mode: 'cors',
      credentials: 'include'
    });
    if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Subscription failed: ${errorData}`);
    }
    return response.json();
  }
};

export async function fetchData(endpoint: string): Promise<any> {
  const clean = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
  
  if (clean === 'items' || clean === 'schedule/items') {
    return scheduleApi.getItems();
  }
  
  const parts = clean.split('/');
  if (parts.length >= 2 && parts[parts.length - 1] === 'schedule') {
    const id = parts.slice(0, parts.length - 1).join('/');
    return scheduleApi.getSchedule(decodeURIComponent(id));
  }

  let finalUrl = '';
  if (clean.startsWith('schedule/')) {
      finalUrl = `${API_BASE_URL}/${clean}`;
  } else {
      finalUrl = `${API_BASE_URL}/schedule/${clean}`;
  }

  try {
    const response = await fetch(finalUrl, { mode: 'cors', credentials: 'include' });
    if (!response.ok) {
        const fallbackResponse = await fetch(`${API_BASE_URL}/${clean}`, { mode: 'cors', credentials: 'include' });
        return fallbackResponse.json();
    }
    return response.json();
  } catch (err) {
    console.error("FetchData error:", err);
    throw err;
  }
}

export default scheduleApi;