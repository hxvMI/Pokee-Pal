// Browser entry point. Mount React into index.html and provide theme and routing
// state to the application. StrictMode enables additional development checks.

import React from "react";
import { createRoot } from "react-dom/client";

import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext.jsx";

import App from "./App.jsx";
import "./index.css";

// Provider order establishes global theme state first, then routing; feature-
// specific credentials are scoped inside App so startup stays lightweight.
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);
