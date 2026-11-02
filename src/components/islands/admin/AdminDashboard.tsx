import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured, isAdminEmail } from '../../../lib/supabase';
import { getAllProducts, approveProduct, rejectProduct, type Product } from '../../../lib/products';
import { ShieldCheck, Check, X, Ban, RefreshCw, ExternalLink } from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'products' | 'categories' | 'users'>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [categoryRequests, setCategoryRequests] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [rejectModalProduct, setRejectModalProduct] = useState<Product | null>(null);
  const [rejectFeedback, setRejectFeedback] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadData = async () => {
    if (!isSupabaseConfigured || !supabase) return;
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const email = session?.user?.email || '';

      if (!isAdminEmail(email)) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setIsAdmin(true);

      const [prods, cats, catReqs, profiles] = await Promise.all([
        getAllProducts(),
        supabase.from('categories').select('*').order('name'),
        supabase.from('category_requests').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      ]);

      setProducts(prods);
      setCategories(cats.data || []);
      setCategoryRequests(catReqs.data || []);
      setUsers(profiles.data || []);
    } catch (err) {
      console.error('Failed to load admin dashboard:', err);
    } finally {
      setLoading(false);
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
      setToastMessage('Product approved for discovery catalog');
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
        loadData();
      }

      setToastMessage(newStatus ? 'User banned and listings hidden.' : 'User ban revoked.');
      setTimeout(() => setToastMessage(null), 3000);
    }
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
      <div className="max-w-md mx-auto text-center py-16 px-6 bg-red-50 border border-red-200 rounded-sm">
        <p className="text-base font-display font-medium text-red-900 mb-2">
          Restricted Operations Portal
        </p>
        <p className="text-xs text-red-700 mb-6 leading-relaxed">
          Access is restricted strictly to <code>sumitkatiyar783@gmail.com</code>.
        </p>
        <a href="/" className="btn-secondary">
          Return to Rablo Home
        </a>
      </div>
    );
  }

  const pendingProducts = products.filter((p) => p.approval_status === 'Pending');

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
            <span className="badge-preview !bg-lavender-100 !text-lavender-800 font-semibold inline-flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Superadmin</span>
            </span>
            <span className="text-xs text-charcoal-500">sumitkatiyar783@gmail.com</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-medium text-charcoal-900 tracking-tight">
            Store Operations &amp; Moderation
          </h1>
          <p className="text-xs text-charcoal-600 mt-1">
            Review submitted catalog items, approve requested categories, and manage registered creators.
          </p>
        </div>

        <button
          type="button"
          onClick={loadData}
          className="btn-secondary flex-shrink-0 inline-flex items-center gap-2 py-2.5 px-4 text-xs font-medium"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-5 bg-ivory-100 border border-charcoal-800/10 rounded-sm shadow-soft">
          <span className="text-[11px] uppercase tracking-wider text-peach-600 block font-semibold">
            Pending Review
          </span>
          <div className="text-2xl font-bold text-peach-700 mt-1">
            {pendingProducts.length}
          </div>
        </div>

        <div className="p-5 bg-ivory-100 border border-charcoal-800/10 rounded-sm shadow-soft">
          <span className="text-[11px] uppercase tracking-wider text-charcoal-500 block">
            Total Products
          </span>
          <div className="text-2xl font-bold text-charcoal-900 mt-1">
            {products.length}
          </div>
        </div>

        <div className="p-5 bg-ivory-100 border border-charcoal-800/10 rounded-sm shadow-soft">
          <span className="text-[11px] uppercase tracking-wider text-charcoal-500 block">
            Registered Users
          </span>
          <div className="text-2xl font-bold text-charcoal-900 mt-1">
            {users.length}
          </div>
        </div>

        <div className="p-5 bg-ivory-100 border border-charcoal-800/10 rounded-sm shadow-soft">
          <span className="text-[11px] uppercase tracking-wider text-charcoal-500 block">
            Category Requests
          </span>
          <div className="text-2xl font-bold text-charcoal-900 mt-1">
            {categoryRequests.filter((r) => r.status === 'Pending').length}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-charcoal-800/10 pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('products')}
          className={`px-4 py-2 text-xs font-medium rounded-t-sm transition-colors cursor-pointer ${
            activeTab === 'products'
              ? 'bg-ivory-100 text-charcoal-900 border-t border-x border-charcoal-800/15 font-semibold'
              : 'text-charcoal-600 hover:text-charcoal-900'
          }`}
        >
          Product Moderation ({products.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('categories')}
          className={`px-4 py-2 text-xs font-medium rounded-t-sm transition-colors cursor-pointer ${
            activeTab === 'categories'
              ? 'bg-ivory-100 text-charcoal-900 border-t border-x border-charcoal-800/15 font-semibold'
              : 'text-charcoal-600 hover:text-charcoal-900'
          }`}
        >
          Categories ({categories.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 text-xs font-medium rounded-t-sm transition-colors cursor-pointer ${
            activeTab === 'users'
              ? 'bg-ivory-100 text-charcoal-900 border-t border-x border-charcoal-800/15 font-semibold'
              : 'text-charcoal-600 hover:text-charcoal-900'
          }`}
        >
          Users &amp; Moderation ({users.length})
        </button>
      </div>

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
                    className={`text-[11px] px-2 py-0.5 rounded-sm font-medium ${
                      p.approval_status === 'Approved'
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

                <div className="flex gap-4 text-xs text-charcoal-500 mt-2">
                  <span>Seller: {p.seller?.full_name || 'Anonymous'}</span>
                  <a
                    href={p.seller_ig_url}
                    target="_blank"
                    rel="noopener"
                    className="text-lavender-700 hover:underline inline-flex items-center gap-1"
                  >
                    <span>Instagram Profile</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {p.rejection_feedback && (
                  <p className="text-xs text-red-700 mt-1">
                    <strong>Feedback:</strong> {p.rejection_feedback}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-0 border-charcoal-800/10">
                {p.approval_status !== 'Approved' && (
                  <button
                    type="button"
                    onClick={() => handleApproveProduct(p.id)}
                    className="py-2 px-3 text-xs font-semibold rounded-sm bg-sage-100 hover:bg-sage-200 text-sage-800 border border-sage-300 transition-colors inline-flex items-center gap-1"
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
                    className="py-2 px-3 text-xs font-semibold rounded-sm bg-ivory-50 hover:bg-red-50 text-red-700 border border-red-200 transition-colors inline-flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 2: Categories */}
      {activeTab === 'categories' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 bg-ivory-100 border border-charcoal-800/10 rounded-sm shadow-soft space-y-4">
            <h3 className="text-base font-display font-medium text-charcoal-900">
              Approved Categories ({categories.length})
            </h3>
            <div className="divide-y divide-charcoal-800/10 text-xs">
              {categories.map((c) => (
                <div key={c.id} className="py-2.5 flex justify-between">
                  <span className="font-semibold text-charcoal-900">{c.name}</span>
                  <span className="text-charcoal-500 font-mono">/{c.slug}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-6 bg-ivory-100 border border-charcoal-800/10 rounded-sm shadow-soft space-y-4">
            <h3 className="text-base font-display font-medium text-charcoal-900">
              Pending Category Requests ({categoryRequests.length})
            </h3>
            {categoryRequests.length === 0 ? (
              <p className="text-xs text-charcoal-500">No category requests pending.</p>
            ) : (
              <div className="divide-y divide-charcoal-800/10 text-xs">
                {categoryRequests.map((req) => (
                  <div key={req.id} className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <div className="font-semibold text-charcoal-900">{req.name}</div>
                      <span className="text-[11px] text-charcoal-500">Status: {req.status || 'Pending'}</span>
                    </div>

                    {(!req.status || req.status === 'Pending') && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleApproveCategoryRequest(req)}
                          className="py-1.5 px-3 text-xs bg-sage-600 text-ivory-100 rounded-sm font-medium"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRejectCategoryRequest(req.id)}
                          className="py-1.5 px-3 text-xs border border-charcoal-800/20 text-charcoal-700 rounded-sm"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
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
                      className="text-xs text-lavender-700 hover:underline"
                    >
                      {u.instagram_url}
                    </a>
                  )}
                </div>

                {u.email !== 'sumitkatiyar783@gmail.com' && (
                  <button
                    type="button"
                    onClick={() => handleToggleBan(u.id, !!u.is_banned)}
                    className={`py-2 px-3.5 text-xs font-semibold rounded-sm border transition-colors inline-flex items-center gap-1.5 ${
                      u.is_banned
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

      {/* Reject Modal */}
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
              className="w-full px-4 py-2.5 bg-ivory-50 border border-charcoal-800/20 rounded-sm text-xs text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-lavender-600"
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
    </div>
  );
};

export default AdminDashboard;
