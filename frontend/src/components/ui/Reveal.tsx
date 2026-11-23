import React from 'react';
import { useReveal } from '../../hooks/useReveal';

interface RevealProps extends React.HTMLAttributes<HTMLElement> {
  /** Element to render, so lists keep valid markup. */
  as?: 'div' | 'li' | 'figure';
  /** `image` wipes the content in from the top instead of lifting it. */
  variant?: 'lift' | 'image';
  /** Stagger within a group, in milliseconds. */
  delay?: number;
}

export const Reveal: React.FC<RevealProps> = ({ as: Tag = 'div', variant = 'lift', delay = 0, className = '', style, children, ...rest }) => {
  const ref = useReveal<HTMLElement>();
  return (
    <Tag
      {...rest}
      ref={ref as React.Ref<never>}
      className={`${variant === 'image' ? 'reveal-image' : 'reveal'} ${className}`}
      style={{ ...style, ['--reveal-delay' as string]: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
};
