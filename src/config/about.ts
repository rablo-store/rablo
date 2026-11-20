import { ADMIN_EMAIL, RABLO_INSTAGRAM_HANDLE } from './site';

export interface StepperStep {
  number: string;
  title: string;
  shortDesc: string;
  detailedDesc: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  field: string;
}

export interface FaqReference {
  id: string;
  question: string;
  answer: string;
  targetAudience: 'shopper' | 'seller';
}

export interface AboutCopy {
  hero: {
    badge: string;
    title: string;
    tagline: string;
    description: string;
    shopperCta: string;
    sellerCta: string;
  };
  whatIsRijlo: {
    heading: string;
    whatItIsTitle: string;
    whatItIsDesc: string;
    whatItIsNotTitle: string;
    whatItIsNotDesc: string;
    highlights: Array<{
      title: string;
      description: string;
    }>;
  };
  audienceSection: {
    heading: string;
    subheading: string;
    shopperView: {
      tabLabel: string;
      title: string;
      subtitle: string;
      steps: StepperStep[];
      benefitsTitle: string;
      benefits: string[];
      exploreLinks: Array<{ label: string; href: string }>;
    };
    sellerView: {
      tabLabel: string;
      title: string;
      subtitle: string;
      steps: StepperStep[];
      checklistTitle: string;
      checklistSubtitle: string;
      checklist: ChecklistItem[];
      sellerCta: { label: string; href: string };
    };
  };
  trustAndSafety: {
    badge: string;
    heading: string;
    description: string;
    verificationTitle: string;
    verificationDesc: string;
    moderationTitle: string;
    moderationDesc: string;
    statusesTitle: string;
    statusesDesc: string;
    statuses: Array<{
      name: string;
      scope: string;
      meaning: string;
    }>;
  };
  philosophy: {
    badge: string;
    quoteTitle: string;
    quoteSubtitle: string;
    originIntro: string;
    problemTitle: string;
    problemNumber: string;
    problemDesc: string;
    solutionTitle: string;
    solutionNumber: string;
    solutionDesc: string;
    pillarsTitle: string;
    pillarsSubtitle: string;
    pillars: Array<{
      number: string;
      title: string;
      description: string;
    }>;
    manifestoBadge: string;
    manifestoQuote: string;
    manifestoAttribution: string;
  };
  faq: {
    badge: string;
    heading: string;
    subtitle: string;
    items: FaqReference[];
    viewAllCta: { label: string; href: string };
  };
  contactAndPolicies: {
    heading: string;
    subtitle: string;
    policies: Array<{ label: string; href: string; description: string }>;
    adminEmail: string;
    officialInstagram: string;
    // Optional owner-fillable fields (empty string hides element on page)
    ownerEmail: string; // TODO: owner to fill
    ownerInstagram: string; // TODO: owner to fill
    founderNote: string; // TODO: owner to fill
  };
  closingCta: {
    heading: string;
    description: string;
    browseButton: { label: string; href: string };
    sellerButton: { label: string; href: string };
  };
}

export const AUDIENCE_COPY: AboutCopy['audienceSection'] = {
  heading: 'How Rijlo Works',
  subheading: 'Tailored paths for shoppers seeking bespoke craft and creators building independent brands.',
  shopperView: {
    tabLabel: 'For Shoppers',
    title: 'A Simple, Human Way to Shop Independent',
    subtitle: 'From discovery to bespoke studio conversation in four natural steps.',
    steps: [
      {
        number: '01',
        title: 'Discover',
        shortDesc: 'Explore independent makers and artisanal craft across India.',
        detailedDesc:
          'Browse curated collections across crochet, handmade ceramics, botanical art, silver jewelry, and indie apparel. Filter by category, discover trending creators, and view authentic studio pieces.',
      },
      {
        number: '02',
        title: 'Save',
        shortDesc: 'Save your favorite pieces into your personal Lead Cart.',
        detailedDesc:
          'Use the Lead Cart to organize items you love while browsing. Keep track of different artisans without commitment, comparing pieces at your own pace.',
      },
      {
        number: '03',
        title: 'DM',
        shortDesc: 'Leap directly into the creator’s Instagram direct messages.',
        detailedDesc:
          'Click "Chat on Instagram" on any product or from your Lead Cart. Rijlo automatically generates a direct Instagram DM link with the item details, starting a one-on-one conversation.',
      },
      {
        number: '04',
        title: 'Shop via Instagram',
        shortDesc: 'Finalize sizing, custom requests, and pay directly via UPI.',
        detailedDesc:
          'Speak directly with the artisan to select specific colors, custom dimensions, or delivery preferences. Pay the creator directly via UPI with zero middleman deductions.',
      },
    ],
    benefitsTitle: 'Why Shoppers Love Rijlo',
    benefits: [
      'Direct relationship with the real artisan behind each piece.',
      '100% of your payment supports the creator without middleman commission deductions.',
      'Easy customization, bespoke sizing, and personalized color palettes.',
      'No algorithmic price inflation or hidden platform checkout surcharges.',
    ],
    exploreLinks: [
      { label: 'Browse Catalog', href: '/catalog' },
      { label: 'Explore Creators', href: '/creators' },
      { label: 'Shop by Category', href: '/categories' },
    ],
  },
  sellerView: {
    tabLabel: 'For Sellers',
    title: 'Grow Your Instagram Brand with Zero Take-Rate',
    subtitle: 'List your authentic crafts, verify your Instagram profile, and receive direct buyer leads.',
    steps: [
      {
        number: '01',
        title: 'Sign In with Google',
        shortDesc: 'Create an account to access the creator portal.',
        detailedDesc:
          'Sign in using your Google account at /account. This establishes your creator identity and links your store management permissions securely.',
      },
      {
        number: '02',
        title: 'Register Your Brand',
        shortDesc: 'Set up your studio name, handle, bio, and Instagram profile.',
        detailedDesc:
          'Choose your creator type (Individual Artisan or Small Brand), claim your unique store URL slug, provide your bio, logo, and Instagram handle. Your brand status starts as "Pending".',
      },
      {
        number: '03',
        title: 'Verify Handle Ownership',
        shortDesc: 'Prove your Instagram handle via Bio Code or Direct Message.',
        detailedDesc:
          'Verify ownership using either Option A: add a temporary 7-day bio verification code (e.g. RABLO-XXXXXX) to your Instagram bio, or Option B: send a direct message to @rijlo.com. Once confirmed, your brand is marked verified.',
      },
      {
        number: '04',
        title: 'Editorial Moderation Review',
        shortDesc: 'Our team reviews your studio profile for authentic craftsmanship.',
        detailedDesc:
          'We review your Instagram profile and active craft production to filter out drop-shipped goods. Upon review, your brand status changes to "Approved" (or "Rejected" with actionable feedback).',
      },
      {
        number: '05',
        title: 'List Your Products',
        shortDesc: 'Upload piece photos, fair studio pricing, and craft details.',
        detailedDesc:
          'Using the upload form at /seller/upload, add product title, price in ₹, cover photo, category, and optional gallery photos or bulk-order/export options. New products submit as "Pending".',
      },
      {
        number: '06',
        title: 'Receive Direct Customer Leads',
        shortDesc: 'Shoppers browse your listings and DM you directly to purchase.',
        detailedDesc:
          'Once products receive "Approved" status from moderation, they appear in public search and catalog feeds. Shoppers click to chat on Instagram, where you confirm orders and receive UPI payments.',
      },
    ],
    checklistTitle: 'Before You List: Required Product Fields',
    checklistSubtitle:
      'These are the required fields needed to submit a product for review in the seller upload form. Ticking items helps you prepare your listing.',
    checklist: [
      {
        id: 'check-title',
        label: 'Product Title / Name',
        description: 'A descriptive name for your handmade piece (e.g., "Hand-Thrown Speckled Mug").',
        field: 'name',
      },
      {
        id: 'check-price',
        label: 'Selling Price in INR (₹)',
        description: 'A valid numeric price in Indian Rupees. You keep 100% of this amount.',
        field: 'price',
      },
      {
        id: 'check-cover',
        label: 'Cover Photo (Thumbnail URL)',
        description: 'A high-quality image showcasing the finished piece.',
        field: 'thumbnail_url',
      },
      {
        id: 'check-brand',
        label: 'Approved Brand Registration',
        description: 'Your brand must be registered and approved by moderation prior to listing products.',
        field: 'brand_id',
      },
    ],
    sellerCta: { label: 'Go to Creator Dashboard', href: '/seller' },
  },
};

export const ABOUT_COPY: AboutCopy = {
  hero: {
    badge: 'About Rijlo',
    title: 'Discover. Save. DM. Shop via Instagram.',
    tagline: 'A discovery catalog for independent Instagram sellers and artisans in India.',
    description:
      'Rijlo bridges the gap between discerning shoppers and authentic creators. Explore handmade craft, discover independent studios, and connect directly on Instagram with zero platform fees.',
    shopperCta: "I'm a Shopper",
    sellerCta: "I'm a Seller",
  },
  whatIsRijlo: {
    heading: 'What Rijlo Is — and What It Is Not',
    whatItIsTitle: 'A Decentralized Discovery Catalog',
    whatItIsDesc:
      'Rijlo is an open discovery index designed specifically for independent creators, solopreneurs, and artisanal brands across India. Shoppers browse collections, save pieces to their Lead Cart, and connect directly with makers on Instagram.',
    whatItIsNotTitle: 'Not an Escrow or Traditional Marketplace',
    whatItIsNotDesc:
      'Rijlo does not process payments, does not store credit cards, and does not hold customer funds in escrow. Transactions occur directly between the buyer and the maker through UPI (Google Pay, PhonePe, Paytm) on Instagram. We charge zero platform commission and deduct zero gateway fees.',
    highlights: [
      {
        title: '0% Platform Commission',
        description:
          'Makers retain 100% of their earnings. No cut, no commission tax, and no subscription listing fees.',
      },
      {
        title: 'Direct-to-DM Connection',
        description:
          'Shoppers leap directly into the artisan’s Instagram DM with item details prefilled to discuss sizing, customizations, and shipping.',
      },
      {
        title: 'Curated Authentic Craft',
        description:
          'Every brand profile and product listing undergoes human moderation to ensure authentic craftsmanship over mass-produced knockoffs.',
      },
    ],
  },
  audienceSection: AUDIENCE_COPY,
  trustAndSafety: {
    badge: 'Trust & Safety',
    heading: 'Clear, Human-Centric Moderation',
    description:
      'We believe trust is built through transparent verification and human review, not black-box algorithms.',
    verificationTitle: 'Instagram Handle Verification',
    verificationDesc:
      'To prevent impersonation, every creator must verify ownership of their Instagram handle. Creators either place a temporary verification code in their Instagram bio for automated verification or send a confirmation DM to our official Instagram handle. Once confirmed, the brand is marked verified.',
    moderationTitle: 'Editorial Listing Moderation',
    moderationDesc:
      'Every brand application and product listing is reviewed by human moderators before publishing. We check for genuine craft production—such as work-in-progress posts, studio process, and artisanal authenticity—to protect buyers and support honest creators.',
    statusesTitle: 'Real Statuses in Rijlo',
    statusesDesc:
      'We use explicit, straightforward statuses for all brands and products across the platform:',
    statuses: [
      {
        name: 'Pending',
        scope: 'Brands & Products',
        meaning:
          'Newly submitted brand or product awaiting editorial review. Not yet visible in public catalog searches.',
      },
      {
        name: 'Approved',
        scope: 'Brands & Products',
        meaning:
          'Verified and reviewed by our moderation team. Live in public feeds, category listings, and creator profiles.',
      },
      {
        name: 'Rejected',
        scope: 'Brands & Products',
        meaning:
          'Does not meet authenticity criteria or missing required craft proof. Includes specific feedback for re-submission.',
      },
      {
        name: 'is_verified: true',
        scope: 'Creator Brands',
        meaning:
          'The creator has confirmed direct ownership of the linked Instagram handle via bio-code or direct message.',
      },
    ],
  },
  philosophy: {
    badge: 'The Rijlo Philosophy & Origins',
    quoteTitle: 'In a world of fast algorithms,',
    quoteSubtitle: 'we champion the patient hand.',
    originIntro:
      'Rijlo was created to rescue authentic craftsmanship from the noise of commoditized e-commerce, offering a direct bridge between discerning buyers and independent Instagram artisans.',
    problemTitle: 'The Problem: The Algorithmic Toll Booth',
    problemNumber: '01',
    problemDesc:
      'Every day across India, master ceramicists fire clay in small kilns, crochet artists spend twelve continuous hours forming bespoke knitwear, and painters detail delicate botanicals on cotton rag. Yet when they attempt to sell online, traditional mega-marketplaces demand 25% to 35% commission fees, impose algorithmic penalties, and bury their authentic work beneath mass-manufactured drop-shipped knockoffs.',
    solutionTitle: 'Our Answer: Direct-to-DM Decentralized Commerce',
    solutionNumber: '02',
    solutionDesc:
      'We asked ourselves a simple question: What if discovery had zero toll booths? Rijlo operates with a strict 0% take-rate policy. When you discover an artist here, we route you straight into their Instagram DM. You converse directly with the creator, request custom dimensions, select yarn shades, and settle payments directly via UPI. No checkout lock-in, no escrow fees, and no corporate intermediary taking a slice of an artist\'s livelihood.',
    pillarsTitle: 'The Four Pillars of Rijlo',
    pillarsSubtitle: 'How we preserve the integrity of slow-crafted commerce.',
    pillars: [
      {
        number: '01',
        title: 'Zero Platform Tax',
        description:
          'Creators take home every single rupee they charge. By routing leads straight to Instagram and UPI, we eliminate payment gateway deductions.',
      },
      {
        number: '02',
        title: 'Direct Human Touch',
        description:
          'No faceless support bots. When you buy through Rijlo, you speak with the artist directly, fostering relationships and custom bespoke requests.',
      },
      {
        number: '03',
        title: 'Manual Curation',
        description:
          'Every creation on Rijlo is reviewed by real humans. We verify Instagram activity, review craftsmanship authenticity, and filter out low-grade replicas.',
      },
      {
        number: '04',
        title: 'Slow Living Focus',
        description:
          'We celebrate pieces made to last generations—from stoneware ceramics and archival botanical resin to hand-knitted cardigans that tell a story.',
      },
    ],
    manifestoBadge: '✦ The Artisan Manifesto',
    manifestoQuote:
      '"Art is not something that should be cheapened by algorithms or stripped of its maker\'s identity. When you buy handmade, you\'re buying hundreds of hours of failed attempts, experimentation, and pure devotion."',
    manifestoAttribution: 'The Rijlo Collective · Dedicated to the Independent Creators of India',
  },
  faq: {
    badge: 'Frequently Asked Questions',
    heading: 'Common Questions About Rijlo',
    subtitle: 'Transparent answers regarding payments, moderation, and our direct-to-DM model.',
    items: [
      {
        id: 'faq-1',
        targetAudience: 'shopper',
        question: 'How do transactions and payments work on Rijlo?',
        answer:
          'Rijlo operates as a decentralized discovery catalog. We do not act as an escrow middleman and we never store your credit cards or banking details. When you find an item you adore, tap "Chat on Instagram" to leap directly into the creator\'s Instagram DMs. You finalize sizing, customization, and shipping directly with them, and pay them 100% directly through UPI (Google Pay, PhonePe, Paytm) or their preferred direct payment method with zero platform commissions.',
      },
      {
        id: 'faq-2',
        targetAudience: 'shopper',
        question: 'Why is Rijlo completely free (0% commission) for buyers and makers?',
        answer:
          'Conventional marketplaces deduct 20% to 35% from independent artisans, forcing creators to inflate prices or sacrifice their margins. Rijlo is built on a direct-to-DM protocol. By connecting buyers straight to the maker\'s Instagram, we eliminate expensive payment gateway processing fees and middleman administrative overhead. Makers keep 100% of their earnings, and collectors pay fair studio prices.',
      },
      {
        id: 'faq-3',
        targetAudience: 'shopper',
        question: 'What is the 5-Click Smart Lead Cart rule?',
        answer:
          'Your Lead Cart is designed specifically for direct-to-DM commerce rather than a traditional automated checkout. As you browse, save creations from various makers. Each time you tap "Chat on Instagram" to initiate a conversation, Rijlo logs that inquiry visit. On the 5th outbound visit, the item is automatically retired from your cart. This prevents cart clutter and encourages meaningful, genuine buyer-maker relationships.',
      },
      {
        id: 'faq-5',
        targetAudience: 'shopper',
        question: 'How does Rijlo ensure that makers and products are authentic?',
        answer:
          'Every single listing is reviewed by human moderators before appearing in the catalog. We inspect the seller\'s public Instagram profile, verify active craft production (e.g. process videos, kiln openings, work-in-progress photos), and reject mass-produced drop-shipped items or unverified accounts. Look for the "Verified Maker" badge across creator cards.',
      },
      {
        id: 'faq-6',
        targetAudience: 'shopper',
        question: 'Can I request bespoke sizing, custom colors, or personalised commissions?',
        answer:
          'Yes! That is the core beauty of direct-to-DM commerce. Unlike rigid marketplace carts with fixed dropdowns, clicking through to Instagram puts you in direct conversation with the artisan. You can share room photos for custom pottery dimensions, request specific yarn color palettes for crochet pieces, or commission personalized botanical art.',
      },
      {
        id: 'faq-8',
        targetAudience: 'shopper',
        question: 'What happens if a creator doesn\'t respond right away on Instagram?',
        answer:
          'Most independent creators are solopreneurs who spend their working hours in pottery studios, knitting workshops, or art tables. Please allow 12 to 24 hours for a response, especially during weekends or festival seasons. If a creator remains inactive for several days, you can report the listing to our moderation desk, and we will update their listing status accordingly.',
      },
      {
        id: 'faq-4',
        targetAudience: 'seller',
        question: 'How do I get my creations and Instagram shop listed on Rijlo?',
        answer:
          'Listing takes less than two minutes! Click "List Your Instagram Shop" or "+ List Product" in the header, sign in with your Google account, and submit your product photos, craft description, price, and Instagram handle. Our editorial moderation team manually reviews every listing within 24 hours to confirm authentic craft provenance before publishing it to the public catalog.',
      },
      {
        id: 'faq-7',
        targetAudience: 'seller',
        question: 'Do I need a GST registration or a business bank account to sell on Rijlo?',
        answer:
          'No formal GST registration or corporate banking account is required to list on Rijlo! We specifically empower independent solo-makers, students, women artisans, and home-based hobbyists across India. Because transactions occur directly between you and your customer via your personal UPI or preferred direct method, you manage your sales just like you normally do on Instagram.',
      },
    ],
    viewAllCta: { label: 'See all questions on our dedicated FAQ page', href: '/faq' },
  },
  contactAndPolicies: {
    heading: 'Contact & Policies',
    subtitle: 'Transparent terms and direct contact channels.',
    policies: [
      {
        label: 'Terms of Service',
        href: '/terms',
        description: 'Read our platform terms regarding independent transactions and catalog use.',
      },
      {
        label: 'Privacy Policy',
        href: '/privacy',
        description: 'Learn how your account information and authentication data are protected.',
      },
      {
        label: 'Frequently Asked Questions',
        href: '/faq',
        description: 'Detailed answers on the 5-Click lead cart, UPI payments, and creator guidelines.',
      },
    ],
    adminEmail: ADMIN_EMAIL,
    officialInstagram: RABLO_INSTAGRAM_HANDLE,
    // Optional owner-fillable fields (empty string hides element on page)
    ownerEmail: '', // TODO: owner to fill
    ownerInstagram: '', // TODO: owner to fill
    founderNote: '', // TODO: owner to fill
  },
  closingCta: {
    heading: 'Experience Independent Commerce in India',
    description:
      'Whether you are searching for one-of-a-kind handmade pieces or ready to showcase your studio craft to thousands of shoppers, Rijlo is here for you.',
    browseButton: { label: 'Explore Discovery Catalog', href: '/catalog' },
    sellerButton: { label: 'Start Selling on Rijlo', href: '/seller' },
  },
};

