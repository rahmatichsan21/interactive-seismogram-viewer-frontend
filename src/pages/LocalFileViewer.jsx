import { useRef, useState } from "react";

import FileDropZone from "../components/FileDropZone/FileDropZone";
import WaveformViewerPanel from "./WaveformViewerPanel";

import {
  uploadMiniSeed,
  uploadStationXML,
  validateStationXML,
  deleteUploadSession,
  getUploadWaveform,
} from "../api/uploadApi";
import { MAX_POINTS } from "../api/waveformApi";
import { attachTraceIdentity } from "../utils/traceIdentity";

// Normalisasi timestamp ISO (bisa berisi `Z`, fraksi detik, atau
// offset) menjadi format `YYYY-MM-DDTHH:MM` yang dipakai Processing
// Pipeline. Local upload mengirim `str(UTCDateTime)` seperti
// `2025-07-01T08:00:00.000000Z`; tanpadan ini pipeline membentuk
// `...Z:00Z` → Invalid Date. Diparse via Date() lalu diformat ulang
// agar aman terhadap timezone yang sudah ada (tidak ditambahkan
// lagi). Invalid/parsial dikembalikan apa adanya.
function normalizeRequestTime(value) {
  if (!value) {
    return value;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const pad = (num) => String(num).padStart(2, "0");

  return (
    `${date.getUTCFullYear()}-` +
    `${pad(date.getUTCMonth() + 1)}-` +
    `${pad(date.getUTCDate())}T` +
    `${pad(date.getUTCHours())}:` +
    `${pad(date.getUTCMinutes())}`
  );
}

export default function LocalFileViewer() {
  const [sessionId, setSessionId] = useState(null);
  const [miniSeedFile, setMiniSeedFile] = useState(null);
  const [stationXMLFiles, setStationXMLFiles] = useState([]);
  const [stationXMLValidation, setStationXMLValidation] =
    useState(null);

  const [originalWaveform, setOriginalWaveform] = useState(null);
  const [loadedRequest, setLoadedRequest] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  // Menyimpan session yang sedang aktif. Session TIDAK dihapus
  // saat component unmount karena kedua page (FDSN/Local) tetap
  // di-mount — berpindah tab bukan alasan menghapus session.
  // Session hanya dihapus lewat Clear (handleClear) atau saat
  // dataset diganti dengan upload baru (handleMiniSeedFile).
  const prevSessionRef = useRef(null);

  async function handleMiniSeedFile(file) {
    setMiniSeedFile(file);
    // StationXML terikat pada session upload. Dataset baru wajib
    // memakai StationXML baru agar response tidak salah diterapkan.
    setStationXMLFiles([]);
    setStationXMLValidation(null);
    setIsUploading(true);
    setUploadError(null);

    try {
      const data = await uploadMiniSeed(file);

      // Ganti dataset: hapus session lama (jika ada) supaya
      // tidak menumpuk di backend. Ini lifecycle "replace",
      // bukan delete karena pindah page.
      if (
        prevSessionRef.current &&
        prevSessionRef.current !== data.session_id
      ) {
        deleteUploadSession(prevSessionRef.current).catch(() => {});
      }

      prevSessionRef.current = data.session_id;
      setSessionId(data.session_id);

      const waveform = await getUploadWaveform(
        data.session_id,
        MAX_POINTS
      );

      const traces = attachTraceIdentity(
        waveform.traces,
        // Setiap trace sudah membawa station dari backend. Jangan
        // gunakan station response global sebagai fallback karena
        // local upload dapat berisi beberapa station.
        "",
        "LOCAL"
      );

      setOriginalWaveform({ traces });
      setLoadedRequest({
        network: "LOCAL",
        location: "*",
        channel: "*",
        startTime: normalizeRequestTime(data.start_time),
        endTime: normalizeRequestTime(data.end_time),
        stations: data.stations?.length
          ? data.stations
          : [...new Set(
              traces.map((trace) => trace.station).filter(Boolean)
            )],
        session_id: data.session_id,
      });
    } catch (error) {
      const message =
        error.response?.data?.detail || "Failed to upload MiniSEED.";
      setUploadError(message);
    } finally {
      setIsUploading(false);
    }
  }

  async function handleStationXMLFile(file) {
    if (!sessionId) {
      setUploadError("Upload MiniSEED first before StationXML.");
      return;
    }

    setStationXMLValidation(null);
    setIsUploading(true);
    setUploadError(null);

    try {
      const uploadResult = await uploadStationXML(file, sessionId);
      setStationXMLFiles(uploadResult.filenames ?? [file.name]);
      const validation = await validateStationXML(sessionId);
      setStationXMLValidation(validation);
    } catch (error) {
      const message =
        error.response?.data?.detail || "Failed to upload StationXML.";
      setUploadError(message);
    } finally {
      setIsUploading(false);
    }
  }

  function handleClear() {
    if (sessionId) {
      deleteUploadSession(sessionId).catch(() => {});
    }
    prevSessionRef.current = null;
    setSessionId(null);
    setMiniSeedFile(null);
    setStationXMLFiles([]);
    setStationXMLValidation(null);
    setOriginalWaveform(null);
    setLoadedRequest(null);
  }

  return (
    <main className="viewer-main">
        <section className="viewer-card control-panel">
          <div className="request-layout">
            <div className="request-section">
              <div className="section-heading">
                <h3>Local Files</h3>
                <p>Upload MiniSEED and StationXML files.</p>
              </div>

              <div className="source-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <div className="field-group">
                  <FileDropZone
                    onFileSelect={handleMiniSeedFile}
                    accept="miniseed"
                    label="MiniSEED"
                    loaded={!!miniSeedFile}
                  />
                </div>

                <div className="field-group">
                  <FileDropZone
                    onFileSelect={handleStationXMLFile}
                    accept="stationxml"
                    label="StationXML"
                    loaded={stationXMLFiles.length > 0}
                  />
                  {stationXMLFiles.length > 0 && (
                    <div
                      style={{
                        marginTop: "8px",
                        fontSize: "13px",
                        color: "#166534",
                      }}
                    >
                      {stationXMLFiles.map((filename) => (
                        <div key={filename}>{filename}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {uploadError && (
                <div className="waveform-warning" style={{ marginTop: "12px" }}>
                  {uploadError}
                </div>
              )}

              {isUploading && (
                <div className="waveform-loading-banner" style={{ marginTop: "12px" }}>
                  <div className="loading-spinner"></div>
                  <div className="loading-text">
                    <strong>Uploading file...</strong>
                  </div>
                </div>
              )}

              {originalWaveform && (
                <div style={{ marginTop: "12px", textAlign: "right" }}>
                  <button
                    type="button"
                    onClick={handleClear}
                    style={{
                      padding: "6px 16px",
                      background: "#f1f5f9",
                      border: "1px solid #dbe3ee",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontSize: "13px",
                    }}
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        <WaveformViewerPanel
          originalWaveform={originalWaveform}
          loadedRequest={loadedRequest}
          isWaveformLoading={isUploading}
          stationXMLValidation={stationXMLValidation}
        />
      </main>
  );
}
