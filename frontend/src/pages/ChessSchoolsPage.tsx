import { ArrowRight, Medal, School, Trophy, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, useParams } from "react-router-dom";
import { Page } from "../components/UI";
import type { ChessSchool, ChessSchoolDetail } from "../data/chessSchools";
import { apiRequest, mediaUrl } from "../lib/api";

function studentInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function ChessSchoolsPage() {
  const { schoolSlug } = useParams();
  const schoolsQuery = useQuery({
    queryKey: ["public", "sports", "chess", "schools"],
    queryFn: () => apiRequest<ChessSchool[]>("/public/sports/chess/schools", { silent: true }),
    enabled: !schoolSlug,
  });
  const schoolQuery = useQuery({
    queryKey: ["public", "sports", "chess", "schools", schoolSlug],
    queryFn: () => apiRequest<ChessSchoolDetail>(`/public/sports/chess/schools/${schoolSlug}`, { silent: true }),
    enabled: Boolean(schoolSlug),
  });
  const schoolDetail = schoolQuery.data;
  const school = schoolDetail?.school;
  const schools = schoolsQuery.data ?? [];

  if (schoolSlug && schoolQuery.isError) {
    return <Navigate to="/sports/chess/schools" replace />;
  }

  if (schoolSlug && schoolQuery.isLoading) {
    return <Page className="chess-school-page"><section className="panel"><p>Loading chess school results...</p></section></Page>;
  }

  if (school) {
    return (
      <Page className="chess-school-page">
        <section className="chess-school-hero">
          <div>
            <p className="eyebrow">Chess Tournament Results</p>
            <h1>{school.name}</h1>
            <p>{school.summary} The two highlighted students below represent the school's strongest tournament finishers and give coordinators a clear snapshot of current chess talent.</p>
            <div className="hero-actions">
              <Link className="btn btn-secondary" to="/sports/chess/schools">All schools</Link>
              <Link className="btn btn-primary" to="/sports/chess">Chess tournaments</Link>
            </div>
          </div>
          <div className="chess-school-score-card">
            <Trophy size={34} />
            <strong>Top Two Players</strong>
            <span>{school.city}</span>
            <small>{school.coordinator}</small>
          </div>
        </section>

        <section className="chess-student-grid" aria-label={`${school.name} top students`}>
          {schoolDetail.students.map((student, index) => {
            const rank = student.rank || index + 1;
            return (
              <div className="chess-student-result" key={student.name}>
                <article className="chess-student-card">
                  <div className="chess-student-visual">
                    <div className={`chess-student-avatar rank-${rank} ${student.avatar_image ? "has-image" : ""}`} role="img" aria-label={`${student.name} profile`}>
                      {student.avatar_image ? <img src={mediaUrl(student.avatar_image)} alt="" /> : <span>{studentInitials(student.name)}</span>}
                    </div>
                    <span className={`chess-rank-badge rank-${rank}`}>{rank}</span>
                  </div>
                  <div className="chess-student-details">
                    <span className={`status ${rank === 1 ? "emerald" : "blue"}`}>Rank {rank}</span>
                    <h2>{student.name}</h2>
                    <p>{student.note}</p>
                    <dl>
                      <div><dt>Class</dt><dd>{student.grade}</dd></div>
                      <div><dt>Strength</dt><dd>{student.strength}</dd></div>
                    </dl>
                  </div>
                </article>
              </div>
            );
          })}
        </section>

        <section className="panel chess-school-summary">
          <h2>School Performance Note</h2>
          <p>{school.name} showed the kind of steady preparation that makes school chess programs easier to scale: students arrived with opening discipline, respected tournament rhythm, and documented their results cleanly for future ranking records.</p>
        </section>
      </Page>
    );
  }

  if (schoolsQuery.isLoading) {
    return <Page className="chess-school-page"><section className="panel"><p>Loading chess schools...</p></section></Page>;
  }

  if (schoolsQuery.isError) {
    return <Page className="chess-school-page"><div className="form-alert">Could not load chess schools.</div></Page>;
  }

  return (
    <Page className="chess-school-page">
      <section className="chess-school-hero">
        <div>
          <p className="eyebrow">SmartSportz Chess Program</p>
          <h1>Inter-School Chess Results</h1>
          <p>Select a school from the container below to view the top two student performers, their strengths, and a short result note prepared for tournament coordinators.</p>
          <div className="hero-actions">
            <Link className="btn btn-secondary" to="/sports">Back to sports</Link>
            <Link className="btn btn-primary" to="/sports/chess">Open Chess tournaments</Link>
          </div>
        </div>
        <div className="chess-school-score-card">
          <School size={34} />
          <strong>{schools.length} Schools</strong>
          <span>Top two students listed for each school</span>
          <small>Professional result display for school meets and academy leagues</small>
        </div>
      </section>

      <section className="chess-school-container" aria-label="Chess schools">
        {schools.map((item) => (
          <Link className="chess-school-tile" to={`/sports/chess/schools/${item.slug}`} key={item.slug}>
            <span><School size={18} /> {item.city}</span>
            <h2>{item.name}</h2>
            <p>{item.summary}</p>
            <small><Users size={15} /> View two students <ArrowRight size={15} /></small>
          </Link>
        ))}
      </section>

      <section className="chess-program-strip">
        <div><Trophy size={20} /><strong>Inter-school</strong><span>Competition format</span></div>
        <div><Medal size={20} /><strong>Top talent</strong><span>Two players per school</span></div>
        <div><Users size={20} /><strong>Coordinator-ready</strong><span>Clear school records</span></div>
      </section>
    </Page>
  );
}
