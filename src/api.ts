// src/api.ts
const API_BASE_URL = 'https://tih-ttgt.ru';

console.log('🔧 Прямое подключение к API:', API_BASE_URL);

export const fetchData = async (url: string) => {
  try {
    console.log('🔄 Исходный запрос из приложения:', url);
    
    // 🔥 СПЕЦИАЛЬНАЯ ОБРАБОТКА ДЛЯ /items
    if (url === '/items' || url === 'items') {
      console.log('📋 Запрос списка элементов');
      const apiEndpoint = '/schedule/items';
      console.log(`🔗 Правильный endpoint для списка: ${apiEndpoint}`);
      
      const response = await fetch(API_BASE_URL + apiEndpoint, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status} для ${apiEndpoint}`);
      }
      
      const data = await response.json();
      console.log('✅ Успешно получен список элементов');
      return data;
    }
    
    // 🔥 ОБРАБОТКА ОБЫЧНЫХ ЗАПРОСОВ: /{item_name}/{type}
    // Входные URL: "/Ястребова Г.А./schedule" или "/Ястребова Г.А./overrides"
    
    // Убираем начальный слеш
    const cleanUrl = url.startsWith('/') ? url.substring(1) : url;
    
    // Разбиваем на части: ["Ястребова Г.А.", "schedule"] или ["Ястребова Г.А.", "overrides"]
    const parts = cleanUrl.split('/');
    
    if (parts.length !== 2) {
      throw new Error(`Неправильный формат URL: ${url}. Ожидается: /items или /имя/тип`);
    }
    
    const itemName = parts[0];  // "Ястребова Г.А."
    const endpointType = parts[1]; // "schedule" или "overrides"
    
    // 🔥 ПРОВЕРКА ДОПУСТИМЫХ ТИПОВ
    if (endpointType !== 'schedule' && endpointType !== 'overrides') {
      throw new Error(`Неправильный тип запроса: ${endpointType}. Допустимо: schedule или overrides`);
    }
    
    // 🔥 ФОРМИРУЕМ ПРАВИЛЬНЫЙ ENDPOINT
    // API использует структуру: /schedule/{item_name}/{type}
    const apiEndpoint = `/schedule/${encodeURIComponent(itemName)}/${endpointType}`;
    
    console.log(`📋 Парсинг: имя="${itemName}", тип="${endpointType}"`);
    console.log(`🔗 Правильный endpoint: ${apiEndpoint}`);
    
    const response = await fetch(API_BASE_URL + apiEndpoint, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} для ${apiEndpoint}`);
    }
    
    const data = await response.json();
    console.log('✅ Успешный ответ от сервера');
    return data;
    
  } catch (error) {
    console.error('❌ Ошибка fetch:', error);
    throw error;
  }
};

// 🔥 ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ УДОБСТВА

// Получить список всех преподавателей и групп
export const getScheduleItems = async () => {
  return fetchData('/items');
};

// Получить расписание для конкретного элемента
export const getSchedule = async (itemName: string) => {
  return fetchData(`/${itemName}/schedule`);
};

// Получить замены для конкретного элемента
export const getOverrides = async (itemName: string) => {
  return fetchData(`/${itemName}/overrides`);
};

// Получить все данные для элемента (расписание + замены)
export const getFullScheduleData = async (itemName: string) => {
  try {
    console.log(`📥 Загрузка всех данных для: ${itemName}`);
    
    const [schedule, overrides] = await Promise.all([
      getSchedule(itemName),
      getOverrides(itemName)
    ]);
    
    console.log(`✅ Загружены все данные для: ${itemName}`);
    return {
      schedule,
      overrides,
      itemName,
      loadedAt: new Date().toISOString()
    };
    
  } catch (error) {
    console.error(`❌ Ошибка загрузки данных для ${itemName}:`, error);
    throw error;
  }
};

// Проверить статус API
export const checkApiStatus = async () => {
  try {
    const testEndpoint = '/schedule/items';
    const response = await fetch(API_BASE_URL + testEndpoint);
    
    return {
      status: response.status,
      ok: response.ok,
      message: response.ok ? 'API доступен' : `API недоступен: ${response.status}`,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 0,
      ok: false,
      message: `Ошибка подключения: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
      timestamp: new Date().toISOString()
    };
  }
};

// 🔥 ИСПРАВЛЕНИЕ ДЛЯ teacher-overrides (если где-то используется)
export const fetchTeacherOverrides = async (teacherName: string) => {
  console.warn(`⚠️ Используется устаревший метод fetchTeacherOverrides для: ${teacherName}`);
  console.warn(`🔄 Перенаправляю на правильный endpoint: /${teacherName}/overrides`);
  return getOverrides(teacherName);
};

// Для обратной совместимости
export default {
  fetchData,
  getScheduleItems,
  getSchedule,
  getOverrides,
  getFullScheduleData,
  checkApiStatus,
  fetchTeacherOverrides
};