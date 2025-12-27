import React, { useEffect, useRef } from 'react';

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  if (!open) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Затемнение фона */}
      <div 
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          animation: 'fadeIn 0.2s ease-out'
        }}
        onClick={() => onOpenChange && onOpenChange(false)}
      />
      {children}
      
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(10px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>
    </div>
  );
}

export function DialogContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div 
      style={{
        zIndex: 51,
        backgroundColor: 'var(--color-surface, #fff)',
        borderRadius: '16px', // Закругленные углы
        border: '1px solid var(--color-border, #e5e7eb)',
        boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
        width: '100%',
        maxWidth: '425px',
        margin: '16px',
        position: 'relative',
        animation: 'slideUp 0.3s ease-out',
        color: 'var(--color-text, #000)',
      }}
      className={className}
      onClick={(e) => e.stopPropagation()} // Чтобы клик по окну не закрывал его
    >
      {children}
    </div>
  );
}

export function DialogHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '20px 24px 10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {children}
    </div>
  );
}

export function DialogTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: '18px', fontWeight: '600', lineHeight: '1.2' }}>
      {children}
    </h2>
  );
}

export function DialogDescription({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: '14px', color: 'var(--color-text-secondary, #6b7280)' }}>
      {children}
    </p>
  );
}

export function DialogFooter({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
      {children}
    </div>
  );
}