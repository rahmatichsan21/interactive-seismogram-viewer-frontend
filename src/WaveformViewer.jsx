import { useEffect, useState } from "react";import "./WaveformViewer.css";
import NetworkSelector from "./components/NetworkSelector/NetworkSelector";
import LocationSelector from "./components/LocationSelector/LocationSelector";
import ChannelSelector from "./components/ChannelSelector/ChannelSelector";
import TimeControl from "./components/TimeControl/TimeControl";
import AmplitudeControl from "./components/AmplitudeControl/AmplitudeControl";
import WaveformPlot from "./components/WaveformPlot/WaveformPlot";
import TraceSelector from "./components/TraceSelector/TraceSelector";
import StationSelectorModal from "./components/StationSelectorModal";import {
  getChannels,
  getWaveform,
} from "./api/waveformApi";


function WaveformViewer() {
  // Network & Station
  const [isTraceSelectorOpen, setIsTraceSelectorOpen] =
  useState(false);
  const [waveformWarnings, setWaveformWarnings] =
  useState([]);
  const [selectedNetwork, setSelectedNetwork] = useState("IA");
  const [selectedStations, setSelectedStations] =
  useState([]);
  const [stations, setStations] = useState([]);
  const [isStationModalOpen, setIsStationModalOpen] =
  useState(false);
  const selectedStation =
    selectedStations.length > 0
      ? selectedStations[0]
      : "";

  // Location
  const [locationPattern, setLocationPattern] = useState("*");
  // Time
  const [startTime, setStartTime] = useState(
    "2025-07-01T00:00"
  );
  const [timeMode, setTimeMode] = useState("duration");
  const [duration, setDuration] = useState(5);
  const [endTime, setEndTime] = useState(
    "2025-07-01T00:05"
  );


  // Waveform
  const [waveformData, setWaveformData] = useState(null);
  const [activeTraces, setActiveTraces] = useState([]);
  const [isWaveformLoading, setIsWaveformLoading] =
  useState(false);
  const [amplitudeScale, setAmplitudeScale] =
  useState(1);
  const [normalize, setNormalize] = useState(false);

  // Channels
  const [channelPattern, setChannelPattern] = useState("*");

  useEffect(() => {
    async function loadStations() {
      try {
        const response = await fetch(
          "http://127.0.0.1:8000/api/stations"
        );

        if (!response.ok) {
          throw new Error(
            "Failed to fetch stations"
          );
        }

        const data = await response.json();

        const filteredStations = data.filter(
          (station) =>
            station.net === selectedNetwork
        );

        setStations(filteredStations);

        // Reset pilihan station ketika network berubah
        setSelectedStations([]);
      } catch (error) {
        console.error(
          "Failed to load stations:",
          error
        );
      }
    }

    loadStations();
  }, [selectedNetwork]);

  function getFinalEndTime() {
  if (timeMode === "duration") {
    const [datePart, timePart] = startTime.split("T");
    const [year, month, day] = datePart.split("-").map(Number);
    const [hour, minute] = timePart.split(":").map(Number);

    const endDate = new Date(
      year,
      month - 1,
      day,
      hour,
      minute + Number(duration)
    );

    const pad = (value) =>
      String(value).padStart(2, "0");

    return (
      `${endDate.getFullYear()}-` +
      `${pad(endDate.getMonth() + 1)}-` +
      `${pad(endDate.getDate())}T` +
      `${pad(endDate.getHours())}:` +
      `${pad(endDate.getMinutes())}`
    );
  }

  return endTime;
}


  function normalizeChannelPattern(value) {
    const v = value.trim().toUpperCase();

    if (v === "") return "*";
    if (v === "*") return "*";

    if (v.includes("*") || v.includes("?")) {
      return v;
    }

    if (v.length <= 2) {
      return `${v}*`;
    }

    return v;
  }


  async function handleLoadWaveform() {
    if (selectedStations.length === 0) {
      alert("Select at least one station");
      return;
    }
    console.log("Loading TRUE");
    setIsWaveformLoading(true);

    try {
      const waveformResults = await Promise.allSettled(
        selectedStations.map(async (station) => {
          const waveform = await getWaveform({
            network: selectedNetwork,
            station,
            location: locationPattern.trim() || "*",
            channel: normalizeChannelPattern(channelPattern),
            startTime,
            timeMode,
            duration,
            endTime,
          });

          return waveform.traces.map((trace) => ({
            ...trace,

            // Simpan identitas station pada SETIAP trace
            network: trace.network || selectedNetwork,
            station: trace.station || station,

            traceId: [
              trace.network || selectedNetwork,
              trace.station || station,
              trace.location || "--",
              trace.channel,
            ].join("."),
          }));
        })
      );

      const successfulTraces = [];
      const warnings = [];

      waveformResults.forEach((result, index) => {
        const station = selectedStations[index];

        if (result.status === "fulfilled") {
          successfulTraces.push(...result.value);
        } else {
          warnings.push(
            `${station}: ${result.reason.message}`
          );
        }
      });

      setWaveformWarnings(warnings);

      const allTraces = successfulTraces;

      const combinedWaveform = {
        traces: allTraces,
      };

      setWaveformData(combinedWaveform);

      setActiveTraces(
        allTraces.map((trace) => trace.traceId)
      );

      console.log(
        "Multi-station waveform:",
        combinedWaveform
      );
    } catch (error) {
      console.error(
        "Failed to load waveform:",
        error
      );
    }finally {
        console.log("Loading FALSE");
        setIsWaveformLoading(false);

    }

  }


  return (
    <div className="viewer-app">

      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          ☰
        </div>

        <nav className="sidebar-menu">
          <button
            className="sidebar-button active"
            title="Waveform Viewer"
          >
            ◉
          </button>

          <button
            className="sidebar-button"
            title="Signal Processing"
          >
            ≋
          </button>

          <button
            className="sidebar-button"
            title="Settings"
          >
            ⚙
          </button>
        </nav>
      </aside>


      {/* Topbar */}
      <header className="topbar">
        <div className="topbar-time">
          Interactive Seismogram Viewer
        </div>
      </header>


      {/* Main Content */}
      <main className="viewer-main">

        {/* Request Controls */}
        <section className="viewer-card control-panel">

          <div className="request-layout">

            {/* DATA SOURCE */}
            <div className="request-section">
              <div className="section-heading">
                <h3>Data Source</h3>
                <p>Select the seismic data source.</p>
              </div>

              <div className="source-grid">

                <div className="field-group network-field">
                  <NetworkSelector
                      selectedNetwork={selectedNetwork}
                      setSelectedNetwork={setSelectedNetwork}
                      disabled={isWaveformLoading}
                  />
                </div>

                <div className="field-group station-field">
                  <label>Station</label>

                  <button
                    type="button"
                    className="station-selector-button"
                    onClick={() => setIsStationModalOpen(true)}
                  >
                    <span className="station-selector-text">
                      {selectedStations.length === 0
                        ? "Select Stations"
                        : selectedStations.length <= 3
                          ? selectedStations.join(", ")
                          : `${selectedStations
                              .slice(0, 3)
                              .join(", ")} +${
                              selectedStations.length - 3
                            }`}
                    </span>

                    <span className="station-selector-count">
                      {selectedStations.length}
                    </span>
                  </button>
                </div>

                <div className="field-group">
                  <LocationSelector
                    locationPattern={locationPattern}
                    setLocationPattern={setLocationPattern}
                    disabled={isWaveformLoading}
                  />
                </div>

                <div className="field-group">
                  <ChannelSelector
                    channelPattern={channelPattern}
                    setChannelPattern={setChannelPattern}
                  />
                </div>

              </div>
            </div>


            {/* DIVIDER */}
            <div className="request-divider" />


            {/* TIME RANGE */}
            <div className="request-section time-section">
              <div className="section-heading">
                <h3>Time Range</h3>
                <p>Define the waveform time window.</p>
              </div>

              <TimeControl
                startTime={startTime}
                setStartTime={setStartTime}
                timeMode={timeMode}
                setTimeMode={setTimeMode}
                duration={duration}
                setDuration={setDuration}
                endTime={endTime}
                setEndTime={setEndTime}
              />

              <div className="load-action">
                <button
                  className="load-button"
                  type="button"
                  onClick={handleLoadWaveform}
                  disabled={isWaveformLoading}
                >
                  {
                    isWaveformLoading
                        ? "Loading..."
                        : "Load Waveform"
                  }
                </button>
              </div>
            </div>

          </div>

        </section>


        {/* Waveform Warnings */}
        {waveformWarnings.length > 0 && (
          <div className="waveform-warning">
            {waveformWarnings.map((warning, index) => (
              <div key={`${warning}-${index}`}>
                {warning}
              </div>
            ))}
          </div>
        )}


      


        {/* Waveform */}
        <section className="viewer-card waveform-card">

          <div className="waveform-header">
            <h2>Waveform Viewer</h2>
          </div>


          {waveformData && (
            <div className="waveform-controls-sticky">

              {/* TRACE SELECTOR HEADER */}
              <button
                type="button"
                className="trace-sticky-toggle"
                onClick={() =>
                  setIsTraceSelectorOpen(
                    (current) => !current
                  )
                }
              >
                <div className="trace-sticky-toggle-left">
                  <span className="trace-sticky-arrow">
                    {isTraceSelectorOpen ? "▼" : "▶"}
                  </span>

                  <span className="trace-sticky-title">
                    Waveform Traces
                  </span>
                </div>

                <span className="trace-sticky-count">
                  {activeTraces.length} active
                </span>
              </button>


              {/* TRACE SELECTOR CONTENT */}
              {isTraceSelectorOpen && (
                <div className="trace-sticky-content">
                  <TraceSelector
                    waveformData={waveformData}
                    activeTraces={activeTraces}
                    setActiveTraces={setActiveTraces}
                  />
                </div>
              )}


              {/* AMPLITUDE CONTROL */}
              <div className="sticky-amplitude-section">
                <AmplitudeControl
                  amplitudeScale={amplitudeScale}
                  setAmplitudeScale={setAmplitudeScale}
                  normalize={normalize}
                  setNormalize={setNormalize}
                />
              </div>

            </div>
          )}
                      

            <div className="waveform-content">

              {isWaveformLoading && (
                <div className="waveform-loading-banner">

                  <div className="loading-spinner"></div>

                  <div className="loading-text">

                    <strong>Loading waveform...</strong>

                    <span>Downloading waveform from BMKG</span>

                  </div>

                </div>
              )}

              {waveformData ? (
                <WaveformPlot
                  waveformData={waveformData}
                  activeTraces={activeTraces}
                  amplitudeScale={amplitudeScale}
                  normalize={normalize}
                />
              ) : (
                <div className="waveform-empty-state">

                  <div className="empty-icon">
                    📈
                  </div>

                  <h3>No waveform loaded</h3>

                  <p>
                    Select a station and time range,
                    then click <strong>Load Waveform</strong>.
                  </p>

                </div>
              )}

            </div>

        </section>

      </main>

        <StationSelectorModal
          isOpen={isStationModalOpen}
          stations={stations}
          selectedStations={selectedStations}
          onClose={() =>
            setIsStationModalOpen(false)
          }
          onApply={setSelectedStations}
        />

    </div>
  );
}

export default WaveformViewer;