"use client";

import React from "react";
import { TenantBranding, PromotionTierConfig } from "@/lib/types";
import { PROMOTION_GRID_CLASSES, promotionColumns, promotionModalMaxWidth } from "@/lib/promotion-layout";

interface Props {
  branding: TenantBranding;
  tiers: PromotionTierConfig[];
  onSelect: (tier: PromotionTierConfig) => void;
  onClose: () => void;
  loading: boolean;
  bottomOffset?: number | null;
}

export default function PromotionModal({ branding, tiers, onSelect, onClose, loading, bottomOffset }: Props) {
  const primary = branding.primary_color || "#3B82F6";
  const columns = promotionColumns(tiers.length);

  // Sized to the column count so 1–2 tiers don't stretch across a wide modal.
  // `width` still caps it at the viewport: the form lives in an iframe the
  // customer sizes, and the grid drops columns as that gets narrower.
  const maxWidth = promotionModalMaxWidth(columns);
  // Tall enough to hold every tier, but never past the top of the iframe:
  // when anchored above the Submit button, the room is what's above it.
  const maxHeight = bottomOffset != null ? `calc(100vh - ${bottomOffset}px - 12px)` : "calc(100vh - 24px)";
  const modalStyle: React.CSSProperties = bottomOffset != null
    ? { position: "absolute", bottom: bottomOffset, left: "50%", transform: "translateX(-50%)", width: "calc(100% - 24px)", maxWidth, maxHeight }
    : { position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "calc(100% - 24px)", maxWidth, maxHeight };

  return (
    <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose}>
      <div
        style={modalStyle}
        className="bg-white rounded-2xl shadow-2xl overflow-hidden relative flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-4 pr-10 flex-shrink-0">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Promotion Options</h2>
          <p className="text-gray-500 text-sm mt-1">Choose how you'd like to list your event</p>
        </div>

        {/* Cards wrap into rows rather than scrolling sideways (ENG-764): a
            customer can configure any number of tiers, and a sideways row with
            a hidden scrollbar made every tier past the visible ones look cut
            off. Only the card area scrolls, vertically, so the header and
            close button stay put. The scroll lives on a wrapper, not the grid:
            a height-capped grid shrinks its rows and clips the tallest card. */}
        <div className="min-h-0 overflow-y-auto">
          <div className={`grid ${PROMOTION_GRID_CLASSES[columns]} gap-4 px-5 pb-6`}>
            {tiers.map(tier => (
              <TierCard key={tier.id} tier={tier} primary={primary} loading={loading} onSelect={onSelect} />
            ))}
          </div>
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function TierCard({
  tier,
  primary,
  loading,
  onSelect,
}: {
  tier: PromotionTierConfig;
  primary: string;
  loading: boolean;
  onSelect: (tier: PromotionTierConfig) => void;
}) {
  const isPaid = !!tier.stripe_price_id;
  // Full row height with the CTA pinned to the bottom, so buttons line up
  // across a row even when one tier lists more features.
  const sizeClass = "flex flex-col";
  const handleSelect = () => onSelect(tier);

  if (tier.highlight) {
    return (
      <div className={`rounded-xl border-2 overflow-hidden ${sizeClass}`} style={{ borderColor: primary }}>
        <div
          className="text-white text-center py-2 font-semibold text-sm tracking-wide"
          style={{ backgroundColor: primary }}
        >
          {tier.label}
        </div>
        <div className="p-4 flex flex-col gap-3 flex-1 bg-blue-50/40">
          <div className="text-center">
            <span className="text-2xl sm:text-3xl font-bold whitespace-nowrap text-gray-900">
              {isPaid ? tier.price_display : "FREE"}
            </span>
          </div>
          <ul className="space-y-2.5 text-sm text-gray-700 flex-1">
            {tier.features.map((f, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="flex-shrink-0 text-base leading-5">{f.emoji}</span>
                <div>
                  <p className="font-semibold leading-tight">{f.label}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{f.description}</p>
                </div>
              </li>
            ))}
          </ul>
          <button
            onClick={handleSelect}
            disabled={loading}
            className="mt-1 w-full py-3 rounded-lg font-semibold text-white transition-opacity disabled:opacity-60 text-sm"
            style={{ backgroundColor: primary }}
          >
            {loading ? (isPaid ? "Redirecting..." : "Submitting...") : tier.cta}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border-2 border-gray-200 overflow-hidden ${sizeClass}`}>
      <div className="bg-gray-100 text-gray-700 text-center py-2 font-semibold text-sm tracking-wide">
        {tier.label}
      </div>
      <div className="p-4 flex flex-col gap-3 flex-1">
        <div className="text-center">
          <span className="text-2xl sm:text-3xl font-bold whitespace-nowrap text-gray-400">
            {isPaid ? tier.price_display : "FREE"}
          </span>
        </div>
        <ul className="space-y-2.5 text-sm text-gray-700 flex-1">
          {tier.features.map((f, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="flex-shrink-0 text-base leading-5">{f.emoji}</span>
              <div>
                <p className="font-semibold leading-tight">{f.label}</p>
                <p className="text-gray-500 text-xs mt-0.5">{f.description}</p>
              </div>
            </li>
          ))}
        </ul>
        <button
          onClick={handleSelect}
          disabled={loading}
          className="mt-1 w-full py-3 rounded-lg font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-60 text-sm"
        >
          {loading ? (isPaid ? "Redirecting..." : "Submitting...") : tier.cta}
        </button>
      </div>
    </div>
  );
}
