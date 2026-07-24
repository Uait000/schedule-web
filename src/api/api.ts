// src/api/api.ts

const API_BASE_URL = import.meta.env.DEV ? 'http://127.0.0.1:8000' : 'https://schedulettgt.ru';
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 дней для офлайн-кэша

// ==========================================
// CACHE HELPERS
// ==========================================

function getFromCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, timestamp } = JSON.parse(raw);
    // In offline mode, use any cached data regardless of age
    // In online mode, respect cache duration
    if (navigator.onLine && (Date.now() - timestamp > CACHE_DURATION)) {
      return null; // Let it refresh
    }
    return data;
  } catch {
    return null;
  }
}

function saveToCache(key: string, data: any): void {
  try {
    localStorage.setItem(key, JSON.stringify({
      data,
      timestamp: Date.now(),
      version: APP_VERSION
    }));
  } catch (e) {
    // Storage full — clean old API caches
    const keys = Object.keys(localStorage).filter(k => k.startsWith('api_'));
    // Remove oldest 30%
    const toRemove = keys.slice(0, Math.ceil(keys.length * 0.3));
    toRemove.forEach(k => localStorage.removeItem(k));
    try {
      localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now(), version: APP_VERSION }));
    } catch {}
  }
}

function makeKey(type: string, id: string = '', extra: string = ''): string {
  if (type === 'items') return 'api_items';
  if (type === 'schedule') return `api_schedule_${id.toLowerCase()}`;
  if (type === 'info') return `api_info_${id.toLowerCase()}_${extra}`;
  if (type === 'overrides') return `api_overrides_${id.toLowerCase()}_${extra}`;
  if (type === 'events') return `api_events_${id.toLowerCase()}`;
  return `api_${type}`;
}

const APP_VERSION = '5.0.0';

// ==========================================
// NORMALIZE LESSON
// ==========================================

export function normalizeLessonForApi(lesson: any): any {
  if (lesson === null || lesson === undefined || lesson === 'null' ||
      (typeof lesson === 'object' && Object.keys(lesson).length === 0)) {
    return { noLesson: {} };
  }
  if (lesson.commonLesson || lesson.subgroupedLesson || lesson.noLesson) return lesson;
  if (lesson.name || lesson.teacher || lesson.room) {
    return {
      commonLesson: {
        name: lesson.name || '',
        teacher: lesson.teacher || '',
        room: lesson.room || '',
        group: lesson.group || '',
        subgroup_index: lesson.subgroup_index || lesson.subgroup || 0
      }
    };
  }
  return { noLesson: {} };
}

function sanitizeSchedule(schedule: any): any {
  if (!schedule) return null;
  return {
    ...schedule,
    weeks: (schedule.weeks || []).map((week: any) => ({
      ...week,
      days: (week.days || []).map((day: any) => ({
        ...day,
        lessons: (day.lessons || []).map(normalizeLessonForApi)
      }))
    }))
  };
}

// ==========================================
// FETCH WITH TIMEOUT
// ==========================================

async function fetchWithTimeout(url: string, options: RequestInit & { timeout?: number } = {}): Promise<Response> {
  const { timeout = 10000, ...fetchOptions } = options;

  // If offline, skip fetch entirely
  if (!navigator.onLine) {
    throw new Error('offline');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { ...fetchOptions, signal: controller.signal });
    clearTimeout(timer);
    return response;
  } catch (error: any) {
    clearTimeout(timer);
    if (error.name === 'AbortError') throw new Error('Timeout');
    if (error.message === 'offline') throw error;
    throw error;
  }
}

// ==========================================
// API METHODS
// ==========================================

export const scheduleApi = {
  // Get list of all groups and teachers
  getItems: async () => {
    const key = makeKey('items');
    try {
      const response = await fetchWithTimeout(`${API_BASE_URL}/schedule/items`, { mode: 'cors' });
      const data = await response.json();
      saveToCache(key, data);
      return data;
    } catch {
      // Offline or error — use cache
      return getFromCache<any>(key) || { groups: [], teachers: [] };
    }
  },

  // Get full schedule for a group/teacher
  getSchedule: async (id: string) => {
    const key = makeKey('schedule', id);
    try {
      const response = await fetchWithTimeout(`${API_BASE_URL}/schedule/${encodeURIComponent(id)}/schedule`, { mode: 'cors' });
      if (!response.ok) throw new Error(`${response.status}`);
      const data = await response.json();
      const sanitized = sanitizeSchedule(data);
      saveToCache(key, sanitized);
      return sanitized;
    } catch {
      const cached = getFromCache<any>(key);
      if (cached) return sanitizeSchedule(cached);
      throw new Error('Нет данных в кэше');
    }
  },

  // Get info: schedule + overrides + events (main endpoint)
  getInfo: async (id: string, overridesDate: string, scheduleUpdate: number = 0, eventsHash: string = "") => {
    const keyInfo = makeKey('info', id, overridesDate);
    const keySched = makeKey('schedule', id);
    const keyOverrides = makeKey('overrides', id, overridesDate);
    const keyEvents = makeKey('events', id);

    try {
      const params = new URLSearchParams({
        overrides_date: overridesDate,
        schedule_update: scheduleUpdate.toString(),
        events_hash: eventsHash
      });
      const url = `${API_BASE_URL}/schedule/${encodeURIComponent(id)}/info?${params}`;
      const response = await fetchWithTimeout(url, { mode: 'cors' });
      if (!response.ok) throw new Error(`${response.status}`);

      const data = await response.json();

      // Cache each part separately for offline reliability
      if (data.schedule) {
        data.schedule = sanitizeSchedule(data.schedule);
        saveToCache(keySched, data.schedule);
      }
      if (data.overrides) {
        saveToCache(keyOverrides, data.overrides);
      }
      if (data.events) {
        saveToCache(keyEvents, data.events);
      }
      saveToCache(keyInfo, data);

      return data;
    } catch {
      // Offline — try to build response from cached parts
      const cachedSchedule = getFromCache<any>(keySched);
      const cachedOverrides = getFromCache<any>(keyOverrides);
      const cachedEvents = getFromCache<any>(keyEvents);

      return {
        schedule: cachedSchedule ? sanitizeSchedule(cachedSchedule) : null,
        overrides: cachedOverrides || null,
        events: cachedEvents || [],
        offline: true
      };
    }
  },

  // Submit rating
  postRate: async (data: any) => {
    try {
      const response = await fetchWithTimeout(`${API_BASE_URL}/schedule/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        mode: 'cors'
      });
      return response.json();
    } catch {
      // Save locally for later submission
      const pending = JSON.parse(localStorage.getItem('pending_rates') || '[]');
      pending.push({ ...data, timestamp: Date.now() });
      localStorage.setItem('pending_rates', JSON.stringify(pending));
      return { queued: true };
    }
  }
};

// ==========================================
// HELPER: Check if data is available offline
// ==========================================

export function hasOfflineData(profileId: string): boolean {
  return !!(
    getFromCache(makeKey('schedule', profileId)) ||
    getFromCache(makeKey('info', profileId, new Date().toISOString().slice(0, 10)))
  );
}

// ==========================================
// HELPER: Get cached data without network
// ==========================================

export function getCachedSchedule(profileId: string): any {
  return getFromCache(makeKey('schedule', profileId));
}

export function getCachedOverrides(profileId: string, date: string): any {
  return getFromCache(makeKey('overrides', profileId, date));
}

export function getCachedEvents(profileId: string): any {
  return getFromCache(makeKey('events', profileId));
}

// Legacy fetchData helper used by Welcome screen
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
