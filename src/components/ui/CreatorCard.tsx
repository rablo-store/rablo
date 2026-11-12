import React from 'react';
import { BadgeCheck, ArrowRight } from 'lucide-react';

export interface CreatorCardProps {
  id?: string;
  name: string;
  slug?: string;
  avatarUrl?: string | null;
  instagramUrl?: string;
  craft?: string;
  tagline?: string | null;
  productCount?: number;
  isVerified?: boolean;
  className?: string;
}

export const CreatorCard: React.FC<CreatorCardProps> = ({
  name,
  slug,
  avatarUrl,
  craft,
  tagline,
  productCount,
  isVerified = false,
  className = '',
}) => {
  const profileSlug = slug || name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const profileLink = `/creators/${profileSlug}`;

  return (
    <article
      className={`bg-[#FAF6F0] rounded-2xl sm:rounded-3xl border border-[#30251F]/10 p-5 sm:p-6 flex flex-col items-center text-center shadow-soft-sm hover:shadow-soft transition-all duration-300 group hover:-translate-y-0.5 ${className}`}
    >
      <div className="relative mb-3.5">
        <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-full overflow-hidden bg-[#EFE9DF] border-2 border-white shadow-sm flex items-center justify-center">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          ) : (
            <span className="font-display text-2xl font-bold text-[#9E4A2B]">
              {name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        {isVerified && (
          <div
            className="absolute -bottom-1 -right-1 bg-[#FAF6F0] rounded-full p-0.5 shadow-xs"
            title="Verified Creator"
          >
            <BadgeCheck className="w-5 h-5 text-[#9E4A2B] fill-[#9E4A2B]/10" />
          </div>
        )}
      </div>

      <h3 className="font-display font-bold text-base sm:text-lg text-[#30251F] group-hover:text-[#9E4A2B] transition-colors leading-snug">
        <a href={profileLink}>{name}</a>
      </h3>

      <p className="text-xs text-[#9E4A2B] font-medium mt-0.5">
        @{profileSlug}
      </p>

      {craft && (
        <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#FAF6F0] text-[#685950] border border-[#30251F]/10">
          {craft}
        </span>
      )}

      {tagline && (
        <p className="text-xs text-[#685950] mt-2 line-clamp-2 leading-relaxed">
          {tagline}
        </p>
      )}

      <div className="mt-auto pt-4 w-full border-t border-[#30251F]/10 flex items-center justify-between text-xs text-[#685950]">
        <span>{productCount !== undefined ? `${productCount} Creations` : 'Curated Store'}</span>
        <a
          href={profileLink}
          className="font-semibold text-[#9E4A2B] hover:text-[#843C22] inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform"
        >
          <span>View Store</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </div>
    </article>
  );
};

export default CreatorCard;

