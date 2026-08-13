import "./SpectrogramPanel.css";

export default function SpectrogramPanel({
  channel,
  imageBase64 = null,
  loading = false,
  error = null,
}) {
  if (!channel) {
    return null;
  }

  return (
    <section className="viewer-card spectrogram-card">
      <div className="waveform-header">
        <h2>Spectrogram</h2>
        <span className="spectrogram-channel-label">
          {channel}
        </span>
      </div>

      <div className="spectrogram-content">
        {loading && (
          <div className="spectrogram-loading">Loading spectrogram...</div>
        )}

        {error && (
          <div className="spectrogram-error">{error}</div>
        )}

        {imageBase64 && (
          <img
            src={`data:image/png;base64,${imageBase64}`}
            alt={`Spectrogram ${channel}`}
            className="spectrogram-image"
            style={{ display: loading ? "none" : "block" }}
          />
        )}
      </div>
    </section>
  );
}
