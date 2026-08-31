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

        {error && (
          <div className="spectrogram-error">{error}</div>
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