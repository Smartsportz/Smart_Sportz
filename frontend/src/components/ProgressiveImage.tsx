import { mediaUrl } from "../lib/api";

type ProgressiveImageProps = {
  src?: string;
  alt: string;
  className?: string;
  fallbackSrc?: string;
  loading?: "eager" | "lazy";
  fetchpriority?: "high" | "low" | "auto";
  srcSet?: string;
  sizes?: string;
};

export function ProgressiveImage({
  src,
  alt,
  className = "",
  fallbackSrc = "",
  loading = "lazy",
  fetchpriority,
  srcSet,
  sizes,
}: ProgressiveImageProps) {
  const resolved = src ? mediaUrl(src) : "";
  const fallback = fallbackSrc ? mediaUrl(fallbackSrc) : "";
  if (!resolved) {
    if (!fallback) return null;
    return (
      <img
        className={`progressive-image ${className}`.trim()}
        src={fallback}
        alt={alt}
        loading={loading}
        decoding="async"
        fetchpriority={fetchpriority}
      />
    );
  }

  return (
    <img
      className={`progressive-image ${className}`.trim()}
      src={resolved}
      srcSet={srcSet}
      sizes={sizes}
      alt={alt}
      loading={loading}
      decoding="async"
      fetchpriority={fetchpriority}
      onError={(event) => {
        if (fallback && event.currentTarget.src !== fallback) {
          event.currentTarget.src = fallback;
          event.currentTarget.removeAttribute("srcset");
        }
      }}
    />
  );
}
