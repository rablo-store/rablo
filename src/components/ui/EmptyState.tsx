import React from 'react';
import { Sparkles } from 'lucide-react';

export interface EmptyStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No creations found',
  description = 'Try adjusting your filters or search terms to explore more creations.',
  actionLabel,
  onAction,
  actionHref,
  icon,
}) => {
  return (
    <div className="text-center py-16 px-6 bg-[#FAF6F0] border border-[#30251F]/10 rounded-3xl my-6 space-y-4 max-w-lg mx-auto">
      <div className="w-12 h-12 rounded-full bg-[#9E4A2B]/10 text-[#9E4A2B] mx-auto flex items-center justify-center">
        {icon || <Sparkles className="w-5 h-5" />}
      </div>
      <div>
        <h3 className="font-display text-lg font-bold text-[#30251F] mb-1">
          {title}
        </h3>
        <p className="text-xs text-[#685950] leading-relaxed max-w-sm mx-auto">
          {description}
        </p>
      </div>

      {(actionLabel && (onAction || actionHref)) && (
        <div className="pt-2">
          {actionHref ? (
            <a href={actionHref} className="btn-primary text-xs py-2.5 px-5">
              {actionLabel}
            </a>
          ) : (
            <button
              type="button"
              onClick={onAction}
              className="btn-primary text-xs py-2.5 px-5 cursor-pointer"
            >
              {actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default EmptyState;

