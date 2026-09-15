import { useEffect, useState } from "react";
import { addMinutesToDateTimeLocal } from "../../utils/dateTime";

function TimeControl({
  startTime,
  setStartTime,
  timeMode,
  setTimeMode,
  duration,
  setDuration,
  endTime,
  setEndTime,
  disabled,
}) {
  const [durationInput, setDurationInput] = useState(
    String(duration)
  );

  useEffect(() => {
    setDurationInput(String(duration));
  }, [duration]);

  function applyDurationInput() {
    const value = Number(durationInput);

    if (!Number.isFinite(value)) {
      setDurationInput(String(duration));
      return;
    }

    const clampedValue = Math.max(1, value);

    setDuration(clampedValue);
    setDurationInput(String(clampedValue));
  }

  function handleStartTimeChange(nextStartTime) {
    setStartTime(nextStartTime);
    setEndTime(
      addMinutesToDateTimeLocal(nextStartTime, 1)
    );
  }

  return (
    <div className="time-control">
      <div className="time-field time-start">
        <label>Start Date</label>

        <input
          type="datetime-local"
          value={startTime}
          disabled={disabled}
          onChange={(e) =>
            handleStartTimeChange(e.target.value)
          }
        />
      </div>

      <div className="time-field">
        <label>Time Range</label>

        <select
          disabled={disabled}
          value={timeMode}
          onChange={(e) => setTimeMode(e.target.value)}
        >
          <option value="duration">Duration</option>
          <option value="endDate">End Date</option>
        </select>
      </div>

      {timeMode === "duration" ? (
        <div className="time-field">
          <label>Duration (Minutes)</label>

          <input
            type="number"
            min="1"
            value={durationInput}
            disabled={disabled}
            onChange={(e) =>
              setDurationInput(e.target.value)
            }
            onBlur={applyDurationInput}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                applyDurationInput();
                event.currentTarget.blur();
              }
            }}
          />
        </div>
      ) : (
        <div className="time-field">
          <label>End Date</label>

          <input
            type="datetime-local"
            value={endTime}
            min={startTime}
            disabled={disabled}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}

export default TimeControl;
