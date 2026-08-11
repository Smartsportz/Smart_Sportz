import { CalendarDays, MessageCircle, Share2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { LikeControl } from "../components/LikeControl";
import { Page } from "../components/UI";
import { ProgressiveImage } from "../components/ProgressiveImage";
import { useAuth } from "../auth/AuthContext";
import { apiRequest, mediaUrl } from "../lib/api";
import { socialActorKey } from "../lib/socialIdentity";
import { useWheelHorizontal } from "../lib/useWheelHorizontal";

type GalleryAlbum = {
  slug: string;
  title: string;
  sport?: string;
  city?: string;
  date_label?: string;
  month_label?: string;
  day_count?: string;
  cover?: string;
  summary?: string;
};

type GallerySocialItem = { liked?: boolean; liked_by_me?: boolean; likes?: number; like_count?: number; comments?: string[] };
type GallerySocialState = Record<string, GallerySocialItem>;
type GalleryBootstrap = {
  albums: GalleryAlbum[];
  social: GallerySocialState;
};

function imageKey(album: GalleryAlbum) {
  return `album:${album.slug}`;
}

function galleryBootstrapQuery(actorKey: string, token: string | null) {
  return {
    queryKey: ["gallery", "bootstrap", actorKey, Boolean(token)] as const,
    queryFn: () => apiRequest<GalleryBootstrap>(`/public/gallery/bootstrap?actor_key=${encodeURIComponent(actorKey)}&limit=12`, { silent: true }, token ?? undefined),
  };
}

function liked(state?: GallerySocialItem) {
  return Boolean(state?.liked_by_me ?? state?.liked);
}

function likeCount(state?: GallerySocialItem) {
  return Math.max(0, Number(state?.like_count ?? state?.likes ?? 0));
}

function GallerySkeleton() {
  return (
    <div className="home-section-skeleton gallery-page-skeleton" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  );
}

export function GalleryPage() {
  useWheelHorizontal(".gallery-feed-grid");
  const { token } = useAuth();
  const actorKey = useMemo(() => socialActorKey(), []);
  const queryClient = useQueryClient();
  const bootstrapQuery = useMemo(() => galleryBootstrapQuery(actorKey, token), [actorKey, token]);
  const { data: bootstrap, isLoading } = useQuery(bootstrapQuery);
  const albums = bootstrap?.albums ?? [];
  const [social, setSocial] = useState<GallerySocialState>({});
  const galleryScroller = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSocial(bootstrap?.social ?? {});
  }, [bootstrap?.social]);

  function updateSocialCache(key: string, next: GallerySocialState[string]) {
    queryClient.setQueryData<GalleryBootstrap>(bootstrapQuery.queryKey, (current) => {
      if (!current) return current;
      return { ...current, social: { ...current.social, [key]: next } };
    });
  }

  function updateLikeState(key: string, next: { liked: boolean; count: number }) {
    const current = social[key] ?? { comments: [] };
    const updated = { ...current, liked: next.liked, liked_by_me: next.liked, likes: next.count, like_count: next.count };
    setSocial((value) => ({ ...value, [key]: updated }));
    updateSocialCache(key, updated);
  }

  async function shareAlbum(album: GalleryAlbum) {
    const url = new URL(`/gallery/${album.slug}`, window.location.origin).toString();
    if (navigator.share) {
      await navigator.share({ title: album.title, text: album.summary ?? "", url });
      return;
    }
    await navigator.clipboard.writeText(url);
  }

  function moveGallery(direction: -1 | 1) {
    galleryScroller.current?.scrollBy({ left: direction * 380, behavior: "smooth" });
  }

  return (
    <Page className="gallery-page">
      <section className="gallery-section gallery-section-first">
        <div className="gallery-simple-title"><h1>Gallery</h1></div>
        {isLoading ? (
          <GallerySkeleton />
        ) : albums.length ? (
          <>
          <div className="content-scroll-controls">
            <button type="button" onClick={() => moveGallery(-1)} aria-label="Previous gallery albums">&lt;</button>
            <button type="button" onClick={() => moveGallery(1)} aria-label="Next gallery albums">&gt;</button>
          </div>
          <div className="gallery-feed-grid wheel-horizontal content-scroll-row" ref={galleryScroller}>
            {albums.map((album) => {
              const state = social[imageKey(album)] ?? { likes: 0, comments: [] };
              return (
                <article className="gallery-feed-card" key={album.slug}>
                  <Link className="gallery-image-open" to={`/gallery/${album.slug}`}>
                    {album.cover && <div className="gallery-winner-media"><ProgressiveImage src={mediaUrl(album.cover)} alt="" /></div>}
                    <h3>{album.title}</h3>
                    <p>{album.summary}</p>
                    <small><CalendarDays size={14} /> {album.date_label || album.month_label || "Published gallery"}</small>
                  </Link>
                  <div className="gallery-social-row">
                    <LikeControl contentType="gallery" contentId={imageKey(album)} liked={liked(state)} count={likeCount(state)} onChange={(next) => updateLikeState(imageKey(album), next)} />
                    <Link to={`/gallery/${album.slug}`}><MessageCircle size={15} />{state.comments?.length ?? 0}</Link>
                    <button type="button" onClick={() => void shareAlbum(album)}><Share2 size={15} />Share</button>
                  </div>
                </article>
              );
            })}
          </div>
          </>
        ) : (
          <div className="panel user-empty-state">
            <h2>No gallery published</h2>
            <p>Admin or manager gallery albums will appear here after publishing.</p>
          </div>
        )}
      </section>
    </Page>
  );
}

export function GalleryAlbumPage() {
  const { slug } = useParams();
  const { token } = useAuth();
  const actorKey = useMemo(() => socialActorKey(), []);
  const queryClient = useQueryClient();
  const bootstrapQuery = useMemo(() => galleryBootstrapQuery(actorKey, token), [actorKey, token]);
  const { data: bootstrap, isLoading } = useQuery(bootstrapQuery);
  const albums = bootstrap?.albums ?? [];
  const [comment, setComment] = useState("");
  const [social, setSocial] = useState<GallerySocialState>({});
  const album = useMemo(() => albums.find((item) => item.slug === slug), [albums, slug]);

  useEffect(() => {
    setSocial(bootstrap?.social ?? {});
  }, [bootstrap?.social]);

  function updateSocialCache(key: string, next: GallerySocialState[string]) {
    queryClient.setQueryData<GalleryBootstrap>(bootstrapQuery.queryKey, (current) => {
      if (!current) return current;
      return { ...current, social: { ...current.social, [key]: next } };
    });
  }

  async function addComment() {
    if (!album || !comment.trim()) return;
    const remote = await apiRequest<{ image_key: string; likes: number; comments: string[] }>("/public/gallery/social/comment", {
      method: "POST",
      body: JSON.stringify({ image_key: imageKey(album), comment }),
      silent: true,
    });
    const key = imageKey(album);
    const next = { ...(social[key] ?? {}), likes: remote.likes, comments: remote.comments };
    setSocial((value) => ({ ...value, [key]: next }));
    updateSocialCache(key, next);
    setComment("");
  }

  function updateLikeState(key: string, next: { liked: boolean; count: number }) {
    const current = social[key] ?? { comments: [] };
    const updated = { ...current, liked: next.liked, liked_by_me: next.liked, likes: next.count, like_count: next.count };
    setSocial((value) => ({ ...value, [key]: updated }));
    updateSocialCache(key, updated);
  }

  if (isLoading) {
    return (
      <Page className="gallery-page gallery-detail-page">
        <GallerySkeleton />
      </Page>
    );
  }

  if (!album) {
    return (
      <Page className="gallery-page gallery-detail-page">
        <section className="panel user-empty-state">
          <h2>Gallery not found</h2>
          <p>This gallery album is not published in the database.</p>
          <Link className="btn btn-primary" to="/gallery">Back to gallery</Link>
        </section>
      </Page>
    );
  }

  const state = social[imageKey(album)] ?? { likes: 0, comments: [] };

  return (
    <Page className="gallery-page gallery-detail-page">
      <section className="gallery-detail-hero">
        {album.cover && <ProgressiveImage src={mediaUrl(album.cover)} alt="" />}
        <div>
          <Link className="inline-link" to="/gallery">Back</Link>
          <h1>{album.title}</h1>
          <p>{album.summary}</p>
          <small>{[album.sport, album.city, album.date_label].filter(Boolean).join(" - ")}</small>
        </div>
      </section>
      <section className="article-body panel">
        <div className="news-social-actions news-detail-actions">
          <LikeControl contentType="gallery" contentId={imageKey(album)} liked={liked(state)} count={likeCount(state)} onChange={(next) => updateLikeState(imageKey(album), next)} />
          <button type="button"><MessageCircle size={15} />{state.comments?.length ?? 0}</button>
        </div>
        <div className="news-comments">
          <h3>Comments</h3>
          {(state.comments ?? []).map((item, index) => <p key={`${item}-${index}`}>{item}</p>)}
          <div className="comment-form">
            <input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Write a comment..." />
            <button className="btn btn-primary" type="button" onClick={() => void addComment()}>Post</button>
          </div>
        </div>
      </section>
    </Page>
  );
}
