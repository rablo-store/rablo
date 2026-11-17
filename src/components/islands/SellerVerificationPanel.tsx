import React, { useState, useEffect } from 'react';
import {
  type Brand,
  cleanInstagramHandle,
  startInstagramVerification,
  requestInstagramReview,
} from '../../lib/brands';
import { RABLO_INSTAGRAM_HANDLE } from '../../config/site';
import {
  Copy,
  Check,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Sparkles,
  MessageSquare,
  FileCode,
  ArrowRight,
} from 'lucide-react';

interface Props {
  brand: Brand;
  onBrandUpdated?: (updated: Brand) => void;
}

export const SellerVerificationPanel: React.FC<Props> = ({ brand: initialBrand, onBrandUpdated }) => {
  const [brand, setBrand] = useState<Brand>(initialBrand);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  useEffect(() => {
    setBrand(initialBrand);
  }, [initialBrand]);

  // Expiration check
  const isCodeExpired = brand.verification_code_expires_at
    ? new Date(brand.verification_code_expires_at).getTime() < Date.now()
    : false;

  const currentHandle = brand.instagram_handle || cleanInstagramHandle(brand.instagram_url) || brand.slug;

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleStartVerification = async (method: 'bio_code' | 'dm') => {
    if (method === 'dm' && !RABLO_INSTAGRAM_HANDLE) {
      setError('Instagram DM verification is temporarily unavailable. Please use the Bio Code method.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await startInstagramVerification(brand.id, method);
      if (res.success && res.code) {
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const updated: Brand = {
          ...brand,
          verification_method: method,
          verification_code: res.code,
          verification_code_expires_at: expiresAt,
          verification_requested_at: null,
        };
        setBrand(updated);
        onBrandUpdated?.(updated);
        setSuccessToast('Verification code generated!');
        setTimeout(() => setSuccessToast(null), 3000);
      } else {
        setError(res.error || 'Failed to start verification.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to start verification.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReview = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await requestInstagramReview(brand.id);
      if (res.success) {
        const now = new Date().toISOString();
        const updated: Brand = {
          ...brand,
          verification_requested_at: now,
        };
        setBrand(updated);
        onBrandUpdated?.(updated);
        setSuccessToast('Submitted for review!');
        setTimeout(() => setSuccessToast(null), 3000);
      } else {
        setError(res.error || 'Failed to submit review request.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to submit review request.');
    } finally {
      setLoading(false);
    }
  };

  const handleRestart = () => {
    setError(null);
    const updated: Brand = {
      ...brand,
      verification_code: null,
      verification_code_expires_at: null,
      verification_requested_at: null,
    };
    setBrand(updated);
    onBrandUpdated?.(updated);
  };

  // Determine current verification/approval state
  // 1. Approved
  if (brand.approval_status === 'Approved') {
    return (
      <div className="bg-[#FAF6F0] border border-[#637B58]/30 rounded-3xl p-6 sm:p-8 shadow-soft text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-[#637B58]/15 text-[#637B58] mx-auto flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-xl sm:text-2xl font-display font-bold text-[#30251F]">
            🎉 You're approved. You can list products now.
          </h2>
          <p className="text-xs sm:text-sm text-[#685950] max-w-md mx-auto leading-relaxed">
            Your brand <span className="font-semibold text-[#30251F]">@{currentHandle}</span> is approved on Rijlo. Start showcasing your handmade creations to discover buyers.
          </p>
        </div>
        <div className="pt-2">
          <a
            href="/seller/upload"
            className="inline-flex items-center gap-2 px-7 py-3 rounded-full bg-[#9E4A2B] hover:bg-[#843C22] text-[#FAF6F0] text-xs font-semibold shadow-xs transition-colors"
          >
            <span>List a Product</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    );
  }

  // 2. Rejected
  if (brand.approval_status === 'Rejected') {
    return (
      <div className="bg-[#FAF6F0] border border-red-200 rounded-3xl p-6 sm:p-8 shadow-soft text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 mx-auto flex items-center justify-center">
          <AlertCircle className="w-8 h-8" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-xl sm:text-2xl font-display font-bold text-[#30251F]">
            Application Needs Revision
          </h2>
          <div className="bg-red-50 text-red-800 p-4 rounded-2xl border border-red-200 text-xs text-left max-w-md mx-auto space-y-1">
            <p className="font-bold">Moderator Feedback:</p>
            <p className="leading-relaxed">
              {brand.rejection_reason || brand.rejection_feedback || 'Your brand submission requires adjustments before approval.'}
            </p>
          </div>
        </div>
        <div className="pt-2">
          <button
            type="button"
            onClick={handleRestart}
            className="inline-flex items-center gap-2 px-7 py-3 rounded-full bg-[#9E4A2B] hover:bg-[#843C22] text-[#FAF6F0] text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Fix and resubmit</span>
          </button>
        </div>
      </div>
    );
  }

  // 3. Instagram Verified + Pending Approval
  if (brand.is_verified && brand.approval_status === 'Pending') {
    return (
      <div className="bg-[#FAF6F0] border border-[#637B58]/30 rounded-3xl p-6 sm:p-8 shadow-soft text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-[#637B58]/15 text-[#637B58] mx-auto flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-xl sm:text-2xl font-display font-bold text-[#30251F]">
            ✅ Instagram verified! Your store is under review by the Rablo team. We'll let you know once you're approved to sell.
          </h2>
          <p className="text-xs sm:text-sm text-[#685950] max-w-md mx-auto leading-relaxed">
            We have confirmed your ownership of <span className="font-semibold text-[#30251F]">@{currentHandle}</span>. Our team is completing the final store check.
          </p>
        </div>
      </div>
    );
  }

  // 4. Code Expired
  if (isCodeExpired && brand.verification_code && !brand.is_verified) {
    return (
      <div className="bg-[#FAF6F0] border border-amber-200 rounded-3xl p-6 sm:p-8 shadow-soft text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-800 mx-auto flex items-center justify-center">
          <Clock className="w-8 h-8" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-xl sm:text-2xl font-display font-bold text-[#30251F]">
            Your code expired. Get a new code.
          </h2>
          <p className="text-xs sm:text-sm text-[#685950] max-w-md mx-auto">
            Verification codes are valid for 7 days. Generate a fresh code to complete verification for @{currentHandle}.
          </p>
        </div>
        <div className="pt-2">
          <button
            type="button"
            onClick={handleRestart}
            className="inline-flex items-center gap-2 px-7 py-3 rounded-full bg-[#9E4A2B] hover:bg-[#843C22] text-[#FAF6F0] text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Get a new code</span>
          </button>
        </div>
      </div>
    );
  }

  // 5. Submitted (is_verified false, Pending, verification_requested_at not null)
  if (!brand.is_verified && brand.approval_status === 'Pending' && brand.verification_requested_at) {
    const methodLabel = brand.verification_method === 'dm' ? 'DM' : 'bio';
    return (
      <div className="bg-[#FAF6F0] border border-[#B87555]/30 rounded-3xl p-6 sm:p-8 shadow-soft text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-[#EFE9DF] text-[#9E4A2B] mx-auto flex items-center justify-center">
          <Clock className="w-8 h-8 animate-pulse" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-xl sm:text-2xl font-display font-bold text-[#30251F]">
            ⏳ Pending. We'll check your {methodLabel} and verify your identity soon.
          </h2>
          <p className="text-xs sm:text-sm text-[#685950] max-w-md mx-auto leading-relaxed">
            Your verification request for <span className="font-semibold text-[#30251F]">@{currentHandle}</span> is queued for admin check. You can keep your bio code in place until verified.
          </p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-[#30251F]/10 text-left max-w-sm mx-auto space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[#685950]">Instagram Handle</span>
            <span className="font-bold text-[#30251F]">@{currentHandle}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#685950]">Method</span>
            <span className="font-semibold text-[#30251F]">{brand.verification_method === 'dm' ? 'Direct Message (DM)' : 'Bio Code'}</span>
          </div>
          {brand.verification_code && (
            <div className="flex items-center justify-between">
              <span className="text-[#685950]">Code</span>
              <code className="px-2 py-0.5 rounded bg-[#FAF6F0] font-mono font-bold text-[#9E4A2B]">
                {brand.verification_code}
              </code>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 6. Code Issued, Not Submitted
  if (brand.verification_code && !brand.verification_requested_at) {
    const isBio = brand.verification_method === 'bio_code';
    const dmTarget = RABLO_INSTAGRAM_HANDLE;
    const dmLink = dmTarget ? `https://ig.me/m/${dmTarget}` : '#';

    const expiryFormatted = brand.verification_code_expires_at
      ? new Date(brand.verification_code_expires_at).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '7 days';

    return (
      <div className="bg-[#FAF6F0] border border-[#30251F]/10 rounded-3xl p-6 sm:p-8 shadow-soft space-y-6">
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EFE9DF] text-[#9E4A2B] text-xs font-semibold mb-1">
            <FileCode className="w-3.5 h-3.5" />
            <span>{isBio ? 'Bio Code Verification' : 'DM Verification'}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-display font-bold text-[#30251F]">
            Verify your Instagram: @{currentHandle}
          </h2>
          <p className="text-xs sm:text-sm text-[#685950] max-w-md mx-auto">
            {isBio
              ? "Paste this code into your Instagram bio, then tap 'I've added it'. You can remove it after we verify you."
              : `DM this code from @${currentHandle} to @${dmTarget || 'Rablo'}`}
          </p>
        </div>

        {/* Large Copyable Code Box */}
        <div className="max-w-md mx-auto bg-white rounded-2xl p-5 border border-[#30251F]/15 text-center shadow-xs space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#685950]">Your Verification Code</p>
          <div className="flex items-center justify-center gap-3">
            <span className="font-mono text-2xl sm:text-3xl font-extrabold tracking-wider text-[#9E4A2B] select-all">
              {brand.verification_code}
            </span>
            <button
              type="button"
              onClick={() => handleCopyCode(brand.verification_code!)}
              className="p-2 rounded-xl bg-[#FAF6F0] hover:bg-[#EBE3D7] border border-[#30251F]/10 text-[#30251F] transition-colors cursor-pointer"
              title="Copy code"
              aria-label="Copy verification code"
            >
              {copied ? <Check className="w-4 h-4 text-[#637B58]" /> : <Copy className="w-4 h-4 text-[#685950]" />}
            </button>
          </div>
          <p className="text-[11px] text-[#685950]">
            Code expires: <span className="font-medium text-[#30251F]">{expiryFormatted}</span>
          </p>
        </div>

        {/* Action Steps */}
        <div className="max-w-md mx-auto space-y-3">
          {!isBio && (
            <a
              href={dmLink}
              target="_blank"
              rel="noopener noreferrer"
              className={`w-full py-3 px-6 rounded-full border border-[#30251F]/20 bg-white hover:bg-[#FAF6F0] text-xs font-semibold text-[#30251F] flex items-center justify-center gap-2 transition-colors ${
                !dmTarget ? 'pointer-events-none opacity-50' : ''
              }`}
            >
              <span>Open Instagram DM (@{dmTarget})</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          )}

          <button
            type="button"
            disabled={loading}
            onClick={handleSubmitReview}
            className="w-full py-3.5 px-6 rounded-full bg-[#9E4A2B] hover:bg-[#843C22] text-[#FAF6F0] text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
            <span>{isBio ? "I've added it" : "I've sent the DM"}</span>
          </button>

          <div className="text-center pt-1">
            <button
              type="button"
              onClick={handleRestart}
              className="text-xs text-[#685950] hover:text-[#9E4A2B] underline cursor-pointer"
            >
              Switch verification method or generate new code
            </button>
          </div>
        </div>

        {error && (
          <p className="text-xs text-[#9E4A2B] font-medium text-center">{error}</p>
        )}
      </div>
    );
  }

  // 7. Not Started (Initial State)
  const isDmDisabled = !RABLO_INSTAGRAM_HANDLE;

  return (
    <div className="bg-[#FAF6F0] border border-[#30251F]/10 rounded-3xl p-6 sm:p-8 shadow-soft space-y-6">
      <div className="text-center space-y-1.5">
        <div className="w-12 h-12 rounded-full bg-[#EFE9DF] text-[#9E4A2B] mx-auto flex items-center justify-center">
          <Sparkles className="w-6 h-6" />
        </div>
        <h2 className="text-xl sm:text-2xl font-display font-bold text-[#30251F]">
          Verify your Instagram handle to get your store reviewed.
        </h2>
        <p className="text-xs sm:text-sm text-[#685950] max-w-md mx-auto">
          Prove ownership of <span className="font-semibold text-[#30251F]">@{currentHandle}</span> to ensure authenticity for buyer connections. Choose one of the two options below:
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-2xl text-xs text-center max-w-md mx-auto">
          {error}
        </div>
      )}

      {/* Two Option Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
        {/* Option A: Add a code to your bio (Recommended) */}
        <div className="relative bg-white border-2 border-[#9E4A2B]/40 hover:border-[#9E4A2B] rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-xs transition-all">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-2xl">📝</span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#637B58] text-white">
                Recommended
              </span>
            </div>
            <h3 className="font-display font-bold text-sm text-[#30251F]">
              Add a code to your bio
            </h3>
            <p className="text-xs text-[#685950] leading-relaxed">
              We'll generate a short code like <code className="font-mono text-[#9E4A2B]">RABLO-XXXXXX</code>. Add it to your Instagram bio temporarily for instant review.
            </p>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => handleStartVerification('bio_code')}
            className="w-full py-2.5 px-4 rounded-xl bg-[#9E4A2B] hover:bg-[#843C22] text-[#FAF6F0] text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            <span>Choose Bio Code Method</span>
          </button>
        </div>

        {/* Option B: Send us a DM */}
        <div
          className={`bg-white border rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-xs transition-all ${
            isDmDisabled
              ? 'border-[#30251F]/10 opacity-60'
              : 'border-[#30251F]/20 hover:border-[#9E4A2B]'
          }`}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-2xl">💬</span>
              {isDmDisabled && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600">
                  Setup Required
                </span>
              )}
            </div>
            <h3 className="font-display font-bold text-sm text-[#30251F]">
              Send us a DM
            </h3>
            <p className="text-xs text-[#685950] leading-relaxed">
              {isDmDisabled
                ? 'Direct Message verification will be available once the official Instagram handle is configured.'
                : `DM a verification code from your @${currentHandle} account to @${RABLO_INSTAGRAM_HANDLE}.`}
            </p>
          </div>
          <button
            type="button"
            disabled={loading || isDmDisabled}
            onClick={() => handleStartVerification('dm')}
            className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
              isDmDisabled
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-white border border-[#30251F]/20 text-[#30251F] hover:bg-[#FAF6F0] cursor-pointer'
            }`}
          >
            {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            <span>{isDmDisabled ? 'DM Option Disabled' : 'Choose DM Method'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SellerVerificationPanel;
