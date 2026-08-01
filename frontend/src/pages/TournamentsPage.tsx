import { Filter, MapPin, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Page, TournamentCard } from "../components/UI";
import { sports, tournaments, withRuntimeTournamentStatus } from "../data/platform";
import { useWheelHorizontal } from "../lib/useWheelHorizontal";
import { PageHero } from "./shared";

function FeaturedTournamentMiniCard({ item }: { item: any }) {
  return (
    <Link className="featured-mini-card click-card" to={`/tournaments/${item.slug}`}>
      <img src={item.image} alt="" />
      <div>
        <h3>{item.name}</h3>
        <p><MapPin size={15} />{item.location}</p>
      </div>
    </Link>
  );
}

export function TournamentsPage() {
  useWheelHorizontal();
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedPlaces, setSelectedPlaces] = useState<string[]>([]);
  const [featuredOnly, setFeaturedOnly] = useState(false);

  const runtimeTournaments = useMemo(() => tournaments.map((item) => withRuntimeTournamentStatus(item)), []);
  const placeOptions = useMemo(
    () => Array.from(new Set(runtimeTournaments.flatMap((item) => [item.location, ...(item.cities ?? [])]))).sort(),
    [runtimeTournaments],
  );
  const statusOptions = ["Featured", "Open Registration", "Upcoming", "Live", "Completed"];

  function toggleValue(list: string[], value: string) {
    return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
  }

  const filteredTournaments = runtimeTournaments.filter((item: any) => {
    const query = search.trim().toLowerCase();
    const searchable = [item.name, item.sport, item.location, item.status, ...(item.cities ?? [])].join(" ").toLowerCase();
    const matchesSearch = !query || searchable.includes(query);
    const matchesSport = selectedSports.length === 0 || selectedSports.includes(item.sport);
    const matchesPlace = selectedPlaces.length === 0 || selectedPlaces.some((place) => item.location === place || item.cities?.includes(place));
    const isFeatured = item.show_on_home !== false;
    const matchesFeatured = !featuredOnly || isFeatured;
    const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.some((status) => {
      if (status === "Featured") return isFeatured;
      if (status === "Open Registration") return item.status === "Registration Open";
      if (status === "Completed") return item.status === "Completed";
      return item.status === status;
    });
    return matchesSearch && matchesSport && matchesPlace && matchesFeatured && matchesStatus;
  });

  function clearFilters() {
    setSearch("");
    setSelectedSports([]);
    setSelectedStatuses([]);
    setSelectedPlaces([]);
    setFeaturedOnly(false);
  }

  const sections = [
    {
      key: "featured",
      title: "Featured tournaments",
      text: "Manager-selected tournament cards with only the event title and place.",
      compact: true,
      items: filteredTournaments.filter((item: any) => item.show_on_home !== false).slice(0, 8),
    },
    {
      key: "upcoming",
      title: "Upcoming tournaments",
      text: "Open registration tournaments available for team entry now.",
      items: filteredTournaments.filter((item) => item.status === "Registration Open"),
    },
    {
      key: "live",
      title: "Live tournaments",
      text: "Tournaments currently running with live rooms, scoreboards, and rounds.",
      items: filteredTournaments.filter((item) => item.status === "Live"),
    },
    {
      key: "old",
      title: "Old tournaments",
      text: "Completed tournament records and archived competitions.",
      items: filteredTournaments.filter((item) => item.status === "Completed"),
    },
  ].filter((section) => section.items.length > 0);

  return (
    <Page className="tournaments-page">
      <PageHero title="Find Your Next Tournament" text="Search, filter, register, and follow professional tournaments across cricket, football, basketball, volleyball, and more." />
      <div className="filter-bar tournament-filter-bar">
        <Search size={18} />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tournaments..." />
        <button type="button" className={filtersOpen ? "active" : ""} onClick={() => setFiltersOpen((value) => !value)}><Filter size={16} /> Advanced filters</button>
      </div>
      {filtersOpen && (
        <section className="advanced-filter-panel">
          <div className="filter-group">
            <h3>Status</h3>
            <div className="filter-chip-grid">
              {statusOptions.map((status) => (
                <button
                  type="button"
                  className={selectedStatuses.includes(status) || (status === "Featured" && featuredOnly) ? "active" : ""}
                  onClick={() => status === "Featured" ? setFeaturedOnly((value) => !value) : setSelectedStatuses((current) => toggleValue(current, status))}
                  key={status}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
          <div className="filter-group">
            <h3>Sports</h3>
            <div className="filter-chip-grid">
              {sports.map((sport) => (
                <button type="button" className={selectedSports.includes(sport.name) ? "active" : ""} onClick={() => setSelectedSports((current) => toggleValue(current, sport.name))} key={sport.slug}>
                  {sport.name}
                </button>
              ))}
            </div>
          </div>
          <div className="filter-group">
            <h3>Places</h3>
            <div className="filter-chip-grid">
              {placeOptions.map((place) => (
                <button type="button" className={selectedPlaces.includes(place) ? "active" : ""} onClick={() => setSelectedPlaces((current) => toggleValue(current, place))} key={place}>
                  {place}
                </button>
              ))}
            </div>
          </div>
          <div className="filter-actions">
            <span>{filteredTournaments.length} tournament{filteredTournaments.length === 1 ? "" : "s"} found</span>
            <button type="button" onClick={clearFilters}>Clear filters</button>
          </div>
        </section>
      )}
      <div className="tournament-section-stack">
        {sections.length ? sections.map((section) => (
          <section className="featured-status-row" key={section.key}>
            <div className="featured-status-head">
              <div>
                <h3>{section.title}</h3>
                <p>{section.text}</p>
              </div>
            </div>
            <div className="carousel-shell">
              <div className="card-grid carousel-row wheel-horizontal featured-carousel featured-status-carousel">
                {section.items.map((item) => section.compact
                  ? <FeaturedTournamentMiniCard key={item.slug} item={item} />
                  : <TournamentCard key={item.slug} item={item} />,
                )}
              </div>
            </div>
          </section>
        )) : <section className="panel user-empty-state"><h2>No tournaments found</h2><p>Try another sport, place, status, or search term.</p></section>}
      </div>
    </Page>
  );
}
