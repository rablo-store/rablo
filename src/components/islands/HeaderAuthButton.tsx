import React, { useState, useEffect } from 'react';
import { User, LogIn, ShieldCheck } from 'lucide-react';
import { supabase, isSupabaseConfigured, isAdminEmail } from '../../lib/supabase';

export const HeaderAuthButton: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      const email = session?.user?.email || null;
      setIsLoggedIn(Boolean(session?.user));
      setIsAdmin(isAdminEmail(email));
      setUserEmail(email);
    }).catch(() => {});

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const email = session?.user?.email || null;
      setIsLoggedIn(Boolean(session?.user));
      setIsAdmin(isAdminEmail(email));
      setUserEmail(email);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <a
      href={isLoggedIn ? (isAdmin ? '/admin' : '/account') : '/account'}
      className="p-2.5 rounded-full text-charcoal-800 hover:bg-ivory-300 transition-colors relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lavender-600 inline-flex items-center justify-center"
      aria-label={isLoggedIn ? `Account (${userEmail || 'Signed in'})` : 'Sign in to your account'}
      title={isLoggedIn ? (isAdmin ? 'Admin Portal' : `Account: ${userEmail}`) : 'Sign in'}
    >
      {isLoggedIn ? (
        isAdmin ? (
          <ShieldCheck className="w-5 h-5 text-purple-700 transition-transform hover:scale-105" />
        ) : (
          <User className="w-5 h-5 text-charcoal-800 transition-transform hover:scale-105" />
        )
      ) : (
        <LogIn className="w-5 h-5 text-charcoal-800 transition-transform hover:scale-105" />
      )}
    </a>
  );
};

export default HeaderAuthButton;
