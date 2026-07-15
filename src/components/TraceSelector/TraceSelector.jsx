function getLocation(trace) {
  if (
    trace.location === undefined ||
    trace.location === null ||
    trace.location === ""
  ) {
    return "--";
  }

  return trace.location;
}

function getChannelFamily(channel) {
  if (!channel) {
    return "Unknown";
  }

  return channel.slice(0, 2);
}

function TraceSelector({
  waveformData,
  activeTraces,
  setActiveTraces,
}) {
  if (!waveformData?.traces?.length) {
    return null;
  }

  // Station -> Location -> Family -> Traces
  const groupedTraces = {};

  waveformData.traces.forEach((trace) => {
    const station =
      trace.station || "Unknown Station";

    const location = getLocation(trace);
    const family = getChannelFamily(trace.channel);

    if (!groupedTraces[station]) {
      groupedTraces[station] = {};
    }

    if (!groupedTraces[station][location]) {
      groupedTraces[station][location] = {};
    }

    if (!groupedTraces[station][location][family]) {
      groupedTraces[station][location][family] = [];
    }

    groupedTraces[station][location][family].push(
      trace
    );
  });

  function handleToggle(traceId) {
    setActiveTraces((current) => {
      if (current.includes(traceId)) {
        return current.filter(
          (id) => id !== traceId
        );
      }

      return [...current, traceId];
    });
  }

  function getFamilyTraceIds(traces) {
    return traces.map((trace) => trace.traceId);
  }

  function getFamilySelectionState(traces) {
    const familyTraceIds = getFamilyTraceIds(traces);

    const selectedCount = familyTraceIds.filter(
      (traceId) => activeTraces.includes(traceId)
    ).length;

    return {
      allSelected:
        selectedCount === familyTraceIds.length &&
        familyTraceIds.length > 0,

      someSelected:
        selectedCount > 0 &&
        selectedCount < familyTraceIds.length,
    };
  }

  function toggleFamily(traces) {
    const familyTraceIds = getFamilyTraceIds(traces);

    const allSelected = familyTraceIds.every(
      (traceId) => activeTraces.includes(traceId)
    );

    if (allSelected) {
      // Semua sedang aktif → matikan semua dalam family
      setActiveTraces((currentActiveTraces) =>
        currentActiveTraces.filter(
          (traceId) =>
            !familyTraceIds.includes(traceId)
        )
      );
    } else {
      // Ada yang mati → aktifkan semua dalam family
      setActiveTraces((currentActiveTraces) => [
        ...new Set([
          ...currentActiveTraces,
          ...familyTraceIds,
        ]),
      ]);
    }
  }

  return (
    <div>
      <h3>Waveform Traces</h3>

      <div className="trace-station-groups">
        {Object.entries(groupedTraces).map(
          ([station, locations]) => (
            <div
              key={station}
              className="trace-station-group"
            >
              <div className="trace-station-title">
                {station}
              </div>

              {Object.entries(locations).map(
                ([location, families]) => (
                  <div
                    key={location}
                    className="trace-location-group"
                  >
                    <div className="trace-location-title">
                      Location: {location}
                    </div>

                    <div className="trace-family-container">
                      {Object.entries(families).map(
                        ([family, traces]) => (
                          <div
                            key={family}
                            className="trace-family-group"
                          >
                            <div className="channel-family-title">
                              {(() => {
                                const {
                                  allSelected,
                                  someSelected,
                                } = getFamilySelectionState(traces);

                                return (
                                  <label className="family-checkbox-label">
                                    <input
                                      type="checkbox"
                                      checked={allSelected}
                                      ref={(element) => {
                                        if (element) {
                                          element.indeterminate =
                                            someSelected;
                                        }
                                      }}
                                      onChange={() =>
                                        toggleFamily(traces)
                                      }
                                    />

                                    <span>{family}</span>
                                  </label>
                                );
                              })()}
                            </div>

                            <div className="trace-list">
                              {traces.map((trace) => (
                                <label
                                  key={trace.traceId}
                                  className="trace-item"
                                >
                                  <input
                                    type="checkbox"
                                    checked={activeTraces.includes(
                                      trace.traceId
                                    )}
                                    onChange={() =>
                                      handleToggle(
                                        trace.traceId
                                      )
                                    }
                                  />

                                  <span>
                                    {trace.channel}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default TraceSelector;