// src/components/PracticeDetailsModal.tsx
import React from 'react';
import { PracticeInfo } from '../utils/practiceUtils';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Calendar, ArrowRight, Clock, X, LogIn } from 'lucide-react';

interface PracticeDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  info: PracticeInfo | null;
}

export const PracticeDetailsModal: React.FC<PracticeDetailsModalProps> = ({ isOpen, onClose, info }) => {
  if (!isOpen || !info) return null;

  const getStyleByCode = (code: string | undefined) => {
    const c = (code || '').trim().toUpperCase();
    if (c === '::' || c === ':') return { color: '#ff4444', bg: 'rgba(255, 68, 68, 0.15)' };
    if (c === '0') return { color: '#92d050', bg: 'rgba(146, 208, 80, 0.15)' };
    if (c === '8') return { color: '#ffff00', bg: 'rgba(255, 255, 0, 0.15)' };
    if (c === 'X' || c === 'Х') return { color: '#ffc000', bg: 'rgba(255, 192, 0, 0.15)' };
    if (c === '=') return { color: '#00b0f0', bg: 'rgba(0, 176, 240, 0.15)' };
    if (c === 'III') return { color: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)' };
    if (c === 'D' || c === 'Д') return { color: '#e6b8af', bg: 'rgba(230, 184, 175, 0.15)' };
    return { color: '#f97316', bg: 'rgba(249, 115, 22, 0.15)' };
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
             <h2 className="modal-title" style={{ color: '#ffffff' }}>{info.name}</h2>
          </div>
          <button className="close-btn" onClick={onClose}><X size={24} color="#ffffff" /></button>
        </div>

        <div className="modal-body">
          {/* Период */}
          <div className="info-row">
            <div className="row-left">
              <div className="icon-box" style={{ color: theme.color, backgroundColor: theme.bg }}>
                <Calendar size={20} />
              </div>
              <span className="row-label">Период события</span>
            </div>
            <div className="row-value" style={{ color: '#ffffff' }}>
              с {format(info.dateStart, 'd MMMM', {locale: ru})} 
              {info.dateEnd && <> по {format(info.dateEnd, 'd MMMM', {locale: ru})}</>}
            </div>
          </div>

          <div className="divider" />

          {/* Выход на учебу */}
          {info.returnDate && (
            <>
              <div className="info-row">
                <div className="row-left">
                  <div className="icon-box" style={{ color: '#4ade80', backgroundColor: 'rgba(74, 222, 128, 0.15)' }}>
                    <LogIn size={20} />
                  </div>
                  <span className="row-label">Выход на учебу</span>
                </div>
                <div className="row-value" style={{ color: '#4ade80', fontWeight: 800 }}>
                  {format(info.returnDate, 'd MMMM yyyy', { locale: ru })}
                </div>
              </div>
              <div className="divider" />
            </>
          )}

          {/* Статус */}
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
        </div>

        <button className="modal-button" onClick={onClose} style={{ 
            backgroundColor: theme.color, 
            color: (info.code === '8' ? '#000000' : '#ffffff') 
        }}>
          ПОНЯТНО
        </button>
      </div>

      <style>{`
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(12px); animation: fadeIn 0.2s; }
        .modal-card { background: #1a1b26; width: 100%; max-width: 390px; border-radius: 32px; box-shadow: 0 25px 60px rgba(0,0,0,0.6); overflow: hidden; animation: slideUp 0.3s; border: 1px solid rgba(255,255,255,0.08); }
        .modal-header { padding: 28px 24px 18px; display: flex; justify-content: space-between; align-items: flex-start; }
        .title-group { display: flex; flex-direction: column; gap: 12px; }
        .type-badge { width: fit-content; padding: 5px 14px; border-radius: 12px; font-weight: 900; font-size: 13px; text-transform: uppercase; }
        .modal-title { font-size: 21px; font-weight: 800; margin: 0; line-height: 1.25; letter-spacing: -0.3px; }
        .close-btn { background: rgba(255,255,255,0.06); border: none; cursor: pointer; padding: 10px; border-radius: 50%; display: flex; }
        .modal-body { padding: 0 24px 28px; }
        
        .info-row { 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            padding: 14px 0;
            min-height: 48px;
        }
        
        .row-left { display: flex; align-items: center; gap: 14px; }
        
        .icon-box { 
            width: 42px; height: 42px; border-radius: 14px; 
            display: flex; align-items: center; justify-content: center; 
            flex-shrink: 0;
        }
        
        .row-label { font-size: 14px; font-weight: 600; color: #949cbb; }
        
        .row-value { 
            font-size: 15px; font-weight: 700; text-align: right; 
            max-width: 160px; line-height: 1.35;
        }
        
        .divider { height: 1px; background: rgba(255,255,255,0.06); margin: 4px 0; }
        
        .modal-button { 
            display: block; width: calc(100% - 48px); margin: 0 24px 28px; 
            padding: 18px; border: none; border-radius: 20px; 
            font-size: 16px; font-weight: 900; cursor: pointer; 
            letter-spacing: 1.5px; transition: all 0.2s ease;
        }
        .modal-button:active { transform: scale(0.96); opacity: 0.9; }
        
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </div>
  );
};