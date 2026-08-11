import { CalendarDays, MessageCircle, Share2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { LikeControl } from "../components/LikeControl";
import { Page } from "../components/UI";
import { ProgressiveImage } from "../components/ProgressiveImage";
import { useAuth } from "../auth/AuthContext";
import { apiRequest, mediaUrl } from "../lib/api";
import { ProgressiveSection, SectionSkeleton } from "../lib/progressive";
import { socialActorKey } from "../lib/socialIdentity";
import { useWheelHorizontal } from "../lib/useWheelHorizontal";
import { PageHero } from "./shared";

type NewsBlock = { type: string; content: string; sortOrder?: number };
type NewsPost = {
  slug: string;
  title: string;
  shortDescription: string;
  image: string;
  category: string;
  sport: string;
  city: string;
  date: string;
  tournamentSlug?: string;
  highlight?: boolean;
  like_count?: number;
  liked_by_me?: boolean;
  blocks: NewsBlock[];
};
type NewsSocialItem = { liked?: boolean; liked_by_me?: boolean; likes?: number; like_count?: number; comments: Array<{ text: string; createdAt?: string }> };
type NewsSocial = Record<string, NewsSocialItem>;
type NewsBootstrap = { posts: any[]; social: NewsSocial };

function normalizePost(item: any): NewsPost {
  return {
    slug: item.slug,
    title: item.title,
    shortDescription: item.shortDescription ?? item.short_description ?? "",
    image: item.image,
    category: item.category,
    sport: item.sport,
    city: item.city,
    date: item.date ?? item.published_at?.slice(0, 10) ?? item.created_at?.slice(0, 10) ?? "Published",
    tournamentSlug: item.tournamentSlug ?? item.tournament_slug,
    highlight: Boolean(item.highlight ?? item.is_highlight),
    like_count: Number(item.like_count ?? 0),
    liked_by_me: Boolean(item.liked_by_me),
    blocks: (item.blocks ?? []).map((block: any) => ({
      type: block.type ?? block.block_type ?? "paragraph",
      content: block.content ?? block.text ?? "",
      sortOrder: block.sortOrder ?? block.sort_order,
    })),
  };
}

function renderBlock(block: { type: string; content: string }, index: number) {
  if (block.type === "heading") return <h2 key={index}>{block.content}</h2>;
  if (block.type === "quote") return <blockquote key={index}>{block.content}</blockquote>;
  if (block.type === "bold") return <p key={index}><strong>{block.content}</strong></p>;
  if (block.type === "italic") return <p key={index}><em>{block.content}</em></p>;
  if (block.type === "list") {
    return <ul key={index}>{block.content.split("|").map((item) => <li key={item}>{item}</li>)}</ul>;
  }
  if (block.type === "image") return <img className="article-inline-image" key={index} src={mediaUrl(block.content)} alt="" loading="lazy" />;
  return <p key={index}>{block.content}</p>;
}

function newsBootstrapQuery(actorKey: string, token: string | null) {
  return {
    queryKey: ["news", "bootstrap", actorKey, Boolean(token)] as const,
    queryFn: () => apiRequest<NewsBootstrap>(`/news/bootstrap?actor_key=${encodeURIComponent(actorKey)}&limit=12`, { silent: true }, token ?? undefined),
  };
}

function newsDetailQuery(slug: string | undefined, token: string | null) {
  return {
    queryKey: ["news", "detail", slug, Boolean(token)] as const,
    queryFn: () => apiRequest<any>(`/news/${slug}`, { silent: true }, token ?? undefined),
  };
}

function liked(state?: NewsSocialItem) {
  return Boolean(state?.liked_by_me ?? state?.liked);
}

function likeCount(state?: NewsSocialItem) {
  return Math.max(0, Number(state?.like_count ?? state?.likes ?? 0));
}

export function NewsPage() {
  useWheelHorizontal();
  const { token } = useAuth();
  const actorKey = useMemo(() => socialActorKey(), []);
  const queryClient = useQueryClient();
  const bootstrapQuery = useMemo(() => newsBootstrapQuery(actorKey, token), [actorKey, token]);
  const { data: bootstrap, isLoading } = useQuery(bootstrapQuery);
  const [social, setSocial] = useState<NewsSocial>({});
  const categoryScrollers = useRef<Record<string, HTMLDivElement | null>>({});
  const posts = useMemo(() => (bootstrap?.posts ?? []).map(normalizePost), [bootstrap?.posts]);
  const categories = ["Match Updates", "Tournament Updates", "Announcements"];
  const visibleCategories = categories.filter((category) => posts.some((post) => post.category === category));
  const highlightedPosts = posts.filter((post) => post.highlight);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const activeHighlight = highlightedPosts[highlightIndex] ?? posts[0];
  const moveHighlight = (direction: "left" | "right") => {
    setHighlightIndex((current) => {
      if (!highlightedPosts.length) return 0;
      return direction === "left"
        ? (current - 1 + highlightedPosts.length) % highlightedPosts.length
        : (current + 1) % highlightedPosts.length;
    });
  };

  useEffect(() => {
    if (highlightedPosts.length <= 1) return;
    const timer = window.setInterval(() => moveHighlight("right"), 5200);
    return () => window.clearInterval(timer);
  }, [highlightedPosts.length]);

  useEffect(() => {
    setSocial(bootstrap?.social ?? {});
  }, [bootstrap?.social]);

  function updateSocialCache(slug: string, next: NewsSocial[string]) {
    queryClient.setQueryData<NewsBootstrap>(bootstrapQuery.queryKey, (current) => {
      if (!current) return current;
      return { ...current, social: { ...current.social, [slug]: next } };
    });
  }

  function updateLikeState(slug: string, next: { liked: boolean; count: number }) {
    const current = social[slug] ?? { comments: [] };
    const updated = { ...current, liked: next.liked, liked_by_me: next.liked, likes: next.count, like_count: next.count };
    setSocial((value) => ({ ...value, [slug]: updated }));
    updateSocialCache(slug, updated);
  }

  async function sharePost(post: NewsPost) {
    const url = new URL(`/news/${post.slug}`, window.location.origin).toString();
    const imageUrl = new URL(mediaUrl(post.image), window.location.origin).toString();
    const payload = { title: post.title, text: `${post.shortDescription} Image: ${imageUrl}`, url };
    if (navigator.share) {
      await navigator.share(payload);
      return;
    }
    await navigator.clipboard.writeText(`${payload.text}\n${url}`);
  }

  function moveCategory(category: string, direction: -1 | 1) {
    categoryScrollers.current[category]?.scrollBy({ left: direction * 380, behavior: "smooth" });
  }

  return (
    <Page className="news-page">
      {activeHighlight ? <section className="news-highlight-section">
        <Link className="news-highlight-card click-card" to={`/news/${activeHighlight.slug}`} key={activeHighlight.slug}>
          <ProgressiveImage src={mediaUrl(activeHighlight.image)} alt="" loading="eager" fetchpriority="high" />
          <div className="news-highlight-overlay">
            <div className="news-highlight-copy" key={`${activeHighlight.slug}-copy`}>
              <span className="status emerald">{activeHighlight.category}</span>
              <h2>{activeHighlight.title}</h2>
              <p>{activeHighlight.shortDescription}</p>
              <small><CalendarDays size={14} /> {activeHighlight.date} - {activeHighlight.city}</small>
            </div>
          </div>
        </Link>
      </section> : isLoading ? <SectionSkeleton rows={2} /> : <section className="panel user-empty-state"><h2>No news published</h2><p>Admin or manager news articles will appear here after publishing.</p></section>}
      <section className="section news-category-sections">
        {visibleCategories.map((category) => {
          const categoryPosts = posts.filter((post) => post.category === category);
          return (
            <ProgressiveSection
              key={category}
              query={{ queryKey: ["news", "category", category, bootstrapQuery.queryKey] as const, queryFn: async () => categoryPosts }}
              skeletonRows={3}
            >
              {() => (
                <div className="news-category-block">
                  <div className="news-category-heading">
                    <h2>{category}</h2>
                    <div className="news-category-actions">
                      <span>{categoryPosts.length} updates</span>
                      <button type="button" onClick={() => moveCategory(category, -1)} aria-label={`Previous ${category}`}>&lt;</button>
                      <button type="button" onClick={() => moveCategory(category, 1)} aria-label={`Next ${category}`}>&gt;</button>
                    </div>
                  </div>
                  <div className="news-list-grid wheel-horizontal news-category-carousel content-scroll-row" ref={(node) => { categoryScrollers.current[category] = node; }}>
                    {categoryPosts.map((post) => (
                      <article className="news-card panel" key={post.slug}>
                        <Link className="click-card news-card-link" to={`/news/${post.slug}`}>
                          <div className="news-card-media">
                            <ProgressiveImage src={mediaUrl(post.image)} alt="" />
                          </div>
                          <div className="news-card-copy">
                            <span className="status blue">{post.category}</span>
                            <h3>{post.title}</h3>
                            <p>{post.shortDescription}</p>
                            <small>{post.sport} - {post.city} - {post.date}</small>
                          </div>
                        </Link>
                        <div className="news-social-actions">
                          <LikeControl contentType="news" contentId={post.slug} liked={liked(social[post.slug])} count={likeCount(social[post.slug])} onChange={(next) => updateLikeState(post.slug, next)} />
                          <Link to={`/news/${post.slug}#comments`}><MessageCircle size={15} />{social[post.slug]?.comments?.length ?? 0}</Link>
                          <button type="button" onClick={() => void sharePost(post)}><Share2 size={15} />Share</button>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </ProgressiveSection>
          );
        })}
      </section>
    </Page>
  );
}

export function NewsDetailPage() {
  const { slug } = useParams();
  const { token } = useAuth();
  const actorKey = useMemo(() => socialActorKey(), []);
  const queryClient = useQueryClient();
  const detailQuery = useMemo(() => newsDetailQuery(slug, token), [slug, token]);
  const socialQuery = useMemo(() => ({
    queryKey: ["news", "social", actorKey, Boolean(token)] as const,
    queryFn: () => apiRequest<NewsSocial>(`/news/social?actor_key=${encodeURIComponent(actorKey)}`, { silent: true }, token ?? undefined),
  }), [actorKey, token]);
  const { data: remotePost, isLoading, isError } = useQuery({ ...detailQuery, enabled: Boolean(slug) });
  const { data: remoteSocial } = useQuery(socialQuery);
  const [social, setSocial] = useState<NewsSocial>({});
  const [comment, setComment] = useState("");
  const post = remotePost ? normalizePost(remotePost) : null;
  const related = useMemo<NewsPost[]>(() => (remotePost?.related ?? []).map((item: any) => normalizePost(item)), [remotePost?.related]);

  useEffect(() => {
    setSocial(remoteSocial ?? {});
  }, [remoteSocial]);

  function updateDetailSocialCache(newsSlug: string, next: NewsSocial[string]) {
    queryClient.setQueryData<NewsSocial>(socialQuery.queryKey, (current) => ({ ...(current ?? {}), [newsSlug]: next }));
  }

  async function shareNews() {
    if (!post) return;
    const url = window.location.href;
    const imageUrl = new URL(mediaUrl(post.image), window.location.origin).toString();
    const sharePayload = {
      title: post.title,
      text: `${post.shortDescription} Image: ${imageUrl}`,
      url,
    };
    if (navigator.share) {
      await navigator.share(sharePayload);
      return;
    }
    await navigator.clipboard.writeText(`${sharePayload.text}\n${url}`);
    window.alert("News image and link copied.");
  }

  async function submitComment() {
    if (!post) return;
    if (!comment.trim()) return;
    const updated = await apiRequest<{ slug: string; comments: Array<{ text: string; createdAt?: string }> }>("/news/social/comment", {
      method: "POST",
      body: JSON.stringify({ slug: post.slug, comment }),
      silent: true,
    });
    const next = { ...(social[post.slug] ?? { likes: 0, like_count: 0, liked: false, liked_by_me: false }), comments: updated.comments };
    setSocial((current) => ({ ...current, [post.slug]: next }));
    updateDetailSocialCache(post.slug, next);
    setComment("");
  }

  function updateDetailLikeState(newsSlug: string, next: { liked: boolean; count: number }) {
    const current = social[newsSlug] ?? { comments: [] };
    const updated = { ...current, liked: next.liked, liked_by_me: next.liked, likes: next.count, like_count: next.count };
    setSocial((value) => ({ ...value, [newsSlug]: updated }));
    updateDetailSocialCache(newsSlug, updated);
  }

  return (
    <Page>
      {isLoading ? (
        <SectionSkeleton rows={3} />
      ) : (!post || isError) ? (
        <section className="panel user-empty-state">
          <h2>News not found</h2>
          <p>This article is not published in the database.</p>
          <Link className="btn btn-primary" to="/news">Back to news</Link>
        </section>
      ) : <>
      <article className="news-detail">
        <ProgressiveImage className="news-detail-image" src={mediaUrl(post.image)} alt="" loading="eager" fetchpriority="high" />
        <div className="news-detail-copy">
          <span className="status emerald">{post.category}</span>
          <h1>{post.title}</h1>
          <p>{post.shortDescription}</p>
          <div className="news-meta-row">
            <span>{post.date}</span>
            <span>{post.sport}</span>
            <span>{post.city}</span>
            {post.tournamentSlug && <Link to={`/tournaments/${post.tournamentSlug}`}>Tournament</Link>}
          </div>
          <button className="btn btn-secondary news-share-button" type="button" onClick={() => void shareNews()}><Share2 size={16} />Share image and link</button>
        </div>
      </article>
      <section className="article-body panel">
        {post.blocks.map(renderBlock)}
        <div className="news-social-actions news-detail-actions">
          <LikeControl contentType="news" contentId={post.slug} liked={liked(social[post.slug] ?? { liked_by_me: post.liked_by_me, like_count: post.like_count, comments: [] } as any)} count={likeCount(social[post.slug] ?? { like_count: post.like_count, comments: [] } as any)} onChange={(next) => updateDetailLikeState(post.slug, next)} />
          <button type="button" onClick={() => void shareNews()}><Share2 size={15} />Share</button>
        </div>
        <div className="news-comments" id="comments">
          <h3>Comments</h3>
          {(social[post.slug]?.comments ?? []).map((item, index) => <p key={`${item.createdAt}-${index}`}>{item.text}</p>)}
          <div className="comment-form">
            <input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Write a comment..." />
            <button className="btn btn-primary" type="button" onClick={() => void submitComment()}>Post</button>
          </div>
        </div>
      </section>
      <section className="section" id="latest">
        <PageHero title="Latest Updates" text="Related tournament and city stories." />
        <div className="content-grid news-list-grid related-news-grid">
          {related.map((item) => (
            <Link className="panel click-card news-card" to={`/news/${item.slug}`} key={item.slug}>
              <div className="news-card-media"><ProgressiveImage src={mediaUrl(item.image)} alt="" /></div>
              <div className="news-card-copy">
                <h3>{item.title}</h3>
                <p>{item.shortDescription}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
      </>}
    </Page>
  );
}

export function RichTextToolbarPreview() {
  const tools = ["Heading", "Bold", "Italic", "List", "Quote", "Image"];

  return (
    <div className="rich-toolbar">
      {tools.map((tool) => <button type="button" key={tool} title={tool}>{tool}</button>)}
    </div>
  );
}
