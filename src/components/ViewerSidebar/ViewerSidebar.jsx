
import { useEffect, useRef, useState } from "react";
import "./ViewerSidebar.css";

const MONITORING_STATION_URL = (
  import.meta.env.VITE_MONITORING_STATION_URL || ""
).replace(/\/+$/, "");

const INVENTARIS_ALAT_URL =
  import.meta.env.VITE_INVENTARIS_ALAT_URL || "";

const monitoringItems = [
  { label: "Dashboard", path: "/", icon: "dashboard" },
  { label: "Station Quality", path: "/station-quality", icon: "quality" },
  {
    label: "Station Availability",
    path: "/station-availability",
    icon: "availability",
  },
  { label: "Station Map", path: "/station-map", icon: "map" },
  {
    label: "Station Performance",
    path: "/station-performance",
    icon: "performance",
  },
];

function Icon({ name, size = 20 }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  const shapes = {
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    quality: (
      <>
        <circle cx="10.8" cy="10.8" r="6.5" />
        <path d="m16 16 4.5 4.5" />
        <path d="m7.5 11 2.2 2.2 4.1-4.5" />
      </>
    ),
    availability: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    map: (
      <>
        <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z" />
        <path d="M9 3v15M15 6v15" />
      </>
    ),
    performance: <path d="M3 12h4l3-8 4 16 3-8h4" />,
    waveform: <path d="M2 12h3l2-6 3 12 3-9 3 6 2-3h4" />,
    inventory: (
      <>
        <path d="m12 3 9 5-9 5-9-5z" />
        <path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
      </>
    ),
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    down: <path d="m6 9 6 6 6-6" />,
  };

  return <svg {...common}>{shapes[name]}</svg>;
}

function getMonitoringStationUrl(path) {
  if (!MONITORING_STATION_URL) {
    return "";
  }

  if (path === "/") {
    return `${MONITORING_STATION_URL}/`;
  }

  return `${MONITORING_STATION_URL}${path}`;
}

export default function ViewerSidebar({
  collapsed,
  onToggle,
  activePage,
  onModeSelect,
}) {
  const [waveformExpanded, setWaveformExpanded] = useState(true);
  const sidebarRef = useRef(null);

  useEffect(() => {
    if (collapsed) {
      return;
    }

    function handlePointerDown(event) {
      if (
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target)
      ) {
        onToggle();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [collapsed, onToggle]);

  function renderMonitoringItem(item) {
    const href = getMonitoringStationUrl(item.path);

    return (
      <a
        key={item.path}
        className="wv-nav-item"
        href={href || undefined}
        aria-disabled={!href}
        title={
          !href
            ? "VITE_MONITORING_STATION_URL belum dikonfigurasi"
            : undefined
        }
        onClick={(event) => {
          if (!href) {
            event.preventDefault();
          }
        }}
      >
        <Icon name={item.icon} />
        <span>{item.label}</span>
      </a>
    );
  }

  return (
    <aside
      ref={sidebarRef}
      className={`wv-sidebar ${collapsed ? "is-collapsed" : ""}`}
    >
      <div className="wv-sidebar-brand">
        {!collapsed && (
          <>
            <div className="wv-brand-mark" aria-hidden="true">
              <Icon name="waveform" size={25} />
            </div>

            <div className="wv-brand-copy">
              <strong>Monitoring Station</strong>
              <span>BMKG</span>
            </div>
          </>
        )}

        <button
          type="button"
          className="wv-sidebar-toggle"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <Icon name="menu" />
        </button>
      </div>

      {!collapsed && (
        <nav className="wv-sidebar-nav" aria-label="Main navigation">
          {/* Monitoring Station */}
          {monitoringItems.map(renderMonitoringItem)}

          {/* Inventaris Alat */}
          {INVENTARIS_ALAT_URL && (
            <a
              className="wv-nav-item"
              href={INVENTARIS_ALAT_URL}
            >
              <Icon name="inventory" />
              <span>Inventaris Alat</span>
            </a>
          )}

          {/* Waveform Viewer */}
          <div className="wv-nav-group">
            <button
              type="button"
              className={`wv-nav-item wv-nav-parent ${
                activePage ? "is-current" : ""
              }`}
              onClick={() => {
                setWaveformExpanded((value) => !value);
              }}
              aria-expanded={waveformExpanded}
            >
              <Icon name="waveform" />
              <span>Waveform Viewer</span>

              <span className="wv-nav-chevron">
                <Icon
                  name={waveformExpanded ? "down" : "chevron"}
                  size={16}
                />
              </span>
            </button>

            {waveformExpanded && (
              <div className="wv-subnav">
                <button
                  type="button"
                  className={`wv-subnav-item ${
                    activePage === "fdsn" ? "is-active" : ""
                  }`}
                  onClick={() => onModeSelect("fdsn")}
                >
                  FDSN
                </button>

                <button
                  type="button"
                  className={`wv-subnav-item ${
                    activePage === "local" ? "is-active" : ""
                  }`}
                  onClick={() => onModeSelect("local")}
                >
                  Local File
                </button>
              </div>
            )}
          </div>
        </nav>
      )}
    </aside>
  );
}
