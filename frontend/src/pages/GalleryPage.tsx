import { CalendarDays, MapPin, Trophy } from "lucide-react";
import { useMemo } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Page } from "../components/UI";
import { assets, tournaments, withRuntimeTournamentStatus } from "../data/platform";

const galleryAlbums = [
  {
    slug: "kerala-volleyball-classic",
    title: "Kerala Volleyball Classic 2025",
    city: "Kochi",
    sport: "Volleyball",
    date: "Dec 02 - Dec 12",
    cover: assets.volleyball,
    summary: "Final day ceremony, winning rallies, team huddles, and award moments.",
    images: [
      { title: "Championship Spike", caption: "Winning point from the final set.", image: assets.volleyball },
      { title: "Team Celebration", caption: "Kerala Spikers lift the closing trophy.", image: assets.cricket },
      { title: "Court Presentation", caption: "Officials and captains after final verification.", image: assets.basketball },
      { title: "Crowd Moment", caption: "Supporters during the final whistle.", image: assets.football },
    ],
  },
  {
    slug: "delhi-cricket-champions",
    title: "Delhi Cricket Champions 2025",
    city: "Delhi",
    sport: "Cricket",
    date: "Nov 05 - Nov 24",
    cover: assets.cricket,
    summary: "Completed cricket tournament archive with innings, awards, and team photos.",
    images: [
      { title: "Night Final", caption: "Floodlit final with full tournament attendance.", image: assets.cricket },
      { title: "Opening Partnership", caption: "Top-order stand from the championship innings.", image: assets.football },
      { title: "MVP Award", caption: "Best player presentation after the final match.", image: assets.volleyball },
      { title: "Captain's Walk", caption: "Winning captain arrives for the post-match ceremony.", image: assets.basketball },
    ],
  },
];

export function GalleryPage() {
  const futureEvents = useMemo(
    () => tournaments.map((item) => withRuntimeTournamentStatus(item)).filter((item) => item.status !== "Completed").slice(0, 3),
    [],
  );

  return (
    <Page className="gallery-page">
      <section className="gallery-section gallery-section-first">
        <div className="section-title row-title gallery-title-row">
          <div>
            <p className="eyebrow">Completed Tournaments</p>
            <h1>Gallery</h1>
            <p>Completed tournament albums are arranged first. Open one to view its ordered match photos, winner moments, and media records.</p>
          </div>
        </div>
        <div className="gallery-album-grid">
          {galleryAlbums.map((album) => (
            <Link
              className="gallery-album-card"
              key={album.slug}
              to={`/gallery/${album.slug}`}
            >
              <img src={album.cover} alt="" />
              <div className="gallery-album-copy">
                <span className="status emerald">{album.sport}</span>
                <h3>{album.title}</h3>
                <p>{album.summary}</p>
                <small><MapPin size={14} /> {album.city} <span /> <CalendarDays size={14} /> {album.date}</small>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="gallery-section">
        <div className="section-title gallery-future-title">
          <div>
            <p className="eyebrow">Future Events</p>
            <h2>Upcoming media queues</h2>
          </div>
          <p>Future event galleries will appear after the tournament is completed and media is approved.</p>
        </div>
        <div className="gallery-future-list">
          {futureEvents.map((item) => (
            <Link className="gallery-future-card" to={`/tournaments/${item.slug}`} key={item.slug}>
              <img src={item.image} alt="" />
              <div>
                <span className={`status ${item.accent}`}>{item.status}</span>
                <h3>{item.name}</h3>
                <p><Trophy size={14} /> {item.sport} - {item.location} - {item.date}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </Page>
  );
}

export function GalleryAlbumPage() {
  const { slug } = useParams();
  const album = galleryAlbums.find((item) => item.slug === slug);

  if (!album) {
    return <Navigate to="/gallery" replace />;
  }

  return (
    <Page className="gallery-page gallery-detail-page">
      <section className="gallery-detail-hero">
        <img src={album.cover} alt="" />
        <div>
          <Link className="inline-link" to="/gallery">Back to gallery</Link>
          <p className="eyebrow">{album.sport} Album</p>
          <h1>{album.title}</h1>
          <p>{album.summary}</p>
          <small><MapPin size={14} /> {album.city} <span /> <CalendarDays size={14} /> {album.date}</small>
        </div>
      </section>

      <section className="gallery-section">
        <div className="section-title row-title gallery-title-row">
          <div>
            <p className="eyebrow">Image Group</p>
            <h2>Ordered tournament media</h2>
            <p>Photos are grouped in match-flow order so visitors can review the completed tournament story clearly.</p>
          </div>
          <Link className="inline-link" to={`/tournaments/${album.slug}`}>Open tournament</Link>
        </div>
        <div className="gallery-image-grid">
          {album.images.map((item, index) => (
            <article className="gallery-image-card" key={`${album.slug}-${item.title}`}>
              <img src={item.image} alt="" />
              <div>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{item.title}</h3>
                <p>{item.caption}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </Page>
  );
}
