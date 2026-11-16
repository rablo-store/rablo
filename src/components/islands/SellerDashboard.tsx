import React, { useState, useEffect } from 'react';
import { getCurrentProfile, signOutUser, type RabloProfile } from '../../lib/supabase';
import {
  getMyBrand,
  createBrand,
  updateBrand,
  upsertBrandContact,
  getBrandContact,
  checkSlugAvailable,
  getSaveCounts,
  type Brand,
  type BrandContact,
} from '../../lib/brands';
import { getSellerProducts, deleteProduct, type Product } from '../../lib/products';
import { validateInstagramOwnership, canonicalizeInstagramUrl, normalizeInstagramUsername } from '../../lib/instagram';
import { uploadProductImage } from '../../lib/storage';
import { sanitizeContactUrl, resolveContact, ALLOWED_CONTACT_HOSTS, type ContactType } from '../../lib/contact';
import {
  Plus,
  Check,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Clock,
  Upload,
  RefreshCw,
  Trash2,
  Edit3,
  ShoppingBag,
} from 'lucide-react';

type DashboardTab = 'overview' | 'products' | 'leads' | 'settings' | 'support';

interface RegistrationDraft {
  name: string;
  slug: string;
  tagline: string;
  bio: string;
  logoUrl: string;
  bannerUrl: string;
  creatorType: 'individual' | 'small_brand';
  instagramUrl: string;
  contactType: ContactType;
  linkTemplate: string;
  messageTemplate: string;
  step: number;
}

const DEFAULT_SAMPLE_PRODUCT = {
  id: 'sample-p1',
  name: 'Crochet Daisy Tote Bag',
  price: 899,
};

const DRAFT_STORAGE_KEY = 'rablo:brand_registration_draft';

export const SellerDashboard: React.FC = () => {
  const [profile, setProfile] = useState<RabloProfile | null>(null);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [_brandContact, setBrandContact] = useState<BrandContact | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [saveCounts, setSaveCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // Active dashboard tab
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Wizard state
  const [wizardStep, setWizardStep] = useState<number>(2);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [slugError, setSlugError] = useState<string | null>(null);
  const [tagline, setTagline] = useState('');
  const [bio, setBio] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [creatorType, setCreatorType] = useState<'individual' | 'small_brand'>('individual');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [igStatus, setIgStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [igError, setIgError] = useState<string | null>(null);
  const [contactType, setContactType] = useState<ContactType>('instagram');
  const [linkTemplate, setLinkTemplate] = useState('https://ig.me/m/{handle}');
  const [messageTemplate, setMessageTemplate] = useState('Hi! I am inquiring about {product_name} on Rijlo ({product_url}).');
  const [submittingBrand, setSubmittingBrand] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  // Profile Settings form state
  const [settingsName, setSettingsName] = useState('');
  const [settingsSlug, setSettingsSlug] = useState('');
  const [settingsTagline, setSettingsTagline] = useState('');
  const [settingsBio, setSettingsBio] = useState('');
  const [settingsLogoUrl, setSettingsLogoUrl] = useState('');
  const [settingsBannerUrl, setSettingsBannerUrl] = useState('');
  const [settingsCreatorType, setSettingsCreatorType] = useState<'individual' | 'small_brand'>('individual');
  const [settingsIgUrl, setSettingsIgUrl] = useState('');
  const [settingsContactType, setSettingsContactType] = useState<ContactType>('instagram');
  const [settingsLinkTemplate, setSettingsLinkTemplate] = useState('');
  const [settingsMessageTemplate, setSettingsMessageTemplate] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // Load initial data
  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const prof = await getCurrentProfile();
      setProfile(prof);

      if (prof?.id) {
        const [userBrand, sellerProds, saves] = await Promise.all([
          getMyBrand(),
          getSellerProducts(prof.id),
          getSaveCounts(),
        ]);

        setBrand(userBrand);
        setProducts(sellerProds);
        setSaveCounts(saves);

        if (userBrand) {
          const contact = await getBrandContact(userBrand.id);
          setBrandContact(contact);

          // Populate settings tab
          setSettingsName(userBrand.name || '');
          setSettingsSlug(userBrand.slug || '');
          setSettingsTagline(userBrand.tagline || '');
          setSettingsBio(userBrand.bio || '');
          setSettingsLogoUrl(userBrand.logo_url || '');
          setSettingsBannerUrl(userBrand.banner_url || '');
          setSettingsCreatorType(userBrand.creator_type || 'individual');
          setSettingsIgUrl(userBrand.instagram_url || '');

          if (contact) {
            setSettingsContactType(contact.contact_type || 'instagram');
            setSettingsLinkTemplate(contact.link_template || '');
            setSettingsMessageTemplate(contact.message_template || '');
          } else {
            setSettingsContactType('instagram');
            setSettingsLinkTemplate(`https://ig.me/m/${userBrand.slug}`);
            setSettingsMessageTemplate('Hi! I am inquiring about {product_name} on Rijlo ({product_url}).');
          }
        } else {
          // Restore draft if user has no brand
          try {
            const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
            if (raw) {
              const draft: RegistrationDraft = JSON.parse(raw);
              if (draft.name) setName(draft.name);
              if (draft.slug) setSlug(draft.slug);
              if (draft.tagline) setTagline(draft.tagline);
              if (draft.bio) setBio(draft.bio);
              if (draft.logoUrl) setLogoUrl(draft.logoUrl);
              if (draft.bannerUrl) setBannerUrl(draft.bannerUrl);
              if (draft.creatorType) setCreatorType(draft.creatorType);
              if (draft.instagramUrl) setInstagramUrl(draft.instagramUrl);
              if (draft.contactType) setContactType(draft.contactType);
              if (draft.linkTemplate) setLinkTemplate(draft.linkTemplate);
              if (draft.messageTemplate) setMessageTemplate(draft.messageTemplate);
              if (draft.step) setWizardStep(draft.step);
            } else if (prof.full_name) {
              setName(prof.full_name);
              const autoSlug = prof.full_name.toLowerCase().replace(/[^a-z0-9]/g, '');
              if (autoSlug) setSlug(autoSlug);
            }
          } catch {}
        }
      }
    } catch (err) {
      console.error('Rablo: Error loading seller dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Save registration draft on change
  useEffect(() => {
    if (!brand && profile) {
      const draft: RegistrationDraft = {
        name,
        slug,
        tagline,
        bio,
        logoUrl,
        bannerUrl,
        creatorType,
        instagramUrl,
        contactType,
        linkTemplate,
        messageTemplate,
        step: wizardStep,
      };
      try {
        sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
      } catch {}
    }
  }, [
    name,
    slug,
    tagline,
    bio,
    logoUrl,
    bannerUrl,
    creatorType,
    instagramUrl,
    contactType,
    linkTemplate,
    messageTemplate,
    wizardStep,
    brand,
    profile,
  ]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Live slug check
  const handleCheckSlug = async (candidate: string) => {
    const clean = candidate.toLowerCase().trim().replace(/^@/, '');
    setSlug(clean);
    if (!clean || clean.length < 3) {
      setSlugStatus('taken');
      setSlugError('Slug must be at least 3 characters.');
      return;
    }
    if (!/^[a-z0-9][a-z0-9-]{2,39}$/.test(clean)) {
      setSlugStatus('taken');
      setSlugError('Slug can only contain lowercase letters, numbers, and hyphens.');
      return;
    }

    setSlugStatus('checking');
    const available = await checkSlugAvailable(clean, brand?.id);
    if (available) {
      setSlugStatus('available');
      setSlugError(null);
    } else {
      setSlugStatus('taken');
      setSlugError('This store handle is already claimed by another creator.');
    }
  };

  // Live Instagram validation
  const handleCheckInstagram = async (val: string) => {
    setInstagramUrl(val);
    const trimmed = val.trim();
    if (!trimmed) {
      setIgStatus('idle');
      setIgError(null);
      return;
    }

    setIgStatus('checking');
    const check = await validateInstagramOwnership(trimmed, profile?.id, profile?.email);
    if (!check.isAvailable) {
      setIgStatus('invalid');
      setIgError(check.error || 'This Instagram account is already registered with another user.');
    } else {
      setIgStatus('valid');
      setIgError(null);
      // Auto-update default link template if on instagram
      const handle = check.normalizedHandle || normalizeInstagramUsername(trimmed);
      if (handle && contactType === 'instagram') {
        setLinkTemplate(`https://ig.me/m/${handle}`);
      }
    }
  };

  // Image uploads
  const handleFileUpload = async (
    file: File,
    type: 'logo' | 'banner',
    target: 'wizard' | 'settings'
  ) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('File size must be 5MB or less');
      return;
    }
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      showToast('Please upload a JPG, PNG, or WebP image');
      return;
    }

    if (type === 'logo') setUploadingLogo(true);
    if (type === 'banner') setUploadingBanner(true);

    try {
      const res = await uploadProductImage(file, profile?.id, 'brand');
      if (res.success && res.url) {
        if (target === 'wizard') {
          if (type === 'logo') setLogoUrl(res.url);
          if (type === 'banner') setBannerUrl(res.url);
        } else {
          if (type === 'logo') setSettingsLogoUrl(res.url);
          if (type === 'banner') setSettingsBannerUrl(res.url);
        }
        showToast(`${type === 'logo' ? 'Logo' : 'Banner'} uploaded successfully!`);
      } else {
        showToast(res.error || 'Upload failed');
      }
    } catch (err: any) {
      showToast(err.message || 'Upload error');
    } finally {
      if (type === 'logo') setUploadingLogo(false);
      if (type === 'banner') setUploadingBanner(false);
    }
  };

  // Contact template defaults on type change
  const handleContactTypeChange = (type: ContactType) => {
    setContactType(type);
    const handle = normalizeInstagramUsername(instagramUrl) || slug || 'yourname';
    if (type === 'instagram') {
      setLinkTemplate(`https://ig.me/m/${handle}`);
    } else if (type === 'whatsapp') {
      setLinkTemplate('https://wa.me/919876543210?text={message}');
    } else {
      setLinkTemplate('https://t.me/yourchannel');
    }
  };

  // Resolve preview link
  const sampleResolved = resolveContact({
    product: {
      id: DEFAULT_SAMPLE_PRODUCT.id,
      name: DEFAULT_SAMPLE_PRODUCT.name,
      price: DEFAULT_SAMPLE_PRODUCT.price,
    },
    brandContact: {
      contact_type: contactType,
      link_template: linkTemplate,
      message_template: messageTemplate,
    },
    brand: {
      name: name || 'Your Brand',
      instagram_url: instagramUrl,
    },
  });

  const isContactLinkValid = Boolean(sampleResolved?.url && sanitizeContactUrl(sampleResolved.url));

  // Submit Brand Registration
  const handleSubmitBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!name.trim()) {
      showToast('Brand name is required');
      return;
    }
    if (!slug.trim() || slugStatus === 'taken') {
      showToast('Please provide a valid, available brand handle.');
      return;
    }
    if (!instagramUrl.trim() || igStatus === 'invalid') {
      showToast('Please provide a valid, verified Instagram profile.');
      return;
    }
    if (!isContactLinkValid) {
      showToast('Contact link template must target an approved host (instagram.com, ig.me, wa.me, t.me, m.me).');
      return;
    }

    setSubmittingBrand(true);
    try {
      const canonicalIg = canonicalizeInstagramUrl(instagramUrl.trim());
      const brandRes = await createBrand({
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        tagline: tagline.trim() || null,
        bio: bio.trim() || null,
        logo_url: logoUrl || null,
        banner_url: bannerUrl || null,
        instagram_url: canonicalIg,
        creator_type: creatorType,
      });

      if (!brandRes.success || !brandRes.data) {
        throw new Error(brandRes.error || 'Failed to register brand');
      }

      // Upsert contact settings
      await upsertBrandContact({
        brand_id: brandRes.data.id,
        contact_type: contactType,
        link_template: linkTemplate.trim(),
        message_template: messageTemplate.trim() || null,
      });

      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      setBrand(brandRes.data);
      showToast('Brand submitted for review!');
    } catch (err: any) {
      showToast(err.message || 'Error submitting brand application.');
    } finally {
      setSubmittingBrand(false);
    }
  };

  // Save Profile & Contact Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brand) return;
    setSavingSettings(true);
    setSettingsError(null);

    try {
      const resolved = resolveContact({
        product: { id: 'test', name: 'Sample Item', price: 999 },
        brandContact: {
          contact_type: settingsContactType,
          link_template: settingsLinkTemplate,
          message_template: settingsMessageTemplate,
        },
        brand: { name: settingsName, instagram_url: settingsIgUrl },
      });
      const sanitizedTest = sanitizeContactUrl(resolved?.url);

      if (!sanitizedTest) {
        setSettingsError('Contact link template is invalid or uses an unauthorized domain.');
        setSavingSettings(false);
        return;
      }

      const canonicalIg = canonicalizeInstagramUrl(settingsIgUrl.trim());
      const updateRes = await updateBrand(brand.id, {
        name: settingsName.trim(),
        tagline: settingsTagline.trim() || null,
        bio: settingsBio.trim() || null,
        logo_url: settingsLogoUrl || null,
        banner_url: settingsBannerUrl || null,
        instagram_url: canonicalIg,
        creator_type: settingsCreatorType,
      });

      if (!updateRes.success) throw new Error(updateRes.error);

      await upsertBrandContact({
        brand_id: brand.id,
        contact_type: settingsContactType,
        link_template: settingsLinkTemplate.trim(),
        message_template: settingsMessageTemplate.trim() || null,
      });

      showToast('Profile and Contact settings updated successfully!');
      await loadDashboardData();
    } catch (err: any) {
      setSettingsError(err.message || 'Failed to update settings');
    } finally {
      setSavingSettings(false);
    }
  };

  // Delete product action
  const handleDeleteProduct = async (pId: string, pName: string) => {
    if (!confirm(`Are you sure you want to remove "${pName}"?`)) return;
    const ok = await deleteProduct(pId);
    if (ok) {
      setProducts((prev) => prev.filter((p) => p.id !== pId));
      showToast('Creation removed');
    } else {
      showToast('Failed to remove creation');
    }
  };

  const handleSignOut = async () => {
    await signOutUser('/account?signed_out=1');
  };

  // Total saves across all seller products
  const totalSaves = products.reduce((acc, p) => acc + (saveCounts[p.id] || 0), 0);

  // 1. Loading State
  if (loading) {
    return (
      <div className="py-24 text-center space-y-3">
        <div className="inline-block w-8 h-8 border-2 border-[#9E4A2B] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-[#685950]">Loading Creator Hub...</p>
      </div>
    );
  }

  // 2. Not Logged In -> Landing Card (Mockup 7)
  if (!profile) {
    return (
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 items-center bg-[#FAF6F0] border border-[#30251F]/10 rounded-3xl p-6 sm:p-10 shadow-soft">
        {/* Left Visual Illustration with pinned note */}
        <div className="md:col-span-5 relative rounded-2xl overflow-hidden aspect-[4/5] bg-[#EFE9DF] shadow-sm">
          <img
            src="https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=800&auto=format&fit=crop&q=80"
            alt="Handmade pottery vase with daisies and floral crafts"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
          <div className="absolute top-4 left-4 right-4 p-3 rounded-xl bg-[#FAF6F0]/90 backdrop-blur-xs text-center border border-[#30251F]/10">
            <p className="font-display font-bold text-sm text-[#30251F]">List Your Creations on Rijlo ♡</p>
          </div>
        </div>

        {/* Right Feature Card */}
        <div className="md:col-span-7 space-y-6">
          <div>
            <h1 className="font-display font-bold text-2xl sm:text-3xl text-[#30251F]">
              Become a Creator on Rijlo
            </h1>
            <p className="text-xs sm:text-sm text-[#685950] mt-1.5 leading-relaxed">
              Showcase your products, grow your Instagram brand and reach more customers.
            </p>
          </div>

          <div className="space-y-3.5">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-[#EFE9DF] flex items-center justify-center text-sm">🎨</span>
              <span className="text-xs sm:text-sm font-medium text-[#30251F]">Create your creator profile</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-[#EFE9DF] flex items-center justify-center text-sm">📋</span>
              <span className="text-xs sm:text-sm font-medium text-[#30251F]">List your products</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-[#EFE9DF] flex items-center justify-center text-sm">🚀</span>
              <span className="text-xs sm:text-sm font-medium text-[#30251F]">Get discovered by new customers</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-[#EFE9DF] flex items-center justify-center text-sm">🏷️</span>
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

  // 3. User Logged In, but No Brand Registered -> Multi-Step Wizard (Mockup 7)
  if (!brand) {
    return (
      <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
        {/* Toast */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 bg-[#30251F] text-[#FAF6F0] px-5 py-3 rounded-2xl shadow-xl z-50 text-xs flex items-center gap-2 border border-[#FAF6F0]/20 animate-fade-in">
            <Check className="w-4 h-4 text-[#637B58]" />
            <span>{toastMessage}</span>
          </div>
        )}

        <div className="text-center space-y-2">
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-[#30251F]">
            Register Your Brand Store
          </h1>
          <p className="text-xs sm:text-sm text-[#685950] max-w-md mx-auto">
            Set up your storefront profile and connect your direct inquiry chat to start receiving buyer leads.
          </p>
        </div>

        {/* Progress Stepper */}
        <div className="bg-[#FAF6F0] border border-[#30251F]/10 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className="flex flex-col items-center gap-1.5">
              <div className="w-7 h-7 rounded-full bg-[#637B58] text-[#FAF6F0] flex items-center justify-center font-bold text-xs">
                ✓
              </div>
              <span className="text-[11px] font-medium text-[#30251F]">1. Account</span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                  wizardStep === 2
                    ? 'bg-[#9E4A2B] text-[#FAF6F0]'
                    : wizardStep > 2
                    ? 'bg-[#637B58] text-[#FAF6F0]'
                    : 'bg-[#EFE9DF] text-[#685950]'
                }`}
              >
                2
              </div>
              <span className={`text-[11px] font-medium ${wizardStep >= 2 ? 'text-[#30251F]' : 'text-[#685950]'}`}>
                2. Store
              </span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                  wizardStep === 3
                    ? 'bg-[#9E4A2B] text-[#FAF6F0]'
                    : wizardStep > 3
                    ? 'bg-[#637B58] text-[#FAF6F0]'
                    : 'bg-[#EFE9DF] text-[#685950]'
                }`}
              >
                3
              </div>
              <span className={`text-[11px] font-medium ${wizardStep >= 3 ? 'text-[#30251F]' : 'text-[#685950]'}`}>
                3. Contact
              </span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                  wizardStep === 4 ? 'bg-[#9E4A2B] text-[#FAF6F0]' : 'bg-[#EFE9DF] text-[#685950]'
                }`}
              >
                4
              </div>
              <span className={`text-[11px] font-medium ${wizardStep === 4 ? 'text-[#30251F]' : 'text-[#685950]'}`}>
                4. Review
              </span>
            </div>
          </div>
        </div>

        {/* Wizard Step 2: Store Profile */}
        {wizardStep === 2 && (
          <div className="bg-[#FAF6F0] border border-[#30251F]/10 rounded-3xl p-6 sm:p-8 space-y-6 shadow-soft-sm">
            <h2 className="text-lg font-display font-bold text-[#30251F]">
              Step 2: Store Identity & Branding
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#30251F] mb-1.5">
                  Brand / Store Name <span className="text-[#9E4A2B]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!slug) {
                      const auto = e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '');
                      setSlug(auto);
                    }
                  }}
                  onBlur={() => {
                    if (slug) handleCheckSlug(slug);
                  }}
                  placeholder="e.g. crochet by Nia"
                  className="w-full px-4 py-3 rounded-2xl bg-white border border-[#30251F]/15 text-xs text-[#30251F] focus:outline-none focus:ring-2 focus:ring-[#9E4A2B]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#30251F] mb-1.5">
                  Brand Store Handle (Slug) <span className="text-[#9E4A2B]">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-xs text-[#685950]">@</span>
                  <input
                    type="text"
                    required
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    onBlur={(e) => handleCheckSlug(e.target.value)}
                    placeholder="crochetbynia"
                    className="w-full pl-8 pr-10 py-3 rounded-2xl bg-white border border-[#30251F]/15 text-xs text-[#30251F] focus:outline-none focus:ring-2 focus:ring-[#9E4A2B]"
                  />
                  <div className="absolute right-3.5 top-3 text-xs">
                    {slugStatus === 'checking' && <RefreshCw className="w-4 h-4 text-[#685950] animate-spin" />}
                    {slugStatus === 'available' && <CheckCircle2 className="w-4 h-4 text-[#637B58]" />}
                    {slugStatus === 'taken' && <AlertCircle className="w-4 h-4 text-[#9E4A2B]" />}
                  </div>
                </div>
                {slugError && <p className="text-[11px] text-[#9E4A2B] mt-1 font-medium">{slugError}</p>}
                <p className="text-[11px] text-[#685950] mt-1">
                  Your storefront URL will be: <span className="font-semibold text-[#30251F]">rijlo.store/creators/{slug || 'yourhandle'}</span>
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#30251F] mb-1.5">
                  Tagline / Short Pitch
                </label>
                <input
                  type="text"
                  maxLength={100}
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="e.g. Crochet Accessories • Handmade with Love"
                  className="w-full px-4 py-3 rounded-2xl bg-white border border-[#30251F]/15 text-xs text-[#30251F] focus:outline-none focus:ring-2 focus:ring-[#9E4A2B]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#30251F] mb-1.5">
                  Bio / Artisan Story
                </label>
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell buyers about your slow-made craft, materials, and creation journey..."
                  className="w-full px-4 py-3 rounded-2xl bg-white border border-[#30251F]/15 text-xs text-[#30251F] focus:outline-none focus:ring-2 focus:ring-[#9E4A2B]"
                />
              </div>

              {/* Logo & Banner uploads */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-[#30251F] mb-1.5">
                    Store Logo / Avatar
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-full bg-[#EFE9DF] overflow-hidden border border-[#30251F]/15 flex items-center justify-center flex-shrink-0">
                      {logoUrl ? (
                        <img src={logoUrl} alt="Store logo" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl">🌸</span>
                      )}
                    </div>
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#30251F]/20 text-xs font-medium text-[#30251F] hover:bg-[#EBE3D7] transition-colors">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{uploadingLogo ? 'Uploading...' : 'Choose Logo'}</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'logo', 'wizard')}
                      />
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#30251F] mb-1.5">
                    Store Banner
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="w-20 h-14 rounded-xl bg-[#EFE9DF] overflow-hidden border border-[#30251F]/15 flex items-center justify-center flex-shrink-0">
                      {bannerUrl ? (
                        <img src={bannerUrl} alt="Store banner" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs text-[#685950]">No Banner</span>
                      )}
                    </div>
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#30251F]/20 text-xs font-medium text-[#30251F] hover:bg-[#EBE3D7] transition-colors">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{uploadingBanner ? 'Uploading...' : 'Choose Banner'}</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'banner', 'wizard')}
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Creator Type */}
              <div className="pt-2">
                <label className="block text-xs font-semibold text-[#30251F] mb-1.5">
                  Creator Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setCreatorType('individual')}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      creatorType === 'individual'
                        ? 'border-[#9E4A2B] bg-[#9E4A2B]/5 text-[#30251F]'
                        : 'border-[#30251F]/15 bg-white text-[#685950]'
                    }`}
                  >
                    <p className="text-xs font-bold text-[#30251F]">Individual Artisan</p>
                    <p className="text-[11px] text-[#685950] mt-0.5">Solo creator crafting handmade pieces</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCreatorType('small_brand')}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      creatorType === 'small_brand'
                        ? 'border-[#9E4A2B] bg-[#9E4A2B]/5 text-[#30251F]'
                        : 'border-[#30251F]/15 bg-white text-[#685950]'
                    }`}
                  >
                    <p className="text-xs font-bold text-[#30251F]">Small Brand / Studio</p>
                    <p className="text-[11px] text-[#685950] mt-0.5">Independent boutique or workshop team</p>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-[#30251F]/10">
              <button
                type="button"
                onClick={() => {
                  if (!name.trim()) {
                    showToast('Please enter your store name');
                    return;
                  }
                  if (!slug.trim() || slugStatus === 'taken') {
                    showToast('Please enter an available store handle');
                    return;
                  }
                  setWizardStep(3);
                }}
                className="px-8 py-3 rounded-full bg-[#9E4A2B] hover:bg-[#843C22] text-[#FAF6F0] text-xs font-semibold transition-all shadow-sm cursor-pointer"
              >
                Next: Contact Details &rarr;
              </button>
            </div>
          </div>
        )}

        {/* Wizard Step 3: Instagram & Contact Method */}
        {wizardStep === 3 && (
          <div className="bg-[#FAF6F0] border border-[#30251F]/10 rounded-3xl p-6 sm:p-8 space-y-6 shadow-soft-sm">
            <h2 className="text-lg font-display font-bold text-[#30251F]">
              Step 3: Direct Inquiry & Chat Link
            </h2>

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-[#30251F] mb-1.5">
                  Instagram Handle / Profile <span className="text-[#9E4A2B]">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={instagramUrl}
                    onChange={(e) => setInstagramUrl(e.target.value)}
                    onBlur={(e) => handleCheckInstagram(e.target.value)}
                    placeholder="https://instagram.com/yourhandle or @yourhandle"
                    className="w-full px-4 pr-10 py-3 rounded-2xl bg-white border border-[#30251F]/15 text-xs text-[#30251F] focus:outline-none focus:ring-2 focus:ring-[#9E4A2B]"
                  />
                  <div className="absolute right-3.5 top-3 text-xs">
                    {igStatus === 'checking' && <RefreshCw className="w-4 h-4 text-[#685950] animate-spin" />}
                    {igStatus === 'valid' && <CheckCircle2 className="w-4 h-4 text-[#637B58]" />}
                    {igStatus === 'invalid' && <AlertCircle className="w-4 h-4 text-[#9E4A2B]" />}
                  </div>
                </div>
                {igError && <p className="text-[11px] text-[#9E4A2B] mt-1 font-medium">{igError}</p>}
                <p className="text-[11px] text-[#685950] mt-1">
                  Enforces 1 Instagram account per creator email. Verified upon submission.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#30251F] mb-1.5">
                  Primary Contact Method
                </label>
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => handleContactTypeChange('instagram')}
                    className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                      contactType === 'instagram'
                        ? 'border-[#9E4A2B] bg-[#9E4A2B]/10 text-[#9E4A2B] font-bold'
                        : 'border-[#30251F]/15 bg-white text-[#685950]'
                    }`}
                  >
                    <span className="text-base block mb-0.5">📸</span>
                    <span className="text-xs">Instagram DM</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleContactTypeChange('whatsapp')}
                    className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                      contactType === 'whatsapp'
                        ? 'border-[#9E4A2B] bg-[#9E4A2B]/10 text-[#9E4A2B] font-bold'
                        : 'border-[#30251F]/15 bg-white text-[#685950]'
                    }`}
                  >
                    <span className="text-base block mb-0.5">💬</span>
                    <span className="text-xs">WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleContactTypeChange('custom')}
                    className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                      contactType === 'custom'
                        ? 'border-[#9E4A2B] bg-[#9E4A2B]/10 text-[#9E4A2B] font-bold'
                        : 'border-[#30251F]/15 bg-white text-[#685950]'
                    }`}
                  >
                    <span className="text-base block mb-0.5">🔗</span>
                    <span className="text-xs">Custom Link</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#30251F] mb-1.5">
                  Inquiry Link Template
                </label>
                <input
                  type="text"
                  required
                  value={linkTemplate}
                  onChange={(e) => setLinkTemplate(e.target.value)}
                  placeholder="https://ig.me/m/yourhandle or https://wa.me/91...?text={message}"
                  className="w-full px-4 py-3 rounded-2xl bg-white border border-[#30251F]/15 text-xs text-[#30251F] font-mono focus:outline-none focus:ring-2 focus:ring-[#9E4A2B]"
                />
                <p className="text-[11px] text-[#685950] mt-1">
                  Allowed domains: <code className="text-[#9E4A2B] font-semibold">{ALLOWED_CONTACT_HOSTS.join(', ')}</code>
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#30251F] mb-1.5">
                  Prefilled Message Template (for WhatsApp/Custom)
                </label>
                <textarea
                  rows={2}
                  value={messageTemplate}
                  onChange={(e) => setMessageTemplate(e.target.value)}
                  placeholder="Hi! I am inquiring about {product_name} on Rijlo ({product_url})."
                  className="w-full px-4 py-3 rounded-2xl bg-white border border-[#30251F]/15 text-xs text-[#30251F] focus:outline-none focus:ring-2 focus:ring-[#9E4A2B]"
                />
                <p className="text-[11px] text-[#685950] mt-1">
                  Available placeholders: <code className="text-[#9E4A2B]">{'{product_name}'}</code>, <code className="text-[#9E4A2B]">{'{product_url}'}</code>, <code className="text-[#9E4A2B]">{'{price}'}</code>, <code className="text-[#9E4A2B]">{'{brand_name}'}</code>
                </p>
              </div>

              {/* Live Preview Box */}
              <div className="bg-[#EFE9DF] rounded-2xl p-4 border border-[#30251F]/10 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-[#30251F]">Live Inquiry Link Preview</p>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                      isContactLinkValid ? 'bg-[#637B58]/20 text-[#637B58]' : 'bg-[#9E4A2B]/20 text-[#9E4A2B]'
                    }`}
                  >
                    {isContactLinkValid ? 'Valid Link' : 'Invalid Host Domain'}
                  </span>
                </div>
                <p className="text-[11px] text-[#685950]">
                  Sample inquiry for <strong>{DEFAULT_SAMPLE_PRODUCT.name} (₹{DEFAULT_SAMPLE_PRODUCT.price})</strong>:
                </p>
                <div className="bg-white p-3 rounded-xl border border-[#30251F]/10 text-xs font-mono break-all text-[#30251F]">
                  {sampleResolved?.url || 'Invalid link template'}
                </div>
                {sampleResolved?.message && (
                  <p className="text-[11px] text-[#685950] italic">
                    Prefilled message: "{sampleResolved.message}"
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-[#30251F]/10">
              <button
                type="button"
                onClick={() => setWizardStep(2)}
                className="px-6 py-2.5 rounded-full border border-[#30251F]/20 text-xs font-semibold text-[#30251F] hover:bg-[#EBE3D7] transition-colors cursor-pointer"
              >
                &larr; Back
              </button>
              <button
                type="button"
                disabled={!isContactLinkValid || !instagramUrl.trim() || igStatus === 'invalid'}
                onClick={() => setWizardStep(4)}
                className="px-8 py-3 rounded-full bg-[#9E4A2B] hover:bg-[#843C22] disabled:opacity-50 text-[#FAF6F0] text-xs font-semibold transition-all shadow-sm cursor-pointer"
              >
                Next: Review & Submit &rarr;
              </button>
            </div>
          </div>
        )}

        {/* Wizard Step 4: Review & Submit */}
        {wizardStep === 4 && (
          <div className="bg-[#FAF6F0] border border-[#30251F]/10 rounded-3xl p-6 sm:p-8 space-y-6 shadow-soft-sm">
            <h2 className="text-lg font-display font-bold text-[#30251F]">
              Step 4: Review Your Brand Store
            </h2>

            <div className="bg-white rounded-2xl p-5 border border-[#30251F]/10 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-[#D9A378] text-[#30251F] font-bold flex items-center justify-center font-display text-xl overflow-hidden border border-[#30251F]/10 flex-shrink-0">
                  {logoUrl ? <img src={logoUrl} alt={name} className="w-full h-full object-cover" /> : name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#30251F]">{name}</h3>
                  <p className="text-xs text-[#9E4A2B] font-semibold">@{slug}</p>
                  {tagline && <p className="text-xs text-[#685950] mt-0.5">{tagline}</p>}
                </div>
              </div>

              {bio && (
                <div className="pt-2 border-t border-[#30251F]/10 text-xs text-[#685950] leading-relaxed">
                  {bio}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                <div>
                  <span className="text-[#685950] block text-[11px]">Creator Type</span>
                  <span className="font-semibold text-[#30251F] capitalize">
                    {creatorType === 'small_brand' ? 'Small Brand / Studio' : 'Individual Artisan'}
                  </span>
                </div>
                <div>
                  <span className="text-[#685950] block text-[11px]">Instagram Profile</span>
                  <a
                    href={canonicalizeInstagramUrl(instagramUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-[#9E4A2B] hover:underline inline-flex items-center gap-1"
                  >
                    <span>@{normalizeInstagramUsername(instagramUrl)}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              <div className="pt-2 border-t border-[#30251F]/10 text-xs">
                <span className="text-[#685950] block text-[11px] mb-1">Direct Inquiry Route</span>
                <span className="font-mono text-[11px] text-[#30251F] bg-[#FAF6F0] p-2 rounded-xl block break-all border border-[#30251F]/10">
                  {sampleResolved?.url || 'Default Instagram DM'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-[#30251F]/10">
              <button
                type="button"
                onClick={() => setWizardStep(3)}
                className="px-6 py-2.5 rounded-full border border-[#30251F]/20 text-xs font-semibold text-[#30251F] hover:bg-[#EBE3D7] transition-colors cursor-pointer"
              >
                &larr; Back
              </button>
              <button
                type="button"
                disabled={submittingBrand}
                onClick={handleSubmitBrand}
                className="px-8 py-3 rounded-full bg-[#9E4A2B] hover:bg-[#843C22] disabled:opacity-50 text-[#FAF6F0] text-xs font-semibold transition-all shadow-sm cursor-pointer inline-flex items-center gap-2"
              >
                {submittingBrand && <RefreshCw className="w-4 h-4 animate-spin" />}
                <span>{submittingBrand ? 'Submitting Application...' : 'Submit Brand for Review'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 4. Brand Registered but Awaiting Moderation ('Pending')
  if (brand.approval_status === 'Pending') {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-[#FAF6F0] border border-[#30251F]/10 rounded-3xl p-6 sm:p-10 text-center space-y-4 shadow-soft">
          <div className="w-16 h-16 rounded-full bg-[#EFE9DF] text-[#9E4A2B] mx-auto flex items-center justify-center font-display text-2xl">
            <Clock className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-display font-bold text-[#30251F]">
            Your Brand Store is Under Review
          </h1>
          <p className="text-xs sm:text-sm text-[#685950] max-w-md mx-auto leading-relaxed">
            Thank you for applying to join Rijlo! Our curation team reviews all creator submissions within 24 hours to ensure authenticity.
          </p>

          <div className="bg-white rounded-2xl p-4 border border-[#30251F]/10 text-left max-w-sm mx-auto space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[#685950]">Store Name</span>
              <span className="font-bold text-[#30251F]">{brand.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#685950]">Store Handle</span>
              <span className="font-bold text-[#9E4A2B]">@{brand.slug}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#685950]">Status</span>
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold text-[10px]">
                Pending Moderation
              </span>
            </div>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="/catalog"
              className="w-full sm:w-auto px-6 py-2.5 rounded-full border border-[#30251F]/20 text-xs font-semibold text-[#30251F] hover:bg-[#EBE3D7] transition-colors"
            >
              Browse Catalog
            </a>
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-[#9E4A2B] text-[#FAF6F0] text-xs font-semibold hover:bg-[#843C22] transition-colors cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 5. Brand Rejected
  if (brand.approval_status === 'Rejected') {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-[#FAF6F0] border border-[#30251F]/10 rounded-3xl p-6 sm:p-10 text-center space-y-4 shadow-soft">
          <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 mx-auto flex items-center justify-center font-display text-2xl">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-display font-bold text-[#30251F]">
            Brand Application Needs Revision
          </h1>
          <div className="bg-red-50 text-red-800 p-4 rounded-2xl border border-red-200 text-xs text-left max-w-md mx-auto space-y-1">
            <p className="font-bold">Moderator Feedback:</p>
            <p className="leading-relaxed">
              {brand.rejection_feedback || 'Your brand submission did not meet our verification guidelines. Please update your details and resubmit.'}
            </p>
          </div>
          <p className="text-xs text-[#685950] max-w-md mx-auto">
            You can update your profile details and contact information to resubmit for moderation.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className="px-6 py-3 rounded-full bg-[#9E4A2B] text-[#FAF6F0] text-xs font-semibold hover:bg-[#843C22] transition-colors cursor-pointer"
            >
              Update Brand Details & Resubmit &rarr;
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 6. Creator Dashboard for Approved Brands (Mockup 8)
  const recentProducts = products.slice(0, 4);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-[#30251F] text-[#FAF6F0] px-5 py-3 rounded-2xl shadow-xl z-50 text-xs flex items-center gap-2 border border-[#FAF6F0]/20 animate-fade-in">
          <Check className="w-4 h-4 text-[#637B58]" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
        {/* Left Sidebar (Mockup 8) */}
        <aside className="lg:col-span-3 bg-[#FAF6F0] border border-[#30251F]/10 rounded-3xl p-5 space-y-6 shadow-soft-sm">
          {/* Creator Profile Summary */}
          <div className="flex items-center gap-3 pb-4 border-b border-[#30251F]/10">
            <div className="w-12 h-12 rounded-full bg-[#D9A378] text-[#30251F] font-bold flex items-center justify-center font-display text-base border border-[#30251F]/10 shadow-xs flex-shrink-0 overflow-hidden">
              {brand.logo_url ? (
                <img src={brand.logo_url} alt={brand.name} className="w-full h-full object-cover" />
              ) : (
                brand.name.slice(0, 2).toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm text-[#30251F] truncate">{brand.name}</p>
              <a
                href={`/creators/${brand.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-[#9E4A2B] hover:underline font-semibold flex items-center gap-1"
              >
                <span>View Store</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Navigation Menu */}
          <nav className="space-y-1 text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl transition-colors text-left cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-[#9E4A2B] text-[#FAF6F0] font-semibold'
                  : 'hover:bg-[#EBE3D7] text-[#30251F]'
              }`}
            >
              <span>🏠 Overview</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('products')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-colors text-left cursor-pointer ${
                activeTab === 'products'
                  ? 'bg-[#9E4A2B] text-[#FAF6F0] font-semibold'
                  : 'hover:bg-[#EBE3D7] text-[#30251F]'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <span>🛍️ My Products</span>
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  activeTab === 'products' ? 'bg-[#FAF6F0]/20 text-white' : 'bg-[#EFE9DF] text-[#30251F]'
                }`}
              >
                {products.length}
              </span>
            </button>

            <a
              href="/seller/upload"
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl hover:bg-[#EBE3D7] text-[#30251F] transition-colors"
            >
              <span>➕ Add Product</span>
            </a>

            <button
              type="button"
              onClick={() => setActiveTab('leads')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-colors text-left cursor-pointer ${
                activeTab === 'leads'
                  ? 'bg-[#9E4A2B] text-[#FAF6F0] font-semibold'
                  : 'hover:bg-[#EBE3D7] text-[#30251F]'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <span>🤍 Leads (Saves)</span>
              </span>
              <span className="text-[10px] bg-[#9E4A2B] text-white px-2 py-0.5 rounded-full font-bold">
                {totalSaves}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl transition-colors text-left cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-[#9E4A2B] text-[#FAF6F0] font-semibold'
                  : 'hover:bg-[#EBE3D7] text-[#30251F]'
              }`}
            >
              <span>⚙️ Profile Settings</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('support')}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl transition-colors text-left cursor-pointer ${
                activeTab === 'support'
                  ? 'bg-[#9E4A2B] text-[#FAF6F0] font-semibold'
                  : 'hover:bg-[#EBE3D7] text-[#30251F]'
              }`}
            >
              <span>❓ Help & Support</span>
            </button>

            <button
              type="button"
              onClick={handleSignOut}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl hover:bg-red-50 text-red-700 transition-colors cursor-pointer text-left"
            >
              <span>🚪 Log Out</span>
            </button>
          </nav>
        </aside>

        {/* Right Main Content Panel (Mockup 8) */}
        <main className="lg:col-span-9 space-y-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Welcome Card & Stats */}
              <div className="bg-[#FAF6F0] border border-[#30251F]/10 rounded-3xl p-6 sm:p-8 space-y-6 shadow-soft-sm">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-display font-bold text-[#30251F]">
                    Welcome back, {brand.name}! 👋
                  </h1>
                  <p className="text-xs sm:text-sm text-[#685950] mt-1">
                    Here's how your creations are doing on Rijlo.
                  </p>
                </div>

                {/* Real Stats Cards (Strictly omit Profile Views per Anti-guessing rule) */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-2xl p-5 border border-[#30251F]/10 text-center shadow-xs">
                    <p className="text-3xl font-display font-bold text-[#30251F]">{products.length}</p>
                    <p className="text-xs text-[#685950] mt-1 font-medium">Products</p>
                  </div>
                  <div className="bg-white rounded-2xl p-5 border border-[#30251F]/10 text-center shadow-xs">
                    <p className="text-3xl font-display font-bold text-[#9E4A2B]">{totalSaves}</p>
                    <p className="text-xs text-[#685950] mt-1 font-medium">Saves (Leads)</p>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="pt-2 border-t border-[#30251F]/10 space-y-2">
                  <p className="text-xs font-bold text-[#30251F] uppercase tracking-wider">Quick Actions</p>
                  <div className="flex flex-wrap items-center gap-3">
                    <a
                      href="/seller/upload"
                      className="inline-flex items-center gap-1.5 px-6 py-3 rounded-full bg-[#9E4A2B] hover:bg-[#843C22] text-[#FAF6F0] text-xs font-semibold shadow-xs transition-colors"
                    >
                      <span>Add New Product</span>
                      <Plus className="w-3.5 h-3.5" />
                    </a>
                    <button
                      type="button"
                      onClick={() => setActiveTab('settings')}
                      className="px-6 py-3 rounded-full border border-[#30251F]/20 text-xs font-semibold text-[#30251F] hover:bg-[#EBE3D7] transition-colors cursor-pointer"
                    >
                      Edit Profile
                    </button>
                  </div>
                </div>
              </div>

              {/* Recent Products Row */}
              <div className="bg-[#FAF6F0] border border-[#30251F]/10 rounded-3xl p-6 sm:p-8 space-y-4 shadow-soft-sm">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-display font-bold text-[#30251F]">Recent Products</h2>
                  <button
                    type="button"
                    onClick={() => setActiveTab('products')}
                    className="text-xs text-[#9E4A2B] hover:underline font-semibold cursor-pointer"
                  >
                    View All &rarr;
                  </button>
                </div>

                {recentProducts.length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-2xl border border-[#30251F]/10 space-y-2">
                    <ShoppingBag className="w-8 h-8 text-[#685950] mx-auto opacity-50" />
                    <p className="text-xs font-medium text-[#30251F]">No creations listed yet</p>
                    <a
                      href="/seller/upload"
                      className="inline-block text-xs font-semibold text-[#9E4A2B] hover:underline"
                    >
                      Upload your first product &rarr;
                    </a>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                    {recentProducts.map((p) => (
                      <div
                        key={p.id}
                        className="bg-white rounded-2xl overflow-hidden border border-[#30251F]/10 p-3 space-y-2 shadow-xs"
                      >
                        <div className="aspect-square bg-[#EFE9DF] rounded-xl overflow-hidden relative">
                          <img
                            src={p.thumbnail_url || 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800'}
                            alt={p.name}
                            className="w-full h-full object-cover"
                          />
                          <span
                            className={`absolute top-2 right-2 text-[9px] px-2 py-0.5 rounded-full font-bold ${
                              p.approval_status === 'Approved'
                                ? 'bg-[#637B58] text-white'
                                : p.approval_status === 'Pending'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {p.approval_status}
                          </span>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[#30251F] truncate">{p.name}</p>
                          <p className="text-xs text-[#9E4A2B] font-semibold">₹{p.price}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: MY PRODUCTS */}
          {activeTab === 'products' && (
            <div className="bg-[#FAF6F0] border border-[#30251F]/10 rounded-3xl p-6 sm:p-8 space-y-6 shadow-soft-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-display font-bold text-[#30251F]">My Creations</h2>
                  <p className="text-xs text-[#685950] mt-0.5">Manage your catalog items, pricing, and availability.</p>
                </div>
                <a
                  href="/seller/upload"
                  className="px-5 py-2.5 rounded-full bg-[#9E4A2B] hover:bg-[#843C22] text-[#FAF6F0] text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Product</span>
                </a>
              </div>

              {products.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-[#30251F]/10 space-y-3">
                  <p className="text-sm font-bold text-[#30251F]">Your catalog is empty</p>
                  <p className="text-xs text-[#685950] max-w-sm mx-auto">
                    Publish your handmade items so buyers can discover them and reach out directly.
                  </p>
                  <a
                    href="/seller/upload"
                    className="inline-block px-5 py-2.5 rounded-full bg-[#9E4A2B] text-white text-xs font-semibold"
                  >
                    + Add First Product
                  </a>
                </div>
              ) : (
                <div className="divide-y divide-[#30251F]/10 bg-white rounded-2xl border border-[#30251F]/10 overflow-hidden">
                  {products.map((p) => (
                    <div key={p.id} className="p-4 flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <img
                          src={p.thumbnail_url || 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800'}
                          alt={p.name}
                          className="w-14 h-14 rounded-xl object-cover border border-[#30251F]/10 flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-bold text-[#30251F] truncate">{p.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-[#9E4A2B] font-semibold">₹{p.price}</span>
                            <span className="text-[10px] text-[#685950]">Stock: {p.stock}</span>
                            <span
                              className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                                p.approval_status === 'Approved'
                                  ? 'bg-[#637B58]/20 text-[#637B58]'
                                  : p.approval_status === 'Pending'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {p.approval_status}
                            </span>
                          </div>
                          {p.rejection_feedback && (
                            <p className="text-[11px] text-red-700 mt-1 italic">
                              Feedback: {p.rejection_feedback}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <a
                          href={`/seller/upload?edit=${p.id}`}
                          className="p-2 rounded-xl border border-[#30251F]/15 hover:bg-[#EBE3D7] text-[#30251F] transition-colors"
                          title="Edit creation"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </a>
                        <button
                          type="button"
                          onClick={() => handleDeleteProduct(p.id, p.name)}
                          className="p-2 rounded-xl border border-red-200 hover:bg-red-50 text-red-700 transition-colors cursor-pointer"
                          title="Delete creation"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: LEADS (SAVES) */}
          {activeTab === 'leads' && (
            <div className="bg-[#FAF6F0] border border-[#30251F]/10 rounded-3xl p-6 sm:p-8 space-y-6 shadow-soft-sm">
              <div>
                <h2 className="text-xl font-display font-bold text-[#30251F]">Buyer Leads (Saved Items)</h2>
                <p className="text-xs text-[#685950] mt-0.5">
                  Items buyers have saved to their Lead Cart. Every save is high-intent interest before contacting you on Instagram or WhatsApp.
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-[#30251F]/10 overflow-hidden divide-y divide-[#30251F]/10">
                {products.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[#685950]">No products listed.</div>
                ) : (
                  products.map((p) => {
                    const count = saveCounts[p.id] || 0;
                    return (
                      <div key={p.id} className="p-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={p.thumbnail_url || 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800'}
                            alt={p.name}
                            className="w-12 h-12 rounded-xl object-cover border border-[#30251F]/10"
                          />
                          <div>
                            <p className="text-xs font-bold text-[#30251F]">{p.name}</p>
                            <p className="text-[11px] text-[#9E4A2B] font-semibold">₹{p.price}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold text-[#30251F]">{count}</span>
                          <span className="text-[10px] text-[#685950] block">Saves</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 4: PROFILE & CONTACT SETTINGS */}
          {activeTab === 'settings' && (
            <form onSubmit={handleSaveSettings} className="space-y-6">
              {settingsError && (
                <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-800 font-medium">
                  {settingsError}
                </div>
              )}

              {/* Brand Store Identity Card */}
              <div className="bg-[#FAF6F0] border border-[#30251F]/10 rounded-3xl p-6 sm:p-8 space-y-5 shadow-soft-sm">
                <h2 className="text-lg font-display font-bold text-[#30251F]">Store Profile Information</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#30251F] mb-1.5">Store Name</label>
                    <input
                      type="text"
                      required
                      value={settingsName}
                      onChange={(e) => setSettingsName(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl bg-white border border-[#30251F]/15 text-xs text-[#30251F] focus:outline-none focus:ring-2 focus:ring-[#9E4A2B]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#30251F] mb-1.5">Store Handle (Slug)</label>
                    <input
                      type="text"
                      disabled
                      value={`@${settingsSlug}`}
                      className="w-full px-4 py-3 rounded-2xl bg-[#EFE9DF] border border-[#30251F]/15 text-xs text-[#685950] font-mono cursor-not-allowed"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#30251F] mb-1.5">Tagline</label>
                  <input
                    type="text"
                    value={settingsTagline}
                    onChange={(e) => setSettingsTagline(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-white border border-[#30251F]/15 text-xs text-[#30251F] focus:outline-none focus:ring-2 focus:ring-[#9E4A2B]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#30251F] mb-1.5">Bio</label>
                  <textarea
                    rows={3}
                    value={settingsBio}
                    onChange={(e) => setSettingsBio(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-white border border-[#30251F]/15 text-xs text-[#30251F] focus:outline-none focus:ring-2 focus:ring-[#9E4A2B]"
                  />
                </div>

                {/* Logo & Banner uploads */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-[#30251F] mb-1.5">Store Logo</label>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-[#EFE9DF] overflow-hidden border border-[#30251F]/15 flex items-center justify-center flex-shrink-0">
                        {settingsLogoUrl ? (
                          <img src={settingsLogoUrl} alt="Store logo" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-lg">🌸</span>
                        )}
                      </div>
                      <label className="cursor-pointer px-3.5 py-2 rounded-xl bg-white border border-[#30251F]/20 text-xs font-medium text-[#30251F] hover:bg-[#EBE3D7] transition-colors">
                        <span>{uploadingLogo ? 'Uploading...' : 'Replace Logo'}</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'logo', 'settings')}
                        />
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#30251F] mb-1.5">Store Banner</label>
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-12 rounded-xl bg-[#EFE9DF] overflow-hidden border border-[#30251F]/15 flex items-center justify-center flex-shrink-0">
                        {settingsBannerUrl ? (
                          <img src={settingsBannerUrl} alt="Store banner" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[10px] text-[#685950]">No Banner</span>
                        )}
                      </div>
                      <label className="cursor-pointer px-3.5 py-2 rounded-xl bg-white border border-[#30251F]/20 text-xs font-medium text-[#30251F] hover:bg-[#EBE3D7] transition-colors">
                        <span>{uploadingBanner ? 'Uploading...' : 'Replace Banner'}</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'banner', 'settings')}
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#30251F] mb-1.5">Instagram Profile</label>
                  <input
                    type="text"
                    required
                    value={settingsIgUrl}
                    onChange={(e) => setSettingsIgUrl(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-white border border-[#30251F]/15 text-xs text-[#30251F] focus:outline-none focus:ring-2 focus:ring-[#9E4A2B]"
                  />
                </div>
              </div>

              {/* Contact Settings Card */}
              <div className="bg-[#FAF6F0] border border-[#30251F]/10 rounded-3xl p-6 sm:p-8 space-y-5 shadow-soft-sm">
                <h2 className="text-lg font-display font-bold text-[#30251F]">Direct Inquiry & Chat Routing</h2>

                <div>
                  <label className="block text-xs font-semibold text-[#30251F] mb-1.5">Contact Method</label>
                  <div className="grid grid-cols-3 gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSettingsContactType('instagram');
                        if (!settingsLinkTemplate || settingsLinkTemplate.includes('wa.me')) {
                          setSettingsLinkTemplate(`https://ig.me/m/${brand.slug}`);
                        }
                      }}
                      className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                        settingsContactType === 'instagram'
                          ? 'border-[#9E4A2B] bg-[#9E4A2B]/10 text-[#9E4A2B] font-bold'
                          : 'border-[#30251F]/15 bg-white text-[#685950]'
                      }`}
                    >
                      <span className="block text-sm">📸 Instagram DM</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSettingsContactType('whatsapp');
                        if (!settingsLinkTemplate || settingsLinkTemplate.includes('ig.me')) {
                          setSettingsLinkTemplate('https://wa.me/919876543210?text={message}');
                        }
                      }}
                      className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                        settingsContactType === 'whatsapp'
                          ? 'border-[#9E4A2B] bg-[#9E4A2B]/10 text-[#9E4A2B] font-bold'
                          : 'border-[#30251F]/15 bg-white text-[#685950]'
                      }`}
                    >
                      <span className="block text-sm">💬 WhatsApp</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettingsContactType('custom')}
                      className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                        settingsContactType === 'custom'
                          ? 'border-[#9E4A2B] bg-[#9E4A2B]/10 text-[#9E4A2B] font-bold'
                          : 'border-[#30251F]/15 bg-white text-[#685950]'
                      }`}
                    >
                      <span className="block text-sm">🔗 Custom Chat</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#30251F] mb-1.5">Link Template</label>
                  <input
                    type="text"
                    required
                    value={settingsLinkTemplate}
                    onChange={(e) => setSettingsLinkTemplate(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-white border border-[#30251F]/15 text-xs text-[#30251F] font-mono focus:outline-none focus:ring-2 focus:ring-[#9E4A2B]"
                  />
                  <p className="text-[11px] text-[#685950] mt-1">
                    Allowed hosts: <code className="text-[#9E4A2B]">{ALLOWED_CONTACT_HOSTS.join(', ')}</code>
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#30251F] mb-1.5">Message Template</label>
                  <textarea
                    rows={2}
                    value={settingsMessageTemplate}
                    onChange={(e) => setSettingsMessageTemplate(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-white border border-[#30251F]/15 text-xs text-[#30251F] focus:outline-none focus:ring-2 focus:ring-[#9E4A2B]"
                  />
                  <p className="text-[11px] text-[#685950] mt-1">
                    Placeholders: <code className="text-[#9E4A2B]">{'{product_name}'}</code>, <code className="text-[#9E4A2B]">{'{product_url}'}</code>, <code className="text-[#9E4A2B]">{'{price}'}</code>
                  </p>
                </div>

                {/* Live Preview Box & Test Link */}
                {(() => {
                  const testResolved = resolveContact({
                    product: { id: 'test', name: DEFAULT_SAMPLE_PRODUCT.name, price: DEFAULT_SAMPLE_PRODUCT.price },
                    brandContact: {
                      contact_type: settingsContactType,
                      link_template: settingsLinkTemplate,
                      message_template: settingsMessageTemplate,
                    },
                    brand: { name: settingsName, instagram_url: settingsIgUrl },
                  });
                  const safeTestUrl = sanitizeContactUrl(testResolved?.url);

                  return (
                    <div className="bg-[#EFE9DF] rounded-2xl p-4 border border-[#30251F]/10 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-[#30251F]">Live Link Preview</p>
                        {safeTestUrl && (
                          <a
                            href={safeTestUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1 rounded-full bg-[#9E4A2B] text-[#FAF6F0] text-[11px] font-semibold hover:bg-[#843C22] transition-colors inline-flex items-center gap-1"
                          >
                            <span>Test Link</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-[#30251F]/10 text-xs font-mono break-all text-[#30251F]">
                        {testResolved?.url || 'No link generated'}
                      </div>
                    </div>
                  );
                })()}

                <div className="pt-4 border-t border-[#30251F]/10 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="px-8 py-3 rounded-full bg-[#9E4A2B] hover:bg-[#843C22] text-[#FAF6F0] text-xs font-semibold transition-all shadow-sm cursor-pointer inline-flex items-center gap-2"
                  >
                    {savingSettings && <RefreshCw className="w-4 h-4 animate-spin" />}
                    <span>{savingSettings ? 'Saving Settings...' : 'Save All Settings'}</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* TAB 5: HELP & SUPPORT */}
          {activeTab === 'support' && (
            <div className="bg-[#FAF6F0] border border-[#30251F]/10 rounded-3xl p-6 sm:p-8 space-y-6 shadow-soft-sm">
              <div>
                <h2 className="text-xl font-display font-bold text-[#30251F]">Help & Support</h2>
                <p className="text-xs text-[#685950] mt-0.5">
                  Frequently asked questions for creators and contact details for our support team.
                </p>
              </div>

              <div className="space-y-4">
                <div className="bg-white p-5 rounded-2xl border border-[#30251F]/10 space-y-1.5">
                  <h3 className="text-xs font-bold text-[#30251F]">How does Rijlo work for creators?</h3>
                  <p className="text-xs text-[#685950] leading-relaxed">
                    Rijlo is an Instagram-creator discovery catalog. We do not process payments on our servers or take sales commissions. When a buyer discovers your creation and clicks "Contact", they are routed directly to your configured Instagram DM or WhatsApp chat with a prefilled inquiry message about that exact item.
                  </p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-[#30251F]/10 space-y-1.5">
                  <h3 className="text-xs font-bold text-[#30251F]">Are there any listing fees or transaction commissions?</h3>
                  <p className="text-xs text-[#685950] leading-relaxed">
                    None! Rijlo charges 0% transaction commission. You negotiate, finalize, and collect payments directly through your own preferred payment methods (UPI, bank transfer, etc.).
                  </p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-[#30251F]/10 space-y-1.5">
                  <h3 className="text-xs font-bold text-[#30251F]">How long does product moderation take?</h3>
                  <p className="text-xs text-[#685950] leading-relaxed">
                    Our curation desk reviews new creations and brand updates within 24 hours. Once approved, creations instantly appear on the Rijlo catalog and your Brand Store storefront.
                  </p>
                </div>
              </div>

              {/* Support Contact Desk */}
              <div className="bg-[#EFE9DF] p-6 rounded-2xl border border-[#30251F]/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-[#30251F]">Need Direct Support?</h3>
                  <p className="text-xs text-[#685950] mt-0.5">
                    Our creator editorial team is available to assist you.
                  </p>
                </div>
                <a
                  href="mailto:sumitkatiyar783@gmail.com"
                  className="px-6 py-2.5 rounded-full bg-[#9E4A2B] hover:bg-[#843C22] text-[#FAF6F0] text-xs font-semibold shadow-xs transition-colors inline-flex items-center gap-2 flex-shrink-0"
                >
                  <span>Email Creator Support</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default SellerDashboard;
