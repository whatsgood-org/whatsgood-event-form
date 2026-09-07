"use client";

import React, { useEffect, useRef, useState } from "react";
import { TenantBranding, PromotionTierConfig } from "@/lib/types";

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
  const scrollable = true;

  const scrollRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({ dragging: false, startX: 0, scrollLeft: 0, moved: false });

  // Whether the card row actually overflows right now. Measured rather than
  // inferred from tier count: the embedding iframe sets the width, so the same
  // three tiers scroll on one customer's site and fit on another's.
  const [scrolls, setScrolls] = useState(false);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setScrolls(el.scrollWidth > el.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [tiers.length]);

  function onMouseDown(e: React.MouseEvent) {
    const el = scrollRef.current;
    if (!el) return;
    dragState.current = { dragging: true, startX: e.pageX - el.offsetLeft, scrollLeft: el.scrollLeft, moved: false };
    el.style.cursor = "grabbing";
  }

  function onMouseMove(e: React.MouseEvent) {
    const el = scrollRef.current;
    if (!dragState.current.dragging || !el) return;
    e.preventDefault();
    const dx = e.pageX - el.offsetLeft - dragState.current.startX;
    if (Math.abs(dx) > 4) dragState.current.moved = true;
    el.scrollLeft = dragState.current.scrollLeft - dx;
  }

  function onMouseUp() {
    dragState.current.dragging = false;
    if (scrollRef.current) scrollRef.current.style.cursor = "grab";
  }

  // Two cards fit comfortably in 42rem; a third overflowed and looked clipped,
  // because the row scrolls with its scrollbar hidden. Widen with the tier
  // count so the common 3-tier case fits outright. `width` still caps this at
  // the viewport — the form is embedded in an iframe the customer sizes, so a
  // narrow host can still leave the row scrolling. That case is handled by the
  // edge fade and the vertical stack below, not by this number.
  const maxWidth = tiers.length >= 3 ? "60rem" : "42rem";
  const modalStyle: React.CSSProperties = bottomOffset != null
    ? { position: "absolute", bottom: bottomOffset, left: "50%", transform: "translateX(-50%)", width: "calc(100% - 24px)", maxWidth }
    : { position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "calc(100% - 24px)", maxWidth };

  return (
    <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose}>
      <div
        style={modalStyle}
        className="bg-white rounded-2xl shadow-2xl overflow-hidden relative"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-4 pr-10">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Promotion Options</h2>
          <p className="text-gray-500 text-sm mt-1">Choose how you'd like to list your event</p>
        </div>

        {/* Cards.
            Below `sm` the row becomes a vertical stack: on a narrow embed no
            amount of width makes three cards fit side by side, and a stack is
            easier to read than a carousel nobody notices. At `sm` and up it
            stays a horizontal drag-scroll row. */}
        <div className="relative">
          {/* One `overflow-auto` covers both directions: stacked, only the
              max-height can scroll; in a row, only the width can. */}
          <div
            ref={scrollRef}
            className="flex flex-col sm:flex-row gap-4 max-h-[70vh] sm:max-h-none overflow-auto sm:snap-x sm:snap-mandatory pl-5 pr-5 pb-6 select-none"
            style={{ cursor: "grab", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
          >
            {tiers.map(tier => (
              <TierCard
                key={tier.id}
                tier={tier}
                primary={primary}
                loading={loading}
                onSelect={onSelect}
                scrollable
                getDragged={() => dragState.current.moved}
              />
            ))}
            {/* Right padding sentinel — matches pl-5 so padding is visible after last card */}
            <div className="hidden sm:block min-w-5 flex-shrink-0" />
          </div>

          {/* Scroll affordance. The row hides its scrollbar, so without this a
              clipped card reads as a broken layout rather than "keep going". */}
          {scrolls && (
            <div
              aria-hidden
              className="hidden sm:block pointer-events-none absolute top-0 right-0 bottom-6 w-12 bg-gradient-to-l from-white to-transparent"
            />
          )}
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
  scrollable,
  getDragged,
}: {
  tier: PromotionTierConfig;
  primary: string;
  loading: boolean;
  onSelect: (tier: PromotionTierConfig) => void;
  scrollable: boolean;
  getDragged: () => boolean;
}) {
  const isPaid = !!tier.stripe_price_id;
  const sizeClass = "w-full sm:w-auto sm:min-w-[220px] sm:snap-start sm:flex-1";

  function handleSelect() {
    if (getDragged()) return;
    onSelect(tier);
  }

  if (tier.highlight) {
    return (
      <div className={`rounded-xl border-2 overflow-hidden flex-shrink-0 ${sizeClass}`} style={{ borderColor: primary }}>
        <div
          className="text-white text-center py-2 font-semibold text-sm tracking-wide"
          style={{ backgroundColor: primary }}
        >
          {tier.label}
        </div>
        <div className="p-4 flex flex-col gap-3 bg-blue-50/40">
          <div className="text-center">
            <span className="text-4xl font-bold text-gray-900">
              {isPaid ? tier.price_display : "FREE"}
            </span>
          </div>
          <ul className="space-y-2.5 text-sm text-gray-700">
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
    <div className={`rounded-xl border-2 border-gray-200 overflow-hidden flex-shrink-0 ${sizeClass}`}>
      <div className="bg-gray-100 text-gray-700 text-center py-2 font-semibold text-sm tracking-wide">
        {tier.label}
      </div>
      <div className="p-4 flex flex-col gap-3">
        <div className="text-center">
          <span className="text-4xl font-bold text-gray-400">
            {isPaid ? tier.price_display : "FREE"}
          </span>
        </div>
        <ul className="space-y-2.5 text-sm text-gray-700">
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
