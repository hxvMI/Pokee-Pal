// ⏸️ WORKSHOP STEP 1: Set Up Routing
// TODO: Import Routes and Route from 'react-router-dom'
import { Routes, Route } from "react-router-dom";

// ⏸️ WORKSHOP STEP 7: Add Suspense and Lazy Loading
// TODO: Import lazy and Suspense from 'react'
import { lazy, Suspense } from "react";

// ⏸️ WORKSHOP STEP 8: Add Error Boundary
// TODO: Import ErrorBoundary component

import Header from "./components/Header.jsx";
import Spinner from "./components/Spinner.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { CloudflareCredentialsProvider } from "./context/CloudflareCredentialsContext.jsx";

// Regular imports (will be replaced with lazy in Step 8)
// import GeneratorPage from "./pages/GeneratorPage.jsx";
// import GalleryPage from "./pages/GalleryPage.jsx";

// ⏸️ WORKSHOP STEP 7: Replace above with lazy loading
// const GeneratorPage = lazy(() => import('./pages/GeneratorPage.jsx'))
// const GalleryPage = lazy(() => import('./pages/GalleryPage.jsx'))
const GeneratorPage = lazy(() => import("./pages/GeneratorPage.jsx"));
const GalleryPage = lazy(() => import("./pages/GalleryPage.jsx"));
const BattlePage = lazy(() => import("./pages/BattlePage.jsx"));
const CustomizePage = lazy(() => import("./pages/CustomizePage.jsx"));

export default function App() {
  return (
    <CloudflareCredentialsProvider>
      <ErrorBoundary>
      {/* ⏸️ WORKSHOP STEP 8: Wrap in ErrorBoundary */}
      <div className="app-shell min-h-screen flex flex-col transition-colors">
        <Header />
        <main className="flex-1 container mx-auto p-4 lg:p-8">
          {/* ⏸️ WORKSHOP STEP 1: Set up Routes */}

          {/* TODO: Wrap content in Suspense (Step 7) */}
          {/* TODO: Add Routes with Route elements for "/" and "/gallery" */}
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
