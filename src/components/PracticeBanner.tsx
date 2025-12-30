// src/components/PracticeBanner.tsx
import React from 'react';
import { PracticeInfo } from '../utils/practiceUtils';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface PracticeBannerProps {
  info: PracticeInfo | null;
  onClick: () => void;
}

export const PracticeBanner: React.FC<PracticeBannerProps> = ({ info, onClick }) => {
  if (!info) return null;

  const getStyleByCode = (code: string | undefined, type: string) => {
    const c = (code || '').trim().toUpperCase();
    
    if (c === '::' || c === ':') return { accent: '#ff0000', icon: 'fact_check', label: 'Промежуточная аттестация' }; 
    if (c === '0') return { accent: '#92d050', icon: 'school', label: 'Учебная практика' }; 
    if (c === '8') return { accent: '#ffff00', icon: 'engineering', label: 'Производственная практика' }; 
    if (c === 'X' || c === 'Х') return { accent: '#ffc000', icon: 'work_history', label: 'Преддипломная практика' }; 
    if (c === '=') return { accent: '#00b0f0', icon: 'beach_access', label: 'Каникулы' }; 
    if (c === 'ОВС') return { accent: '#ff6600', icon: 'military_tech', label: 'Учебные сборы по ОВС' }; // 🔥 Добавлено ОВС
    if (c === 'III') return { accent: '#7030a0', icon: 'workspace_premium', label: 'ГИА' }; 
    if (c === 'D' || c === 'Д') return { accent: '#e6b8af', icon: 'history_edu', label: 'Подготовка к ГИА' }; 
    
    switch(type) {
      case 'holiday': return { accent: '#00b0f0', icon: 'beach_access', label: 'Каникулы' };
      case 'attestation': return { accent: '#ff0000', icon: 'fact_check', label: 'Аттестация' };
      default: return { accent: '#f97316', icon: 'event_note', label: 'Событие' };
    }
  };

  const style = getStyleByCode(info.code, info.type);
  const displayTitle = info.name || style.label;

  let dateString = "";
  if (info.dateStart) {
    const start = format(info.dateStart, 'd MMMM', { locale: ru });
    if (info.dateEnd) {
        const end = format(info.dateEnd, 'd MMMM', { locale: ru });
        dateString = `с ${start} по ${end}`;
    } else {
        dateString = `с ${start}`;
    }

    if (info.isActive) {
        dateString += ` • Идёт сейчас`;
    } else if (info.daysUntil > 0) {
        dateString += ` • Через ${info.daysUntil} дн.`;
    } else if (info.daysUntil === 0 && !info.isActive) {
        dateString += ` • Начнется сегодня`;
    }
  }

  return (
    <>
      <div onClick={onClick} className="practice-banner-container">
        <div className="accent-bar" style={{ backgroundColor: style.accent }} />
        
        <div className="content-wrapper">
          <div className="icon-box" style={{ backgroundColor: `${style.accent}22` }}>
            <span className="material-icons banner-icon-span" style={{ color: style.accent }}>{style.icon}</span>
          </div>
          
          <div className="text-content">
            <div className="banner-title">{displayTitle}</div>
            <div className="banner-dates">{dateString}</div>
          </div>
        </div>

        <span className="material-icons arrow-icon">chevron_right</span>
      </div>

      <style>{`
        .practice-banner-container {
            background-color: var(--color-surface-container);
            border-radius: 16px;
            padding: 12px 14px;
            margin: 0 0 16px 0; 
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: space-between;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
            border: 1px solid var(--color-border);
            position: relative;
            overflow: hidden;
            transition: transform 0.1s ease, background-color 0.2s ease;
            width: 100%;
            box-sizing: border-box;
            font-family: 'Inter', sans-serif;
        }

        .practice-banner-container:active { transform: scale(0.98); background-color: var(--color-surface-variant); }

        .accent-bar { position: absolute; left: 0; top: 0; bottom: 0; width: 5px; }

        .content-wrapper { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; }

        .icon-box { 
            min-width: 40px; width: 40px; height: 40px; border-radius: 10px; 
            display: flex; align-items: center; justify-content: center; 
            flex-shrink: 0;
        }
        
        .banner-icon-span { font-size: 22px; }

        .text-content { 
            display: flex; flex-direction: column; 
            justify-content: center; 
            min-width: 0;
            flex: 1;
        }

        .banner-title { 
            color: var(--color-text);
            font-weight: 700; 
            font-size: 15px; 
            line-height: 1.2; 
            white-space: nowrap; 
            overflow: hidden; 
            text-overflow: ellipsis;
            margin-bottom: 2px;
        }

        .banner-dates { 
            color: var(--color-text);
            opacity: 0.6;
            font-size: 12px; 
            font-weight: 500; 
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .arrow-icon { color: var(--color-text); opacity: 0.3; font-size: 20px; flex-shrink: 0; }

        @media (max-width: 380px) {
            .practice-banner-container { padding: 10px 12px; }
            .icon-box { min-width: 36px; width: 36px; height: 36px; }
            .banner-icon-span { font-size: 20px; }
            .banner-title { font-size: 14px; }
            .banner-dates { font-size: 11px; }
            .content-wrapper { gap: 10px; }
        }
      `}</style>
    </>
  );
};