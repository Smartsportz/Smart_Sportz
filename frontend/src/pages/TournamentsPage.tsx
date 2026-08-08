import { Filter, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Page, TournamentCard } from "../components/UI";
import { withRuntimeTournamentStatus } from "../data/platform";
import { apiRequest } from "../lib/api";
import { useWheelHorizontal } from "../lib/useWheelHorizontal";
import { PageHero } from "./shared";

export function TournamentsPage() {
  useWheelHorizontal();
  const [tournamentRows, setTournamentRows] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedPlaces, setSelectedPlaces] = useState<string[]>([]);
  const [featuredOnly, setFeaturedOnly] = useState(false);

  useEffect(() => {
    apiRequest<any[]>("/public/tournaments")
      .then(setTournamentRows)
      .catch(() => setTournamentRows([]));
  }, []);

  const runtimeTournaments = useMemo(() => tournamentRows.map((item) => withRuntimeTournamentStatus({
    ...item,
    registrationStart: item.registrationStart ?? item.registration_start,
    registrationEnd: item.registrationEnd ?? item.registration_end,
    tournamentDescription: item.tournamentDescription ?? item.tournament_description,
  })), [tournamentRows]);
  const sportOptions = useMemo(
    () => Array.from(new Set(runtimeTournaments.map((item) => item.sport).filter(Boolean))).sort(),
    [runtimeTournaments],
  );
  const placeOptions = useMemo(
    () => Array.from(new Set(runtimeTournaments.flatMap((item) => [item.location, ...(item.cities ?? [])]))).sort(),
    [runtimeTournaments],
  );
  const statusOptions = ["Featured", "Open Registration", "Registration Closed", "Live", "Completed"];

  function toggleValue(list: string[], value: string) {
    return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
  }

  const filteredTournaments = runtimeTournaments.filter((item: any) => {
    const query = search.trim().toLowerCase();
    const searchable = [item.name, item.sport, item.location, item.status, ...(item.cities ?? [])].join(" ").toLowerCase();
    const matchesSearch = !query || searchable.includes(query);
    const matchesSport = selectedSports.length === 0 || selectedSports.includes(item.sport);
    const matchesPlace = selectedPlaces.length === 0 || selectedPlaces.some((place) => item.location === place || item.cities?.includes(place));
    const isFeatured = item.featureOnly || item.show_on_home === true;
    const matchesFeatured = !featuredOnly || isFeatured;
    const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.some((status) => {
      if (status === "Featured") return isFeatured;
      if (status === "Open Registration") return item.status === "Registration Open";
      if (status === "Completed") return item.status === "Completed" || item.status === "Registration Closed";
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
      title: "Upcoming tournaments",
      text: "Upcoming tournaments created by admin or manager.",
      items: filteredTournaments.filter((item) => item.status === "Upcoming").slice(0, 8),
    },
    {
      key: "upcoming",
      title: "Registration Open",
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
      text: "Registration-closed and completed tournament records with rounds available.",
      items: filteredTournaments.filter((item) => item.status === "Completed" || item.status === "Registration Closed"),
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
              {sportOptions.map((sport) => (
                <button type="button" className={selectedSports.includes(sport) ? "active" : ""} onClick={() => setSelectedSports((current) => toggleValue(current, sport))} key={sport}>
                  {sport}
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
                {section.items.map((item) => <TournamentCard key={item.slug} item={item} />)}
              </div>
            </div>
          </section>
        )) : <section className="panel user-empty-state"><h2>No tournaments found</h2><p>Try another sport, place, status, or search term.</p></section>}
      </div>
    </Page>
  );
}
