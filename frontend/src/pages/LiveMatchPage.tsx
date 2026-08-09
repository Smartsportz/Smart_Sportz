import { useParams } from "react-router-dom";
import { LiveMatchCenter } from "./LiveHubPage";

/*
export function LiveMatchPage() {
  const { matchId } = useParams();
  return <LiveMatchCenter initialMatchId={matchId} />;
}
*/

export function LiveMatchPage() {
  const { matchId } = useParams();
  
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      fontSize: '2rem',
      fontWeight: 'bold',
      color: '#333'
    }}>
      coming soon..
    </div>
  );
}