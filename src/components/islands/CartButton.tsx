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
      className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-full text-xs font-medium text-[#30251F] hover:bg-[#EBE3D7] transition-all relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9E4A2B] border border-[#30251F]/10 flex-shrink-0"
      aria-label="View Saved Lead Cart"
      title="Saved Lead Cart"
    >
      <ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#30251F]" />
      <span className="hidden sm:inline font-medium text-[11px] lg:text-xs">Lead Cart</span>
      {count > 0 ? (
        <span className="px-1.5 py-0.5 min-w-4 sm:min-w-4.5 h-4 sm:h-4.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-[#9E4A2B] text-[#FAF6F0] flex items-center justify-center leading-none">
          {count > 99 ? '99+' : count}
        </span>
      ) : (
        <span className="hidden md:flex px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[#EBE3D7] text-[#685950] items-center justify-center leading-none">
          0
        </span>
      )}
    </a>
  );
};

export default CartButton;
