import { useEffect, useState } from "react";
import { mediaUrl } from "../lib/api";

type ProgressiveImageProps = {
  src?: string;
  alt: string;
  className?: string;
  loading?: "eager" | "lazy";
  fetchpriority?: "high" | "low" | "auto";
  fallback?: string;
};

const DEFAULT_FALLBACK = "/assets/cricket-stadium.png";

export function ProgressiveImage({
  src,
  alt,
  className = "",
  loading = "lazy",
  fetchpriority,
  fallback = DEFAULT_FALLBACK,
}: ProgressiveImageProps) {
  const resolved = mediaUrl(src || fallback);
  const fallbackResolved = mediaUrl(fallback);
  const [currentSrc, setCurrentSrc] = useState(resolved);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setCurrentSrc(resolved);
    setLoaded(false);
  }, [resolved]);

  return (
    <span className={`progressive-image ${loaded ? "is-loaded" : ""} ${className}`}>
      {!loaded && <span className="progressive-image-skeleton" aria-hidden="true" />}
      <img
        src={currentSrc}
        alt={alt}
        loading={loading}
        fetchpriority={fetchpriority}
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (currentSrc !== fallbackResolved) {
            setCurrentSrc(fallbackResolved);
            return;
          }
          setLoaded(true);
        }}
      />
    </span>
  );
}
