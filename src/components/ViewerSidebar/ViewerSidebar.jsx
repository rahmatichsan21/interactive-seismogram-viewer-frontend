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

function Icon({ name, size = 24, className }) {
  const shapes = {
    // Heroicons v1: CubeIcon
    dashboard: (
      <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    ),

    // Heroicons v1: SearchIcon
    quality: (
      <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    ),

    // Heroicons v1: StatusOnlineIcon
    availability: (
      <path d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" />
    ),

    // Heroicons v1: MapIcon
    map: (
      <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    ),

    // Heroicons v1: WifiIcon
    performance: (
      <path d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
    ),

    // Heroicons v1: ArchiveIcon
    inventory: (
      <path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
    ),

    // Custom waveform mark retained for the sidebar branding.
    waveform: (
      <path d="M2 12h3l2-6 3 12 3-9 3 6 2-3h4" />
    ),

    // Heroicons v1: ChartSquareBarIcon
    chartSquareBar: (
      <path d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    ),

    // Heroicons v1: MenuIcon
    menu: (
      <path d="M4 6h16M4 12h16M4 18h16" />
    ),

    // Heroicons v1: ChevronRightIcon
    chevron: (
      <path d="M9 5l7 7-7 7" />
    ),

    // Heroicons v1: ChevronDownIcon
    down: (
      <path d="M19 9l-7 7-7-7" />
    ),
  };

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {shapes[name] || null}
    </svg>
  );
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
      return undefined;
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
            : collapsed
              ? item.label
              : undefined
        }
        onClick={(event) => {
          if (!href) {
            event.preventDefault();
          }
        }}
      >
        <Icon name={item.icon} className="wv-nav-icon" />
        <span className="wv-nav-label">{item.label}</span>
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
              <Icon
                name="waveform"
                size={25}
                className="wv-brand-icon"
              />
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

      <nav className="wv-sidebar-nav" aria-label="Main navigation">
        {/* Monitoring Station */}
        {monitoringItems.map(renderMonitoringItem)}

        {/* Waveform Viewer */}
        <div className="wv-nav-group">
          <button
            type="button"
            className={`wv-nav-item wv-nav-parent ${
              activePage ? "is-current" : ""
            }`}
            onClick={() => {
              if (collapsed) {
                onToggle();
                setWaveformExpanded(true);
                return;
              }

              setWaveformExpanded((value) => !value);
            }}
            aria-expanded={!collapsed && waveformExpanded}
            aria-controls="wv-waveform-subnav"
            title={collapsed ? "Waveform Viewer" : undefined}
          >
            <Icon
              name="chartSquareBar"
              className="wv-nav-icon"
            />

            <span className="wv-nav-label">Waveform Viewer</span>

            {!collapsed && (
              <span className="wv-nav-chevron">
                <Icon
                  name={waveformExpanded ? "down" : "chevron"}
                  size={16}
                  className="wv-chevron-icon"
                />
              </span>
            )}
          </button>

          {!collapsed && waveformExpanded && (
            <div className="wv-subnav" id="wv-waveform-subnav">
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

        {/* Inventaris Alat */}
        {INVENTARIS_ALAT_URL && (
          <a
            className="wv-nav-item"
            href={INVENTARIS_ALAT_URL}
            title={collapsed ? "Inventaris Alat" : undefined}
          >
            <Icon name="inventory" className="wv-nav-icon" />
            <span className="wv-nav-label">Inventaris Alat</span>
          </a>
        )}
      </nav>
    </aside>
  );
}