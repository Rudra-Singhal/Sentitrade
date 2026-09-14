import Dashboard from "./pages/Dashboard.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

const App = () => (
  <ErrorBoundary>
    <Dashboard />
  </ErrorBoundary>
);

export default App;
