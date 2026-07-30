import { useParams } from "react-router-dom";
import { LiveMatchCenter } from "./LiveHubPage";

export function LiveMatchPage() {
  const { matchId } = useParams();
  return <LiveMatchCenter initialMatchId={matchId} />;
}
