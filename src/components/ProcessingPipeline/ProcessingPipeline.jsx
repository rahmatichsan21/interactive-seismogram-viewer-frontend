import "./ProcessingPipeline.css";

function getDateTimeParts(dateTime) {
  const [date = "", time = "00:00"] =
    dateTime.split("T");

  const [hour = "00", minute = "00"] =
    time.split(":");

  return {
    date,
    hour,
    minute,
  };
}

function createDateTime(date, hour, minute) {
  return `${date}T${hour}:${minute}`;
}

function shiftMinutes(dateTime, minutes) {
  const date = new Date(`${dateTime}:00Z`);

  date.setUTCMinutes(
    date.getUTCMinutes() + minutes
  );

  return date.toISOString().slice(0, 16);
}

function getAllowedHours(date, minDateTime, maxDateTime) {
  return Array.from({ length: 24 }, (_, hour) =>
    String(hour).padStart(2, "0")
  ).filter((hour) => {
    const hourStart = `${date}T${hour}:00`;
    const hourEnd = `${date}T${hour}:59`;

    return (
      hourEnd >= minDateTime &&
      hourStart <= maxDateTime
    );
  });
}

function getAllowedMinutes(
  date,
  hour,
  minDateTime,
  maxDateTime
) {
  return Array.from({ length: 60 }, (_, minute) =>
    String(minute).padStart(2, "0")
  ).filter((minute) => {
    const candidate = `${date}T${hour}:${minute}`;

    return (
      candidate >= minDateTime &&
      candidate <= maxDateTime
    );
  });
}

function clampDateTime(
  dateTime,
  minDateTime,
  maxDateTime
) {
  if (dateTime < minDateTime) {
    return minDateTime;
  }

  if (dateTime > maxDateTime) {
    return maxDateTime;
  }

  return dateTime;
}

function DateTimeControls({
  label,
  value,
  minDateTime,
  maxDateTime,
  disabled,
  onChange,
}) {  
  const { date, hour, minute } =
    getDateTimeParts(value);

  const minDate =
    getDateTimeParts(minDateTime).date;

  const maxDate =
    getDateTimeParts(maxDateTime).date;

  const allowedHours = getAllowedHours(
    date,
    minDateTime,
    maxDateTime
  );

  const allowedMinutes = getAllowedMinutes(
    date,
    hour,
    minDateTime,
    maxDateTime
  );

  function updateTime(nextDate, nextHour, nextMinute) {
    const rawDateTime = createDateTime(
      nextDate,
      nextHour,
      nextMinute
    );

    const nextDateTime = clampDateTime(
      rawDateTime,
      minDateTime,
      maxDateTime
    );

    if (nextDateTime === value) {
      return;
    }

    onChange(nextDateTime);


  }

  return (
    <div
      className="processing-date-time-control"
    >
      <div className="processing-date-time-label">
        <span>{label}</span>
        <span>UTC</span>
      </div>

      <div className="processing-date-time-inputs">
        <label>
          Date
          <input
            type="date"
            value={date}
            min={minDate}
            max={maxDate}
            disabled={disabled}
            onChange={(event) =>
              updateTime(
                event.target.value,
                hour,
                minute
              )
            }
          />
        </label>

        <label>
          Hour
          <select
            value={hour}
            disabled={disabled}
            onChange={(event) =>
              updateTime(
                date,
                event.target.value,
                minute
              )
            }
          >
            {allowedHours.map((allowedHour) => (
              <option
                key={allowedHour}
                value={allowedHour}
              >
                {allowedHour}
              </option>
            ))}
          </select>
        </label>

        <span className="processing-time-separator">
          :
        </span>

        <label>
          Minute
          <select
            value={minute}
            disabled={disabled}
            onChange={(event) =>
              updateTime(
                date,
                hour,
                event.target.value
              )
            }
          >
            {allowedMinutes.map((allowedMinute) => (
              <option
                key={allowedMinute}
                value={allowedMinute}
              >
                {allowedMinute}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

function ProcessingPipeline({
  operations,
  canUndo,
  canRedo,
  defaultStartTime,
  defaultEndTime,
  waveformStartTime,
  waveformEndTime,
  hasWaveform,
  isProcessing,
  addOperation,
  updateOperation,
  onUndo,
  onRedo,
  reset,
  onApply,
  onResetAppliedWaveform,
  lastHistoryAction,
}) {

  function handleAddTrim() {
    if (!defaultStartTime || !defaultEndTime) {
      return;
    }

    addOperation({
      type: "trim",
      params: {
        startTime: defaultStartTime,
        endTime: defaultEndTime,
      },
    });
  }

  function handleAddNormalize() {
    addOperation({
          type: "normalize",
          params: {},
      });
  }

  function handleAddFilter() {
    addOperation({
          type: "filter",
          params: {
              filterType: "bandpass",
              freq: 1,
              freqMin: 1,
              freqMax: 10,
          },
      });
  }
    function handleReset() {
    reset();
    onResetAppliedWaveform();
  }

  return (
    <section className="processing-pipeline">
      <div className="processing-pipeline-header">
        <div>
          <h2>Processing Pipeline</h2>
          <p>
            Build operations, then apply them to the
            loaded waveform.
          </p>
        </div>

        <div className="processing-add-buttons">
          <button
            type="button"
            className="processing-add-button"
            onClick={handleAddTrim}
            disabled={!hasWaveform || isProcessing}
          >
            Add Trim
          </button>

          <button
            type="button"
            className="processing-add-button"
            onClick={handleAddNormalize}
            disabled={!hasWaveform || isProcessing}
          >
            Add Normalize
          </button>

          <button
              type="button"
              className="processing-add-button"
              onClick={handleAddFilter}
              disabled={!hasWaveform || isProcessing}
          >
              Add Filter
          </button>
        </div>
      </div>

      {operations.length === 0 ? (
        <div className="processing-empty-state">
          No processing operation added yet.
        </div>
      ) : (
        <div className="processing-operation-list">
          {operations.map((operation, index) => {

            if (operation.type === "trim") {

                // Backend membutuhkan end > start.
                // Maka Start maksimal adalah End - 1 menit.
                const startMaxDateTime = shiftMinutes(
                    operation.params.endTime,
                    -1
                );

                // End minimal adalah Start + 1 menit.
                const endMinDateTime = shiftMinutes(
                    operation.params.startTime,
                    1
                );

                return (
                    <div
                        className="processing-operation-card"
                        key={operation.id}
                    >
                        <div className="processing-operation-title">
                            <strong>{index + 1}. Trim</strong>

                            <label className="processing-enabled-toggle">
                                <input
                                    type="checkbox"
                                    checked={operation.enabled}
                                    disabled={isProcessing}
                                    onChange={(event) =>
                                        updateOperation(operation.id, {
                                            enabled: event.target.checked,
                                        })
                                    }
                                />
                                Enabled
                            </label>
                        </div>

                        <div className="processing-trim-fields">
                            <DateTimeControls
                                label="Start time"
                                value={operation.params.startTime}
                                minDateTime={waveformStartTime}
                                maxDateTime={startMaxDateTime}
                                disabled={isProcessing}
                                onChange={(nextStartTime) =>
                                    updateOperation(operation.id, {
                                        params: {
                                            startTime: nextStartTime,
                                        },
                                    })
                                }
                            />

                            <DateTimeControls
                                label="End time"
                                value={operation.params.endTime}
                                minDateTime={endMinDateTime}
                                maxDateTime={waveformEndTime}
                                disabled={isProcessing}
                                onChange={(nextEndTime) =>
                                    updateOperation(operation.id, {
                                        params: {
                                            endTime: nextEndTime,
                                        },
                                    })
                                }
                            />
                        </div>
                    </div>
                );
            }

            if (operation.type === "normalize") {
                return (
                    <div
                        className="processing-operation-card"
                        key={operation.id}
                    >
                        <div className="processing-operation-title">
                            <strong>{index + 1}. Normalize</strong>

                            <label className="processing-enabled-toggle">
                                <input
                                    type="checkbox"
                                    checked={operation.enabled}
                                    disabled={isProcessing}
                                    onChange={(event) =>
                                        updateOperation(operation.id, {
                                            enabled: event.target.checked,
                                        })
                                    }
                                />
                                Enabled
                            </label>
                        </div>

                        <p>Normalize (Common Y-axis)</p>
                    </div>
                );
            }
            
            if (operation.type === "filter") {
              return (
                  <div
                      className="processing-operation-card"
                      key={operation.id}
                  >
                      <div className="processing-operation-title">
                          <strong>{index + 1}. Filter</strong>

                          <label className="processing-enabled-toggle">
                              <input
                                  type="checkbox"
                                  checked={operation.enabled}
                                  disabled={isProcessing}
                                  onChange={(event) =>
                                      updateOperation(operation.id, {
                                          enabled: event.target.checked,
                                      })
                                  }
                              />
                              Enabled
                          </label>
                      </div>

                      <label>
                          Filter Type

                          <select
                              value={operation.params.filterType}
                              disabled={isProcessing}
                              onChange={(event) =>
                                  updateOperation(operation.id, {
                                      params: {
                                          filterType: event.target.value,
                                      },
                                  })
                              }
                          >
                              <option value="bandpass">Bandpass</option>
                              <option value="bandstop">Bandstop</option>
                              <option value="lowpass">Lowpass</option>
                              <option value="highpass">Highpass</option>
                          </select>
                      </label>

                      {(operation.params.filterType ===
                          "bandpass" ||
                          operation.params.filterType ===
                          "bandstop") && (
                          <>
                              <label>
                                  Frequency Min

                                  <input
                                      type="number"
                                      step="0.1"
                                      value={operation.params.freqMin}
                                      disabled={isProcessing}
                                      onChange={(event) =>
                                          updateOperation(operation.id, {
                                              params: {
                                                  freqMin: Number(
                                                      event.target.value
                                                  ),
                                              },
                                          })
                                      }
                                  />
                              </label>

                              <label>
                                  Frequency Max

                                  <input
                                      type="number"
                                      step="0.1"
                                      value={operation.params.freqMax}
                                      disabled={isProcessing}
                                      onChange={(event) =>
                                          updateOperation(operation.id, {
                                              params: {
                                                  freqMax: Number(
                                                      event.target.value
                                                  ),
                                              },
                                          })
                                      }
                                  />
                              </label>
                          </>
                      )}

                      {(operation.params.filterType ===
                          "lowpass" ||
                          operation.params.filterType ===
                          "highpass") && (
                          <label>
                              Frequency

                              <input
                                  type="number"
                                  step="0.1"
                                  value={operation.params.freq}
                                  disabled={isProcessing}
                                  onChange={(event) =>
                                      updateOperation(operation.id, {
                                          params: {
                                              freq: Number(
                                                  event.target.value
                                              ),
                                          },
                                      })
                                  }
                              />
                          </label>
                      )}
                  </div>
              );
            }
            return null;
        })}
        </div>
      )}

      <div className="processing-action-bar">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo || isProcessing}
          className={
            lastHistoryAction === "undo"
              ? "processing-history-button is-last-action"
              : "processing-history-button"
          }
        >
          Undo
        </button>

        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo || isProcessing}
          className={
            lastHistoryAction === "redo"
              ? "processing-history-button is-last-action"
              : "processing-history-button"
          }
        >
          Redo
        </button>

        <button
          type="button"
          onClick={handleReset}
          disabled={!hasWaveform || isProcessing}
          className="processing-history-button"
        >
          Reset
        </button>

        <button
          type="button"
          className="processing-apply-button"
          onClick={onApply}
          disabled={
            !hasWaveform ||
            isProcessing
          }
        >
          {isProcessing ? "Applying..." : "Apply"}
        </button>
      </div>
    </section>
  );
}

export default ProcessingPipeline;