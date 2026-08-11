import { useEffect, useState } from "react";
import { mediaUrl } from "../lib/api";

type ProgressiveImageProps = {
  src?: string;
  alt: string;
  className?: string;
  loading?: "eager" | "lazy";
  fetchpriority?: "high" | "low" | "auto";
};

export function ProgressiveImage({
  src,
  alt,
  className = "",
  loading = "lazy",
  fetchpriority,
}: ProgressiveImageProps) {
  const resolved = src ? mediaUrl(src) : "";
  const [currentSrc, setCurrentSrc] = useState(resolved);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setCurrentSrc(resolved);
    setLoaded(false);
  }, [resolved]);

  return (
    <span className={`progressive-image ${loaded ? "is-loaded" : ""} ${className}`}>
      {!loaded && <span className="progressive-image-skeleton" aria-hidden="true" />}
      {currentSrc && (
        <img
          src={currentSrc}
          alt={alt}
          loading={loading}
          fetchpriority={fetchpriority}
          onLoad={() => setLoaded(true)}
          onError={() => {
            setCurrentSrc("");
            setLoaded(false);
          }}
        />
      )}
    </span>
  );
}
