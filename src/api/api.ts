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

// 🔥 УЛУЧШЕННАЯ ФУНКЦИЯ normalizeLesson ДЛЯ ОБРАБОТКИ NULL
function normalizeLessonForApi(lesson: any): any {
  console.log('🔧 normalizeLessonForApi input:', lesson);
  
  if (lesson == null || lesson === 'null' || (typeof lesson === 'object' && Object.keys(lesson).length === 0)) {
    return { noLesson: {} };
  }

  // 🔥 ИСПРАВЛЕНИЕ: Обрабатываем случай, когда willBe: null из API
  if (lesson === null) {
    return { noLesson: {} };
  }

  // 🔥 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Если приходит объект с subgroup_index - это подгруппа
  if (lesson.subgroup_index !== undefined) {
    console.log('🔧 Обнаружена отдельная подгруппа в API:', lesson);
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

  // Вспомогательная функция для поиска группы
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
    const result = {
      commonLesson: {
        name: common.name || '',
        teacher: common.teacher || '',
        room: common.room || '',
        group: localGroup || globalGroup 
      }
    };
    console.log('🔧 Normalized common lesson in API:', result);
    return result;
  }

  const subgrouped = lesson.SubgroupedLesson || lesson.subgroupedLesson;
  if (subgrouped) {
    const result = {
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
    console.log('🔧 Normalized subgrouped lesson in API:', result);
    return result;
  }
  
  // 🔥 ДОБАВЛЕНО: Обработка прямых полей (как в вашем примере из API)
  if (lesson.name || lesson.teacher || lesson.room) {
    console.log('🔧 Обнаружены прямые поля урока в API:', lesson);
    
    // Если есть subgroup_index - это подгруппа
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
    
    // Иначе обычная пара
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
  
  console.log('🔧 Неизвестный формат урока в API, возвращаем noLesson');
  return { noLesson: {} };
}

// 🔥 УЛУЧШЕННАЯ ФУНКЦИЯ ДЛЯ ЗАПРОСОВ С ЛУЧШЕЙ ОБРАБОТКОЙ ОШИБОК
async function fetchApi<T>(endpoint: string, useCache: boolean = true): Promise<T> {
  const cacheKey = `${CACHE_KEYS.SCHEDULE}_${endpoint.replace(/\//g, '_')}`;

  // Пытаемся получить данные из кэша
  if (useCache) {
    const cachedData = getFromCache<T>(cacheKey);
    if (cachedData) {
      return cachedData;
    }
  }

  try {
    console.log(`🔄 API Request: ${API_BASE_URL}${endpoint}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      // 🔥 УЛУЧШЕННАЯ ОБРАБОТКА ОШИБОК
      if (response.status === 500) {
        throw new Error(`Ошибка сервера (500): Сервер временно недоступен`);
      } else if (response.status === 404) {
        throw new Error(`Не найдено (404): Данные не найдены`);
      } else {
        throw new Error(`HTTP ошибка! статус: ${response.status}`);
      }
    }
    
    const data = await response.json();
    console.log(`✅ API Response from ${endpoint}:`, data);
    
    // 🔥 ИСПРАВЛЕНИЕ: Нормализуем данные замен, обрабатывая willBe: null
    if (data.overrides && Array.isArray(data.overrides)) {
      data.overrides = data.overrides.map((override: any) => ({
        ...override,
        shouldBe: normalizeLessonForApi(override.shouldBe),
        willBe: normalizeLessonForApi(override.willBe)
      }));
    }
    
    // Сохраняем в кэш
    saveToCache(cacheKey, data);
    
    return data;
  } catch (error) {
    console.error(`❌ API Error at ${endpoint}:`, error);
    
    // 🔥 УЛУЧШЕННАЯ ЛОГИКА ВОССТАНОВЛЕНИЯ
    const cachedData = getFromCache<T>(cacheKey);
    if (cachedData) {
      console.log(`🔄 Используем устаревший кэш для ${endpoint}`);
      return cachedData;
    }
    
    // 🔥 ПРОПАГАЦИЯ ЧИТАЕМЫХ ОШИБОК
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
  // Получить список групп и преподавателей
  getItems: () => fetchApi<any>('/schedule/items'),

  // Получить расписание для группы/преподавателя
  getSchedule: (itemName: string) => fetchApi<any>(`/schedule/${encodeURIComponent(itemName)}/schedule`),

  // 🔥 ИСПРАВЛЕНИЕ: Разные endpoints для групп и преподавателей
  getOverrides: (itemName: string) => {
    // Определяем тип (преподаватель или группа)
    const isTeacher = itemName.includes('.');
    if (isTeacher) {
      // Для преподавателей используем специальный endpoint
      return fetchApi<any>(`/schedule/teacher-overrides/${encodeURIComponent(itemName)}`);
    } else {
      // Для групп используем обычный endpoint
      return fetchApi<any>(`/schedule/${encodeURIComponent(itemName)}/overrides`);
    }
  },

  // Принудительно обновить данные (без кэша)
  refreshSchedule: (itemName: string) => fetchApi<any>(`/schedule/${encodeURIComponent(itemName)}/schedule`, false),
  refreshOverrides: (itemName: string) => {
    const isTeacher = itemName.includes('.');
    if (isTeacher) {
      return fetchApi<any>(`/schedule/teacher-overrides/${encodeURIComponent(itemName)}`, false);
    } else {
      return fetchApi<any>(`/schedule/${encodeURIComponent(itemName)}/overrides`, false);
    }
  },
};

// 🔥 ПРОСТАЯ ФУНКЦИЯ ДЛЯ ОБРАТНОЙ СОВМЕСТИМОСТИ
export async function fetchData(endpoint: string): Promise<any> {
  // 🔥 ИСПРАВЛЕНИЕ: Определяем тип запроса
  if (endpoint.includes('/overrides')) {
    const itemName = endpoint.replace('/overrides', '');
    return scheduleApi.getOverrides(itemName);
  } else if (endpoint.includes('/schedule')) {
    const itemName = endpoint.replace('/schedule', '');
    return scheduleApi.getSchedule(itemName);
  } else {
    return scheduleApi.getSchedule(endpoint.replace('/', ''));
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