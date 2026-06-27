import { readBootstrap } from "./bootstrap";
import { useVscodeMessaging } from "./hooks/useVscodeMessaging";
import { IssueDetailView } from "./components/IssueDetailView";
import { BoardApp } from "./components/board/BoardApp";
import "./styles.css";

const bootstrap = readBootstrap();

function IssueDetailApp() {
  const { issue, workflowStates, error, post } = useVscodeMessaging();
  if (!issue) {
    return <main className="loading">Loading issue…</main>;
  }
  return (
    <main>
      <IssueDetailView
        issue={issue}
        workflowStates={workflowStates}
        error={error}
        post={post}
      />
    </main>
  );
}

export function App() {
  if (bootstrap.panel === "board") {
    return <BoardApp />;
  }
  return <IssueDetailApp />;
}
