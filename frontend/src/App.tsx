import { ErrorBoundary } from "./components/ErrorBoundary";
import { DashboardLayout } from "./components/layouts";

function App() {
  return (
    <ErrorBoundary>
      <DashboardLayout />
    </ErrorBoundary>
  );
}

export default App;
