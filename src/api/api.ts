// src/api/api.ts

const API_BASE_URL = 'http://127.0.0.1:8000';

const CACHE_KEYS = {
  SCHEDULE: 'api_cache_schedule',
  OVERRIDES: 'api_cache_overrides',
  EVENTS: 'api_cache_events',
  ITEMS: 'api_cache_items'
};

const CACHE_DURATION = 5 * 60 * 1000;

function getFromCache<T>(key: string): T | null {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp > CACHE_DURATION) {
      localStorage.removeItem(key);
      return null;
    }
    return data;
  } catch { return null; }
}

function saveToCache(key: string, data: any): void {
  try {
    localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
  } catch (e) { console.error(e); }
}

function normalizeLessonForApi(lesson: any): any {
  if (!lesson || lesson === 'null' || Object.keys(lesson).length === 0) return { noLesson: {} };
  
  const findGroup = (obj: any): string | undefined => {
    if (typeof obj === 'string') return obj;
    if (!obj || typeof obj !== 'object') return undefined;
    const keys = ['group', 'studentGroup', 'className', 'targetGroup'];
    for (const k of keys) if (obj[k]) return typeof obj[k] === 'string' ? obj[k] : obj[k].name;
    return findGroup(obj.commonLesson || obj.CommonLesson || obj.willBe);
  };

  const common = lesson.commonLesson || lesson.CommonLesson;
  if (common) return { commonLesson: { ...common, group: findGroup(common) || findGroup(lesson) } };

  const sub = lesson.subgroupedLesson || lesson.SubgroupedLesson;
  if (sub) return { subgroupedLesson: { ...sub, subgroups: (sub.subgroups || []).map((s: any) => ({ ...s, group: findGroup(s) || findGroup(lesson) })) } };

  if (lesson.name) return { commonLesson: { ...lesson, group: findGroup(lesson) } };
  return { noLesson: {} };
}

async function fetchApi<T>(endpoint: string, useCache: boolean = true): Promise<T> {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const cacheKey = `api_${cleanEndpoint.replace(/\//g, '_')}`;

  if (useCache) {
    const cached = getFromCache<T>(cacheKey);
    if (cached) return cached;
  }

  const response = await fetch(`${API_BASE_URL}${cleanEndpoint}`);
  if (!response.ok) throw new Error(`Status: ${response.status}`);
  
  const data = await response.json();
  if (data.overrides) {
    data.overrides = data.overrides.map((o: any) => ({
      ...o,
      shouldBe: normalizeLessonForApi(o.shouldBe),
      willBe: normalizeLessonForApi(o.willBe)
    }));
  }
  
  saveToCache(cacheKey, data);
  return data;
}

export const scheduleApi = {
  getItems: () => fetchApi<any>('/schedule/items'),
  getSchedule: (id: string) => fetchApi<any>(`/schedule/${encodeURIComponent(id)}/schedule`),
  getEvents: (id: string) => fetchApi<any>(`/schedule/${encodeURIComponent(id)}/events`),
  getOverrides: (id: string, date?: string) => {
    const q = date ? `?date=${date}` : '';
    return fetchApi<any>(`/schedule/${encodeURIComponent(id)}/overrides${q}`);
  },
  refreshOverrides: (id: string, date?: string) => {
    const q = date ? `?date=${date}` : '';
    return fetchApi<any>(`/schedule/${encodeURIComponent(id)}/overrides${q}`, false);
  }
};

export async function fetchData(endpoint: string): Promise<any> {
  const [path, query] = endpoint.split('?');
  const clean = path.startsWith('/') ? path.substring(1) : path;
  const parts = clean.split('/');

  if (clean === 'items') return scheduleApi.getItems();
  if (parts.length === 2) {
    const name = decodeURIComponent(parts[0]);
    if (parts[1] === 'schedule') return scheduleApi.getSchedule(name);
    if (parts[1] === 'events') return scheduleApi.getEvents(name);
    if (parts[1] === 'overrides') {
      const d = new URLSearchParams(query || "").get('date');
      return scheduleApi.getOverrides(name, d || undefined);
    }
  }
  return scheduleApi.getSchedule(decodeURIComponent(clean));
}

export default scheduleApi;