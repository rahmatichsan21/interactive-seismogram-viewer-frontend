
import { useCallback, useEffect, useState } from "react";
import "./App.css";
import ViewerSidebar from "./components/ViewerSidebar/ViewerSidebar";
import FdsnViewer from "./pages/FdsnViewer";
import LocalFileViewer from "./pages/LocalFileViewer";

function readModeFromUrl() {
  const mode = new URLSearchParams(window.location.search).get("mode");
  return mode === "local" ? "local" : "fdsn";
}

function App() {
  const [activePage, setActivePage] = useState(readModeFromUrl);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => window.innerWidth <= 760
  );

  const selectMode = useCallback((mode) => {
    const nextMode = mode === "local" ? "local" : "fdsn";
    const url = new URL(window.location.href);

    url.searchParams.set("mode", nextMode);

    if (url.href !== window.location.href) {
      window.history.pushState({ mode: nextMode }, "", url);
    }

    setActivePage(nextMode);
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setActivePage(readModeFromUrl());
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  return (
    <div
      className={`wv-shell ${
        sidebarCollapsed ? "sidebar-collapsed" : "sidebar-expanded"
      }`}
    >
      <ViewerSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((value) => !value)}
        activePage={activePage}
        onModeSelect={selectMode}
      />

      <header className="topbar">
        <div className="topbar-time">Interactive Waveform Viewer</div>

        <nav className="topbar-tabs" aria-label="Waveform data mode">
          <button
            type="button"
            className={`topbar-tab ${
              activePage === "fdsn" ? "topbar-tab-active" : ""
            }`}
            aria-current={activePage === "fdsn" ? "page" : undefined}
            onClick={() => selectMode("fdsn")}
          >
            FDSN
          </button>

          <button
            type="button"
            className={`topbar-tab ${
              activePage === "local" ? "topbar-tab-active" : ""
            }`}
            aria-current={activePage === "local" ? "page" : undefined}
            onClick={() => selectMode("local")}
          >
            Local File
          </button>
        </nav>
      </header>

      <div
        className={
          activePage === "fdsn"
            ? "viewer-page"
            : "viewer-page viewer-page-hidden"
        }
        aria-hidden={activePage !== "fdsn"}
      >
        <FdsnViewer />
      </div>

      <div
        className={
          activePage === "local"
            ? "viewer-page"
            : "viewer-page viewer-page-hidden"
        }
        aria-hidden={activePage !== "local"}
      >
        <LocalFileViewer />
      </div>
    </div>
  );
}

export default App;
