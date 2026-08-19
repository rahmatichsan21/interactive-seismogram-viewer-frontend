import { useState } from "react";
import "./App.css";
import FdsnViewer from "./pages/FdsnViewer";
import LocalFileViewer from "./pages/LocalFileViewer";

function App() {
  const [activePage, setActivePage] = useState("fdsn");

  return (
    <>
      <header className="topbar">
        <div className="topbar-time">Interactive Seismogram Viewer</div>

        <nav className="topbar-tabs">
          <button
            className={`topbar-tab ${activePage === "fdsn" ? "topbar-tab-active" : ""}`}
            onClick={() => setActivePage("fdsn")}
          >
            FDSN
          </button>
          <button
            className={`topbar-tab ${activePage === "local" ? "topbar-tab-active" : ""}`}
            onClick={() => setActivePage("local")}
          >
            Local File
          </button>
        </nav>
      </header>

      {/*
        Kedua viewer SELALU di-mount supaya state per source
        (waveform, processing history, pipeline) dipertahankan
        saat berpindah tab. Hanya yang aktif yang terlihat.
      */}
      <div
        className={
          activePage === "fdsn"
            ? "viewer-page"
            : "viewer-page viewer-page-hidden"
        }
      >
        <FdsnViewer />
      </div>

      <div
        className={
          activePage === "local"
            ? "viewer-page"
            : "viewer-page viewer-page-hidden"
        }
      >
        <LocalFileViewer />
      </div>
    </>
  );
}

export default App;
