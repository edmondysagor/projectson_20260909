import React, { useRef, useEffect } from 'react';

interface ClickOutsideWrapperProps {
  active: boolean;
  onOutsideClick: () => void;
  children: React.ReactNode;
}

export const ClickOutsideWrapper: React.FC<ClickOutsideWrapperProps> = ({ active, onOutsideClick, children }) => {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;

    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        onOutsideClick();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [active, onOutsideClick]);

  return <div ref={wrapperRef} style={{ display: 'contents' }}>{children}</div>;
};
