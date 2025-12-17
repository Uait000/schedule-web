import { useEffect, useRef } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

interface UseAppTourProps {
  isReady: boolean;
  setIsMenuOpen: (isOpen: boolean) => void;
}

export function useAppTour({ isReady, setIsMenuOpen }: UseAppTourProps) {
  const driverObj = useRef(
    driver({
      showProgress: true,
      animate: true,
      allowClose: true,
      
      // 🔥 Возвращаем отступ, чтобы рамка не резала кнопки по высоте
      stagePadding: 4,
      
      popoverClass: 'driverjs-theme',
      overlayColor: 'rgba(0, 0, 0, 0.85)',
      
      doneBtnText: 'Понятно',
      nextBtnText: 'Далее',
      prevBtnText: 'Назад',

      steps: [
        // 1. Профиль
        {
          element: '#tour-profile',
          popover: {
            title: 'Ваш Профиль',
            description: 'Это ваша текущая группа. Нажмите на карточку, чтобы сменить профиль.',
            side: 'bottom',
            align: 'center',
          },
        },
        // 2. Добавить профиль
        {
          element: '#tour-add-profile',
          popover: {
            title: 'Добавить профиль',
            description: 'Здесь можно добавить еще одну группу или преподавателя.',
            side: 'top', 
            align: 'center',
          },
        },
        // 3. Иконка переключения
        {
          element: '#tour-profile-icon',
          popover: {
            title: 'Переключение',
            description: 'Нажмите на значок для быстрой смены профиля.',
            side: 'bottom', 
            align: 'center',
          },
        },
        // 4. Дни недели
        {
          element: '#tour-days',
          popover: {
            title: 'Дни недели',
            description: 'Вкладки для переключения дней.',
            side: 'bottom',
            align: 'center',
          },
        },
        // 5. Список пар
        {
          element: '#tour-list',
          popover: {
            title: 'Список пар',
            description: 'Нажмите на любую пару, чтобы добавить к ней заметку.',
            side: 'top',
            align: 'center',
          },
        },
        // 6. Навигация
        {
          element: '#tour-nav-panel',
          popover: {
            title: 'Навигация',
            description: 'Снизу находится календарь и переключатель недель.',
            side: 'top',
            align: 'center',
          },
        },
        // 7. МЕНЮ (ПОСЛЕДНИЙ ШАГ)
        {
          element: '#tour-menu',
          popover: {
            title: 'Меню функций',
            // 🔥 Описываем всё текстом здесь
            description: 'Здесь скрыты дополнительные возможности: \n• Проверка замен\n• История изменений\n• Мои заметки\n• Добавление курсов',
            side: 'bottom',
            align: 'end',
          },
          // Убираем onHighlightStarted, чтобы меню НЕ открывалось само
        },
      ],
      onDestroyed: () => setIsMenuOpen(false),
    })
  );

  useEffect(() => {
    if (!isReady) return;

    // 🔥 v13 - Новый ключ для перезапуска
    const tourCompleted = localStorage.getItem('app_tour_completed_v13');

    if (!tourCompleted) {
      setTimeout(() => {
        driverObj.current.drive();
        localStorage.setItem('app_tour_completed_v13', 'true');
      }, 1500);
    }
  }, [isReady]);

  const startTour = () => {
    setIsMenuOpen(false);
    setTimeout(() => driverObj.current.drive(), 300);
  };

  return { startTour };
}