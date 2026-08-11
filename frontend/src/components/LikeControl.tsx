import { Heart } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { apiRequest } from "../lib/api";
import { showToast } from "../lib/toast";

type LikeState = {
  liked: boolean;
  count: number;
};

type LikeControlProps = {
  contentType: "gallery" | "news";
  contentId: string;
  liked: boolean;
  count: number;
  className?: string;
  onChange?: (state: LikeState) => void;
};

type LikeResponse = {
  content_type: string;
  content_id: string;
  like_count: number;
  liked_by_me: boolean;
};

export function LikeControl({ contentType, contentId, liked, count, className = "", onChange }: LikeControlProps) {
  const { token, isAuthenticated } = useAuth();
  const [state, setState] = useState<LikeState>({ liked, count: Math.max(0, count) });
  const pendingRef = useRef(false);

  useEffect(() => {
    if (pendingRef.current) return;
    setState({ liked, count: Math.max(0, count) });
  }, [liked, count]);

  function apply(next: LikeState) {
    const cleaned = { ...next, count: Math.max(0, next.count) };
    setState(cleaned);
    onChange?.(cleaned);
  }

  async function toggle() {
    if (pendingRef.current) return;
    if (!isAuthenticated || !token) {
      showToast("warning", "Sign In Required", "Please sign in to like this item.");
      return;
    }
    const previous = state;
    const next = {
      liked: !previous.liked,
      count: Math.max(0, previous.count + (previous.liked ? -1 : 1)),
    };
    pendingRef.current = true;
    apply(next);
    try {
      const remote = await apiRequest<LikeResponse>(
        `/likes/${contentType}/${encodeURIComponent(contentId)}`,
        { method: next.liked ? "POST" : "DELETE", silent: true },
        token,
      );
      apply({ liked: remote.liked_by_me, count: remote.like_count });
    } catch {
      apply(previous);
      showToast("error", "Like Failed", "Could not update this like. Please try again.");
    } finally {
      pendingRef.current = false;
    }
  }

  return (
    <button
      type="button"
      className={`${className} ${state.liked ? "active" : ""}`}
      onClick={() => void toggle()}
      disabled={pendingRef.current}
      aria-pressed={state.liked}
      aria-label={state.liked ? "Unlike" : "Like"}
    >
      <Heart size={15} fill={state.liked ? "currentColor" : "none"} />{state.count}
    </button>
  );
}
