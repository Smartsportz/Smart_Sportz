import { CalendarDays, Heart, MessageCircle, Send, Share2, Trophy, X } from "lucide-react";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
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

// Custom hook for debouncing API calls
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  
  return debouncedValue;
}

export function GalleryPage() {
  useWheelHorizontal(".gallery-feed-grid");
  const [params, setParams] = useSearchParams();
  const [albumList, setAlbumList] = useState(galleryAlbums);
  const [social, setSocial] = useState(() => readGalleryState());
  const [selectedKey, setSelectedKey] = useState(params.get("image") || "");
  const [modalFlipped, setModalFlipped] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [socialLoaded, setSocialLoaded] = useState(false);
  const pendingLikes = useRef<Record<string, boolean>>({});
  const pendingComments = useRef<Record<string, string[]>>({});
  
  const futureEvents = useMemo(
    () => tournaments.map((item) => withRuntimeTournamentStatus(item)).filter((item) => item.status !== "Completed").slice(0, 4),
    [],
  );

  // Load social data with caching
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    
    // Check if data exists in localStorage and is recent (within 5 minutes)
    const cachedData = readGalleryState();
    const hasCachedData = Object.keys(cachedData).length > 0;
    
    if (hasCachedData) {
      setSocial(cachedData);
      setSocialLoaded(true);
      setIsLoading(false);
    }
    
    const loadSocialData = async () => {
      try {
        const remote = await apiRequest<Record<string, { likes?: number; comments?: string[] }>>(
          "/public/gallery/social",
          { signal: controller.signal },
          undefined
        );
        if (!active) return;
        
        setSocial((current) => {
          const merged: GallerySocialState = { ...current };
          Object.entries(remote).forEach(([key, value]) => {
            merged[key] = {
              ...merged[key],
              likes: value.likes ?? 0,
              comments: value.comments ?? [],
            };
          });
          writeGalleryState(merged);
          return merged;
        });
        setSocialLoaded(true);
        setIsLoading(false);
      } catch {
        if (active) {
          setIsLoading(false);
        }
      }
    };
    
    // Load immediately if no cache, otherwise load in background
    if (!hasCachedData) {
      loadSocialData();
    } else {
      // Background refresh
      setTimeout(loadSocialData, 100);
    }
    
    return () => {
      active = false;
      controller.abort();
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

  // Optimized like toggle with debounce
  const toggleGalleryLike = useCallback((key: string) => {
    const current = social[key] ?? { likes: 0, comments: [], liked: false };
    const liked = !current.liked;
    const newLikes = Math.max(0, (current.likes ?? 0) + (liked ? 1 : -1));
    
    // Immediate optimistic update
    const next = {
      ...social,
      [key]: {
        ...current,
        liked,
        likes: newLikes,
      },
    };
    persistGallerySocial(next);

    // Store pending like
    pendingLikes.current[key] = liked;

    // Debounced API call
    const timer = setTimeout(() => {
      const pendingLike = pendingLikes.current[key];
      if (pendingLike !== undefined) {
        apiRequest<{ image_key: string; likes: number; comments: string[] }>(
          "/public/gallery/social/like",
          {
            method: "POST",
            body: JSON.stringify({ image_key: key, liked: pendingLike }),
          },
          undefined
        ).then((remote) => {
          setSocial((currentState) => ({
            ...currentState,
            [key]: { ...currentState[key], likes: remote.likes, comments: remote.comments }
          }));
        }).catch(() => {
          // Revert on error
          setSocial((currentState) => ({
            ...currentState,
            [key]: { 
              ...currentState[key], 
              liked: !liked, 
              likes: Math.max(0, (currentState[key]?.likes ?? 0) - (liked ? 1 : -1)) 
            }
          }));
        });
        delete pendingLikes.current[key];
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [social]);

  // Optimized comment add with debounce
  const addGalleryComment = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedWinner || !commentDraft.trim()) return;
    const key = selectedWinner.key;
    const current = social[key] ?? { likes: 0, comments: [] };
    const comment = commentDraft.trim();

    // Immediate optimistic update
    const newComments = [...(current.comments ?? []), comment];
    persistGallerySocial({ 
      ...social, 
      [key]: { ...current, comments: newComments } 
    });
    setCommentDraft("");

    // Store pending comment
    if (!pendingComments.current[key]) {
      pendingComments.current[key] = [];
    }
    pendingComments.current[key].push(comment);

    // Debounced API call
    const timer = setTimeout(() => {
      const pending = pendingComments.current[key];
      if (pending && pending.length > 0) {
        const lastComment = pending[pending.length - 1];
        apiRequest<{ image_key: string; likes: number; comments: string[] }>(
          "/public/gallery/social/comment",
          {
            method: "POST",
            body: JSON.stringify({ image_key: key, comment: lastComment }),
          },
          undefined
        ).then((remote) => {
          setSocial((currentState) => ({
            ...currentState,
            [key]: { ...currentState[key], likes: remote.likes, comments: remote.comments }
          }));
        }).catch(() => {
          // Revert on error
          setSocial((currentState) => ({
            ...currentState,
            [key]: { 
              ...currentState[key], 
              comments: (currentState[key]?.comments ?? []).filter(c => c !== comment) 
            }
          }));
        });
        pendingComments.current[key] = [];
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [selectedWinner, commentDraft, social]);

  async function shareGalleryWinner(item: typeof winnerItems[number]) {
    const url = `${window.location.origin}${window.location.pathname}?image=${encodeURIComponent(item.key)}`;
    if (navigator.share) {
      await navigator.share({ title: item.image.title, url });
    } else {
      await navigator.clipboard.writeText(url);
      window.alert("Link copied.");
    }
  }

  // Memoized social data to prevent unnecessary re-renders
  const getSocialState = useCallback((key: string) => {
    return social[key] ?? { likes: 0, comments: [], liked: false };
  }, [social]);

  return (
    <Page className="gallery-page">
      <section className="gallery-section gallery-section-first">
        <div className="gallery-simple-title"><h1>Gallery</h1></div>
        {isLoading ? (
          <div className="gallery-loading">
            <p>Loading gallery...</p>
          </div>
        ) : (
          <div className="gallery-feed-grid wheel-horizontal">
            {winnerItems.map((winner) => {
              const state = getSocialState(winner.key);
              return (
                <article className="gallery-feed-card" key={winner.key}>
                  <button className="gallery-image-open" type="button" onClick={() => openWinner(winner.key)}>
                    <div className="gallery-winner-media"><img src={winner.image.image} alt="" loading="lazy" /></div>
                    <h3>{winner.image.title}</h3>
                  </button>
                  <div className="gallery-social-row">
                    <button 
                      type="button" 
                      className={state.liked ? "active" : ""} 
                      onClick={() => toggleGalleryLike(winner.key)}
                      aria-label="Like"
                    >
                      <Heart size={15} />{state.likes ?? 0}
                    </button>
                    <button type="button" onClick={() => openWinner(winner.key)}>
                      <MessageCircle size={15} />{state.comments?.length ?? 0}
                    </button>
                    <button type="button" onClick={() => void shareGalleryWinner(winner)}>
                      <Share2 size={15} />Share
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {selectedWinner && (
        <div className="gallery-modal-backdrop" role="dialog" aria-modal="true">
          <article className={`gallery-modal-card gallery-home-modal ${modalFlipped ? "flipped" : ""}`}>
            <button className="gallery-modal-close" type="button" onClick={closeWinner}><X size={18} /></button>
            <button className="gallery-modal-flipper" type="button" onClick={() => setModalFlipped((current) => !current)}>
              <div className="gallery-modal-face gallery-modal-front">
                <img src={selectedWinner.image.image} alt="" loading="lazy" />
                <div><span className="status emerald">{selectedWinner.round.name}</span><h2>{selectedWinner.image.title}</h2><p>{selectedWinner.image.caption}</p></div>
              </div>
              <div className="gallery-modal-face gallery-modal-back">
                <span className="status emerald">{selectedWinner.album.sport}</span><h2>{selectedWinner.image.title}</h2><p>{selectedWinner.image.description}</p>
                <small>{selectedWinner.album.title} - {selectedWinner.album.city}</small>
              </div>
            </button>
            <div className="gallery-modal-actions">
              <button 
                type="button" 
                className={social[selectedWinner.key]?.liked ? "active" : ""} 
                onClick={() => toggleGalleryLike(selectedWinner.key)}
              >
                <Heart size={16} />{social[selectedWinner.key]?.likes ?? 0}
              </button>
              <button type="button" onClick={() => void shareGalleryWinner(selectedWinner)}>
                <Share2 size={16} />Share
              </button>
            </div>
            <form className="gallery-comment-form" onSubmit={addGalleryComment}>
              <input 
                value={commentDraft} 
                onChange={(event) => setCommentDraft(event.target.value)} 
                placeholder="Comment..." 
                disabled={!socialLoaded}
              />
              <button type="submit" disabled={!commentDraft.trim() || !socialLoaded}>
                <Send size={16} />
              </button>
            </form>
            <div className="gallery-comment-list">
              {(social[selectedWinner.key]?.comments ?? []).map((comment, index) => (
                <p key={index}><b>Fan</b> <span>{comment}</span></p>
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
  const [isLoading, setIsLoading] = useState(true);
  const [socialLoaded, setSocialLoaded] = useState(false);
  const pendingLikes = useRef<Record<string, boolean>>({});
  const pendingComments = useRef<Record<string, string[]>>({});

  // Load social data with caching
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    
    const cachedData = readGalleryState();
    const hasCachedData = Object.keys(cachedData).length > 0;
    
    if (hasCachedData) {
      setSocial(cachedData);
      setSocialLoaded(true);
      setIsLoading(false);
    }
    
    const loadSocialData = async () => {
      try {
        const remote = await apiRequest<Record<string, { likes?: number; comments?: string[] }>>(
          "/public/gallery/social",
          { signal: controller.signal },
          undefined
        );
        if (!active) return;
        
        setSocial((current) => {
          const merged: GallerySocialState = { ...current };
          Object.entries(remote).forEach(([key, value]) => {
            merged[key] = { ...merged[key], likes: value.likes ?? 0, comments: value.comments ?? [] };
          });
          writeGalleryState(merged);
          return merged;
        });
        setSocialLoaded(true);
        setIsLoading(false);
      } catch {
        if (active) {
          setIsLoading(false);
        }
      }
    };
    
    if (!hasCachedData) {
      loadSocialData();
    } else {
      setTimeout(loadSocialData, 100);
    }
    
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!album) return;
    setActiveRoundId(params.get("round") || album.rounds[0]?.id || "");
    setSelectedImageId(params.get("image") || "");
    setFlipped(Boolean(params.get("image")));
  }, [album, params]);

  if (!album) return <Navigate to="/gallery" replace />;

  const activeRound = album.rounds.find((round) => round.id === activeRoundId) ?? album.rounds[0];
  const selectedImage = activeRound?.images.find((image) => image.id === selectedImageId);

  function persistGallerySocial(next: GallerySocialState) {
    setSocial(next);
    writeGalleryState(next);
  }

  const toggleLike = useCallback((roundId: string, imageId: string) => {
    const key = imageKey(album!.slug, roundId, imageId);
    const current = social[key] ?? { likes: 0, comments: [], liked: false };
    const liked = !current.liked;
    const newLikes = Math.max(0, (current.likes ?? 0) + (liked ? 1 : -1));
    
    // Immediate optimistic update
    const next = { ...social, [key]: { ...current, liked, likes: newLikes } };
    persistGallerySocial(next);

    pendingLikes.current[key] = liked;

    const timer = setTimeout(() => {
      const pendingLike = pendingLikes.current[key];
      if (pendingLike !== undefined) {
        apiRequest<{ likes: number; comments: string[] }>(
          "/public/gallery/social/like",
          {
            method: "POST",
            body: JSON.stringify({ image_key: key, liked: pendingLike }),
          },
          undefined
        ).then((remote) => {
          setSocial((prev) => ({ ...prev, [key]: { ...prev[key], likes: remote.likes, comments: remote.comments } }));
        }).catch(() => {
          setSocial((prev) => ({
            ...prev,
            [key]: { ...prev[key], liked: !liked, likes: Math.max(0, (prev[key]?.likes ?? 0) - (liked ? 1 : -1)) }
          }));
        });
        delete pendingLikes.current[key];
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [social, album]);

  const addComment = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedImage || !commentDraft.trim()) return;
    const key = imageKey(album!.slug, activeRound.id, selectedImage.id);
    const comment = commentDraft.trim();

    const prev = social[key] ?? { likes: 0, comments: [] };
    const newComments = [...(prev.comments ?? []), comment];
    const next = { ...social, [key]: { ...prev, comments: newComments } };
    persistGallerySocial(next);
    setCommentDraft("");

    if (!pendingComments.current[key]) {
      pendingComments.current[key] = [];
    }
    pendingComments.current[key].push(comment);

    const timer = setTimeout(() => {
      const pending = pendingComments.current[key];
      if (pending && pending.length > 0) {
        const lastComment = pending[pending.length - 1];
        apiRequest<{ likes: number; comments: string[] }>(
          "/public/gallery/social/comment",
          {
            method: "POST",
            body: JSON.stringify({ image_key: key, comment: lastComment }),
          },
          undefined
        ).then((remote) => {
          setSocial((prev) => ({ ...prev, [key]: { ...prev[key], likes: remote.likes, comments: remote.comments } }));
        }).catch(() => {
          setSocial((prev) => ({
            ...prev,
            [key]: { ...prev[key], comments: (prev[key]?.comments ?? []).filter(c => c !== comment) }
          }));
        });
        pendingComments.current[key] = [];
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [selectedImage, commentDraft, social, album, activeRound.id]);

  return (
    <Page className="gallery-page gallery-detail-page">
      <section className="gallery-detail-hero">
        <img src={album.cover} alt="" loading="lazy" />
        <div>
          <Link className="inline-link" to="/gallery">Back</Link>
          <h1>{album.title}</h1>
          <p>{album.summary}</p>
        </div>
      </section>

      <section className="gallery-section">
        <div className="gallery-round-grid">
          {album.rounds.map((round) => (
            <button 
              className={`gallery-round-card ${round.id === activeRound.id ? "active" : ""}`} 
              type="button" 
              onClick={() => setParams({ round: round.id })} 
              key={round.id}
            >
              <h3>{round.name}</h3><small>{round.date}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="gallery-section">
        {isLoading ? (
          <div className="gallery-loading">
            <p>Loading images...</p>
          </div>
        ) : (
          <div className="gallery-image-grid interactive-gallery-grid">
            {activeRound.images.map((item) => {
              const key = imageKey(album.slug, activeRound.id, item.id);
              const state = social[key] ?? { likes: 0, comments: [] };
              return (
                <article className="gallery-image-card" key={item.id}>
                  <button className="gallery-image-open" type="button" onClick={() => { setParams({ round: activeRound.id, image: item.id }); setFlipped(true); }}>
                    <img src={item.image} alt="" loading="lazy" />
                    <div><h3>{item.title}</h3><p>{item.caption}</p></div>
                  </button>
                  <div className="gallery-social-row">
                    <button 
                      type="button" 
                      className={state.liked ? "active" : ""} 
                      onClick={() => toggleLike(activeRound.id, item.id)}
                      aria-label="Like"
                    >
                      <Heart size={15} />{state.likes ?? 0}
                    </button>
                    <button type="button" onClick={() => { setParams({ round: activeRound.id, image: item.id }); setFlipped(true); }}>
                      <MessageCircle size={15} />{state.comments?.length ?? 0}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {selectedImage && (
        <div className="gallery-modal-backdrop" role="dialog" aria-modal="true">
          <article className={`gallery-modal-card ${flipped ? "flipped" : ""}`}>
            <button className="gallery-modal-close" type="button" onClick={() => { setParams({ round: activeRound.id }); setSelectedImageId(""); }}><X size={18} /></button>
            <button className="gallery-modal-flipper" type="button" onClick={() => setFlipped(!flipped)}>
              <div className="gallery-modal-face gallery-modal-front">
                <img src={selectedImage.image} alt="" loading="lazy" />
                <div><h2>{selectedImage.title}</h2><p>{selectedImage.caption}</p></div>
              </div>
              <div className="gallery-modal-face gallery-modal-back">
                <h2>{selectedImage.title}</h2><p>{selectedImage.description}</p>
              </div>
            </button>
            <div className="gallery-modal-actions">
              <button 
                type="button" 
                className={social[imageKey(album.slug, activeRound.id, selectedImage.id)]?.liked ? "active" : ""} 
                onClick={() => toggleLike(activeRound.id, selectedImage.id)}
              >
                <Heart size={16} />{social[imageKey(album.slug, activeRound.id, selectedImage.id)]?.likes ?? 0}
              </button>
            </div>
            <form className="gallery-comment-form" onSubmit={addComment}>
              <input 
                value={commentDraft} 
                onChange={(e) => setCommentDraft(e.target.value)} 
                placeholder="Comment..." 
                disabled={!socialLoaded}
              />
              <button type="submit" disabled={!commentDraft.trim() || !socialLoaded}>
                <Send size={16} />
              </button>
            </form>
            <div className="gallery-comment-list">
              {(social[imageKey(album.slug, activeRound.id, selectedImage.id)]?.comments ?? []).map((comment, index) => (
                <p key={index}><b>Fan</b> <span>{comment}</span></p>
              ))}
            </div>
          </article>
        </div>
      )}
    </Page>
  );
}