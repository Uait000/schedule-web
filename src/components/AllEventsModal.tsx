// src/components/AllEventsModal.tsx
import React from 'react';
import { CalendarEvent } from '../utils/practiceUtils';
import { format, parseISO, isAfter, startOfDay, endOfDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import { X, Calendar, ChevronRight, Info } from 'lucide-react';

interface AllEventsModalProps {
  isOpen: boolean;
  onClose: () => void;
  calendarEvents: CalendarEvent[];
  onNavigateToDate: (date: Date, message: string) => void;
  groupName?: string; // 🔥 Добавлено для отображения группы
}

export const AllEventsModal: React.FC<AllEventsModalProps> = ({ 
  isOpen, 
  onClose, 
  calendarEvents, 
  onNavigateToDate,
  groupName 
}) => {
  if (!isOpen) return null;

  // Фильтруем только те события, которые еще не закончились
  const upcomingEvents = calendarEvents
    .filter(event => {
        const eventEnd = endOfDay(parseISO(event.dateEnd));
        return isAfter(eventEnd, startOfDay(new Date()));
    })
    .sort((a, b) => parseISO(a.dateStart).getTime() - parseISO(b.dateStart).getTime());

  // Функция определения цвета и иконки в зависимости от типа события
  const getEventTheme = (type: string, code: string) => {
    const c = (code || '').toUpperCase();
    if (type === 'holiday' || c === '=') return { color: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.12)', label: 'Отдых' };
    if (type === 'attestation' || c === '::' || c === ':') return { color: '#ff4444', bg: 'rgba(255, 68, 68, 0.12)', label: 'Экзамены' };
    if (c === 'III' || c === 'D' || c === 'Д') return { color: '#a855f7', bg: 'rgba(168, 85, 247, 0.12)', label: 'ГИА' };
    if (c === 'ОВС') return { color: '#ff6600', bg: 'rgba(255, 102, 0, 0.12)', label: 'Сборы' }; // 🔥 Добавлено ОВС
    return { color: '#92d050', bg: 'rgba(146, 208, 80, 0.12)', label: 'Практика' };
  };

  return (
    <div className="all-events-overlay" onClick={onClose}>
      <div className="all-events-card" onClick={e => e.stopPropagation()}>
        {/* Шапка */}
        <div className="all-events-header">
          <div className="header-left">
            <div className="header-icon">
              <Calendar size={22} color="var(--color-primary)" />
            </div>
            <div>
              {/* 🔥 Теперь группа пишется здесь */}
              <h2 className="header-title">График событий</h2>
              <p className="header-subtitle">Группа {groupName || 'загрузка...'}</p>
            </div>
          </div>
          <button className="close-circle-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Контент */}
        <div className="all-events-list">
          {upcomingEvents.length === 0 ? (
            <div className="events-empty-state">
              <Info size={40} opacity={0.2} />
              <p>Предстоящих событий не найдено</p>
            </div>
          ) : (
            upcomingEvents.map((event, index) => {
              const theme = getEventTheme(event.type, event.code);
              const startDate = parseISO(event.dateStart);
              const endDate = parseISO(event.dateEnd);

              return (
                <div 
                  key={index} 
                  className="event-navigation-item"
                  onClick={() => {
                    onNavigateToDate(startDate, `Переход к: ${event.title}`);
                    onClose();
                  }}
                >
                  <div className="event-item-left">
                    <div className="event-type-indicator" style={{ backgroundColor: theme.bg, color: theme.color }}>
                      {theme.label}
                    </div>
                    <div className="event-main-info">
                      <span className="event-name">{event.title}</span>
                      <span className="event-date-range">
                        {format(startDate, 'd MMMM', { locale: ru })} — {format(endDate, 'd MMMM', { locale: ru })}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={18} className="event-chevron" />
                </div>
              );
            })
          )}
        </div>

        {/* Футер */}
        <div className="all-events-footer">
          <button className="footer-close-btn" onClick={onClose}>Закрыть</button>
        </div>
      </div>

      <style>{`
        .all-events-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(15px);
          -webkit-backdrop-filter: blur(15px);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          animation: fadeIn 0.2s ease-out;
        }

        .all-events-card {
          background: var(--color-surface);
          width: 100%;
          max-width: 440px;
          max-height: 85vh;
          border-radius: 32px;
          border: 1px solid var(--color-border);
          display: flex;
          flex-direction: column;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          overflow: hidden;
          animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .all-events-header {
          padding: 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--color-border);
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .header-icon {
          width: 44px;
          height: 44px;
          background: var(--color-surface-container);
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .header-title {
          margin: 0;
          font-size: 19px;
          font-weight: 800;
          color: var(--color-text);
          letter-spacing: -0.5px;
        }

        .header-subtitle {
          margin: 0;
          font-size: 13px;
          color: var(--color-primary);
          opacity: 0.9;
          font-weight: 700;
        }

        .close-circle-btn {
          background: var(--color-surface-container);
          border: none;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          color: var(--color-text);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: transform 0.2s;
        }

        .close-circle-btn:active { transform: scale(0.9); }

        .all-events-list {
          padding: 16px;
          overflow-y: auto;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .event-navigation-item {
          background: var(--color-surface-container-low);
          padding: 16px;
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          transition: all 0.2s;
          border: 1px solid transparent;
        }

        .event-navigation-item:hover {
          background: var(--color-surface-container);
          border-color: var(--color-border);
        }

        .event-navigation-item:active {
          transform: scale(0.98);
          background: var(--color-surface-container-high);
        }

        .event-item-left {
          display: flex;
          flex-direction: column;
          gap: 8px;
          flex: 1;
          min-width: 0;
        }

        .event-type-indicator {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          padding: 4px 10px;
          border-radius: 8px;
          width: fit-content;
          letter-spacing: 0.5px;
        }

        .event-main-info {
          display: flex;
          flex-direction: column;
        }

        .event-name {
          font-weight: 700;
          color: var(--color-text);
          font-size: 15px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .event-date-range {
          font-size: 13px;
          color: var(--color-text);
          opacity: 0.5;
          font-weight: 500;
        }

        .event-chevron {
          color: var(--color-text);
          opacity: 0.2;
          margin-left: 10px;
        }

        .events-empty-state {
          padding: 60px 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          color: var(--color-text);
          opacity: 0.5;
          font-weight: 600;
        }

        .all-events-footer {
          padding: 20px 24px 24px;
          background: var(--color-surface);
        }

        .footer-close-btn {
          width: 100%;
          padding: 16px;
          border-radius: 18px;
          border: none;
          background: var(--color-surface-container-high);
          color: var(--color-text);
          font-weight: 700;
          font-size: 15px;
          cursor: pointer;
        }

        .footer-close-btn:active { opacity: 0.8; }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

        .all-events-list::-webkit-scrollbar { width: 4px; }
        .all-events-list::-webkit-scrollbar-track { background: transparent; }
        .all-events-list::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 10px; }
      `}</style>
    </div>
  );
};