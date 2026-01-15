// src/components/SupportModal.tsx
import React, { useState } from 'react';

/**
 * Интерфейс пропсов для компонента SupportModal
 */
interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (message: string) => void;
  isLoading?: boolean;
}

/**
 * 🔥 SupportModal: Окно обращения в техническую поддержку.
 * Реализована полная адаптация под мобильные телефоны и планшеты.
 * Дизайн: Glassmorphism, адаптивные темы, высокая контрастность текста.
 */
export const SupportModal: React.FC<SupportModalProps> = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  isLoading = false 
}) => {
  const [message, setMessage] = useState('');

  // Если окно закрыто, компонент ничего не возвращает в DOM
  if (!isOpen) return null;

  /**
   * Логика отправки сообщения с предварительной валидацией на длину текста
   */
  const handleSend = () => {
    const trimmedMessage = message.trim();
    if (trimmedMessage.length < 5) return;
    
    // Вызов функции отправки, переданной из родительского компонента Schedule
    onSubmit(trimmedMessage);
    
    // Очистка локального состояния текста после отправки
    setMessage('');
  };

  return (
    <div className="modern-support-overlay" onClick={onClose}>
      <div className="modern-support-content" onClick={(e) => e.stopPropagation()}>
        
        {/* Шапка окна техподдержки с градиентным бейджем */}
        <div className="modern-support-header">
          <div className="header-info-group">
            <div className="header-badge-support">
              <span className="material-icons">contact_support</span>
            </div>
            <div className="header-labels">
              <span className="header-main-title">Техподдержка</span>
              <span className="header-sub-title">Опишите вашу проблему</span>
            </div>
          </div>
          <button className="header-close-btn" onClick={onClose} title="Закрыть">
            <span className="material-icons">close</span>
          </button>
        </div>

        {/* Тело модального окна: поле ввода и информационная карточка */}
        <div className="modern-support-body">
          <div className="input-wrapper">
            <textarea 
              className="support-message-area"
              placeholder="Напишите, что у вас случилось или предложите идею..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={isLoading}
            />
            <div className="input-footer-info">
              <span className={`char-status ${message.trim().length >= 5 ? 'valid' : ''}`}>
                {message.trim().length < 5 
                  ? `Минимум 5 симв. (осталось ${5 - message.trim().length})` 
                  : 'Текст готов к отправке'}
              </span>
            </div>
          </div>
          
          <div className="support-status-card">
            <div className="status-icon">
              <span className="material-icons">verified_user</span>
            </div>
            <div className="status-text">
              <p className="status-p">Ваше обращение будет рассмотрено разработчиками в приоритетном порядке.</p>
            </div>
          </div>
        </div>

        {/* Футер: кнопка отправки с анимацией загрузки */}
        <div className="modern-support-footer">
          <button 
            className={`send-action-btn ${message.trim().length < 5 || isLoading ? 'btn-disabled' : ''}`} 
            onClick={handleSend}
            disabled={message.trim().length < 5 || isLoading}
          >
            <div className="btn-content">
              {isLoading ? (
                <>
                  <span className="material-icons spin-loader">sync</span>
                  <span>Отправка...</span>
                </>
              ) : (
                <>
                  <span className="material-icons">send</span>
                  <span>Отправить обращение</span>
                </>
              )}
            </div>
          </button>
        </div>
      </div>

      <style>{`
        /* Базовый оверлей с эффектом размытия заднего плана */
        .modern-support-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px); display: flex;
          align-items: center; justify-content: center; z-index: 9999;
          animation: supportFadeIn 0.35s cubic-bezier(0.4, 0, 0.2, 1); padding: 20px;
        }

        /* Контейнер модального окна с Glassmorphism */
        .modern-support-content {
          background: var(--color-surface, #1e1e1e); width: 100%; max-width: 460px;
          border-radius: 36px; box-shadow: 0 40px 120px rgba(0, 0, 0, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.08); overflow: hidden;
          display: flex; flex-direction: column; animation: supportSlideUp 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        @keyframes supportFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes supportSlideUp { 
          from { transform: translateY(100px) scale(0.9); opacity: 0; } 
          to { transform: translateY(0) scale(1); opacity: 1; } 
        }

        /* Шапка: градиенты и отступы */
        .modern-support-header {
          padding: 30px 32px 24px; display: flex; align-items: center; justify-content: space-between;
        }

        .header-info-group { display: flex; align-items: center; gap: 20px; }
        
        .header-badge-support {
          width: 52px; height: 52px; background: linear-gradient(135deg, #00f2fe 0%, #4facfe 100%);
          border-radius: 18px; display: flex; align-items: center; justify-content: center;
          color: white; box-shadow: 0 10px 25px rgba(79, 172, 254, 0.4);
        }

        .header-labels { display: flex; flex-direction: column; }
        
        /* Цвета текста для темной темы по умолчанию */
        .header-main-title { font-weight: 900; font-size: 22px; color: #ffffff !important; letter-spacing: -0.5px; }
        .header-sub-title { font-size: 14px; opacity: 0.7; color: #ffffff !important; font-weight: 600; margin-top: 2px; }

        .header-close-btn { 
          background: rgba(255, 255, 255, 0.08); border: none; width: 40px; height: 40px; 
          border-radius: 50%; display: flex; align-items: center; justify-content: center; 
          cursor: pointer; color: white; transition: all 0.2s ease; 
        }

        /* Область контента */
        .modern-support-body { padding: 0 32px 30px; }
        .input-wrapper { position: relative; margin-bottom: 24px; }

        .support-message-area {
          width: 100%; height: 160px; background: rgba(255, 255, 255, 0.05);
          border: 1.5px solid rgba(255, 255, 255, 0.1); border-radius: 24px;
          padding: 20px; color: #ffffff !important; font-family: inherit; font-size: 16px;
          resize: none; outline: none; box-sizing: border-box; transition: all 0.3s;
        }
        .support-message-area:focus { border-color: #4facfe; background: rgba(255, 255, 255, 0.08); }

        .input-footer-info { display: flex; justify-content: flex-end; margin-top: 8px; }
        .char-status { font-size: 12px; font-weight: 700; color: #ff4b5c; }
        .char-status.valid { color: #00e676; }

        /* Карточка статуса (щит) */
        .support-status-card { 
          display: flex; gap: 16px; align-items: center; padding: 18px 20px; 
          background: rgba(79, 172, 254, 0.1); border-radius: 22px; border: 1px solid rgba(79, 172, 254, 0.2); 
        }
        
        /* 🔥 ИЗМЕНЕН ЦВЕТ ЩИТА НА ЯРКИЙ (БИРЮЗОВЫЙ) */
        .status-icon { color: #00f2fe; }
        .status-icon span { font-size: 28px; }
        
        .status-p { font-size: 13px; color: #ffffff !important; opacity: 0.9; margin: 0; line-height: 1.4; font-weight: 500; }

        /* Футер и кнопка */
        .modern-support-footer { padding: 0 32px 32px; }
        .send-action-btn {
          width: 100%; padding: 20px; border-radius: 22px; border: none;
          background: linear-gradient(135deg, #8c67f6 0%, #6200ea 100%); color: white;
          font-weight: 800; font-size: 17px; cursor: pointer; transition: all 0.2s;
          box-shadow: 0 10px 25px rgba(98, 0, 234, 0.3);
        }
        .send-action-btn:active { transform: scale(0.98); }
        .send-action-btn.btn-disabled { background: #333; color: rgba(255,255,255,0.2); cursor: not-allowed; box-shadow: none; }
        
        .btn-content { display: flex; align-items: center; justify-content: center; gap: 12px; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin-loader { animation: spin 1s linear infinite; }

        /* 📱 АДАПТАЦИЯ ПОД ТЕЛЕФОНЫ (Mobile Friendly) */
        @media (max-width: 480px) {
          .modern-support-overlay { padding: 10px; }
          .modern-support-content { border-radius: 28px; }
          .modern-support-header { padding: 20px 20px 16px; }
          .header-badge-support { width: 44px; height: 44px; }
          .header-badge-support span { font-size: 24px; }
          .header-main-title { font-size: 18px; }
          .header-sub-title { font-size: 12px; }
          .header-info-group { gap: 12px; }
          
          .modern-support-body { padding: 0 20px 20px; }
          .support-message-area { border-radius: 20px; padding: 15px; height: 140px; font-size: 15px; }
          .support-status-card { padding: 14px 16px; border-radius: 18px; }
          .status-icon span { font-size: 24px; }
          .status-p { font-size: 12px; }
          
          .modern-support-footer { padding: 0 20px 20px; }
          .send-action-btn { padding: 16px; font-size: 15px; border-radius: 18px; }
        }

        /* ☀️ СВЕТЛАЯ ТЕМА */
        @media (prefers-color-scheme: light) {
          .modern-support-content { background: #ffffff; border: 1px solid rgba(0,0,0,0.05); }
          .header-main-title { color: #1a1a1a !important; }
          .header-sub-title { color: #666 !important; }
          .header-close-btn { background: #f0f0f0; color: #1a1a1a; }
          .support-message-area { background: #f8f9fa; border: 1.5px solid #eee; color: #1a1a1a !important; }
          .status-p { color: #1a1a1a !important; }
          .support-status-card { background: #f0f7ff; border-color: #d0e7ff; }
        }
      `}</style>
    </div>
  );
};