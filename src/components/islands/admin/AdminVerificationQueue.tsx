import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured, isAdminEmail } from '../../../lib/supabase';
import {
  getAllBrands,
  adminReviewBrand,
  cleanInstagramHandle,
  type Brand,
} from '../../../lib/brands';
import { getAllProducts, type Product } from '../../../lib/products';
import {
  ShieldCheck,
  Check,
  X,
  ExternalLink,
  Copy,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
} from 'lucide-react';

export type VerificationFilterTab =
  | 'needs_review'
  | 'verified_pending'
  | 'approved'
  | 'rejected'
  | 'all';

interface Props {
  onNotify?: (message: string, isError?: boolean) => void;
}

export const AdminVerificationQueue: React.FC<Props> = ({ onNotify }) => {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeFilter, setActiveFilter] = useState<VerificationFilterTab>('needs_review');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  // Reject modal state
  const [rejectingBrand, setRejectingBrand] = useState<Brand | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const loadData = async (showSpinner = true) => {
    if (!isSupabaseConfigured || !supabase) return;
    if (showSpinner) setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const email = session?.user?.email || '';

      if (!isAdminEmail(email)) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setIsAdmin(true);

      const [brandList, prodList] = await Promise.all([
        getAllBrands(),
        getAllProducts(),
      ]);

      setBrands(brandList);
      setProducts(prodList);
    } catch (err: any) {
      console.error('Failed to load verification queue:', err);
      onNotify?.(err?.message || 'Failed to load queue', true);
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute product counts per brand
  const productCountByBrand = products.reduce((acc, p) => {
    if (p.brand_id) {
      acc[p.brand_id] = (acc[p.brand_id] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  // Copy code helper
  const handleCopyCode = async (code: string, brandId: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCodeId(brandId);
      setTimeout(() => setCopiedCodeId(null), 2000);
    } catch {
      setCopiedCodeId(brandId);
      setTimeout(() => setCopiedCodeId(null), 2000);
    }
  };

  // Admin Actions
  const handleVerifyAndApprove = async (b: Brand) => {
    if (!window.confirm(`Verify @${b.instagram_handle || b.slug} and APPROVE brand "${b.name}"?`)) {
      return;
    }

    setActionLoadingId(b.id);
    const res = await adminReviewBrand(b.id, true, 'Approved', '');
    setActionLoadingId(null);

    if (res.success) {
      onNotify?.(`Verified & Approved @${b.instagram_handle || b.slug}!`);
      await loadData(false);
    } else {
      onNotify?.(res.error || 'Failed to verify and approve', true);
    }
  };

  const handleVerifyOnly = async (b: Brand) => {
    if (!window.confirm(`Mark @${b.instagram_handle || b.slug} as VERIFIED (leaving brand Pending for curation)?`)) {
      return;
    }

    setActionLoadingId(b.id);
    const res = await adminReviewBrand(b.id, true, 'Pending', '');
    setActionLoadingId(null);

    if (res.success) {
      onNotify?.(`Marked @${b.instagram_handle || b.slug} as verified.`);
      await loadData(false);
    } else {
      onNotify?.(res.error || 'Failed to verify brand', true);
    }
  };

  const handleApprove = async (b: Brand) => {
    if (!window.confirm(`Approve brand "${b.name}"?`)) {
      return;
    }

    setActionLoadingId(b.id);
    const res = await adminReviewBrand(b.id, b.is_verified, 'Approved', '');
    setActionLoadingId(null);

    if (res.success) {
      onNotify?.(`Approved "${b.name}"!`);
      await loadData(false);
    } else {
      onNotify?.(res.error || 'Failed to approve brand', true);
    }
  };

  const handleRevokeVerification = async (b: Brand) => {
    if (!window.confirm(`Revoke verification badge for @${b.instagram_handle || b.slug}?`)) {
      return;
    }

    setActionLoadingId(b.id);
    const res = await adminReviewBrand(b.id, false, b.approval_status, '');
    setActionLoadingId(null);

    if (res.success) {
      onNotify?.(`Revoked verification for @${b.instagram_handle || b.slug}.`);
      await loadData(false);
    } else {
      onNotify?.(res.error || 'Failed to revoke verification', true);
    }
  };

  const openRejectModal = (b: Brand) => {
    setRejectingBrand(b);
    setRejectionReason('');
  };

  const handleConfirmReject = async () => {
    if (!rejectingBrand) return;
    if (!rejectionReason.trim()) {
      alert('Rejection reason is required.');
      return;
    }

    setActionLoadingId(rejectingBrand.id);
    const res = await adminReviewBrand(
      rejectingBrand.id,
      false,
      'Rejected',
      rejectionReason.trim()
    );
    setActionLoadingId(null);

    if (res.success) {
      onNotify?.(`Rejected brand "${rejectingBrand.name}". Feedback sent to creator.`);
      setRejectingBrand(null);
      setRejectionReason('');
      await loadData(false);
    } else {
      onNotify?.(res.error || 'Failed to reject brand', true);
    }
  };

  if (!isAdmin && !loading) {
    return (
      <div className="p-8 text-center bg-red-50 border border-red-200 rounded-2xl text-xs text-red-800">
        Unauthorized: Admin privileges required to view the verification queue.
      </div>
    );
  }

  // Filter categories
  const needsReviewBrands = brands.filter(
    (b) => b.verification_requested_at && b.approval_status === 'Pending' && !b.is_verified
  );

  const verifiedPendingBrands = brands.filter(
    (b) => b.is_verified && b.approval_status === 'Pending'
  );

  const approvedBrands = brands.filter((b) => b.approval_status === 'Approved');
  const rejectedBrands = brands.filter((b) => b.approval_status === 'Rejected');

  // Filtered list
  const currentList = (() => {
    let list: Brand[] = [];
    if (activeFilter === 'needs_review') list = needsReviewBrands;
    else if (activeFilter === 'verified_pending') list = verifiedPendingBrands;
    else if (activeFilter === 'approved') list = approvedBrands;
    else if (activeFilter === 'rejected') list = rejectedBrands;
    else list = brands;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          b.slug.toLowerCase().includes(q) ||
          (b.instagram_handle && b.instagram_handle.toLowerCase().includes(q)) ||
          (b.verification_code && b.verification_code.toLowerCase().includes(q))
      );
    }

    return list;
  })();

  return (
    <div className="space-y-6">
      {/* Header and Live Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-[#30251F] flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#9E4A2B]" />
            <span>Instagram Verification Queue</span>
          </h2>
          <p className="text-xs text-[#685950] mt-0.5">
            Review bio codes, verify handle ownership, and moderate creator store applications.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#685950]" />
            <input
              type="search"
              placeholder="Search handle, brand, code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-xl border border-[#30251F]/15 bg-white text-xs text-[#30251F] focus:outline-none focus:ring-2 focus:ring-[#9E4A2B]"
            />
          </div>
          <button
            type="button"
            onClick={() => loadData(true)}
            className="p-2 rounded-xl bg-white border border-[#30251F]/15 hover:bg-[#FAF6F0] text-[#30251F] transition-colors cursor-pointer"
            title="Refresh queue"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-[#30251F]/15 pb-2 overflow-x-auto text-xs">
        <button
          type="button"
          onClick={() => setActiveFilter('needs_review')}
          className={`px-3.5 py-1.5 rounded-xl font-semibold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeFilter === 'needs_review'
              ? 'bg-[#9E4A2B] text-[#FAF6F0]'
              : 'bg-[#FAF6F0] text-[#685950] hover:bg-[#EBE3D7]'
          }`}
        >
          <span>Needs review</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
            {needsReviewBrands.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter('verified_pending')}
          className={`px-3.5 py-1.5 rounded-xl font-semibold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeFilter === 'verified_pending'
              ? 'bg-[#9E4A2B] text-[#FAF6F0]'
              : 'bg-[#FAF6F0] text-[#685950] hover:bg-[#EBE3D7]'
          }`}
        >
          <span>Verified - awaiting approval</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
            {verifiedPendingBrands.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter('approved')}
          className={`px-3.5 py-1.5 rounded-xl font-semibold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeFilter === 'approved'
              ? 'bg-[#9E4A2B] text-[#FAF6F0]'
              : 'bg-[#FAF6F0] text-[#685950] hover:bg-[#EBE3D7]'
          }`}
        >
          <span>Approved</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
            {approvedBrands.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter('rejected')}
          className={`px-3.5 py-1.5 rounded-xl font-semibold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeFilter === 'rejected'
              ? 'bg-[#9E4A2B] text-[#FAF6F0]'
              : 'bg-[#FAF6F0] text-[#685950] hover:bg-[#EBE3D7]'
          }`}
        >
          <span>Rejected</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
            {rejectedBrands.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter('all')}
          className={`px-3.5 py-1.5 rounded-xl font-semibold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeFilter === 'all'
              ? 'bg-[#9E4A2B] text-[#FAF6F0]'
              : 'bg-[#FAF6F0] text-[#685950] hover:bg-[#EBE3D7]'
          }`}
        >
          <span>All ({brands.length})</span>
        </button>
      </div>

      {/* Queue List Table / Cards */}
      {loading ? (
        <div className="py-16 text-center text-xs text-[#685950] space-y-2">
          <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#9E4A2B]" />
          <p>Loading queue entries...</p>
        </div>
      ) : currentList.length === 0 ? (
        <div className="p-12 text-center bg-[#FAF6F0] border border-[#30251F]/10 rounded-2xl text-xs text-[#685950]">
          No brands found in this queue tab.
        </div>
      ) : (
        <div className="space-y-3">
          {currentList.map((b) => {
            const handle = b.instagram_handle || cleanInstagramHandle(b.instagram_url) || b.slug;
            const igUrl = `https://instagram.com/${handle}`;
            const isActionLoading = actionLoadingId === b.id;
            const prodsCount = productCountByBrand[b.id] ?? 0;

            const requestedTimeFormatted = b.verification_requested_at
              ? new Date(b.verification_requested_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'Not submitted';

            const expiryFormatted = b.verification_code_expires_at
              ? new Date(b.verification_code_expires_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })
              : 'None';

            return (
              <div
                key={b.id}
                className="bg-[#FAF6F0] border border-[#30251F]/10 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Brand info & handle */}
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm sm:text-base text-[#30251F]">
                      {b.name}
                    </span>
                    <a
                      href={igUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#9E4A2B] hover:underline"
                    >
                      <span>@{handle}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>

                    {b.is_verified && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#637B58] text-white flex items-center gap-1">
                        <Check className="w-2.5 h-2.5" />
                        <span>Verified</span>
                      </span>
                    )}

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        b.approval_status === 'Approved'
                          ? 'bg-[#637B58]/20 text-[#637B58]'
                          : b.approval_status === 'Pending'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {b.approval_status}
                    </span>
                  </div>

                  {/* Metadata Row */}
                  <div className="flex items-center gap-4 text-[11px] text-[#685950] flex-wrap">
                    <span>
                      Method:{' '}
                      <strong className="text-[#30251F]">
                        {b.verification_method === 'dm' ? 'DM' : b.verification_method === 'bio_code' ? 'Bio Code' : 'None'}
                      </strong>
                    </span>
                    <span>
                      Requested: <strong className="text-[#30251F]">{requestedTimeFormatted}</strong>
                    </span>
                    <span>
                      Expires: <strong className="text-[#30251F]">{expiryFormatted}</strong>
                    </span>
                    <span>
                      Products: <strong className="text-[#30251F]">{prodsCount}</strong>
                    </span>
                  </div>

                  {b.rejection_reason && (
                    <p className="text-[11px] text-red-700 bg-red-50 px-2.5 py-1 rounded-lg border border-red-200">
                      Rejection Reason: {b.rejection_reason}
                    </p>
                  )}
                </div>

                {/* Verification Code Box */}
                {b.verification_code ? (
                  <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-[#30251F]/15 flex-shrink-0">
                    <div className="text-left">
                      <p className="text-[9px] uppercase tracking-wider font-bold text-[#685950]">Expected Code</p>
                      <code className="font-mono text-xs font-extrabold text-[#9E4A2B] select-all">
                        {b.verification_code}
                      </code>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyCode(b.verification_code!, b.id)}
                      className="p-1 rounded-lg text-[#685950] hover:text-[#30251F] hover:bg-[#FAF6F0] transition-colors cursor-pointer"
                      title="Copy code"
                      aria-label="Copy code"
                    >
                      {copiedCodeId === b.id ? (
                        <Check className="w-3.5 h-3.5 text-[#637B58]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="text-[11px] text-[#685950] italic px-2">No code issued</div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center gap-1.5 flex-wrap flex-shrink-0">
                  {/* Verify + Approve */}
                  {b.approval_status !== 'Approved' && (
                    <button
                      type="button"
                      disabled={isActionLoading}
                      onClick={() => handleVerifyAndApprove(b)}
                      className="px-3 py-1.5 rounded-xl bg-[#637B58] hover:bg-[#526648] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                      title="Verify ownership and immediately approve brand"
                    >
                      Verify + Approve
                    </button>
                  )}

                  {/* Verify only */}
                  {!b.is_verified && (
                    <button
                      type="button"
                      disabled={isActionLoading}
                      onClick={() => handleVerifyOnly(b)}
                      className="px-3 py-1.5 rounded-xl bg-white border border-[#30251F]/20 hover:bg-[#EBE3D7] text-[#30251F] text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                      title="Mark Instagram handle as verified (keeps Pending for product review)"
                    >
                      Verify only
                    </button>
                  )}

                  {/* Approve */}
                  {b.approval_status !== 'Approved' && b.is_verified && (
                    <button
                      type="button"
                      disabled={isActionLoading}
                      onClick={() => handleApprove(b)}
                      className="px-3 py-1.5 rounded-xl bg-[#9E4A2B] hover:bg-[#843C22] text-[#FAF6F0] text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                      title="Approve brand for listing creations"
                    >
                      Approve
                    </button>
                  )}

                  {/* Reject */}
                  {b.approval_status !== 'Rejected' && (
                    <button
                      type="button"
                      disabled={isActionLoading}
                      onClick={() => openRejectModal(b)}
                      className="px-3 py-1.5 rounded-xl border border-rose-300 bg-white hover:bg-rose-50 text-rose-700 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                      title="Reject with required feedback reason"
                    >
                      Reject
                    </button>
                  )}

                  {/* Revoke verification */}
                  {b.is_verified && (
                    <button
                      type="button"
                      disabled={isActionLoading}
                      onClick={() => handleRevokeVerification(b)}
                      className="px-2.5 py-1.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-100 text-gray-700 text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50"
                      title="Remove verified badge"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reject Modal */}
      {rejectingBrand && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#FAF6F0] border border-[#30251F]/15 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-display font-bold text-[#30251F]">
                Reject Brand Application
              </h3>
              <button
                type="button"
                onClick={() => setRejectingBrand(null)}
                className="p-1 rounded-full text-[#685950] hover:text-[#30251F]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#685950]">
              Provide constructive feedback for <strong className="text-[#30251F]">"{rejectingBrand.name}"</strong> (@{rejectingBrand.instagram_handle || rejectingBrand.slug}). This reason is required and will be displayed to the creator.
            </p>

            <textarea
              required
              rows={3}
              placeholder="e.g. Bio code was not found on your profile, or profile does not display original handcrafted work."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full p-3 rounded-xl border border-[#30251F]/15 bg-white text-xs text-[#30251F] focus:outline-none focus:ring-2 focus:ring-[#9E4A2B]"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectingBrand(null)}
                className="px-4 py-2 rounded-xl border border-[#30251F]/20 text-xs font-semibold text-[#30251F] hover:bg-[#FAF6F0]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!rejectionReason.trim()}
                onClick={handleConfirmReject}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors disabled:opacity-50"
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

export default AdminVerificationQueue;
