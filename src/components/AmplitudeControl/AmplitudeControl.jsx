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
    
    <div className="amplitude-control">
      <div className="normalize-control">
        <label>
          <input
            type="checkbox"
            checked={normalize}
            onChange={(event) =>
              setNormalize(event.target.checked)
            }
          />

          <span>Normalize Waveform</span>
        </label>
      </div>
      <div className="amplitude-control-header">
        <label htmlFor="amplitude-scale">
          Amplitude Scale
        </label>

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
      </div>

      <div className="amplitude-control-row">
        <span>0.1×</span>

        <input
          id="amplitude-scale"
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

        <span>5×</span>

        <button
          type="button"
          onClick={() => setAmplitudeScale(1)}
        >
          Reset
        </button>
      </div>
    </div>
  );
}

export default AmplitudeControl;