import { CalendarDays, Heart, MessageCircle, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Page } from "../components/UI";
import { apiRequest } from "../lib/api";
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
  blocks: NewsBlock[];
};
type NewsSocial = Record<string, { liked?: boolean; likes: number; comments: Array<{ text: string; createdAt?: string }> }>;

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
  if (block.type === "image") return <img className="article-inline-image" key={index} src={block.content} alt="" />;
  return <p key={index}>{block.content}</p>;
}

export function NewsPage() {
  useWheelHorizontal();
  const [remotePosts, setRemotePosts] = useState<NewsPost[]>([]);
  const [social, setSocial] = useState<NewsSocial>({});
  const categoryScrollers = useRef<Record<string, HTMLDivElement | null>>({});
  const posts = remotePosts;
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
    let alive = true;
    apiRequest<any[]>("/news")
      .then((items) => {
        if (alive) setRemotePosts(items.map(normalizePost));
      })
      .catch(() => {
        if (alive) setRemotePosts([]);
      });
    apiRequest<NewsSocial>(`/news/social?actor_key=${encodeURIComponent(socialActorKey())}`)
      .then((items) => {
        if (alive) setSocial(items);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  async function toggleLike(slug: string) {
    const current = social[slug] ?? { likes: 0, comments: [], liked: false };
    const liked = !current.liked;
    setSocial((value) => ({ ...value, [slug]: { ...current, liked, likes: Math.max(0, current.likes + (liked ? 1 : -1)) } }));
    try {
      const updated = await apiRequest<{ slug: string; liked: boolean; likes: number }>("/news/social/like", {
        method: "POST",
        body: JSON.stringify({ slug, liked, actor_key: socialActorKey() }),
        silent: true,
      });
      setSocial((value) => ({ ...value, [slug]: { ...(value[slug] ?? { comments: [] }), liked: updated.liked, likes: updated.likes } }));
    } catch {
      setSocial((value) => ({ ...value, [slug]: current }));
    }
  }

  async function sharePost(post: NewsPost) {
    const url = new URL(`/news/${post.slug}`, window.location.origin).toString();
    const imageUrl = new URL(post.image, window.location.origin).toString();
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
          <img src={activeHighlight.image} alt="" />
          <div className="news-highlight-overlay">
            <div className="news-highlight-copy" key={`${activeHighlight.slug}-copy`}>
              <span className="status emerald">{activeHighlight.category}</span>
              <h2>{activeHighlight.title}</h2>
              <p>{activeHighlight.shortDescription}</p>
              <small><CalendarDays size={14} /> {activeHighlight.date} - {activeHighlight.city}</small>
            </div>
          </div>
        </Link>
      </section> : <section className="panel user-empty-state"><h2>No news published</h2><p>Admin or manager news articles will appear here after publishing.</p></section>}
      <section className="section news-category-sections">
        {visibleCategories.map((category) => {
          const categoryPosts = posts.filter((post) => post.category === category);
          return (
            <div className="news-category-block" key={category}>
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
                        <img src={post.image} alt="" />
                      </div>
                      <div className="news-card-copy">
                        <span className="status blue">{post.category}</span>
                        <h3>{post.title}</h3>
                        <p>{post.shortDescription}</p>
                        <small>{post.sport} - {post.city} - {post.date}</small>
                      </div>
                    </Link>
                    <div className="news-social-actions">
                      <button type="button" className={social[post.slug]?.liked ? "active" : ""} onClick={() => void toggleLike(post.slug)}><Heart size={15} />{social[post.slug]?.likes ?? 0}</button>
                      <Link to={`/news/${post.slug}#comments`}><MessageCircle size={15} />{social[post.slug]?.comments?.length ?? 0}</Link>
                      <button type="button" onClick={() => void sharePost(post)}><Share2 size={15} />Share</button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </Page>
  );
}

export function NewsDetailPage() {
  const { slug } = useParams();
  const [remotePost, setRemotePost] = useState<NewsPost | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [social, setSocial] = useState<NewsSocial>({});
  const [comment, setComment] = useState("");
  const post = remotePost;
  const [related, setRelated] = useState<NewsPost[]>([]);

  useEffect(() => {
    if (!slug) return;
    let alive = true;
    apiRequest<any>(`/news/${slug}`)
      .then((item) => {
        if (alive) setRemotePost(normalizePost(item));
      })
      .catch(() => {
        if (alive) setNotFound(true);
      });
    apiRequest<any[]>("/news")
      .then((items) => {
        if (alive) setRelated(items.map(normalizePost).filter((item) => item.slug !== slug).slice(0, 3));
      })
      .catch(() => undefined);
    apiRequest<NewsSocial>(`/news/social?actor_key=${encodeURIComponent(socialActorKey())}`)
      .then((items) => {
        if (alive) setSocial(items);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [slug]);

  async function shareNews() {
    if (!post) return;
    const url = window.location.href;
    const imageUrl = new URL(post.image, window.location.origin).toString();
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
    });
    setSocial((current) => ({ ...current, [post.slug]: { ...(current[post.slug] ?? { likes: 0 }), comments: updated.comments } }));
    setComment("");
  }

  async function toggleDetailLike() {
    if (!post) return;
    const current = social[post.slug] ?? { likes: 0, comments: [], liked: false };
    const liked = !current.liked;
    setSocial((value) => ({ ...value, [post.slug]: { ...current, liked, likes: Math.max(0, current.likes + (liked ? 1 : -1)) } }));
    try {
      const updated = await apiRequest<{ slug: string; liked: boolean; likes: number }>("/news/social/like", {
        method: "POST",
        body: JSON.stringify({ slug: post.slug, liked, actor_key: socialActorKey() }),
        silent: true,
      });
      setSocial((value) => ({ ...value, [post.slug]: { ...(value[post.slug] ?? { comments: [] }), liked: updated.liked, likes: updated.likes } }));
    } catch {
      setSocial((value) => ({ ...value, [post.slug]: current }));
    }
  }

  return (
    <Page>
      {(!post || notFound) ? (
        <section className="panel user-empty-state">
          <h2>News not found</h2>
          <p>This article is not published in the database.</p>
          <Link className="btn btn-primary" to="/news">Back to news</Link>
        </section>
      ) : <>
      <article className="news-detail">
        <img className="news-detail-image" src={post.image} alt="" />
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
          <button type="button" className={social[post.slug]?.liked ? "active" : ""} onClick={() => void toggleDetailLike()}><Heart size={15} />{social[post.slug]?.likes ?? 0}</button>
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
              <div className="news-card-media"><img src={item.image} alt="" /></div>
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
