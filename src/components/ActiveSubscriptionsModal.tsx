// src/components/ActiveSubscriptionsModal.tsx
import React, { useState, useEffect } from 'react';

/**
 * интерфейс пропсов для управления состоянием окна
 */
interface ActiveSubscriptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * интерфейс для внутреннего состояния элемента списка
 */
interface SubscriptionItem {
  id: string;
  isActive: boolean;
}

/**
 * 🔥 ActiveSubscriptionsModal: Современный интерфейс управления уведомлениями.
 * Теперь при нажатии на "корзину" подписка не удаляется из вида, 
 * а переходит в состояние "Выключено".
 */
export const ActiveSubscriptionsModal: React.FC<ActiveSubscriptionsModalProps> = ({ isOpen, onClose }) => {
  const [items, setItems] = useState<SubscriptionItem[]>([]);

  /**
   * Функция загрузки данных. 
   * Мы сканируем хранилище и находим все группы, для которых пуши когда-либо включались.
   */
  const loadData = () => {
    const found: SubscriptionItem[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      // Находим ключи push_active_
      if (key?.startsWith('push_active_')) {
        const val = localStorage.getItem(key);
        // Добавляем в список, если значение 'true' (или даже 'false', чтобы показать выключенные)
        // Но по умолчанию показываем только те, что были активны на момент открытия
        if (val === 'true') {
          found.push({
            id: key.replace('push_active_', ''),
            isActive: true
          });
        }
      }
    }
    setItems(found);
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  /**
   * 🔥 Логика отключения уведомления (без удаления строки)
   */
  const handleToggleOff = (id: string) => {
    // 1. Физически выключаем в localStorage
    localStorage.setItem(`push_active_${id}`, 'false');
    
    // 2. Оповещаем приложение об изменении (синхронизация меню)
    window.dispatchEvent(new Event('storage'));
    
    // 3. Обновляем визуальное состояние в модалке
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, isActive: false } : item
    ));
  };

  return (
    <div className="modern-modal-overlay" onClick={onClose}>
      <div className="modern-modal-content" onClick={(e) => e.stopPropagation()}>
        
        {/* Хедер с динамическим цветом текста */}
        <div className="modern-modal-header">
          <div className="header-icon-title">
            <div className="header-badge">
              <span className="material-icons">notifications_active</span>
            </div>
            <div className="header-text-block">
              <span className="header-title-text">Центр уведомлений</span>
              <span className="header-subtitle-text">Настройка замен для профилей</span>
            </div>
          </div>
          <button className="close-circle-btn" onClick={onClose}>
            <span className="material-icons">close</span>
          </button>
        </div>

        <div className="modern-modal-body">
          {items.length === 0 ? (
            <div className="empty-subs-state">
              <div className="empty-icon-container">
                <span className="material-icons">notifications_off</span>
              </div>
              <p className="empty-text">Нет активных подписок</p>
              <p className="empty-subtext">Включите уведомления в меню группы, чтобы они появились здесь.</p>
            </div>
          ) : (
            <div className="subs-grid">
              {items.map((item) => (
                <div key={item.id} className={`sub-card-item ${!item.isActive ? 'disabled' : ''}`}>
                  <div className="sub-card-info">
                    <div className="sub-avatar">
                      <span className="material-icons">{item.isActive ? 'check_circle' : 'pause_circle'}</span>
                    </div>
                    <div className="sub-text-meta">
                      <span className="sub-name-label">{item.id}</span>
                      <span className="sub-status-label">
                        {item.isActive ? 'Уведомления приходят' : 'Выключено'}
                      </span>
                    </div>
                  </div>
                  
                  {item.isActive && (
                    <button 
                      className="sub-delete-btn" 
                      onClick={() => handleToggleOff(item.id)}
                      title="Выключить уведомления"
                    >
                      <span className="material-icons">delete_outline</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modern-modal-footer">
          <button className="footer-action-btn primary" onClick={onClose}>
            Понятно
          </button>
        </div>
      </div>

      <style>{`
        .modern-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 5500;
          animation: modalFadeIn 0.3s ease;
          padding: 16px;
        }

        .modern-modal-content {
          background: var(--color-surface);
          width: 100%;
          max-width: 440px;
          border-radius: 32px;
          box-shadow: 0 40px 100px -20px rgba(0, 0, 0, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.1);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          animation: modalSlideUp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        @keyframes modalFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalSlideUp { from { transform: translateY(50px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

        .modern-modal-header {
          padding: 24px 28px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(255, 255, 255, 0.03);
          border-bottom: 1px solid var(--color-border);
        }

        .header-icon-title { display: flex; align-items: center; gap: 16px; }
        .header-badge {
          width: 44px; height: 44px;
          background: linear-gradient(135deg, #a88dff, #6200ea);
          border-radius: 14px;
          display: flex; align-items: center; justify-content: center;
          color: white;
          box-shadow: 0 4px 12px rgba(140, 103, 246, 0.4);
        }

        .header-text-block { display: flex; flex-direction: column; }
        .header-title-text { font-weight: 900; font-size: 18px; color: #ffffff; }
        .header-subtitle-text { font-size: 12px; opacity: 0.6; color: #ffffff; }

        .close-circle-btn {
          background: rgba(255, 255, 255, 0.1);
          border: none; width: 34px; height: 34px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: #ffffff;
        }

        .modern-modal-body {
          padding: 20px;
          max-height: 400px;
          overflow-y: auto;
        }

        .subs-grid { display: flex; flex-direction: column; gap: 12px; }

        .sub-card-item {
          background: var(--color-surface-container);
          border: 1px solid var(--color-border);
          padding: 14px 18px;
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          transition: all 0.3s ease;
        }

        .sub-card-item.disabled {
          opacity: 0.6;
          filter: grayscale(1);
          border-style: dashed;
        }

        .sub-card-info { display: flex; align-items: center; gap: 14px; }
        .sub-avatar {
          width: 40px; height: 40px;
          background: var(--color-surface);
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          color: #a88dff;
          border: 1px solid var(--color-border);
        }

        .sub-text-meta { display: flex; flex-direction: column; }
        .sub-name-label { font-weight: 800; font-size: 16px; color: #ffffff; }
        .sub-status-label { font-size: 11px; font-weight: 600; opacity: 0.5; color: #ffffff; }

        .sub-delete-btn {
          background: rgba(255, 68, 68, 0.1);
          border: none; color: #ff4444;
          width: 38px; height: 38px; border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
        }

        .modern-modal-footer { padding: 0 20px 20px; }
        .footer-action-btn {
          width: 100%; padding: 16px; border-radius: 18px;
          border: none; font-weight: 800; font-size: 15px;
          cursor: pointer;
        }
        .footer-action-btn.primary { background: #8c67f6; color: white; }

        /* 🔥 АДАПТАЦИЯ ТЕМЫ */
        @media (prefers-color-scheme: light) {
          .modern-modal-content { background: #ffffff; }
          .header-title-text, .header-subtitle-text, .sub-name-label, .sub-status-label { color: #1a1a1a !important; }
          .close-circle-btn { color: #1a1a1a; background: #eee; }
          .sub-card-item { background: #f8f9fa; }
        }
      `}</style>
    </div>
  );
};