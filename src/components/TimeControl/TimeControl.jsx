function TimeControl({
  startTime,
  setStartTime,
  timeMode,
  setTimeMode,
  duration,
  setDuration,
  endTime,
  setEndTime,
}) {
  return (
    <div className="time-control">
      <div className="time-field time-start">
        <label>Start Date</label>

        <input
          type="datetime-local"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
        />
      </div>

      <div className="time-field">
        <label>Time Range</label>

        <select
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
            value={duration}
            onChange={(e) =>
              setDuration(Number(e.target.value))
            }
          />
        </div>
      ) : (
        <div className="time-field">
          <label>End Date</label>

          <input
            type="datetime-local"
            value={endTime}
            min={startTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}

export default TimeControl;