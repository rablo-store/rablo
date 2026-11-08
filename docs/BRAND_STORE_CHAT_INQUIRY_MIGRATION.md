# Brand Store & Direct Chat Inquiry Feature & Migration Guide

This guide details the **Brand Store & Direct Chat Inquiry** feature implemented across Rablo (Astro + React + Supabase), including database migrations, seller dashboard updates, frontend catalog cards, and dummy showcase product management.

---

## 1. Overview & Capabilities

The **Brand Store & Direct Chat Inquiry** feature allows instapreneurs and creators to provide a direct conversation link for each product:
- **WhatsApp Direct Chat** (e.g. `https://wa.me/919876543210?text=...` or standard phone numbers).
- **Instagram DM Link** (e.g. `https://instagram.com/direct/t/...` or profile URL).
- **Custom Chat / Portfolio / Brand Link** (e.g. Telegram, custom store inquiry page).

When a product has a `contact_link`:
1. **Catalog Cards (`CatalogGrid.tsx`)**: The standard action button displays a prominent **"Contact / Chat"** button styled with Rablo's signature brand plum (`#7C0E44`) and a chat bubble icon.
2. **Product Detail View (`ProductDetailView.tsx`)**: Features a **"Contact / Chat with Creator"** button and displays a "Direct Chat Inquiry Enabled" badge in the creator profile card.
3. **Safe New-Tab Redirection**: Clicking the button opens the creator's link in a new tab with `target="_blank" rel="noopener noreferrer"`.
4. **Auth Gating**: If the user is logged out, the Auth Modal pops up; upon login, they return to the exact same page and receive a confirmation banner with a one-click button to proceed to the chat inquiry link.

---

## 2. Database Schema Update (Supabase)

A new column `contact_link` (nullable `TEXT`) has been added to the `public.products` table.

### Migration File Location
`supabase/migrations/20261106_add_contact_link.sql`

### How to Apply in Supabase
1. Open your [Supabase Dashboard](https://supabase.com/dashboard).
2. Select your Rablo project.
3. In the left navigation, click on **SQL Editor**.
4. Click **New query**, paste the contents of `supabase/migrations/20261106_add_contact_link.sql` (or run the snippet below), and click **Run**:

```sql
-- 1. Add contact_link column if not present
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS contact_link TEXT;

COMMENT ON COLUMN public.products.contact_link IS 'Direct inquiry or chat URL for product orders (e.g. WhatsApp wa.me link, Instagram DM, or custom chat link)';

-- 2. Verify column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'products' AND column_name = 'contact_link';
```

---

## 3. Showcase Dummy Products & How to Remove Them

To showcase the Brand Store design board immediately, 7 curated dummy products matching the design board are included:
- **Crochet Daisy Tote Bag** (by `@crochetbynia`) - ₹899
- **Scented Soy Candle** (by `@thecandlelab`) - ₹599
- **Handmade Ceramic Mug Set** (by `@mudandmuse`) - ₹699
- **Flower Beaded Earrings** (by `@beadwithlove`) - ₹349
- **Aesthetic Wave Phone Case** (by `@casecove`) - ₹499
- **Embroidered Floral Canvas Pouch** (by `@threadtales`) - ₹589
- **Cute Indie Sticker Pack (20 pcs)** (by `@crochetbynia`) - ₹199

Each dummy product has pre-configured WhatsApp inquiry links (e.g. `https://wa.me/919876543210?text=Hi%20Nia%2C%20I%20am%20inquiring%20about%20the%20Crochet%20Daisy%20Tote%20Bag%20on%20Rablo`).

### How to Remove Dummy Products from the Admin Dashboard
You can delete any dummy (or real) product directly in the Admin Dashboard:
1. Log in with your admin account (`sumitkatiyar783@gmail.com`).
2. Navigate to `/admin`.
3. In the **Product Moderation** table, locate the dummy item.
4. Click the red **Delete** button (trash icon).
5. Confirm the deletion prompt.
   - The product is immediately removed from the database and local state.
   - The ID is persisted to `rablo:deleted_dummy_ids` in storage, guaranteeing it will **never reappear**, even if browsing in mock/offline mode.

---

## 4. Seller Upload & Management Form

In `/seller/upload` (`src/components/islands/ProductUploadForm.tsx`):
- Sellers have a dedicated input field: **"Product Inquiry / Chat Link (WhatsApp, Instagram DM, etc.)"**.
- Field accepts:
  - Full WhatsApp link: `https://wa.me/919876543210?text=Hello`
  - Raw phone number: `+91 98765 43210` (auto-formatted to `https://wa.me/...`)
  - Instagram profile/DM: `https://instagram.com/direct/t/...` or `@creator`
  - Any secure custom URL: `https://...`
- The link is saved into the `contact_link` column in Supabase.
- Sellers can preview their active direct chat links in `/seller/dashboard`.

---

## 5. Summary of Modified & Created Files

| File | Type | Changes |
| :--- | :--- | :--- |
| `supabase/migrations/20261106_add_contact_link.sql` | SQL | Adds `contact_link TEXT` column and seeds dummy products |
| `supabase/rablo_schema.sql` | SQL | Updated primary schema definition and conflict handlers |
| `src/lib/instagram.ts` | TypeScript | Added `getSafeInquiryUrl()` handling WhatsApp, custom links, and Instagram |
| `src/lib/products.ts` | TypeScript | Added `contact_link` to `Product`, normalization, dummy items, `deleteProduct`, and admin hooks |
| `src/components/islands/ProductUploadForm.tsx` | React | Added "Product Inquiry / Chat Link" form field and payload handling |
| `src/components/islands/SellerDashboard.tsx` | React | Displays "Direct Chat" badge and link in seller's catalog items |
| `src/components/islands/admin/AdminDashboard.tsx` | React | Added Delete product button, confirmation dialog, and direct chat link preview |
| `src/components/islands/CatalogGrid.tsx` | React | Displays prominent "Contact / Chat" button for items with `contact_link` |
| `src/components/islands/ProductDetailView.tsx` | React | "Contact / Chat with Creator" prominent CTA button and verified creator card badge |
| `src/layouts/BaseLayout.astro` | Astro | Post-login launcher banner supports WhatsApp, Instagram, and custom inquiry URLs |

