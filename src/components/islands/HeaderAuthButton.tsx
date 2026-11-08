import React, { useState, useEffect, useRef } from 'react';
import { User, LogIn, ShieldCheck, LogOut, Store, ShoppingBag, ChevronDown } from 'lucide-react';
import { supabase, isSupabaseConfigured, isAdminEmail, signOutUser, getCurrentProfile, type RabloProfile } from '../../lib/supabase';

export const HeaderAuthButton: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<RabloProfile | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const email = session?.user?.email || null;
      setIsLoggedIn(Boolean(session?.user));
      setIsAdmin(isAdminEmail(email));
      setUserEmail(email);
      if (session?.user) {
        const p = await getCurrentProfile();
        setProfile(p);
      }
    }).catch(() => {});

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const email = session?.user?.email || null;
      setIsLoggedIn(Boolean(session?.user));
      setIsAdmin(isAdminEmail(email));
      setUserEmail(email);
      if (session?.user) {
        const p = await getCurrentProfile();
        setProfile(p);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Handle outside click & escape key to close dropdown
  useEffect(() => {
    if (!dropdownOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [dropdownOpen]);

  const handleSignOut = async () => {
    setDropdownOpen(false);
    await signOutUser('/account?signed_out=1');
  };

  const getInitials = () => {
    if (profile?.full_name) {
      const parts = profile.full_name.trim().split(/\s+/);
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return parts[0].slice(0, 2).toUpperCase();
    }
    if (userEmail) {
      const name = userEmail.split('@')[0];
      return name.slice(0, 2).toUpperCase();
    }
    return 'SN';
  };

  if (!isLoggedIn) {
    return (
      <a
        href="/account"
        className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-full text-xs font-semibold bg-[#9E4A2B] text-[#FAF6F0] hover:bg-[#843C22] transition-all shadow-xs flex-shrink-0"
        aria-label="Sign in to your account"
        title="Sign In"
      >
        <User className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Sign In</span>
      </a>
    );
  }

  return (
    <div className="relative inline-block flex-shrink-0" ref={containerRef}>
      <button
        type="button"
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="p-0.5 rounded-full hover:ring-2 hover:ring-[#9E4A2B]/40 transition-all relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9E4A2B] inline-flex items-center gap-1 cursor-pointer"
        aria-label={`Account menu for ${userEmail || 'user'}`}
        aria-expanded={dropdownOpen}
        title={isAdmin ? `Superadmin: ${userEmail}` : `Account: ${userEmail}`}
      >
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#D9A378] text-[#30251F] font-semibold text-xs flex items-center justify-center border border-[#30251F]/15 shadow-xs">
          {isAdmin ? (
            <ShieldCheck className="w-4 h-4 text-[#30251F]" />
          ) : (
            getInitials()
          )}
        </div>
      </button>

      {/* Dropdown Menu */}
      {dropdownOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-ivory-100 border border-charcoal-800/15 rounded-sm shadow-soft-lg z-50 p-2 text-left animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Header Info */}
          <div className="px-3 py-2 border-b border-charcoal-800/10 mb-1">
            <p className="text-[11px] text-charcoal-500 uppercase tracking-wider font-semibold">
              Signed In
            </p>
            <p className="text-xs font-semibold text-charcoal-900 truncate" title={userEmail || ''}>
              {userEmail}
            </p>
            <div className="mt-1">
              {isAdmin ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                  <ShieldCheck className="w-3 h-3 text-purple-700" />
                  <span>Superadmin</span>
                </span>
              ) : profile?.is_seller ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sage-100 text-sage-800 border border-sage-200">
                  <span>Verified Creator</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-ivory-200 text-charcoal-700 border border-charcoal-800/10">
                  <span>Shopper</span>
                </span>
              )}
            </div>
          </div>

          {/* Links */}
          <div className="space-y-0.5 py-1">
            {isAdmin && (
              <a
                href="/admin"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-purple-900 bg-purple-50 hover:bg-purple-100 rounded-sm transition-colors"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-purple-700" />
                <span>Admin Operations</span>
              </a>
            )}

            <a
              href="/account"
              onClick={() => setDropdownOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-charcoal-800 hover:bg-ivory-200 rounded-sm transition-colors"
            >
              <User className="w-3.5 h-3.5 text-charcoal-600" />
              <span>My Account</span>
            </a>

            <a
              href="/seller"
              onClick={() => setDropdownOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-charcoal-800 hover:bg-ivory-200 rounded-sm transition-colors"
            >
              <Store className="w-3.5 h-3.5 text-charcoal-600" />
              <span>Seller Hub</span>
            </a>

            <a
              href="/cart"
              onClick={() => setDropdownOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-charcoal-800 hover:bg-ivory-200 rounded-sm transition-colors"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-charcoal-600" />
              <span>Saved Lead Cart</span>
            </a>
          </div>

          {/* Sign Out Button */}
          <div className="border-t border-charcoal-800/10 pt-1 mt-1">
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 rounded-sm transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-600" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HeaderAuthButton;
