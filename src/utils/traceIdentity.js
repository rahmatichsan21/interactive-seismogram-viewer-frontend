export function attachTraceIdentity(
  traces,
  station,
  network = "IA"
) {
  return traces.map((trace) => {
    return {
      ...trace,

      network:
        trace.network || network,

      station:
        trace.station || station,

      traceId: [
        trace.network || network,
        trace.station || station,
        trace.location || "--",
        trace.channel,
        trace.segment_index ?? 0,
      ].join("."),
    };
  });
}

export function getTraceDisplayLabel(
  traceId
) {
  return traceId.replace(/\.\\d+$/, "");
}