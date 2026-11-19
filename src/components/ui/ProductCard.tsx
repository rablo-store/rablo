import React, { useState, useRef, useCallback } from 'react';
import type { Product } from '../../lib/products';
import { extractInstagramHandle } from '../../lib/instagram';
import { Bookmark, Check, MessageCircle, ExternalLink, Lock, Eye } from 'lucide-react';
import { executeContactAction } from '../../lib/useContactAction';
import {
  getProductImageVariantUrl,
  getProductImageSrcSet,
  SIZES_PRESETS,
} from '../../lib/imageUrl';

export interface ProductCardProps {
  product: Product;
  inCart?: boolean;
  isSavingCart?: boolean;
  isLoggedIn?: boolean;
  priority?: boolean;
  onToggleCart?: (e: React.MouseEvent, productId: string) => void;
  onQuickView?: (product: Product) => void;
  onToast?: (msg: string) => void;
  onAuthRequired?: (data: { url?: string; creatorName?: string; productName?: string }) => void;
  className?: string;
}

const ProductCardComponent: React.FC<ProductCardProps> = ({
  product,
  inCart = false,
  isSavingCart = false,
  isLoggedIn = false,
  priority = false,
  onToggleCart,
  onQuickView,
  onToast,
  onAuthRequired,
  className = '',
}) => {
  const brandSlug = product.brand?.slug || null;
  const brandName = product.brand?.name || product.seller?.full_name || 'Verified Creator';
  const brandHandle = product.brand?.slug
    ? `@${product.brand.slug}`
    : extractInstagramHandle(product.seller_ig_url || product.seller?.instagram_url) || '@creator';

  // Responsive image variants with safe fallback
  const rawThumbnail = product.thumbnail_url || '';
  const [currentSrc, setCurrentSrc] = useState<string>(() =>
    rawThumbnail ? getProductImageVariantUrl(rawThumbnail, 'card') : ''
  );
  const [currentSrcSet, setCurrentSrcSet] = useState<string>(() =>
    rawThumbnail ? getProductImageSrcSet(rawThumbnail) : ''
  );
  const [isLoaded, setIsLoaded] = useState(false);
  const hasFallbackFiredRef = useRef(false);

  // If thumbnail URL prop changes across renders, update state
  const prevThumbRef = useRef(rawThumbnail);
  if (prevThumbRef.current !== rawThumbnail) {
    prevThumbRef.current = rawThumbnail;
    hasFallbackFiredRef.current = false;
    setCurrentSrc(rawThumbnail ? getProductImageVariantUrl(rawThumbnail, 'card') : '');
    setCurrentSrcSet(rawThumbnail ? getProductImageSrcSet(rawThumbnail) : '');
    setIsLoaded(false);
  }

  const handleImageError = useCallback(() => {
    if (!hasFallbackFiredRef.current && rawThumbnail) {
      hasFallbackFiredRef.current = true;
      setCurrentSrc(rawThumbnail);
      setCurrentSrcSet('');
    } else {
      // Prevent infinite error retry loop by clearing to placeholder
      setCurrentSrc('');
      setCurrentSrcSet('');
    }
  }, [rawThumbnail]);

  const handleImageLoad = useCallback(() => {
    setIsLoaded(true);
  }, []);

  const handleContactClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const targetUrl = product.contact_link || product.product_ig_url || product.seller_ig_url;

    const result = await executeContactAction({
      product,
      brand: product.brand
        ? {
            id: product.brand.id,
            owner_id: product.seller_id,
            slug: product.brand.slug,
            name: product.brand.name,
            instagram_url: product.brand.instagram_url,
            creator_type: product.brand.creator_type,
            is_verified: product.brand.is_verified,
            approval_status: 'Approved',
            created_at: '',
            updated_at: '',
          }
        : null,
      sellerName: brandName,
      fallbackUrl: targetUrl,
      onToast,
    });

    if (result.status === 'auth_required' && onAuthRequired) {
      onAuthRequired({
        url: result.url,
        creatorName: brandName,
        productName: product.name,
      });
    }
  };

  const hasContactLink = Boolean(product.contact_link && product.contact_link.trim());

  // Optimized avatar URL
  const rawAvatar = product.seller?.avatar_url || product.brand?.logo_url || '';
  const avatarUrl = rawAvatar ? getProductImageVariantUrl(rawAvatar, 'thumbnail') : '';

  return (
    <article
      className={`bg-[#FAF6F0] rounded-2xl sm:rounded-3xl border border-[#30251F]/10 p-3 sm:p-4 flex flex-col shadow-soft-sm hover:shadow-soft transition-all duration-300 group hover:-translate-y-0.5 ${className}`}
    >
      {/* Product Image Stage (Aspect ratio preserved to prevent Cumulative Layout Shift) */}
      <div className="relative aspect-square w-full rounded-xl sm:rounded-2xl overflow-hidden bg-[#EFE9DF] mb-3">
        {currentSrc ? (
          <img
            src={currentSrc}
            srcSet={currentSrcSet || undefined}
            sizes={SIZES_PRESETS.card}
            alt={product.name}
            width={400}
            height={400}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            {...(priority ? { fetchpriority: 'high' } : {})}
            onError={handleImageError}
            onLoad={handleImageLoad}
            className={`w-full h-full object-cover group-hover:scale-104 transition-all duration-500 ${
              isLoaded ? 'opacity-100' : 'opacity-90'
            }`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#8A7A70] text-3xl font-serif">
            ✦
          </div>
        )}

        {/* Top-Right Bookmark Button (Save to Lead Cart) */}
        {onToggleCart && (
          <button
            type="button"
            onClick={(e) => onToggleCart(e, product.id)}
            disabled={isSavingCart}
            aria-label={inCart ? 'Remove from Lead Cart' : 'Save to Lead Cart'}
            title={inCart ? 'Saved in Lead Cart' : 'Save to Lead Cart'}
            className={`absolute top-2.5 right-2.5 w-8 h-8 rounded-xl backdrop-blur-md flex items-center justify-center transition-all cursor-pointer shadow-xs ${
              inCart
                ? 'bg-[#9E4A2B] text-[#FAF6F0] border-transparent'
                : 'bg-[#FAF6F0]/90 hover:bg-white text-[#30251F] border border-[#30251F]/10 hover:scale-105'
            }`}
          >
            {inCart ? (
              <Check className="w-4 h-4 text-[#FAF6F0]" />
            ) : (
              <Bookmark className="w-4 h-4 text-[#30251F]" />
            )}
          </button>
        )}

        {/* Quick Preview Hover Trigger */}
        {onQuickView && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onQuickView(product);
            }}
            className="absolute bottom-2.5 right-2.5 bg-[#30251F]/80 hover:bg-[#30251F] text-[#FAF6F0] p-1.5 rounded-xl backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-xs"
            title="Quick Preview"
            aria-label="Quick preview product"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Product Information */}
      <div className="flex flex-col flex-1 space-y-1.5">
        {/* Creator Chip */}
        <div className="flex items-center justify-between text-[11px] text-[#685950] mb-0.5">
          {brandSlug ? (
            <a
              href={`/creators/${brandSlug}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 hover:text-[#9E4A2B] transition-colors truncate max-w-[140px]"
              title={`View ${brandName}'s brand store`}
            >
              <div className="w-4.5 h-4.5 rounded-full overflow-hidden bg-[#EFE9DF] border border-[#30251F]/10 flex-shrink-0">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt=""
                    width={20}
                    height={20}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[9px] font-bold text-[#9E4A2B]">
                    {brandName.charAt(0)}
                  </div>
                )}
              </div>
              <span className="font-medium truncate">{brandHandle}</span>
            </a>
          ) : (
            <div className="inline-flex items-center gap-1.5 truncate max-w-[140px]">
              <div className="w-4.5 h-4.5 rounded-full overflow-hidden bg-[#EFE9DF] border border-[#30251F]/10 flex-shrink-0">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt=""
                    width={20}
                    height={20}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[9px] font-bold text-[#9E4A2B]">
                    {brandName.charAt(0)}
                  </div>
                )}
              </div>
              <span className="font-medium truncate">{brandHandle}</span>
            </div>
          )}

          {!isLoggedIn && (
            <button
              type="button"
              onClick={handleContactClick}
              className="text-[10px] text-[#9E4A2B] hover:text-[#843C22] font-semibold cursor-pointer flex items-center gap-0.5"
              title="Sign in to view creator's Instagram ID"
            >
              <Lock className="w-2.5 h-2.5 flex-shrink-0" />
              <span className="hidden sm:inline">Sign in to view Insta ID</span>
            </button>
          )}
        </div>

        {/* Title */}
        <h3 className="font-display font-bold text-xs sm:text-sm text-[#30251F] group-hover:text-[#9E4A2B] transition-colors line-clamp-1">
          <a href={`/products/${product.id}`}>{product.name}</a>
        </h3>

        {/* Price & 0% markup */}
        <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-[#30251F] pt-0.5">
          <span>₹{product.price}</span>
          <span className="text-[10px] font-normal text-[#685950]">0% commission</span>
        </div>

        {/* Action Button: Contact / Chat with Creator */}
        <div className="pt-2 mt-auto">
          <button
            type="button"
            onClick={handleContactClick}
            className={`w-full py-2 px-3 rounded-full text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs ${
              hasContactLink
                ? 'bg-[#9E4A2B] hover:bg-[#843C22] text-[#FAF6F0]'
                : 'bg-[#30251F] hover:bg-[#211915] text-[#FAF6F0]'
            }`}
            title={
              hasContactLink
                ? isLoggedIn
                  ? 'Inquire directly with creator'
                  : 'Sign in to chat / inquire directly'
                : isLoggedIn
                ? 'Chat with creator on Instagram'
                : 'Sign in to chat on Instagram'
            }
          >
            {hasContactLink ? (
              <>
                <MessageCircle className="w-3.5 h-3.5 text-[#D9A37B] flex-shrink-0" />
                <span className="truncate">Contact / Chat</span>
                <ExternalLink className="w-3 h-3 opacity-80 flex-shrink-0" />
              </>
            ) : isLoggedIn ? (
              <>
                <MessageCircle className="w-3.5 h-3.5 text-[#FAF6F0] flex-shrink-0" />
                <span className="truncate">Chat DM</span>
                <ExternalLink className="w-3 h-3 opacity-80 flex-shrink-0" />
              </>
            ) : (
              <>
                <Lock className="w-3 h-3 text-[#FAF6F0] flex-shrink-0" />
                <span className="truncate">Chat DM</span>
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  );
};

/**
 * Custom memoization comparator to ensure product cards never re-render unnecessarily
 * during scrolling, pagination, or unrelated parent state updates.
 * Confirms every dynamic prop that affects visual rendering before skipping.
 */
function areProductCardPropsEqual(prev: ProductCardProps, next: ProductCardProps): boolean {
  if (prev.product.id !== next.product.id) return false;
  if (prev.product.name !== next.product.name) return false;
  if (prev.product.price !== next.product.price) return false;
  if (prev.product.stock !== next.product.stock) return false;
  if (prev.product.thumbnail_url !== next.product.thumbnail_url) return false;
  if (prev.product.contact_link !== next.product.contact_link) return false;
  if (prev.product.product_ig_url !== next.product.product_ig_url) return false;
  if (prev.product.seller_ig_url !== next.product.seller_ig_url) return false;
  if (prev.product.updated_at !== next.product.updated_at) return false;
  if (prev.product.seller?.avatar_url !== next.product.seller?.avatar_url) return false;
  if (prev.product.brand?.logo_url !== next.product.brand?.logo_url) return false;
  if (prev.product.brand?.slug !== next.product.brand?.slug) return false;
  if (prev.product.brand?.name !== next.product.brand?.name) return false;
  if (prev.inCart !== next.inCart) return false;
  if (prev.isSavingCart !== next.isSavingCart) return false;
  if (prev.isLoggedIn !== next.isLoggedIn) return false;
  if (prev.priority !== next.priority) return false;
  if (prev.className !== next.className) return false;
  if (prev.onToggleCart !== next.onToggleCart) return false;
  if (prev.onQuickView !== next.onQuickView) return false;
  if (prev.onToast !== next.onToast) return false;
  if (prev.onAuthRequired !== next.onAuthRequired) return false;
  return true;
}

export const ProductCard = React.memo(ProductCardComponent, areProductCardPropsEqual);
export default ProductCard;
