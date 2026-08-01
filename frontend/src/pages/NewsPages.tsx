import { CalendarDays } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Page } from "../components/UI";
import { newsPosts, tournaments } from "../data/platform";
import { useWheelHorizontal } from "../lib/useWheelHorizontal";
import { PageHero } from "./shared";

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
  const categories = ["Winner Teams", "Match Updates", "Tournament Updates", "Announcements"];
  const highlightedPosts = newsPosts.filter((post) => post.highlight);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const activeHighlight = highlightedPosts[highlightIndex] ?? newsPosts[0];
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

  return (
    <Page className="news-page">
      <section className="news-highlight-section">
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
      </section>
      <section className="section news-category-sections">
        {categories.map((category) => {
          const categoryPosts = newsPosts.filter((post) => post.category === category);
          return (
            <div className="news-category-block" key={category}>
              <div className="news-category-heading">
                <h2>{category}</h2>
                <div className="news-category-actions">
                  <span>{categoryPosts.length} updates</span>
                </div>
              </div>
              <div className="news-list-grid wheel-horizontal news-category-carousel">
                {categoryPosts.map((post) => (
                  <Link className="click-card" to={`/news/${post.slug}`} key={post.slug}>
                    <article className="news-card panel">
                      <div className="news-card-media">
                        <img src={post.image} alt="" />
                      </div>
                      <div className="news-card-copy">
                        <span className="status blue">{post.category}</span>
                        <h3>{post.title}</h3>
                        <p>{post.shortDescription}</p>
                        <small>{post.sport} - {post.city} - {post.date}</small>
                      </div>
                    </article>
                  </Link>
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
  const post = newsPosts.find((item) => item.slug === slug) ?? newsPosts[0];
  const tournament = tournaments.find((item) => item.slug === post.tournamentSlug);
  const related = newsPosts.filter((item) => item.slug !== post.slug && (item.sport === post.sport || item.city === post.city)).slice(0, 3);

  return (
    <Page>
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
            {tournament && <Link to={`/tournaments/${tournament.slug}`}>{tournament.name}</Link>}
          </div>
        </div>
      </article>
      <section className="article-body panel">
        {post.blocks.map(renderBlock)}
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
