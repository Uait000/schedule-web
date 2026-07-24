// src/components/SupportModal.tsx
import React from 'react';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (message: string) => void;
  isLoading?: boolean;
}

export const SupportModal: React.FC<SupportModalProps> = ({ 
  isOpen, 
  onClose, 
  isLoading = false 
}) => {
  if (!isOpen) return null;

  return (
    <div className="modern-support-overlay" onClick={onClose}>
      <div className="modern-support-content" onClick={(e) => e.stopPropagation()}>
        
        <div className="modern-support-header">
          <div className="header-info-group">
            <div className="header-badge-support">
              <span className="material-icons">contact_support</span>
            </div>
            <div className="header-labels">
              <span className="header-main-title">Техподдержка</span>
              <span className="header-sub-title">Свяжитесь с нами</span>
            </div>
          </div>
          <button className="header-close-btn" onClick={onClose} title="Закрыть">
            <span className="material-icons">close</span>
          </button>
        </div>

        <div className="modern-support-body">
          <div className="social-links-section">
            <p className="social-title">Написать напрямую:</p>
            <div className="social-buttons-grid">
              <a href="https://vk.com/ttgtapps" target="_blank" rel="noopener noreferrer" className="social-btn vk-btn">
                <svg viewBox="0 0 1000 1000" width="22" height="22">
                  <path fill="#0077FF" d="M479.6,1000.4h41.7c226.7,0,339.6,0,409.6-70c69.6-70,69.6-183.3,69.6-409.2v-42.5c0-225,0-338.3-69.6-408.3c-70-70-183.3-70-409.6-70h-41.7c-226.7,0-339.6,0-409.6,70C0.5,140.4,0.5,253.8,0.5,479.6v42.5c0,225,0,338.3,70,408.3S253.8,1000.4,479.6,1000.4z"/>
                  <path fill="#FFFFFF" d="M532.6,720.8c-227.9,0-357.9-156.2-363.3-416.2h114.2c3.8,190.8,87.9,271.7,154.6,288.3V304.6h107.5v164.6c65.8-7.1,135-82.1,158.3-164.6h107.5c-17.8,86.5-70.8,161.7-146.3,207.5C749.4,554,811.7,630,836.3,720.8H718c-22.3-79.8-90.3-138.4-172.5-148.8v148.8C545.5,720.8,532.6,720.8,532.6,720.8z"/>
                </svg>
                ВКонтакте
              </a>
              <a href="https://t.me/ttgtapps" target="_blank" rel="noopener noreferrer" className="social-btn tg-btn">
                <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.32.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.892-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
                Telegram
              </a>
            </div>
          </div>

          <div className="support-status-card">
            <div className="status-icon">
              <span className="material-icons">verified_user</span>
            </div>
            <div className="status-text">
              <p className="status-p">Нажмите на кнопку, чтобы написать нам напрямую в VK или Telegram.</p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        /* ... ВСЕ ВАШИ ПРЕДЫДУЩИЕ СТИЛИ ОСТАЮТСЯ ... */
        .modern-support-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); display: flex; align-items: center; justify-content: center; z-index: 9999; animation: supportFadeIn 0.35s cubic-bezier(0.4, 0, 0.2, 1); padding: 20px; }
        .modern-support-content { background: var(--color-surface, #1e1e1e); width: 100%; max-width: 460px; border-radius: 36px; box-shadow: 0 40px 120px rgba(0, 0, 0, 0.8); border: 1px solid rgba(255, 255, 255, 0.08); overflow: hidden; display: flex; flex-direction: column; animation: supportSlideUp 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        @keyframes supportFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes supportSlideUp { from { transform: translateY(100px) scale(0.9); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
        .modern-support-header { padding: 30px 32px 24px; display: flex; align-items: center; justify-content: space-between; }
        .header-info-group { display: flex; align-items: center; gap: 20px; }
        .header-badge-support { width: 52px; height: 52px; background: linear-gradient(135deg, #00f2fe 0%, #4facfe 100%); border-radius: 18px; display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 10px 25px rgba(79, 172, 254, 0.4); }
        .header-labels { display: flex; flex-direction: column; }
        .header-main-title { font-weight: 900; font-size: 22px; color: #ffffff !important; letter-spacing: -0.5px; }
        .header-sub-title { font-size: 14px; opacity: 0.7; color: #ffffff !important; font-weight: 600; margin-top: 2px; }
        .header-close-btn { background: rgba(255, 255, 255, 0.08); border: none; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; color: white; transition: all 0.2s ease; }
        .modern-support-body { padding: 0 32px 30px; }
        .input-wrapper { position: relative; margin-bottom: 24px; }
        .support-message-area { width: 100%; height: 160px; background: rgba(255, 255, 255, 0.05); border: 1.5px solid rgba(255, 255, 255, 0.1); border-radius: 24px; padding: 20px; color: #ffffff !important; font-family: inherit; font-size: 16px; resize: none; outline: none; box-sizing: border-box; transition: all 0.3s; }
        .support-message-area:focus { border-color: #4facfe; background: rgba(255, 255, 255, 0.08); }
        .input-footer-info { display: flex; justify-content: flex-end; margin-top: 8px; }
        .char-status { font-size: 12px; font-weight: 700; color: #ff4b5c; }
        .char-status.valid { color: #00e676; }
        .support-status-card { display: flex; gap: 16px; align-items: center; padding: 18px 20px; background: rgba(79, 172, 254, 0.1); border-radius: 22px; border: 1px solid rgba(79, 172, 254, 0.2); }
        .status-icon { color: #00f2fe; }
        .status-icon span { font-size: 28px; }
        .status-p { font-size: 13px; color: #ffffff !important; opacity: 0.9; margin: 0; line-height: 1.4; font-weight: 500; }
        .modern-support-footer { padding: 0 32px 32px; }
        .send-action-btn { width: 100%; padding: 20px; border-radius: 22px; border: none; background: linear-gradient(135deg, #8c67f6 0%, #6200ea 100%); color: white; font-weight: 800; font-size: 17px; cursor: pointer; transition: all 0.2s; box-shadow: 0 10px 25px rgba(98, 0, 234, 0.3); }
        .send-action-btn:active { transform: scale(0.98); }
        .send-action-btn.btn-disabled { background: #333; color: rgba(255,255,255,0.2); cursor: not-allowed; box-shadow: none; }
        .btn-content { display: flex; align-items: center; justify-content: center; gap: 12px; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin-loader { animation: spin 1s linear infinite; }

        /* 🔥 СТИЛИ ДЛЯ НОВЫХ КНОПОК СОЦСЕТЕЙ */
        .social-links-section { margin-bottom: 20px; }
        .social-title { font-size: 14px; font-weight: 600; color: #aaa; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px;}
        .social-buttons-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .social-btn { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 14px; border-radius: 16px; font-weight: 700; font-size: 14px; color: white !important; text-decoration: none; transition: all 0.2s ease; border: 1px solid rgba(255,255,255,0.1); }
        .vk-btn { background: rgba(0, 119, 255, 0.15); border-color: rgba(0, 119, 255, 0.3); color: #4facfe !important; }
        .vk-btn:hover { background: rgba(0, 119, 255, 0.25); }
        .tg-btn { background: rgba(42, 171, 238, 0.15); border-color: rgba(42, 171, 238, 0.3); color: #2aabee !important; }
        .tg-btn:hover { background: rgba(42, 171, 238, 0.25); }
        .input-divider { text-align: center; font-size: 13px; font-weight: 600; color: #777; margin-bottom: 20px; text-transform: lowercase; }

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
          .social-btn { padding: 12px; font-size: 13px; }
        }

        @media (prefers-color-scheme: light) {
          .modern-support-content { background: #ffffff; border: 1px solid rgba(0,0,0,0.05); }
          .header-main-title { color: #1a1a1a !important; }
          .header-sub-title { color: #666 !important; }
          .header-close-btn { background: #f0f0f0; color: #1a1a1a; }
          .support-message-area { background: #f8f9fa; border: 1.5px solid #eee; color: #1a1a1a !important; }
          .status-p { color: #1a1a1a !important; }
          .support-status-card { background: #f0f7ff; border-color: #d0e7ff; }
          .vk-btn { background: #f0f8ff; color: #0077ff !important; border-color: #b3d7ff; }
          .tg-btn { background: #f0f9ff; color: #0088cc !important; border-color: #b3e0ff; }
        }
      `}</style>
    </div>
  );
};