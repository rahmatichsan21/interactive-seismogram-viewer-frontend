import { useState, useEffect } from "react";
import AmplitudeControl from "../components/AmplitudeControl/AmplitudeControl";
import WaveformPlot from "../components/WaveformPlot/WaveformPlot";
import TraceSelector from "../components/TraceSelector/TraceSelector";
import ProcessingPipeline from "../components/ProcessingPipeline/ProcessingPipeline";
import SpectrogramPanel from "../components/SpectrogramPanel/SpectrogramPanel";

import {
  downloadMiniSeed,
  getSpectrogram,
  postProcess,
} from "../api/waveformApi";

import useOperationStack from "../hooks/useOperationStack";
import { toProcessPayload } from "../utils/processingPayload";

function getStationNyquist(traces, activeTraceIds, station) {
  const stationSamplingRates = (traces ?? [])
    .filter(
      (trace) =>
        trace.station === station &&
        (activeTraceIds ?? []).includes(trace.traceId)
    )
    .map((trace) => trace.sampling_rate)
    .filter(
      (rate) => typeof rate === "number" && rate > 0
    );

  if (stationSamplingRates.length === 0) {
    return null;
  }

  return Math.min(...stationSamplingRates) / 2;
}

function validateFilterAgainstNyquist(operations, nyquist) {
  if (nyquist == null) {
    return null;
  }

  for (const operation of operations) {
    if (operation.type !== "filter") {
      continue;
    }

    const { filterType, freq, freqMin, freqMax } = operation.params;

    if (filterType === "bandpass" && freqMax >= nyquist) {
      return (
        `Filter bandpass tidak dapat diterapkan: ` +
        `frekuensi maksimum ${freqMax} Hz melebihi Nyquist ` +
        `terendah dari trace yang sedang aktif (${nyquist.toFixed(2)} Hz).`
      );
    }

    if (
      (filterType === "lowpass" || filterType === "highpass") &&
      freq >= nyquist
    ) {
      return (
        `Filter ${filterType} tidak dapat diterapkan: ` +
        `frekuensi ${freq} Hz melebihi Nyquist ` +
        `terendah dari trace yang sedang aktif (${nyquist.toFixed(2)} Hz).`
      );
    }
  }

  return null;
}

export default function WaveformViewerPanel({
  originalWaveform,
  loadedRequest,
  isWaveformLoading,
}) {
  const [isTraceSelectorOpen, setIsTraceSelectorOpen] = useState(false);
  const [waveformWarnings, setWaveformWarnings] = useState([]);
  const [processedWaveform, setProcessedWaveform] = useState(null);
  const [activeTraces, setActiveTraces] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastHistoryAction, setLastHistoryAction] = useState(null);
  const [processingErrors, setProcessingErrors] = useState([]);
  const [amplitudeScale, setAmplitudeScale] = useState(1);
  const [spectrogramEnabled, setSpectrogramEnabled] =
    useState(false);
  const [spectrograms, setSpectrograms] = useState({});
  const [spectrogramLoading, setSpectrogramLoading] =
    useState({});
  const [spectrogramErrors, setSpectrogramErrors] =
    useState({});
  const [downloadMenuOpen, setDownloadMenuOpen] =
    useState(false);
  const [isDownloading, setIsDownloading] =
    useState(false);

  const {
    history,
    pointer,
    pipeline,
    canUndo,
    canRedo,
    addOperation,
    updateOperation,
    removeOperation,
    commit,
    undo,
    redo,
    reset,
    getActiveOperations,
  } = useOperationStack();

  const displayWaveform = processedWaveform ?? originalWaveform;

  const normalizeEnabled = pipeline.some(
    (operation) =>
      operation.enabled &&
      operation.type === "normalize"
  );

  const visibleTraceIds = activeTraces.length > 0
    ? activeTraces
    : (displayWaveform?.traces ?? []).map(
        (trace) => trace.traceId
      );

  const visibleTraces = displayWaveform?.traces?.filter(
    (trace) => visibleTraceIds.includes(trace.traceId)
  ) ?? [];

  const committedPipeline = history[pointer] ?? [];

  const activeTrim = committedPipeline.find(
    (operation) =>
      operation.enabled && operation.type === "trim"
  );

  const trimStart = activeTrim?.params?.startTime ?? null;
  const trimEnd = activeTrim?.params?.endTime ?? null;

  async function handleDownloadMiniSeed(channel = null) {
    console.log("[DOWNLOAD DEBUG] handleDownloadMiniSeed called:", channel);
    console.log("[DOWNLOAD DEBUG] loadedRequest:", loadedRequest);
    console.log("[DOWNLOAD DEBUG] visibleTraces:", visibleTraces);
    if (!loadedRequest || visibleTraces.length === 0) {
      console.log("[DOWNLOAD DEBUG] early return (no request or traces)");
      return;
    }

    const traces = visibleTraces
      .filter((trace) => !channel || trace.channel === channel)
      .map((trace) => ({
        station: trace.station || "*",
        location: trace.location || "*",
        channel: trace.channel,
      }));

    if (traces.length === 0) {
      return;
    }

    const stations = [...new Set(
      traces.map((trace) => trace.station)
    )];
    const channels = [...new Set(
      traces.map((trace) => trace.channel)
    )];
    const isLocal = Boolean(loadedRequest.session_id);

    const payload = {
      source: isLocal ? "local" : "fdsn",
      network: isLocal ? null : loadedRequest.network,
      stations: isLocal ? [] : stations,
      location: loadedRequest.location || "*",
      channels,
      traces,
      start_time: loadedRequest.startTime,
      end_time: loadedRequest.endTime,
      trim_start: trimStart,
      trim_end: trimEnd,
      session_id: loadedRequest.session_id || null,
    };

    setIsDownloading(true);
    setDownloadMenuOpen(false);
    try {
      await downloadMiniSeed(payload);
    } finally {
      setIsDownloading(false);
    }
  }

  const visibleChannelKey = visibleTraces
    .map((trace) => trace.channel)
    .join("|");

  useEffect(() => {
    if (!spectrogramEnabled || !loadedRequest) {
      return undefined;
    }

    let cancelled = false;

    setSpectrograms({});
    setSpectrogramErrors({});
    setSpectrogramLoading(
      Object.fromEntries(
        visibleTraces.map((trace) => [trace.channel, true])
      )
    );

    async function fetchForTrace(trace) {
      const params = {
        channel: trace.channel,
      };

      if (loadedRequest.session_id) {
        params.session_id = loadedRequest.session_id;
      } else {
        params.network = loadedRequest.network || "IA";
        params.station = loadedRequest.stations?.[0] || "";
        params.location = loadedRequest.location || "*";
        params.start_time = loadedRequest.startTime;
        params.end_time = loadedRequest.endTime;
      }

      if (trimStart && trimEnd) {
        params.trim_start = trimStart;
        params.trim_end = trimEnd;
      }

      try {
        const result = await getSpectrogram(params);
        if (!cancelled) {
          setSpectrograms((current) => ({
            ...current,
            [trace.channel]: result.spectrogram,
          }));
        }
      } catch (error) {
        if (!cancelled) {
          setSpectrogramErrors((current) => ({
            ...current,
            [trace.channel]:
              error.response?.data?.detail ||
              "Failed to load spectrogram.",
          }));
        }
      } finally {
        if (!cancelled) {
          setSpectrogramLoading((current) => ({
            ...current,
            [trace.channel]: false,
          }));
        }
      }
    }

    visibleTraces.forEach((trace) => {
      void fetchForTrace(trace);
    });

    return () => {
      cancelled = true;
    };
  }, [
    spectrogramEnabled,
    loadedRequest,
    visibleChannelKey,
    trimStart,
    trimEnd,
  ]);

  // Identitas dataset yang sedang dimuat — dipakai untuk
  // membedakan dataset baru (harus reset processing state) dari
  // re-load dataset yang sama (state dipertahankan).
  // Key berbasis parameter request, BUKAN object identity.
  const waveformKey = loadedRequest
    ? JSON.stringify({
        session_id: loadedRequest.session_id ?? null,
        network: loadedRequest.network ?? null,
        location: loadedRequest.location ?? null,
        channel: loadedRequest.channel ?? null,
        startTime: loadedRequest.startTime ?? null,
        endTime: loadedRequest.endTime ?? null,
        stations: loadedRequest.stations ?? null,
      })
    : null;

  useEffect(() => {
    if (!originalWaveform || !loadedRequest) {
      return;
    }

    // Dataset BARU → reset semua state yang melekat pada
    // dataset sebelumnya. UI preference (mis. spectrogramEnabled)
    // sengaja TIDAK di-reset. Spectrogram di-refetch otomatis
    // oleh effect spectrogram yang bergantung pada loadedRequest.
    setProcessedWaveform(null);
    setActiveTraces(
      originalWaveform.traces.map((trace) => trace.traceId)
    );
    setAmplitudeScale(1);
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waveformKey]);

  async function postAndUpdatePlot(
    operationsToApply = getActiveOperations()
  ) {
    if (!originalWaveform || !loadedRequest) {
      return false;
    }

    setIsProcessing(true);
    setProcessingErrors([]);

    try {
      if (operationsToApply.length === 0) {
        setProcessedWaveform(null);
        setActiveTraces(
          originalWaveform.traces.map((trace) => trace.traceId)
        );
        return true;
      }

      const processingResults = await Promise.allSettled(
        loadedRequest.stations.map(async (station) => {
          const stationNyquist = getStationNyquist(
            displayWaveform?.traces ?? [],
            activeTraces,
            station
          );

          const validationError =
            validateFilterAgainstNyquist(
              operationsToApply,
              stationNyquist
            );

          if (validationError) {
            throw new Error(validationError);
          }

          const payload = toProcessPayload(
            {
              ...loadedRequest,
              station,
            },
            operationsToApply
          );

          if (loadedRequest.session_id) {
            payload.session_id = loadedRequest.session_id;
          }

          const processed = await postProcess(payload);

          return processed.traces.map((trace) => ({
            ...trace,
            network: trace.network || loadedRequest.network || "IA",
            station: trace.station || station,
            traceId: [
              trace.network || loadedRequest.network || "IA",
              trace.station || station,
              trace.location || "--",
              trace.channel,
            ].join("."),
          }));
        })
      );

      const processedTraces = [];
      const errors = [];
      const failedStations = new Set();

      processingResults.forEach((result, index) => {
        const station = loadedRequest.stations[index];

        if (result.status === "fulfilled") {
          processedTraces.push(...result.value);
        } else {
          errors.push(
            `${station}: ${result.reason.message}`
          );
          failedStations.add(station);
        }
      });

      if (errors.length > 0) {
        setProcessingErrors(errors);
      }

      if (processedTraces.length > 0) {
        const fallbackTraces = originalWaveform.traces.filter(
          (trace) => failedStations.has(trace.station)
        );

        const mergedTraces = [
          ...processedTraces,
          ...fallbackTraces,
        ];

        setProcessedWaveform({ traces: mergedTraces });

        setActiveTraces(
          mergedTraces.map((trace) => trace.traceId)
        );
        return true;
      }

      return false;
    } catch (error) {
      console.error("Failed to process waveform:", error);
      setProcessingErrors([error.message]);
      return false;
    } finally {
      setIsProcessing(false);
    }
  }

  function getEnabledOperations(snapshot) {
    return (snapshot ?? []).filter(
      (operation) => operation.enabled
    );
  }

  async function handleApplyProcessing() {
    const operationsToApply = getActiveOperations();
    const success = await postAndUpdatePlot(operationsToApply);

    if (success) {
      commit();
    }
  }

  function handleUndoAndApply() {
    if (!canUndo || isProcessing) {
      return;
    }

    setLastHistoryAction("undo");

    const targetPipeline = undo();

    if (!targetPipeline) {
      return;
    }

    void postAndUpdatePlot(
      getEnabledOperations(targetPipeline)
    );
  }

  function handleRedoAndApply() {
    if (!canRedo || isProcessing) {
      return;
    }

    setLastHistoryAction("redo");

    const targetPipeline = redo();

    if (!targetPipeline) {
      return;
    }

    void postAndUpdatePlot(
      getEnabledOperations(targetPipeline)
    );
  }

  function handleResetAppliedWaveform() {
    if (originalWaveform) {
      setProcessedWaveform(null);
      setActiveTraces(
        originalWaveform.traces.map((trace) => trace.traceId)
      );
    }
  }

  if (!originalWaveform) {
    return (
      <section className="viewer-card waveform-card">
        <div className="waveform-header">
          <h2>Waveform Viewer</h2>
        </div>
        <div className="waveform-empty-state">
          <div className="empty-icon">📈</div>
          <h3>No waveform loaded</h3>
          <p>
            Select a station and time range, then click{" "}
            <strong>Load Waveform</strong>.
          </p>
        </div>
      </section>
    );
  }

  return (
    <div className="waveform-viewer-layout">
      {originalWaveform && (
        <ProcessingPipeline
          operations={pipeline}
          canUndo={canUndo}
          canRedo={canRedo}
          defaultStartTime={loadedRequest?.startTime}
          defaultEndTime={loadedRequest?.endTime}
          waveformStartTime={loadedRequest?.startTime}
          waveformEndTime={loadedRequest?.endTime}
          hasWaveform={Boolean(originalWaveform)}
          isProcessing={isProcessing}
          addOperation={addOperation}
          updateOperation={updateOperation}
          removeOperation={removeOperation}
          onUndo={handleUndoAndApply}
          onRedo={handleRedoAndApply}
          lastHistoryAction={lastHistoryAction}
          reset={reset}
          onApply={handleApplyProcessing}
          onResetAppliedWaveform={handleResetAppliedWaveform}
        />
      )}

      <div className="waveform-viewer-main">
        {processingErrors.length > 0 && (
          <div className="waveform-warning">
            {processingErrors.map((error, index) => (
              <div key={`${error}-${index}`}>{error}</div>
            ))}
          </div>
        )}

        {waveformWarnings.length > 0 && (
          <div className="waveform-warning">
            {waveformWarnings.map((warning, index) => (
              <div key={`${warning}-${index}`}>{warning}</div>
            ))}
          </div>
        )}

        <section className="viewer-card waveform-card">
        <div className="waveform-header">
          <h2>Waveform Viewer</h2>
        </div>

        {displayWaveform && (
          <div className="waveform-controls-sticky">
            <button
              type="button"
              className="trace-sticky-toggle"
              onClick={() =>
                setIsTraceSelectorOpen((current) => !current)
              }
            >
              <div className="trace-sticky-toggle-left">
                <span className="trace-sticky-arrow">
                  {isTraceSelectorOpen ? "\u25BC" : "\u25B6"}
                </span>
                <span className="trace-sticky-title">
                  Waveform Traces
                </span>
              </div>
              <span className="trace-sticky-count">
                {activeTraces.length} active
              </span>
            </button>

            {isTraceSelectorOpen && (
              <div className="trace-sticky-content">
                <TraceSelector
                  waveformData={displayWaveform}
                  activeTraces={activeTraces}
                  setActiveTraces={setActiveTraces}
                />
              </div>
            )}

            <div className="sticky-amplitude-section">
              <AmplitudeControl
                amplitudeScale={amplitudeScale}
                setAmplitudeScale={setAmplitudeScale}
              />

              <button
                type="button"
                className="spectrogram-toggle"
                onClick={() => setSpectrogramEnabled(
                  (enabled) => !enabled
                )}
              >
                {spectrogramEnabled
                  ? "Hide Spectrogram"
                  : "Show Spectrogram"}
              </button>

              <div className="download-menu-wrapper">
                <button
                  type="button"
                  className="spectrogram-toggle"
                  disabled={isDownloading}
                  onClick={() => setDownloadMenuOpen(
                    (open) => !open
                  )}
                >
                  {isDownloading
                    ? "Preparing MiniSEED..."
                    : "Download MiniSEED ▾"}
                </button>

                {downloadMenuOpen && (
                  <div className="download-menu">
                    {[
                      ...new Set(
                        visibleTraces.map(
                          (trace) => trace.channel
                        )
                      ),
                    ].map((channel) => (
                      <button
                        type="button"
                        className="download-menu-item"
                        key={channel}
                        onClick={() => {
                          console.log("[DOWNLOAD DEBUG] clicked:", channel);
                          void handleDownloadMiniSeed(channel);
                        }}
                      >
                        {channel}
                      </button>
                    ))}

                    <div className="download-menu-divider" />

                    <button
                      type="button"
                      className="download-menu-item"
                      onClick={() => {
                        console.log("[DOWNLOAD DEBUG] clicked: All Channels");
                        void handleDownloadMiniSeed();
                      }}
                    >
                      All Channels
                    </button>
                  </div>
                )}
              </div>
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

          {displayWaveform ? (
            <div className="waveform-channel-pairs">
              {visibleTraces.map((trace) => (
                <div
                  className="waveform-channel-pair"
                  key={trace.traceId}
                >
                  <WaveformPlot
                    waveformData={{ traces: [trace] }}
                    activeTraces={[trace.traceId]}
                    amplitudeScale={amplitudeScale}
                    normalizeEnabled={normalizeEnabled}
                  />

                  {spectrogramEnabled && (
                    <SpectrogramPanel
                      channel={trace.channel}
                      imageBase64={spectrograms[trace.channel]}
                      loading={spectrogramLoading[trace.channel] ?? false}
                      error={spectrogramErrors[trace.channel] ?? null}
                    />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="waveform-empty-state">
              <div className="empty-icon">📈</div>
              <h3>No waveform loaded</h3>
              <p>
                Select a station and time range, then click{" "}
                <strong>Load Waveform</strong>.
              </p>
            </div>
          )}
        </div>
      </section>
      </div>
    </div>
  );
}
