/**
 * Hook to track container element dimensions
 */

import { useState, useEffect, useRef, RefObject } from 'react';

interface ContainerSize {
  width: number;
  height: number;
}

/**
 * Track the size of a container element with ResizeObserver
 */
export function useContainerSize(): [RefObject<HTMLDivElement>, ContainerSize] {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<ContainerSize>({ width: 1600, height: 900 });

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    // Initial size
    const updateSize = () => {
      setSize({
        width: element.clientWidth,
        height: element.clientHeight,
      });
    };

    updateSize();

    // Watch for resize
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(element);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return [containerRef, size];
}
