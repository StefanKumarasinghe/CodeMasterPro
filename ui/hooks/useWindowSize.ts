import { useState, useEffect } from 'react';

interface WindowSize {
  width: number;
  height: number;
}

export function useWindowSize(): WindowSize {
  const isClient = typeof window !== 'undefined';

  const getSize = (): WindowSize => ({
    width: isClient ? window.innerWidth : 0,
    height: isClient ? window.innerHeight : 0,
  });

  const [windowSize, setWindowSize] = useState<WindowSize>(getSize);

  useEffect(() => {
    if (!isClient) return;

    const handleResize = () => {
      setWindowSize(getSize());
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, [isClient]);

  return windowSize;
}
