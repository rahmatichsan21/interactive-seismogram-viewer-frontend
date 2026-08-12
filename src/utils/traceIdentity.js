export function attachTraceIdentity(traces, station, network = "IA") {
  return traces.map((trace) => ({
    ...trace,
    network: trace.network || network,
    station: trace.station || station,
    traceId: [
      trace.network || network,
      trace.station || station,
      trace.location || "--",
      trace.channel,
    ].join("."),
  }));
}
