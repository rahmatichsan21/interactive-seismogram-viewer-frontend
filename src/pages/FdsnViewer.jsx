import { useEffect, useState } from "react";
import "../WaveformViewer.css";

import NetworkSelector from "../components/NetworkSelector/NetworkSelector";
import LocationSelector from "../components/LocationSelector/LocationSelector";
import ChannelSelector from "../components/ChannelSelector/ChannelSelector";
import TimeControl from "../components/TimeControl/TimeControl";
import StationSelectorModal from "../components/StationSelectorModal";

import { getChannels, getWaveform } from "../api/waveformApi";

import { attachTraceIdentity } from "../utils/traceIdentity";
import WaveformViewerPanel from "./WaveformViewerPanel";

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

export default function FdsnViewer() {
  const [selectedNetwork, setSelectedNetwork] = useState("IA");
  const [selectedStations, setSelectedStations] = useState([]);
  const [stations, setStations] = useState([]);
  const [isStationModalOpen, setIsStationModalOpen] = useState(false);

  const [locationPattern, setLocationPattern] = useState("*");

  const [startTime, setStartTime] = useState("2025-07-01T00:00");
  const [timeMode, setTimeMode] = useState("duration");
  const [duration, setDuration] = useState(5);
  const [endTime, setEndTime] = useState("2025-07-01T00:05");

  const [originalWaveform, setOriginalWaveform] = useState(null);
  const [loadedRequest, setLoadedRequest] = useState(null);

  const [isWaveformLoading, setIsWaveformLoading] = useState(false);
  const [waveformWarnings, setWaveformWarnings] = useState([]);

  const [channelPattern, setChannelPattern] = useState("*");

  useEffect(() => {
    async function loadStations() {
      try {
        const response = await fetch(
          "http://127.0.0.1:8000/api/stations"
        );

        if (!response.ok) {
          throw new Error("Failed to fetch stations");
        }

        const data = await response.json();

        const filteredStations = [
          ...new Map(
            data
              .filter((station) => station.net === selectedNetwork)
              .map((station) => [station.kode_stasiun, station])
          ).values(),
        ];

        setStations(filteredStations);
        setSelectedStations([]);
      } catch (error) {
        console.error("Failed to load stations:", error);
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
        year, month - 1, day, hour, minute + Number(duration)
      );

      const pad = (value) => String(value).padStart(2, "0");

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

  async function handleLoadWaveform() {
    if (selectedStations.length === 0) {
      alert("Select at least one station");
      return;
    }

    const requestEndTime = getFinalEndTime();
    const normalizedChannel = normalizeChannelPattern(channelPattern);

    setIsWaveformLoading(true);

    try {
      const waveformResults = await Promise.allSettled(
        selectedStations.map(async (station) => {
          const waveform = await getWaveform({
            network: selectedNetwork,
            station,
            location: locationPattern.trim() || "*",
            channel: normalizedChannel,
            startTime,
            timeMode,
            duration,
            endTime,
          });

          if (!waveform || !waveform.traces) {
            return [];
          }

          return attachTraceIdentity(waveform.traces, station, selectedNetwork);
        })
      );

      const successfulTraces = [];
      const warnings = [];

      waveformResults.forEach((result, index) => {
        const station = selectedStations[index];

        if (result.status === "fulfilled") {
          successfulTraces.push(...result.value);
        } else {
          warnings.push(`${station}: ${result.reason.message}`);
        }
      });

      const combinedWaveform = { traces: successfulTraces };

      const loadedStations = [
        ...new Set(
          successfulTraces
            .map((trace) => trace.station)
            .filter(Boolean)
        ),
      ];

      setWaveformWarnings(warnings);
      setOriginalWaveform(combinedWaveform);

      setLoadedRequest({
        network: selectedNetwork,
        location: locationPattern.trim() || "*",
        channel: normalizedChannel,
        startTime,
        endTime: requestEndTime,
        stations: loadedStations,
      });
    } catch (error) {
      console.error("Failed to load waveform:", error);
    } finally {
      setIsWaveformLoading(false);
    }
  }

  return (
    <main className="viewer-main">
        <section className="viewer-card control-panel">
          <div className="request-layout">
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
                          : `${selectedStations.slice(0, 3).join(", ")} +${selectedStations.length - 3}`}
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

            <div className="request-divider" />

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
                  {isWaveformLoading ? "Loading..." : "Load Waveform"}
                </button>
              </div>
            </div>
          </div>
        </section>

        {isStationModalOpen && (
          <StationSelectorModal
            stations={stations}
            selectedStations={selectedStations}
            isOpen={isStationModalOpen}
            onClose={() => setIsStationModalOpen(false)}
            onApply={setSelectedStations}
          />
        )}

        <WaveformViewerPanel
          originalWaveform={originalWaveform}
          loadedRequest={loadedRequest}
          isWaveformLoading={isWaveformLoading}
        />
      </main>
  );
}
