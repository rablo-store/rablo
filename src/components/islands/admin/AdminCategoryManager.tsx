import React, { useState, useEffect, useRef } from 'react';
import {
  listCategoriesForAdmin,
  uploadCategory1to1Image,
  updateCategory,
  createCategory,
  deleteCategory,
  type CategoryAdminItem,
} from '../../../lib/categories';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import {
  Search,
  Upload,
  Image as ImageIcon,
  X,
  ExternalLink,
  Edit2,
  Save,
  RotateCcw,
  Plus,
  Loader2,
  Sparkles,
  Tag,
  Trash2,
} from 'lucide-react';

interface Props {
  onNotify: (message: string, isError?: boolean) => void;
  initialCategories?: any[];
  initialCategoryRequests?: any[];
  onRefreshParent?: () => void;
}

export const AdminCategoryManager: React.FC<Props> = ({
  onNotify,
  initialCategories = [],
  initialCategoryRequests = [],
  onRefreshParent,
}) => {
  const [categories, setCategories] = useState<CategoryAdminItem[]>(initialCategories as any);
  const [categoryRequests, setCategoryRequests] = useState<any[]>(initialCategoryRequests);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadingCatId, setUploadingCatId] = useState<string | null>(null);

  // Inline editing state
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // New category modal/form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
  const [addingCat, setAddingCat] = useState(false);

  // Delete category state
  const [deleteConfirmCat, setDeleteConfirmCat] = useState<CategoryAdminItem | null>(null);
  const [deletingCatId, setDeletingCatId] = useState<string | null>(null);

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const loadCategories = async () => {
    setLoading(true);
    const { data, error } = await listCategoriesForAdmin();
    if (error) {
      onNotify(`Could not load categories: ${error}`, true);
    } else {
      setCategories(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadCategories();

    const handleUpdated = () => {
      loadCategories();
    };
    window.addEventListener('rablo:categories-updated', handleUpdated);
    return () => window.removeEventListener('rablo:categories-updated', handleUpdated);
  }, []);

  // Filtered categories
  const filteredCategories = categories.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q);
  });

  // Handle 1:1 Image Upload
  const handleFileChange = async (catId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    setUploadingCatId(catId);
    try {
      // 1. Process 1:1 center-crop and upload WebP
      const { publicUrl, error: uploadErr } = await uploadCategory1to1Image(file, catId);
      if (uploadErr || !publicUrl) {
        onNotify(uploadErr || 'Failed to upload category image', true);
        return;
      }

      // 2. Update category record in database
      const { success, error: updateErr } = await updateCategory(catId, {
        image_url: publicUrl,
      });

      if (!success) {
        onNotify(updateErr || 'Failed to update category image in database', true);
        return;
      }

      // 3. Optimistic UI update
      setCategories((prev) =>
        prev.map((c) => (c.id === catId ? { ...c, image_url: publicUrl } : c))
      );

      onNotify('Category image updated to 1:1 square WebP successfully!');
      if (onRefreshParent) onRefreshParent();
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'An error occurred during image upload',
        true
      );
    } finally {
      setUploadingCatId(null);
      if (fileInputRefs.current[catId]) {
        fileInputRefs.current[catId]!.value = '';
      }
    }
  };

  // Reset category image to default
  const handleResetImage = async (catId: string) => {
    const confirmed = window.confirm('Reset this category image to its default?');
    if (!confirmed) return;

    setUploadingCatId(catId);
    try {
      const { success, error } = await updateCategory(catId, {
        image_url: null,
      });

      if (!success) {
        onNotify(error || 'Failed to reset category image', true);
        return;
      }

      await loadCategories();
      onNotify('Category image reset to default.');
      if (onRefreshParent) onRefreshParent();
    } catch (err) {
      onNotify('Error resetting image', true);
    } finally {
      setUploadingCatId(null);
    }
  };

  // Inline rename / edit
  const startEdit = (cat: CategoryAdminItem) => {
    setEditingCatId(cat.id);
    setEditName(cat.name);
    setEditSlug(cat.slug);
  };

  const cancelEdit = () => {
    setEditingCatId(null);
    setEditName('');
    setEditSlug('');
  };

  const saveEdit = async (catId: string) => {
    if (!editName.trim() || !editSlug.trim()) {
      onNotify('Category name and slug cannot be empty', true);
      return;
    }

    setSavingEdit(true);
    try {
      const { success, error } = await updateCategory(catId, {
        name: editName.trim(),
        slug: editSlug.trim().toLowerCase(),
      });

      if (!success) {
        onNotify(error || 'Failed to update category name/slug', true);
        return;
      }

      setCategories((prev) =>
        prev.map((c) =>
          c.id === catId
            ? { ...c, name: editName.trim(), slug: editSlug.trim().toLowerCase() }
            : c
        )
      );

      onNotify('Category updated successfully');
      cancelEdit();
      if (onRefreshParent) onRefreshParent();
    } catch (err) {
      onNotify('Error saving category', true);
    } finally {
      setSavingEdit(false);
    }
  };

  // Category Request approvals
  const handleApproveRequest = async (req: any) => {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      const generatedSlug = req.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
      const { error: catErr } = await supabase.from('categories').insert({
        name: req.name,
        slug: generatedSlug,
        is_approved: true,
      });

      if (catErr) {
        onNotify(`Error approving category: ${catErr.message}`, true);
        return;
      }

      await supabase
        .from('category_requests')
        .update({ status: 'Approved' })
        .eq('id', req.id);

      setCategoryRequests((prev) => prev.filter((r) => r.id !== req.id));
      await loadCategories();
      onNotify(`Category "${req.name}" approved!`);
      if (onRefreshParent) onRefreshParent();
    } catch {
      onNotify('Failed to approve category', true);
    }
  };

  const handleRejectRequest = async (reqId: string) => {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      await supabase
        .from('category_requests')
        .update({ status: 'Rejected' })
        .eq('id', reqId);

      setCategoryRequests((prev) => prev.filter((r) => r.id !== reqId));
      onNotify('Category request rejected.');
      if (onRefreshParent) onRefreshParent();
    } catch {
      onNotify('Failed to reject category', true);
    }
  };

  // Quick Add Category
  const handleCreateNewCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      onNotify('Please enter a category name', true);
      return;
    }
    const slug = (newSlug.trim() || newName.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-')).toLowerCase();

    setAddingCat(true);
    try {
      let imageUrl: string | null = null;
      if (newImageFile) {
        const tempId = crypto.randomUUID();
        const { publicUrl, error: uploadErr } = await uploadCategory1to1Image(newImageFile, tempId);
        if (uploadErr) {
          onNotify(`Image upload failed: ${uploadErr}`, true);
          setAddingCat(false);
          return;
        }
        imageUrl = publicUrl;
      }

      const { data, error } = await createCategory({
        name: newName.trim(),
        slug,
        image_url: imageUrl,
      });

      if (error || !data) {
        onNotify(`Error creating category: ${error || 'Unknown error'}`, true);
        return;
      }

      onNotify(`Category "${newName.trim()}" created successfully!`);
      setNewName('');
      setNewSlug('');
      setNewImageFile(null);
      setNewImagePreview(null);
      setShowAddForm(false);
      await loadCategories();
      if (onRefreshParent) onRefreshParent();
    } catch (err) {
      onNotify('Failed to create category', true);
    } finally {
      setAddingCat(false);
    }
  };

  // Delete category handler
  const handleDeleteCategory = async (cat: CategoryAdminItem) => {
    setDeletingCatId(cat.id);
    try {
      const { success, error } = await deleteCategory(cat.id);
      if (!success) {
        onNotify(error || 'Failed to delete category', true);
        return;
      }

      setCategories((prev) => prev.filter((c) => c.id !== cat.id));
      setDeleteConfirmCat(null);
      onNotify(`Category "${cat.name}" deleted successfully.`);
      if (onRefreshParent) onRefreshParent();
    } catch (err) {
      onNotify('Failed to delete category', true);
    } finally {
      setDeletingCatId(null);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      {/* ── HEADER BANNER ── */}
      <div className="p-5 sm:p-6 bg-ivory-100 border border-charcoal-800/10 rounded-2xl shadow-soft flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-terracotta-600" />
            <h2 className="text-lg sm:text-xl font-display font-bold text-charcoal-900">
              Category Images &amp; Directory Manager
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-charcoal-600 max-w-2xl leading-relaxed">
            Manage 1:1 square cover images for all store categories. Uploaded images are automatically center-cropped and optimized to high-resolution WebP for razor-sharp display on mobile, tablet, and desktop.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-terracotta-600 hover:bg-terracotta-700 text-ivory-50 shadow-soft-sm transition-all cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>{showAddForm ? 'Close Form' : 'New Category'}</span>
          </button>
        </div>
      </div>

      {/* ── QUICK ADD CATEGORY FORM ── */}
      {showAddForm && (
        <form
          onSubmit={handleCreateNewCategory}
          className="p-5 sm:p-6 bg-[#FAF6F0] border-2 border-dashed border-terracotta-600/30 rounded-2xl shadow-soft space-y-4 animate-slide-up"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-display font-bold text-charcoal-900 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-terracotta-600" />
              <span>Create New Category with 1:1 Cover</span>
            </h3>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-charcoal-500 hover:text-charcoal-900 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 items-start">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-charcoal-700">Category Name *</label>
              <input
                type="text"
                placeholder="e.g. Handmade Candles"
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  if (!newSlug) {
                    setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
                  }
                }}
                required
                className="w-full px-3 py-2 text-xs bg-white border border-charcoal-800/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-terracotta-600"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-charcoal-700">URL Slug *</label>
              <input
                type="text"
                placeholder="e.g. handmade-candles"
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs bg-white border border-charcoal-800/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-terracotta-600 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-charcoal-700">1:1 Square Image (Optional)</label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setNewImageFile(f);
                    setNewImagePreview(URL.createObjectURL(f));
                  }
                }}
                className="w-full text-xs text-charcoal-700 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-terracotta-100 file:text-terracotta-800 hover:file:bg-terracotta-200 cursor-pointer"
              />
            </div>
          </div>

          {newImagePreview && (
            <div className="flex items-center gap-3 pt-2">
              <div className="w-16 h-16 rounded-xl aspect-square overflow-hidden bg-ivory-200 border border-charcoal-800/10 shadow-xs">
                <img src={newImagePreview} alt="Preview" className="w-full h-full object-cover" />
              </div>
              <p className="text-[11px] text-charcoal-600">
                Image will be center-cropped to 1:1 WebP format upon submission.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-charcoal-800/20 text-charcoal-700 hover:bg-ivory-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addingCat}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-terracotta-600 text-ivory-50 hover:bg-terracotta-700 disabled:opacity-50"
            >
              {addingCat && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{addingCat ? 'Saving...' : 'Add Category'}</span>
            </button>
          </div>
        </form>
      )}

      {/* ── SEARCH & STATS ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-charcoal-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            placeholder="Search categories by name or slug..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-ivory-100 border border-charcoal-800/15 rounded-xl text-charcoal-900 placeholder:text-charcoal-400 focus:outline-none focus:ring-2 focus:ring-terracotta-600"
          />
        </div>

        <div className="text-xs text-charcoal-600 font-medium self-end sm:self-center">
          Showing <span className="font-bold text-charcoal-900">{filteredCategories.length}</span> of{' '}
          {categories.length} categories
        </div>
      </div>

      {/* ── CATEGORY GRID (1:1 IMAGE CARDS) ── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="p-4 bg-ivory-100 border border-charcoal-800/10 rounded-2xl shadow-soft flex gap-4 animate-pulse"
            >
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl bg-[#EFE9DF] aspect-square flex-shrink-0" />
              <div className="flex-1 space-y-2 py-2">
                <div className="h-4 w-28 bg-[#EFE9DF] rounded" />
                <div className="h-3 w-20 bg-[#EFE9DF] rounded" />
                <div className="h-6 w-24 bg-[#EFE9DF] rounded-full mt-4" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="p-12 text-center bg-ivory-100 border border-charcoal-800/10 rounded-2xl space-y-3">
          <Tag className="w-8 h-8 text-charcoal-400 mx-auto" />
          <p className="text-sm font-semibold text-charcoal-800">No categories match your search.</p>
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="text-xs text-terracotta-600 hover:underline"
          >
            Clear filter
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredCategories.map((cat) => {
            const isUploading = uploadingCatId === cat.id;
            const isEditing = editingCatId === cat.id;

            return (
              <div
                key={cat.id}
                className="bg-ivory-100 border border-charcoal-800/10 rounded-2xl p-4 sm:p-5 shadow-soft hover:shadow-soft-lg hover:border-terracotta-600/30 transition-all flex flex-col justify-between gap-4 group"
              >
                <div className="flex gap-4">
                  {/* 1:1 Square Image Container */}
                  <div className="w-24 h-24 sm:w-28 sm:h-28 aspect-square rounded-xl overflow-hidden bg-[#EFE9DF] border border-charcoal-800/10 shadow-xs relative flex-shrink-0 group/img">
                    {cat.image_url ? (
                      <img
                        src={cat.image_url}
                        alt={cat.name}
                        className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center text-charcoal-400">
                        <ImageIcon className="w-7 h-7 text-charcoal-400 mb-1" />
                        <span className="text-[10px] leading-tight">No 1:1 image</span>
                      </div>
                    )}

                    {/* Loading Overlay */}
                    {isUploading && (
                      <div className="absolute inset-0 bg-charcoal-900/60 backdrop-blur-xs flex flex-col items-center justify-center text-ivory-50 text-[10px] gap-1 z-10">
                        <Loader2 className="w-5 h-5 animate-spin text-terracotta-400" />
                        <span>Cropping 1:1...</span>
                      </div>
                    )}

                    {/* Hover Quick Upload overlay */}
                    {!isUploading && (
                      <button
                        type="button"
                        onClick={() => fileInputRefs.current[cat.id]?.click()}
                        className="absolute inset-0 bg-charcoal-900/50 opacity-0 group-hover/img:opacity-100 transition-opacity flex flex-col items-center justify-center text-ivory-50 text-[10px] font-semibold gap-1 cursor-pointer"
                        title="Click to replace 1:1 image"
                      >
                        <Upload className="w-4 h-4 text-ivory-100" />
                        <span>Change 1:1</span>
                      </button>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    {isEditing ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full px-2 py-1 text-xs bg-white border border-charcoal-800/20 rounded-md font-semibold"
                          placeholder="Category name"
                        />
                        <input
                          type="text"
                          value={editSlug}
                          onChange={(e) => setEditSlug(e.target.value)}
                          className="w-full px-2 py-1 text-[11px] bg-white border border-charcoal-800/20 rounded-md font-mono text-charcoal-600"
                          placeholder="slug"
                        />
                        <div className="flex gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => saveEdit(cat.id)}
                            disabled={savingEdit}
                            className="px-2 py-1 bg-sage-600 text-ivory-100 rounded text-[10px] font-semibold inline-flex items-center gap-1"
                          >
                            <Save className="w-3 h-3" />
                            <span>Save</span>
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="px-2 py-1 border border-charcoal-800/20 text-charcoal-700 rounded text-[10px]"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-1">
                          <h3 className="font-display font-bold text-sm sm:text-base text-charcoal-900 truncate leading-snug">
                            {cat.name}
                          </h3>
                          <button
                            type="button"
                            onClick={() => startEdit(cat)}
                            className="text-charcoal-400 hover:text-charcoal-800 p-0.5 rounded transition-colors"
                            title="Rename category or slug"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>

                        <p className="text-[11px] font-mono text-charcoal-500 truncate">
                          /{cat.slug}
                        </p>

                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-ivory-200 text-charcoal-800 border border-charcoal-800/10">
                            {cat.product_count} {cat.product_count === 1 ? 'item' : 'items'}
                          </span>

                          <a
                            href={`/catalog?category=${cat.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 text-[10px] text-terracotta-600 hover:text-terracotta-700 font-medium"
                          >
                            <span>View</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* 1:1 Action Buttons */}
                <div className="pt-2 border-t border-charcoal-800/10 flex items-center justify-between gap-2">
                  <input
                    type="file"
                    ref={(el) => (fileInputRefs.current[cat.id] = el)}
                    onChange={(e) => handleFileChange(cat.id, e)}
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRefs.current[cat.id]?.click()}
                    disabled={isUploading}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-semibold bg-terracotta-600 hover:bg-terracotta-700 text-ivory-50 shadow-soft-sm transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{cat.image_url ? 'Update 1:1 Image' : 'Upload 1:1 Image'}</span>
                  </button>

                  {cat.image_url && (
                    <button
                      type="button"
                      onClick={() => handleResetImage(cat.id)}
                      disabled={isUploading || deletingCatId === cat.id}
                      className="p-1.5 rounded-xl border border-charcoal-800/20 text-charcoal-500 hover:text-charcoal-900 hover:bg-ivory-200 transition-colors"
                      title="Reset to default image"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setDeleteConfirmCat(cat)}
                    disabled={isUploading || deletingCatId === cat.id}
                    className="p-1.5 rounded-xl border border-red-200 text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                    title={`Delete category ${cat.name}`}
                    aria-label={`Delete category ${cat.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── PENDING CATEGORY REQUESTS ── */}
      {categoryRequests.length > 0 && (
        <div className="p-5 sm:p-6 bg-ivory-100 border border-charcoal-800/10 rounded-2xl shadow-soft space-y-4">
          <h3 className="text-sm sm:text-base font-display font-bold text-charcoal-900 flex items-center gap-2">
            <span>Pending Category Requests ({categoryRequests.length})</span>
          </h3>
          <div className="divide-y divide-charcoal-800/10 text-xs">
            {categoryRequests.map((req) => (
              <div key={req.id} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <div className="font-semibold text-charcoal-900 text-sm">{req.name}</div>
                  <span className="text-[11px] text-charcoal-500">
                    Status: {req.status || 'Pending'}
                  </span>
                </div>

                {(!req.status || req.status === 'Pending') && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleApproveRequest(req)}
                      className="py-1.5 px-3 text-xs bg-sage-600 hover:bg-sage-700 text-ivory-100 rounded-xl font-semibold shadow-soft-sm transition-colors cursor-pointer"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRejectRequest(req.id)}
                      className="py-1.5 px-3 text-xs border border-charcoal-800/20 text-charcoal-700 hover:bg-ivory-200 rounded-xl font-medium transition-colors cursor-pointer"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── DELETE CATEGORY CONFIRMATION MODAL ── */}
      {deleteConfirmCat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-[#FAF6F0] rounded-2xl max-w-md w-full border border-charcoal-800/15 p-6 shadow-soft-xl space-y-4 animate-scale-up">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-display font-bold text-base text-charcoal-900">
                  Delete Category?
                </h3>
                <p className="text-xs text-charcoal-600 mt-1">
                  Are you sure you want to permanently delete{' '}
                  <span className="font-bold text-charcoal-900">
                    "{deleteConfirmCat.name}"
                  </span>
                  ?
                </p>
              </div>
            </div>

            <div className="bg-red-50/70 border border-red-200/60 rounded-xl p-3 text-xs text-red-800 space-y-1">
              <p className="font-semibold">⚠️ Safety Notice:</p>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-red-700">
                <li>Existing products will NOT be deleted; their category will simply be unlinked.</li>
                <li>This category will be removed from trending categories and homepage featured lists.</li>
                <li>This action cannot be undone.</li>
              </ul>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmCat(null)}
                disabled={deletingCatId === deleteConfirmCat.id}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-charcoal-800/20 text-charcoal-700 hover:bg-ivory-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteCategory(deleteConfirmCat)}
                disabled={deletingCatId === deleteConfirmCat.id}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-soft-sm cursor-pointer disabled:opacity-50"
              >
                {deletingCatId === deleteConfirmCat.id && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                <span>
                  {deletingCatId === deleteConfirmCat.id ? 'Deleting...' : 'Yes, Delete Category'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCategoryManager;

