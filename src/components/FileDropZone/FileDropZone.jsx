import { useState, useRef } from "react";

const ACCEPT_MINISEED = ".mseed";
const ACCEPT_STATIONXML = ".xml,.stationxml";

export default function FileDropZone({ onFileSelect, accept, label, loaded }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  function handleDragOver(e) {
    e.preventDefault();
    setDragging(true);
  }

  function handleDragLeave() {
    setDragging(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      onFileSelect(file);
    }
  }

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (file) {
      onFileSelect(file);
    }
  }

  const acceptAttr =
    accept === "stationxml" ? ACCEPT_STATIONXML : ACCEPT_MINISEED;

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      style={{
        border: `2px dashed ${dragging ? "#3b82f6" : "#dbe3ee"}`,
        borderRadius: "10px",
        padding: "24px",
        textAlign: "center",
        cursor: "pointer",
        background: dragging ? "#eff6ff" : loaded ? "#f0fdf4" : "#fafbfc",
        transition: "background 0.15s, border-color 0.15s",
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={acceptAttr}
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      {loaded ? (
        <div style={{ color: "#166534" }}>
          <strong>&#10003; {label} loaded</strong>
        </div>
      ) : (
        <div style={{ color: "#64748b" }}>
          <div style={{ fontSize: "24px", marginBottom: "4px" }}>
            {dragging ? "\u2B07" : "\uD83D\uDCC1"}
          </div>
          <div style={{ fontSize: "13px" }}>
            {dragging ? "Drop file here" : `Upload ${label}`}
          </div>
        </div>
      )}
    </div>
  );
}
