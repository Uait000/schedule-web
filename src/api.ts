// src/api/api.ts

const API_BASE_URL = 'https://tih-ttgt.ru';

// Константы для кэширования
const CACHE_KEYS = {
  SCHEDULE: 'api_cache_schedule',
  OVERRIDES: 'api_cache_overrides',
  ITEMS: 'api_cache_items',
  TIMESTAMP: 'api_cache_timestamp'
};

// Время жизни кэша (5 минут)
const CACHE_DURATION = 5 * 60 * 1000;

// Функция для получения данных из кэша
function getFromCache<T>(key: string): T | null {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;

    const { data, timestamp } = JSON.parse(cached);
    
    // Проверяем актуальность кэша
    if (Date.now() - timestamp > CACHE_DURATION) {
      localStorage.removeItem(key);
      return null;
    }

    console.log(`📦 Загружено из кэша: ${key}`);
    return data;
  } catch (error) {
    console.error(`❌ Ошибка чтения кэша ${key}:`, error);
    return null;
  }
}

// Функция для сохранения в кэш
function saveToCache(key: string, data: any): void {
  try {
    const cacheData = {
      data,
      timestamp: Date.now()
    };
    localStorage.setItem(key, JSON.stringify(cacheData));
    console.log(`💾 Сохранено в кэш: ${key}`);
  } catch (error) {
    console.error(`❌ Ошибка сохранения в кэш ${key}:`, error);
  }
}

function normalizeLessonForApi(lesson: any): any {
  if (lesson == null || lesson === 'null' || (typeof lesson === 'object' && Object.keys(lesson).length === 0)) {
    return { noLesson: {} };
  }

  if (lesson === null) {
    return { noLesson: {} };
  }

  if (lesson.subgroup_index !== undefined) {
    return {
      subgroupedLesson: {
        name: lesson.name || 'Информатика',
        subgroups: [{
          teacher: lesson.teacher || '',
          room: lesson.room || '',
          subgroup_index: lesson.subgroup_index || 1,
          group: lesson.group || ''
        }]
      }
    };
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
  
  if (Object.keys(lesson).length === 0 || (lesson.noLesson)) {
      return { noLesson: {} };
  }

  if (globalGroup) {
    return { commonLesson: { name: '?', teacher: '?', room: '?', group: globalGroup } };
  }
  
  return { noLesson: {} };
}

async function fetchApi<T>(endpoint: string, useCache: boolean = true): Promise<T> {
  const cacheKey = `${CACHE_KEYS.SCHEDULE}_${endpoint.replace(/\//g, '_')}`;

  if (useCache) {
    const cachedData = getFromCache<T>(cacheKey);
    if (cachedData) {
      return cachedData;
    }
  }

  try {
    // 🔥 Ensure endpoint starts with /
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    console.log(`🔄 API Request: ${API_BASE_URL}${normalizedEndpoint}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    const response = await fetch(`${API_BASE_URL}${normalizedEndpoint}`, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      if (response.status === 500) {
        throw new Error(`Ошибка сервера (500): Сервер временно недоступен`);
      } else if (response.status === 404) {
        throw new Error(`Не найдено (404): Данные не найдены`);
      } else {
        throw new Error(`HTTP ошибка! статус: ${response.status}`);
      }
    }
    
    const data = await response.json();
    
    if (data.overrides && Array.isArray(data.overrides)) {
      data.overrides = data.overrides.map((override: any) => ({
        ...override,
        shouldBe: normalizeLessonForApi(override.shouldBe),
        willBe: normalizeLessonForApi(override.willBe)
      }));
    }
    
    saveToCache(cacheKey, data);
    
    return data;
  } catch (error) {
    console.error(`❌ API Error at ${endpoint}:`, error);
    
    const cachedData = getFromCache<T>(cacheKey);
    if (cachedData) {
      console.log(`🔄 Используем устаревший кэш для ${endpoint}`);
      return cachedData;
    }
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Превышено время ожидания ответа от сервера');
      }
      throw error;
    }
    
    throw new Error('Неизвестная ошибка при загрузке данных');
  }
}

// API методы
export const scheduleApi = {
  getItems: () => fetchApi<any>('/schedule/items'),

  getSchedule: (itemName: string) => fetchApi<any>(`/schedule/${encodeURIComponent(itemName)}/schedule`),

  // 🔥 ОБНОВЛЕНО: Поддержка параметра date
  getOverrides: (itemName: string, date?: string) => {
    const isTeacher = itemName.includes('.');
    const query = date ? `?date=${date}` : '';
    
    if (isTeacher) {
      return fetchApi<any>(`/schedule/teacher-overrides/${encodeURIComponent(itemName)}${query}`);
    } else {
      return fetchApi<any>(`/schedule/${encodeURIComponent(itemName)}/overrides${query}`);
    }
  },

  refreshSchedule: (itemName: string) => fetchApi<any>(`/schedule/${encodeURIComponent(itemName)}/schedule`, false),
  
  refreshOverrides: (itemName: string, date?: string) => {
    const isTeacher = itemName.includes('.');
    const query = date ? `?date=${date}` : '';
    if (isTeacher) {
      return fetchApi<any>(`/schedule/teacher-overrides/${encodeURIComponent(itemName)}${query}`, false);
    } else {
      return fetchApi<any>(`/schedule/${encodeURIComponent(itemName)}/overrides${query}`, false);
    }
  },
};

// 🔥 УЛУЧШЕННАЯ ФУНКЦИЯ fetchData
export async function fetchData(endpoint: string): Promise<any> {
  // 1. Отделяем путь от параметров запроса (если есть ?date=...)
  const [path, query] = endpoint.split('?');
  
  // 2. Обработка /items
  if (path === '/items' || path === 'items') {
    return scheduleApi.getItems();
  }

  // 3. Парсинг пути: /{item_name}/{type}
  // Убираем начальный слеш
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
  const parts = cleanPath.split('/');

  if (parts.length !== 2) {
    // Если формат непонятный, пробуем как getSchedule
    return scheduleApi.getSchedule(path.replace('/', ''));
  }

  const itemName = decodeURIComponent(parts[0]);
  const endpointType = parts[1];

  if (endpointType === 'schedule') {
    return scheduleApi.getSchedule(itemName);
  } else if (endpointType === 'overrides') {
    // Извлекаем дату из queryParams, если она там есть
    let dateParam: string | undefined = undefined;
    if (query) {
      const urlParams = new URLSearchParams(query);
      const date = urlParams.get('date');
      if (date) dateParam = date;
    }
    return scheduleApi.getOverrides(itemName, dateParam);
  } else {
    // Fallback
    return scheduleApi.getSchedule(itemName);
  }
}

// Функция для очистки всего кэша
export const clearApiCache = (): void => {
  Object.values(CACHE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
  console.log('🧹 Весь кэш API очищен');
};

export default scheduleApi;