import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'terracotta' | 'clay' | 'sage' | 'neutral' | 'dark';
  className?: string;
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  className = '',
  icon,
}) => {
  const variantStyles = {
    terracotta: 'bg-[#9E4A2B]/10 text-[#9E4A2B] border-[#9E4A2B]/20',
    clay: 'bg-[#D9A37B]/20 text-[#30251F] border-[#D9A37B]/30',
    sage: 'bg-[#637B58]/15 text-[#637B58] border-[#637B58]/25',
    neutral: 'bg-[#FAF6F0] text-[#685950] border-[#30251F]/10',
    dark: 'bg-[#30251F] text-[#FAF6F0] border-transparent',
  }[variant];

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold border backdrop-blur-xs transition-colors ${variantStyles} ${className}`}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};

export default Badge;

