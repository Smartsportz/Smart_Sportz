import { CalendarDays, Heart, MessageCircle, Send, Share2, Trophy, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { Page } from "../components/UI";
import { assets, tournaments, withRuntimeTournamentStatus } from "../data/platform";
import { apiRequest } from "../lib/api";
import { useWheelHorizontal } from "../lib/useWheelHorizontal";

type GalleryImage = {
  id: string;
  title: string;
  caption: string;
  description: string;
  image: string;
  photographer: string;
};

type GalleryRound = {
  id: string;
  name: string;
  date: string;
  day: string;
  scoreline: string;
  summary: string;
  images: GalleryImage[];
};

type GalleryAlbum = {
  slug: string;
  title: string;
  city: string;
  sport: string;
  date: string;
  month: string;
  days: string;
  cover: string;
  summary: string;
  rounds: GalleryRound[];
};

type GallerySocialState = Record<string, { liked?: boolean; likes?: number; comments?: string[] }>;

const galleryAlbums: GalleryAlbum[] = [
  {
    slug: "kerala-volleyball-classic",
    title: "Kerala Volleyball Classic 2025",
    city: "Kochi",
    sport: "Volleyball",
    date: "Dec 02 - Dec 12, 2025",
    month: "Dec 2025",
    days: "11 tournament days",
    cover: assets.volleyball,
    summary: "Final day ceremony, winning rallies, team huddles, awards, and verified match media.",
    rounds: [
      {
        id: "quarter-final",
        name: "Quarter Final",
        date: "Dec 07 - Dec 08, 2025",
        day: "Day 6-7",
        scoreline: "Kochi Spikers and Calicut Smashers advanced",
        summary: "The quarter-final stage captured first knockout pressure, crowd intensity, and manager-verified score moments.",
        images: [
          { id: "kv-qf-spike", title: "Opening Knockout Spike", caption: "Kochi opened the knockout phase with aggressive left-side attacks.", description: "A key quarter-final moment where Kochi Spikers changed tempo after the technical timeout. This image is linked to the official score archive for the round.", image: assets.volleyball, photographer: "SmartSportz Media" },
          { id: "kv-qf-huddle", title: "Timeout Huddle", caption: "Calicut regrouped before the fifth-set finish.", description: "The coaching huddle before Calicut's decisive run. Managers tagged this as a tactical moment for the completed tournament record.", image: assets.cricket, photographer: "Arena Desk" },
          { id: "kv-qf-crowd", title: "Quarter Crowd Wall", caption: "Supporters filled the Kochi indoor court.", description: "Crowd participation and sponsor visibility from the knockout evening, stored with the tournament media archive.", image: assets.basketball, photographer: "Public Gallery Team" },
        ],
      },
      {
        id: "semi-final",
        name: "Semi Final",
        date: "Dec 10, 2025",
        day: "Day 9",
        scoreline: "Kochi Spikers 3-0, Calicut Smashers 3-1",
        summary: "Semi-final images focus on finalist qualification, officials review, and award desk preparation.",
        images: [
          { id: "kv-sf-block", title: "Net Control", caption: "Kochi's middle blockers owned the third set.", description: "This semi-final image highlights Kochi's block formation, one of the match records used by the live scoring team.", image: assets.volleyball, photographer: "Court Camera 2" },
          { id: "kv-sf-awards", title: "Finalist Walkout", caption: "The two finalists were confirmed after the night session.", description: "Captured immediately after score confirmation and bracket progression. The image links to the semi-final media group.", image: assets.football, photographer: "SmartSportz Media" },
        ],
      },
      {
        id: "final",
        name: "Final",
        date: "Dec 12, 2025",
        day: "Day 11",
        scoreline: "Kochi Spikers beat Calicut Smashers 3-1",
        summary: "The final round contains trophy lift, MVP award, winning point, and team celebration photos.",
        images: [
          { id: "kv-final-trophy", title: "Trophy Lift", caption: "Kochi Spikers lifted the Classic trophy.", description: "The official winner image for Kerala Volleyball Classic 2025. This card is shareable as the direct tournament gallery proof link.", image: assets.volleyball, photographer: "Final Desk" },
          { id: "kv-final-mvp", title: "MVP Presentation", caption: "Kiran Thomas received the final MVP award.", description: "Award ceremony image with tournament partners and officials. Used in news, certificates, and sponsor reporting.", image: assets.basketball, photographer: "Awards Team" },
          { id: "kv-final-team", title: "Champion Team Frame", caption: "The full team posed after media verification.", description: "Champion team group image stored in final-round gallery sequence for public and manager records.", image: assets.cricket, photographer: "SmartSportz Media" },
        ],
      },
    ],
  },
  {
    slug: "delhi-cricket-champions",
    title: "Delhi Cricket Champions 2025",
    city: "Delhi",
    sport: "Cricket",
    date: "Nov 05 - Nov 24, 2025",
    month: "Nov 2025",
    days: "20 tournament days",
    cover: assets.cricket,
    summary: "Completed cricket archive with innings photos, awards, team records, and verified player score moments.",
    rounds: [
      {
        id: "round-1",
        name: "Round-1",
        date: "Nov 07 - Nov 08, 2025",
        day: "Day 3-4",
        scoreline: "Delhi Capitals Academy and Noida Strikers advanced",
        summary: "Opening elimination round media with score checkpoints, wickets, innings milestones, and crowd scenes.",
        images: [
          { id: "dc-r1-night-final", title: "Opening Night Lights", caption: "Floodlit cricket with full tournament attendance.", description: "The opening archive image for the Delhi Cricket Champions knockout stage, used to anchor the Round-1 story.", image: assets.cricket, photographer: "Broadcast Camera" },
          { id: "dc-r1-partnership", title: "Opening Partnership", caption: "Top-order stand from the chase phase.", description: "A partnership image connected to individual score records and match timeline notes.", image: assets.football, photographer: "Score Desk" },
          { id: "dc-r1-wicket", title: "Powerplay Wicket", caption: "Delhi struck early during the first six overs.", description: "Manager-marked wicket event from the live score engine, preserved in the old tournament gallery.", image: assets.volleyball, photographer: "Boundary Camera" },
        ],
      },
      {
        id: "semi-final",
        name: "Semi Final",
        date: "Nov 20 - Nov 21, 2025",
        day: "Day 16-17",
        scoreline: "Delhi won by 15 runs, Noida won by 5 runs",
        summary: "Semi-final media shows pressure overs, team celebrations, captain decisions, and official score review.",
        images: [
          { id: "dc-sf-stand", title: "Second Wicket Stand", caption: "Delhi built the innings with a 92-run stand.", description: "A semi-final batting phase image linked to the match record and batting card.", image: assets.cricket, photographer: "SmartSportz Media" },
          { id: "dc-sf-yorker", title: "Final Over Yorker", caption: "Noida defended the last over with two yorkers.", description: "A decisive bowling image from the second semi-final, stored with the player impact score.", image: assets.basketball, photographer: "Score Desk" },
        ],
      },
      {
        id: "final",
        name: "Final",
        date: "Nov 24, 2025",
        day: "Day 20",
        scoreline: "Delhi Capitals Academy beat Noida Strikers by 18 runs",
        summary: "Final media captures trophy presentation, MVP, official scorecards, and champion team images.",
        images: [
          { id: "dc-final-trophy", title: "Champions Trophy", caption: "Delhi Capitals Academy lifted the title.", description: "The official champion image from the final, connected to payment, certificate, and gallery archives.", image: assets.cricket, photographer: "Final Desk" },
          { id: "dc-final-mvp", title: "MVP Award", caption: "Rohan Sharma collected the tournament MVP award.", description: "Award detail image for news publishing and player records.", image: assets.volleyball, photographer: "Awards Team" },
          { id: "dc-final-captain", title: "Captain's Walk", caption: "The winning captain arrived for the ceremony.", description: "A shareable final ceremony card with direct image link support.", image: assets.basketball, photographer: "SmartSportz Media" },
        ],
      },
    ],
  },
];

const galleryStateKey = "smart-sportz-gallery-social";

function imageKey(albumSlug: string, roundId: string, imageId: string) {
  return `${albumSlug}:${roundId}:${imageId}`;
}

function readGalleryState(): GallerySocialState {
  if (typeof localStorage === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(galleryStateKey) || "{}") as GallerySocialState;
  } catch {
    return {};
  }
}

function writeGalleryState(value: GallerySocialState) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(galleryStateKey, JSON.stringify(value));
}

export function GalleryPage() {
  useWheelHorizontal(".gallery-feed-grid");
  const [params, setParams] = useSearchParams();
  const [albumList, setAlbumList] = useState(galleryAlbums);
  const [social, setSocial] = useState(() => readGalleryState());
  const [selectedKey, setSelectedKey] = useState(params.get("image") || "");
  const [modalFlipped, setModalFlipped] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const futureEvents = useMemo(
    () => tournaments.map((item) => withRuntimeTournamentStatus(item)).filter((item) => item.status !== "Completed").slice(0, 4),
    [],
  );

  useEffect(() => {
    let active = true;
    apiRequest<Array<{
      slug: string;
      title: string;
      sport: string;
      city: string;
      date_label: string;
      month_label: string;
      day_count: number;
      cover: string;
      summary: string;
    }>>("/public/gallery/albums")
      .then((remote) => {
        if (!active || remote.length === 0) return;
        setAlbumList(galleryAlbums.map((album) => {
          const match = remote.find((item) => item.slug === album.slug);
          if (!match) return album;
          return {
            ...album,
            title: match.title,
            city: match.city,
            sport: match.sport,
            date: match.date_label,
            month: match.month_label,
            days: `${match.day_count} tournament days`,
            cover: match.cover,
            summary: match.summary,
          };
        }));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    apiRequest<Record<string, { likes?: number; comments?: string[] }>>("/public/gallery/social")
      .then((remote) => {
        if (!active) return;
        setSocial((current) => {
          const merged: GallerySocialState = { ...current };
          Object.entries(remote).forEach(([key, value]) => {
            merged[key] = {
              ...merged[key],
              likes: value.likes,
              comments: value.comments ?? [],
            };
          });
          writeGalleryState(merged);
          return merged;
        });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const winnerItems = useMemo(() => albumList.map((album) => {
    const finalRound = album.rounds.find((round) => round.id === "final") ?? album.rounds[album.rounds.length - 1];
    const finalImage = finalRound.images[0];
    const key = imageKey(album.slug, finalRound.id, finalImage.id);
    return { album, round: finalRound, image: finalImage, key };
  }), [albumList]);
  const selectedWinner = winnerItems.find((item) => item.key === selectedKey);

  useEffect(() => {
    const imageParam = params.get("image") || "";
    if (imageParam) setSelectedKey(imageParam);
  }, [params]);

  function persistGallerySocial(next: GallerySocialState) {
    setSocial(next);
    writeGalleryState(next);
  }

  function openWinner(key: string) {
    setSelectedKey(key);
    setParams({ image: key });
    setCommentDraft("");
    setModalFlipped(false);
  }

  function closeWinner() {
    setSelectedKey("");
    setParams({});
    setCommentDraft("");
    setModalFlipped(false);
  }

  function toggleGalleryLike(key: string) {
    const current = social[key] ?? { likes: 24, comments: [] };
    const liked = !current.liked;
    const next = {
      ...social,
      [key]: {
        ...current,
        liked,
        likes: Math.max(0, (current.likes ?? 24) + (liked ? 1 : -1)),
      },
    };
    persistGallerySocial(next);
    apiRequest<{ image_key: string; likes: number; comments: string[] }>("/public/gallery/social/like", {
      method: "POST",
      body: JSON.stringify({ image_key: key, liked }),
    }).then((remote) => {
      setSocial((currentState) => {
        const merged = { ...currentState, [key]: { ...currentState[key], likes: remote.likes, comments: remote.comments } };
        writeGalleryState(merged);
        return merged;
      });
    }).catch(() => undefined);
  }

  function addGalleryComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedWinner || !commentDraft.trim()) return;
    const key = selectedWinner.key;
    const current = social[key] ?? { likes: 24, comments: [] };
    const comment = commentDraft.trim();
    persistGallerySocial({ ...social, [key]: { ...current, comments: [...(current.comments ?? []), comment] } });
    setCommentDraft("");
    apiRequest<{ image_key: string; likes: number; comments: string[] }>("/public/gallery/social/comment", {
      method: "POST",
      body: JSON.stringify({ image_key: key, comment }),
    }).then((remote) => {
      setSocial((currentState) => {
        const merged = { ...currentState, [key]: { ...currentState[key], likes: remote.likes, comments: remote.comments } };
        writeGalleryState(merged);
        return merged;
      });
    }).catch(() => undefined);
  }

  async function shareGalleryWinner(item: typeof winnerItems[number]) {
    const url = `${window.location.origin}${window.location.pathname}?image=${encodeURIComponent(item.key)}`;
    const imageUrl = new URL(item.image.image, window.location.origin).toString();
    const sharePayload = {
      title: item.image.title,
      text: `${item.image.title} - ${item.album.title}. Image: ${imageUrl}`,
      url,
    };
    if (navigator.share) {
      await navigator.share(sharePayload);
      return;
    }
    await navigator.clipboard.writeText(`${sharePayload.text}\n${url}`);
    window.alert("Gallery image link copied.");
  }

  return (
    <Page className="gallery-page">
      <section className="gallery-section gallery-section-first">
        <div className="gallery-simple-title">
          <h1>Gallery</h1>
        </div>
        <div className="gallery-feed-grid wheel-horizontal">
          {winnerItems.map((winner) => {
            const state = social[winner.key] ?? { likes: 24, comments: [] };
            return (
              <article className="gallery-feed-card" key={winner.key}>
                <button className="gallery-image-open" type="button" onClick={() => openWinner(winner.key)}>
                  <div className="gallery-winner-media">
                    <img src={winner.image.image} alt="" />
                  </div>
                  <h3>{winner.image.title}</h3>
                </button>
                <div className="gallery-social-row">
                  <button type="button" className={state.liked ? "active" : ""} onClick={() => toggleGalleryLike(winner.key)}><Heart size={15} />{state.likes ?? 24}</button>
                  <button type="button" onClick={() => openWinner(winner.key)}><MessageCircle size={15} />{state.comments?.length ?? 0}</button>
                  <button type="button" onClick={() => void shareGalleryWinner(winner)}><Share2 size={15} />Share</button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="gallery-section" hidden aria-hidden="true">
        <div className="section-title gallery-future-title">
          <div>
            <p className="eyebrow">Future Events</p>
            <h2>Upcoming media queues</h2>
          </div>
          <p>Future event galleries appear here after tournament completion, manager review, and media publish.</p>
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

      {selectedWinner && (
        <div className="gallery-modal-backdrop" role="dialog" aria-modal="true" aria-label={`${selectedWinner.image.title} gallery detail`}>
          <article className={`gallery-modal-card gallery-home-modal ${modalFlipped ? "flipped" : ""}`}>
            <button className="gallery-modal-close" type="button" onClick={closeWinner} aria-label="Close image detail"><X size={18} /></button>
            <button className="gallery-modal-flipper" type="button" onClick={() => setModalFlipped((current) => !current)} aria-label="Flip gallery image detail">
              <div className="gallery-modal-face gallery-modal-front">
                <img src={selectedWinner.image.image} alt="" />
                <div>
                  <span className="status emerald">{selectedWinner.round.name}</span>
                  <h2>{selectedWinner.image.title}</h2>
                  <p>{selectedWinner.image.caption}</p>
                </div>
              </div>
              <div className="gallery-modal-face gallery-modal-back">
                <span className="status emerald">{selectedWinner.album.sport}</span>
                <h2>{selectedWinner.image.title}</h2>
                <p>{selectedWinner.image.description}</p>
                <small>{selectedWinner.album.title} - {selectedWinner.album.city} - {selectedWinner.album.date}</small>
              </div>
            </button>
            <div className="gallery-modal-actions">
              <button type="button" className={social[selectedWinner.key]?.liked ? "active" : ""} onClick={() => toggleGalleryLike(selectedWinner.key)}><Heart size={16} />{social[selectedWinner.key]?.likes ?? 24}</button>
              <button type="button" onClick={() => void shareGalleryWinner(selectedWinner)}><Share2 size={16} />Share image</button>
            </div>
            <form className="gallery-comment-form" onSubmit={addGalleryComment}>
              <input value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} placeholder="Write a comment for this winner image..." />
              <button type="submit"><Send size={16} />Post</button>
            </form>
            <div className="gallery-comment-list">
              {(social[selectedWinner.key]?.comments ?? []).map((comment, index) => (
                <p key={`${comment}-${index}`}><b>Fan {index + 1}</b><span>{comment}</span></p>
              ))}
            </div>
          </article>
        </div>
      )}
    </Page>
  );
}

export function GalleryAlbumPage() {
  const { slug } = useParams();
  const [params, setParams] = useSearchParams();
  const album = galleryAlbums.find((item) => item.slug === slug);
  const [activeRoundId, setActiveRoundId] = useState(params.get("round") || album?.rounds[0]?.id || "");
  const [selectedImageId, setSelectedImageId] = useState(params.get("image") || "");
  const [flipped, setFlipped] = useState(Boolean(params.get("image")));
  const [social, setSocial] = useState(() => readGalleryState());
  const [commentDraft, setCommentDraft] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest<Record<string, { likes?: number; comments?: string[] }>>("/public/gallery/social")
      .then((remote) => {
        if (!active) return;
        setSocial((current) => {
          const merged: GallerySocialState = { ...current };
          Object.entries(remote).forEach(([key, value]) => {
            merged[key] = {
              ...merged[key],
              likes: value.likes,
              comments: value.comments ?? [],
            };
          });
          writeGalleryState(merged);
          return merged;
        });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!album) return;
    const nextRound = params.get("round") || album.rounds[0]?.id || "";
    const nextImage = params.get("image") || "";
    setActiveRoundId(nextRound);
    setSelectedImageId(nextImage);
    setFlipped(Boolean(nextImage));
  }, [album, params]);

  if (!album) {
    return <Navigate to="/gallery" replace />;
  }

  const currentAlbum = album;
  const activeRound = currentAlbum.rounds.find((round) => round.id === activeRoundId) ?? currentAlbum.rounds[0];
  const selectedImage = activeRound?.images.find((image) => image.id === selectedImageId);

  function persistSocial(next: typeof social) {
    setSocial(next);
    writeGalleryState(next);
  }

  function openImage(roundId: string, imageId: string) {
    setParams({ round: roundId, image: imageId });
    setSelectedImageId(imageId);
    setFlipped(true);
  }

  function closeImage() {
    setSelectedImageId("");
    setFlipped(false);
    setParams({ round: activeRound.id });
  }

  function toggleLike(roundId: string, imageId: string) {
    const key = imageKey(currentAlbum.slug, roundId, imageId);
    const current = social[key] ?? { likes: 24, comments: [] };
    const liked = !current.liked;
    const next = {
      ...social,
      [key]: {
        ...current,
        liked,
        likes: Math.max(0, (current.likes ?? 24) + (liked ? 1 : -1)),
      },
    };
    persistSocial(next);
    apiRequest<{ image_key: string; likes: number; comments: string[] }>("/public/gallery/social/like", {
      method: "POST",
      body: JSON.stringify({ image_key: key, liked }),
    })
      .then((remote) => {
        setSocial((currentState) => {
          const merged = {
            ...currentState,
            [key]: {
              ...currentState[key],
              likes: remote.likes,
              comments: remote.comments,
            },
          };
          writeGalleryState(merged);
          return merged;
        });
      })
      .catch(() => undefined);
  }

  function addComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedImage || !commentDraft.trim()) return;
    const key = imageKey(currentAlbum.slug, activeRound.id, selectedImage.id);
    const current = social[key] ?? { likes: 24, comments: [] };
    const comment = commentDraft.trim();
    persistSocial({
      ...social,
      [key]: { ...current, comments: [...(current.comments ?? []), comment] },
    });
    setCommentDraft("");
    apiRequest<{ image_key: string; likes: number; comments: string[] }>("/public/gallery/social/comment", {
      method: "POST",
      body: JSON.stringify({ image_key: key, comment }),
    })
      .then((remote) => {
        setSocial((currentState) => {
          const merged = {
            ...currentState,
            [key]: {
              ...currentState[key],
              likes: remote.likes,
              comments: remote.comments,
            },
          };
          writeGalleryState(merged);
          return merged;
        });
      })
      .catch(() => undefined);
  }

  async function shareImage(roundId: string, image: GalleryImage) {
    const url = `${window.location.origin}${window.location.pathname}?round=${roundId}&image=${image.id}`;
    const sharePayload = {
      title: image.title,
      text: `${image.title} - ${image.caption}`,
      url,
    };
    if (navigator.share) {
      await navigator.share(sharePayload);
      return;
    }
    await navigator.clipboard.writeText(url);
    window.alert("Image link copied. Share it in any app.");
  }

  return (
    <Page className="gallery-page gallery-detail-page">
      <section className="gallery-detail-hero">
        <img src={currentAlbum.cover} alt="" />
        <div>
          <Link className="inline-link" to="/gallery">Back to gallery</Link>
          <p className="eyebrow">{currentAlbum.sport} Album</p>
          <h1>{currentAlbum.title}</h1>
          <p>{currentAlbum.summary}</p>
          <small>{currentAlbum.days} <span /> <CalendarDays size={14} /> {currentAlbum.date}</small>
        </div>
      </section>

      <section className="gallery-section">
        <div className="section-title row-title gallery-title-row">
          <div>
            <p className="eyebrow">Tournament Rounds</p>
            <h2>Select a round</h2>
            <p>Each round opens its verified photo group. Open a photo card to flip it into a large detail view.</p>
          </div>
          <Link className="inline-link" to={`/tournaments/${currentAlbum.slug}`}>Open tournament</Link>
        </div>
        <div className="gallery-round-grid">
          {currentAlbum.rounds.map((round) => (
            <button className={`gallery-round-card ${round.id === activeRound.id ? "active" : ""}`} type="button" onClick={() => setParams({ round: round.id })} key={round.id}>
              <span>{round.day}</span>
              <h3>{round.name}</h3>
              <p>{round.summary}</p>
              <small>{round.date}</small>
              <strong>{round.scoreline}</strong>
            </button>
          ))}
        </div>
      </section>

      <section className="gallery-section">
        <div className="section-title row-title gallery-title-row">
          <div>
            <p className="eyebrow">Round Images</p>
            <h2>{activeRound.name}</h2>
            <p>{activeRound.summary}</p>
          </div>
        </div>
        <div className="gallery-image-grid interactive-gallery-grid">
          {activeRound.images.map((item, index) => {
            const key = imageKey(currentAlbum.slug, activeRound.id, item.id);
            const state = social[key] ?? { likes: 24 + index * 3, comments: [] };
            return (
              <article className="gallery-image-card gallery-flip-card" key={item.id}>
                <button className="gallery-image-open" type="button" onClick={() => openImage(activeRound.id, item.id)}>
                  <img src={item.image} alt="" />
                  <div>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <h3>{item.title}</h3>
                    <p>{item.caption}</p>
                  </div>
                </button>
                <div className="gallery-social-row">
                  <button type="button" className={state.liked ? "active" : ""} onClick={() => toggleLike(activeRound.id, item.id)}><Heart size={15} />{state.likes ?? 24}</button>
                  <button type="button" onClick={() => openImage(activeRound.id, item.id)}><MessageCircle size={15} />{state.comments?.length ?? 0}</button>
                  <button type="button" onClick={() => void shareImage(activeRound.id, item)}><Share2 size={15} />Share</button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {selectedImage && (
        <div className="gallery-modal-backdrop" role="dialog" aria-modal="true" aria-label={`${selectedImage.title} image detail`}>
          <article className={`gallery-modal-card ${flipped ? "flipped" : ""}`}>
            <button className="gallery-modal-close" type="button" onClick={closeImage} aria-label="Close image detail"><X size={18} /></button>
            <button className="gallery-modal-flipper" type="button" onClick={() => setFlipped((value) => !value)}>
              <div className="gallery-modal-face gallery-modal-front">
                <img src={selectedImage.image} alt="" />
                <div>
                  <span className="status emerald">{activeRound.name}</span>
                  <h2>{selectedImage.title}</h2>
                  <p>{selectedImage.caption}</p>
                </div>
              </div>
              <div className="gallery-modal-face gallery-modal-back">
                <span className="status blue">Image Description</span>
                <h2>{selectedImage.title}</h2>
                <p>{selectedImage.description}</p>
                <small>Photographer: {selectedImage.photographer}</small>
                <small>Direct link opens this exact image card.</small>
              </div>
            </button>
            <div className="gallery-modal-actions">
              <button type="button" className={social[imageKey(currentAlbum.slug, activeRound.id, selectedImage.id)]?.liked ? "active" : ""} onClick={() => toggleLike(activeRound.id, selectedImage.id)}><Heart size={16} />{social[imageKey(currentAlbum.slug, activeRound.id, selectedImage.id)]?.likes ?? 24}</button>
              <button type="button" onClick={() => void shareImage(activeRound.id, selectedImage)}><Share2 size={16} />Share this image</button>
            </div>
            <form className="gallery-comment-form" onSubmit={addComment}>
              <input value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} placeholder="Write a comment for this image..." />
              <button type="submit"><Send size={16} />Post</button>
            </form>
            <div className="gallery-comment-list">
              {(social[imageKey(currentAlbum.slug, activeRound.id, selectedImage.id)]?.comments ?? []).map((comment, index) => (
                <p key={`${comment}-${index}`}><b>Fan {index + 1}</b><span>{comment}</span></p>
              ))}
            </div>
          </article>
        </div>
      )}
    </Page>
  );
}
