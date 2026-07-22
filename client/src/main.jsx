import React from "react";
import { createRoot } from "react-dom/client";

// ⏸️ WORKSHOP STEP 1: Set Up Routing
// TODO: Import BrowserRouter from 'react-router-dom'
import { BrowserRouter } from "react-router-dom";

// ⏸️ WORKSHOP STEP 5: Add Context
// TODO: Import ThemeProvider from './context/ThemeContext.jsx'
import { ThemeProvider } from "./context/ThemeContext.jsx";

import App from "./App.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {/* ⏸️ WORKSHOP STEP 5: Wrap in ThemeProvider */}
    {/* ⏸️ WORKSHOP STEP 1: Wrap in BrowserRouter */}
    <ThemeProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);
