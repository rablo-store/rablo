import React, { useState } from 'react';
import { Compass, Sparkles, CheckCircle2, ArrowRight, ShieldCheck, Heart, Instagram, Users, Zap, Award } from 'lucide-react';

interface Milestone {
  year: string;
  phase: string;
  title: string;
  status: 'completed' | 'current' | 'upcoming';
  description: string;
  highlight: string;
  metrics: string;
}

const MILESTONES: Milestone[] = [
  {
    year: '2024',
    phase: 'Phase 01',
    title: 'The Artisan Spark & Underground Discovery',
    status: 'completed',
    description: 'Began as a curated field journal tracking 50 exceptional home pottery studios and crochet artists across Bangalore, Mumbai, and Jaipur who were struggling against algorithmic shadowbans.',
    highlight: 'Curated 50 founding studios',
    metrics: '500+ Organic Leads'
  },
  {
    year: '2025',
    phase: 'Phase 02',
    title: 'Zero-Commission Protocol & 5-Click Smart Lead Cart',
    status: 'completed',
    description: 'Engineered the direct-to-DM routing architecture. Built the innovative 5-Click Lead Cart system that lets collectors bookmark multiple creators and initiates authentic Instagram DMs without gateway fees.',
    highlight: 'Zero checkout commissions launched',
    metrics: '₹0 Commission Charged'
  },
  {
    year: '2026',
    phase: 'Phase 03',
    title: 'The Verified Artisan Collective (Live Today)',
    status: 'current',
    description: 'Scaling to thousands of verified handmade creations across 15+ craft disciplines. Integrating rapid Google OAuth, 24-hour admin moderation, and high-resolution visual editorial galleries.',
    highlight: '1,200+ Active Listings',
    metrics: '15+ Craft Disciplines'
  },
  {
    year: '2027+',
    phase: 'Phase 04',
    title: 'Pan-India Craft Ateliers & Pop-Up Collective',
    status: 'upcoming',
    description: 'Expanding into physical weekend craft salons, artisan residency grants, and cross-border discovery pipelines connecting Indian heritage makers with international craft enthusiasts.',
    highlight: 'Physical exhibitions & maker grants',
    metrics: 'Global Studio Network'
  }
];

export const JourneySection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'timeline' | 'process'>('timeline');
  const [processRole, setProcessRole] = useState<'buyer' | 'creator'>('buyer');
  const [activeMilestoneIndex, setActiveMilestoneIndex] = useState<number>(2);

  return (
    <section id="journey" className="store-width py-16 sm:py-24 scroll-mt-24 sm:scroll-mt-28 border-t border-charcoal-800/10">
      <div className="space-y-12">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-4 border-b border-charcoal-800/10">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-lavender-100/70 border border-lavender-300/60 rounded-full text-[11px] font-semibold text-lavender-900 uppercase tracking-widest">
              <Compass className="w-3.5 h-3.5 text-lavender-700" />
              <span>The Rablo Journey & Roadmap</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-display font-medium text-charcoal-900 tracking-tight">
              From Hidden Instagram Profiles to a <em className="font-serif italic font-normal text-lavender-800">Nationwide Movement.</em>
            </h2>
            <p className="text-sm sm:text-base text-charcoal-600 leading-relaxed">
              Trace the evolution of our direct-to-maker platform, or explore how our seamless protocol works step-by-step for both collectors and creators.
            </p>
          </div>

          {/* Interactive Mode Toggle */}
          <div className="flex items-center p-1 bg-ivory-100 border border-charcoal-800/15 rounded-full flex-shrink-0 self-start md:self-auto">
            <button
              type="button"
              onClick={() => setActiveTab('timeline')}
              className={`px-4 py-2 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer ${
                activeTab === 'timeline'
                  ? 'bg-charcoal-900 text-ivory-100 shadow-sm'
                  : 'text-charcoal-700 hover:text-charcoal-900'
              }`}
            >
              Evolution Roadmap
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('process')}
              className={`px-4 py-2 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer ${
                activeTab === 'process'
                  ? 'bg-charcoal-900 text-ivory-100 shadow-sm'
                  : 'text-charcoal-700 hover:text-charcoal-900'
              }`}
            >
              Interactive Experience
            </button>
          </div>
        </div>

        {/* View 1: Evolution Timeline */}
        {activeTab === 'timeline' && (
          <div className="space-y-8 animate-fade-in">
            {/* Timeline Stepper Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {MILESTONES.map((m, idx) => {
                const isSelected = activeMilestoneIndex === idx;
                return (
                  <button
                    key={m.year}
                    type="button"
                    onClick={() => setActiveMilestoneIndex(idx)}
                    className={`p-4 rounded-sm border text-left transition-all duration-200 cursor-pointer relative overflow-hidden ${
                      isSelected
                        ? 'bg-charcoal-900 text-ivory-100 border-charcoal-900 shadow-soft-lg scale-[1.02]'
                        : 'bg-ivory-100 text-charcoal-800 border-charcoal-800/10 hover:border-charcoal-800/30 hover:bg-ivory-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-[11px] font-mono font-bold uppercase tracking-wider ${
                        isSelected ? 'text-lavender-300' : 'text-lavender-700'
                      }`}>
                        {m.phase}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        m.status === 'current'
                          ? 'bg-sage-600 text-ivory-100'
                          : m.status === 'completed'
                          ? isSelected ? 'bg-charcoal-800 text-charcoal-300' : 'bg-charcoal-800/10 text-charcoal-600'
                          : isSelected ? 'bg-lavender-900/60 text-lavender-200' : 'bg-lavender-100 text-lavender-800'
                      }`}>
                        {m.status === 'current' ? 'Live Now' : m.status === 'completed' ? 'Achieved' : 'Vision'}
                      </span>
                    </div>
                    <div className="font-display font-medium text-lg leading-tight mb-1">
                      {m.year}
                    </div>
                    <p className={`text-xs line-clamp-1 ${isSelected ? 'text-charcoal-300' : 'text-charcoal-500'}`}>
                      {m.title}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Active Milestone Deep-Dive Card */}
            {(() => {
              const current = MILESTONES[activeMilestoneIndex];
              return (
                <div className="p-8 sm:p-10 bg-ivory-100 border border-charcoal-800/10 rounded-sm shadow-soft relative overflow-hidden">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-charcoal-800/10 mb-6">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-mono text-lavender-700 font-bold mb-1">
                        <span>{current.phase}</span>
                        <span>·</span>
                        <span>{current.year}</span>
                      </div>
                      <h3 className="text-2xl sm:text-3xl font-display font-medium text-charcoal-900">
                        {current.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-3.5 py-1.5 bg-lavender-100 border border-lavender-200 rounded-full text-xs font-semibold text-lavender-800 font-mono">
                        {current.metrics}
                      </span>
                    </div>
                  </div>

                  <p className="text-sm sm:text-base text-charcoal-700 leading-relaxed max-w-3xl mb-6">
                    {current.description}
                  </p>

                  <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-charcoal-600">
                    <div className="flex items-center gap-1.5 text-sage-800">
                      <CheckCircle2 className="w-4 h-4 text-sage-600" />
                      <span>Key Milestone: {current.highlight}</span>
                    </div>
                    <span className="text-charcoal-400">·</span>
                    <span className="text-charcoal-500">Documented in Rablo Public Changelog</span>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* View 2: Interactive Process Walkthrough */}
        {activeTab === 'process' && (
          <div className="space-y-8 animate-fade-in">
            {/* Role Switcher */}
            <div className="flex justify-center">
              <div className="inline-flex p-1 bg-ivory-100 border border-charcoal-800/15 rounded-full">
                <button
                  type="button"
                  onClick={() => setProcessRole('buyer')}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer ${
                    processRole === 'buyer'
                      ? 'bg-charcoal-900 text-ivory-100 shadow-sm'
                      : 'text-charcoal-700 hover:text-charcoal-900'
                  }`}
                >
                  <Heart className="w-3.5 h-3.5 text-lavender-300" />
                  <span>The Collector's Journey (For Buyers)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setProcessRole('creator')}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer ${
                    processRole === 'creator'
                      ? 'bg-charcoal-900 text-ivory-100 shadow-sm'
                      : 'text-charcoal-700 hover:text-charcoal-900'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-peach-400" />
                  <span>The Creator's Journey (For Sellers)</span>
                </button>
              </div>
            </div>

            {/* 4 Interactive Steps */}
            {processRole === 'buyer' ? (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                  {
                    step: '01',
                    title: 'Discover Authentic Art',
                    desc: 'Browse our curated catalog of pottery, crochet, pressed flowers, and botanical prints from verified Indian makers.',
                    tag: 'Curation First'
                  },
                  {
                    step: '02',
                    title: 'Save to Lead Cart',
                    desc: 'Bookmark creations you love with a single tap. Keep all your favorite Instagram makers organized in one place.',
                    tag: '5-Click Smart Cart'
                  },
                  {
                    step: '03',
                    title: 'Jump Direct to DM',
                    desc: 'Tap "Chat on Instagram" to leap right into the artisan\'s DM with pre-filled context about the exact item you want.',
                    tag: 'Direct Connection'
                  },
                  {
                    step: '04',
                    title: 'Pay Direct via UPI',
                    desc: 'Agree on custom sizes or colors and pay the maker 100% directly via UPI/GPay. Zero marketplace markups or hidden fees.',
                    tag: '0% Middleman Fees'
                  }
                ].map((item) => (
                  <div key={item.step} className="p-6 bg-ivory-100 border border-charcoal-800/10 rounded-sm space-y-4 shadow-soft hover:-translate-y-1 transition-transform">
                    <div className="flex items-center justify-between">
                      <span className="w-8 h-8 rounded-full bg-lavender-100 text-lavender-800 font-mono font-bold text-xs flex items-center justify-center">
                        {item.step}
                      </span>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-charcoal-500 font-semibold">
                        {item.tag}
                      </span>
                    </div>
                    <h4 className="font-display font-medium text-base text-charcoal-900">
                      {item.title}
                    </h4>
                    <p className="text-xs text-charcoal-600 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                  {
                    step: '01',
                    title: 'Quick Google Auth',
                    desc: 'Sign in seamlessly with Google in one click. Link your verified Instagram handle and creator studio details.',
                    tag: 'Instant Setup'
                  },
                  {
                    step: '02',
                    title: 'Upload Your Pieces',
                    desc: 'Upload high-resolution photography, set your studio price, and describe your artisanal craft technique.',
                    tag: 'No Listing Fees'
                  },
                  {
                    step: '03',
                    title: 'Editorial Vetting (24h)',
                    desc: 'Our moderation team confirms your profile is an authentic maker rather than a drop-shipper to protect collective trust.',
                    tag: 'Vetted Quality'
                  },
                  {
                    step: '04',
                    title: 'Receive Qualified DMs',
                    desc: 'Serious buyers arrive straight in your Instagram DMs ready to purchase. You keep 100% of the money in your bank account.',
                    tag: '100% Retained Revenue'
                  }
                ].map((item) => (
                  <div key={item.step} className="p-6 bg-ivory-100 border border-charcoal-800/10 rounded-sm space-y-4 shadow-soft hover:-translate-y-1 transition-transform">
                    <div className="flex items-center justify-between">
                      <span className="w-8 h-8 rounded-full bg-sage-100 text-sage-800 font-mono font-bold text-xs flex items-center justify-center">
                        {item.step}
                      </span>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-charcoal-500 font-semibold">
                        {item.tag}
                      </span>
                    </div>
                    <h4 className="font-display font-medium text-base text-charcoal-900">
                      {item.title}
                    </h4>
                    <p className="text-xs text-charcoal-600 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Impact Bar */}
        <div className="p-6 bg-ivory-100 border border-charcoal-800/15 rounded-sm grid grid-cols-2 lg:grid-cols-4 gap-6 text-center shadow-soft">
          <div>
            <div className="font-display text-2xl sm:text-3xl font-bold text-charcoal-900">0%</div>
            <div className="text-xs text-charcoal-500 mt-0.5">Platform Commission Charged</div>
          </div>
          <div>
            <div className="font-display text-2xl sm:text-3xl font-bold text-charcoal-900">100%</div>
            <div className="text-xs text-charcoal-500 mt-0.5">Direct UPI Creator Payments</div>
          </div>
          <div>
            <div className="font-display text-2xl sm:text-3xl font-bold text-charcoal-900">&lt;24h</div>
            <div className="text-xs text-charcoal-500 mt-0.5">Editorial Verification Time</div>
          </div>
          <div>
            <div className="font-display text-2xl sm:text-3xl font-bold text-charcoal-900">1,200+</div>
            <div className="text-xs text-charcoal-500 mt-0.5">Direct Instagram Inquiries Routed</div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default JourneySection;
