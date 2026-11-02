import React, { useState, useMemo } from 'react';
import { HelpCircle, Search, X, ChevronDown, MessageCircle, ExternalLink, ShieldCheck } from 'lucide-react';

interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category: 'buyers' | 'sellers' | 'payments' | 'cart';
}

const FAQ_DATA: FaqItem[] = [
  {
    id: 'faq-1',
    category: 'payments',
    question: 'How do transactions and payments work on Rablo?',
    answer: 'Rablo operates as a decentralized discovery catalog. We do not act as an escrow middleman and we never store your credit cards or banking details. When you find an item you adore, tap "Chat on Instagram" to leap directly into the creator\'s Instagram DMs. You finalize sizing, customization, and shipping directly with them, and pay them 100% directly through UPI (Google Pay, PhonePe, Paytm) or their preferred direct payment method with zero platform commissions.'
  },
  {
    id: 'faq-2',
    category: 'payments',
    question: 'Why is Rablo completely free (0% commission) for buyers and makers?',
    answer: 'Conventional marketplaces deduct 20% to 35% from independent artisans, forcing creators to inflate prices or sacrifice their margins. Rablo is built on a direct-to-DM protocol. By connecting buyers straight to the maker\'s Instagram, we eliminate expensive payment gateway processing fees and middleman administrative overhead. Makers keep 100% of their earnings, and collectors pay fair studio prices.'
  },
  {
    id: 'faq-3',
    category: 'cart',
    question: 'What is the 5-Click Smart Lead Cart rule?',
    answer: 'Your Lead Cart is designed specifically for direct-to-DM commerce rather than a traditional automated checkout. As you browse, save creations from various makers. Each time you tap "Chat on Instagram" to initiate a conversation, Rablo logs that inquiry visit. On the 5th outbound visit, the item is automatically retired from your cart. This prevents cart clutter and encourages meaningful, genuine buyer-maker relationships.'
  },
  {
    id: 'faq-4',
    category: 'sellers',
    question: 'How do I get my creations and Instagram shop listed on Rablo?',
    answer: 'Listing takes less than two minutes! Click "List Your Instagram Shop" or "+ List Product" in the header, sign in with your Google account, and submit your product photos, craft description, price, and Instagram handle. Our editorial moderation team manually reviews every listing within 24 hours to confirm authentic craft provenance before publishing it to the public catalog.'
  },
  {
    id: 'faq-5',
    category: 'buyers',
    question: 'How does Rablo ensure that makers and products are authentic?',
    answer: 'Every single listing is reviewed by human moderators before appearing in the catalog. We inspect the seller\'s public Instagram profile, verify active craft production (e.g. process videos, kiln openings, work-in-progress photos), and reject mass-produced drop-shipped items or unverified accounts. Look for the "Verified Maker" badge across creator cards.'
  },
  {
    id: 'faq-6',
    category: 'buyers',
    question: 'Can I request bespoke sizing, custom colors, or personalised commissions?',
    answer: 'Yes! That is the core beauty of direct-to-DM commerce. Unlike rigid marketplace carts with fixed dropdowns, clicking through to Instagram puts you in direct conversation with the artisan. You can share room photos for custom pottery dimensions, request specific yarn color palettes for crochet pieces, or commission personalized botanical art.'
  },
  {
    id: 'faq-7',
    category: 'sellers',
    question: 'Do I need a GST registration or a business bank account to sell on Rablo?',
    answer: 'No formal GST registration or corporate banking account is required to list on Rablo! We specifically empower independent solo-makers, students, women artisans, and home-based hobbyists across India. Because transactions occur directly between you and your customer via your personal UPI or preferred direct method, you manage your sales just like you normally do on Instagram.'
  },
  {
    id: 'faq-8',
    category: 'payments',
    question: 'What happens if a creator doesn\'t respond right away on Instagram?',
    answer: 'Most independent creators are solopreneurs who spend their working hours in pottery studios, knitting workshops, or art tables. Please allow 12 to 24 hours for a response, especially during weekends or festival seasons. If a creator remains inactive for several days, you can report the listing to our moderation desk, and we will update their listing status accordingly.'
  }
];

export const FaqSection: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({
    'faq-1': true, // Keep first open by default
  });

  const toggleAccordion = (id: string) => {
    setOpenIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const filteredFaqs = useMemo(() => {
    return FAQ_DATA.filter((item) => {
      // Category filter
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }

      // Search query
      const query = searchQuery.toLowerCase().trim();
      if (!query) return true;

      return (
        item.question.toLowerCase().includes(query) ||
        item.answer.toLowerCase().includes(query)
      );
    });
  }, [selectedCategory, searchQuery]);

  return (
    <section id="faq" className="store-width py-16 sm:py-24 scroll-mt-24 sm:scroll-mt-28 border-t border-charcoal-800/10">
      <div className="max-w-3xl mx-auto space-y-10">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-lavender-100/70 border border-lavender-300/60 rounded-full text-[11px] font-semibold text-lavender-900 uppercase tracking-widest">
            <HelpCircle className="w-3.5 h-3.5 text-lavender-700" />
            <span>Common Enquiries & Guidelines</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-display font-medium text-charcoal-900 tracking-tight">
            Frequently Asked <em className="font-serif italic font-normal text-lavender-800">Questions</em>
          </h2>
          <p className="text-sm sm:text-base text-charcoal-600 max-w-xl mx-auto leading-relaxed">
            Everything you need to know about our direct-to-DM model, zero-commission policy, and creator moderation.
          </p>
        </div>

        {/* Live Search Input */}
        <div className="relative max-w-lg mx-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search FAQs (e.g., payments, UPI, listing, cart)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-10 py-3 bg-ivory-100 border border-charcoal-800/20 rounded-full text-xs text-charcoal-800 placeholder:text-charcoal-500/70 focus:outline-none focus:ring-2 focus:ring-lavender-600 focus:bg-ivory-50 transition-colors shadow-soft"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-charcoal-400 hover:text-charcoal-700"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Category Pills */}
        <div className="flex items-center justify-center gap-2 flex-wrap text-xs">
          {[
            { id: 'all', label: 'All Queries' },
            { id: 'buyers', label: 'For Buyers' },
            { id: 'sellers', label: 'For Creators' },
            { id: 'payments', label: 'Payments & UPI' },
            { id: 'cart', label: 'Lead Cart & DM' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-charcoal-900 text-ivory-100 shadow-sm'
                  : 'bg-ivory-100 hover:bg-ivory-300 text-charcoal-700 border border-charcoal-800/15'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Accordion List */}
        <div className="space-y-3.5">
          {filteredFaqs.length === 0 ? (
            <div className="text-center py-12 px-6 bg-ivory-100 border border-charcoal-800/10 rounded-sm space-y-3">
              <p className="text-sm font-medium text-charcoal-800">
                No matching questions found for "{searchQuery}"
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                }}
                className="btn-secondary py-2 px-4 text-xs"
              >
                Reset FAQ Filters
              </button>
            </div>
          ) : (
            filteredFaqs.map((faq) => {
              const isOpen = Boolean(openIds[faq.id]);
              return (
                <div
                  key={faq.id}
                  className="bg-ivory-100 border border-charcoal-800/10 rounded-sm transition-all duration-200 shadow-soft overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleAccordion(faq.id)}
                    aria-expanded={isOpen}
                    className="w-full text-left p-5 flex items-center justify-between gap-4 cursor-pointer select-none group"
                  >
                    <span className="font-display font-medium text-sm sm:text-base text-charcoal-900 group-hover:text-lavender-800 transition-colors">
                      {faq.question}
                    </span>
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center border border-charcoal-800/10 flex-shrink-0 transition-transform duration-200 ${
                        isOpen
                          ? 'rotate-180 bg-charcoal-900 text-ivory-100'
                          : 'bg-ivory-200 text-charcoal-700 group-hover:bg-ivory-300'
                      }`}
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-charcoal-600 leading-relaxed border-t border-charcoal-800/10 animate-fade-in">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Still Have Questions? Banner */}
        <div className="p-6 sm:p-8 bg-ivory-100 border border-charcoal-800/15 rounded-sm flex flex-col sm:flex-row items-center justify-between gap-6 shadow-soft">
          <div className="space-y-1 text-center sm:text-left">
            <h4 className="font-display font-medium text-base text-charcoal-900">
              Still have questions about Rablo?
            </h4>
            <p className="text-xs text-charcoal-600">
              Our moderation and creator support desk is always happy to assist.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <a
              href="mailto:sumitkatiyar783@gmail.com"
              className="btn-secondary py-2.5 px-4 text-xs flex items-center gap-2"
            >
              <span>Email Support</span>
            </a>
            <a
              href="/seller/upload"
              className="btn-primary py-2.5 px-4 text-xs flex items-center gap-2"
            >
              <span>List Your Creations ↗</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FaqSection;
