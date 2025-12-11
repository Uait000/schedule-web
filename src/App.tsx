import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { WelcomeScreen } from './screens/Welcome';
import { ScheduleScreen } from './screens/Schedule';
import './App.css';

// Компонент для отслеживания маршрута
function RouteTracker() {
  const location = useLocation();

  useEffect(() => {
    // Сохраняем текущий маршрут в localStorage
    localStorage.setItem('lastVisitedRoute', location.pathname);
  }, [location]);

  return null;
}

// 🔥 ИСПРАВЛЕННАЯ ПРОВЕРКА
function AuthCheck() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const selectedId = localStorage.getItem('selectedId');
    
    // Проверяем, пришли ли мы сюда специально через кнопку "Добавить"
    // React Router позволяет передавать state при переходе
    const isAddingProfile = (location.state as any)?.fromAddProfile;
    
    // Если мы на главной ('/'), у нас есть профиль, И мы НЕ нажимали "Добавить"
    // -> Тогда перекидываем в расписание (авто-вход).
    if (location.pathname === '/' && selectedId && !isAddingProfile) {
      console.log('⚡️ Авто-вход в расписание...');
      navigate('/schedule', { replace: true });
    }
  }, [navigate, location]);

  return null;
}

function App() {
  const [lastVisitedRoute, setLastVisitedRoute] = useState<string>('/');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Восстанавливаем маршрут
    const savedRoute = localStorage.getItem('lastVisitedRoute');
    const selectedId = localStorage.getItem('selectedId');

    if (selectedId) {
        // Если авторизован - идем либо туда, где был, либо в расписание
        setLastVisitedRoute(savedRoute && savedRoute !== '/' ? savedRoute : '/schedule');
    } else {
        // Если нет - на главную
        setLastVisitedRoute('/');
    }
    setIsReady(true);
  }, []);

  if (!isReady) return null;

  return (
    <>
      <RouteTracker />
      <AuthCheck />
      <Routes>
        <Route path="/" element={<WelcomeScreen />} />
        <Route path="/schedule" element={<ScheduleScreen />} />
        {/* Автоматический редирект на последний посещенный маршрут */}
        <Route 
          path="*" 
          element={<Navigate to={lastVisitedRoute} replace />} 
        />
      </Routes>
    </>
  );
}

export default App;