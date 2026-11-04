import React, { useState, useEffect } from 'react';
import { getApprovedCategories, createProduct, requestCategory, type Category } from '../../lib/products';
import { uploadProductImage } from '../../lib/storage';
import { supabase, isSupabaseConfigured, getCurrentProfile } from '../../lib/supabase';
import { validateInstagramOwnership } from '../../lib/instagram';
import { Upload, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export const ProductUploadForm: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('1');
  const [categoryId, setCategoryId] = useState('');
  const [sellerIgUrl, setSellerIgUrl] = useState('');
  const [productIgUrl, setProductIgUrl] = useState('');
  const [igError, setIgError] = useState<string | null>(null);
  const [checkingIg, setCheckingIg] = useState(false);

  const [bulkOrders, setBulkOrders] = useState(false);
  const [internationalExport, setInternationalExport] = useState(false);

  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([]);

  const [showCatRequest, setShowCatRequest] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [catRequestMessage, setCatRequestMessage] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function init() {
      if (!isSupabaseConfigured || !supabase) return;

      const [cats, profile] = await Promise.all([
        getApprovedCategories(),
        getCurrentProfile(),
      ]);

      setCategories(cats);
      if (cats.length > 0) setCategoryId(cats[0].id);

      if (profile?.instagram_url) {
        setSellerIgUrl(profile.instagram_url);
      }
    }

    init();
  }, []);

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setThumbnailFile(file);
      setThumbnailPreview(URL.createObjectURL(file));
    }
  };

  const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setGalleryFiles(files);
      setGalleryPreviews(files.map((f) => URL.createObjectURL(f)));
    }
  };

  const handleRequestCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    const res = await requestCategory(newCatName.trim());
    if (res.success) {
      setCatRequestMessage(`Category "${newCatName}" submitted for approval.`);
      setNewCatName('');
      setTimeout(() => {
        setShowCatRequest(false);
        setCatRequestMessage(null);
      }, 2500);
    } else {
      setCatRequestMessage(res.error || 'Failed to submit category request.');
    }
  };

  const handleIgBlur = async () => {
    if (!sellerIgUrl.trim() || !supabase) {
      setIgError(null);
      return;
    }
    setCheckingIg(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUserId = session?.user?.id;
      const currentUserEmail = session?.user?.email;
      const check = await validateInstagramOwnership(sellerIgUrl.trim(), currentUserId, currentUserEmail);
      if (!check.isAvailable) {
        setIgError(check.error || 'This Instagram account is already registered with another email.');
      } else {
        setIgError(null);
      }
    } catch {
      setIgError(null);
    } finally {
      setCheckingIg(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIgError(null);

    if (!name.trim()) {
      setError('Please provide a creation title.');
      return;
    }
    if (!price || isNaN(Number(price)) || Number(price) <= 0) {
      setError('Please provide a valid selling price.');
      return;
    }
    if (!sellerIgUrl.trim()) {
      setError('Your Instagram profile link is required so buyers can message you.');
      return;
    }
    if (!thumbnailFile) {
      setError('A main cover photo is required.');
      return;
    }

    setLoading(true);

    try {
      if (!supabase) {
        throw new Error('Database is not initialized. Please refresh the page.');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        throw new Error('You must be signed in to list a product. Please sign in with Google.');
      }
      const currentUserId = session.user.id;
      const currentUserEmail = session.user.email;

      // Enforce 1-Instagram-account-per-email policy before uploading assets
      const igCheck = await validateInstagramOwnership(sellerIgUrl.trim(), currentUserId, currentUserEmail);
      if (!igCheck.isAvailable) {
        setIgError(igCheck.error || 'This Instagram account is already registered with another email.');
        throw new Error(igCheck.error || 'This Instagram account is already registered with another email. Each Instagram account can only be used by one email address.');
      }

      const thumbResult = await uploadProductImage(thumbnailFile, currentUserId);
      if (!thumbResult.success || !thumbResult.url) {
        throw new Error(thumbResult.error || 'Failed to upload photo.');
      }

      const galleryUrls: string[] = [];
      for (const file of galleryFiles) {
        const galResult = await uploadProductImage(file, currentUserId);
        if (galResult.success && galResult.url) {
          galleryUrls.push(galResult.url);
        }
      }

      const result = await createProduct({
        name: name.trim(),
        description: description.trim(),
        price: Math.round(Number(price)),
        stock: Math.max(0, parseInt(stock, 10) || 0),
        category_id: categoryId || null,
        seller_ig_url: sellerIgUrl.trim(),
        product_ig_url: productIgUrl.trim() || null,
        thumbnail_url: thumbResult.url,
        gallery_urls: galleryUrls,
        bulk_orders: bulkOrders,
        international_export: internationalExport,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to list product.');
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'An error occurred during listing.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-xl mx-auto text-center py-16 px-6 bg-ivory-100 border border-charcoal-800/10 rounded-sm shadow-soft space-y-4">
        <CheckCircle2 className="w-12 h-12 text-sage-600 mx-auto" />
        <h2 className="text-2xl font-display font-medium text-charcoal-900">
          Creation Submitted for Moderation
        </h2>
        <p className="text-xs text-charcoal-600 leading-relaxed max-w-md mx-auto">
          Your product listing is now pending review. Once approved by our team, it will appear publicly in the discovery catalog.
        </p>
        <div className="flex gap-3 justify-center pt-4">
          <a href="/seller" className="btn-primary py-3 px-6 text-xs font-semibold">
            Go to Seller Hub ↗
          </a>
          <button
            type="button"
            onClick={() => {
              setSuccess(false);
              setName('');
              setDescription('');
              setPrice('');
              setBulkOrders(false);
              setInternationalExport(false);
              setThumbnailFile(null);
              setThumbnailPreview(null);
              setGalleryFiles([]);
              setGalleryPreviews([]);
            }}
            className="btn-secondary py-3 px-6 text-xs font-semibold"
          >
            Add Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-2xl mx-auto p-6 sm:p-10 bg-ivory-100 border border-charcoal-800/10 rounded-sm shadow-soft space-y-6"
    >
      <div>
        <p className="eyebrow !mb-1">New Listing</p>
        <h2 className="text-2xl font-display font-medium text-charcoal-900 tracking-tight">
          List an Instagram Creation
        </h2>
        <p className="text-xs text-charcoal-600 mt-1">
          Buyers discover your products and message your Instagram DMs directly.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-sm text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Title */}
      <div className="space-y-1.5">
        <label className="text-[11px] uppercase tracking-wider font-semibold text-charcoal-700 block">
          Product Title *
        </label>
        <input
          type="text"
          required
          placeholder="e.g. Handmade Ceramic Matcha Cup"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-2.5 bg-ivory-50 border border-charcoal-800/20 rounded-sm text-xs text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-lavender-600"
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <label className="text-[11px] uppercase tracking-wider font-semibold text-charcoal-700 block">
          Description
        </label>
        <textarea
          rows={3}
          placeholder="Materials used, dimensions, custom sizing notes..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-4 py-2.5 bg-ivory-50 border border-charcoal-800/20 rounded-sm text-xs text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-lavender-600"
        />
      </div>

      {/* Price & Stock */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-[11px] uppercase tracking-wider font-semibold text-charcoal-700 block">
            Price (₹ INR) *
          </label>
          <input
            type="number"
            required
            min="0"
            step="1"
            placeholder="e.g. 849"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full px-4 py-2.5 bg-ivory-50 border border-charcoal-800/20 rounded-sm text-xs text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-lavender-600"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] uppercase tracking-wider font-semibold text-charcoal-700 block">
            Stock Quantity
          </label>
          <input
            type="number"
            min="0"
            placeholder="e.g. 5"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            className="w-full px-4 py-2.5 bg-ivory-50 border border-charcoal-800/20 rounded-sm text-xs text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-lavender-600"
          />
        </div>
      </div>

      {/* Category selection */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[11px] uppercase tracking-wider font-semibold text-charcoal-700">
            Category
          </label>
          <button
            type="button"
            onClick={() => setShowCatRequest(!showCatRequest)}
            className="text-[11px] text-lavender-700 hover:underline font-medium"
          >
            + Request new category
          </button>
        </div>

        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full px-4 py-2.5 bg-ivory-50 border border-charcoal-800/20 rounded-sm text-xs text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-lavender-600"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Category Request Field */}
      {showCatRequest && (
        <div className="p-4 bg-lavender-50 border border-lavender-200 rounded-sm space-y-2">
          <p className="text-xs font-semibold text-charcoal-800">Suggest a New Category</p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. Vintage Leather, Resin Art..."
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              className="flex-1 px-3 py-2 bg-ivory-50 border border-charcoal-800/20 rounded-sm text-xs text-charcoal-800"
            />
            <button
              type="button"
              onClick={handleRequestCategory}
              className="btn-secondary py-2 px-3 text-xs"
            >
              Request
            </button>
          </div>
          {catRequestMessage && (
            <p className="text-xs text-sage-700 font-medium">{catRequestMessage}</p>
          )}
        </div>
      )}

      {/* Order & Export Options in Checkbox Format */}
      <div className="space-y-2 pt-1">
        <label className="text-[11px] uppercase tracking-wider font-semibold text-charcoal-700 block">
          Order & Shipping Options
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex items-center gap-3 p-3 bg-ivory-50 border border-charcoal-800/20 rounded-sm cursor-pointer hover:border-[#7C0E44]/50 transition-colors">
            <input
              type="checkbox"
              checked={bulkOrders}
              onChange={(e) => setBulkOrders(e.target.checked)}
              className="w-4 h-4 rounded text-[#7C0E44] accent-[#7C0E44] focus:ring-[#7C0E44] cursor-pointer"
            />
            <span className="text-xs font-semibold text-charcoal-800">
              Bulk orders
            </span>
          </label>

          <label className="flex items-center gap-3 p-3 bg-ivory-50 border border-charcoal-800/20 rounded-sm cursor-pointer hover:border-[#7C0E44]/50 transition-colors">
            <input
              type="checkbox"
              checked={internationalExport}
              onChange={(e) => setInternationalExport(e.target.checked)}
              className="w-4 h-4 rounded text-[#7C0E44] accent-[#7C0E44] focus:ring-[#7C0E44] cursor-pointer"
            />
            <span className="text-xs font-semibold text-charcoal-800">
              International Export
            </span>
          </label>
        </div>
      </div>

      {/* Instagram Profile */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[11px] uppercase tracking-wider font-semibold text-charcoal-700 block">
            Your Instagram Profile URL *
          </label>
          {checkingIg && (
            <span className="text-[11px] text-charcoal-500 inline-flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin text-[#7C0E44]" />
              Checking availability...
            </span>
          )}
        </div>
        <input
          type="url"
          required
          placeholder="https://instagram.com/your_handle"
          value={sellerIgUrl}
          onChange={(e) => {
            setSellerIgUrl(e.target.value);
            if (igError) setIgError(null);
          }}
          onBlur={handleIgBlur}
          className={`w-full px-4 py-2.5 bg-ivory-50 border rounded-sm text-xs text-charcoal-800 focus:outline-none focus:ring-2 ${
            igError
              ? 'border-rose-500 focus:ring-rose-500'
              : 'border-charcoal-800/20 focus:ring-lavender-600'
          }`}
        />
        {igError ? (
          <p className="text-xs text-rose-600 font-medium flex items-start gap-1.5 pt-0.5">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{igError}</span>
          </p>
        ) : (
          <span className="text-[11px] text-charcoal-500 block">
            Shoppers tap here to message your Instagram DM directly. Each Instagram account can only be linked to one email.
          </span>
        )}
      </div>

      {/* Specific Post Link */}
      <div className="space-y-1.5">
        <label className="text-[11px] uppercase tracking-wider font-semibold text-charcoal-700 block">
          Instagram Post Link (Optional)
        </label>
        <input
          type="url"
          placeholder="https://instagram.com/p/C_abc123..."
          value={productIgUrl}
          onChange={(e) => setProductIgUrl(e.target.value)}
          className="w-full px-4 py-2.5 bg-ivory-50 border border-charcoal-800/20 rounded-sm text-xs text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-lavender-600"
        />
      </div>

      {/* Main Cover Image */}
      <div className="space-y-1.5">
        <label className="text-[11px] uppercase tracking-wider font-semibold text-charcoal-700 block">
          Main Cover Photo *
        </label>
        <input
          type="file"
          accept="image/*"
          required
          onChange={handleThumbnailChange}
          className="w-full text-xs text-charcoal-700 file:mr-4 file:py-2 file:px-4 file:rounded-sm file:border-0 file:text-xs file:font-semibold file:bg-charcoal-800 file:text-ivory-100 hover:file:bg-charcoal-700 cursor-pointer"
        />
        {thumbnailPreview && (
          <div className="mt-2 w-24 h-24 bg-[#eee9e1] rounded-sm overflow-hidden p-1 border border-charcoal-800/15">
            <img src={thumbnailPreview} alt="Preview" className="w-full h-full object-contain" />
          </div>
        )}
      </div>

      {/* Gallery */}
      <div className="space-y-1.5">
        <label className="text-[11px] uppercase tracking-wider font-semibold text-charcoal-700 block">
          Additional Gallery Images (Optional)
        </label>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleGalleryChange}
          className="w-full text-xs text-charcoal-700 file:mr-4 file:py-2 file:px-4 file:rounded-sm file:border-0 file:text-xs file:font-semibold file:bg-ivory-300 file:text-charcoal-800 hover:file:bg-ivory-400 cursor-pointer"
        />
        {galleryPreviews.length > 0 && (
          <div className="flex gap-2 mt-2 flex-wrap">
            {galleryPreviews.map((src, i) => (
              <div key={i} className="w-16 h-16 bg-[#eee9e1] rounded-sm overflow-hidden p-1 border border-charcoal-800/15">
                <img src={src} alt="" className="w-full h-full object-contain" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading}
        className="btn-primary w-full py-3.5 text-xs font-semibold flex items-center justify-center gap-2"
      >
        <Upload className="w-4 h-4 text-sage-300" />
        <span>{loading ? 'Uploading Images & Listing...' : 'Submit Creation for Moderation ↗'}</span>
      </button>
    </form>
  );
};

export default ProductUploadForm;
