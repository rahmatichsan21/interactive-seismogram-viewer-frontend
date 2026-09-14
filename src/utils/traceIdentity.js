export function attachTraceIdentity(traces, station, network = "IA") {
  return traces.map((trace) => {
    console.log(
      "[TRACE IDENTITY DEBUG]",
      trace.station,
      trace.channel,
      trace.segment_index
    );

    return {
      ...trace,

      network: trace.network || network,
      station: trace.station || station,

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