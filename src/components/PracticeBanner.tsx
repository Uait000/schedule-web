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
    
    if (c === '::' || c === ':') return { accent: '#ff0000', icon: 'fact_check', label: 'Промежуточная аттестация', text: '#ffffff' }; 
    if (c === '0') return { accent: '#92d050', icon: 'school', label: 'Учебная практика', text: '#ffffff' }; 
    if (c === '8') return { accent: '#ffff00', icon: 'engineering', label: 'Производственная практика', text: '#000000' }; 
    if (c === 'X' || c === 'Х') return { accent: '#ffc000', icon: 'work_history', label: 'Преддипломная практика', text: '#ffffff' }; 
    if (c === '=') return { accent: '#00b0f0', icon: 'beach_access', label: 'Каникулы', text: '#ffffff' }; 
    if (c === 'III') return { accent: '#7030a0', icon: 'workspace_premium', label: 'ГИА', text: '#ffffff' }; 
    if (c === 'D' || c === 'Д') return { accent: '#e6b8af', icon: 'history_edu', label: 'Подготовка к ГИА', text: '#ffffff' }; 
    
    switch(type) {
      case 'holiday': return { accent: '#00b0f0', icon: 'beach_access', label: 'Каникулы', text: '#ffffff' };
      case 'attestation': return { accent: '#ff0000', icon: 'fact_check', label: 'Аттестация', text: '#ffffff' };
      default: return { accent: '#f97316', icon: 'event_note', label: 'Событие', text: '#ffffff' };
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
          <div className="icon-box" style={{ backgroundColor: `${style.accent}33` }}>
            <span className="material-icons" style={{ fontSize: '24px', color: style.accent }}>{style.icon}</span>
          </div>
          
          <div className="text-content">
            <div className="banner-title" style={{ color: '#ffffff' }}>{displayTitle}</div>
            <div className="banner-dates" style={{ color: 'rgba(255, 255, 255, 0.75)' }}>{dateString}</div>
          </div>
        </div>

        <span className="material-icons arrow-icon" style={{ color: '#ffffff' }}>chevron_right</span>
      </div>

      <style>{`
        .practice-banner-container {
            background-color: var(--color-surface-container);
            border-radius: 16px;
            padding: 12px 16px;
            /* Исправлено: убраны боковые отступы 16px, чтобы ширина совпадала с другими плашками */
            margin: 0 0 16px 0; 
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: space-between;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
            border: 1px solid var(--color-border);
            position: relative;
            overflow: hidden;
            transition: transform 0.1s ease;
            width: 100%;
            box-sizing: border-box;
        }

        .practice-banner-container:active { transform: scale(0.97); }

        .accent-bar { position: absolute; left: 0; top: 0; bottom: 0; width: 6px; }

        .content-wrapper { display: flex; align-items: center; gap: 14px; flex: 1; }

        .icon-box { 
            min-width: 42px; height: 42px; border-radius: 12px; 
            display: flex; align-items: center; justify-content: center; 
            flex-shrink: 0;
        }

        .text-content { 
            display: flex; flex-direction: column; 
            justify-content: center; height: 42px; 
        }

        .banner-title { 
            font-weight: 800; font-size: 15px; line-height: 1.2; 
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }

        .banner-dates { font-size: 13px; font-weight: 600; margin-top: 1px; }

        .arrow-icon { opacity: 0.6; font-size: 20px; margin-left: 8px; }
      `}</style>
    </>
  );
};