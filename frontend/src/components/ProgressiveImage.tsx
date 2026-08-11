import { mediaUrl } from "../lib/api";

type ProgressiveImageProps = {
  src?: string;
  alt: string;
  className?: string;
  loading?: "eager" | "lazy";
  fetchpriority?: "high" | "low" | "auto";
  srcSet?: string;
  sizes?: string;
};

export function ProgressiveImage({
  src,
  alt,
  className = "",
  loading = "lazy",
  fetchpriority,
  srcSet,
  sizes,
}: ProgressiveImageProps) {
  const resolved = src ? mediaUrl(src) : "";
  if (!resolved) {
    return <span className={`progressive-image ${className}`} aria-hidden="true" />;
  }

  return (
    <span className={`progressive-image ${className}`}>
      <img
        src={resolved}
        srcSet={srcSet}
        sizes={sizes}
        alt={alt}
        loading={loading}
        decoding="async"
        fetchpriority={fetchpriority}
      />
    </span>
  );
}
