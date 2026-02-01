// src/components/RateModal.tsx
import React, { useState } from 'react';
import { createPortal } from 'react-dom';

interface RateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (stars: number, comment: string) => Promise<boolean>;
}

export function RateModal({ isOpen, onClose, onSubmit }: RateModalProps) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showError, setShowError] = useState(false);

  if (!isOpen) return null;

  // ЛОГИКА: Если 5 звезд — форма валидна сразу. Если меньше — нужен коммент.
  const isFormValid = stars === 5 || (stars > 0 && comment.trim().length > 0);

  const handleSend = async () => {
    if (!isFormValid || isSubmitting) return;
    
    setIsSubmitting(true);
    const success = await onSubmit(stars, comment);
    setIsSubmitting(false);
    
    if (success) {
      onClose();
    } else {
      setShowError(true);
    }
  };

  return createPortal(
    <div className="rate-overlay" onClick={() => { if (!isSubmitting) onClose(); }}>
      <div className="rate-card" onClick={e => e.stopPropagation()}>
        <div className="rate-content">
          <h2 className="rate-title">Оцените приложение</h2>
          <p className="rate-subtitle">Нам очень важно ваше мнение!</p>

          <div className="cat-selector">
            {[1, 2, 3, 4, 5].map((num) => (
              <button
                key={num}
                onClick={() => { setStars(num); setShowError(false); }}
                className={`cat-item ${stars >= num ? 'active' : ''} ${stars === num ? 'selected' : ''}`}
                type="button"
                disabled={isSubmitting}
              >
                <span className="cat-icon">
                    {['😿', '😾', '🐱', '😺', '😻'][num - 1]}
                </span>
              </button>
            ))}
          </div>

          <div style={{ width: '100%', position: 'relative' }}>
            <textarea
              placeholder={stars === 5 ? "Ваш отзыв (необязательно)" : "Расскажите, что вам понравилось или чего не хватает..."}
              value={comment}
              onChange={(e) => { setComment(e.target.value); setShowError(false); }}
              className={`rate-input ${stars > 0 && stars < 5 && comment.trim().length === 0 ? 'warning' : ''}`}
              disabled={isSubmitting}
            />
            {stars > 0 && stars < 5 && comment.trim().length === 0 && (
              <p className="rate-hint-error">
                Пожалуйста, напишите текст отзыва...
              </p>
            )}
            {stars === 5 && comment.trim().length === 0 && (
              <p className="rate-hint-success">
                Вы можете отправить отзыв без текста ✨
              </p>
            )}
          </div>

          <div className="rate-buttons">
            <button
              className="btn-send"
              onClick={handleSend}
              disabled={!isFormValid || isSubmitting}
            >
              {isSubmitting ? 'Отправка...' : 'Отправить отзыв'}
            </button>
            {!isSubmitting && (
              <button className="btn-later" onClick={onClose} type="button">
                Позже
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .rate-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0, 0, 0, 0.8); backdrop-filter: blur(15px);
          -webkit-backdrop-filter: blur(15px); z-index: 99999;
          display: flex; align-items: center; justify-content: center; padding: 16px;
          animation: rateFadeIn 0.3s ease-out;
        }

        .rate-card {
          background: var(--color-surface, #1c1c1e);
          width: min(420px, 95vw); border-radius: 32px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 40px 100px rgba(0, 0, 0, 0.6);
          overflow: hidden; animation: rateSlideUp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        .rate-content { padding: 32px; display: flex; flex-direction: column; align-items: center; text-align: center; }

        .rate-title { margin: 0 0 8px 0; font-size: 26px; font-weight: 950; color: #fff; letter-spacing: -0.5px; }

        .rate-subtitle { margin: 0 0 30px 0; font-size: 15px; color: rgba(255,255,255,0.5); font-weight: 600; }

        .cat-selector { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 30px; width: 100%; }

        .cat-item {
          background: rgba(255,255,255,0.03); border: none; padding: 12px 4px; cursor: pointer;
          transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          border-radius: 20px; flex: 1; filter: grayscale(1) opacity(0.3);
        }

        .cat-item.active { filter: grayscale(0) opacity(0.7); background: rgba(140, 103, 246, 0.1); }
        .cat-item.selected { filter: grayscale(0) opacity(1); background: rgba(140, 103, 246, 0.2); transform: scale(1.1); }

        .cat-icon { font-size: 42px; line-height: 1; display: block; }

        .rate-input {
          width: 100%; height: 130px; border-radius: 20px; padding: 18px;
          background: rgba(255, 255, 255, 0.05); border: 1.5px solid rgba(255, 255, 255, 0.1);
          color: #fff; margin-bottom: 20px; resize: none; font-size: 15px; font-weight: 500;
          font-family: inherit; outline: none; box-sizing: border-box; transition: all 0.3s;
        }

        .rate-input:focus { border-color: #8c67f6; background: rgba(255, 255, 255, 0.08); }
        .rate-input.warning { border-color: #ff4757; background: rgba(255, 71, 87, 0.05); }

        .rate-hint-error { color: #ff4757; font-size: 13px; margin: -15px 0 15px 0; font-weight: 700; text-align: left; width: 100%; padding-left: 10px; }
        .rate-hint-success { color: #4cd964; font-size: 13px; margin: -15px 0 15px 0; font-weight: 700; text-align: left; width: 100%; padding-left: 10px; }

        .rate-buttons { display: flex; flex-direction: column; gap: 10px; width: 100%; }

        .btn-send {
          width: 100%; padding: 18px; border-radius: 20px; border: none;
          background: #8c67f6; color: white; font-weight: 900; font-size: 17px;
          cursor: pointer; transition: all 0.3s; box-shadow: 0 10px 25px rgba(140, 103, 246, 0.3);
        }

        .btn-send:disabled { background: #3a3a3c; color: rgba(255, 255, 255, 0.2); cursor: not-allowed; box-shadow: none; }
        .btn-send:not(:disabled):active { transform: scale(0.98); }

        .btn-later { background: none; border: none; color: rgba(255,255,255,0.4); font-weight: 700; font-size: 14px; padding: 10px; cursor: pointer; transition: color 0.2s; }
        .btn-later:hover { color: #fff; }

        @keyframes rateFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes rateSlideUp { from { transform: translateY(40px) scale(0.9); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }

        @media (prefers-color-scheme: light) {
          .rate-overlay { background: rgba(0, 0, 0, 0.4); }
          .rate-card { background: #fff; border-color: rgba(0,0,0,0.05); box-shadow: 0 30px 60px rgba(0,0,0,0.15); }
          .rate-title { color: #000; }
          .rate-subtitle { color: rgba(0,0,0,0.4); }
          .cat-item { background: rgba(0,0,0,0.03); }
          .rate-input { background: #f2f2f7; border-color: rgba(0,0,0,0.05); color: #000; }
          .btn-later { color: rgba(0,0,0,0.3); }
        }
      `}</style>
    </div>,
    document.body
  );
}