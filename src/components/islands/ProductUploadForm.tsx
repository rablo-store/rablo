import React, { useState, useEffect } from 'react';
import {
  getApprovedCategories,
  createProduct,
  updateProduct,
  getProductById,
  requestCategory,
  type Category,
} from '../../lib/products';
import { getMyBrand, getBrandContact, type Brand, type BrandContact } from '../../lib/brands';
import { uploadProductImage } from '../../lib/storage';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { sanitizeContactUrl, resolveContact, ALLOWED_CONTACT_HOSTS } from '../../lib/contact';
import {
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
} from 'lucide-react';

export const ProductUploadForm: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [brandContact, setBrandContact] = useState<BrandContact | null>(null);
  const [checkingBrand, setCheckingBrand] = useState(true);

  // Edit mode
  const [editId, setEditId] = useState<string | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(false);

  // Form Fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('1');
  const [categoryId, setCategoryId] = useState('');

  // Attributes (saved to product.attributes)
  const [material, setMaterial] = useState('');
  const [size, setSize] = useState('');
  const [craftType, setCraftType] = useState('Handmade');
  const [availability, setAvailability] = useState('In Stock');

  // Product-specific chat link (overrides brand default)
  const [productChatLink, setProductChatLink] = useState('');
  const [chatLinkError, setChatLinkError] = useState<string | null>(null);

  // Options
  const [bulkOrders, setBulkOrders] = useState(false);
  const [internationalExport, setInternationalExport] = useState(false);

  // Images
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([]);

  // Category request
  const [showCatRequest, setShowCatRequest] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [catRequestMessage, setCatRequestMessage] = useState<string | null>(null);

  // Status
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function init() {
      if (!isSupabaseConfigured || !supabase) {
        setCheckingBrand(false);
        return;
      }

      setCheckingBrand(true);
      try {
        const [cats, userBrand] = await Promise.all([
          getApprovedCategories(),
          getMyBrand(),
        ]);

        setCategories(cats);
        if (cats.length > 0) setCategoryId(cats[0].id);
        setBrand(userBrand);

        if (userBrand) {
          const contact = await getBrandContact(userBrand.id);
          setBrandContact(contact);
        }

        // Check for edit mode
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          const editParam = params.get('edit');
          if (editParam) {
            setEditId(editParam);
            setLoadingEdit(true);
            const existing = await getProductById(editParam);
            if (existing) {
              setName(existing.name || '');
              setDescription(existing.description || '');
              setPrice(String(existing.price || ''));
              setStock(String(existing.stock || '1'));
              if (existing.category_id) setCategoryId(existing.category_id);
              if (existing.thumbnail_url) setThumbnailPreview(existing.thumbnail_url);
              if (existing.gallery_urls) setGalleryPreviews(existing.gallery_urls);
              setBulkOrders(Boolean(existing.bulk_orders));
              setInternationalExport(Boolean(existing.international_export));
              setProductChatLink(existing.contact_link || existing.product_ig_url || '');

              const attrs = existing.attributes || {};
              setMaterial(attrs.Material || attrs.material || '');
              setSize(attrs.Size || attrs.size || '');
              setCraftType(attrs.Type || attrs.type || 'Handmade');
              setAvailability(attrs.Availability || attrs.availability || 'In Stock');
            }
            setLoadingEdit(false);
          }
        }
      } catch (err) {
        console.error('Rablo: Error initializing product form:', err);
      } finally {
        setCheckingBrand(false);
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
      setGalleryFiles((prev) => [...prev, ...files]);
      const newUrls = files.map((f) => URL.createObjectURL(f));
      setGalleryPreviews((prev) => [...prev, ...newUrls]);
    }
  };

  const handleRemoveGalleryImage = (index: number) => {
    setGalleryPreviews((prev) => prev.filter((_, i) => i !== index));
    setGalleryFiles((prev) => prev.filter((_, i) => i !== index));
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

  const handleChatLinkBlur = (val: string) => {
    setProductChatLink(val);
    const trimmed = val.trim();
    if (!trimmed) {
      setChatLinkError(null);
      return;
    }
    const sanitized = sanitizeContactUrl(trimmed);
    if (!sanitized) {
      setChatLinkError('Link must target an approved host (instagram.com, ig.me, wa.me, t.me, m.me).');
    } else {
      setChatLinkError(null);
    }
  };

  // Live preview calculation for contact
  const effectiveInquiry = resolveContact({
    product: {
      id: editId || 'sample',
      name: name || 'Handcrafted Creation',
      price: price ? Number(price) : 899,
      product_ig_url: productChatLink.trim() || null,
      contact_link: productChatLink.trim() || null,
    },
    brandContact: brandContact || undefined,
    brand: brand || undefined,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!brand || brand.approval_status !== 'Approved') {
      setError('You need an approved Brand Store before listing creations.');
      return;
    }
    if (!name.trim()) {
      setError('Please provide a creation title.');
      return;
    }
    if (!price || isNaN(Number(price)) || Number(price) <= 0) {
      setError('Please provide a valid selling price in ₹.');
      return;
    }
    if (!thumbnailFile && !thumbnailPreview) {
      setError('A main cover photo is required.');
      return;
    }
    if (productChatLink.trim() && !sanitizeContactUrl(productChatLink.trim())) {
      setError('Product-specific chat link uses an unauthorized domain.');
      return;
    }

    setLoading(true);

    try {
      if (!supabase) {
        throw new Error('Database not configured');
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        throw new Error('Please sign in to list creations.');
      }
      const currentUserId = session.user.id;

      // Upload thumbnail if new file selected
      let finalThumbUrl = thumbnailPreview || '';
      if (thumbnailFile) {
        const thumbResult = await uploadProductImage(thumbnailFile, currentUserId);
        if (!thumbResult.success || !thumbResult.url) {
          throw new Error(thumbResult.error || 'Failed to upload cover photo.');
        }
        finalThumbUrl = thumbResult.url;
      }

      // Upload any new gallery files
      const finalGalleryUrls = [...galleryPreviews.filter((url) => !url.startsWith('blob:'))];
      for (const file of galleryFiles) {
        const galResult = await uploadProductImage(file, currentUserId);
        if (galResult.success && galResult.url) {
          finalGalleryUrls.push(galResult.url);
        }
      }

      const attributesPayload = {
        Material: material.trim() || 'Artisanal Material',
        Size: size.trim() || 'Standard Size',
        Type: craftType,
        Availability: availability.trim() || 'In Stock',
      };

      const productPayload = {
        name: name.trim(),
        description: description.trim(),
        price: Math.round(Number(price)),
        stock: Math.max(0, parseInt(stock, 10) || 0),
        category_id: categoryId || null,
        seller_ig_url: brand.instagram_url,
        product_ig_url: productChatLink.trim() || null,
        contact_link: productChatLink.trim() || null,
        thumbnail_url: finalThumbUrl,
        gallery_urls: finalGalleryUrls,
        brand_id: brand.id,
        attributes: attributesPayload,
        bulk_orders: bulkOrders,
        international_export: internationalExport,
      };

      if (editId) {
        const res = await updateProduct(editId, productPayload);
        if (!res.success) throw new Error(res.error || 'Failed to update creation.');
      } else {
        const res = await createProduct(productPayload);
        if (!res.success) throw new Error(res.error || 'Failed to list creation.');
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'An error occurred during submission.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingBrand || loadingEdit) {
    return (
      <div className="py-24 text-center space-y-3">
        <div className="inline-block w-8 h-8 border-2 border-[#9E4A2B] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-[#685950]">Loading creation form...</p>
      </div>
    );
  }

  // Block if creator has no approved brand
  if (!brand || brand.approval_status !== 'Approved') {
    return (
      <div className="max-w-xl mx-auto bg-[#FAF6F0] border border-[#30251F]/10 rounded-3xl p-8 sm:p-10 text-center space-y-4 shadow-soft">
        <div className="w-16 h-16 rounded-full bg-[#EFE9DF] text-[#9E4A2B] mx-auto flex items-center justify-center font-display text-2xl font-bold">
          ✦
        </div>
        <h1 className="text-2xl font-display font-bold text-[#30251F]">
          Approved Brand Store Required
        </h1>
        <p className="text-xs sm:text-sm text-[#685950] leading-relaxed">
          {brand?.approval_status === 'Pending'
            ? 'Your brand store application is currently under moderation review. Once approved, you can immediately list creations here.'
            : 'You need an approved Brand Store to list handcrafted items on Rablo.'}
        </p>
        <div className="pt-2">
          <a
            href="/seller"
            className="inline-block px-7 py-3 rounded-full bg-[#9E4A2B] hover:bg-[#843C22] text-[#FAF6F0] text-xs font-semibold shadow-xs transition-colors"
          >
            {brand ? 'View Application Status →' : 'Register Your Brand Store →'}
          </a>
        </div>
      </div>
    );
  }

  // Success view
  if (success) {
    return (
      <div className="max-w-xl mx-auto text-center py-16 px-6 bg-[#FAF6F0] border border-[#30251F]/10 rounded-3xl shadow-soft space-y-4 animate-fade-in">
        <CheckCircle2 className="w-14 h-14 text-[#637B58] mx-auto" />
        <h2 className="text-2xl font-display font-bold text-[#30251F]">
          {editId ? 'Creation Updated!' : 'Creation Submitted for Review!'}
        </h2>
        <p className="text-xs sm:text-sm text-[#685950] max-w-md mx-auto leading-relaxed">
          {editId
            ? 'Your changes have been saved successfully.'
            : 'Our curation desk reviews new listings within 24 hours. Once approved, buyers will discover your creation and connect with you directly.'}
        </p>
        <div className="pt-4 flex items-center justify-center gap-3">
          <a
            href="/seller"
            className="px-6 py-2.5 rounded-full bg-[#9E4A2B] hover:bg-[#843C22] text-[#FAF6F0] text-xs font-semibold shadow-xs transition-colors"
          >
            Back to Dashboard
          </a>
          {!editId && (
            <button
              type="button"
              onClick={() => {
                setSuccess(false);
                setName('');
                setDescription('');
                setPrice('');
                setThumbnailFile(null);
                setThumbnailPreview(null);
                setGalleryFiles([]);
                setGalleryPreviews([]);
              }}
              className="px-6 py-2.5 rounded-full border border-[#30251F]/20 text-xs font-semibold text-[#30251F] hover:bg-[#EBE3D7] transition-colors cursor-pointer"
            >
              List Another Product
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs text-[#685950]">
          <span className="font-semibold text-[#30251F]">{brand.name}</span>
          <span>&bull;</span>
          <span className="text-[#9E4A2B]">@{brand.slug}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-[#30251F]">
          {editId ? 'Edit Creation' : 'List a Handcrafted Creation'}
        </h1>
        <p className="text-xs text-[#685950]">
          Showcase your artisanal product to discovery shoppers with direct chat routing.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-800 font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. Basic Details Card */}
        <div className="bg-[#FAF6F0] border border-[#30251F]/10 rounded-3xl p-6 sm:p-8 space-y-5 shadow-soft-sm">
          <h2 className="text-base font-display font-bold text-[#30251F]">1. Creation Details</h2>

          <div>
            <label className="block text-xs font-semibold text-[#30251F] mb-1.5">
              Product Title <span className="text-[#9E4A2B]">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Crochet Daisy Tote Bag"
              className="w-full px-4 py-3 rounded-2xl bg-white border border-[#30251F]/15 text-xs text-[#30251F] focus:outline-none focus:ring-2 focus:ring-[#9E4A2B]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#30251F] mb-1.5">
              Description / Story
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your craft, materials used, care instructions, and what makes it unique..."
              className="w-full px-4 py-3 rounded-2xl bg-white border border-[#30251F]/15 text-xs text-[#30251F] focus:outline-none focus:ring-2 focus:ring-[#9E4A2B]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#30251F] mb-1.5">
                Price (₹ INR) <span className="text-[#9E4A2B]">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-3 text-xs text-[#685950]">₹</span>
                <input
                  type="number"
                  min="1"
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="899"
                  className="w-full pl-8 pr-4 py-3 rounded-2xl bg-white border border-[#30251F]/15 text-xs text-[#30251F] focus:outline-none focus:ring-2 focus:ring-[#9E4A2B]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#30251F] mb-1.5">
                Stock / Pieces Available
              </label>
              <input
                type="number"
                min="0"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                placeholder="10"
                className="w-full px-4 py-3 rounded-2xl bg-white border border-[#30251F]/15 text-xs text-[#30251F] focus:outline-none focus:ring-2 focus:ring-[#9E4A2B]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-[#30251F]">Category</label>
                <button
                  type="button"
                  onClick={() => setShowCatRequest(!showCatRequest)}
                  className="text-[11px] text-[#9E4A2B] hover:underline"
                >
                  + Request new
                </button>
              </div>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-white border border-[#30251F]/15 text-xs text-[#30251F] focus:outline-none focus:ring-2 focus:ring-[#9E4A2B]"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {showCatRequest && (
            <div className="bg-[#EFE9DF] p-3.5 rounded-2xl border border-[#30251F]/10 space-y-2">
              <p className="text-xs font-semibold text-[#30251F]">Suggest a new category:</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="e.g. Macrame & Weaving"
                  className="flex-1 px-3 py-2 rounded-xl bg-white border border-[#30251F]/15 text-xs text-[#30251F]"
                />
                <button
                  type="button"
                  onClick={handleRequestCategory}
                  className="px-4 py-2 rounded-xl bg-[#9E4A2B] text-white text-xs font-semibold"
                >
                  Submit
                </button>
              </div>
              {catRequestMessage && <p className="text-[11px] text-[#637B58] font-medium">{catRequestMessage}</p>}
            </div>
          )}
        </div>

        {/* 2. Specifications & Attributes Card (Screen 3: Product Details Specs) */}
        <div className="bg-[#FAF6F0] border border-[#30251F]/10 rounded-3xl p-6 sm:p-8 space-y-5 shadow-soft-sm">
          <h2 className="text-base font-display font-bold text-[#30251F]">
            2. Product Specifications
          </h2>
          <p className="text-xs text-[#685950] -mt-3">
            Displayed on your product detail page specifications table (Material, Dimensions, Production type).
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#30251F] mb-1.5">
                Material / Composition
              </label>
              <input
                type="text"
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
                placeholder='e.g. 100% Organic Cotton Yarn, Stoneware'
                className="w-full px-4 py-3 rounded-2xl bg-white border border-[#30251F]/15 text-xs text-[#30251F] focus:outline-none focus:ring-2 focus:ring-[#9E4A2B]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#30251F] mb-1.5">
                Size / Dimensions
              </label>
              <input
                type="text"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                placeholder='e.g. 14" (H) × 12" (W) or 350ml'
                className="w-full px-4 py-3 rounded-2xl bg-white border border-[#30251F]/15 text-xs text-[#30251F] focus:outline-none focus:ring-2 focus:ring-[#9E4A2B]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#30251F] mb-1.5">
                Craft / Production Type
              </label>
              <select
                value={craftType}
                onChange={(e) => setCraftType(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-white border border-[#30251F]/15 text-xs text-[#30251F] focus:outline-none focus:ring-2 focus:ring-[#9E4A2B]"
              >
                <option value="Handmade">Handmade</option>
                <option value="Made to Order">Made to Order</option>
                <option value="Custom Craft">Custom Craft</option>
                <option value="Small Batch Production">Small Batch Production</option>
                <option value="Digital / Downloadable">Digital / Downloadable</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#30251F] mb-1.5">
                Availability Status
              </label>
              <input
                type="text"
                value={availability}
                onChange={(e) => setAvailability(e.target.value)}
                placeholder="e.g. In Stock or Made to Order (3-5 days)"
                className="w-full px-4 py-3 rounded-2xl bg-white border border-[#30251F]/15 text-xs text-[#30251F] focus:outline-none focus:ring-2 focus:ring-[#9E4A2B]"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-[#30251F]/10 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={bulkOrders}
                onChange={(e) => setBulkOrders(e.target.checked)}
                className="rounded accent-[#9E4A2B]"
              />
              <span className="text-xs font-medium text-[#30251F]">Accept Bulk / Corporate Gifting Orders</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={internationalExport}
                onChange={(e) => setInternationalExport(e.target.checked)}
                className="rounded accent-[#9E4A2B]"
              />
              <span className="text-xs font-medium text-[#30251F]">Available for International Shipping</span>
            </label>
          </div>
        </div>

        {/* 3. Product-Specific Chat Link Card (Step D Requirement) */}
        <div className="bg-[#FAF6F0] border border-[#30251F]/10 rounded-3xl p-6 sm:p-8 space-y-4 shadow-soft-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-display font-bold text-[#30251F]">
              3. Product-Specific Chat Link (Optional)
            </h2>
            <span className="text-[10px] bg-[#EFE9DF] text-[#685950] px-2.5 py-0.5 rounded-full font-semibold">
              Overrides Brand Default
            </span>
          </div>
          <p className="text-xs text-[#685950] leading-relaxed">
            If left blank, inquiries for this item route to your brand's default contact channel. Enter a custom link if you want buyers to reach a specific phone number, WhatsApp link, or post.
          </p>

          <div>
            <input
              type="text"
              value={productChatLink}
              onChange={(e) => setProductChatLink(e.target.value)}
              onBlur={(e) => handleChatLinkBlur(e.target.value)}
              placeholder="e.g. https://wa.me/919876543210?text=Hi%20Nia%2C%20inquiring%20about%20Crochet%20Daisy%20Tote"
              className="w-full px-4 py-3 rounded-2xl bg-white border border-[#30251F]/15 text-xs text-[#30251F] font-mono focus:outline-none focus:ring-2 focus:ring-[#9E4A2B]"
            />
            {chatLinkError && <p className="text-[11px] text-[#9E4A2B] mt-1 font-medium">{chatLinkError}</p>}
            <p className="text-[11px] text-[#685950] mt-1">
              Allowed hosts: <code className="text-[#9E4A2B]">{ALLOWED_CONTACT_HOSTS.join(', ')}</code>
            </p>
          </div>

          {/* Live Preview Box */}
          <div className="bg-[#EFE9DF] p-3.5 rounded-2xl border border-[#30251F]/10 space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#30251F]">Effective Buyer Route for this Item:</span>
              <span className="text-[10px] font-bold text-[#9E4A2B]">
                {productChatLink.trim() ? 'Product Override Active' : 'Using Brand Default'}
              </span>
            </div>
            <div className="bg-white p-2.5 rounded-xl font-mono text-[11px] text-[#30251F] break-all border border-[#30251F]/10">
              {effectiveInquiry?.url || brand.instagram_url}
            </div>
          </div>
        </div>

        {/* 4. Product Photos Card */}
        <div className="bg-[#FAF6F0] border border-[#30251F]/10 rounded-3xl p-6 sm:p-8 space-y-5 shadow-soft-sm">
          <h2 className="text-base font-display font-bold text-[#30251F]">4. Product Imagery</h2>

          {/* Main Cover Photo */}
          <div>
            <label className="block text-xs font-semibold text-[#30251F] mb-1.5">
              Main Cover Photo <span className="text-[#9E4A2B]">*</span>
            </label>
            <div className="flex items-center gap-4">
              <div className="w-24 h-24 rounded-2xl bg-[#EFE9DF] overflow-hidden border border-[#30251F]/15 flex items-center justify-center flex-shrink-0">
                {thumbnailPreview ? (
                  <img src={thumbnailPreview} alt="Cover preview" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs text-[#685950]">No image</span>
                )}
              </div>
              <label className="cursor-pointer px-4 py-2.5 rounded-xl bg-white border border-[#30251F]/20 text-xs font-medium text-[#30251F] hover:bg-[#EBE3D7] transition-colors inline-flex items-center gap-2">
                <Upload className="w-4 h-4 text-[#9E4A2B]" />
                <span>Choose Cover Image</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleThumbnailChange}
                />
              </label>
            </div>
          </div>

          {/* Additional Gallery Photos */}
          <div className="pt-2 border-t border-[#30251F]/10">
            <label className="block text-xs font-semibold text-[#30251F] mb-1.5">
              Additional Gallery Photos
            </label>
            <div className="flex flex-wrap gap-3 items-center">
              {galleryPreviews.map((url, idx) => (
                <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-[#30251F]/15 bg-[#EFE9DF]">
                  <img src={url} alt={`Gallery ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemoveGalleryImage(idx)}
                    className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white hover:bg-black transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}

              <label className="cursor-pointer w-20 h-20 rounded-xl border border-dashed border-[#30251F]/30 bg-white hover:bg-[#EBE3D7] transition-colors flex flex-col items-center justify-center text-[10px] text-[#685950] gap-1">
                <Upload className="w-4 h-4 text-[#9E4A2B]" />
                <span>+ Add</span>
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleGalleryChange}
                />
              </label>
            </div>
          </div>
        </div>

        {/* Submit Bar */}
        <div className="flex items-center justify-between pt-2">
          <a
            href="/seller"
            className="px-6 py-3 rounded-full border border-[#30251F]/20 text-xs font-semibold text-[#30251F] hover:bg-[#EBE3D7] transition-colors"
          >
            Cancel
          </a>
          <button
            type="submit"
            disabled={loading}
            className="px-8 py-3.5 rounded-full bg-[#9E4A2B] hover:bg-[#843C22] disabled:opacity-50 text-[#FAF6F0] text-xs font-semibold transition-all shadow-sm cursor-pointer inline-flex items-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{loading ? 'Saving Creation...' : editId ? 'Update Creation' : 'Publish Creation'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProductUploadForm;
