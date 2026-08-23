import "./TraceSelectorMatrix.css";

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

function TraceSelectorMatrix({
  traces,
  selectedTraceIds,
  onSelectionChange,
}) {
  if (!traces || traces.length === 0) {
    return null;
  }

  const selectedSet = new Set(selectedTraceIds);

  const stations = [
    ...new Set(
      traces.map((trace) => trace.station || "Unknown Station")
    ),
  ].sort();

  const channels = [
    ...new Set(traces.map((trace) => trace.channel)),
  ].sort();

  const allTraceIds = traces.map((trace) => trace.traceId);

  function selectionState(ids) {
    let count = 0;

    for (const id of ids) {
      if (selectedSet.has(id)) {
        count += 1;
      }
    }

    return {
      all: count === ids.length && ids.length > 0,
      some: count > 0 && count < ids.length,
    };
  }

  function toggleIds(ids, allSelected) {
    const next = new Set(selectedTraceIds);

    if (allSelected) {
      ids.forEach((id) => next.delete(id));
    } else {
      ids.forEach((id) => next.add(id));
    }

    onSelectionChange([...next]);
  }

  function renderCheckbox(ids, label, title) {
    const { all, some } = selectionState(ids);

    return (
      <label className="trace-matrix-checkbox" title={title}>
        <input
          type="checkbox"
          checked={all}
          ref={(element) => {
            if (element) {
              element.indeterminate = some;
            }
          }}
          onChange={() => toggleIds(ids, all)}
        />
        <span>{label}</span>
      </label>
    );
  }

  const master = selectionState(allTraceIds);

  const columns = [
    <div className="trace-matrix-cell trace-matrix-master" key="__master__">
      <input
        type="checkbox"
        checked={master.all}
        ref={(element) => {
          if (element) {
            element.indeterminate = master.some;
          }
        }}
        onChange={() => toggleIds(allTraceIds, master.all)}
        title="Select all / none"
      />
    </div>,
    ...channels.map((channel) => (
      <div className="trace-matrix-cell trace-matrix-col-header" key={`col-${channel}`}>
        {renderCheckbox(
          traces
            .filter((trace) => trace.channel === channel)
            .map((trace) => trace.traceId),
          channel
        )}
      </div>
    )),
  ];

  stations.forEach((station) => {
    const stationTraces = traces.filter(
      (trace) => (trace.station || "Unknown Station") === station
    );

    columns.push(
      <div className="trace-matrix-cell trace-matrix-row-header" key={`row-${station}`}>
        {renderCheckbox(
          stationTraces.map((trace) => trace.traceId),
          station
        )}
      </div>
    );

    channels.forEach((channel) => {
      const cellTraces = stationTraces.filter(
        (trace) => trace.channel === channel
      );

      columns.push(
        <div className="trace-matrix-cell" key={`cell-${station}-${channel}`}>
          {cellTraces.map((trace) =>
            renderCheckbox(
              [trace.traceId],
              getLocation(trace) === "--"
                ? trace.channel
                : `${trace.channel} ${getLocation(trace)}`,
              trace.traceId
            )
          )}
        </div>
      );
    });
  });

  return (
    <div className="trace-matrix">
      <div
        className="trace-matrix-grid"
        style={{
          gridTemplateColumns: `minmax(90px, auto) repeat(${channels.length}, minmax(72px, 1fr))`,
        }}
      >
        {columns}
      </div>
    </div>
  );
}

export default TraceSelectorMatrix;