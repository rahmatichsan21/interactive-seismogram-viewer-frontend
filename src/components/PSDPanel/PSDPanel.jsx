import "./PSDPanel.css";

function PSDPanel({
  traceId,
  imageBase64,
  loading = false,
  error = null,
}) {
  if (!traceId) {
    return null;
  }

  // `error` bisa berupa string, atau (jika lolos dari axios/FastAPI
  // tanpa normalisasi) array of {type, loc, msg, input} / object.
  // Jangan pernah merender object/array langsung ke JSX.
  let errorText = null;
  if (error) {
    if (typeof error === "string") {
      errorText = error;
    } else if (Array.isArray(error)) {
      errorText = error
        .map((item) => item?.msg || JSON.stringify(item))
        .join("; ");
    } else if (typeof error === "object") {
      errorText = error.msg || error.message || JSON.stringify(error);
    } else {
      errorText = String(error);
    }
  }

  return (
    <section className="viewer-card spectrogram-card">
      <div className="waveform-header">
        <h2>PSD</h2>
        <span className="spectrogram-channel-label">{traceId}</span>
      </div>

      <div className="spectrogram-content">
        {loading && (
          <div className="spectrogram-loading">Loading PSD...</div>
        )}

        {errorText && (
          <div className="spectrogram-error">{errorText}</div>
        )}

        {imageBase64 && (
          <img
            src={`data:image/png;base64,${imageBase64}`}
            alt={`PSD ${traceId}`}
            className="psd-image"
          />
        )}
      </div>
    </section>
  );
}

export default PSDPanel;