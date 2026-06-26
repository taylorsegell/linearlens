import { useVscodeMessaging } from "./hooks/useVscodeMessaging";
import { IssueDetailView } from "./components/IssueDetailView";
import "./styles.css";

export function App() {
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
