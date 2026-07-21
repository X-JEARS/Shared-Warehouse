import { useEffect, useRef, useState } from 'react';

export function useMinLoadingTime(loading: boolean, minMs = 300): boolean {
  const [show, setShow] = useState(loading);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (loading) {
      startRef.current = Date.now();
      setShow(true);
    } else {
      const start = startRef.current;
      if (start !== null && Date.now() - start < minMs) {
        const t = setTimeout(() => setShow(false), minMs - (Date.now() - start));
        return () => clearTimeout(t);
      }
      setShow(false);
    }
  }, [loading, minMs]);

  return show;
}
