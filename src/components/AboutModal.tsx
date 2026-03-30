// src/components/AboutModal.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  const [clickCount, setClickCount] = useState(0);
  
  const [gameState, setGameState] = useState<'hidden' | 'start' | 'playing' | 'gameover'>('hidden');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => Number(localStorage.getItem('cat_runner_score') || 0));

  const catRef = useRef<HTMLDivElement>(null);
  const groundRef = useRef<HTMLDivElement>(null);
  const cloudsRef = useRef<HTMLDivElement>(null);
  // 🔥 Теперь у нас массив рефов для нескольких препятствий
  const obstacleRefs = useRef<(HTMLDivElement | null)[]>([]);
  const reqRef = useRef<number>();
  const gameAreaRef = useRef<HTMLDivElement>(null);
  
  const OBSTACLES_EMOJIS = ['📚', '⏰', '🖊️', '☕'];
  const MAX_OBSTACLES = 3;

  const gameData = useRef({
    isJumping: false,
    catY: 0,
    velocityY: 0,
    groundX: 0,
    speed: 5.5,
    score: 0,
    active: false,
    canvasWidth: 0,
    // 🔥 Массив состояний препятствий
    obstacles: Array.from({ length: MAX_OBSTACLES }).map(() => ({ x: -100, emoji: '📚' }))
  });

  // Сброс счетчика кликов
  useEffect(() => {
    if (clickCount > 0 && clickCount < 5) {
      const timer = setTimeout(() => setClickCount(0), 1000);
      return () => clearTimeout(timer);
    }
  }, [clickCount]);

  useEffect(() => {
    if (!isOpen) {
      setGameState('hidden');
      setClickCount(0);
      gameData.current.active = false;
      if (reqRef.current) cancelAnimationFrame(reqRef.current);
    }
  }, [isOpen]);

  const gameLoop = useCallback(() => {
    if (!gameData.current.active) return;
    const g = gameData.current;

    // 1. Физика прыжка
    if (g.isJumping) {
      g.velocityY -= 0.9; // Гравитация
      g.catY += g.velocityY;
      if (g.catY <= 0) {
        g.catY = 0;
        g.isJumping = false;
        g.velocityY = 0;
      }
    }

    // 2. Движение фона
    g.groundX -= g.speed;
    if (g.groundX <= -600) g.groundX = 0;

    // 🔥 3. Логика препятствий
    // Рассчитываем, сколько времени (кадров) занимает 1 прыжок
    const jumpFrames = (15 * 2) / 0.9; // 15 - начальная скорость прыжка, 0.9 - гравитация
    // Безопасная дистанция = длина прыжка + небольшая случайная дистанция
    const minSafeGap = (jumpFrames * g.speed) + 40; 
    
    // Находим самого дальнего врага, чтобы спавнить нового за ним
    let furthestX = Math.max(...g.obstacles.map(o => o.x));

    g.obstacles.forEach((obs, index) => {
      obs.x -= g.speed;
      
      // Если препятствие ушло за экран
      if (obs.x < -60) {
        // Спавним новое препятствие. Гарантируем, что оно не появится ближе, чем minSafeGap
        obs.x = Math.max(g.canvasWidth, furthestX + minSafeGap) + (Math.random() * 200);
        obs.emoji = OBSTACLES_EMOJIS[Math.floor(Math.random() * OBSTACLES_EMOJIS.length)];
        
        // Усложняем игру! Ограничим макс. скорость, чтобы игра не ломалась
        if (g.speed < 14) g.speed += 0.05; 
        
        g.score += 10;
        setScore(g.score); // Обновляем React State только когда пройдено препятствие
        
        furthestX = obs.x; // Обновляем furthestX для следующего препятствия в цикле
      }

      // Обновляем DOM препятствия
      if (obstacleRefs.current[index]) {
        obstacleRefs.current[index]!.style.transform = `translateX(${obs.x}px)`;
        obstacleRefs.current[index]!.innerText = obs.emoji;
      }

      // 4. Проверка столкновений (Хитбоксы)
      const catLeft = 28;  // Сделали котика "худее" для честности
      const catRight = 50; 
      const catBottom = g.catY;
      
      const obsLeft = obs.x + 8; 
      const obsRight = obs.x + 28;
      const obsHeight = 35;

      if (obsLeft < catRight && obsRight > catLeft && catBottom < obsHeight) {
        g.active = false;
        setGameState('gameover');
        if (g.score > highScore) {
          setHighScore(g.score);
          localStorage.setItem('cat_runner_score', g.score.toString());
        }
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      }
    });

    if (g.active) {
      // Отрисовка кота и фона
      if (catRef.current) catRef.current.style.transform = `translateY(-${g.catY}px)`;
      if (groundRef.current) groundRef.current.style.transform = `translateX(${g.groundX}px)`;
      if (cloudsRef.current) cloudsRef.current.style.transform = `translateX(${g.groundX * 0.3}px)`;
      
      reqRef.current = requestAnimationFrame(gameLoop);
    }
  }, [OBSTACLES_EMOJIS, highScore]);

  const startGame = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const width = gameAreaRef.current?.offsetWidth || 450;
    
    // Инициализируем стартовые препятствия с большим зазором
    const initialObstacles = Array.from({ length: MAX_OBSTACLES }).map((_, i) => ({
      x: width + 100 + (i * 450), 
      emoji: OBSTACLES_EMOJIS[Math.floor(Math.random() * OBSTACLES_EMOJIS.length)]
    }));

    gameData.current = {
      isJumping: false,
      catY: 0,
      velocityY: 0,
      groundX: 0,
      speed: 6.0, // Начальная скорость
      score: 0,
      active: true,
      canvasWidth: width,
      obstacles: initialObstacles
    };
    
    setScore(0);
    setGameState('playing');
    reqRef.current = requestAnimationFrame(gameLoop);
  };

  const jump = (e?: React.MouseEvent | React.TouchEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    if (gameState === 'playing' && !gameData.current.isJumping) {
      gameData.current.isJumping = true;
      gameData.current.velocityY = 15; // Усилили прыжок под новую гравитацию
    }
  };

  if (!isOpen) return null;

  const handleVersionClick = () => {
    if (gameState !== 'hidden') return;
    const newCount = clickCount + 1;
    setClickCount(newCount);
    
    if (newCount >= 5) {
      setGameState('start');
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    }
  };

  const APP_VERSION = "2.2.5";
  const isEasterEggActive = gameState !== 'hidden';

  return (
    <div className="about-bottom-overlay" onClick={onClose}>
      <div className={`about-bottom-sheet ${isEasterEggActive ? 'easter-egg-mode' : ''}`} onClick={(e) => e.stopPropagation()}>
        
        <div className="bottom-sheet-handle-container">
          <div className="bottom-sheet-handle"></div>
        </div>

        <div className="modern-support-header" style={{ paddingTop: '10px' }}>
          <div className="header-info-group">
            <div className={`header-badge-support ${isEasterEggActive ? 'spin-logo' : ''}`}>
              <span className="material-icons">{isEasterEggActive ? 'pets' : 'info'}</span>
            </div>
            <div className="header-labels">
              <span className="header-main-title">{isEasterEggActive ? 'Cat Runner' : 'О приложении'}</span>
              <span className="header-sub-title">{isEasterEggActive ? 'Мяу! Прыгай!' : 'Расписание ТТЖТ'}</span>
            </div>
          </div>
          <button className="header-close-btn" onClick={onClose} title="Закрыть">
            <span className="material-icons">close</span>
          </button>
        </div>

        <div className="modern-support-body about-body">
          
          {gameState === 'hidden' && (
            <>
              <div className="version-container" onClick={handleVersionClick} style={{ cursor: 'pointer' }}>
                <div className="version-label">Текущая версия:</div>
                <div className="version-number">v {APP_VERSION}</div>
                {clickCount > 0 && (
                  <div className="click-hint">До игры: {5 - clickCount}</div>
                )}
              </div>

              <div className="changelog-container">
                <h3 className="changelog-title">Что нового:</h3>
                <ul className="changelog-list">
                  <li>
                    <strong>Offline-First Архитектура 🚀</strong>
                    <p>Теперь приложение автоматически сохраняет расписания групп и преподавателей, которые вы просматривали. Они остаются доступны даже без интернета! Важно: открыть профиль, который вы ни разу не загружали в онлайн-режиме, в офлайне нельзя.</p>
                  </li>
                  <li>
                    <strong>Умное кэширование замен</strong>
                    <p>Замены (PDF) теперь привязываются к скачанному расписанию и доступны офлайн.</p>
                  </li>
                  <li>
                    <strong>Новая техподдержка</strong>
                    <p>Добавлены кнопки для быстрой связи с нами в VK и Telegram.</p>
                  </li>
                </ul>
              </div>
            </>
          )}

          {isEasterEggActive && (
            <div className="game-wrapper">
              {gameState === 'start' && (
                <div className="game-menu">
                  <h2>🐈 Котик спешит на пару!</h2>
                  <p>Нажимай на экран, чтобы перепрыгивать через зачетки и будильники.</p>
                  <button className="game-btn primary" onClick={startGame}>Погнали!</button>
                  <button className="game-btn secondary" onClick={() => setGameState('hidden')}>Назад к описанию</button>
                </div>
              )}

              {gameState === 'gameover' && (
                <div className="game-menu">
                  <h2>💥 Авария! Мяу!</h2>
                  <p>Твой счет: <strong>{score}</strong></p>
                  <p>Рекорд: <strong>{highScore}</strong></p>
                  <button className="game-btn primary" onClick={startGame}>Попробовать еще</button>
                  <button className="game-btn secondary" onClick={() => setGameState('hidden')}>Назад</button>
                </div>
              )}

              {gameState === 'playing' && (
                <div 
                  className="game-canvas" 
                  onMouseDown={jump} 
                  onTouchStart={jump}
                  ref={gameAreaRef}
                >
                  <div className="game-clouds-container" ref={cloudsRef}>
                    <div className="cloud cloud-1">☁️</div>
                    <div className="cloud cloud-2">☁️</div>
                    <div className="cloud cloud-3">☁️</div>
                  </div>
                  <div className="game-score-display">{score}</div>
                  
                  <div className="game-cat" ref={catRef}>
                    <div style={{ transform: 'scaleX(-1)', display: 'inline-block' }}>🐈</div>
                  </div>
                  
                  {/* 🔥 Отрисовываем 3 препятствия из массива */}
                  {[0, 1, 2].map(i => (
                    <div 
                      key={i} 
                      className="game-obstacle" 
                      ref={el => obstacleRefs.current[i] = el}
                    ></div>
                  ))}
                  
                  <div className="game-ground-layer">
                    <div className="game-ground" ref={groundRef}>
                        <div className="ground-texture"></div>
                        <div className="ground-texture"></div>
                        <div className="ground-texture"></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .about-bottom-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); display: flex; align-items: flex-end; justify-content: center; z-index: 10000; animation: overlayFadeIn 0.3s ease; }
        .about-bottom-sheet { background: var(--color-surface, #1e1e1e); width: 100%; max-width: 600px; border-radius: 36px 36px 0 0; box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.5); border: 1px solid rgba(255, 255, 255, 0.08); border-bottom: none; display: flex; flex-direction: column; animation: bottomSheetSlideUp 0.4s cubic-bezier(0.2, 0.8, 0.2, 1); padding-bottom: env(safe-area-inset-bottom, 20px); }
        .bottom-sheet-handle-container { display: flex; justify-content: center; align-items: center; padding: 16px 0 8px; width: 100%; }
        .bottom-sheet-handle { width: 40px; height: 5px; background: rgba(255, 255, 255, 0.2); border-radius: 10px; }

        @keyframes overlayFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes bottomSheetSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }

        .modern-support-header { padding: 10px 32px 24px; display: flex; align-items: center; justify-content: space-between; }
        .header-info-group { display: flex; align-items: center; gap: 20px; }
        .header-badge-support { width: 52px; height: 52px; background: linear-gradient(135deg, #00f2fe 0%, #4facfe 100%); border-radius: 18px; display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 10px 25px rgba(79, 172, 254, 0.4); }
        .header-labels { display: flex; flex-direction: column; }
        .header-main-title { font-weight: 900; font-size: 22px; color: #ffffff !important; letter-spacing: -0.5px; transition: color 0.3s; }
        .header-sub-title { font-size: 14px; opacity: 0.7; color: #ffffff !important; font-weight: 600; margin-top: 2px; }
        .header-close-btn { background: rgba(255, 255, 255, 0.08); border: none; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; color: white; transition: all 0.2s ease; }
        
        .about-body { padding: 0 32px 32px; max-height: 75vh; overflow-y: auto; }
        
        .version-container { text-align: center; padding: 24px; background: rgba(255,255,255,0.05); border-radius: 24px; margin-bottom: 24px; border: 1px solid rgba(255,255,255,0.1); user-select: none; transition: all 0.2s ease; }
        .version-container:active { transform: scale(0.97); }
        .version-label { font-size: 14px; color: #888; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;}
        .version-number { font-size: 32px; font-weight: 900; background: linear-gradient(135deg, #00f2fe 0%, #4facfe 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .click-hint { font-size: 12px; color: #ff4b5c; margin-top: 8px; font-weight: bold; animation: pulse 0.5s infinite alternate; }

        .changelog-title { font-size: 18px; font-weight: 800; color: #fff; margin-bottom: 16px; margin-top: 0; }
        .changelog-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 16px; }
        .changelog-list li { background: rgba(79, 172, 254, 0.05); border-left: 4px solid #4facfe; padding: 12px 16px; border-radius: 0 16px 16px 0; }
        .changelog-list strong { display: block; color: #fff; font-size: 15px; margin-bottom: 6px; }
        .changelog-list p { margin: 0; font-size: 13px; color: #aaa; line-height: 1.5; }

        @keyframes pulse { from { opacity: 0.5; } to { opacity: 1; } }

        .easter-egg-mode { border-top: 2px solid #00f2fe; box-shadow: 0 -10px 50px rgba(0, 242, 254, 0.15); }
        .spin-logo { animation: shakeLogo 0.5s linear infinite; background: linear-gradient(135deg, #00f2fe 0%, #4facfe 100%); }
        @keyframes shakeLogo { 0% {transform: rotate(0deg)} 25% {transform: rotate(-5deg)} 75% {transform: rotate(5deg)} 100% {transform: rotate(0deg)} }

        .game-wrapper { width: 100%; display: flex; flex-direction: column; gap: 16px; animation: overlayFadeIn 0.3s ease; }
        
        .game-menu { text-align: center; padding: 30px 20px; background: rgba(255,255,255,0.05); border-radius: 24px; border: 1px solid rgba(255,255,255,0.1); }
        .game-menu h2 { margin: 0 0 10px; color: #fff; font-size: 24px; font-weight: 900; }
        .game-menu p { color: #aaa; margin-bottom: 24px; line-height: 1.5; font-size: 15px; }
        .game-btn { width: 100%; padding: 16px; border-radius: 16px; font-size: 16px; font-weight: 800; border: none; cursor: pointer; transition: 0.2s; margin-bottom: 12px; }
        .game-btn.primary { background: linear-gradient(135deg, #00f2fe 0%, #4facfe 100%); color: white; box-shadow: 0 6px 20px rgba(79, 172, 254, 0.3); }
        .game-btn.primary:active { transform: scale(0.97); }
        .game-btn.secondary { background: rgba(255,255,255,0.1); color: #fff; }

        .game-canvas { 
          position: relative; width: 100%; height: 260px; 
          background: linear-gradient(to bottom, #1c1c1e 0%, #2c3e50 100%); 
          border-radius: 24px; overflow: hidden; cursor: pointer;
          user-select: none; -webkit-user-select: none;
          box-shadow: inset 0 0 20px rgba(0,0,0,0.5);
        }
        
        .game-score-display { position: absolute; top: 16px; right: 20px; font-size: 28px; font-weight: 900; color: white; opacity: 0.8; font-variant-numeric: tabular-nums; z-index: 20; }
        
        .game-cat { position: absolute; bottom: 20px; left: 20px; font-size: 44px; line-height: 1; z-index: 10; filter: drop-shadow(2px 4px 6px rgba(0,0,0,0.3)); transform-origin: center;}
        
        .game-obstacle { position: absolute; bottom: 20px; left: 0; font-size: 38px; line-height: 1; z-index: 5; filter: drop-shadow(2px 4px 6px rgba(0,0,0,0.3));}
        
        .game-ground-layer { position: absolute; bottom: 0; width: 100%; height: 20px; overflow: hidden; }
        .game-ground { display: flex; width: max-content; height: 100%; }
        .ground-texture { width: 600px; height: 100%; border-top: 3px solid #eee; background: repeating-linear-gradient(90deg, transparent, transparent 20px, rgba(255,255,255,0.1) 20px, rgba(255,255,255,0.1) 21px); }

        .game-clouds-container { position: absolute; width: max-content; height: 100%; opacity: 0.2;}
        .cloud { position: absolute; font-size: 30px;}
        .cloud-1 { top: 30px; left: 50px; }
        .cloud-2 { top: 60px; left: 250px; }
        .cloud-3 { top: 40px; left: 450px; }

        @media (max-width: 480px) {
          .about-body { padding: 0 20px 20px; }
          .modern-support-header { padding: 10px 20px 20px; }
          .version-container { padding: 16px; }
          .version-number { font-size: 28px; }
          .changelog-title { font-size: 16px; }
          .game-canvas { height: 220px; }
          .game-cat { font-size: 36px; left: 15px;}
          .game-obstacle { font-size: 30px; }
        }

        @media (prefers-color-scheme: light) {
          .about-bottom-sheet { background: #ffffff; border-color: rgba(0,0,0,0.1); }
          .bottom-sheet-handle { background: rgba(0, 0, 0, 0.2); }
          .header-main-title { color: #1a1a1a !important; }
          .header-sub-title { color: #666 !important; }
          .header-close-btn { background: #f0f0f0; color: #1a1a1a; }
          .changelog-title { color: #1a1a1a; }
          .changelog-list strong { color: #1a1a1a; }
          .changelog-list p { color: #666; }
          .version-container { background: #f8f9fa; border-color: #eee; }
          .game-menu { background: #f8f9fa; border-color: #eee; }
          .game-menu h2 { color: #1a1a1a; }
          .game-menu p { color: #666; }
          .game-btn.secondary { background: #eee; color: #1a1a1a; }
          
          .game-canvas { background: linear-gradient(to bottom, #eee 0%, #fafafa 100%); }
          .game-clouds-container { opacity: 1; }
          .game-cat, .game-obstacle { filter: drop-shadow(0px 2px 3px rgba(0,0,0,0.1)); }
          .ground-texture { border-color: #eee; }
          .game-score-display { color: #1a1a1a;}
        }
      `}</style>
    </div>
  );
};