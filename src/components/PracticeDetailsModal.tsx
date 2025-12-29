// src/components/PracticeDetailsModal.tsx
import React, { useState } from 'react';
import { PracticeInfo, CalendarEvent } from '../utils/practiceUtils';
import { format, parseISO, isAfter, startOfDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Calendar, Clock, X, LogIn, Navigation, ChevronDown } from 'lucide-react';

interface PracticeDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  info: PracticeInfo | null;
  currentProfileId: string;
  calendarEvents: CalendarEvent[];
  onNavigateToDate: (date: Date, message: string) => void;
}

export const PracticeDetailsModal: React.FC<PracticeDetailsModalProps> = ({ 
  isOpen, 
  onClose, 
  info, 
  currentProfileId, 
  calendarEvents,
  onNavigateToDate
}) => {
  const [isJumpMenuOpen, setIsJumpMenuOpen] = useState(false);

  if (!isOpen || !info) return null;

  // Логика определения курса (например из КС-2-1 берем "2")
  const studentYear = parseInt(currentProfileId.split('-')[1]);
  const showJumpButton = !isNaN(studentYear) && studentYear >= 2 && studentYear <= 4;

  const getStyleByCode = (code: string | undefined) => {
    const c = (code || '').trim().toUpperCase();
    if (c === '::' || c === ':') return { color: '#ff4444', bg: 'rgba(255, 68, 68, 0.15)' };
    if (c === '0') return { color: '#92d050', bg: 'rgba(146, 208, 80, 0.15)' };
    if (c === '8') return { color: '#eab308', bg: 'rgba(234, 179, 8, 0.15)' };
    if (c === 'X' || c === 'Х') return { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' };
    if (c === '=') return { color: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.15)' };
    if (c === 'III') return { color: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)' };
    if (c === 'D' || c === 'Д') return { color: '#e6b8af', bg: 'rgba(230, 184, 175, 0.15)' };
    return { color: '#f97316', bg: 'rgba(249, 115, 22, 0.15)' };
  };

  const handleJump = (type: 'practice' | 'attestation' | 'holiday') => {
    const now = startOfDay(new Date());
    
    // Ищем ближайшее событие нужного типа, которое начнется после "сегодня"
    const nearestEvent = calendarEvents
      .filter(event => {
        const eventStart = parseISO(event.dateStart);
        if (type === 'attestation') return (event.type === 'attestation' || event.code === '::') && isAfter(eventStart, now);
        if (type === 'holiday') return event.type === 'holiday' && isAfter(eventStart, now);
        if (type === 'practice') return (event.type === 'practice' || ['0','8','X','Х'].includes(event.code)) && isAfter(eventStart, now);
        return false;
      })
      .sort((a, b) => parseISO(a.dateStart).getTime() - parseISO(b.dateStart).getTime())[0];

    if (nearestEvent) {
      const targetDate = parseISO(nearestEvent.dateStart);
      const msg = `Переход к: ${nearestEvent.title} (${format(targetDate, 'd MMMM', {locale: ru})})`;
      onNavigateToDate(targetDate, msg);
      onClose();
    } else {
      alert("Ближайших событий этого типа не найдено");
    }
  };

  const theme = getStyleByCode(info.code);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="title-group">
             <div className="type-badge" style={{ backgroundColor: theme.bg, color: theme.color }}>
                {info.code || '!'}
             </div>
             <h2 className="modal-title">{info.name}</h2>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={24} color="var(--color-text)" />
          </button>
        </div>

        <div className="modal-body">
          <div className="info-row">
            <div className="row-left">
              <div className="icon-box" style={{ color: theme.color, backgroundColor: theme.bg }}>
                <Calendar size={20} />
              </div>
              <span className="row-label">Период события</span>
            </div>
            <div className="row-value">
              с {format(info.dateStart, 'd MMMM', {locale: ru})} 
              {info.dateEnd && <> по {format(info.dateEnd, 'd MMMM', {locale: ru})}</>}
            </div>
          </div>

          <div className="divider" />

          {info.returnDate && (
            <>
              <div className="info-row">
                <div className="row-left">
                  <div className="icon-box" style={{ color: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.15)' }}>
                    <LogIn size={20} />
                  </div>
                  <span className="row-label">Выход на учебу</span>
                </div>
                <div className="row-value" style={{ color: '#10b981', fontWeight: 800 }}>
                  {format(info.returnDate, 'd MMMM yyyy', { locale: ru })}
                </div>
              </div>
              <div className="divider" />
            </>
          )}

          <div className="info-row">
            <div className="row-left">
              <div className="icon-box" style={{ color: theme.color, backgroundColor: theme.bg }}>
                <Clock size={20} />
              </div>
              <span className="row-label">Текущий статус</span>
            </div>
            <div className="row-value" style={{ color: theme.color, fontWeight: 900, textTransform: 'uppercase' }}>
              {info.isActive ? 'УЖЕ ИДЕТ' : (
                  info.daysUntil === 0 ? 'НАЧНЕТСЯ СЕГОДНЯ' : `ЧЕРЕЗ ${info.daysUntil} ДН.`
              )}
            </div>
          </div>

          {/* 🔥 НОВАЯ СЕКЦИЯ ПЕРЕХОДА */}
          {showJumpButton && (
            <div className="jump-section">
              <button 
                className="jump-main-btn" 
                onClick={() => setIsJumpMenuOpen(!isJumpMenuOpen)}
                style={{ border: `1px solid ${theme.color}44` }}
              >
                <div className="btn-content">
                  <Navigation size={18} className="nav-icon" />
                  <span>Найти ближайшее...</span>
                </div>
                <ChevronDown size={18} className={`chevron ${isJumpMenuOpen ? 'rotated' : ''}`} />
              </button>

              {isJumpMenuOpen && (
                <div className="jump-options">
                  <button onClick={() => handleJump('practice')}>📈 Ближайшая практика</button>
                  <button onClick={() => handleJump('attestation')}>📝 Ближайший экзамен</button>
                  <button onClick={() => handleJump('holiday')}>🌴 Ближайшие каникулы</button>
                </div>
              )}
            </div>
          )}
        </div>

        <button className="modal-button" onClick={onClose} style={{ 
            backgroundColor: theme.color, 
            color: '#ffffff' 
        }}>
          ПОНЯТНО
        </button>
      </div>

      <style>{`
        .modal-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.4); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(8px); animation: fadeIn 0.2s; }
        .modal-card { background: var(--color-surface); width: 100%; max-width: 390px; border-radius: 32px; box-shadow: 0 20px 50px rgba(0,0,0,0.15); overflow: hidden; animation: slideUp 0.3s; border: 1px solid var(--color-border); }
        .modal-header { padding: 28px 24px 18px; display: flex; justify-content: space-between; align-items: flex-start; }
        .title-group { display: flex; flex-direction: column; gap: 12px; }
        .type-badge { width: fit-content; padding: 5px 14px; border-radius: 12px; font-weight: 900; font-size: 13px; text-transform: uppercase; }
        .modal-title { font-size: 21px; font-weight: 800; margin: 0; line-height: 1.25; letter-spacing: -0.3px; color: var(--color-text); }
        .close-btn { background: var(--color-surface-variant); border: none; cursor: pointer; padding: 10px; border-radius: 50%; display: flex; opacity: 0.8; }
        .modal-body { padding: 0 24px 28px; }
        .info-row { display: flex; justify-content: space-between; align-items: center; padding: 14px 0; min-height: 48px; }
        .row-left { display: flex; align-items: center; gap: 14px; }
        .icon-box { width: 42px; height: 42px; border-radius: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .row-label { font-size: 14px; font-weight: 600; color: var(--color-text); opacity: 0.6; }
        .row-value { font-size: 15px; font-weight: 700; text-align: right; max-width: 160px; line-height: 1.35; color: var(--color-text); }
        .divider { height: 1px; background: var(--color-border); margin: 4px 0; opacity: 0.5; }
        
        .jump-section { margin-top: 10px; position: relative; }
        .jump-main-btn { width: 100%; padding: 14px 18px; border-radius: 16px; background: var(--color-surface-container); color: var(--color-text); display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: all 0.2s; }
        .jump-main-btn .btn-content { display: flex; align-items: center; gap: 10px; font-weight: 700; }
        .jump-main-btn .nav-icon { color: var(--color-primary); }
        .jump-main-btn .chevron { transition: transform 0.3s; opacity: 0.5; }
        .jump-main-btn .chevron.rotated { transform: rotate(180deg); }
        
        .jump-options { margin-top: 8px; background: var(--color-surface-container-high); border-radius: 16px; padding: 6px; display: flex; flex-direction: column; gap: 4px; border: 1px solid var(--color-border); box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
        .jump-options button { padding: 12px 14px; border-radius: 10px; border: none; background: transparent; color: var(--color-text); text-align: left; font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
        .jump-options button:active { background: var(--color-primary-container); }
        
        .modal-button { display: block; width: calc(100% - 48px); margin: 0 24px 28px; padding: 18px; border: none; border-radius: 20px; font-size: 16px; font-weight: 900; cursor: pointer; letter-spacing: 1px; transition: all 0.2s ease; }
        .modal-button:active { transform: scale(0.96); opacity: 0.9; }
        
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </div>
  );
};