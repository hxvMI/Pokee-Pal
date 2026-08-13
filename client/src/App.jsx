import { Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import Header from "./components/Header.jsx";
import Spinner from "./components/Spinner.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { CloudflareCredentialsProvider } from "./context/CloudflareCredentialsContext.jsx";

const GeneratorPage = lazy(() => import("./pages/GeneratorPage.jsx"));
const GalleryPage = lazy(() => import("./pages/GalleryPage.jsx"));
const BattlePage = lazy(() => import("./pages/BattlePage.jsx"));
const CustomizePage = lazy(() => import("./pages/CustomizePage.jsx"));

export default function App() {
  // Route-level lazy loading keeps the initial generator bundle small while the
  // boundary and suspense fallback cover every navigable application screen.
  return (
    <CloudflareCredentialsProvider>
      <ErrorBoundary>
        <div className="app-shell min-h-screen flex flex-col transition-colors">
          <Header />
          <main className="flex-1 container mx-auto p-4 lg:p-8">
            <Suspense fallback={<Spinner label="Loading page..." />}>
              <Routes>
                <Route path="/" element={<GeneratorPage />} />
                <Route path="/gallery" element={<GalleryPage />} />
                <Route path="/battle" element={<BattlePage />} />
                <Route path="/customize" element={<CustomizePage />} />
              </Routes>
            </Suspense>
          </main>
        </div>
      </ErrorBoundary>
    </CloudflareCredentialsProvider>
  );
}
