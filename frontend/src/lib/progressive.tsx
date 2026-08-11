import { useEffect, useRef, useState } from "react";
import type React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export type ProgressiveQuery<T> = {
  queryKey: readonly unknown[];
  queryFn: () => Promise<T>;
};

export function SectionSkeleton({ rows = 3, className = "" }: { rows?: number; className?: string }) {
  return (
    <div className={`home-section-skeleton ${className}`.trim()} aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => <span key={index} />)}
    </div>
  );
}

export function ProgressiveSection<T>({
  query,
  prefetch = [],
  skeletonRows = 3,
  className,
  children,
}: {
  query: ProgressiveQuery<T>;
  prefetch?: Array<ProgressiveQuery<unknown>>;
  skeletonRows?: number;
  className?: string;
  children: (data: T) => React.ReactNode;
}) {
  const queryClient = useQueryClient();
  const [shouldLoad, setShouldLoad] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const result = useQuery({
    queryKey: query.queryKey,
    queryFn: query.queryFn,
    enabled: shouldLoad,
  });

  useEffect(() => {
    const node = containerRef.current;
    if (!node || shouldLoad) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShouldLoad(true);
        prefetch.forEach((item) => {
          void queryClient.prefetchQuery({ queryKey: item.queryKey, queryFn: item.queryFn });
        });
        observer.disconnect();
      },
      { rootMargin: "720px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [prefetch, queryClient, shouldLoad]);

  return (
    <div ref={containerRef} className={className}>
      {!shouldLoad || result.isLoading ? <SectionSkeleton rows={skeletonRows} /> : result.data ? children(result.data) : null}
    </div>
  );
}
