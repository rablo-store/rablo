import React, { useState, useEffect } from 'react';
import { ShoppingBag } from 'lucide-react';
import { getCartCount } from '../../lib/cart';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

export const CartButton: React.FC = () => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    
    const fetchCount = async () => {
      const c = await getCartCount();
      setCount(c);
    };
    fetchCount();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchCount();
    });

    const handler = () => fetchCount();
    window.addEventListener('rablo:cart-updated', handler);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('rablo:cart-updated', handler);
    };
  }, []);

  return (
    <a
      href="/cart"
      className="p-2.5 rounded-full text-charcoal-800 hover:bg-ivory-300 transition-colors relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lavender-600 inline-flex items-center justify-center"
      aria-label="View Saved Lead Cart"
      title="Saved Cart"
    >
      <ShoppingBag className="w-5 h-5 text-charcoal-800 transition-transform hover:scale-105" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 px-1.5 py-0.2 min-w-5 h-5 rounded-full text-[10px] font-bold bg-lavender-600 text-ivory-100 flex items-center justify-center shadow-sm">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </a>
  );
};

export default CartButton;
