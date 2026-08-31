import "./HVSRPanel.css";

function HVSRPanel({
  title,
  imageBase64,
  loading = false,
  error = null,
  incomplete = false,
}) {
  if (!title) {
    return null;
  }

  return (
    <section className="viewer-card spectrogram-card">
      <div className="waveform-header">
        <h2>HVSR</h2>
        <span className="spectrogram-channel-label">{title}</span>
      </div>

      <div className="spectrogram-content">
        {incomplete && !loading && !error && !imageBase64 && (
          <div className="hvsr-empty-state">
            HVSR membutuhkan komponen N, E, dan Z dari set channel
            yang sama.
          </div>
        )}

        {loading && (
          <div className="spectrogram-loading">Loading HVSR...</div>
        )}

        {error && (
          <div className="spectrogram-error">{error}</div>
        )}

        {imageBase64 && (
          <img
            src={`data:image/png;base64,${imageBase64}`}
            alt={`HVSR ${title}`}
            className="psd-image"
          />
        )}
      </div>
    </section>
  );
}

export default HVSRPanel;