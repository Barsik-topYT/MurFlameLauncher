import { useState, useEffect } from 'react';

export function useGameStatus() {
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    // Проверяем текущий статус
    window.murflame.game.isRunning().then(setIsRunning);
    
    // Подписываемся на изменения
    const unsubscribe = window.murflame.game.onStatusChange(setIsRunning);
    
    return unsubscribe;
  }, []);

  const killGame = () => window.murflame.game.kill();

  return { isRunning, killGame };
}