import React from 'react';

export interface SectionHeaderProps {
  title: string;
  badge?: string;
  subtitle?: string;
  viewAllHref?: string;
  viewAllText?: string;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  badge,
  subtitle,
  viewAllHref,
  viewAllText = 'View All',
  className = '',
}) => {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-3 border-b border-[#30251F]/10 ${className}`}>
      <div>
        {badge && (
          <span className="inline-block text-[11px] font-semibold uppercase tracking-wider text-[#9E4A2B] mb-1">
            {badge}
          </span>
        )}
        <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#30251F] tracking-tight">
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs sm:text-sm text-[#685950] mt-1 max-w-xl">
            {subtitle}
          </p>
        )}
      </div>

      {viewAllHref && (
        <a
          href={viewAllHref}
          className="text-xs font-semibold text-[#9E4A2B] hover:text-[#843C22] inline-flex items-center gap-1 group transition-colors flex-shrink-0"
        >
          <span>{viewAllText}</span>
          <span className="group-hover:translate-x-0.5 transition-transform">&rarr;</span>
        </a>
      )}
    </div>
  );
};

export default SectionHeader;

