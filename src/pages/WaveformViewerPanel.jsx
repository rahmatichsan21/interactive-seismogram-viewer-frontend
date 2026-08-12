import { useState, useEffect } from "react";
import AmplitudeControl from "../components/AmplitudeControl/AmplitudeControl";
import WaveformPlot from "../components/WaveformPlot/WaveformPlot";
import TraceSelector from "../components/TraceSelector/TraceSelector";
import ProcessingPipeline from "../components/ProcessingPipeline/ProcessingPipeline";

import { postProcess } from "../api/waveformApi";

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

  const {
    pipeline,
    canUndo,
    canRedo,
    addOperation,
    updateOperation,
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

  useEffect(() => {
    if (originalWaveform) {
      setActiveTraces(
        originalWaveform.traces.map((trace) => trace.traceId)
      );
    }
  }, [originalWaveform]);

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
    <>
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
          onUndo={handleUndoAndApply}
          onRedo={handleRedoAndApply}
          lastHistoryAction={lastHistoryAction}
          reset={reset}
          onApply={handleApplyProcessing}
          onResetAppliedWaveform={handleResetAppliedWaveform}
        />
      )}

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
            <WaveformPlot
              waveformData={displayWaveform}
              activeTraces={activeTraces}
              amplitudeScale={amplitudeScale}
              normalizeEnabled={normalizeEnabled}
            />
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
    </>
  );
}
