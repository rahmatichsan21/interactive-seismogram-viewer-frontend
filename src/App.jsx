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

      {activePage === "fdsn" ? <FdsnViewer /> : <LocalFileViewer />}
    </>
  );
}

export default App;
