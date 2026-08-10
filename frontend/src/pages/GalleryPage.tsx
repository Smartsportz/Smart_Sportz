import { CalendarDays, Heart, MessageCircle, Share2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Page } from "../components/UI";
import { apiRequest } from "../lib/api";
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

type GallerySocialState = Record<string, { liked?: boolean; likes?: number; comments?: string[] }>;

function imageKey(album: GalleryAlbum) {
  return `album:${album.slug}`;
}

function assetUrl(path?: string) {
  if (!path) return "";
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  if (/^\/(assets|media)\//.test(path)) return `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
  return path;
}

export function GalleryPage() {
  useWheelHorizontal(".gallery-feed-grid");
  const [albums, setAlbums] = useState<GalleryAlbum[]>([]);
  const [social, setSocial] = useState<GallerySocialState>({});
  const galleryScroller = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    apiRequest<GalleryAlbum[]>("/public/gallery/albums")
      .then(setAlbums)
      .catch(() => setAlbums([]));
    apiRequest<Record<string, { liked?: boolean; likes?: number; comments?: string[] }>>(`/public/gallery/social?actor_key=${encodeURIComponent(socialActorKey())}`)
      .then(setSocial)
      .catch(() => undefined);
  }, []);

  async function toggleLike(album: GalleryAlbum) {
    const key = imageKey(album);
    const current = social[key] ?? { likes: 0, comments: [], liked: false };
    const liked = !current.liked;
    setSocial((value) => ({ ...value, [key]: { ...current, liked, likes: Math.max(0, (current.likes ?? 0) + (liked ? 1 : -1)) } }));
    try {
      const remote = await apiRequest<{ image_key: string; liked: boolean; likes: number; comments: string[] }>("/public/gallery/social/like", {
        method: "POST",
        body: JSON.stringify({ image_key: key, liked, actor_key: socialActorKey() }),
        silent: true,
      });
      setSocial((value) => ({ ...value, [key]: { ...value[key], liked: remote.liked, likes: remote.likes, comments: remote.comments } }));
    } catch {
      setSocial((value) => ({ ...value, [key]: current }));
    }
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
        {albums.length ? (
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
                    {album.cover && <div className="gallery-winner-media"><img src={assetUrl(album.cover)} alt="" loading="lazy" /></div>}
                    <h3>{album.title}</h3>
                    <p>{album.summary}</p>
                    <small><CalendarDays size={14} /> {album.date_label || album.month_label || "Published gallery"}</small>
                  </Link>
                  <div className="gallery-social-row">
                    <button type="button" className={state.liked ? "active" : ""} onClick={() => void toggleLike(album)}><Heart size={15} />{state.likes ?? 0}</button>
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
  const [albums, setAlbums] = useState<GalleryAlbum[]>([]);
  const [comment, setComment] = useState("");
  const [social, setSocial] = useState<GallerySocialState>({});
  const album = useMemo(() => albums.find((item) => item.slug === slug), [albums, slug]);

  useEffect(() => {
    apiRequest<GalleryAlbum[]>("/public/gallery/albums")
      .then(setAlbums)
      .catch(() => setAlbums([]));
    apiRequest<Record<string, { liked?: boolean; likes?: number; comments?: string[] }>>(`/public/gallery/social?actor_key=${encodeURIComponent(socialActorKey())}`)
      .then(setSocial)
      .catch(() => undefined);
  }, []);

  async function addComment() {
    if (!album || !comment.trim()) return;
    const remote = await apiRequest<{ image_key: string; likes: number; comments: string[] }>("/public/gallery/social/comment", {
      method: "POST",
      body: JSON.stringify({ image_key: imageKey(album), comment }),
    });
    setSocial((value) => ({ ...value, [imageKey(album)]: { ...value[imageKey(album)], likes: remote.likes, comments: remote.comments } }));
    setComment("");
  }

  async function toggleLike() {
    if (!album) return;
    const key = imageKey(album);
    const current = social[key] ?? { likes: 0, comments: [], liked: false };
    const liked = !current.liked;
    setSocial((value) => ({ ...value, [key]: { ...current, liked, likes: Math.max(0, (current.likes ?? 0) + (liked ? 1 : -1)) } }));
    try {
      const remote = await apiRequest<{ image_key: string; liked: boolean; likes: number; comments: string[] }>("/public/gallery/social/like", {
        method: "POST",
        body: JSON.stringify({ image_key: key, liked, actor_key: socialActorKey() }),
        silent: true,
      });
      setSocial((value) => ({ ...value, [key]: { ...value[key], liked: remote.liked, likes: remote.likes, comments: remote.comments } }));
    } catch {
      setSocial((value) => ({ ...value, [key]: current }));
    }
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
        {album.cover && <img src={assetUrl(album.cover)} alt="" loading="lazy" />}
        <div>
          <Link className="inline-link" to="/gallery">Back</Link>
          <h1>{album.title}</h1>
          <p>{album.summary}</p>
          <small>{[album.sport, album.city, album.date_label].filter(Boolean).join(" - ")}</small>
        </div>
      </section>
      <section className="article-body panel">
        <div className="news-social-actions news-detail-actions">
          <button type="button" className={state.liked ? "active" : ""} onClick={() => void toggleLike()}><Heart size={15} />{state.likes ?? 0}</button>
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
