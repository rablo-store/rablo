import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured, isAdminEmail, signOutUser } from '../../../lib/supabase';
import { getAllProducts, approveProduct, rejectProduct, deleteProduct, type Product } from '../../../lib/products';
import { getAllBrands, approveBrand, rejectBrand, setBrandVerified, type Brand } from '../../../lib/brands';
import { resolveContact } from '../../../lib/contact';
import { ShieldCheck, Check, X, Ban, RefreshCw, ExternalLink, LogOut, Trash2, BadgeCheck, Layout } from 'lucide-react';
import { AdminHomepageTab } from './AdminHomepageTab';
import { AdminCategoryManager } from './AdminCategoryManager';
import { AdminVerificationQueue } from './AdminVerificationQueue';

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'products' | 'verification' | 'brands' | 'categories' | 'users' | 'homepage'>('verification');
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [categoryRequests, setCategoryRequests] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [rejectModalProduct, setRejectModalProduct] = useState<Product | null>(null);
  const [rejectFeedback, setRejectFeedback] = useState('');
  const [rejectModalBrand, setRejectModalBrand] = useState<Brand | null>(null);
  const [brandRejectFeedback, setBrandRejectFeedback] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadData = async (showLoading = true) => {
    if (!isSupabaseConfigured || !supabase) return;
    if (showLoading) setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const email = session?.user?.email || '';

      if (!isAdminEmail(email)) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setIsAdmin(true);

      const [prods, cats, catReqs, profiles, brandList] = await Promise.all([
        getAllProducts(),
        supabase.from('categories').select('*').order('name'),
        supabase.from('category_requests').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        getAllBrands(),
      ]);

      setProducts(prods);
      setCategories(cats.data || []);
      setCategoryRequests(catReqs.data || []);
      setUsers(profiles.data || []);

      // Sort brands with Pending first, then by date descending
      const sortedBrands = [...brandList].sort((a, b) => {
        if (a.approval_status === 'Pending' && b.approval_status !== 'Pending') return -1;
        if (a.approval_status !== 'Pending' && b.approval_status === 'Pending') return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      setBrands(sortedBrands);
    } catch (err) {
      console.error('Failed to load admin dashboard:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApproveProduct = async (productId: string) => {
    const success = await approveProduct(productId);
    if (success) {
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, approval_status: 'Approved', rejection_feedback: null } : p))
      );
      setToastMessage('Approved - added to New Arrivals');
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectModalProduct || !rejectFeedback.trim()) return;

    const success = await rejectProduct(rejectModalProduct.id, rejectFeedback.trim());
    if (success) {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === rejectModalProduct.id
            ? { ...p, approval_status: 'Rejected', rejection_feedback: rejectFeedback.trim() }
            : p
        )
      );
      setToastMessage(`Product rejected with feedback sent to creator.`);
      setRejectModalProduct(null);
      setRejectFeedback('');
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleDeleteProduct = async (productId: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"? This will remove it from the catalog.`)) {
      return;
    }
    const success = await deleteProduct(productId);
    if (success) {
      setProducts((prev) => prev.filter((p) => p.id !== productId));
      setToastMessage(`Product "${name}" deleted successfully.`);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleApproveBrand = async (brandId: string) => {
    const success = await approveBrand(brandId);
    if (success) {
      setBrands((prev) =>
        prev.map((b) => (b.id === brandId ? { ...b, approval_status: 'Approved', rejection_feedback: null } : b))
      );
      setToastMessage('Brand approved for Rijlo creators directory');
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleConfirmRejectBrand = async () => {
    if (!rejectModalBrand || !brandRejectFeedback.trim()) return;

    const success = await rejectBrand(rejectModalBrand.id, brandRejectFeedback.trim());
    if (success) {
      setBrands((prev) =>
        prev.map((b) =>
          b.id === rejectModalBrand.id
            ? { ...b, approval_status: 'Rejected', rejection_feedback: brandRejectFeedback.trim() }
            : b
        )
      );
      setToastMessage('Brand registration rejected with feedback.');
      setRejectModalBrand(null);
      setBrandRejectFeedback('');
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleToggleBrandVerified = async (brandId: string, currentVerified: boolean) => {
    const newStatus = !currentVerified;
    const success = await setBrandVerified(brandId, newStatus);
    if (success) {
      setBrands((prev) =>
        prev.map((b) => (b.id === brandId ? { ...b, is_verified: newStatus } : b))
      );
      setToastMessage(newStatus ? 'Brand verified badge enabled.' : 'Brand verified badge disabled.');
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleApproveCategoryRequest = async (req: any) => {
    if (!supabase) return;
    const slug = req.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const { error: catErr } = await supabase.from('categories').insert({
      name: req.name,
      slug,
      is_approved: true,
      requested_by: req.requested_by,
    });

    if (!catErr) {
      await supabase.from('category_requests').update({ status: 'Approved' }).eq('id', req.id);
      setToastMessage(`Category "${req.name}" approved!`);
      loadData();
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleRejectCategoryRequest = async (reqId: string) => {
    if (!supabase) return;
    await supabase.from('category_requests').update({ status: 'Rejected' }).eq('id', reqId);
    setCategoryRequests((prev) => prev.map((r) => (r.id === reqId ? { ...r, status: 'Rejected' } : r)));
    setToastMessage('Category request rejected.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleToggleBan = async (userId: string, currentBan: boolean) => {
    if (!supabase) return;
    const newStatus = !currentBan;

    const { error } = await supabase
      .from('profiles')
      .update({ is_banned: newStatus })
      .eq('id', userId);

    if (!error) {
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, is_banned: newStatus } : u)));

      if (newStatus) {
        await supabase
          .from('products')
          .update({ approval_status: 'Rejected', rejection_feedback: 'Account suspended by administrator.' })
          .eq('seller_id', userId);

        await supabase
          .from('brands')
          .update({ approval_status: 'Rejected', rejection_feedback: 'Account suspended by administrator.' })
          .eq('owner_id', userId);

        loadData();
      }

      setToastMessage(newStatus ? 'User banned, brand rejected, and listings hidden.' : 'User ban revoked.');
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleSignOut = async () => {
    await signOutUser('/account?signed_out=1');
  };

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="inline-block w-8 h-8 border-2 border-charcoal-800 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs text-charcoal-500">Verifying administrator credentials...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto text-center py-16 px-6 bg-red-50 border border-red-200 rounded-sm space-y-4">
        <p className="text-base font-display font-medium text-red-900 mb-2">
          Restricted Operations Portal
        </p>
        <p className="text-xs text-red-700 leading-relaxed">
          Access is restricted strictly to <code>sumitkatiyar783@gmail.com</code>.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <a href="/" className="btn-secondary py-2.5 px-4 text-xs font-semibold">
            Return to Home
          </a>
          <button
            type="button"
            onClick={handleSignOut}
            className="btn-primary py-2.5 px-4 text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out &amp; Switch Account</span>
          </button>
        </div>
      </div>
    );
  }

  const pendingProducts = products.filter((p) => p.approval_status === 'Pending');
  const pendingBrands = brands.filter((b) => b.approval_status === 'Pending');
  const needsVerificationCount = brands.filter(
    (b) => b.verification_requested_at && b.approval_status === 'Pending' && !b.is_verified
  ).length;

  return (
    <div className="space-y-8">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-charcoal-900 text-ivory-100 px-5 py-3 rounded-sm shadow-soft-lg z-50 text-xs font-medium flex items-center gap-2 border border-charcoal-700/50">
          <Check className="w-4 h-4 text-sage-300" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="p-6 sm:p-8 bg-ivory-100 border border-charcoal-800/10 rounded-sm shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="badge-preview !bg-[#9E4A2B]/10 !text-[#9E4A2B] font-semibold inline-flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Superadmin</span>
            </span>
            <span className="text-xs text-charcoal-500">sumitkatiyar783@gmail.com</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-medium text-charcoal-900 tracking-tight">
            Store Operations &amp; Moderation
          </h1>
          <p className="text-xs text-charcoal-600 mt-1">
            Review submitted catalog items, approve requested categories, and manage registered creators and brands.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-shrink-0">
          <button
            type="button"
            onClick={() => loadData()}
            className="btn-secondary inline-flex items-center gap-1.5 py-2.5 px-3.5 text-xs font-medium"
            title="Refresh dashboard data"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleSignOut}
            className="py-2.5 px-3.5 rounded-sm border border-charcoal-800/20 text-xs font-medium text-charcoal-700 hover:text-red-700 hover:bg-red-50 hover:border-red-200 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            title="Sign out of Administrator account"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-600" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-4 bg-ivory-100 border border-charcoal-800/10 rounded-sm shadow-soft">
          <span className="text-[11px] uppercase tracking-wider text-peach-600 block font-semibold">
            Pending Products
          </span>
          <div className="text-xl sm:text-2xl font-bold text-peach-700 mt-1">
            {pendingProducts.length}
          </div>
        </div>

        <div className="p-4 bg-ivory-100 border border-charcoal-800/10 rounded-sm shadow-soft">
          <span className="text-[11px] uppercase tracking-wider text-peach-600 block font-semibold">
            Pending Brands
          </span>
          <div className="text-xl sm:text-2xl font-bold text-peach-700 mt-1">
            {pendingBrands.length}
          </div>
        </div>

        <div className="p-4 bg-ivory-100 border border-charcoal-800/10 rounded-sm shadow-soft">
          <span className="text-[11px] uppercase tracking-wider text-charcoal-500 block">
            Total Brands
          </span>
          <div className="text-xl sm:text-2xl font-bold text-charcoal-900 mt-1">
            {brands.length}
          </div>
        </div>

        <div className="p-4 bg-ivory-100 border border-charcoal-800/10 rounded-sm shadow-soft">
          <span className="text-[11px] uppercase tracking-wider text-charcoal-500 block">
            Total Products
          </span>
          <div className="text-xl sm:text-2xl font-bold text-charcoal-900 mt-1">
            {products.length}
          </div>
        </div>

        <div className="p-4 bg-ivory-100 border border-charcoal-800/10 rounded-sm shadow-soft">
          <span className="text-[11px] uppercase tracking-wider text-charcoal-500 block">
            Registered Users
          </span>
          <div className="text-xl sm:text-2xl font-bold text-charcoal-900 mt-1">
            {users.length}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-charcoal-800/10 pb-1 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('verification')}
          className={`px-4 py-2 text-xs font-medium rounded-t-sm transition-colors cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'verification'
              ? 'bg-ivory-100 text-charcoal-900 border-t border-x border-charcoal-800/15 font-semibold'
              : 'text-charcoal-600 hover:text-charcoal-900'
            }`}
        >
          <span>Instagram Verification</span>
          {needsVerificationCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-[#9E4A2B] text-white text-[10px] font-bold">
              {needsVerificationCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('products')}
          className={`px-4 py-2 text-xs font-medium rounded-t-sm transition-colors cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'products'
              ? 'bg-ivory-100 text-charcoal-900 border-t border-x border-charcoal-800/15 font-semibold'
              : 'text-charcoal-600 hover:text-charcoal-900'
            }`}
        >
          <span>Product Moderation ({products.length})</span>
          {pendingProducts.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-peach-500 text-white text-[10px] font-bold">
              {pendingProducts.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('brands')}
          className={`px-4 py-2 text-xs font-medium rounded-t-sm transition-colors cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'brands'
              ? 'bg-ivory-100 text-charcoal-900 border-t border-x border-charcoal-800/15 font-semibold'
              : 'text-charcoal-600 hover:text-charcoal-900'
            }`}
        >
          <span>Brands ({brands.length})</span>
          {pendingBrands.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-peach-500 text-white text-[10px] font-bold">
              {pendingBrands.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('categories')}
          className={`px-4 py-2 text-xs font-medium rounded-t-sm transition-colors cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'categories'
              ? 'bg-ivory-100 text-charcoal-900 border-t border-x border-charcoal-800/15 font-semibold'
              : 'text-charcoal-600 hover:text-charcoal-900'
            }`}
        >
          <span>Categories ({categories.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 text-xs font-medium rounded-t-sm transition-colors cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'users'
              ? 'bg-ivory-100 text-charcoal-900 border-t border-x border-charcoal-800/15 font-semibold'
              : 'text-charcoal-600 hover:text-charcoal-900'
            }`}
        >
          <span>Users &amp; Moderation ({users.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('homepage')}
          className={`px-4 py-2 text-xs font-medium rounded-t-sm transition-colors cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'homepage'
              ? 'bg-ivory-100 text-charcoal-900 border-t border-x border-charcoal-800/15 font-semibold'
              : 'text-charcoal-600 hover:text-charcoal-900'
            }`}
        >
          <Layout className="w-3.5 h-3.5 text-terracotta-600" />
          <span>Homepage</span>
        </button>
      </div>

      {/* Tab: Instagram Verification Queue */}
      {activeTab === 'verification' && (
        <AdminVerificationQueue
          onNotify={(msg, isErr) => {
            setToastMessage(msg);
            setTimeout(() => setToastMessage(null), 3000);
          }}
        />
      )}

      {/* Tab 1: Products */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          {products.map((p) => (
            <div
              key={p.id}
              className="p-5 bg-ivory-100 border border-charcoal-800/10 rounded-sm shadow-soft flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6"
            >
              <div className="w-16 h-16 bg-[#eee9e1] rounded-sm overflow-hidden flex-shrink-0 p-1 flex items-center justify-center">
                {p.thumbnail_url ? (
                  <img src={p.thumbnail_url} alt="" className="w-full h-full object-contain" />
                ) : (
                  <span className="text-charcoal-400 font-serif">✦</span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-sm font-medium ${p.approval_status === 'Approved'
                        ? 'bg-sage-100 text-sage-800'
                        : p.approval_status === 'Pending'
                          ? 'bg-peach-100 text-peach-800'
                          : 'bg-red-50 text-red-700'
                      }`}
                  >
                    {p.approval_status}
                  </span>
                  <span className="text-xs text-charcoal-500">
                    Category: {p.category?.name || 'None'}
                  </span>
                </div>

                <h3 className="font-display font-medium text-base text-charcoal-900 truncate">
                  {p.name} — ₹{p.price}
                </h3>

                <p className="text-xs text-charcoal-600 line-clamp-1 leading-relaxed mt-0.5">
                  {p.description}
                </p>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-charcoal-500 mt-2">
                  <span>Seller: {p.seller?.full_name || 'Anonymous'}</span>
                  <a
                    href={p.seller_ig_url}
                    target="_blank"
                    rel="noopener"
                    className="text-[#9E4A2B] hover:underline inline-flex items-center gap-1"
                  >
                    <span>Instagram Profile</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>

                  {p.contact_link && (
                    <a
                      href={p.contact_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#9E4A2B] hover:underline inline-flex items-center gap-1 font-semibold"
                    >
                      <span>Direct Chat Link ↗</span>
                    </a>
                  )}
                </div>

                {p.contact_link && (
                  <div className="mt-1 text-[11px] text-charcoal-600 bg-ivory-200/80 px-2 py-0.5 rounded-xs font-mono truncate max-w-lg">
                    Inquiry URL: {p.contact_link}
                  </div>
                )}

                {p.rejection_feedback && (
                  <p className="text-xs text-red-700 mt-1">
                    <strong>Feedback:</strong> {p.rejection_feedback}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-0 border-charcoal-800/10 flex-wrap">
                {p.approval_status !== 'Approved' && (
                  <button
                    type="button"
                    onClick={() => handleApproveProduct(p.id)}
                    className="py-2 px-3 text-xs font-semibold rounded-sm bg-sage-100 hover:bg-sage-200 text-sage-800 border border-sage-300 transition-colors inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Approve</span>
                  </button>
                )}

                {p.approval_status !== 'Rejected' && (
                  <button
                    type="button"
                    onClick={() => {
                      setRejectModalProduct(p);
                      setRejectFeedback('');
                    }}
                    className="py-2 px-3 text-xs font-semibold rounded-sm bg-ivory-50 hover:bg-red-50 text-red-700 border border-red-200 transition-colors inline-flex items-center gap-1 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleDeleteProduct(p.id, p.name)}
                  className="py-2 px-3 text-xs font-semibold rounded-sm bg-ivory-50 hover:bg-rose-50 text-rose-700 border border-rose-200 transition-colors inline-flex items-center gap-1 cursor-pointer"
                  title="Delete product listing (remove dummy or unwanted listing)"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Brands */}
      {activeTab === 'brands' && (
        <div className="space-y-4">
          {brands.length === 0 ? (
            <div className="p-8 bg-ivory-100 border border-charcoal-800/10 rounded-sm text-center text-xs text-charcoal-500">
              No registered creator brands found.
            </div>
          ) : (
            brands.map((b) => {
              const brandContact = Array.isArray(b.brand_contacts) ? b.brand_contacts[0] : b.brand_contacts;
              const contactType = brandContact?.contact_type || 'instagram';
              const resolved = resolveContact({
                brand: b,
                brandContact,
                product: { name: 'Sample Inquiry Product', price: 999 },
              });

              return (
                <div
                  key={b.id}
                  className={`p-5 bg-ivory-100 border rounded-sm shadow-soft flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 ${
                    b.approval_status === 'Pending' ? 'border-peach-400 ring-1 ring-peach-300' : 'border-charcoal-800/10'
                  }`}
                >
                  <div className="w-16 h-16 bg-[#eee9e1] rounded-full overflow-hidden flex-shrink-0 p-1 flex items-center justify-center border border-charcoal-800/10">
                    {b.logo_url ? (
                      <img src={b.logo_url} alt="" className="w-full h-full object-cover rounded-full" />
                    ) : (
                      <span className="text-charcoal-500 font-serif font-bold text-lg">{b.name[0] || 'B'}</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-sm font-medium ${
                          b.approval_status === 'Approved'
                            ? 'bg-sage-100 text-sage-800'
                            : b.approval_status === 'Pending'
                              ? 'bg-peach-100 text-peach-800 font-bold'
                              : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {b.approval_status}
                      </span>
                      {b.is_verified && (
                        <span className="badge-preview !bg-amber-100 !text-amber-800 inline-flex items-center gap-1 font-semibold">
                          <BadgeCheck className="w-3 h-3 text-amber-700" />
                          <span>Verified</span>
                        </span>
                      )}
                      <span className="text-xs text-charcoal-500 capitalize">
                        {b.creator_type === 'small_brand' ? 'Small Brand' : 'Individual Creator'}
                      </span>
                    </div>

                    <div className="flex items-baseline gap-2">
                      <h3 className="font-display font-medium text-base text-charcoal-900 truncate">
                        {b.name}
                      </h3>
                      <span className="font-mono text-xs text-[#9E4A2B] font-semibold">@{b.slug}</span>
                    </div>

                    {b.tagline && (
                      <p className="text-xs text-charcoal-600 line-clamp-1 mt-0.5 italic">
                        "{b.tagline}"
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-charcoal-500 mt-2">
                      <a
                        href={b.instagram_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#9E4A2B] hover:underline inline-flex items-center gap-1"
                      >
                        <span>Instagram: {b.instagram_url.replace(/^https?:\/\/(www\.)?instagram\.com\//, '@')}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>

                      <div className="inline-flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-ivory-200 text-charcoal-700 rounded-xs font-mono text-[11px] uppercase">
                          Contact: {contactType}
                        </span>
                        {resolved?.url && (
                          <a
                            href={resolved.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#9E4A2B] hover:underline font-semibold inline-flex items-center gap-1"
                            title={`Sample inquiry message: ${resolved.message}`}
                          >
                            <span>Test Link ↗</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>

                    {b.rejection_feedback && (
                      <p className="text-xs text-red-700 mt-1.5 bg-red-50 p-2 rounded-xs border border-red-100">
                        <strong>Rejection Feedback:</strong> {b.rejection_feedback}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-0 border-charcoal-800/10 flex-wrap">
                    {b.approval_status !== 'Approved' && (
                      <button
                        type="button"
                        onClick={() => handleApproveBrand(b.id)}
                        className="py-2 px-3 text-xs font-semibold rounded-sm bg-sage-100 hover:bg-sage-200 text-sage-800 border border-sage-300 transition-colors inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve Brand</span>
                      </button>
                    )}

                    {b.approval_status !== 'Rejected' && (
                      <button
                        type="button"
                        onClick={() => {
                          setRejectModalBrand(b);
                          setBrandRejectFeedback('');
                        }}
                        className="py-2 px-3 text-xs font-semibold rounded-sm bg-ivory-50 hover:bg-red-50 text-red-700 border border-red-200 transition-colors inline-flex items-center gap-1 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleToggleBrandVerified(b.id, b.is_verified)}
                      className={`py-2 px-3 text-xs font-semibold rounded-sm border transition-colors inline-flex items-center gap-1 cursor-pointer ${
                        b.is_verified
                          ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                          : 'bg-ivory-50 text-charcoal-600 border-charcoal-800/20 hover:bg-ivory-200'
                      }`}
                      title="Toggle verified badge"
                    >
                      <BadgeCheck className="w-3.5 h-3.5" />
                      <span>{b.is_verified ? 'Verified ✓' : 'Mark Verified'}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab 2: Categories */}
      {activeTab === 'categories' && (
        <AdminCategoryManager
          onNotify={(msg) => {
            setToastMessage(msg);
            setTimeout(() => setToastMessage(null), 3500);
          }}
          initialCategories={categories}
          initialCategoryRequests={categoryRequests}
          onRefreshParent={() => loadData(false)}
        />
      )}

      {/* Tab 3: Users */}
      {activeTab === 'users' && (
        <div className="bg-ivory-100 border border-charcoal-800/10 rounded-sm shadow-soft overflow-hidden">
          <div className="p-5 border-b border-charcoal-800/10">
            <h3 className="text-base font-display font-medium text-charcoal-900">
              Registered Accounts ({users.length})
            </h3>
          </div>

          <div className="divide-y divide-charcoal-800/10">
            {users.map((u) => (
              <div key={u.id} className="p-4 sm:p-5 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-charcoal-900 text-sm">
                      {u.full_name || 'No Name'}
                    </span>
                    {u.is_banned && (
                      <span className="badge-preview !bg-red-100 !text-red-800 font-bold">BANNED</span>
                    )}
                    {u.is_seller && (
                      <span className="badge-preview !bg-sage-100 !text-sage-800">SELLER</span>
                    )}
                  </div>
                  <div className="text-xs text-charcoal-500">{u.email}</div>
                  {u.instagram_url && (
                    <a
                      href={u.instagram_url}
                      target="_blank"
                      rel="noopener"
                      className="text-xs text-[#9E4A2B] hover:underline"
                    >
                      {u.instagram_url}
                    </a>
                  )}
                </div>

                {u.email !== 'sumitkatiyar783@gmail.com' && (
                  <button
                    type="button"
                    onClick={() => handleToggleBan(u.id, !!u.is_banned)}
                    className={`py-2 px-3.5 text-xs font-semibold rounded-sm border transition-colors inline-flex items-center gap-1.5 ${u.is_banned
                        ? 'bg-sage-100 text-sage-800 border-sage-300'
                        : 'bg-ivory-50 text-red-700 border-red-200 hover:bg-red-50'
                      }`}
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>{u.is_banned ? 'Unban User' : 'Ban User & Wipe'}</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 5: Homepage Curation */}
      {activeTab === 'homepage' && (
        <AdminHomepageTab
          onNotify={(msg, isErr) => {
            setToastMessage(msg);
            setTimeout(() => setToastMessage(null), 3500);
          }}
        />
      )}

      {/* Reject Product Modal */}
      {rejectModalProduct && (
        <div className="fixed inset-0 bg-charcoal-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-ivory-100 border border-charcoal-800/15 rounded-sm p-6 sm:p-8 max-w-md w-full shadow-soft-xl space-y-4">
            <h3 className="text-lg font-display font-medium text-charcoal-900">
              Reject Listing: {rejectModalProduct.name}
            </h3>
            <p className="text-xs text-charcoal-600 leading-relaxed">
              Please enter feedback for the creator so they can correct the listing.
            </p>

            <textarea
              rows={3}
              required
              placeholder="e.g. Broken Instagram link, blurry image..."
              value={rejectFeedback}
              onChange={(e) => setRejectFeedback(e.target.value)}
              className="w-full px-4 py-2.5 bg-ivory-50 border border-charcoal-800/20 rounded-sm text-xs text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-[#9E4A2B]"
            />

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setRejectModalProduct(null)}
                className="btn-secondary py-2 px-4 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={!rejectFeedback.trim()}
                className="btn-primary py-2 px-4 text-xs bg-red-700 hover:bg-red-800 text-ivory-100"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Brand Modal */}
      {rejectModalBrand && (
        <div className="fixed inset-0 bg-charcoal-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-ivory-100 border border-charcoal-800/15 rounded-sm p-6 sm:p-8 max-w-md w-full shadow-soft-xl space-y-4">
            <h3 className="text-lg font-display font-medium text-charcoal-900">
              Reject Brand: {rejectModalBrand.name}
            </h3>
            <p className="text-xs text-charcoal-600 leading-relaxed">
              Please specify the reason for rejecting this creator's brand registration. The creator will see this feedback in their dashboard.
            </p>

            <textarea
              rows={3}
              required
              placeholder="e.g. Invalid Instagram handle, missing creator bio, or inappropriate content..."
              value={brandRejectFeedback}
              onChange={(e) => setBrandRejectFeedback(e.target.value)}
              className="w-full px-4 py-2.5 bg-ivory-50 border border-charcoal-800/20 rounded-sm text-xs text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-[#9E4A2B]"
            />

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setRejectModalBrand(null)}
                className="btn-secondary py-2 px-4 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRejectBrand}
                disabled={!brandRejectFeedback.trim()}
                className="btn-primary py-2 px-4 text-xs bg-red-700 hover:bg-red-800 text-ivory-100"
              >
                Confirm Brand Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
