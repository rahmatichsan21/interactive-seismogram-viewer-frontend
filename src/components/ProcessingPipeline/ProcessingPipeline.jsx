import { useEffect, useRef, useState } from "react";

import "./ProcessingPipeline.css";

import NumberField from "../NumberField/NumberField";

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

function OperationTitle({
  index,
  name,
  isExpanded,
  isProcessing,
  enabled,
  onToggleEnabled,
  onToggleExpanded,
  onRemove,
}) {
  return (
    <div
      className="processing-operation-title"
      onClick={onToggleExpanded}
    >
      <span className="processing-operation-chevron">
        {isExpanded ? "\u25BE" : "\u25B8"}
      </span>

      <strong>
        {index + 1}. {name}
      </strong>

      <label
        className="processing-enabled-toggle"
        onClick={(event) => event.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={enabled}
          disabled={isProcessing}
          onChange={(event) =>
            onToggleEnabled(event.target.checked)
          }
        />
        Enabled
      </label>

      <button
        type="button"
        className="processing-remove-button"
        title="Remove operation"
        disabled={isProcessing}
        onClick={(event) => {
          event.stopPropagation();
          onRemove();
        }}
      >
        {"\u2715"}
      </button>
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
  isFiltered = false,
  addOperation,
  updateOperation,
  removeOperation,
  onUndo,
  onRedo,
  reset,
  onApply,
  onResetAppliedWaveform,
  lastHistoryAction,
}) {
  // State UI murni (collapse/expand) — TIDAK menyentuh
  // state/logic operation di useOperationStack.
  const [expandedIds, setExpandedIds] = useState(new Set());

  // Auto-expand operation yang BARU ditambahkan (bukan saat
  // undo/redo/commit). Dibandingkan terhadap id sebelumnya.
  const prevIdsRef = useRef([]);

  useEffect(() => {
    const currentIds = operations.map((operation) => operation.id);
    const newIds = currentIds.filter(
      (id) => !prevIdsRef.current.includes(id)
    );

    if (newIds.length > 0) {
      setExpandedIds((current) => new Set([...current, ...newIds]));
    }

    prevIdsRef.current = currentIds;
  }, [operations]);

  function toggleExpanded(operationId) {
    setExpandedIds((current) => {
      const next = new Set(current);

      if (next.has(operationId)) {
        next.delete(operationId);
      } else {
        next.add(operationId);
      }

      return next;
    });
  }

  // Selalu perluas (expand) operation — dipakai saat user menekan
  // Add pada operation yang sudah ada, agar user diarahkan untuk
  // mengedit parameter operation tersebut (bukan toggle tutup).
  function expandOperation(operationId) {
    setExpandedIds((current) => {
      const next = new Set(current);
      next.add(operationId);
      return next;
    });
  }

  // Cek apakah operation dengan `type` tertentu sudah ada.
  // Trim/Filter hanya boleh muncul SATU kali di pipeline — jika
  // sudah ada, user diarahkan untuk mengedit parameter yang ada
  // (operation di-expand), bukan menambah operation kedua.
  function existingOperationByType(type) {
    return operations.find(
      (operation) => operation.type === type
    );
  }

  function handleAddTrim() {
    if (!defaultStartTime || !defaultEndTime) {
      return;
    }

    const existing = existingOperationByType("trim");

    if (existing) {
      expandOperation(existing.id);
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

  function handleAddFilter() {
    const existing = existingOperationByType("filter");

    if (existing) {
      expandOperation(existing.id);
      return;
    }

    addOperation({
          type: "filter",
          params: {
              filterType: "bandpass",
              freq: 1,
              freqMin: 1,
              freqMax: 10,

              corners: 4,
              zerophase: true,
          },
      });
  }

  function handleAddInstrumentCorrection() {
    const existing = existingOperationByType("instrument_correction");

    if (existing) {
      expandOperation(existing.id);
      return;
    }

    addOperation({
          type: "instrument_correction",
          params: {
              output: "VEL",
              // Default konservatif, aman untuk channel dengan
              // Nyquist >= 20 Hz (sampling rate >= 40 Hz).
              preFiltF1: 0.001,
              preFiltF2: 0.005,
              preFiltF3: 10,
              preFiltF4: 15,
              waterLevel: 60,
          },
      });
  }
    function handleReset() {
    reset();
    onResetAppliedWaveform();
  }

  // Validasi urutan pipeline: Instrument Correction harus SEBELUM
  // Filter. Hanya operation enabled yang dianggap step aktif.
  // Jika invalid, Apply ditolak & warning ditampilkan. User harus
  // menghapus Filter di atas correction (tombol ×) sendiri.
  const orderInvalid = (() => {
    const enabledOps = operations.filter(
      (operation) => operation.enabled
    );
    const filterIdx = enabledOps.findIndex(
      (operation) => operation.type === "filter"
    );
    const corrIdx = enabledOps.findIndex(
      (operation) => operation.type === "instrument_correction"
    );

    return (
      corrIdx !== -1 &&
      filterIdx !== -1 &&
      filterIdx < corrIdx
    );
  })();

  // Validasi pre-filter per operation correction:
  // wajib f1 < f2 < f3 < f4. Field yang memutus rantai urutan
  // ditandai merah & Apply ditolak sampai diperbaiki.
  function getPreFiltValidation(operation) {
    const f1 = Number(operation.params.preFiltF1);
    const f2 = Number(operation.params.preFiltF2);
    const f3 = Number(operation.params.preFiltF3);
    const f4 = Number(operation.params.preFiltF4);

    const ok1 =
      Number.isFinite(f1) &&
      Number.isFinite(f2) &&
      f1 < f2;
    const ok2 =
      Number.isFinite(f2) &&
      Number.isFinite(f3) &&
      f2 < f3;
    const ok3 =
      Number.isFinite(f3) &&
      Number.isFinite(f4) &&
      f3 < f4;

    return {
      valid: ok1 && ok2 && ok3,
      errorBawah: !ok1 || !ok2,
      errorAtas: !ok2 || !ok3,
    };
  }

  const anyCorrectionInvalid = operations.some(
    (operation) =>
      operation.enabled &&
      operation.type === "instrument_correction" &&
      !getPreFiltValidation(operation).valid
  );

  // Block Instrument Correction bila WAVEFORM AKTIF sudah difilter
  // (committed pipeline punya filter) — bukan hanya draft pipeline.
  // User harus Remove Filter + Apply agar waveform kembali unfiltered.
  const hasEnabledCorrection = operations.some(
    (operation) =>
      operation.enabled &&
      operation.type === "instrument_correction"
  );
  const correctionBlocked = isFiltered && hasEnabledCorrection;

  return (
    <section className="processing-pipeline">
      <div className="processing-pipeline-header">
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
            onClick={handleAddFilter}
            disabled={!hasWaveform || isProcessing}
        >
            Add Filter
        </button>

        <button
            type="button"
            className="processing-add-button"
            onClick={handleAddInstrumentCorrection}
            disabled={!hasWaveform || isProcessing}
        >
            Add Instr. Correction
        </button>
      </div>

      <div className="processing-history-bar">
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
      </div>

      {operations.length === 0 ? (
        <div className="processing-empty-state">
          No processing operation added yet.
        </div>
      ) : (
        <div className="processing-operation-list">
          {operations.map((operation, index) => {
            const isExpanded = expandedIds.has(operation.id);

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
                        <OperationTitle
                            index={index}
                            name="Trim"
                            isExpanded={isExpanded}
                            isProcessing={isProcessing}
                            enabled={operation.enabled}
                            onToggleEnabled={(checked) =>
                                updateOperation(operation.id, {
                                    enabled: checked,
                                })
                            }
                            onToggleExpanded={() =>
                                toggleExpanded(operation.id)
                            }
                            onRemove={() =>
                                removeOperation(operation.id)
                            }
                        />

                        {isExpanded && (
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
                        )}
                    </div>
                );
            }

            if (operation.type === "filter") {
              const isBandType =
                  operation.params.filterType === "bandpass"

              const isSinglePassType =
                  operation.params.filterType === "lowpass" ||
                  operation.params.filterType === "highpass";

              return (
                  <div
                      className={
                        orderInvalid
                          ? "processing-operation-card processing-card-order-warn"
                          : "processing-operation-card"
                      }
                      key={operation.id}
                  >
                      <OperationTitle
                          index={index}
                          name="Filter"
                          isExpanded={isExpanded}
                          isProcessing={isProcessing}
                          enabled={operation.enabled}
                          onToggleEnabled={(checked) =>
                              updateOperation(operation.id, {
                                  enabled: checked,
                              })
                          }
                          onToggleExpanded={() =>
                              toggleExpanded(operation.id)
                          }
                          onRemove={() =>
                              removeOperation(operation.id)
                          }
                      />

                      {isExpanded && (
                          <div className="processing-filter-fields">
                              <label className="processing-filter-type-field">
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

                                      <option value="lowpass">Lowpass</option>
                                      <option value="highpass">Highpass</option>
                                  </select>
                              </label>

                              {isBandType && (
                                  <>
                                      <label>
                                          Frequency Min

                                          <NumberField
                                              step="0.1"
                                              value={operation.params.freqMin}
                                              disabled={isProcessing}
                                              onCommit={(nextValue) =>
                                                  updateOperation(operation.id, {
                                                      params: {
                                                          freqMin: nextValue,
                                                      },
                                                  })
                                              }
                                          />
                                      </label>

                                      <label>
                                          Frequency Max

                                          <NumberField
                                              step="0.1"
                                              value={operation.params.freqMax}
                                              disabled={isProcessing}
                                              onCommit={(nextValue) =>
                                                  updateOperation(operation.id, {
                                                      params: {
                                                          freqMax: nextValue,
                                                      },
                                                  })
                                              }
                                          />
                                      </label>
                                  </>
                              )}

                              {isSinglePassType && (
                                  <label>
                                      Frequency

                                      <NumberField
                                          step="0.1"
                                          value={operation.params.freq}
                                          disabled={isProcessing}
                                          onCommit={(nextValue) =>
                                              updateOperation(operation.id, {
                                                  params: {
                                                      freq: nextValue,
                                                  },
                                              })
                                          }
                                      />
                                  </label>
                              )}

                              <label>
                                  Corners

                                  <NumberField
                                      min="1"
                                      step="1"
                                      value={operation.params.corners}
                                      disabled={isProcessing}
                                      onCommit={(nextValue) =>
                                          updateOperation(operation.id, {
                                              params: {
                                                  corners: nextValue,
                                              },
                                          })
                                      }
                                  />
                              </label>

                              <label className="processing-filter-checkbox">
                                  <input
                                      type="checkbox"
                                      checked={operation.params.zerophase}
                                      disabled={isProcessing}
                                      onChange={(event) =>
                                          updateOperation(operation.id, {
                                              params: {
                                                  zerophase: event.target.checked,
                                              },
                                          })
                                      }
                                  />

                                  Zero Phase
                              </label>
                          </div>
                      )}
                  </div>
              );
            }

            if (operation.type === "instrument_correction") {
                const pf = getPreFiltValidation(operation);
                const isDefaultWaterLevel =
                  Number(operation.params.waterLevel) === 60;

                return (
                    <div
                        className={
                          orderInvalid
                            ? "processing-operation-card processing-card-order-warn"
                            : "processing-operation-card"
                        }
                        key={operation.id}
                    >
                        <OperationTitle
                            index={index}
                            name="Instrument Correction"
                            isExpanded={isExpanded}
                            isProcessing={isProcessing}
                            enabled={operation.enabled}
                            onToggleEnabled={(checked) =>
                                updateOperation(operation.id, {
                                    enabled: checked,
                                })
                            }
                            onToggleExpanded={() =>
                                toggleExpanded(operation.id)
                            }
                            onRemove={() =>
                                removeOperation(operation.id)
                            }
                        />

                        {orderInvalid && (
                            <div className="processing-order-warning">
                                {"\u26A0"} Instrument Correction must be
                                applied before Filter. Remove the Filter
                                above before applying Instrument
                                Correction.
                            </div>
                        )}

                        {isExpanded && (
                            <div className="processing-correction-fields">
                                <label className="processing-filter-type-field">
                                    Output

                                    <select
                                        value={operation.params.output}
                                        disabled={isProcessing}
                                        onChange={(event) =>
                                            updateOperation(operation.id, {
                                                params: {
                                                    output: event.target.value,
                                                },
                                            })
                                        }
                                    >
                                        <option value="VEL">
                                            Velocity (m/s)
                                        </option>

                                        <option value="ACC">
                                            Acceleration (m/s²)
                                        </option>

                                        <option value="DISP">
                                            Displacement (m)
                                        </option>
                                    </select>
                                </label>

                                <div className="pre-filt-section">
                                    <div className="pre-filt-title">
                                        Pre-filter (Hz)

                                        <span
                                            className="info-icon"
                                            title="Membatasi rentang frekuensi yang dikoreksi, agar noise di luar rentang ini tidak diperkuat berlebihan saat instrument correction."
                                        >
                                            {"\u24D8"}
                                        </span>
                                    </div>

                                    <div className="pre-filt-groups">
                                        <div className="pre-filt-group">
                                            <div className="pre-filt-group-label">
                                                Roll-off Bawah
                                            </div>

                                            <div className="pre-filt-fields">
                                                <NumberField
                                                    step="0.001"
                                                    min="0"
                                                    className={
                                                      pf.errorBawah
                                                        ? "pre-filt-field-invalid"
                                                        : undefined
                                                    }
                                                    value={operation.params.preFiltF1}
                                                    disabled={isProcessing}
                                                    onCommit={(nextValue) =>
                                                        updateOperation(operation.id, {
                                                            params: {
                                                                preFiltF1: nextValue,
                                                            },
                                                        })
                                                    }
                                                />

                                                <NumberField
                                                    step="0.001"
                                                    min="0"
                                                    className={
                                                      pf.errorBawah
                                                        ? "pre-filt-field-invalid"
                                                        : undefined
                                                    }
                                                    value={operation.params.preFiltF2}
                                                    disabled={isProcessing}
                                                    onCommit={(nextValue) =>
                                                        updateOperation(operation.id, {
                                                            params: {
                                                                preFiltF2: nextValue,
                                                            },
                                                        })
                                                    }
                                                />
                                            </div>
                                        </div>

                                        <div className="pre-filt-group">
                                            <div className="pre-filt-group-label">
                                                Roll-off Atas
                                            </div>

                                            <div className="pre-filt-fields">
                                                <NumberField
                                                    step="0.1"
                                                    min="0"
                                                    className={
                                                      pf.errorAtas
                                                        ? "pre-filt-field-invalid"
                                                        : undefined
                                                    }
                                                    value={operation.params.preFiltF3}
                                                    disabled={isProcessing}
                                                    onCommit={(nextValue) =>
                                                        updateOperation(operation.id, {
                                                            params: {
                                                                preFiltF3: nextValue,
                                                            },
                                                        })
                                                    }
                                                />

                                                <NumberField
                                                    step="0.1"
                                                    min="0"
                                                    className={
                                                      pf.errorAtas
                                                        ? "pre-filt-field-invalid"
                                                        : undefined
                                                    }
                                                    value={operation.params.preFiltF4}
                                                    disabled={isProcessing}
                                                    onCommit={(nextValue) =>
                                                        updateOperation(operation.id, {
                                                            params: {
                                                                preFiltF4: nextValue,
                                                            },
                                                        })
                                                    }
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {!pf.valid && (
                                        <div className="pre-filt-validation-msg">
                                            Nilai pre-filter harus berurutan:
                                            frekuensi bawah {"<"} frekuensi atas
                                            (f1 {"<"} f2 {"<"} f3 {"<"} f4).
                                        </div>
                                    )}
                                </div>

                                <label className="processing-filter-type-field water-level-field">
                                    <span className="water-level-label">
                                        Water Level

                                        <span
                                            className="info-icon"
                                            title="Batas pengaman agar pembagian saat koreksi tidak menghasilkan nilai ekstrem pada frekuensi yang respons instrumennya sangat lemah."
                                        >
                                            {"\u24D8"}
                                        </span>
                                    </span>

                                    <NumberField
                                        step="1"
                                        min="0"
                                        value={operation.params.waterLevel}
                                        disabled={isProcessing}
                                        onCommit={(nextValue) =>
                                            updateOperation(operation.id, {
                                                params: {
                                                    waterLevel: nextValue,
                                                },
                                            })
                                        }
                                    />

                                    {isDefaultWaterLevel && (
                                        <span className="default-indicator">
                                            (default)
                                        </span>
                                    )}
                                </label>
                            </div>
                        )}
                    </div>
                );
            }
            return null;
        })}
        </div>
      )}

      {orderInvalid && (
        <div className="processing-order-warning">
          {"\u26A0"} Instrument Correction must be applied before
          Filter. Remove the Filter above before applying Instrument
          Correction.
        </div>
      )}

      <div className="processing-action-bar">
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
            isProcessing ||
            orderInvalid ||
            correctionBlocked ||
            anyCorrectionInvalid
          }
        >
          {isProcessing ? "Applying..." : "Apply"}
        </button>
      </div>
    </section>
  );
}

export default ProcessingPipeline;