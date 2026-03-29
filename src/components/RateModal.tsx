import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface RateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (stars: number, comment: string) => Promise<boolean>;
}

type ModalStep = 'rating' | 'support';

export function RateModal({ isOpen, onClose, onSubmit }: RateModalProps) {
  const [stars, setStars] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<ModalStep>('rating');
  
  const [clickCount, setClickCount] = useState(0);
  const isEasterEggVisible = clickCount >= 5;

  useEffect(() => {
    if (isOpen) {
      setStars(0);
      setStep('rating');
      setClickCount(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSend = async () => {
    if (stars === 0 || isSubmitting) return;
    
    setIsSubmitting(true);
    const success = await onSubmit(stars, "");
    
    if (success) {
      if (stars <= 3) {
        setStep('support'); // Показываем окно с ссылками
        setIsSubmitting(false);
      } else {
        onClose(); // Закрываем (для 4-5 звезд)
      }
    } else {
      setIsSubmitting(false);
    }
  };

  const renderRatingStep = () => (
    <div className="rate-content">
      <h2 className="rate-title" onClick={() => setClickCount(v => v + 1)}>
        Оцените приложение
      </h2>
      <p className="rate-subtitle">Нам очень важно ваше мнение!</p>

      <div className="cat-selector">
        {[1, 2, 3, 4, 5].map((num) => (
          <button
            key={num}
            onClick={() => setStars(num)}
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

      <div className="rate-buttons">
        <button
          className="btn-send"
          onClick={handleSend}
          disabled={stars === 0 || isSubmitting}
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
  );

  const renderSupportStep = () => (
    <div className="rate-content support-view">
      <div className="cat-icon big-cat">😿</div>
      <h2 className="rate-title">Мы стараемся стать лучше</h2>
      <p className="support-text">
        Мы стараемся сделать приложение лучше. Если хочешь, можешь рассказать о проблеме подробнее нам в <b>Telegram</b> или <b>ВКонтакте</b>. 
        Можно также попробовать <b>Android версию</b> (не подходит для iPhone).
      </p>
      
      <div className="support-links">
        <a href="https://t.me/ttgtapps" target="_blank" rel="noreferrer" className="link-btn tg">Telegram</a>
        <a href="https://vk.com/ttgtapps" target="_blank" rel="noreferrer" className="link-btn vk">ВКонтакте</a>
        <a href="https://schedulettgt.ru/schedule/android/download" target="_blank" rel="noreferrer" className="link-btn android">Скачать на Android</a>
      </div>

      <button className="btn-send secondary" onClick={onClose}>Закрыть</button>
    </div>
  );

  return createPortal(
    <div className="rate-overlay" onClick={() => { if (!isSubmitting) onClose(); }}>
      <div className="rate-card" onClick={e => e.stopPropagation()}>
        {step === 'rating' ? renderRatingStep() : renderSupportStep()}
        
        {isEasterEggVisible && (
          <div className="easter-egg">Создатель 🐾 by CatG_KS</div>
        )}
      </div>

      <style>{`
        .rate-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0, 0, 0, 0.8); backdrop-filter: blur(15px);
          z-index: 99999; display: flex; align-items: center; justify-content: center; padding: 16px;
        }

        .rate-card {
          background: var(--color-surface, #1c1c1e);
          width: min(420px, 95vw); border-radius: 32px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 40px 100px rgba(0, 0, 0, 0.6);
          overflow: hidden; position: relative;
          animation: rateSlideUp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        .rate-content { padding: 32px; display: flex; flex-direction: column; align-items: center; text-align: center; }
        .rate-title { margin: 0 0 8px 0; font-size: 24px; font-weight: 950; color: #fff; cursor: pointer; user-select: none; }
        .rate-subtitle { margin: 0 0 24px 0; font-size: 15px; color: rgba(255,255,255,0.4); font-weight: 600; }

        .cat-selector { 
          display: flex; justify-content: space-between; 
          gap: 4px; margin-bottom: 30px; width: 100%; box-sizing: border-box;
        }

        .cat-item {
          background: rgba(255,255,255,0.03); border: none; padding: 12px 0;
          cursor: pointer; border-radius: 16px; flex: 1; filter: grayscale(1) opacity(0.3);
          transition: all 0.2s ease; min-width: 0;
        }

        .cat-item.active { filter: grayscale(0) opacity(0.7); background: rgba(140, 103, 246, 0.1); }
        .cat-item.selected { filter: grayscale(0) opacity(1); background: rgba(140, 103, 246, 0.2); transform: scale(1.05); }

        .cat-icon { font-size: clamp(22px, 7vw, 42px); line-height: 1; display: block; }
        .big-cat { font-size: 64px; margin-bottom: 12px; filter: none; opacity: 1; }

        .support-text { color: rgba(255,255,255,0.7); font-size: 14px; line-height: 1.5; margin-bottom: 24px; }
        .support-links { display: flex; flex-direction: column; gap: 10px; width: 100%; margin-bottom: 20px; }
        
        .link-btn {
          padding: 16px; border-radius: 18px; text-decoration: none; 
          font-weight: 800; font-size: 15px; transition: 0.2s;
          display: block; text-align: center;
        }
        .tg { background: #0088cc; color: #fff; }
        .vk { background: #0077ff; color: #fff; }
        .android { background: #3ddc84; color: #073042; }

        .btn-send {
          width: 100%; padding: 18px; border-radius: 20px; border: none;
          background: #8c67f6; color: white; font-weight: 900; font-size: 17px;
          cursor: pointer; transition: all 0.3s;
        }
        .btn-send.secondary { background: rgba(255,255,255,0.08); font-size: 15px; margin-top: 10px; }
        .btn-send:disabled { background: #3a3a3c; color: rgba(255, 255, 255, 0.2); }

        .btn-later { background: none; border: none; color: rgba(255,255,255,0.3); font-weight: 700; padding: 10px; cursor: pointer; }

        .easter-egg {
          position: absolute; bottom: 10px; width: 100%; text-align: center;
          font-size: 10px; color: rgba(255,255,255,0.15); pointer-events: none;
          text-transform: uppercase; letter-spacing: 1px;
        }

        @keyframes rateSlideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

        @media (max-width: 380px) {
          .rate-content { padding: 24px 16px; }
          .cat-icon { font-size: clamp(20px, 6vw, 26px); }
        }
      `}</style>
    </div>,
    document.body
  );
}