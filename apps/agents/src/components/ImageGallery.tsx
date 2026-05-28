"use client";

import { useRef, useState } from "react";

/** Swipeable image gallery with dots. Falls back to a wood-tone placeholder. */
export function ImageGallery({ images, alt = "" }: { images: string[]; alt?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);

  if (images.length === 0) return null;

  const onScroll = () => {
    const el = ref.current;
    if (el && el.clientWidth) setIdx(Math.round(el.scrollLeft / el.clientWidth));
  };

  return (
    <div className="relative">
      <div
        ref={ref}
        onScroll={onScroll}
        className="flex overflow-x-auto snap-x snap-mandatory rounded-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {images.map((src, i) => (
          <img key={i} src={src} alt={alt} className="w-full shrink-0 snap-center aspect-[4/3] object-cover" />
        ))}
      </div>
      {images.length > 1 && (
        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
          {images.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === idx ? "w-4 bg-white" : "w-1.5 bg-white/60"}`}
              style={{ boxShadow: "0 0 2px rgba(0,0,0,0.4)" }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
