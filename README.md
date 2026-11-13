# Rablo — Direct-to-DM Discovery Catalog & Brand Stores

<p align="center">
  <strong>Artisanal commerce platform connecting independent Instagram creators, small brands, and makers across India directly to buyers via Instagram & WhatsApp chat links.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Astro_7-BC52EE?style=for-the-badge&logo=astro&logoColor=white" alt="Astro 7" />
  <img src="https://img.shields.io/badge/React_18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React 18" />
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS_v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS v4" />
  <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/Cloudflare_Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white" alt="Cloudflare Workers" />
</p>

---

## ✦ Overview

**Rablo** rescues handmade craftsmanship, slow-fashion creations, and studio art from algorithmic fee-heavy platforms. Traditional marketplaces charge 20% to 35% commission fees, bury independent makers, and obscure direct buyer relationships.

Rablo eliminates the intermediary:
- **0% Platform Commissions**: Creators retain 100% of their earnings.
- **Direct-to-DM Ordering**: Buyers click directly into the creator's Instagram DM, WhatsApp, or Telegram with pre-filled context about the specific product, settling custom requests and payments directly via UPI.
- **Brand Store Architecture**: Every verified creator gets a dedicated brand store (`/creators/[slug]`) showcasing their story, verified credentials, contact settings, and creations.
- **5-Click Lead Cart**: Shoppers save products to a persistent lead pipeline. Re-engaging with creators is streamlined without gateway markups.

---

## ✦ Key Routes

| Route | Purpose | Rendering Mode |
|---|---|---|
| `/` | Artisanal landing page, hero showcase, trending feed | Static SSG |
| `/catalog` | Filterable product catalogue with live search, tags, and drawer filters | Static SSG + React Island |
| `/categories` | Visual craft directory tiles linked to filtered catalog | Static SSG / Dynamic |
| `/search` | Full-text product & creator search with tabs and query sanitizer | Dynamic SSR (`prerender = false`, `noindex`) |
| `/creators` | Directory of independent creators, artisans, and small brands | Dynamic SSR (`prerender = false`) |
| `/creators/[slug]` | Creator Brand Store profile with bio, stats, and creations | Dynamic SSR (`prerender = false`) |
| `/products/[id]` | Product detail view with specs, image gallery, and Contact CTA | Dynamic SSR (`prerender = false`) |
| `/cart` | Saved Lead Cart management | Dynamic SSR (`prerender = false`, `noindex`) |
| `/account` | User account overview, sign-in, and seller application | Dynamic SSR (`prerender = false`, `noindex`) |
| `/seller` | Creator Dashboard (Overview, Products, Leads, Profile, Contact Settings) | Dynamic SSR (`prerender = false`, `noindex`) |
| `/seller/upload` | Creator product upload & edit form with specs and contact link overrides | Dynamic SSR (`prerender = false`, `noindex`) |
| `/admin` | Superadmin moderation portal (Products, Brands, Categories, Users) | Dynamic SSR (`prerender = false`, `noindex`) |
| `/auth/callback` | OAuth redirect callback handling PKCE session exchange | Dynamic SSR (`prerender = false`, `noindex`) |

---

## ✦ Brand Store & Contact Resolution Model

Creators configure their store contact channel under **Profile Settings** in the Creator Dashboard:
- **Contact Type**: `instagram`, `whatsapp`, or `custom`
- **Link Template**: Pre-formatted URL with templated variables.
  - Supported placeholders:
    - `{product_name}`: URL-encoded product name (e.g. `Crochet%20Daisy%20Tote`)
    - `{product_price}`: Formatted product price (e.g. `₹899`)
    - `{product_url}`: Direct link to the product on Rablo
    - `{brand_name}`: Creator store brand name
  - Allowed URL hosts (strictly validated):
    - `instagram.com`, `ig.me`
    - `wa.me`, `api.whatsapp.com`
    - `t.me` (Telegram), `m.me` (Messenger)
- **Product-Level Overrides**: Sellers can optionally provide a product-specific chat link in `/seller/upload` which overrides the brand-default contact link when inquiries occur for that creation.

---

## ✦ Environment Flags

Configure environment variables in `.env` (or Cloudflare dashboard / wrangler vars):

```bash
# Supabase Configuration
PUBLIC_SUPABASE_URL=https://your-project.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Optional Service Role Key (for administrative scripts)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Authentication Flags
# Default is 'false' (one-tap Google OAuth). When 'true', displays the email sign-up/sign-in form.
PUBLIC_ENABLE_EMAIL_AUTH=false

# Demo Data Flag (Default: off/false). Prevents fake demo data from reaching real users.
PUBLIC_USE_DEMO_DATA=false
```

---

## ✦ Design System

Rablo's UI is designed with a warm, tactile artisanal palette:
- **Warm Ivory (`#FAF6F0`)**: Base surface and background.
- **Espresso (`#30251F`)**: Deep rich charcoal for high-contrast typography and borders.
- **Terracotta (`#9E4A2B`)**: Primary brand accents, badges, and primary buttons.
- **Clay (`#D9A37B`)**: Warm secondary highlights and pill accents.
- **Sage (`#637858`)**: Natural muted green for verification badges and positive status indicators.
- **Headings**: `Playfair Display` serif typography.
- **Body & UI**: `Inter` sans-serif typography.

---

## ✦ Verification & Testing

```bash
# Type check with strict TypeScript
npx tsc --noEmit

# Astro template validation
npx astro check

# Production build with Cloudflare Worker routing check
npm run build

# Run Playwright end-to-end test suite
npx playwright test
```
