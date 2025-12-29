import React, { useState } from 'react';
import { createPortal } from 'react-dom';

interface RateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (stars: number, comment: string) => void;
}

export function RateModal({ isOpen, onClose, onSubmit }: RateModalProps) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSend = async () => {
    if (stars === 0) return;
    setIsSubmitting(true);
    await onSubmit(stars, comment);
    setIsSubmitting(false);
    onClose();
  };

  return createPortal(
    <div className="rate-overlay" onClick={onClose}>
      <div className="rate-card" onClick={e => e.stopPropagation()}>
        <div className="rate-content">
          <h2 className="rate-title">Оцените приложение</h2>
          <p className="rate-subtitle">Нам очень важно ваше мнение!</p>

          <div className="cat-selector">
            {[1, 2, 3, 4, 5].map((num) => (
              <button
                key={num}
                onClick={() => setStars(num)}
                className={`cat-item ${stars >= num ? 'active' : ''}`}
                type="button"
              >
                <span className="cat-icon">
                    {['😿', '😾', '🐱', '😺', '😻'][num - 1]}
                </span>
              </button>
            ))}
          </div>

          <textarea
            placeholder="Расскажите, что вам понравилось или чего не хватает..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="rate-input"
          />

          <div className="rate-buttons">
            <button
              className="btn-send"
              onClick={handleSend}
              disabled={stars === 0 || isSubmitting}
            >
              {isSubmitting ? 'Отправка...' : 'Отправить отзыв'}
            </button>
            <button className="btn-later" onClick={onClose} type="button">
              Позже
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .rate-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(15px);
          -webkit-backdrop-filter: blur(15px);
          z-index: 99999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px; /* Отступ от краев экрана на мобилках */
          animation: rateFadeIn 0.3s ease-out;
        }

        .rate-card {
          background: #1c1c1e;
          width: 100%;
          max-width: 400px;
          /* Адаптивная ширина: не более 95% экрана на маленьких устройствах */
          width: min(400px, 95vw); 
          border-radius: 28px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: 0 30px 60px rgba(0, 0, 0, 0.6);
          overflow: hidden;
          animation: rateSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .rate-content {
          padding: min(32px, 6vw);
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .rate-title {
          margin: 0 0 8px 0;
          font-size: clamp(18px, 5vw, 24px); /* Текст уменьшается на маленьких экранах */
          font-weight: 900;
          color: #ffffff;
          font-family: 'Inter', sans-serif;
          letter-spacing: -0.5px;
        }

        .rate-subtitle {
          margin: 0 0 24px 0;
          font-size: clamp(13px, 4vw, 15px);
          color: rgba(255, 255, 255, 0.6);
          font-weight: 600;
        }

        .cat-selector {
          display: flex;
          justify-content: center;
          gap: min(10px, 2vw);
          margin-bottom: 28px;
          width: 100%;
          flex-wrap: nowrap; /* Котики всегда в один ряд */
        }

        .cat-item {
          background: none;
          border: none;
          padding: 4px;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          filter: grayscale(1) opacity(0.2);
          flex: 1; /* Одинаковая ширина для всех кнопок */
          max-width: 60px;
        }

        .cat-item.active {
          filter: none;
          transform: scale(1.2);
        }

        .cat-icon {
          font-size: clamp(32px, 10vw, 48px); /* Скейлинг иконок */
          line-height: 1;
        }

        .rate-input {
          width: 100%;
          height: clamp(100px, 20vh, 140px);
          border-radius: 18px;
          padding: 16px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #ffffff;
          margin-bottom: 24px;
          resize: none;
          font-size: 15px;
          font-weight: 500;
          font-family: inherit;
          outline: none;
          box-sizing: border-box;
        }

        .rate-buttons {
          display: flex;
          flex-direction: column;
          gap: 8px;
          width: 100%;
        }

        .btn-send {
          width: 100%;
          padding: 16px;
          border-radius: 16px;
          border: none;
          background: #8c67f6;
          color: white;
          font-weight: 800;
          font-size: 16px;
          cursor: pointer;
          transition: all 0.3s;
        }

        .btn-send:disabled {
          background: #3a3a3c;
          color: rgba(255, 255, 255, 0.3);
          cursor: not-allowed;
        }

        .btn-later {
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.4);
          font-weight: 700;
          font-size: 14px;
          padding: 10px;
          cursor: pointer;
        }

        @keyframes rateFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes rateSlideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </div>,
    document.body
  );
}