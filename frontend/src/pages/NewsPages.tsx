import { CalendarDays } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Page } from "../components/UI";
import { newsPosts, tournaments } from "../data/platform";
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
  const categories = ["Winner Teams", "Match Updates", "Tournament Updates", "Announcements"];

  return (
    <Page>
      <PageHero title="Sports News" text="Winner teams, tournament updates, live match stories, and old match records from Smart Sportz managers." />
      <section className="news-feature-grid">
        {newsPosts.slice(0, 2).map((post) => (
          <Link className="news-feature-card click-card" to={`/news/${post.slug}`} key={post.slug}>
            <img src={post.image} alt="" />
            <div>
              <span className="status emerald">{post.category}</span>
              <h2>{post.title}</h2>
              <p>{post.shortDescription}</p>
              <small><CalendarDays size={14} /> {post.date} - {post.city}</small>
            </div>
          </Link>
        ))}
      </section>
      <section className="section">
        <div className="news-category-row">
          {categories.map((category) => <span key={category}>{category}</span>)}
        </div>
        <div className="content-grid">
          {newsPosts.map((post) => (
            <Link className="click-card" to={`/news/${post.slug}`} key={post.slug}>
              <article className="news-card panel">
                <img src={post.image} alt="" />
                <span className="status blue">{post.category}</span>
                <h3>{post.title}</h3>
                <p>{post.shortDescription}</p>
                <small>{post.sport} - {post.city} - {post.date}</small>
              </article>
            </Link>
          ))}
        </div>
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
      <section className="section">
        <PageHero title="Latest Updates" text="Related tournament and city stories." />
        <div className="content-grid">
          {related.map((item) => (
            <Link className="panel click-card news-card" to={`/news/${item.slug}`} key={item.slug}>
              <img src={item.image} alt="" />
              <h3>{item.title}</h3>
              <p>{item.shortDescription}</p>
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
