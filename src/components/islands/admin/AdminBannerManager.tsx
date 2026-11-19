import React, { useState, useEffect, useRef } from 'react';
import {
  listAllBanners,
  uploadBanner,
  updateBanner,
  reorderBanners,
  deleteBanner,
  HOME_LIMITS,
  type HomeBanner,
  type BannerButtonConfig,
  type BannerButtonShape,
  type BannerFontWeight,
  type BannerButtonResponsiveConfig,
} from '../../../lib/home';
import { resizeToWebp } from '../../../lib/imageResize';
import { supabase } from '../../../lib/supabase';
import {
  Upload,
  Image as ImageIcon,
  Trash2,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Smartphone,
  Tablet,
  Monitor,
  AlertCircle,
  Plus,
  Sparkles,
  Copy,
  Sliders,
  Move,
  Layers,
  Save,
  Palette,
} from 'lucide-react';

interface AdminBannerManagerProps {
  onNotify: (message: string, isError?: boolean) => void;
}

const BRAND_PALETTE = [
  { name: 'Terracotta', hex: '#9E4A2B' },
  { name: 'Terracotta Soft', hex: '#B87555' },
  { name: 'Espresso', hex: '#30251F' },
  { name: 'Ivory', hex: '#FAF6F0' },
  { name: 'Clay', hex: '#D9A37B' },
  { name: 'Sage', hex: '#637B58' },
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Black', hex: '#000000' },
];

function createDefaultButton(): BannerButtonConfig {
  const btnId = `btn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  return {
    id: btnId,
    text: 'Shop Now',
    url: '/catalog',
    is_visible: true,
    open_in_new_tab: false,
    style: {
      background: '#9E4A2B',
      color: '#FAF6F0',
      borderColor: 'transparent',
      borderWidth: 0,
      shape: 'rounded',
      size: 'medium',
      fontWeight: '600',
    },
    responsive: {
      desktop: {
        x: 22,
        y: 72,
        width: 170,
        height: 48,
        fontSize: 15,
      },
      tablet: {
        x: 25,
        y: 72,
        width: 150,
        height: 42,
        fontSize: 14,
      },
      mobile: {
        x: 50,
        y: 78,
        width: 135,
        height: 38,
        fontSize: 12,
      },
    },
  };
}

export const AdminBannerManager: React.FC<AdminBannerManagerProps> = ({ onNotify }) => {
  const [banners, setBanners] = useState<HomeBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Selected banner
  const [selectedBannerId, setSelectedBannerId] = useState<string | null>(null);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [responsiveConfigTab, setResponsiveConfigTab] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  // Currently selected button for editing and dragging
  const [selectedButtonId, setSelectedButtonId] = useState<string | null>(null);
  const [isDraggingOnCanvas, setIsDraggingOnCanvas] = useState(false);

  // New banner creation modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDesktopFile, setNewDesktopFile] = useState<File | null>(null);
  const [newTabletFile, setNewTabletFile] = useState<File | null>(null);
  const [newMobileFile, setNewMobileFile] = useState<File | null>(null);
  const [newAltText, setNewAltText] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newSubtitle, setNewSubtitle] = useState('');
  const [newFormError, setNewFormError] = useState<string | null>(null);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewCanvasRef = useRef<HTMLDivElement>(null);
  const dragStartInfo = useRef<{
    startX: number;
    startY: number;
    origBtnX: number;
    origBtnY: number;
  } | null>(null);

  const fetchBanners = async () => {
    setLoading(true);
    const { data, error } = await listAllBanners();
    if (error) {
      onNotify(`Error loading banners: ${error}`, true);
    } else {
      setBanners(data);
      if (data.length > 0 && !selectedBannerId) {
        setSelectedBannerId(data[0].id);
        const firstButtons = data[0].buttons || [];
        if (firstButtons.length > 0) {
          setSelectedButtonId(firstButtons[0].id);
        }
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchBanners();
  }, []);

  const activeBanner = banners.find((b) => b.id === selectedBannerId) || banners[0] || null;
  const currentButtons = activeBanner?.buttons || [];
  const selectedButton = currentButtons.find((btn) => btn.id === selectedButtonId) || currentButtons[0] || null;

  // Sync responsive config tab when preview device changes so editing is seamless
  const handleSelectPreviewDevice = (device: 'desktop' | 'tablet' | 'mobile') => {
    setPreviewDevice(device);
    setResponsiveConfigTab(device);
  };

  // --------------------------------------------------------------------------
  // Button Management Actions
  // --------------------------------------------------------------------------

  const updateActiveBannerButtons = (newButtons: BannerButtonConfig[]) => {
    if (!activeBanner) return;
    setBanners((prev) =>
      prev.map((b) => (b.id === activeBanner.id ? { ...b, buttons: newButtons } : b))
    );
  };

  const handleAddButton = () => {
    if (!activeBanner) return;
    const newBtn = createDefaultButton();
    // Offset slightly if other buttons already exist
    if (currentButtons.length > 0) {
      newBtn.responsive.desktop.x = Math.min(85, newBtn.responsive.desktop.x + currentButtons.length * 15);
      newBtn.responsive.tablet.x = Math.min(85, newBtn.responsive.tablet.x + currentButtons.length * 15);
      newBtn.responsive.mobile.y = Math.min(90, newBtn.responsive.mobile.y + currentButtons.length * 6);
    }
    const updated = [...currentButtons, newBtn];
    updateActiveBannerButtons(updated);
    setSelectedButtonId(newBtn.id);
    onNotify('New button added. Drag it in the preview or configure below.');
  };

  const handleDuplicateButton = (btnId: string) => {
    const target = currentButtons.find((b) => b.id === btnId);
    if (!target) return;
    const duplicated: BannerButtonConfig = {
      ...JSON.parse(JSON.stringify(target)),
      id: `btn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      text: `${target.text} (Copy)`,
      responsive: {
        desktop: { ...target.responsive.desktop, x: Math.min(95, target.responsive.desktop.x + 4), y: Math.min(95, target.responsive.desktop.y + 4) },
        tablet: { ...target.responsive.tablet, x: Math.min(95, target.responsive.tablet.x + 4), y: Math.min(95, target.responsive.tablet.y + 4) },
        mobile: { ...target.responsive.mobile, x: Math.min(95, target.responsive.mobile.x + 4), y: Math.min(95, target.responsive.mobile.y + 4) },
      },
    };
    const updated = [...currentButtons, duplicated];
    updateActiveBannerButtons(updated);
    setSelectedButtonId(duplicated.id);
    onNotify('Button duplicated.');
  };

  const handleDeleteButton = (btnId: string) => {
    const target = currentButtons.find((b) => b.id === btnId);
    if (!target) return;
    if (!window.confirm(`Delete button "${target.text}"?`)) return;

    const updated = currentButtons.filter((b) => b.id !== btnId);
    updateActiveBannerButtons(updated);
    if (selectedButtonId === btnId) {
      setSelectedButtonId(updated[0]?.id || null);
    }
    onNotify('Button removed.');
  };

  const handleToggleBtnVisibility = (btnId: string) => {
    const updated = currentButtons.map((b) =>
      b.id === btnId ? { ...b, is_visible: !b.is_visible } : b
    );
    updateActiveBannerButtons(updated);
  };

  const handleReorderButton = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentButtons.length) return;
    const updated = [...currentButtons];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    updateActiveBannerButtons(updated);
  };

  const handlePatchSelectedButton = (patch: Partial<BannerButtonConfig>) => {
    if (!selectedButton) return;
    const updated = currentButtons.map((b) =>
      b.id === selectedButton.id ? { ...b, ...patch } : b
    );
    updateActiveBannerButtons(updated);
  };

  const handlePatchButtonResponsive = (
    screen: 'desktop' | 'tablet' | 'mobile',
    patch: Partial<BannerButtonResponsiveConfig>
  ) => {
    if (!selectedButton) return;
    const updated = currentButtons.map((b) => {
      if (b.id !== selectedButton.id) return b;
      return {
        ...b,
        responsive: {
          ...b.responsive,
          [screen]: {
            ...b.responsive[screen],
            ...patch,
          },
        },
      };
    });
    updateActiveBannerButtons(updated);
  };

  // --------------------------------------------------------------------------
  // Drag-and-Drop Button Positioning in Live Preview
  // --------------------------------------------------------------------------

  const handleButtonPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    btnId: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedButtonId(btnId);

    const btn = currentButtons.find((b) => b.id === btnId);
    if (!btn) return;

    const currentCoords = btn.responsive[previewDevice];
    dragStartInfo.current = {
      startX: e.clientX,
      startY: e.clientY,
      origBtnX: currentCoords.x,
      origBtnY: currentCoords.y,
    };

    setIsDraggingOnCanvas(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleButtonPointerMove = (
    e: React.PointerEvent<HTMLDivElement>,
    _btnId: string
  ) => {
    if (!isDraggingOnCanvas || !dragStartInfo.current || !previewCanvasRef.current) return;
    e.preventDefault();

    const rect = previewCanvasRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const deltaX = e.clientX - dragStartInfo.current.startX;
    const deltaY = e.clientY - dragStartInfo.current.startY;

    const deltaXPercent = (deltaX / rect.width) * 100;
    const deltaYPercent = (deltaY / rect.height) * 100;

    const rawNewX = dragStartInfo.current.origBtnX + deltaXPercent;
    const rawNewY = dragStartInfo.current.origBtnY + deltaYPercent;

    // Clamp within 0% to 100% bounds
    const clampedX = Math.max(2, Math.min(98, Math.round(rawNewX * 10) / 10));
    const clampedY = Math.max(5, Math.min(95, Math.round(rawNewY * 10) / 10));

    handlePatchButtonResponsive(previewDevice, { x: clampedX, y: clampedY });
  };

  const handleButtonPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingOnCanvas) {
      setIsDraggingOnCanvas(false);
      dragStartInfo.current = null;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Safe fallback if capture already ended
      }
    }
  };

  // --------------------------------------------------------------------------
  // Image Replacement / Upload Handlers
  // --------------------------------------------------------------------------

  const handleUploadDeviceImage = async (
    device: 'desktop' | 'tablet' | 'mobile',
    file: File
  ) => {
    if (!activeBanner || !supabase) return;
    try {
      onNotify(`Resizing & uploading ${device} image...`);
      const maxWidth = device === 'desktop' ? 1920 : device === 'tablet' ? 1280 : 828;
      const resizedBlob = await resizeToWebp(file, maxWidth, 0.75);

      const pathSuffix = device === 'desktop' ? '' : `-${device}`;
      const path = `banners/${activeBanner.id}${pathSuffix}.webp`;

      const { error: uploadError } = await supabase.storage
        .from('site-assets')
        .upload(path, resizedBlob, {
          contentType: 'image/webp',
          cacheControl: '31536000',
          upsert: true,
        });

      if (uploadError) {
        onNotify(`Failed to upload ${device} image: ${uploadError.message}`, true);
        return;
      }

      const { data: urlData } = supabase.storage.from('site-assets').getPublicUrl(path);
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const patch: Partial<HomeBanner> =
        device === 'desktop'
          ? { image_path: path, image_url: publicUrl }
          : device === 'tablet'
          ? { tablet_image_path: path, tablet_image_url: publicUrl }
          : { mobile_image_path: path, mobile_image_url: publicUrl };

      setBanners((prev) =>
        prev.map((b) => (b.id === activeBanner.id ? { ...b, ...patch } : b))
      );

      const { error: updateError } = await updateBanner(activeBanner.id, patch);
      if (updateError) {
        onNotify(`Database update error: ${updateError}`, true);
      } else {
        onNotify(`${device.charAt(0).toUpperCase() + device.slice(1)} image updated successfully!`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      onNotify(`Error: ${msg}`, true);
    }
  };

  const handleRemoveDeviceImage = async (device: 'tablet' | 'mobile') => {
    if (!activeBanner || !supabase) return;
    const confirmMsg = `Remove dedicated ${device} image? The banner will automatically fall back to the desktop image.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const path = device === 'tablet' ? activeBanner.tablet_image_path : activeBanner.mobile_image_path;
      if (path) {
        await supabase.storage.from('site-assets').remove([path]);
      }

      const patch: Partial<HomeBanner> =
        device === 'tablet'
          ? { tablet_image_path: null, tablet_image_url: null }
          : { mobile_image_path: null, mobile_image_url: null };

      setBanners((prev) =>
        prev.map((b) => (b.id === activeBanner.id ? { ...b, ...patch } : b))
      );

      await updateBanner(activeBanner.id, patch);
      onNotify(`${device.charAt(0).toUpperCase() + device.slice(1)} image removed. Falling back to desktop.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error removing image';
      onNotify(`Error: ${msg}`, true);
    }
  };

  // --------------------------------------------------------------------------
  // Save Banner Changes to Database
  // --------------------------------------------------------------------------

  const handleSaveBanner = async () => {
    if (!activeBanner) return;
    setSaving(true);
    try {
      const { data, error } = await updateBanner(activeBanner.id, {
        buttons: activeBanner.buttons || [],
        alt_text: activeBanner.alt_text,
        link_url: activeBanner.link_url,
        title: activeBanner.title,
        subtitle: activeBanner.subtitle,
        cta_label: activeBanner.cta_label,
        cta_link: activeBanner.cta_link,
        text_theme: activeBanner.text_theme,
        is_active: activeBanner.is_active,
      });

      if (error) {
        onNotify(`Error saving banner: ${error}`, true);
      } else {
        onNotify('Banner configuration & buttons saved and published live!');
        if (data) {
          setBanners((prev) => prev.map((b) => (b.id === data.id ? data : b)));
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save error';
      onNotify(`Error: ${msg}`, true);
    } finally {
      setSaving(false);
    }
  };

  // --------------------------------------------------------------------------
  // Create New Banner Modal Form Handler
  // --------------------------------------------------------------------------

  const handleCreateNewBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDesktopFile) {
      setNewFormError('Desktop image is required.');
      return;
    }
    if (!newAltText.trim()) {
      setNewFormError('Alt text is required for accessibility.');
      return;
    }

    if (banners.length >= HOME_LIMITS.banners) {
      onNotify(`Maximum of ${HOME_LIMITS.banners} banners reached. Delete an existing banner first.`, true);
      return;
    }

    setUploading(true);
    setNewFormError(null);

    try {
      const defaultButton = createDefaultButton();
      const { data: newBanner, error } = await uploadBanner(newDesktopFile, {
        altText: newAltText.trim(),
        tabletFile: newTabletFile,
        mobileFile: newMobileFile,
        buttons: [defaultButton],
        title: newTitle.trim() || null,
        subtitle: newSubtitle.trim() || null,
        textTheme: 'dark',
      });

      if (error) {
        setNewFormError(error);
        onNotify(`Failed to create banner: ${error}`, true);
      } else if (newBanner) {
        setBanners((prev) => [...prev, newBanner]);
        setSelectedBannerId(newBanner.id);
        setSelectedButtonId(newBanner.buttons?.[0]?.id || null);
        setShowAddModal(false);
        setNewDesktopFile(null);
        setNewTabletFile(null);
        setNewMobileFile(null);
        setNewAltText('');
        setNewTitle('');
        setNewSubtitle('');
        onNotify('Banner created with default responsive button! You can customize and drag it below.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload error';
      setNewFormError(msg);
      onNotify(`Error: ${msg}`, true);
    } finally {
      setUploading(false);
    }
  };

  // Quick drag & drop or batch upload
  const validateAndUploadFiles = async (files: FileList | File[]) => {
    const fileList = Array.from(files);
    if (fileList.length === 0) return;

    if (banners.length >= HOME_LIMITS.banners) {
      onNotify('Maximum of 8 banners reached. Delete an existing banner to add a new one.', true);
      return;
    }

    const allowedMime = ['image/jpeg', 'image/png', 'image/webp'];
    for (const file of fileList) {
      if (!allowedMime.includes(file.type)) {
        onNotify('Invalid format. Only JPEG, PNG, and WebP are allowed.', true);
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        onNotify('File size exceeds 5 MB limit.', true);
        return;
      }
    }

    const availableSlots = HOME_LIMITS.banners - banners.length;
    const filesToProcess = fileList.slice(0, availableSlots);

    setUploading(true);
    for (const file of filesToProcess) {
      try {
        const defaultButton = createDefaultButton();
        const { data: newBanner, error } = await uploadBanner(file, {
          altText: file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
          buttons: [defaultButton],
        });
        if (error) {
          onNotify(`Upload error for ${file.name}: ${error}`, true);
        } else if (newBanner) {
          setBanners((prev) => [...prev, newBanner]);
          setSelectedBannerId(newBanner.id);
          onNotify(`Banner "${file.name}" uploaded with default CTA button.`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Upload failed';
        onNotify(`Error: ${msg}`, true);
      }
    }
    setUploading(false);
  };

  // Banner reordering & deleting
  const handleReorderBanner = async (currentIndex: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= banners.length) return;

    const updated = [...banners];
    const [moved] = updated.splice(currentIndex, 1);
    updated.splice(targetIndex, 0, moved);

    const reordered = updated.map((b, idx) => ({ ...b, position: idx }));
    setBanners(reordered);

    const orderedIds = reordered.map((b) => b.id);
    await reorderBanners(orderedIds);
    onNotify('Banner order updated.');
  };

  const handleDeleteBanner = async (banner: HomeBanner) => {
    if (!window.confirm(`Delete banner "${banner.title || banner.alt_text || 'Banner'}" permanently?`)) return;
    setBanners((prev) => prev.filter((b) => b.id !== banner.id));
    await deleteBanner(banner.id);
    onNotify('Banner deleted.');
    if (selectedBannerId === banner.id) {
      setSelectedBannerId(banners.find((b) => b.id !== banner.id)?.id || null);
    }
  };

  const handleToggleActiveBanner = async (banner: HomeBanner) => {
    const newActive = !banner.is_active;
    setBanners((prev) =>
      prev.map((b) => (b.id === banner.id ? { ...b, is_active: newActive } : b))
    );
    await updateBanner(banner.id, { is_active: newActive });
    onNotify(newActive ? 'Banner activated live.' : 'Banner hidden from shoppers.');
  };

  // Active preview image source
  const previewImageSrc =
    activeBanner
      ? previewDevice === 'mobile'
        ? activeBanner.mobile_image_url || activeBanner.tablet_image_url || activeBanner.image_url
        : previewDevice === 'tablet'
        ? activeBanner.tablet_image_url || activeBanner.image_url
        : activeBanner.image_url
      : '';

  return (
    <div className="space-y-8">
      {/* 1. Top Section: Header & Global Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-ivory-100 border border-espresso-900/10 rounded-2xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg font-display font-bold text-espresso-900">
              Hero Banner Slider — Responsive Dynamic Banner Builder
            </h2>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                banners.length >= HOME_LIMITS.banners
                  ? 'bg-peach-500/15 text-peach-700 border border-peach-500/30'
                  : 'bg-sage/15 text-sage-800 border border-sage/25'
              }`}
            >
              {banners.length} of {HOME_LIMITS.banners} banners
            </span>
          </div>
          <p className="text-xs text-espresso-600 max-w-xl">
            {banners.length >= HOME_LIMITS.banners
              ? 'Maximum of 8 banners reached. Delete an existing banner to add a new one.'
              : 'Create responsive banners with independent Desktop, Tablet & Mobile images and dynamic, drag-and-drop HTML CTA buttons.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            disabled={uploading || banners.length >= HOME_LIMITS.banners}
            className={`btn-primary py-2.5 px-4 text-xs font-semibold inline-flex items-center gap-2 cursor-pointer ${
              banners.length >= HOME_LIMITS.banners ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>New Banner</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) {
                validateAndUploadFiles(e.target.files);
                e.target.value = '';
              }
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || banners.length >= HOME_LIMITS.banners}
            className="btn-secondary py-2.5 px-3.5 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            title="Quick batch upload desktop images"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Quick Upload</span>
          </button>
        </div>
      </div>

      {/* New Banner Modal */}
      {showAddModal && (
        <div className="p-6 bg-ivory-100 border-2 border-terracotta-500/30 rounded-2xl space-y-5 shadow-soft">
          <div className="flex items-center justify-between border-b border-espresso-900/10 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-terracotta-600" />
              <h3 className="font-display font-bold text-sm text-espresso-900">
                Create New Responsive Banner
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="text-espresso-500 hover:text-espresso-900 text-xs cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleCreateNewBanner} className="space-y-4">
            {newFormError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{newFormError}</span>
              </div>
            )}

            {/* 3 Responsive Image Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3.5 bg-ivory-50 border border-espresso-900/15 rounded-xl space-y-1.5">
                <label className="block text-xs font-bold text-espresso-900">
                  Desktop Image <span className="text-red-600">*</span>
                </label>
                <p className="text-[11px] text-espresso-500">2400x800 px recommended</p>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setNewDesktopFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-espresso-800 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-[11px] file:font-semibold file:bg-terracotta-600 file:text-white cursor-pointer"
                />
              </div>

              <div className="p-3.5 bg-ivory-50 border border-espresso-900/15 rounded-xl space-y-1.5">
                <label className="block text-xs font-bold text-espresso-900">
                  Tablet Image <span className="text-espresso-400 font-normal">(Optional)</span>
                </label>
                <p className="text-[11px] text-espresso-500">1600x600 px recommended</p>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setNewTabletFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-espresso-800 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-[11px] file:font-semibold file:bg-espresso-800 file:text-white cursor-pointer"
                />
              </div>

              <div className="p-3.5 bg-ivory-50 border border-espresso-900/15 rounded-xl space-y-1.5">
                <label className="block text-xs font-bold text-espresso-900">
                  Mobile Image <span className="text-espresso-400 font-normal">(Optional)</span>
                </label>
                <p className="text-[11px] text-espresso-500">1200x600 px recommended</p>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setNewMobileFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-espresso-800 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-[11px] file:font-semibold file:bg-espresso-800 file:text-white cursor-pointer"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-espresso-900 mb-1">
                Alt Text <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={newAltText}
                onChange={(e) => setNewAltText(e.target.value)}
                placeholder="e.g. Artisanal ceramics, hand-painted mugs and home sanctuary decor"
                maxLength={160}
                className="w-full px-3 py-2 text-xs bg-ivory-50 border border-espresso-900/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9E4A2B]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-espresso-900/10">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="btn-secondary py-1.5 px-3.5 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={uploading}
                className="btn-primary py-1.5 px-4 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                {uploading ? 'Processing...' : 'Create & Open Builder'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 2. Interactive Live Banner Builder Workspace */}
      {activeBanner ? (
        <div className="space-y-6 p-6 bg-ivory-100 border border-espresso-900/10 rounded-2xl shadow-soft">
          {/* Workspace Top Bar: Banner Picker, Device Viewport Tabs & Save Action */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-espresso-900/10 pb-4">
            <div className="flex items-center gap-3">
              <span className="font-display font-bold text-base text-espresso-900">
                Editing: #{activeBanner.position + 1} {activeBanner.title || activeBanner.alt_text || 'Banner'}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  activeBanner.is_active ? 'bg-sage/15 text-sage-800' : 'bg-espresso-900/10 text-espresso-600'
                }`}
              >
                {activeBanner.is_active ? 'Active' : 'Hidden'}
              </span>
            </div>

            {/* Viewport Selectors: Desktop, Tablet, Mobile */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1 bg-ivory-200 p-1 rounded-xl border border-espresso-900/10 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleSelectPreviewDevice('desktop')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    previewDevice === 'desktop'
                      ? 'bg-ivory-100 text-espresso-900 shadow-xs'
                      : 'text-espresso-600 hover:text-espresso-900'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>Desktop (&ge;1024px)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectPreviewDevice('tablet')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    previewDevice === 'tablet'
                      ? 'bg-ivory-100 text-espresso-900 shadow-xs'
                      : 'text-espresso-600 hover:text-espresso-900'
                  }`}
                >
                  <Tablet className="w-3.5 h-3.5" />
                  <span>Tablet (768px)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectPreviewDevice('mobile')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    previewDevice === 'mobile'
                      ? 'bg-ivory-100 text-espresso-900 shadow-xs'
                      : 'text-espresso-600 hover:text-espresso-900'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Mobile (375px)</span>
                </button>
              </div>

              {/* Save & Publish Changes Button */}
              <button
                type="button"
                onClick={handleSaveBanner}
                disabled={saving}
                className="btn-primary py-2 px-4 text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? 'Publishing...' : 'Save & Publish'}</span>
              </button>
            </div>
          </div>

          {/* Interactive Live Banner Canvas */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-espresso-600 px-1">
              <span className="flex items-center gap-1.5 font-medium">
                <Move className="w-3.5 h-3.5 text-terracotta-600" />
                <span>
                  <strong>Interactive Canvas ({previewDevice.toUpperCase()}):</strong> Click and drag any button to position it.
                </span>
              </span>
              <span className="text-[11px] text-espresso-500">
                Image shown: {previewDevice === 'mobile' && activeBanner.mobile_image_url ? 'Mobile Asset' : previewDevice === 'tablet' && activeBanner.tablet_image_url ? 'Tablet Asset' : 'Desktop Asset'}
              </span>
            </div>

            <div
              className={`mx-auto transition-all duration-300 relative rounded-2xl overflow-hidden border border-espresso-900/20 shadow-soft bg-[#FAF6F0] ${
                previewDevice === 'mobile'
                  ? 'max-w-full sm:max-w-[375px]'
                  : previewDevice === 'tablet'
                  ? 'max-w-[768px]'
                  : 'max-w-full'
              }`}
            >
              <div
                ref={previewCanvasRef}
                className="relative w-full overflow-hidden select-none"
                style={{ height: 'clamp(200px, 38vw, 440px)' }}
              >
                {/* Banner Background Image */}
                <img
                  src={previewImageSrc}
                  alt={activeBanner.alt_text}
                  className="w-full h-full object-cover select-none pointer-events-none"
                  style={{
                    objectPosition: `${activeBanner.focal_x || 70}% ${activeBanner.focal_y || 50}%`,
                  }}
                />

                {/* Scrims */}
                <div
                  className="absolute inset-0 pointer-events-none opacity-40 bg-gradient-to-t from-black/40 via-transparent to-transparent"
                  aria-hidden="true"
                />

                {/* Render Dynamic CTA Buttons with Drag-and-Drop capability */}
                {currentButtons.map((btn) => {
                  if (!btn.is_visible) return null;
                  const isSelected = btn.id === selectedButtonId;
                  const coords = btn.responsive[previewDevice] || btn.responsive.desktop;

                  const shapeClass =
                    btn.style.shape === 'square'
                      ? 'rounded-none'
                      : btn.style.shape === 'slightly_rounded'
                      ? 'rounded-md'
                      : btn.style.shape === 'rounded'
                      ? 'rounded-xl'
                      : 'rounded-full';

                  const btnStyle: React.CSSProperties = {
                    position: 'absolute',
                    transform: 'translate(-50%, -50%)',
                    left: `${coords.x}%`,
                    top: `${coords.y}%`,
                    width: coords.width && coords.width !== 'auto' ? `${coords.width}px` : 'auto',
                    height: coords.height && coords.height !== 'auto' ? `${coords.height}px` : 'auto',
                    fontSize: `${coords.fontSize || 14}px`,
                    backgroundColor: btn.style.background || '#9E4A2B',
                    color: btn.style.color || '#FAF6F0',
                    borderColor: btn.style.borderColor || 'transparent',
                    borderWidth: `${btn.style.borderWidth ?? 0}px`,
                    borderStyle: btn.style.borderWidth ? 'solid' : 'none',
                    fontWeight: btn.style.fontWeight || '600',
                    paddingLeft: '16px',
                    paddingRight: '16px',
                    paddingTop: '8px',
                    paddingBottom: '8px',
                    cursor: isDraggingOnCanvas && isSelected ? 'grabbing' : 'grab',
                    touchAction: 'none',
                    zIndex: isSelected ? 30 : 20,
                  };

                  return (
                    <div
                      key={btn.id}
                      style={btnStyle}
                      onPointerDown={(e) => handleButtonPointerDown(e, btn.id)}
                      onPointerMove={(e) => handleButtonPointerMove(e, btn.id)}
                      onPointerUp={handleButtonPointerUp}
                      className={`inline-flex items-center justify-center text-center transition-shadow shadow-md select-none group ${shapeClass} ${
                        isSelected
                          ? 'ring-3 ring-terracotta-500 ring-offset-2'
                          : 'hover:ring-2 hover:ring-white/80'
                      }`}
                      title={`Drag to reposition. Current: X=${coords.x}%, Y=${coords.y}%`}
                    >
                      <span>{btn.text}</span>

                      {/* Position badge on active / hover */}
                      <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-espresso-950/90 text-ivory-100 text-[9px] px-1.5 py-0.5 rounded font-mono whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                        X:{coords.x}% Y:{coords.y}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 3. Button Management & Responsive Configuration Dual Columns */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-4 border-t border-espresso-900/10">
            {/* Column A: Button List (4 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-terracotta-600" />
                  <h4 className="font-display font-bold text-sm text-espresso-900">
                    CTA Buttons ({currentButtons.length})
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={handleAddButton}
                  className="btn-secondary py-1.5 px-3 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Button</span>
                </button>
              </div>

              {currentButtons.length === 0 ? (
                <div className="p-6 text-center bg-ivory-50 border border-espresso-900/10 rounded-xl space-y-2">
                  <p className="text-xs text-espresso-600 font-medium">No buttons configured yet.</p>
                  <button
                    type="button"
                    onClick={handleAddButton}
                    className="btn-primary py-1.5 px-3 text-xs font-semibold"
                  >
                    Add First Button
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {currentButtons.map((btn, idx) => {
                    const isSelected = btn.id === selectedButtonId;
                    return (
                      <div
                        key={btn.id}
                        onClick={() => setSelectedButtonId(btn.id)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-ivory-50 border-terracotta-500 shadow-xs ring-1 ring-terracotta-500/20'
                            : 'bg-ivory-50/70 border-espresso-900/10 hover:border-espresso-900/20'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* Color preview indicator dot */}
                          <span
                            className="w-4 h-4 rounded-full border border-black/15 shrink-0"
                            style={{ backgroundColor: btn.style.background }}
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-espresso-900 truncate">
                              {btn.text || <span className="italic text-espresso-400">Unnamed Button</span>}
                            </p>
                            <p className="text-[10px] text-espresso-500 truncate">{btn.url || '#'}</p>
                          </div>
                        </div>

                        {/* Button Actions */}
                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleToggleBtnVisibility(btn.id)}
                            className="p-1 text-espresso-600 hover:text-espresso-900 cursor-pointer"
                            title={btn.is_visible ? 'Hide button' : 'Show button'}
                          >
                            {btn.is_visible ? (
                              <Eye className="w-3.5 h-3.5 text-sage-700" />
                            ) : (
                              <EyeOff className="w-3.5 h-3.5 text-espresso-400" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDuplicateButton(btn.id)}
                            className="p-1 text-espresso-600 hover:text-espresso-900 cursor-pointer"
                            title="Duplicate button"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleReorderButton(idx, 'up')}
                            className="p-1 text-espresso-600 hover:text-espresso-900 disabled:opacity-20 cursor-pointer"
                            title="Move up"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === currentButtons.length - 1}
                            onClick={() => handleReorderButton(idx, 'down')}
                            className="p-1 text-espresso-600 hover:text-espresso-900 disabled:opacity-20 cursor-pointer"
                            title="Move down"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteButton(btn.id)}
                            className="p-1 text-red-600 hover:text-red-700 cursor-pointer ml-1"
                            title="Delete button"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Column B: Selected Button Editor & Responsive Controls (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              {selectedButton ? (
                <div className="p-4 bg-ivory-50 border border-espresso-900/10 rounded-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-espresso-900/10 pb-2">
                    <span className="font-display font-bold text-xs text-espresso-900">
                      Configure: &ldquo;{selectedButton.text}&rdquo;
                    </span>
                    <label className="flex items-center gap-1.5 text-xs text-espresso-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedButton.is_visible}
                        onChange={(e) => handlePatchSelectedButton({ is_visible: e.target.checked })}
                        className="rounded accent-terracotta-600"
                      />
                      <span>Visible</span>
                    </label>
                  </div>

                  {/* Text & URL */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-espresso-900 mb-1">
                        Button Label <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        value={selectedButton.text}
                        onChange={(e) => handlePatchSelectedButton({ text: e.target.value })}
                        placeholder="e.g. Explore Products"
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-espresso-900/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9E4A2B]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-espresso-900 mb-1">
                        Destination URL <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        value={selectedButton.url}
                        onChange={(e) => handlePatchSelectedButton({ url: e.target.value })}
                        placeholder="e.g. /catalog or https://..."
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-espresso-900/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9E4A2B]"
                      />
                    </div>
                  </div>

                  {/* Open in new tab toggle */}
                  <div className="flex items-center gap-4 text-xs">
                    <label className="flex items-center gap-1.5 text-espresso-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedButton.open_in_new_tab}
                        onChange={(e) => handlePatchSelectedButton({ open_in_new_tab: e.target.checked })}
                        className="rounded accent-terracotta-600"
                      />
                      <span>Open in new tab (`target="_blank"`)</span>
                    </label>
                  </div>

                  {/* Styling Controls: Colors, Shape, Weight */}
                  <div className="p-3 bg-white rounded-lg border border-espresso-900/10 space-y-3">
                    <div className="flex items-center gap-1 text-[11px] font-bold text-espresso-900">
                      <Palette className="w-3.5 h-3.5 text-terracotta-600" />
                      <span>Appearance &amp; Palette</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-semibold text-espresso-700 mb-1">
                          Background Color
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="color"
                            value={selectedButton.style.background}
                            onChange={(e) =>
                              handlePatchSelectedButton({
                                style: { ...selectedButton.style, background: e.target.value },
                              })
                            }
                            className="w-7 h-7 rounded border border-espresso-900/20 cursor-pointer"
                          />
                          <input
                            type="text"
                            value={selectedButton.style.background}
                            onChange={(e) =>
                              handlePatchSelectedButton({
                                style: { ...selectedButton.style, background: e.target.value },
                              })
                            }
                            className="w-20 px-1.5 py-1 text-xs border rounded font-mono"
                          />
                        </div>
                        <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                          {BRAND_PALETTE.map((p) => (
                            <button
                              key={p.name}
                              type="button"
                              onClick={() =>
                                handlePatchSelectedButton({
                                  style: { ...selectedButton.style, background: p.hex },
                                })
                              }
                              className="w-4 h-4 rounded-full border border-black/20 hover:scale-110 transition-transform cursor-pointer"
                              style={{ backgroundColor: p.hex }}
                              title={p.name}
                            />
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-espresso-700 mb-1">
                          Text Color
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="color"
                            value={selectedButton.style.color}
                            onChange={(e) =>
                              handlePatchSelectedButton({
                                style: { ...selectedButton.style, color: e.target.value },
                              })
                            }
                            className="w-7 h-7 rounded border border-espresso-900/20 cursor-pointer"
                          />
                          <input
                            type="text"
                            value={selectedButton.style.color}
                            onChange={(e) =>
                              handlePatchSelectedButton({
                                style: { ...selectedButton.style, color: e.target.value },
                              })
                            }
                            className="w-20 px-1.5 py-1 text-xs border rounded font-mono"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-espresso-700 mb-1">
                          Border Color
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="color"
                            value={selectedButton.style.borderColor || '#30251F'}
                            onChange={(e) =>
                              handlePatchSelectedButton({
                                style: { ...selectedButton.style, borderColor: e.target.value },
                              })
                            }
                            className="w-7 h-7 rounded border border-espresso-900/20 cursor-pointer"
                          />
                          <select
                            value={selectedButton.style.borderWidth ?? 0}
                            onChange={(e) =>
                              handlePatchSelectedButton({
                                style: { ...selectedButton.style, borderWidth: parseInt(e.target.value, 10) },
                              })
                            }
                            className="text-xs border rounded px-1.5 py-1"
                          >
                            <option value={0}>No Border</option>
                            <option value={1}>1px</option>
                            <option value={2}>2px</option>
                            <option value={3}>3px</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Shape & Font Weight */}
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-[10px] font-semibold text-espresso-700 mb-1">Shape</label>
                        <select
                          value={selectedButton.style.shape}
                          onChange={(e) =>
                            handlePatchSelectedButton({
                              style: { ...selectedButton.style, shape: e.target.value as BannerButtonShape },
                            })
                          }
                          className="w-full text-xs bg-ivory-50 border rounded-lg px-2 py-1.5"
                        >
                          <option value="square">Square</option>
                          <option value="slightly_rounded">Slightly Rounded (6px)</option>
                          <option value="rounded">Rounded (12px)</option>
                          <option value="pill">Pill-shaped (Full)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-espresso-700 mb-1">Font Weight</label>
                        <select
                          value={selectedButton.style.fontWeight}
                          onChange={(e) =>
                            handlePatchSelectedButton({
                              style: { ...selectedButton.style, fontWeight: e.target.value as BannerFontWeight },
                            })
                          }
                          className="w-full text-xs bg-ivory-50 border rounded-lg px-2 py-1.5"
                        >
                          <option value="400">Regular (400)</option>
                          <option value="500">Medium (500)</option>
                          <option value="600">Semi-Bold (600)</option>
                          <option value="700">Bold (700)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Independent Responsive Settings: Desktop, Tablet, Mobile */}
                  <div className="p-3 bg-white rounded-lg border border-espresso-900/10 space-y-3">
                    <div className="flex items-center justify-between border-b border-espresso-900/10 pb-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-espresso-900">
                        <Sliders className="w-3.5 h-3.5 text-terracotta-600" />
                        <span>Independent Responsive Coordinates</span>
                      </div>

                      {/* Screen tab selector */}
                      <div className="flex items-center gap-1 bg-ivory-200 p-0.5 rounded-lg text-[10px]">
                        {(['desktop', 'tablet', 'mobile'] as const).map((scr) => (
                          <button
                            key={scr}
                            type="button"
                            onClick={() => {
                              setResponsiveConfigTab(scr);
                              setPreviewDevice(scr);
                            }}
                            className={`px-2 py-1 rounded font-semibold capitalize transition-colors cursor-pointer ${
                              responsiveConfigTab === scr ? 'bg-white text-espresso-900 shadow-xs' : 'text-espresso-600'
                            }`}
                          >
                            {scr}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Coordinates for selected screen */}
                    {(() => {
                      const screenCoords =
                        selectedButton.responsive[responsiveConfigTab] || selectedButton.responsive.desktop;

                      return (
                        <div className="space-y-3">
                          <p className="text-[11px] text-espresso-500">
                            Customizing position for <strong>{responsiveConfigTab.toUpperCase()}</strong>. Changes here will not affect other screens.
                          </p>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <div className="flex items-center justify-between text-[11px] font-semibold text-espresso-800 mb-1">
                                <span>X Position (Horizontal)</span>
                                <span className="font-mono text-terracotta-700">{screenCoords.x}%</span>
                              </div>
                              <input
                                type="range"
                                min={0}
                                max={100}
                                step={0.5}
                                value={screenCoords.x}
                                onChange={(e) =>
                                  handlePatchButtonResponsive(responsiveConfigTab, {
                                    x: parseFloat(e.target.value),
                                  })
                                }
                                className="w-full accent-terracotta-600 cursor-pointer"
                              />
                            </div>

                            <div>
                              <div className="flex items-center justify-between text-[11px] font-semibold text-espresso-800 mb-1">
                                <span>Y Position (Vertical)</span>
                                <span className="font-mono text-terracotta-700">{screenCoords.y}%</span>
                              </div>
                              <input
                                type="range"
                                min={0}
                                max={100}
                                step={0.5}
                                value={screenCoords.y}
                                onChange={(e) =>
                                  handlePatchButtonResponsive(responsiveConfigTab, {
                                    y: parseFloat(e.target.value),
                                  })
                                }
                                className="w-full accent-terracotta-600 cursor-pointer"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-3 pt-1">
                            <div>
                              <label className="block text-[10px] font-semibold text-espresso-700 mb-1">
                                Width (px or auto)
                              </label>
                              <input
                                type="text"
                                value={screenCoords.width ?? 'auto'}
                                onChange={(e) => {
                                  const val = e.target.value.trim();
                                  handlePatchButtonResponsive(responsiveConfigTab, {
                                    width: val === 'auto' || val === '' ? 'auto' : parseInt(val, 10) || 'auto',
                                  });
                                }}
                                placeholder="auto or 180"
                                className="w-full px-2 py-1 text-xs border rounded"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-espresso-700 mb-1">
                                Height (px or auto)
                              </label>
                              <input
                                type="text"
                                value={screenCoords.height ?? 'auto'}
                                onChange={(e) => {
                                  const val = e.target.value.trim();
                                  handlePatchButtonResponsive(responsiveConfigTab, {
                                    height: val === 'auto' || val === '' ? 'auto' : parseInt(val, 10) || 'auto',
                                  });
                                }}
                                placeholder="auto or 48"
                                className="w-full px-2 py-1 text-xs border rounded"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-espresso-700 mb-1">
                                Font Size (px)
                              </label>
                              <input
                                type="number"
                                min={10}
                                max={32}
                                value={screenCoords.fontSize || 14}
                                onChange={(e) =>
                                  handlePatchButtonResponsive(responsiveConfigTab, {
                                    fontSize: parseInt(e.target.value, 10) || 14,
                                  })
                                }
                                className="w-full px-2 py-1 text-xs border rounded"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center bg-ivory-50 border border-espresso-900/10 rounded-xl text-espresso-500 text-xs">
                  Select a button from the list or click &ldquo;Add Button&rdquo; to begin editing.
                </div>
              )}
            </div>
          </div>

          {/* 4. Responsive Banner Images Management (Desktop, Tablet, Mobile) */}
          <div className="pt-6 border-t border-espresso-900/10 space-y-4">
            <h4 className="font-display font-bold text-sm text-espresso-900">
              Responsive Image Assets (Desktop, Tablet, Mobile)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Desktop Asset */}
              <div className="p-4 bg-ivory-50 border border-espresso-900/15 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-espresso-900">Desktop Asset</span>
                  <span className="text-[10px] text-sage-800 font-semibold bg-sage/15 px-1.5 py-0.2 rounded">Required</span>
                </div>
                <div className="relative h-20 rounded-lg overflow-hidden bg-ivory-200 border border-espresso-900/10">
                  <img src={activeBanner.image_url} alt="Desktop" className="w-full h-full object-cover" />
                </div>
                <label className="block text-[11px] text-espresso-600">
                  Replace Desktop (2400x800 WebP):
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadDeviceImage('desktop', f);
                    }}
                    className="mt-1 w-full text-xs text-espresso-800 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-[11px] file:font-semibold file:bg-terracotta-600 file:text-white cursor-pointer"
                  />
                </label>
              </div>

              {/* Tablet Asset */}
              <div className="p-4 bg-ivory-50 border border-espresso-900/15 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-espresso-900">Tablet Asset</span>
                  {activeBanner.tablet_image_url ? (
                    <button
                      type="button"
                      onClick={() => handleRemoveDeviceImage('tablet')}
                      className="text-[10px] text-red-600 hover:text-red-700 cursor-pointer font-semibold"
                    >
                      Remove
                    </button>
                  ) : (
                    <span className="text-[10px] text-espresso-500 italic">Uses Desktop</span>
                  )}
                </div>
                <div className="relative h-20 rounded-lg overflow-hidden bg-ivory-200 border border-espresso-900/10">
                  <img
                    src={activeBanner.tablet_image_url || activeBanner.image_url}
                    alt="Tablet"
                    className="w-full h-full object-cover"
                  />
                </div>
                <label className="block text-[11px] text-espresso-600">
                  {activeBanner.tablet_image_url ? 'Replace Tablet (1600x600 WebP):' : 'Upload Tablet (1600x600 WebP):'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadDeviceImage('tablet', f);
                    }}
                    className="mt-1 w-full text-xs text-espresso-800 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-[11px] file:font-semibold file:bg-espresso-800 file:text-white cursor-pointer"
                  />
                </label>
              </div>

              {/* Mobile Asset */}
              <div className="p-4 bg-ivory-50 border border-espresso-900/15 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-espresso-900">Mobile Asset</span>
                  {activeBanner.mobile_image_url ? (
                    <button
                      type="button"
                      onClick={() => handleRemoveDeviceImage('mobile')}
                      className="text-[10px] text-red-600 hover:text-red-700 cursor-pointer font-semibold"
                    >
                      Remove
                    </button>
                  ) : (
                    <span className="text-[10px] text-espresso-500 italic">Uses Desktop</span>
                  )}
                </div>
                <div className="relative h-20 rounded-lg overflow-hidden bg-ivory-200 border border-espresso-900/10">
                  <img
                    src={activeBanner.mobile_image_url || activeBanner.tablet_image_url || activeBanner.image_url}
                    alt="Mobile"
                    className="w-full h-full object-cover"
                  />
                </div>
                <label className="block text-[11px] text-espresso-600">
                  {activeBanner.mobile_image_url ? 'Replace Mobile (1200x600 WebP):' : 'Upload Mobile (1200x600 WebP):'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadDeviceImage('mobile', f);
                    }}
                    className="mt-1 w-full text-xs text-espresso-800 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-[11px] file:font-semibold file:bg-espresso-800 file:text-white cursor-pointer"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* 5. All Banners List */}
      <div className="space-y-4">
        <h3 className="font-display font-bold text-sm text-espresso-900">
          All Published &amp; Draft Banners ({banners.length})
        </h3>

        {loading ? (
          <div className="py-12 text-center text-xs text-espresso-500">
            <div className="inline-block w-6 h-6 border-2 border-espresso-800 border-t-transparent rounded-full animate-spin mb-2" />
            <p>Loading banners...</p>
          </div>
        ) : banners.length === 0 ? (
          <div className="p-8 text-center bg-ivory-100 border border-espresso-900/10 rounded-2xl">
            <ImageIcon className="w-8 h-8 text-espresso-400 mx-auto mb-2" />
            <p className="text-xs font-semibold text-espresso-900">No banners uploaded yet</p>
            <p className="text-[11px] text-espresso-500 mt-1">
              Click &ldquo;New Banner&rdquo; above to create your first responsive dynamic banner.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {banners.map((banner, index) => {
              const isSelected = banner.id === selectedBannerId;
              const buttonCount = (banner.buttons || []).length;

              return (
                <div
                  key={banner.id}
                  className={`p-4 bg-ivory-100 border rounded-2xl transition-all ${
                    isSelected
                      ? 'border-terracotta-500/50 shadow-soft ring-1 ring-terracotta-500/20'
                      : 'border-espresso-900/10 hover:border-espresso-900/20'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                    <div
                      className="flex items-center gap-3 cursor-pointer w-full sm:flex-1 min-w-0 max-w-full"
                      onClick={() => {
                        setSelectedBannerId(banner.id);
                        const btns = banner.buttons || [];
                        if (btns.length > 0) setSelectedButtonId(btns[0].id);
                      }}
                    >
                      <div className="relative w-24 h-14 rounded-lg overflow-hidden bg-ivory-200 border border-espresso-900/10 shrink-0">
                        <img
                          src={banner.image_url}
                          alt={banner.alt_text}
                          className="w-full h-full object-cover"
                          style={{ objectPosition: `${banner.focal_x || 70}% ${banner.focal_y || 50}%` }}
                        />
                        <span className="absolute top-1 left-1 px-1.5 py-0.2 bg-espresso-950/80 text-white rounded text-[9px] font-bold">
                          #{index + 1}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-espresso-900 truncate">
                            {banner.title || banner.alt_text || 'Untitled Banner'}
                          </p>
                          <span
                            className={`px-2 py-0.2 rounded-full text-[10px] font-semibold shrink-0 ${
                              banner.is_active ? 'bg-sage/15 text-sage-800' : 'bg-espresso-900/10 text-espresso-600'
                            }`}
                          >
                            {banner.is_active ? 'Active' : 'Hidden'}
                          </span>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-ivory-200 text-espresso-600">
                            {buttonCount} {buttonCount === 1 ? 'button' : 'buttons'}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-espresso-500 mt-1 truncate">
                          <span>
                            Devices:{' '}
                            {banner.mobile_image_url && banner.tablet_image_url
                              ? 'Desktop + Tablet + Mobile'
                              : banner.mobile_image_url
                              ? 'Desktop + Mobile'
                              : 'Desktop'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleActiveBanner(banner)}
                        className={`p-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          banner.is_active
                            ? 'bg-sage/15 text-sage-800 hover:bg-sage/25'
                            : 'bg-espresso-900/10 text-espresso-600 hover:bg-espresso-900/15'
                        }`}
                        title={banner.is_active ? 'Hide banner' : 'Activate banner'}
                        aria-label={banner.is_active ? 'Deactivate banner' : 'Activate banner'}
                      >
                        {banner.is_active ? <Eye className="w-4 h-4 text-sage-700" /> : <EyeOff className="w-4 h-4 text-espresso-500" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedBannerId(banner.id);
                          const btns = banner.buttons || [];
                          if (btns.length > 0) setSelectedButtonId(btns[0].id);
                        }}
                        className={`py-1.5 px-3 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-espresso-900 text-ivory-100 border-espresso-900'
                            : 'bg-ivory-200 hover:bg-ivory-300 text-espresso-800 border-espresso-900/10'
                        }`}
                      >
                        {isSelected ? 'Editing' : 'Open in Builder'}
                      </button>

                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => handleReorderBanner(index, 'up')}
                        className="p-1.5 rounded-lg border border-espresso-900/10 transition-colors disabled:opacity-30 cursor-pointer"
                        title="Move Up"
                        aria-label="Move banner up"
                      >
                        <ArrowUp className="w-3.5 h-3.5 text-espresso-700" />
                      </button>
                      <button
                        type="button"
                        disabled={index === banners.length - 1}
                        onClick={() => handleReorderBanner(index, 'down')}
                        className="p-1.5 rounded-lg border border-espresso-900/10 transition-colors disabled:opacity-30 cursor-pointer"
                        title="Move Down"
                        aria-label="Move banner down"
                      >
                        <ArrowDown className="w-3.5 h-3.5 text-espresso-700" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteBanner(banner)}
                        className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 cursor-pointer ml-1"
                        title="Delete banner"
                        aria-label="Delete banner"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminBannerManager;
