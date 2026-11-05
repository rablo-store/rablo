import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured, isAdminEmail, type RabloProfile, getCurrentProfile, signOutUser } from '../../lib/supabase';
import { canonicalizeInstagramUrl, getSafeInstagramUrl } from '../../lib/instagram';
import { User, ShoppingBag, Store, Lock, ShieldCheck, LogOut } from 'lucide-react';

export const AccountView: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<RabloProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const rawTargetIg = urlParams.get('target_ig') || (typeof window !== 'undefined' ? localStorage.getItem('rablo:pending_ig_redirect') : null);
  const targetIg = rawTargetIg ? (getSafeInstagramUrl(rawTargetIg) || canonicalizeInstagramUrl(rawTargetIg)) : null;

  const targetParam = urlParams.get('redirect');
  const nextTarget = targetParam && /^\/(?!\/)/.test(targetParam) && !targetParam.includes('\\') && targetParam !== '/account' ? targetParam : '/catalog';

  useEffect(() => {
    if (targetIg && typeof window !== 'undefined') {
      try {
        localStorage.setItem('rablo:pending_ig_redirect', targetIg);
      } catch {}
    }
  }, [targetIg]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) { setLoading(false); return; }

    if (urlParams.has('signin_error') && !session) {
      setErrorMsg('Sign-in could not be completed. Please try again.');
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session) {
        setErrorMsg(null);
        if (targetIg) {
          try {
            localStorage.removeItem('rablo:pending_ig_redirect');
            sessionStorage.removeItem('rablo:pending_ig_redirect');
            document.cookie = 'rablo_pending_ig=; path=/; max-age=0; SameSite=Lax';
          } catch {}
          const safeUrl = getSafeInstagramUrl(targetIg) || canonicalizeInstagramUrl(targetIg);
          if (safeUrl) {
            try {
              localStorage.setItem('rablo:ig_confirm_url', safeUrl);
              sessionStorage.setItem('rablo:ig_confirm_url', safeUrl);
            } catch {}
            const sep = nextTarget.includes('?') ? '&' : '?';
            window.location.replace(`${nextTarget}${sep}auth_success=1&launch_ig=${encodeURIComponent(safeUrl)}`);
            return;
          }
        }
        const p = await getCurrentProfile();
        setProfile(p);
      }
      setLoading(false);
    }).catch(() => { setLoading(false); });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_e, session) => {
      setSession(session);
      if (session) {
        setErrorMsg(null);
        if (targetIg) {
          try {
            localStorage.removeItem('rablo:pending_ig_redirect');
            sessionStorage.removeItem('rablo:pending_ig_redirect');
            document.cookie = 'rablo_pending_ig=; path=/; max-age=0; SameSite=Lax';
          } catch {}
          const safeUrl = getSafeInstagramUrl(targetIg) || canonicalizeInstagramUrl(targetIg);
          if (safeUrl) {
            try {
              localStorage.setItem('rablo:ig_confirm_url', safeUrl);
              sessionStorage.setItem('rablo:ig_confirm_url', safeUrl);
            } catch {}
            const sep = nextTarget.includes('?') ? '&' : '?';
            window.location.replace(`${nextTarget}${sep}auth_success=1&launch_ig=${encodeURIComponent(safeUrl)}`);
            return;
          }
        }
        const p = await getCurrentProfile();
        setProfile(p);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [targetIg, nextTarget]);

  const handleGoogleSignIn = async () => {
    if (!isSupabaseConfigured || !supabase) return;
    setErrorMsg(null);
    try {
      const targetParam = urlParams.get('redirect');
      if (targetIg && typeof window !== 'undefined') {
        try {
          localStorage.setItem('rablo:pending_ig_redirect', targetIg);
        } catch {}
      }
      const nextTarget = targetParam && /^\/(?!\/)/.test(targetParam) && !targetParam.includes('\\') && targetParam !== '/account' ? targetParam : '/catalog';
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('rablo:auth_next', nextTarget);
          sessionStorage.setItem('rablo:auth_next', nextTarget);
          document.cookie = `rablo_auth_next=${encodeURIComponent(nextTarget)}; path=/; max-age=3600; SameSite=Lax`;
        } catch {}
      }
      const redirectTo = `${window.location.origin}/auth/callback`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, scopes: 'email profile' },
      });
      if (error) setErrorMsg(error.message);
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not initiate sign-in.');
    }
  };

  const handleSignOut = async () => {
    await signOutUser('/account?signed_out=1');
  };

  const handleBecomeSeller = async () => {
    if (!supabase || !session) return;
    const { error } = await supabase.from('profiles').update({ is_seller: true }).eq('id', session.user.id);
    if (!error) {
      const p = await getCurrentProfile();
      setProfile(p);
    }
  };

  if (loading) {
    return (
      <div className="py-16 text-center">
        <div className="inline-block w-8 h-8 border-2 border-charcoal-800 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs text-charcoal-500">Connecting account...</p>
      </div>
    );
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="p-6 bg-ivory-100 border border-charcoal-800/10 rounded-sm text-center">
        <p className="text-xs text-charcoal-600">Authentication service is being configured.</p>
      </div>
    );
  }

  const isAdmin = isAdminEmail(session?.user?.email);

  if (session) {
    return (
      <div className="space-y-6">
        {/* Admin Banner */}
        {isAdmin && (
          <div className="p-4 bg-lavender-50 border border-lavender-200 rounded-sm flex items-center justify-between flex-wrap gap-4">
            <div>
              <span className="badge-preview !bg-lavender-200 !text-lavender-900 font-bold">Superadmin</span>
              <p className="text-xs text-lavender-800 mt-1">
                You have authorized access to product approvals and user moderation.
              </p>
            </div>
            <a href="/admin" className="btn-primary py-2 px-4 text-xs">
              Open Admin Portal ↗
            </a>
          </div>
        )}

        {/* Profile Card in CUMID Card Design */}
        <div className="p-6 sm:p-8 bg-ivory-100 border border-charcoal-800/10 rounded-sm shadow-soft space-y-6">
          <div className="flex items-center gap-4">
            {session.user?.user_metadata?.avatar_url ? (
              <img
                src={session.user.user_metadata.avatar_url}
                alt=""
                className="w-14 h-14 rounded-full border border-charcoal-800/15 object-cover"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-ivory-300 flex items-center justify-center text-charcoal-800 font-bold text-lg">
                {(session.user?.email?.[0] || 'U').toUpperCase()}
              </div>
            )}
            <div>
              <h2 className="text-lg font-display font-medium text-charcoal-900">
                {session.user?.user_metadata?.full_name || 'Rablo User'}
              </h2>
              <p className="text-xs text-charcoal-600">{session.user?.email}</p>
              <div className="flex gap-2 mt-2">
                {isAdmin && <span className="badge-preview !bg-purple-100 !text-purple-800">Admin</span>}
                {profile?.is_seller && <span className="badge-preview !bg-sage-100 !text-sage-800">Verified Seller</span>}
                {!isAdmin && !profile?.is_seller && <span className="badge-preview">Buyer</span>}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-charcoal-800/10 flex flex-wrap gap-3">
            <a href="/catalog" className="btn-secondary py-2.5 px-4 text-xs inline-flex items-center gap-1.5">
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Browse Catalog</span>
            </a>
            <a href="/cart" className="btn-secondary py-2.5 px-4 text-xs inline-flex items-center gap-1.5">
              <span>Saved Cart</span>
            </a>
            {profile?.is_seller && (
              <a href="/seller" className="btn-secondary py-2.5 px-4 text-xs inline-flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5" />
                <span>Seller Hub</span>
              </a>
            )}
            {isAdmin && (
              <a href="/admin" className="btn-secondary py-2.5 px-4 text-xs inline-flex items-center gap-1.5 text-purple-800 border-purple-300 bg-purple-50 hover:bg-purple-100 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-purple-700" />
                <span>Admin Operations</span>
              </a>
            )}
            {!profile?.is_seller && !isAdmin && (
              <button
                type="button"
                onClick={handleBecomeSeller}
                className="btn-primary py-2.5 px-4 text-xs inline-flex items-center gap-1.5"
              >
                <span>✨ Become a Seller</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleSignOut}
              className="py-2.5 px-4 rounded-sm border border-charcoal-800/20 text-xs font-semibold text-charcoal-700 hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors ml-auto inline-flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-600" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Signed Out View
  return (
    <div className="space-y-6">
      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-sm text-xs">
          {errorMsg}
        </div>
      )}

      <div className="p-8 sm:p-12 bg-ivory-100 border border-charcoal-800/10 rounded-sm shadow-soft text-center space-y-6">
        <div className="w-14 h-14 rounded-full bg-ivory-300 text-charcoal-800 mx-auto flex items-center justify-center">
          <User className="w-7 h-7 text-charcoal-700" />
        </div>
        <div className="space-y-2 max-w-sm mx-auto">
          <h2 className="text-xl font-display font-medium text-charcoal-900">
            Sign in to Rablo
          </h2>
          <p className="text-xs text-charcoal-600 leading-relaxed">
            Connect using your Google account to save discovery leads, list your creations, and communicate with makers.
          </p>
        </div>

        {targetIg && (
          <div className="p-3.5 bg-[#7C0E44]/10 border border-[#7C0E44]/25 rounded-sm text-xs text-[#7C0E44] flex items-center justify-center gap-2 max-w-sm mx-auto font-medium">
            <Lock className="w-4 h-4 flex-shrink-0" />
            <span>Sign in to unlock this creator's Instagram ID and jump straight to their DM.</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleGoogleSignIn}
          className="btn-primary inline-flex items-center gap-3 px-8 py-3.5 text-sm"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" className="bg-white rounded-full p-0.5">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
          </svg>
          <span>Continue with Google</span>
        </button>
      </div>
    </div>
  );
};

export default AccountView;
