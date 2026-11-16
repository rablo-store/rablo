import React, { useState, useEffect, useRef } from 'react';
import {
  listAllBanners,
  uploadBanner,
  updateBanner,
  reorderBanners,
  deleteBanner,
  isSafeBannerLink,
  HOME_LIMITS,
  type HomeBanner,
} from '../../../lib/home';
import { resizeToWebp } from '../../../lib/imageResize';
import {
  Upload,
  Image as ImageIcon,
  Trash2,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Smartphone,
  Monitor,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Move,
} from 'lucide-react';

interface AdminBannerManagerProps {
  onNotify: (message: string, isError?: boolean) => void;
}

interface UploadStatus {
  id: string;
  name: string;
  progress: number;
  error: string | null;
  success: boolean;
}

export const AdminBannerManager: React.FC<AdminBannerManagerProps> = ({ onNotify }) => {
  const [banners, setBanners] = useState<HomeBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadStatuses, setUploadStatuses] = useState<UploadStatus[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedBannerId, setSelectedBannerId] = useState<string | null>(null);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [editingBannerId, setEditingBannerId] = useState<string | null>(null);
  const [altTextDraft, setAltTextDraft] = useState('');
  const [linkUrlDraft, setLinkUrlDraft] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchBanners = async () => {
    setLoading(true);
    const { data, error } = await listAllBanners();
    if (error) {
      onNotify(`Error loading banners: ${error}`, true);
    } else {
      setBanners(data);
      if (data.length > 0 && !selectedBannerId) {
        setSelectedBannerId(data[0].id);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchBanners();
  }, []);

  const activeBanner = banners.find((b) => b.id === selectedBannerId) || banners[0] || null;

  const validateAndUploadFiles = async (files: FileList | File[]) => {
    const fileList = Array.from(files);
    if (fileList.length === 0) return;

    if (banners.length >= HOME_LIMITS.banners) {
      onNotify(
        `Maximum of ${HOME_LIMITS.banners} banners reached. Delete an existing banner to add a new one.`,
        true
      );
      return;
    }

    const availableSlots = HOME_LIMITS.banners - banners.length;
    const filesToProcess = fileList.slice(0, availableSlots);
    const excessFiles = fileList.slice(availableSlots);

    const initialStatuses: UploadStatus[] = [
      ...filesToProcess.map((f) => ({
        id: Math.random().toString(36).substring(2, 9),
        name: f.name,
        progress: 10,
        error: null,
        success: false,
      })),
      ...excessFiles.map((f) => ({
        id: Math.random().toString(36).substring(2, 9),
        name: f.name,
        progress: 0,
        error: `Exceeds max limit of ${HOME_LIMITS.banners} banners.`,
        success: false,
      })),
    ];

    setUploadStatuses(initialStatuses);
    setUploading(true);

    const allowedMime = ['image/jpeg', 'image/png', 'image/webp'];
    const maxBytes = 5 * 1024 * 1024; // 5 MB

    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i];
      const statusId = initialStatuses[i].id;

      // 1. Validate MIME
      if (!allowedMime.includes(file.type)) {
        setUploadStatuses((prev) =>
          prev.map((s) =>
            s.id === statusId
              ? { ...s, error: 'Invalid format. Only JPEG, PNG, and WebP are allowed.', progress: 0 }
              : s
          )
        );
        continue;
      }

      // 2. Validate Size
      if (file.size > maxBytes) {
        setUploadStatuses((prev) =>
          prev.map((s) =>
            s.id === statusId
              ? { ...s, error: 'File size exceeds 5 MB limit.', progress: 0 }
              : s
          )
        );
        continue;
      }

      try {
        setUploadStatuses((prev) =>
          prev.map((s) => (s.id === statusId ? { ...s, progress: 40 } : s))
        );

        // Resize in browser
        const resizedBlob = await resizeToWebp(file, 1920, 0.82);
        const resizedFile = new File([resizedBlob], file.name.replace(/\.[^/.]+$/, '.webp'), {
          type: 'image/webp',
        });

        setUploadStatuses((prev) =>
          prev.map((s) => (s.id === statusId ? { ...s, progress: 70 } : s))
        );

        // Upload to Supabase Storage & insert row
        const { data: newBanner, error } = await uploadBanner(resizedFile, file.name.replace(/\.[^/.]+$/, ''));

        if (error) {
          setUploadStatuses((prev) =>
            prev.map((s) =>
              s.id === statusId ? { ...s, error: error, progress: 0 } : s
            )
          );
        } else if (newBanner) {
          setUploadStatuses((prev) =>
            prev.map((s) =>
              s.id === statusId ? { ...s, progress: 100, success: true } : s
            )
          );
          setBanners((prev) => [...prev, newBanner]);
          setSelectedBannerId(newBanner.id);
          onNotify(`Banner "${file.name}" uploaded successfully!`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Upload failed';
        setUploadStatuses((prev) =>
          prev.map((s) => (s.id === statusId ? { ...s, error: msg, progress: 0 } : s))
        );
      }
    }

    setUploading(false);
  };

  const handleToggleActive = async (banner: HomeBanner) => {
    const newActive = !banner.is_active;
    const previous = [...banners];

    // Optimistic update
    setBanners((prev) =>
      prev.map((b) => (b.id === banner.id ? { ...b, is_active: newActive } : b))
    );

    const { error } = await updateBanner(banner.id, { is_active: newActive });
    if (error) {
      setBanners(previous);
      onNotify(`Failed to update banner status: ${error}`, true);
    } else {
      onNotify(newActive ? 'Banner activated' : 'Banner hidden from shoppers');
    }
  };

  const startEditing = (banner: HomeBanner) => {
    setEditingBannerId(banner.id);
    setAltTextDraft(banner.alt_text || '');
    setLinkUrlDraft(banner.link_url || '');
    setLinkError(null);
  };

  const handleSaveBannerDetails = async (bannerId: string) => {
    // Validate alt text
    const trimmedAlt = altTextDraft.trim();
    if (!trimmedAlt) {
      onNotify('Alt text is required for accessibility.', true);
      return;
    }

    // Validate link
    if (linkUrlDraft.trim() && !isSafeBannerLink(linkUrlDraft.trim())) {
      setLinkError('Must be an internal path (starting with /) or an https:// URL');
      return;
    }

    const previous = [...banners];
    setBanners((prev) =>
      prev.map((b) =>
        b.id === bannerId
          ? {
              ...b,
              alt_text: trimmedAlt,
              link_url: linkUrlDraft.trim() ? linkUrlDraft.trim() : null,
            }
          : b
      )
    );

    const { error } = await updateBanner(bannerId, {
      alt_text: trimmedAlt,
      link_url: linkUrlDraft.trim() ? linkUrlDraft.trim() : null,
    });

    if (error) {
      setBanners(previous);
      onNotify(`Failed to save banner details: ${error}`, true);
    } else {
      onNotify('Banner details saved successfully');
      setEditingBannerId(null);
    }
  };

  const handleUpdateFocalPoint = async (bannerId: string, focalX: number, focalY: number) => {
    const clampedX = Math.max(0, Math.min(100, Math.round(focalX)));
    const clampedY = Math.max(0, Math.min(100, Math.round(focalY)));

    const previous = [...banners];
    setBanners((prev) =>
      prev.map((b) =>
        b.id === bannerId ? { ...b, focal_x: clampedX, focal_y: clampedY } : b
      )
    );

    const { error } = await updateBanner(bannerId, {
      focal_x: clampedX,
      focal_y: clampedY,
    });

    if (error) {
      setBanners(previous);
      onNotify(`Failed to update focal point: ${error}`, true);
    }
  };

  const handleReorder = async (currentIndex: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= banners.length) return;

    const previous = [...banners];
    const updated = [...banners];
    const [moved] = updated.splice(currentIndex, 1);
    updated.splice(targetIndex, 0, moved);

    // Reassign position attributes
    const reorderedWithPositions = updated.map((b, idx) => ({ ...b, position: idx }));
    setBanners(reorderedWithPositions);

    const orderedIds = reorderedWithPositions.map((b) => b.id);
    const { success, error } = await reorderBanners(orderedIds);

    if (!success || error) {
      setBanners(previous);
      onNotify(`Failed to reorder banners: ${error || 'Unknown error'}`, true);
    } else {
      onNotify('Banner order updated');
    }
  };

  const handleDeleteBanner = async (banner: HomeBanner) => {
    const confirmMessage = `Are you sure you want to delete this banner?\n\nImage: ${banner.alt_text || 'Banner'}\nThis permanently removes the image from storage and the database.`;
    if (!window.confirm(confirmMessage)) return;

    const previous = [...banners];
    setBanners((prev) => prev.filter((b) => b.id !== banner.id));
    if (selectedBannerId === banner.id) {
      const remaining = previous.filter((b) => b.id !== banner.id);
      setSelectedBannerId(remaining[0]?.id || null);
    }

    const { success, error } = await deleteBanner(banner.id);
    if (!success || error) {
      setBanners(previous);
      onNotify(`Failed to delete banner: ${error || 'Unknown error'}`, true);
    } else {
      onNotify('Banner deleted successfully');
    }
  };

  return (
    <div className="space-y-8">
      {/* Header section with live counter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-ivory-100 border border-espresso-900/10 rounded-2xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg font-display font-bold text-espresso-900">
              Hero Banner Slider
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
            Upload and manage the full-width hero slider on Rijlo&apos;s home page. Up to {HOME_LIMITS.banners} slides, auto-resized to 1920px WebP.
          </p>
        </div>

        {/* Upload Button */}
        <div className="flex items-center gap-3">
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
            className={`btn-primary py-2.5 px-4 text-xs font-semibold inline-flex items-center gap-2 cursor-pointer ${
              banners.length >= HOME_LIMITS.banners ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            title={banners.length >= HOME_LIMITS.banners ? 'Maximum 8 banners reached' : 'Upload banners'}
          >
            <Upload className="w-4 h-4" />
            <span>Upload Images</span>
          </button>
        </div>
      </div>

      {/* Drag and Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (banners.length < HOME_LIMITS.banners) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files) {
            validateAndUploadFiles(e.dataTransfer.files);
          }
        }}
        className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
          banners.length >= HOME_LIMITS.banners
            ? 'border-espresso-900/10 bg-ivory-50/50 cursor-not-allowed opacity-75'
            : isDragging
              ? 'border-terracotta-500 bg-terracotta-50/40 ring-4 ring-terracotta-100'
              : 'border-espresso-900/15 hover:border-espresso-900/30 bg-ivory-50'
        }`}
      >
        <ImageIcon className="w-8 h-8 text-espresso-400 mx-auto mb-2" />
        {banners.length >= HOME_LIMITS.banners ? (
          <p className="text-xs text-peach-700 font-medium">
            Maximum of {HOME_LIMITS.banners} banners reached. Delete an existing banner to add a new one.
          </p>
        ) : (
          <>
            <p className="text-xs font-semibold text-espresso-900">
              Drag &amp; drop banner images here, or click &ldquo;Upload Images&rdquo;
            </p>
            <p className="text-[11px] text-espresso-500 mt-1">
              Supports JPEG, PNG, WebP up to 5 MB each. Auto-resized to WebP (max 1920px wide).
            </p>
          </>
        )}
      </div>

      {/* Per-file upload progress & errors */}
      {uploadStatuses.length > 0 && (
        <div className="space-y-2 bg-ivory-100 p-4 rounded-xl border border-espresso-900/10">
          <div className="flex items-center justify-between text-xs font-semibold text-espresso-900">
            <span>Upload Status</span>
            <button
              type="button"
              onClick={() => setUploadStatuses([])}
              className="text-espresso-500 hover:text-espresso-800 text-[11px]"
            >
              Clear
            </button>
          </div>
          <div className="space-y-1.5">
            {uploadStatuses.map((status) => (
              <div
                key={status.id}
                className="flex items-center justify-between text-xs p-2 bg-ivory-50 rounded-lg border border-espresso-900/5"
              >
                <span className="truncate max-w-xs text-espresso-800 font-medium">{status.name}</span>
                {status.error ? (
                  <span className="inline-flex items-center gap-1 text-red-600 font-semibold text-[11px]">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{status.error}</span>
                  </span>
                ) : status.success ? (
                  <span className="inline-flex items-center gap-1 text-sage-700 font-semibold text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Uploaded</span>
                  </span>
                ) : (
                  <span className="text-terracotta-600 text-[11px]">{status.progress}%</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live "How It Looks" Preview Box */}
      {activeBanner && (
        <div className="p-5 bg-ivory-100 border border-espresso-900/10 rounded-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-sm text-espresso-900">
                  Live Preview: #{activeBanner.position + 1} {activeBanner.alt_text || 'Untitled Banner'}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    activeBanner.is_active
                      ? 'bg-sage/15 text-sage-800'
                      : 'bg-espresso-900/10 text-espresso-600'
                  }`}
                >
                  {activeBanner.is_active ? 'Active' : 'Hidden'}
                </span>
              </div>
              <p className="text-[11px] text-espresso-500 mt-0.5">
                Recommended 1920x800 px. Keep the subject in the centre: on phones the sides are cropped.
              </p>
            </div>

            {/* Viewport switch: Desktop vs Mobile */}
            <div className="flex items-center gap-1 bg-ivory-200 p-1 rounded-xl border border-espresso-900/10 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setPreviewDevice('desktop')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  previewDevice === 'desktop'
                    ? 'bg-ivory-100 text-espresso-900 shadow-xs'
                    : 'text-espresso-600 hover:text-espresso-900'
                }`}
                title="Desktop 1920px width view"
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>Desktop</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewDevice('mobile')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  previewDevice === 'mobile'
                    ? 'bg-ivory-100 text-espresso-900 shadow-xs'
                    : 'text-espresso-600 hover:text-espresso-900'
                }`}
                title="Mobile 360px viewport view"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Phone (360px)</span>
              </button>
            </div>
          </div>

          {/* Banner Box with exact clamp rule: height: clamp(200px, 38vw, 440px), object-fit: cover */}
          <div
            className={`mx-auto transition-all duration-300 relative rounded-2xl overflow-hidden border border-espresso-900/15 shadow-soft w-full ${
              previewDevice === 'mobile' ? 'max-w-full sm:max-w-[360px]' : ''
            }`}
          >
            {/* Focal Point interactive canvas & preview */}
            <div
              tabIndex={0}
              role="slider"
              aria-label={`Focal point selector for ${activeBanner.alt_text || 'banner'}. Use arrow keys to adjust focal position.`}
              aria-valuetext={`X: ${activeBanner.focal_x}%, Y: ${activeBanner.focal_y}%`}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 100;
                const y = ((e.clientY - rect.top) / rect.height) * 100;
                handleUpdateFocalPoint(activeBanner.id, x, y);
              }}
              onKeyDown={(e) => {
                let dx = 0;
                let dy = 0;
                if (e.key === 'ArrowUp') dy = -5;
                else if (e.key === 'ArrowDown') dy = 5;
                else if (e.key === 'ArrowLeft') dx = -5;
                else if (e.key === 'ArrowRight') dx = 5;
                else return;

                e.preventDefault();
                handleUpdateFocalPoint(
                  activeBanner.id,
                  activeBanner.focal_x + dx,
                  activeBanner.focal_y + dy
                );
              }}
              className="relative w-full cursor-crosshair group focus:outline-none focus:ring-2 focus:ring-[#9E4A2B]"
              style={{ height: 'clamp(200px, 38vw, 440px)' }}
              title="Click or use arrow keys to adjust focal point"
            >
              <img
                src={activeBanner.image_url}
                alt={activeBanner.alt_text}
                className="w-full h-full select-none"
                style={{
                  objectFit: 'cover',
                  objectPosition: `${activeBanner.focal_x}% ${activeBanner.focal_y}%`,
                }}
              />

              {/* Focal point indicator dot */}
              <div
                className="absolute w-5 h-5 rounded-full border-2 border-white bg-terracotta-500 shadow-lg pointer-events-none transform -translate-x-1/2 -translate-y-1/2 transition-transform duration-75"
                style={{
                  left: `${activeBanner.focal_x}%`,
                  top: `${activeBanner.focal_y}%`,
                }}
              >
                <div className="w-1.5 h-1.5 bg-white rounded-full mx-auto my-1" />
              </div>

              {/* Help overlay badge on hover */}
              <div className="absolute bottom-3 left-3 bg-espresso-950/75 backdrop-blur-xs text-ivory-100 px-3 py-1 rounded-full text-[10px] font-medium flex items-center gap-1.5 pointer-events-none">
                <Move className="w-3 h-3 text-terracotta-400" />
                <span>Click image to set focal point ({activeBanner.focal_x}%, {activeBanner.focal_y}%)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Banners List */}
      <div className="space-y-4">
        <h3 className="font-display font-bold text-sm text-espresso-900">
          All Banners ({banners.length})
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
              Upload your first banner using the &ldquo;Upload Images&rdquo; button above.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {banners.map((banner, index) => {
              const isSelected = banner.id === selectedBannerId;
              const isEditing = banner.id === editingBannerId;

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
                    {/* Thumbnail + Info */}
                    <div
                      className="flex items-center gap-3 cursor-pointer w-full sm:flex-1 min-w-0 max-w-full"
                      onClick={() => setSelectedBannerId(banner.id)}
                    >
                      <div className="relative w-24 h-14 rounded-lg overflow-hidden bg-ivory-200 border border-espresso-900/10 flex-shrink-0">
                        <img
                          src={banner.image_url}
                          alt={banner.alt_text}
                          className="w-full h-full object-cover"
                          style={{
                            objectPosition: `${banner.focal_x}% ${banner.focal_y}%`,
                          }}
                        />
                        <span className="absolute top-1 left-1 px-1.5 py-0.2 bg-espresso-950/80 text-white rounded text-[9px] font-bold">
                          #{index + 1}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-espresso-900 truncate">
                            {banner.alt_text || <span className="text-red-600 italic">No alt text (required)</span>}
                          </p>
                          <span
                            className={`px-2 py-0.2 rounded-full text-[10px] font-semibold flex-shrink-0 ${
                              banner.is_active
                                ? 'bg-sage/15 text-sage-800'
                                : 'bg-espresso-900/10 text-espresso-600'
                            }`}
                          >
                            {banner.is_active ? 'Active' : 'Hidden'}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-espresso-500 mt-1 truncate">
                          <span>Focal: {banner.focal_x}%, {banner.focal_y}%</span>
                          {banner.link_url && (
                            <span className="inline-flex items-center gap-1 text-terracotta-700 truncate">
                              <ExternalLink className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{banner.link_url}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Controls */}
                    <div className="flex items-center gap-1.5 self-end sm:self-center flex-shrink-0">
                      {/* Active Toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleActive(banner)}
                        className={`p-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          banner.is_active
                            ? 'bg-sage/15 text-sage-800 hover:bg-sage/25'
                            : 'bg-espresso-900/10 text-espresso-600 hover:bg-espresso-900/15'
                        }`}
                        title={banner.is_active ? 'Hide banner' : 'Activate banner'}
                        aria-label={banner.is_active ? 'Deactivate banner' : 'Activate banner'}
                      >
                        {banner.is_active ? (
                          <Eye className="w-4 h-4 text-sage-700" />
                        ) : (
                          <EyeOff className="w-4 h-4 text-espresso-500" />
                        )}
                      </button>

                      {/* Edit Details Toggle */}
                      <button
                        type="button"
                        onClick={() => {
                          if (isEditing) setEditingBannerId(null);
                          else startEditing(banner);
                        }}
                        className={`py-1.5 px-3 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                          isEditing
                            ? 'bg-espresso-900 text-ivory-100 border-espresso-900'
                            : 'bg-ivory-200 hover:bg-ivory-300 text-espresso-800 border-espresso-900/10'
                        }`}
                      >
                        {isEditing ? 'Close' : 'Edit'}
                      </button>

                      {/* Up Reorder */}
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => handleReorder(index, 'up')}
                        className={`p-1.5 rounded-lg border border-espresso-900/10 transition-colors ${
                          index === 0
                            ? 'opacity-30 cursor-not-allowed text-espresso-400'
                            : 'hover:bg-ivory-200 text-espresso-700 cursor-pointer'
                        }`}
                        title="Move Up"
                        aria-label="Move banner up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>

                      {/* Down Reorder */}
                      <button
                        type="button"
                        disabled={index === banners.length - 1}
                        onClick={() => handleReorder(index, 'down')}
                        className={`p-1.5 rounded-lg border border-espresso-900/10 transition-colors ${
                          index === banners.length - 1
                            ? 'opacity-30 cursor-not-allowed text-espresso-400'
                            : 'hover:bg-ivory-200 text-espresso-700 cursor-pointer'
                        }`}
                        title="Move Down"
                        aria-label="Move banner down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => handleDeleteBanner(banner)}
                        className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 hover:text-red-700 border border-transparent hover:border-red-200 transition-colors cursor-pointer ml-1"
                        title="Delete banner"
                        aria-label="Delete banner"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Edit Panel Drawer */}
                  {isEditing && (
                    <div className="mt-4 pt-4 border-t border-espresso-900/10 space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-espresso-900 mb-1">
                          Alt Text <span className="text-red-600">*</span>
                        </label>
                        <input
                          type="text"
                          value={altTextDraft}
                          onChange={(e) => setAltTextDraft(e.target.value)}
                          placeholder="e.g. Handmade crochet daisy bags and artisanal ceramics"
                          maxLength={160}
                          className="w-full px-3 py-2 text-xs bg-ivory-50 border border-espresso-900/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9E4A2B]"
                        />
                        {!altTextDraft.trim() && (
                          <p className="text-[11px] text-red-600 mt-1">
                            Alt text is required for accessibility and SEO.
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-espresso-900 mb-1">
                          Optional Slide Link (internal path or https:// URL)
                        </label>
                        <input
                          type="text"
                          value={linkUrlDraft}
                          onChange={(e) => {
                            setLinkUrlDraft(e.target.value);
                            if (e.target.value && !isSafeBannerLink(e.target.value)) {
                              setLinkError('Must be an internal path starting with / or an https:// URL');
                            } else {
                              setLinkError(null);
                            }
                          }}
                          placeholder="e.g. /catalog?category=ceramics or https://instagram.com/crochetbynia"
                          className="w-full px-3 py-2 text-xs bg-ivory-50 border border-espresso-900/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9E4A2B]"
                        />
                        {linkError ? (
                          <p className="text-[11px] text-red-600 mt-1">{linkError}</p>
                        ) : (
                          <p className="text-[11px] text-espresso-500 mt-1">
                            Clicking the banner navigates to this destination. Leave blank for no link.
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setEditingBannerId(null)}
                          className="btn-secondary py-1.5 px-3 text-xs font-semibold cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveBannerDetails(banner.id)}
                          className="btn-primary py-1.5 px-4 text-xs font-semibold cursor-pointer"
                        >
                          Save Details
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
