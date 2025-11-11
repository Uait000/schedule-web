export const API_BASE_URL = 'https://ttgt-api-isxb.onrender.com/schedule';

console.log('🔧 Прямое подключение к API:', API_BASE_URL);

export const fetchData = async (url: string) => {
  try {
    console.log('🔄 Запрос к:', url);
    const response = await fetch(API_BASE_URL + url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log('✅ Ответ от сервера:', data);
    return data;
  } catch (error) {
    console.error('❌ Ошибка fetch:', error);
    throw error;
  }
};