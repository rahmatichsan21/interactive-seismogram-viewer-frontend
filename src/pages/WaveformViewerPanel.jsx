import { useState, useEffect, useRef, useMemo } from "react";
import Plotly from "plotly.js/dist/plotly";
import AmplitudeControl from "../components/AmplitudeControl/AmplitudeControl";
import WaveformPlot from "../components/WaveformPlot/WaveformPlot";
import TraceSelectorMatrix from "../components/TraceSelectorMatrix/TraceSelectorMatrix";
import ProcessingPipeline from "../components/ProcessingPipeline/ProcessingPipeline";
import SpectrogramPanel from "../components/SpectrogramPanel/SpectrogramPanel";
import PSDPanel from "../components/PSDPanel/PSDPanel";
import HVSRPanel from "../components/HVSRPanel/HVSRPanel";

import {
  downloadMiniSeed,
  downloadStationXML,
  getSpectrogram,
  getPSD,
  getHVSR,
  postProcess,
} from "../api/waveformApi";

import useOperationStack from "../hooks/useOperationStack";
import { toProcessPayload } from "../utils/processingPayload";

// [TEMP DEBUG] Helper ringkas untuk statistik trace (tidak log array penuh).
function debugStats(values) {
  if (!values || !values.length) {
    return { n: 0, min: null, max: null, std: null };
  }
  let n = 0;
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
    n += 1;
  }
  const mean = n ? sum / n : NaN;
  let ss = 0;
  for (const v of values) {
    if (Number.isFinite(v)) ss += (v - mean) ** 2;
  }
  return { n, min, max, std: n ? Math.sqrt(ss / n) : NaN };
}

// [TEMP DEBUG] Ringkasan singkat satu trace.
function debugTraceSummary(trace) {
  const st = debugStats(trace?.amplitude);
  const fmt = (v) => (v == null ? "-" : Number(v).toExponential(3));
  return (
    `id=${trace?.traceId} npts=${st.n} ` +
    `t0=${trace?.time?.[0] ?? "-"} t1=${trace?.time?.[(trace?.time?.length || 1) - 1] ?? "-"} ` +
    `min=${fmt(st.min)} max=${fmt(st.max)} std=${fmt(st.std)}`
  );
}

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

function validateFilterParams(operations) {
  for (const operation of operations) {
    if (operation.type !== "filter") {
      continue;
    }

    const { filterType, freq, freqMin, freqMax, corners } = operation.params;

    if (filterType === "bandpass") {
      const min = Number(freqMin);
      const max = Number(freqMax);
      if (Number.isNaN(min) || Number.isNaN(max) || !(min < max)) {
        return (
          `Filter bandpass gagal: frekuensi batas bawah harus ` +
          `lebih kecil dari frekuensi batas atas.`
        );
      }
    } else if (filterType === "lowpass" || filterType === "highpass") {
      const f = Number(freq);
      if (Number.isNaN(f) || !(f > 0)) {
        return (
          `Filter ${filterType} gagal: frekuensi filter harus ` +
          `lebih besar dari 0 Hz.`
        );
      }
    }

    const c = Number(corners);
    if (Number.isNaN(c) || !(c >= 1)) {
      return `Filter gagal: jumlah poles (corners) minimal 1.`;
    }
  }

  return null;
}

function LoadingBanner({ phase }) {
  return (
    <div className="waveform-loading-banner">
      <div className="loading-spinner"></div>
      <div className="loading-text">
        {phase === "downloading" ? (
          <>
            <strong>Downloading waveform from BMKG...</strong>
            <span>This may take a moment. Please wait...</span>
          </>
        ) : (
          <strong>Loading waveform...</strong>
        )}
      </div>
    </div>
  );
}

export default function WaveformViewerPanel({
  originalWaveform,
  loadedRequest,
  isWaveformLoading,
  loadPhase,
  waveformLoadId,
  waveformWarnings = [],
}) {
  const [isTraceSelectorOpen, setIsTraceSelectorOpen] = useState(false);
  const [processedWaveform, setProcessedWaveform] = useState(null);
  const [activeTraces, setActiveTraces] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const processingLoadIdRef = useRef(waveformLoadId);
  processingLoadIdRef.current = waveformLoadId;
  const [lastHistoryAction, setLastHistoryAction] = useState(null);
  const [processingErrors, setProcessingErrors] = useState([]);
  const [amplitudeScale, setAmplitudeScale] = useState(1);
  // Normalize = visualization state (Global/Common Amplitude Scale),
  // BUKAN processing operation. Disimpan mandiri di sini, tidak
  // bergantung pada pipeline/history/undo-redo processing.
  const [normalizeEnabled, setNormalizeEnabled] =
    useState(false);
  const [spectrogramEnabled, setSpectrogramEnabled] =
    useState(false);
  const [spectrograms, setSpectrograms] = useState({});
  const [spectrogramLoading, setSpectrogramLoading] =
    useState({});
  const [spectrogramErrors, setSpectrogramErrors] =
    useState({});
  const [psdEnabled, setPsdEnabled] = useState(false);
  const [psds, setPsds] = useState({});
  const [psdLoading, setPsdLoading] = useState({});
  const [psdErrors, setPsdErrors] = useState({});
  const [hvsrEnabled, setHvsrEnabled] = useState(false);
  const [hvsrs, setHvsrs] = useState({});
  const [hvsrLoading, setHvsrLoading] = useState({});
  const [hvsrErrors, setHvsrErrors] = useState({});
  const [downloadMenuOpen, setDownloadMenuOpen] =
    useState(false);
  const [isDownloading, setIsDownloading] =
    useState(false);
    
  // Snapshot trace yang dipilih untuk Download MiniSEED.
  // Terpisah dari activeTraces (Waveform display) — perubahan di
  // sini TIDAK mengubah tampilan waveform. Diinisialisasi dari
  // seluruh visible traces saat menu download dibuka.
  const [downloadSelection, setDownloadSelection] =
    useState([]);

  // "menu" = daftar pilihan export,
  // "png" = submenu pilihan jenis PNG (Waveform/Spectrogram/PSD/HVSR),
  // "miniseed" = sub-panel pemilihan trace export,
  // "stationxml" = sub-panel pemilihan station untuk StationXML.
  const [downloadMode, setDownloadMode] =
    useState("menu");

  // Refs ke graph div tiap Plot (untuk Plotly.toImage saat Download PNG).
  const waveformPlotRefs = useRef({});

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

  const visibleTraceIds = activeTraces.length > 0
    ? activeTraces
    : (displayWaveform?.traces ?? []).map(
        (trace) => trace.traceId
      );

  const visibleTraces = displayWaveform?.traces?.filter(
    (trace) => visibleTraceIds.includes(trace.traceId)
  ) ?? [];

  // Global/Common Amplitude Scale untuk Normalize.
  // Dihitung di level ini (yang melihat SEMUA visible trace),
  // bukan di dalam WaveformPlot (yang hanya menerima SATU trace).
  // basis = min/max seluruh visible trace; null saat Normalize
  // OFF atau tidak ada trace yang valid, sehingga WaveformPlot
  // jatuh balik ke per-trace scaling.
  const globalScale = (() => {
    if (!normalizeEnabled || visibleTraces.length === 0) {
      return null;
    }

    let globalMin = Infinity;
    let globalMax = -Infinity;

    visibleTraces.forEach((trace) => {
      const amplitude = trace.amplitude ?? [];

      if (amplitude.length === 0) {
        return;
      }

      for (const value of amplitude) {
        if (value < globalMin) {
          globalMin = value;
        }

        if (value > globalMax) {
          globalMax = value;
        }
      }
    });

    if (
      globalMin === Infinity ||
      globalMax === -Infinity
    ) {
      return null;
    }

    return {
      min: globalMin,
      max: globalMax,
    };
  })();

  const committedPipeline = history[pointer] ?? [];

  // Waveform yang sedang aktif (processedWaveform) dihasilkan oleh
  // committedPipeline (= history[pointer]). Ini sinkron dengan
  // processedWaveform: keduanya berubah bersama saat Apply/Undo/Redo,
  // dan TIDAK berubah saat user mengedit draft pipeline (mis. Remove
  // Filter tanpa Apply). Jadi ini sumber kebenaran "sudah difilter",
  // bukan pipeline draft.
  const isFiltered = committedPipeline.some(
    (operation) =>
      operation.enabled && operation.type === "filter"
  );

  const activeTrim = committedPipeline.find(
    (operation) =>
      operation.enabled && operation.type === "trim"
  );

  const trimStart = activeTrim?.params?.startTime ?? null;
  const trimEnd = activeTrim?.params?.endTime ?? null;

  const downloadableStations = [...new Set(
    (loadedRequest?.stations ?? [])
      .filter(Boolean)
  )].sort();

  async function handleDownloadStationXML(station) {
    if (!loadedRequest?.network || !station) {
      return;
    }

    setIsDownloading(true);
    setDownloadMenuOpen(false);
    try {
      await downloadStationXML({
        network: loadedRequest.network,
        station,
      });
    } catch (error) {
      alert(
        error.response?.data?.detail ||
        error.message ||
        `Failed to download StationXML for ${station}.`
      );
    } finally {
      setIsDownloading(false);
    }
  }

  async function handleDownloadMiniSeed(traceIds = null) {
    console.log("[DOWNLOAD DEBUG] handleDownloadMiniSeed called:", traceIds);
    console.log("[DOWNLOAD DEBUG] loadedRequest:", loadedRequest);
    console.log("[DOWNLOAD DEBUG] visibleTraces:", visibleTraces);
    if (!loadedRequest || visibleTraces.length === 0) {
      console.log("[DOWNLOAD DEBUG] early return (no request or traces)");
      return;
    }

    // Selection eksplisit berbasis trace identity (traceId).
    // traceIds null = seluruh visible traces.
    const selectedIds = traceIds ? new Set(traceIds) : null;

    const traces = visibleTraces
      .filter(
        (trace) => !selectedIds || selectedIds.has(trace.traceId)
      )
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

  // Download PNG untuk SEMUA waveform trace yang sedang ditampilkan.
  // Satu displayed trace = satu file PNG (Plotly.toImage pada plot yang
  // benar-benar dirender). Tidak ada PNG gabungan/multi-trace.
  async function handleDownloadPng() {
    for (const trace of visibleTraces) {
      const gd = waveformPlotRefs.current[trace.traceId];
      if (!gd) {
        continue;
      }

      const url = await Plotly.toImage(gd, {
        format: "png",
        scale: 1,
      });

      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${trace.traceId}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    }

    setDownloadMenuOpen(false);
  }

  // Download data-URL PNG (base64) yang sudah tersedia di state —
  // tidak ada request API baru dan tidak ada grafik yang digenerate
  // ulang. Dipakai untuk Spectrogram/PSD/HVSR di submenu Download PNG.
  function downloadBase64Png(base64, filename) {
    const anchor = document.createElement("a");
    anchor.href = `data:image/png;base64,${base64}`;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  // Download PNG Spectrogram untuk setiap visible trace yang
  // gambarnya sudah tersedia di state `spectrograms`.
  function handleDownloadSpectrogramPng() {
    for (const trace of visibleTraces) {
      const base64 = spectrograms[trace.traceId];
      if (!base64) {
        continue;
      }
      downloadBase64Png(base64, `${trace.traceId}_spectrogram.png`);
    }

    setDownloadMenuOpen(false);
  }

  // Download PNG PSD untuk setiap visible trace yang gambarnya
  // sudah tersedia di state `psds`.
  function handleDownloadPsdPng() {
    for (const trace of visibleTraces) {
      const base64 = psds[trace.traceId]?.psd_image;
      if (!base64) {
        continue;
      }
      downloadBase64Png(base64, `${trace.traceId}_psd.png`);
    }

    setDownloadMenuOpen(false);
  }

  // Download PNG HVSR untuk setiap family (N/E/Z) yang gambarnya
  // sudah tersedia di state `hvsrs`.
  function handleDownloadHvsrPng() {
    for (const family of hvsrFamilies) {
      const base64 = hvsrs[family.groupKey]?.hvsr_image;
      if (!base64) {
        continue;
      }
      downloadBase64Png(base64, `${family.groupKey}_hvsr.png`);
    }

    setDownloadMenuOpen(false);
  }

  const visibleChannelKey = visibleTraces
    .map((trace) => trace.traceId)
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
        visibleTraces.map((trace) => [trace.traceId, true])
      )
    );

    async function fetchForTrace(trace) {
      const params = {
        channel: trace.channel,
      };

      if (loadedRequest.session_id) {
        params.session_id = loadedRequest.session_id;
      } else {
        params.network = trace.network || loadedRequest.network || "IA";
        params.station = trace.station;
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
            [trace.traceId]: result.spectrogram,
          }));
        }
      } catch (error) {
        if (!cancelled) {
          setSpectrogramErrors((current) => ({
            ...current,
            [trace.traceId]:
              error.response?.data?.detail ||
              "Failed to load spectrogram.",
          }));
        }
      } finally {
        if (!cancelled) {
          setSpectrogramLoading((current) => ({
            ...current,
            [trace.traceId]: false,
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

  useEffect(() => {
    if (!psdEnabled || !loadedRequest) {
      return undefined;
    }

    let cancelled = false;

    setPsds({});
    setPsdErrors({});
    setPsdLoading(
      Object.fromEntries(
        visibleTraces.map((trace) => [trace.traceId, true])
      )
    );

    async function fetchPsdForTrace(trace) {
      const params = {
        channel: trace.channel,
      };

      if (loadedRequest.session_id) {
        params.session_id = loadedRequest.session_id;
      } else {
        params.network = trace.network || loadedRequest.network || "IA";
        params.station = trace.station;
        params.location = trace.location;
        params.start_time = loadedRequest.startTime;
        params.end_time = loadedRequest.endTime;
      }

      if (trimStart && trimEnd) {
        params.trim_start = trimStart;
        params.trim_end = trimEnd;
      }

      try {
        const result = await getPSD(params);
        if (!cancelled) {
          setPsds((current) => ({
            ...current,
            [trace.traceId]: result,
          }));
        }
      } catch (error) {
        if (!cancelled) {
          setPsdErrors((current) => ({
            ...current,
            [trace.traceId]:
              error?.message ||
              "Failed to load PSD.",
          }));
        }
      } finally {
        if (!cancelled) {
          setPsdLoading((current) => ({
            ...current,
            [trace.traceId]: false,
          }));
        }
      }
    }

    visibleTraces.forEach((trace) => {
      void fetchPsdForTrace(trace);
    });

    return () => {
      cancelled = true;
    };
  }, [
    psdEnabled,
    loadedRequest,
    visibleChannelKey,
    trimStart,
    trimEnd,
  ]);

  // Grouping trace untuk HVSR: grup per (network.station.location),
  // lalu family channel (base) dengan komponen N/E/Z.
  const stationGroups = useMemo(() => {
    const order = [];
    const byKey = {};

    for (const trace of visibleTraces) {
      const key = [
        trace.network || "",
        trace.station || "",
        trace.location || "",
      ].join(".");

      if (!byKey[key]) {
        byKey[key] = { key, traces: [] };
        order.push(byKey[key]);
      }
      byKey[key].traces.push(trace);
    }

    return order;
  }, [visibleChannelKey, processedWaveform]);

  const hvsrFamilies = useMemo(() => {
    const families = [];

    for (const group of stationGroups) {
      const byBase = {};

      for (const trace of group.traces) {
        const suffix = trace.channel?.slice(-1);
        if (suffix !== "N" && suffix !== "E" && suffix !== "Z") {
          continue;
        }
        const base = trace.channel.slice(0, -1);

        if (!byBase[base]) {
          byBase[base] = { n: null, e: null, z: null };
        }
        if (suffix === "N") byBase[base].n = trace;
        if (suffix === "E") byBase[base].e = trace;
        if (suffix === "Z") byBase[base].z = trace;
      }

      for (const [base, comp] of Object.entries(byBase)) {
        const first =
          comp.n || comp.e || comp.z;

        families.push({
          groupKey: `${group.key}.${base}`,
          stationKey: group.key,
          network: first?.network,
          station: first?.station,
          location: first?.location,
          base,
          n: comp.n,
          e: comp.e,
          z: comp.z,
          complete: Boolean(comp.n && comp.e && comp.z),
        });
      }
    }

    return families;
  }, [stationGroups]);

  useEffect(() => {
    if (!hvsrEnabled || !loadedRequest) {
      return undefined;
    }

    let cancelled = false;

    const completeFamilies = hvsrFamilies.filter(
      (family) => family.complete
    );

    setHvsrs({});
    setHvsrErrors({});
    setHvsrLoading(
      Object.fromEntries(
        completeFamilies.map((family) => [family.groupKey, true])
      )
    );

    async function fetchHvsrForFamily(family) {
      const params = {
        channelN: family.n.channel,
        channelE: family.e.channel,
        channelZ: family.z.channel,
      };

      if (loadedRequest.session_id) {
        params.sessionId = loadedRequest.session_id;
      } else {
        params.network = family.network;
        params.station = family.station;
        params.location = family.location;
        params.startTime = loadedRequest.startTime;
        params.endTime = loadedRequest.endTime;
      }

      if (trimStart && trimEnd) {
        params.trimStart = trimStart;
        params.trimEnd = trimEnd;
      }

      try {
        const result = await getHVSR(params);
        if (!cancelled) {
          setHvsrs((current) => ({
            ...current,
            [family.groupKey]: result,
          }));
        }
      } catch (error) {
        if (!cancelled) {
          setHvsrErrors((current) => ({
            ...current,
            [family.groupKey]:
              error?.message ||
              "Failed to load HVSR.",
          }));
        }
      } finally {
        if (!cancelled) {
          setHvsrLoading((current) => ({
            ...current,
            [family.groupKey]: false,
          }));
        }
      }
    }

    completeFamilies.forEach((family) => {
      void fetchHvsrForFamily(family);
    });

    return () => {
      cancelled = true;
    };
  }, [
    hvsrEnabled,
    loadedRequest,
    visibleChannelKey,
    trimStart,
    trimEnd,
    hvsrFamilies,
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
    // Setiap Load Waveform baru harus membuang state
    // processing dari waveform sebelumnya.
    setProcessedWaveform(null);
    setProcessingErrors([]);
    setAmplitudeScale(1);
    reset();

    if (!originalWaveform || !loadedRequest) {
      setActiveTraces([]);
      return;
    }

    setActiveTraces(
      originalWaveform.traces.map((trace) => trace.traceId)
    );
  }, [waveformLoadId, waveformKey]);
  
  // [TEMP DEBUG] Amati processedWaveform & sumber display.
  const processedObserverSkip = useRef(true);
  useEffect(() => {
    if (processedObserverSkip.current) {
      processedObserverSkip.current = false;
      return;
    }
    console.log("[PROCESS DEBUG] processedWaveform CHANGED");
    if (processedWaveform == null) {
      console.log("[PROCESS DEBUG]   -> null (processed HILANG)");
    } else {
      console.log(
        "[PROCESS DEBUG]   -> NON-NULL n_traces=",
        processedWaveform.traces.length
      );
      processedWaveform.traces.forEach((t) =>
        console.log("[PROCESS DEBUG]     trace:", debugTraceSummary(t))
      );
    }
  }, [processedWaveform]);

  // [TEMP DEBUG] Sumber yang dipakai displayWaveform.
  useEffect(() => {
    console.log(
      "[PROCESS DEBUG] display source =",
      processedWaveform ? "PROCESSED" : "ORIGINAL",
      "| processedWaveform =",
      processedWaveform ? "NON-NULL" : "null"
    );
  });

  async function postAndUpdatePlot(
    operationsToApply = getActiveOperations()
  ) {
    const requestLoadId = waveformLoadId;
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

      const filterValidation = validateFilterParams(operationsToApply);
      if (filterValidation) {
        setProcessingErrors([filterValidation]);
        return false;
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

          // [TEMP DEBUG]
          console.log(
            "[PROCESS DEBUG] postProcess call station=", station,
            "ops=", operationsToApply.map((o) => o.type),
            "payload=", JSON.stringify(payload)
          );

          const processed = await postProcess(payload);

          // [TEMP DEBUG]
          console.log(
            "[PROCESS DEBUG] postProcess OK station=", station,
            "n_traces=", processed?.traces?.length,
            processed?.traces?.map(debugTraceSummary)
          );

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
      if (processingLoadIdRef.current !== requestLoadId) {
        return false;
      }
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

        // [TEMP DEBUG]
        console.log(
          "[PROCESS DEBUG] ABOUT TO SET processedWaveform n=",
          mergedTraces.length
        );
        mergedTraces.forEach((t) =>
          console.log("[PROCESS DEBUG]   processed:", debugTraceSummary(t))
        );

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
      if (processingLoadIdRef.current === requestLoadId) {
        setIsProcessing(false);
      }
    }
  }

  function getEnabledOperations(snapshot) {
    return (snapshot ?? []).filter(
      (operation) => operation.enabled
    );
  }

  async function handleApplyProcessing() {
    const operationsToApply = getActiveOperations();

    // [TEMP DEBUG]
    console.log("[PROCESS DEBUG] Apply started");
    console.log(
      "[PROCESS DEBUG] operationsToApply =",
      operationsToApply.map((o) => ({ type: o.type, enabled: o.enabled, params: o.params }))
    );

    // Validasi urutan: Instrument Correction harus SEBELUM Filter.
    // Jika invalid, tolak Apply tanpa memproses (tidak commit).
    const filterIdx = operationsToApply.findIndex(
      (op) => op.type === "filter"
    );
    const corrIdx = operationsToApply.findIndex(
      (op) => op.type === "instrument_correction"
    );
    const orderInvalid =
      corrIdx !== -1 &&
      filterIdx !== -1 &&
      filterIdx < corrIdx;

    if (orderInvalid) {
      setProcessingErrors([
        "Instrument Correction must be applied before Filter. " +
          "Remove the Filter above before applying Instrument " +
          "Correction.",
      ]);
      return;
    }

    const success = await postAndUpdatePlot(operationsToApply);

    // [TEMP DEBUG]
    console.log("[PROCESS DEBUG] postAndUpdatePlot success =", success);

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
        {isWaveformLoading && (
          <LoadingBanner phase={loadPhase} />
        )}
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

  const displayControls = displayWaveform ? (
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
          <TraceSelectorMatrix
            traces={visibleTraces}
            selectedTraceIds={activeTraces}
            onSelectionChange={setActiveTraces}
          />
        </div>
      )}

      <div className="sticky-amplitude-section">
        <AmplitudeControl
          amplitudeScale={amplitudeScale}
          setAmplitudeScale={setAmplitudeScale}
        />

        <label className="normalize-compact">
          <input
            type="checkbox"
            checked={normalizeEnabled}
            onChange={(event) =>
              setNormalizeEnabled(event.target.checked)
            }
          />
          Normalize / Common Scale
        </label>

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

        <button
          type="button"
          className="spectrogram-toggle"
          onClick={() => setPsdEnabled(
            (enabled) => !enabled
          )}
        >
          {psdEnabled
            ? "Hide PSD"
            : "Show PSD"}
        </button>

        <button
          type="button"
          className="spectrogram-toggle"
          onClick={() => setHvsrEnabled(
            (enabled) => !enabled
          )}
        >
          {hvsrEnabled
            ? "Hide HVSR"
            : "Show HVSR"}
        </button>

        <div className="download-menu-wrapper">
          <button
            type="button"
            className="spectrogram-toggle"
            disabled={isDownloading}
            onClick={() => {
              // Snapshot seluruh visible traces saat menu
              // dibuka (terpisah dari activeTraces).
              if (!downloadMenuOpen) {
                setDownloadSelection(
                  visibleTraces.map((trace) => trace.traceId)
                );
                setDownloadMode("menu");
              }
              setDownloadMenuOpen((open) => !open);
            }}
          >
            {isDownloading
              ? "Preparing download..."
              : "Download ▾"}
          </button>

          {downloadMenuOpen && downloadMode === "menu" && (
            <div className="download-menu">
              <button
                type="button"
                className="download-menu-item"
                onClick={() => setDownloadMode("png")}
              >
                PNG ▸
              </button>

              <div className="download-menu-divider" />

              <button
                type="button"
                className="download-menu-item"
                onClick={() => setDownloadMode("miniseed")}
              >
                Download MiniSEED
              </button>

              <button
                type="button"
                className="download-menu-item"
                disabled={downloadableStations.length === 0 || Boolean(loadedRequest?.session_id)}
                onClick={() => setDownloadMode("stationxml")}
              >
                Download StationXML
              </button>
            </div>
          )}

          {downloadMenuOpen && downloadMode === "png" && (
            <div className="download-menu">
              <div className="download-menu-title">
                Download PNG
              </div>

              <button
                type="button"
                className="download-menu-item"
                onClick={() => {
                  void handleDownloadPng();
                }}
              >
                Waveform
              </button>

              <button
                type="button"
                className="download-menu-item"
                disabled={!spectrogramEnabled}
                onClick={() => {
                  handleDownloadSpectrogramPng();
                }}
              >
                Spectrogram
              </button>

              <button
                type="button"
                className="download-menu-item"
                disabled={!psdEnabled}
                onClick={() => {
                  handleDownloadPsdPng();
                }}
              >
                PSD
              </button>

              <button
                type="button"
                className="download-menu-item"
                disabled={!hvsrEnabled}
                onClick={() => {
                  handleDownloadHvsrPng();
                }}
              >
                HVSR
              </button>

              <div className="download-menu-divider" />

              <button
                type="button"
                className="download-menu-item"
                onClick={() => setDownloadMode("menu")}
              >
                ← Back
              </button>
            </div>
          )}

          {downloadMenuOpen && downloadMode === "stationxml" && (
            <div className="download-menu">
              <div className="download-menu-title">
                Select station to export
              </div>

              {downloadableStations.map((station) => (
                <button
                  key={station}
                  type="button"
                  className="download-menu-item download-menu-download"
                  disabled={isDownloading}
                  onClick={() => {
                    void handleDownloadStationXML(station);
                  }}
                >
                  {station}.xml
                </button>
              ))}

              <div className="download-menu-divider" />

              <button
                type="button"
                className="download-menu-item"
                onClick={() => setDownloadMode("menu")}
              >
                ← Back
              </button>
            </div>
          )}

          {downloadMenuOpen && downloadMode === "miniseed" && (
            <div className="download-menu">
              <div className="download-menu-title">
                Select traces to export
              </div>

              <div className="download-menu-matrix">
                <TraceSelectorMatrix
                  traces={visibleTraces}
                  selectedTraceIds={downloadSelection}
                  onSelectionChange={setDownloadSelection}
                />
              </div>

              <div className="download-menu-divider" />

              <button
                type="button"
                className="download-menu-item download-menu-download"
                disabled={downloadSelection.length === 0 || isDownloading}
                onClick={() => {
                  console.log(
                    "[DOWNLOAD DEBUG] download selected:",
                    downloadSelection
                  );
                  void handleDownloadMiniSeed(downloadSelection);
                }}
              >
                Download Selected ({downloadSelection.length})
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="waveform-viewer-layout">
      <div className="waveform-control-column">
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
            isFiltered={isFiltered}
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

        {displayControls}
      </div>

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

        <div className="waveform-content">
          {isWaveformLoading && (
            <LoadingBanner phase={loadPhase} />
          )}

          {displayWaveform?.traces?.length > 0 ?  (
            <div className="waveform-station-groups">
              {stationGroups.map((group) => (
                <div
                  className="waveform-station-group"
                  key={group.key}
                >
                  <div className="waveform-channel-pairs">
                    {group.traces.map((trace) => (
                      <div
                        className="waveform-channel-pair"
                        key={trace.traceId}
                      >
                        <WaveformPlot
                          waveformData={{ traces: [trace] }}
                          activeTraces={[trace.traceId]}
                          amplitudeScale={amplitudeScale}
                          normalizeEnabled={normalizeEnabled}
                          globalScale={globalScale}
                          plotRefs={waveformPlotRefs}
                        />

                        {spectrogramEnabled && (
                          <SpectrogramPanel
                            channel={trace.channel}
                            imageBase64={spectrograms[trace.traceId]}
                            loading={spectrogramLoading[trace.traceId] ?? false}
                            error={spectrogramErrors[trace.traceId] ?? null}
                          />
                        )}

                        {psdEnabled && (
                          <PSDPanel
                            traceId={trace.traceId}
                            imageBase64={psds[trace.traceId]?.psd_image}
                            loading={psdLoading[trace.traceId] ?? false}
                            error={psdErrors[trace.traceId] ?? null}
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  {hvsrEnabled &&
                    hvsrFamilies
                      .filter(
                        (family) =>
                          family.stationKey === group.key
                      )
                      .map((family) => (
                        <HVSRPanel
                          key={family.groupKey}
                          title={family.groupKey}
                          imageBase64={hvsrs[family.groupKey]?.hvsr_image}
                          loading={hvsrLoading[family.groupKey] ?? false}
                          error={hvsrErrors[family.groupKey] ?? null}
                          incomplete={!family.complete}
                        />
                      ))}
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