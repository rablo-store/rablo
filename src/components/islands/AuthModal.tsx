import React, { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { canonicalizeInstagramUrl, getSafeInstagramUrl } from '../../lib/instagram';
import { sanitizeContactUrl } from '../../lib/contact';
import { X, Lock, Sparkles, ShieldCheck, ArrowRight } from 'lucide-react';

import { openInstagramAuthModal, type AuthModalDetail } from '../../lib/openAuthModal';
export { openInstagramAuthModal, type AuthModalDetail };

export interface AuthModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  targetUrl?: string;
  creatorName?: string;
  productName?: string;
}

// Botanical Flower Illustration (Mockup 9 aesthetic)
const BotanicalFlowerIllustration: React.FC = () => (
  <svg
    viewBox="0 0 100 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-14 h-18 pointer-events-none select-none opacity-80"
    aria-hidden="true"
  >
    <path d="M30 115C32 90 38 65 52 45" stroke="#637858" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M35 115C38 85 46 68 32 40" stroke="#637858" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M44 65C52 62 58 68 56 75C48 76 43 72 44 65Z" fill="#637858" />
    <path d="M32 78C24 76 18 82 20 89C28 90 33 85 32 78Z" fill="#637858" />
    <path d="M48 52C55 50 60 54 58 60C52 61 48 58 48 52Z" fill="#738967" />
    <g transform="translate(52, 45)">
      <circle cx="-9" cy="0" r="5" fill="#D9A37B" opacity="0.9" />
      <circle cx="9" cy="0" r="5" fill="#D9A37B" opacity="0.9" />
      <circle cx="0" cy="-9" r="5" fill="#D9A37B" opacity="0.9" />
      <circle cx="0" cy="9" r="5" fill="#D9A37B" opacity="0.9" />
      <circle cx="-6" cy="-6" r="5" fill="#E8B996" opacity="0.9" />
      <circle cx="6" cy="-6" r="5" fill="#E8B996" opacity="0.9" />
      <circle cx="-6" cy="6" r="5" fill="#E8B996" opacity="0.9" />
      <circle cx="6" cy="6" r="5" fill="#E8B996" opacity="0.9" />
      <circle cx="0" cy="0" r="4.5" fill="#B87555" />
    </g>
    <g transform="translate(32, 40)">
      <circle cx="-8" cy="0" r="4.5" fill="#E8B996" opacity="0.95" />
      <circle cx="8" cy="0" r="4.5" fill="#E8B996" opacity="0.95" />
      <circle cx="0" cy="-8" r="4.5" fill="#E8B996" opacity="0.95" />
      <circle cx="0" cy="8" r="4.5" fill="#E8B996" opacity="0.95" />
      <circle cx="-5" cy="-5" r="4.5" fill="#D9A37B" opacity="0.95" />
      <circle cx="5" cy="-5" r="4.5" fill="#D9A37B" opacity="0.95" />
      <circle cx="-5" cy="5" r="4.5" fill="#D9A37B" opacity="0.95" />
      <circle cx="5" cy="5" r="4.5" fill="#D9A37B" opacity="0.95" />
      <circle cx="0" cy="0" r="4" fill="#9E4A2B" />
    </g>
  </svg>
);

export const AuthModal: React.FC<AuthModalProps> = (props) => {
  const isControlled = typeof props.isOpen === 'boolean';
  const [internalOpen, setInternalOpen] = useState(false);
  const [internalData, setInternalData] = useState<AuthModalDetail>({});
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isOpen = isControlled ? Boolean(props.isOpen) : internalOpen;
  const targetUrl = isControlled
    ? props.targetUrl
    : (internalData.targetUrl || (typeof window !== 'undefined' ? localStorage.getItem('rablo:pending_ig_redirect') || sessionStorage.getItem('rablo:pending_ig_redirect') : null));
  const creatorName = isControlled
    ? props.creatorName
    : (internalData.creatorName || (typeof window !== 'undefined' ? localStorage.getItem('rablo:pending_creator_name') || sessionStorage.getItem('rablo:pending_creator_name') : undefined));
  const productName = isControlled ? props.productName : internalData.productName;

  const handleClose = useCallback(() => {
    // Clear pending IG state so subsequent logins from elsewhere (e.g. header) won't jump to old creators
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('rablo:pending_ig_redirect');
        localStorage.removeItem('rablo:pending_creator_name');
        sessionStorage.removeItem('rablo:pending_ig_redirect');
        sessionStorage.removeItem('rablo:pending_creator_name');
        document.cookie = 'rablo_pending_ig=; path=/; max-age=0; SameSite=Lax';
        document.cookie = 'rablo_pending_creator=; path=/; max-age=0; SameSite=Lax';
      } catch {}
      document.body.style.overflow = '';
    }
    setLoading(false);
    setErrorMsg(null);
    if (isControlled && props.onClose) {
      props.onClose();
    } else {
      setInternalOpen(false);
    }
  }, [isControlled, props.onClose]);

  // Handle pageshow (bfcache restore) and auth state changes
  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      setLoading(false);
      document.body.style.overflow = '';
      if (e.persisted) {
        handleClose();
      }
    };
    window.addEventListener('pageshow', handlePageShow);

    // Auto-close modal when a session appears
    let unsubscribeAuth: (() => void) | undefined;
    if (isSupabaseConfigured && supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (session?.user && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
          setLoading(false);
          document.body.style.overflow = '';
          if (isControlled && props.onClose) {
            props.onClose();
          } else {
            setInternalOpen(false);
          }
        }
      });
      unsubscribeAuth = () => subscription.unsubscribe();
    }

    return () => {
      window.removeEventListener('pageshow', handlePageShow);
      if (unsubscribeAuth) unsubscribeAuth();
    };
  }, [handleClose, isControlled, props.onClose]);

  useEffect(() => {
    const handleOpen = (e: Event) => {
      if (isControlled) return;
      const customEvent = e as CustomEvent<AuthModalDetail>;
      const detail = customEvent.detail || {};
      const canonical = detail.targetUrl ? (sanitizeContactUrl(detail.targetUrl) || getSafeInstagramUrl(detail.targetUrl) || canonicalizeInstagramUrl(detail.targetUrl)) : detail.targetUrl;
      const finalDetail = { ...detail, targetUrl: canonical };
      setInternalData(finalDetail);
      setErrorMsg(null);
      if (canonical && typeof window !== 'undefined') {
        try {
          localStorage.setItem('rablo:pending_ig_redirect', canonical);
          sessionStorage.setItem('rablo:pending_ig_redirect', canonical);
          document.cookie = `rablo_pending_ig=${encodeURIComponent(canonical)}; path=/; max-age=3600; SameSite=Lax`;
          if (detail.creatorName) {
            localStorage.setItem('rablo:pending_creator_name', detail.creatorName);
            sessionStorage.setItem('rablo:pending_creator_name', detail.creatorName);
            document.cookie = `rablo_pending_creator=${encodeURIComponent(detail.creatorName)}; path=/; max-age=3600; SameSite=Lax`;
          }
        } catch {}
      }
      setInternalOpen(true);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    if (!isControlled) {
      window.addEventListener('rablo:open-auth-modal', handleOpen);
    }
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      if (!isControlled) {
        window.removeEventListener('rablo:open-auth-modal', handleOpen);
      }
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleClose, isControlled]);

  // Lock scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleGoogleSignIn = async () => {
    if (!isSupabaseConfigured || !supabase) {
      const nextTarget = window.location.pathname + window.location.search;
      const targetParam = targetUrl ? `&target_ig=${encodeURIComponent(targetUrl)}` : '';
      window.location.href = `/account?redirect=${encodeURIComponent(nextTarget)}${targetParam}`;
      return;
    }
    setLoading(true);
    setErrorMsg(null);

    try {
      const rawTarget =
        targetUrl ||
        (typeof window !== 'undefined'
          ? localStorage.getItem('rablo:pending_ig_redirect') || sessionStorage.getItem('rablo:pending_ig_redirect')
          : null);
      const targetIg = rawTarget ? (sanitizeContactUrl(rawTarget) || getSafeInstagramUrl(rawTarget) || canonicalizeInstagramUrl(rawTarget)) : null;

      if (targetIg && typeof window !== 'undefined') {
        try {
          localStorage.setItem('rablo:pending_ig_redirect', targetIg);
          sessionStorage.setItem('rablo:pending_ig_redirect', targetIg);
          document.cookie = `rablo_pending_ig=${encodeURIComponent(targetIg)}; path=/; max-age=3600; SameSite=Lax`;
          if (creatorName) {
            localStorage.setItem('rablo:pending_creator_name', creatorName);
            sessionStorage.setItem('rablo:pending_creator_name', creatorName);
            document.cookie = `rablo_pending_creator=${encodeURIComponent(creatorName)}; path=/; max-age=3600; SameSite=Lax`;
          }
        } catch {}
      }

      const nextTarget = window.location.pathname + window.location.search;
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('rablo:auth_next', nextTarget);
          sessionStorage.setItem('rablo:auth_next', nextTarget);
          document.cookie = `rablo_auth_next=${encodeURIComponent(nextTarget)}; path=/; max-age=3600; SameSite=Lax`;
        } catch {}
      }

      // Plain callback URL so Supabase OAuth allow-list matches exactly without wildcard mismatch
      const redirectTo = `${window.location.origin}/auth/callback`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, scopes: 'email profile' },
      });

      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not initiate sign-in.');
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const activeTargetIg =
    targetUrl ||
    (typeof window !== 'undefined' ? localStorage.getItem('rablo:pending_ig_redirect') : null);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      style={{ zIndex: 99999 }}
      className="fixed inset-0 flex items-center justify-center p-4 bg-charcoal-950/70 backdrop-blur-xs animate-fade-in"
      onClick={handleClose}
    >
      <div
        className="bg-[#FAF6F0] max-w-md w-full rounded-3xl border border-[#30251F]/15 shadow-soft-xl p-6 sm:p-8 relative text-center space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close dialog"
          className="absolute top-4 right-4 p-2 text-[#8A7A70] hover:text-[#30251F] hover:bg-[#EBE3D7] rounded-full transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Brand Theme Badge */}
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#9E4A2B]/10 text-[#9E4A2B] text-[11px] font-semibold uppercase tracking-wider mx-auto">
          <Lock className="w-3.5 h-3.5 text-[#9E4A2B]" />
          <span>Creator Instagram Access</span>
        </div>

        {/* Heading & Subtext */}
        <div className="space-y-2 max-w-sm mx-auto">
          <h2
            id="auth-modal-title"
            className="text-2xl font-display font-bold text-[#30251F] tracking-tight"
          >
            Sign in with Google
          </h2>
          <p className="text-xs text-[#685950] leading-relaxed font-sans">
            Please sign in with Google to view this creator's Instagram ID and chat directly in their Instagram DMs.
          </p>
        </div>

        {/* Creator Snippet */}
        <div className="p-4 bg-[#FAF8F5] border border-[#30251F]/10 rounded-2xl text-left space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-[#8A7A70] font-semibold flex items-center justify-between">
            <span>Artisan Profile</span>
            <span className="text-[10px] text-[#9E4A2B] font-medium flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              <span>Verified Creator</span>
            </span>
          </div>
          <div className="text-sm font-bold text-[#30251F]">
            {creatorName || 'Instagram Creator'}
          </div>
          {productName && (
            <div className="text-xs text-[#685950] line-clamp-1 pt-0.5">
              Inquiry: <span className="font-semibold text-[#30251F]">{productName}</span>
            </div>
          )}
          <div className="flex items-center gap-2 pt-0.5">
            <span className="font-mono text-xs text-[#9E4A2B] font-bold">@•••••••••</span>
            <span className="text-[10px] text-[#8A7A70]">(unlocked instantly upon signing in)</span>
          </div>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xs text-xs">
            {errorMsg}
          </div>
        )}

        {/* Action Button: Continue with Google */}
        <div className="space-y-3 pt-1">
          <button
            type="button"
            disabled={loading}
            onClick={handleGoogleSignIn}
            className="w-full py-3.5 px-4 rounded-xl border border-[#30251F]/15 bg-white hover:bg-[#FAF8F5] text-[#30251F] font-semibold text-xs sm:text-sm transition-all shadow-xs flex items-center justify-center gap-3 cursor-pointer"
          >
            {loading ? (
              <div className="inline-block w-4 h-4 border-2 border-[#9E4A2B] border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" className="flex-shrink-0">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
            )}
            <span>Continue with Google</span>
            <span className="sr-only">Sign In / Sign Up with Google</span>
          </button>

          {import.meta.env.PUBLIC_ENABLE_EMAIL_AUTH === 'true' && (
            <button
              type="button"
              disabled
              className="w-full py-3 px-4 rounded-xl border border-[#30251F]/15 bg-[#FAF6F0] opacity-60 cursor-not-allowed text-[#30251F] font-semibold text-xs flex items-center justify-center gap-2"
            >
              <span>✉️ Continue with Email</span>
              <span className="text-[10px] text-[#9E4A2B] bg-[#9E4A2B]/10 px-2 py-0.5 rounded-full font-medium">Coming soon</span>
            </button>
          )}

          <p className="text-[11px] text-[#9E4A2B] font-medium leading-relaxed">
            ✦ When you sign in with Google, you will be redirected straight to the creator's Instagram!
          </p>

          <div className="pt-2 border-t border-charcoal-800/10 flex items-center justify-between">
            <BotanicalFlowerIllustration />
            <a
              href={`/account?redirect=/catalog${activeTargetIg ? `&target_ig=${encodeURIComponent(activeTargetIg)}` : ''}`}
              className="inline-flex items-center gap-1.5 text-xs text-charcoal-600 hover:text-[#9E4A2B] font-medium transition-colors"
            >
              <span>Account Portal</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>

          <p className="text-[10px] text-charcoal-500 flex items-center justify-center gap-1.5 pt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-sage-600" />
            <span>Direct-to-DM routing · Zero checkout commissions</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
