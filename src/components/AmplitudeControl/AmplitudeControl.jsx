import { useEffect, useState } from "react";

function AmplitudeControl({
  amplitudeScale,
  setAmplitudeScale,
  normalize,
  setNormalize
}) {
  const [inputValue, setInputValue] = useState(
    String(amplitudeScale)
  );

  useEffect(() => {
    setInputValue(String(amplitudeScale));
  }, [amplitudeScale]);

  function applyInputValue() {
    const value = Number(inputValue);

    if (!Number.isFinite(value)) {
      setInputValue(String(amplitudeScale));
      return;
    }

    const clampedValue = Math.min(
      5,
      Math.max(0.1, value)
    );

    setAmplitudeScale(clampedValue);
    setInputValue(String(clampedValue));
  }
  
  return (
    <div className="amplitude-control-compact">

      {/* Normalize */}
      <label className="normalize-compact">
        <input
          type="checkbox"
          checked={normalize}
          onChange={(event) =>
            setNormalize(event.target.checked)
          }
        />

        <span>Normalize</span>
      </label>

      {/* Separator */}
      <div className="control-separator" />

      {/* Amplitude Title */}
      <label
        className="amplitude-compact-title"
        htmlFor="amplitude-scale"
      >
        Amplitude
      </label>

      {/* Minimum */}
      <span className="amplitude-limit">
        0.1×
      </span>

      {/* Slider */}
      <input
        id="amplitude-scale"
        className="amplitude-compact-slider"
        type="range"
        min="0.1"
        max="5"
        step="0.1"
        value={amplitudeScale}
        onChange={(event) =>
          setAmplitudeScale(
            Number(event.target.value)
          )
        }
      />

      {/* Maximum */}
      <span className="amplitude-limit">
        5×
      </span>

      {/* Number Input */}
      <div className="amplitude-scale-input-wrapper">
        <input
          type="number"
          min="0.1"
          max="5"
          step="0.1"
          value={inputValue}
          onChange={(event) =>
            setInputValue(event.target.value)
          }
          onBlur={applyInputValue}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              applyInputValue();
              event.currentTarget.blur();
            }
          }}
        />

        <span>×</span>
      </div>

      {/* Reset */}
      <button
        className="amplitude-reset-button"
        type="button"
        onClick={() =>
          setAmplitudeScale(1)
        }
      >
        Reset
      </button>

    </div>
  );
}

export default AmplitudeControl;