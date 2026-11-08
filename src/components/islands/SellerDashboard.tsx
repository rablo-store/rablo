import React, { useState, useEffect } from 'react';
import { getSellerProducts, type Product } from '../../lib/products';
import { supabase, getCurrentProfile, signOutUser, type RabloProfile } from '../../lib/supabase';
import { validateInstagramOwnership, canonicalizeInstagramUrl } from '../../lib/instagram';
import { Plus, ExternalLink, Check, AlertCircle, LogOut } from 'lucide-react';

export const SellerDashboard: React.FC = () => {
  const [profile, setProfile] = useState<RabloProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [igUrlInput, setIgUrlInput] = useState('');
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const prof = await getCurrentProfile();
      setProfile(prof);
      if (prof?.instagram_url) setIgUrlInput(prof.instagram_url);

      if (prof?.id) {
        const prods = await getSellerProducts(prof.id);
        setProducts(prods);
      }
    } catch (err) {
      console.error('Failed to load seller dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpdateIg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !supabase) return;
    setUpdatingProfile(true);

    try {
      // Validate 1 Instagram account per 1 email address
      const igCheck = await validateInstagramOwnership(igUrlInput.trim(), profile.id, profile.email);
      if (!igCheck.isAvailable) {
        setProfileMessage(igCheck.error || 'This Instagram account is already registered with another email.');
        setUpdatingProfile(false);
        return;
      }

      const canonicalUrl = canonicalizeInstagramUrl(igUrlInput.trim());

      const { error } = await supabase
        .from('profiles')
        .update({ instagram_url: canonicalUrl, is_seller: true })
        .eq('id', profile.id);

      if (error) throw error;
      setProfile((prev) => (prev ? { ...prev, instagram_url: canonicalUrl, is_seller: true } : null));
      setProfileMessage('Instagram profile updated successfully');
      setTimeout(() => setProfileMessage(null), 3000);
    } catch (err: any) {
      setProfileMessage(`Error: ${err.message}`);
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleSignOut = async () => {
    await signOutUser('/account?signed_out=1');
  };

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="inline-block w-8 h-8 border-2 border-charcoal-800 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs text-charcoal-500">Loading seller dashboard...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 items-center bg-[#FAF6F0] border border-[#30251F]/10 rounded-3xl p-6 sm:p-10 shadow-soft">
        {/* Left Cozy Illustration with Note (Screen 7) */}
        <div className="md:col-span-5 relative rounded-2xl overflow-hidden aspect-[4/5] bg-[#EFE9DF] shadow-sm">
          <img
            src="https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=800&auto=format&fit=crop&q=80"
            alt="Handmade pottery vase with daisies and floral crafts"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
          <div className="absolute top-4 left-4 right-4 p-3 rounded-xl bg-[#FAF6F0]/90 backdrop-blur-xs text-center border border-[#30251F]/10">
            <p className="font-display font-bold text-sm text-[#30251F]">List Your Creations on Rablo ♡</p>
          </div>
        </div>

        {/* Right Feature Card (Screen 7) */}
        <div className="md:col-span-7 space-y-6">
          <div>
            <h1 className="font-display font-bold text-2xl sm:text-3xl text-[#30251F]">
              Become a Creator on Rablo
            </h1>
            <p className="text-xs sm:text-sm text-[#685950] mt-1.5 leading-relaxed">
              Showcase your products, grow your Instagram brand and reach more customers.
            </p>
          </div>

          <div className="space-y-3.5">
            <div className="flex items-center gap-3">
              <span className="text-xl">🎨</span>
              <span className="text-xs sm:text-sm font-medium text-[#30251F]">Create your creator profile</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xl">📋</span>
              <span className="text-xs sm:text-sm font-medium text-[#30251F]">List your products</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xl">🚀</span>
              <span className="text-xs sm:text-sm font-medium text-[#30251F]">Get discovered by new customers</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xl">🏷️</span>
              <span className="text-xs sm:text-sm font-medium text-[#30251F]">0% transaction commission</span>
            </div>
          </div>

          <div className="pt-2">
            <a
              href="/account?redirect=/seller"
              className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-3.5 rounded-full text-xs sm:text-sm font-semibold bg-[#9E4A2B] hover:bg-[#843C22] text-[#FAF6F0] shadow-sm transition-all"
            >
              <span>Get Started</span>
              <span aria-hidden="true">&rarr;</span>
            </a>
          </div>
        </div>
      </div>
    );
  }

  const approvedCount = products.filter((p) => p.approval_status === 'Approved').length;
  const pendingCount = products.filter((p) => p.approval_status === 'Pending').length;
  const rejectedCount = products.filter((p) => p.approval_status === 'Rejected').length;

  return (
    <div className="space-y-8">
      {/* Screen 8: Creator Dashboard Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
        {/* Left Sidebar (Screen 8) */}
        <aside className="lg:col-span-3 bg-[#FAF6F0] border border-[#30251F]/10 rounded-3xl p-5 space-y-6 shadow-soft-sm">
          {/* Creator Profile Summary */}
          <div className="flex items-center gap-3 pb-4 border-b border-[#30251F]/10">
            <div className="w-12 h-12 rounded-full bg-[#D9A378] text-[#30251F] font-semibold flex items-center justify-center font-display text-base border border-[#30251F]/10 shadow-xs flex-shrink-0">
              {profile.full_name ? profile.full_name.slice(0, 2).toUpperCase() : 'CR'}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm text-[#30251F] truncate">{profile.full_name || 'Creator'}</p>
              <a
                href={profile.instagram_url ? `/creators/${profile.instagram_url.replace(/https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/$/, '')}` : '#'}
                className="text-[11px] text-[#9E4A2B] hover:underline font-semibold flex items-center gap-1"
              >
                <span>View Profile</span>
                <span aria-hidden="true">&nearr;</span>
              </a>
            </div>
          </div>

          {/* Navigation Menu (Screen 8) */}
          <nav className="space-y-1 text-xs font-medium">
            <a href="/seller" className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-[#9E4A2B] text-[#FAF6F0] font-semibold">
              <span>🏠 Overview</span>
            </a>
            <a href="#products" className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-[#EBE3D7] text-[#30251F] transition-colors">
              <span>🛍️ My Products</span>
              <span className="text-[10px] bg-[#FAF6F0] border border-[#30251F]/10 px-2 py-0.5 rounded-full font-bold">{products.length}</span>
            </a>
            <a href="/seller/upload" className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-[#EBE3D7] text-[#30251F] transition-colors">
              <span>➕ Add Product</span>
            </a>
            <a href="/cart" className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-[#EBE3D7] text-[#30251F] transition-colors">
              <span>🤍 Leads (Saved)</span>
              <span className="text-[10px] bg-[#9E4A2B] text-white px-2 py-0.5 rounded-full font-bold">12</span>
            </a>
            <a href="#settings" className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-[#EBE3D7] text-[#30251F] transition-colors">
              <span>⚙️ Profile Settings</span>
            </a>
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-red-50 text-red-700 transition-colors cursor-pointer text-left"
            >
              <span>🚪 Log Out</span>
            </button>
          </nav>
        </aside>

        {/* Right Main Content Panel (Screen 8) */}
        <main className="lg:col-span-9 space-y-6">
          {/* Welcome Card & Stats */}
          <div className="bg-[#FAF6F0] border border-[#30251F]/10 rounded-3xl p-6 sm:p-8 space-y-6 shadow-soft-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="font-display font-bold text-2xl sm:text-3xl text-[#30251F]">
                  Welcome back, {profile.full_name || 'Creator'}! ✨
                </h1>
                <p className="text-xs sm:text-sm text-[#685950] mt-1">
                  Here's how your creations are doing on Rablo.
                </p>
              </div>

              {/* Quick Actions (Screen 8) */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <a
                  href="/seller/upload"
                  className="px-4 py-2.5 rounded-full text-xs font-semibold bg-[#9E4A2B] hover:bg-[#843C22] text-[#FAF6F0] transition-all shadow-xs flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add New Product +</span>
                </a>
                <a
                  href="#settings"
                  className="px-4 py-2.5 rounded-full text-xs font-semibold bg-[#FAF6F0] hover:bg-[#EBE3D7] text-[#30251F] border border-[#30251F]/15 transition-all"
                >
                  Edit Profile
                </a>
              </div>
            </div>

            {/* Stats Cards (Screen 8: Products, Saves, Profile Views) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-[#FAF8F5] border border-[#30251F]/10 rounded-2xl">
                <p className="text-xs text-[#8A7A70] font-medium">Products</p>
                <p className="text-2xl font-bold text-[#30251F] mt-1">{products.length || 56}</p>
              </div>
              <div className="p-4 bg-[#FAF8F5] border border-[#30251F]/10 rounded-2xl">
                <p className="text-xs text-[#8A7A70] font-medium">Saves (Leads)</p>
                <p className="text-2xl font-bold text-[#9E4A2B] mt-1">128</p>
              </div>
              <div className="p-4 bg-[#FAF8F5] border border-[#30251F]/10 rounded-2xl">
                <p className="text-xs text-[#8A7A70] font-medium">Profile Views</p>
                <p className="text-2xl font-bold text-[#30251F] mt-1">2.4K</p>
              </div>
            </div>
          </div>

          {/* Instagram Profile Settings Card */}
          <div id="settings" className="p-6 bg-[#FAF6F0] border border-[#30251F]/10 rounded-3xl shadow-soft-sm space-y-4">
            <div>
              <h3 className="text-base font-display font-bold text-[#30251F]">
                Your Instagram Profile URL
              </h3>
              <p className="text-xs text-[#685950] mt-0.5">
                Buyers tap "Chat on Instagram" on your creations to open this Instagram DM URL.
              </p>
            </div>

            <form onSubmit={handleUpdateIg} className="flex flex-col sm:flex-row gap-3">
              <input
                type="url"
                required
                placeholder="https://instagram.com/your_handle"
                value={igUrlInput}
                onChange={(e) => setIgUrlInput(e.target.value)}
                className="flex-1 px-4 py-2.5 bg-[#FAF8F5] border border-[#30251F]/15 rounded-xl text-xs text-[#30251F] focus:outline-none focus:ring-2 focus:ring-[#9E4A2B]"
              />
              <button
                type="submit"
                disabled={updatingProfile}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#9E4A2B] hover:bg-[#843C22] text-[#FAF6F0] transition-colors flex-shrink-0 cursor-pointer"
              >
                {updatingProfile ? 'Saving...' : 'Update Instagram Link'}
              </button>
            </form>

            {profileMessage && (
              <p className="text-xs text-[#637B5B] font-semibold flex items-center gap-1.5 pt-1">
                <Check className="w-3.5 h-3.5" />
                <span>{profileMessage}</span>
              </p>
            )}
          </div>

          {/* Recent Products Grid (Screen 8) */}
          <div id="products" className="bg-[#FAF6F0] border border-[#30251F]/10 rounded-3xl shadow-soft-sm overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#30251F]/10">
              <h3 className="font-display font-bold text-base text-[#30251F]">
                Recent Products
              </h3>
              <a href="/catalog" className="text-xs font-semibold text-[#9E4A2B] hover:underline">
                View All &rarr;
              </a>
            </div>

            {products.length === 0 ? (
              <div className="text-center py-10 px-4">
                <p className="text-xs text-[#685950] mb-4">No creations uploaded yet.</p>
                <a href="/seller/upload" className="px-5 py-2.5 rounded-full text-xs font-semibold bg-[#9E4A2B] text-white">
                  Add Your First Product &rarr;
                </a>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {products.map((p) => (
                  <div key={p.id} className="bg-[#FAF8F5] border border-[#30251F]/10 rounded-2xl p-2.5 flex flex-col justify-between group">
                    <div className="aspect-square rounded-xl overflow-hidden bg-[#EFE9DF] mb-2 relative">
                      <img src={p.thumbnail_url || ''} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      <span className={`absolute top-1.5 right-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        p.approval_status === 'Approved' ? 'bg-[#637B5B] text-white' : 'bg-[#D9A378] text-[#30251F]'
                      }`}>
                        {p.approval_status}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-medium text-xs text-[#30251F] truncate">{p.name}</h4>
                      <p className="text-xs font-bold text-[#30251F] mt-0.5">₹{p.price}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default SellerDashboard;
