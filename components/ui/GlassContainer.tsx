import React from 'react';

interface GlassContainerProps {
  children: React.ReactNode;
  className?: string;
}

export const GlassContainer: React.FC<GlassContainerProps> = ({ children, className = '' }) => {
  return (
    <div className={`glass rounded-2xl p-6 shadow-2xl ${className}`}>
      {children}
    </div>
  );
};
