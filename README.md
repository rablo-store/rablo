# Rablo — Direct-to-DM Discovery Catalog

<p align="center">
  <img src="public/brand/artisan-creator-hero.webp" alt="Rablo Artisan Discovery Platform" width="850" style="border-radius: 8px; box-shadow: 0 8px 30px rgba(0,0,0,0.12);" />
</p>

<p align="center">
  <strong>Decentralized commerce protocol connecting independent Instagram creators, makers, and artisans across India directly to buyers via Instagram DMs.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Astro-BC52EE?style=for-the-badge&logo=astro&logoColor=white" alt="Astro" />
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/Cloudflare-F38020?style=for-the-badge&logo=cloudflare&logoColor=white" alt="Cloudflare" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
</p>

---

## ✦ Overview

**Rablo** rescues handmade craftsmanship and slow-living creations from the noise of algorithmic marketplaces. Traditional mega-platforms extract 20% to 35% commission fees, bury small creators under mass-produced knockoffs, and hold customer relationships hostage behind algorithmic walls.

Rablo eliminates the intermediary:
- **0% Platform Commissions**: Creators retain 100% of their earnings.
- **Direct Instagram DMs**: Customers click directly into a maker's Instagram DM to discuss customization, sizing, and colors, settling payments directly via UPI.
- **5-Click Smart Lead Cart**: Shoppers save pieces to a persistent lead pipeline. Each outbound Instagram conversation is tracked; after 5 chats, the lead automatically graduates to keep the cart organized.
- **Zero-Reload In-Page Architecture**: High-speed, smooth in-page transitions between the discovery catalogue, brand philosophy, and community guidelines without full page reloads.

---

## ✦ Key Features

### 🛍️ Discovery Storefront & The Creator Edit
- **Interactive Multi-Filter Catalog**: Live search, budget range selectors (`Under ₹1,000`, `₹1,000–₹2,000`, `₹2,000+`), and category pills across crochet, ceramics, pressed-flower cases, botanical art prints, jewelry, and apparel.
- **Direct Instagram Deep-Linking**: Instant redirect to `@maker` Instagram DM with pre-formatted inquiry message.
- **Editorial Brand Philosophy**: Dedicated **Our Story** manifesto detailing the 4 core pillars of slow-crafted commerce.
- **Searchable Accordion FAQ**: Categorized knowledge base for buyers and makers covering UPI safety, listing guidelines, and lead management.

### 💼 Maker & Seller Portal (`/seller`)
- **Self-Service Listing Onboarding**: Dedicated product upload flow (`/seller/upload`) allowing artisans to publish catalog items with photography, dimensions, craft discipline, and pricing.
- **Instagram Handle Verification**: Automatic normalization of Instagram profiles and DM links.
- **Creator Dashboard**: Live metrics tracking product approvals, view counts, and total buyer inquiries generated.

### 🛡️ Admin Moderation & Security (`/admin`)
- **Moderation Queue**: Superadmin review workflow to inspect pending listings, verify photo quality and seller legitimacy, and publish or reject items with feedback.
- **Seller Governance**: Role-based access control with one-click seller suspension / ban capabilities.
- **Activity Telemetry**: Real-time audit logs of platform leads and moderation actions.

### 🔐 Authentication & Session Management
- **Google OAuth with PKCE**: Secure authentication powered by Supabase Auth with server-side cookie persistence.
- **Guest-to-User State Migration**: Seamless cart persistence across anonymous browsing and authenticated sessions.

---

## ✦ Tech Stack

| Domain | Technology | Details |
|---|---|---|
| **Framework** | [Astro](https://astro.build/) | Static Site Generation (SSG) with Server-Side Rendering (SSR) hybrid via `@astrojs/cloudflare` |
| **UI Islands** | [React 18](https://react.dev/) | Partial hydration (`client:load`, `client:visible`) for reactive filters, cart, auth, and dashboards |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) + Vanilla CSS | Warm ivory palette (`#FAF8F3`, `#EEE9E1`), deep charcoal (`#252321`), soft lavender (`#62537D`, `#8B7AA8`) |
| **Database** | [Supabase](https://supabase.com/) (PostgreSQL) | Fully relational schema with Row-Level Security (RLS) policies and storage buckets |
| **Authentication** | Supabase Auth | Google OAuth PKCE flow, session refresh, and role enforcement |
| **Icons** | [Lucide React](https://lucide.dev/) | Clean, accessible vector iconography |
| **Edge Hosting** | [Cloudflare Pages & Workers](https://pages.cloudflare.com/) | Global edge caching, CSP headers, and ultra-low TTFB |
| **Image Pipeline** | [Sharp](https://sharp.pixelplumbing.com/) | Automated build-time compression and modern WebP generation |

---

## ✦ Project Structure

```
rablo/
├── public/
│   ├── brand/               # Brand vectors, logos, and optimized hero imagery
│   │   ├── artisan-creator-hero.webp
│   │   ├── favicon.svg
│   │   └── og-image.png
│   ├── _headers             # Cloudflare Pages edge security headers (CSP, HSTS)
│   ├── robots.txt           # SEO indexing directives
│   └── site.webmanifest     # Web App Manifest
├── src/
│   ├── components/          # Astro layout blocks & static sections
│   │   ├── Header.astro     # Brand header with reactive islands & quick nav
│   │   ├── Footer.astro     # Editorial footer with sitemap links
│   │   ├── OurStorySection.astro # Brand philosophy, core pillars & manifesto
│   │   └── islands/         # Hydrated React interactive components
│   │       ├── SectionNav.tsx        # Sticky in-page zero-reload section switcher
│   │       ├── CatalogGrid.tsx       # Live search, filters & product grid
│   │       ├── CartButton.tsx        # Header lead cart trigger with counter
│   │       ├── CartView.tsx          # 5-click lead pipeline manager
│   │       ├── ProductUploadForm.tsx # Artisan listing submission island
│   │       ├── HeaderAuthButton.tsx  # Dynamic login/avatar profile button
│   │       ├── AccountView.tsx       # User profile and creator application
│   │       ├── FaqSection.tsx        # Searchable accordion FAQ
│   │       └── admin/
│   │           └── AdminDashboard.tsx# Moderation queue & seller controls
│   ├── config/              # Central site constants (`site.ts`)
│   ├── layouts/
│   │   └── BaseLayout.astro # Root HTML layout with OpenGraph, JSON-LD, and fonts
│   ├── lib/                 # Core client libraries & data stores
│   │   ├── supabase.ts      # Supabase client factory & auth state helpers
│   │   ├── products.ts      # Products query engine with RLS fallbacks
│   │   ├── cart.ts          # 5-click lead cart state & inquiry logger
│   │   └── storage.ts       # Storage bucket upload utilities
│   ├── pages/               # File-based routing
│   │   ├── index.astro      # Main discovery storefront & editorial sections
│   │   ├── catalog.astro    # Full creator archive view
│   │   ├── cart.astro       # Saved lead cart page
│   │   ├── products/[id].astro # Single product view with Instagram CTA
│   │   ├── seller/          # Seller landing and upload portal
│   │   ├── admin/           # Superadmin dashboard
│   │   ├── account/         # User profile and orders
│   │   └── auth/callback.astro # OAuth PKCE token exchange handler
│   └── styles/
│       └── global.css       # Core design tokens, typography, and scrim styling
├── supabase/
│   └── rablo_schema.sql     # Idempotent database schema, RLS policies & seed data
├── scripts/
│   └── postbuild.mjs        # Production asset validation & worker bundle verification
└── astro.config.mjs         # Astro compiler & Cloudflare adapter configuration
```

---

## ✦ Getting Started

### 1. Prerequisites
- **Node.js**: `v22.0.0` or higher
- **npm**: `v10.0.0` or higher
- A [Supabase](https://supabase.com/) project (Free tier works completely)

### 2. Installation
```bash
# Clone repository
git clone https://github.com/cumid-store/cumid.git rablo
cd rablo

# Install dependencies
npm install
```

### 3. Environment Variables
Create a `.env` file in the project root:

```env
# Supabase Configuration
PUBLIC_SUPABASE_URL=https://your-project.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Optional (for administrative migrations & test utilities)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 4. Database Setup
1. Log in to your [Supabase Dashboard](https://supabase.com/dashboard).
2. Open the **SQL Editor**.
3. Paste and run the entire contents of `supabase/rablo_schema.sql`.
   - Creates `profiles`, `products`, `lead_cart_items`, and `product_inquiries`.
   - Creates the `product-images` storage bucket with public read access.
   - Applies strict Row-Level Security (RLS) policies.
   - Populates initial verified showcase artisan creations.

### 5. Running Locally
```bash
# Start Astro development server
npm run dev
```
Open [http://localhost:4321](http://localhost:4321) in your browser.

---

## ✦ Available Scripts

| Command | Action |
|---|---|
| `npm run dev` | Starts local development server on port `4321` |
| `npm run build:quick` | Builds static & SSR assets with Cloudflare postbuild checks |
| `npm run build` | Runs full typecheck (`astro check`) + build + postbuild |
| `npm run preview` | Previews the built production bundle locally |
| `npm test` | Runs Playwright integration and E2E test suite |

---

## ✦ Architecture Highlights

### Direct-to-DM Protocol
```
[Buyer Discovers Craft] 
       ↓ 
[Taps 'Chat on IG'] 
       ↓
[Logs Inbound Lead to Supabase `product_inquiries`] 
       ↓ 
[Deep-links into instagram.com/direct/t/{seller_handle}]
       ↓
[Customization & UPI Payment settled 1-on-1 with Artisan]
```

### Row-Level Security (RLS) Matrix
- **`products`**: Public read for approved & unbanned listings. Authenticated creators can insert products under `pending` status. Only admin can update status to `approved`.
- **`profiles`**: Public read for unbanned creator bios and Instagram handles. Users can update their own bio. Admin retains update override for moderation.
- **`lead_cart_items`**: Strictly isolated to `auth.uid() = user_id`. Guest sessions fall back to client-side localStorage.

---

## ✦ Design System & Accessibility

- **Typography**: Editorial serif headings (`Georgia`, `font-display`) balanced with clean geometric sans (`Inter`, system UI).
- **Color Palette**:
  - `Ivory Background`: `#FAF8F3` (main), `#EEE9E1` (accent cards)
  - `Deep Charcoal Text`: `#252321` (high-contrast readability)
  - `Artisan Lavender`: `#62537D` (primary highlights & CTAs)
  - `Sage Green`: `#929C8A` (neutral badges)
- **WCAG Compliance**: High contrast ratios on all text and interactive buttons, explicit focus rings (`focus-visible:ring-2`), and semantic HTML5 landmark tags throughout.

---

## ✦ License & Attribution

Designed and maintained for **Rablo** — Empowering India's independent creative economy.  
Created with pride for indie makers, crochet artists, ceramists, and botanical creators.
