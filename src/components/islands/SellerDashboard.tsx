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
      <div className="max-w-md mx-auto text-center py-16 px-6 bg-ivory-100 border border-charcoal-800/10 rounded-sm">
        <p className="text-base font-display font-medium text-charcoal-900 mb-2">
          Seller Login Required
        </p>
        <p className="text-xs text-charcoal-600 mb-6 leading-relaxed">
          Please sign in with your Google account to access your seller dashboard and listings.
        </p>
        <a href="/account?redirect=/seller" className="btn-primary">
          Sign In with Google ↗
        </a>
      </div>
    );
  }

  const approvedCount = products.filter((p) => p.approval_status === 'Approved').length;
  const pendingCount = products.filter((p) => p.approval_status === 'Pending').length;
  const rejectedCount = products.filter((p) => p.approval_status === 'Rejected').length;

  return (
    <div className="space-y-8">
      {/* Header Banner in CUMID Card Style */}
      <div className="p-6 sm:p-8 bg-ivory-100 border border-charcoal-800/10 rounded-sm shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="badge-preview !bg-lavender-100 !text-lavender-800 font-semibold">
              Verified Creator
            </span>
            <span className="text-xs text-charcoal-500">{profile.email}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-medium text-charcoal-900 tracking-tight">
            Welcome, {profile.full_name || 'Creator'}
          </h1>
          <p className="text-xs text-charcoal-600 mt-1">
            Manage your Instagram catalog items, verify your DM profile link, and monitor moderation statuses.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={handleSignOut}
            className="py-3 px-4 rounded-sm border border-charcoal-800/20 text-xs font-semibold text-charcoal-700 hover:text-red-700 hover:bg-red-50 hover:border-red-200 transition-colors inline-flex items-center gap-2 cursor-pointer"
            title="Sign out of Creator account"
          >
            <LogOut className="w-4 h-4 text-rose-600" />
            <span>Sign Out</span>
          </button>

          <a
            href="/seller/upload"
            className="btn-primary inline-flex items-center gap-2 py-3 px-5 text-xs font-semibold"
          >
            <Plus className="w-4 h-4" />
            <span>List New Creation</span>
          </a>
        </div>
      </div>

      {/* CUMID Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-5 bg-ivory-100 border border-charcoal-800/10 rounded-sm shadow-soft">
          <span className="text-[11px] uppercase tracking-wider text-charcoal-500 block">
            Total Listings
          </span>
          <div className="text-2xl font-bold text-charcoal-900 mt-1">
            {products.length}
          </div>
        </div>

        <div className="p-5 bg-ivory-100 border border-charcoal-800/10 rounded-sm shadow-soft">
          <span className="text-[11px] uppercase tracking-wider text-sage-600 block font-semibold">
            Approved &amp; Live
          </span>
          <div className="text-2xl font-bold text-sage-700 mt-1">
            {approvedCount}
          </div>
        </div>

        <div className="p-5 bg-ivory-100 border border-charcoal-800/10 rounded-sm shadow-soft">
          <span className="text-[11px] uppercase tracking-wider text-peach-600 block font-semibold">
            Pending Moderation
          </span>
          <div className="text-2xl font-bold text-peach-700 mt-1">
            {pendingCount}
          </div>
        </div>

        <div className="p-5 bg-ivory-100 border border-charcoal-800/10 rounded-sm shadow-soft">
          <span className="text-[11px] uppercase tracking-wider text-charcoal-500 block">
            Rejected
          </span>
          <div className="text-2xl font-bold text-charcoal-800 mt-1">
            {rejectedCount}
          </div>
        </div>
      </div>

      {/* Instagram Profile Settings Card */}
      <div className="p-6 bg-ivory-100 border border-charcoal-800/10 rounded-sm shadow-soft space-y-4">
        <div>
          <h3 className="text-base font-display font-medium text-charcoal-900">
            Your Instagram Profile URL
          </h3>
          <p className="text-xs text-charcoal-600 mt-0.5">
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
            className="flex-1 px-4 py-2.5 bg-ivory-50 border border-charcoal-800/20 rounded-sm text-xs text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-lavender-600"
          />
          <button
            type="submit"
            disabled={updatingProfile}
            className="btn-secondary py-2.5 px-5 text-xs font-medium flex-shrink-0"
          >
            {updatingProfile ? 'Saving...' : 'Update Instagram Link'}
          </button>
        </form>

        {profileMessage && (
          <p className="text-xs text-sage-700 font-semibold flex items-center gap-1.5 pt-1">
            <Check className="w-3.5 h-3.5" />
            <span>{profileMessage}</span>
          </p>
        )}
      </div>

      {/* Listings Table / Cards */}
      <div className="bg-ivory-100 border border-charcoal-800/10 rounded-sm shadow-soft overflow-hidden">
        <div className="p-5 border-b border-charcoal-800/10 flex items-center justify-between">
          <h3 className="text-base font-display font-medium text-charcoal-900">
            Your Catalog Items
          </h3>
          <span className="text-xs text-charcoal-500">{products.length} total</span>
        </div>

        {products.length === 0 ? (
          <div className="text-center py-16 px-6">
            <p className="text-sm font-semibold text-charcoal-900 mb-1">No items listed yet</p>
            <p className="text-xs text-charcoal-600 mb-6">
              Start adding your Instagram creations to reach new buyers.
            </p>
            <a href="/seller/upload" className="btn-primary">
              List Your First Item ↗
            </a>
          </div>
        ) : (
          <div className="divide-y divide-charcoal-800/10">
            {products.map((p) => (
              <div key={p.id} className="p-5 space-y-3">
                <div className="flex items-center gap-4">
                  {/* Thumbnail */}
                  <div className="w-16 h-16 bg-[#eee9e1] rounded-sm overflow-hidden flex-shrink-0 p-1 flex items-center justify-center">
                    {p.thumbnail_url ? (
                      <img src={p.thumbnail_url} alt="" className="w-full h-full object-contain" />
                    ) : (
                      <span className="text-charcoal-400 font-serif">✦</span>
                    )}
                  </div>

                  {/* Title & Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-display font-medium text-base text-charcoal-900 truncate">
                      {p.name}
                    </h4>
                    <div className="flex items-center gap-2 text-xs text-charcoal-500 mt-0.5">
                      <span>{p.category?.name || 'Uncategorized'}</span>
                      <span>•</span>
                      <span className="font-semibold text-charcoal-900">₹{p.price}</span>
                      <span>•</span>
                      <span>{p.stock} in stock</span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs px-2.5 py-1 rounded-sm font-medium ${p.approval_status === 'Approved'
                          ? 'bg-sage-100 text-sage-800 border border-sage-300'
                          : p.approval_status === 'Pending'
                            ? 'bg-peach-100 text-peach-800 border border-peach-300'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}
                    >
                      {p.approval_status}
                    </span>

                    {p.approval_status === 'Approved' && (
                      <a
                        href={`/products/${p.id}`}
                        target="_blank"
                        rel="noopener"
                        className="text-xs text-lavender-700 hover:underline inline-flex items-center gap-1 font-medium"
                      >
                        <span>View</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Rejection Note */}
                {p.approval_status === 'Rejected' && p.rejection_feedback && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-sm text-xs text-red-700 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-semibold">Moderator Note:</strong> {p.rejection_feedback}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SellerDashboard;
