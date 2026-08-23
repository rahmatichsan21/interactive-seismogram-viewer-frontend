import Plot from "react-plotly.js";

function WaveformPlot({
  waveformData,
  activeTraces,
  amplitudeScale = 1,
  normalizeEnabled = false,
  globalScale = null,
}) {
  if (!waveformData) {
    return <div>No waveform loaded.</div>;
  }

  if (
    !waveformData.traces ||
    waveformData.traces.length === 0
  ) {
    return <div>No waveform traces available.</div>;
  }

  function getTraceId(trace) {
    return trace.traceId;
  }

  function getComponentName(channel) {
    const component = channel.slice(-1);

    if (component === "Z") return "Vertical";
    if (component === "N") return "North-South";
    if (component === "E") return "East-West";

    return "Component";
  }

  const visibleTraces = waveformData.traces.filter(
    (trace) =>
      activeTraces.includes(getTraceId(trace))
  );

  return (
    <div className="waveform-list">
      {visibleTraces.map((trace, index) => {
        const traceId = getTraceId(trace);
        const startTime = trace.time[0];
        const endTime = trace.time[trace.time.length - 1];

        const amplitude = trace.amplitude ?? [];

        let minAmplitude = Infinity;
        let maxAmplitude = -Infinity;

        for (const value of amplitude) {
          if (value < minAmplitude) {
            minAmplitude = value;
          }

          if (value > maxAmplitude) {
            maxAmplitude = value;
          }
        }

        const hovertemplate = `<b>${traceId}</b><br>` +
          "Time: %{x}<br>Amplitude: %{y}<extra></extra>";

        const plotData = [
          {
            x: trace.time,
            y: trace.amplitude,
            type: "scatter",
            mode: "lines",
            name: traceId,
            line: { width: 1 },
            hovertemplate,
          },
        ];

        let yAxisRange;

        if (normalizeEnabled && globalScale) {

          const centerAmplitude =
            (globalScale.min + globalScale.max) / 2;

          const originalHalfRange =
            (globalScale.max - globalScale.min) / 2 || 1;

          const scaledHalfRange =
            originalHalfRange / amplitudeScale;

          yAxisRange = [
            centerAmplitude - scaledHalfRange,
            centerAmplitude + scaledHalfRange,
          ];

        } else {

          const centerAmplitude =
            (minAmplitude + maxAmplitude) / 2;

          const originalHalfRange =
            (maxAmplitude - minAmplitude) / 2 || 1;

          const scaledHalfRange =
            originalHalfRange / amplitudeScale;

          yAxisRange = [
            centerAmplitude - scaledHalfRange,
            centerAmplitude + scaledHalfRange,
          ];

        }

        return (
          <div
            className="waveform-trace-card"
            key={`${traceId}-${index}`}
          >
            <div className="waveform-trace-header">
              <div>
                <span className="waveform-trace-id">
                  {traceId}
                </span>

                <span className="waveform-trace-component">
                  {getComponentName(trace.channel)}
                </span>
              </div>

              <span className="waveform-trace-station">
                Station {trace.station}
              </span>
            </div>

            <div
                style={{
                    display: "flex",
                    alignItems: "stretch",
                    gap: "10px",
                    padding: "12px",
                }}
            >
                <div style={{ flex: 1 }}>
                    <Plot
                        data={plotData}

                        layout={{
                            height: 280,

                            margin: {
                                l: 70,
                                r: 30,
                                t: 20,
                                b: 55,
                            },

                            showlegend: false,

                            dragmode: "pan",

                            uirevision: traceId,

                            xaxis: {
                                title: "Time (UTC)",

                                fixedrange: false,

                                range: [
                                    startTime,
                                    endTime,
                                ],

                                minallowed: startTime,
                                maxallowed: endTime,

                                gridcolor: "#edf0f3",
                            },

                            yaxis: {
                                title: "Amplitude",

                                range: yAxisRange,

                                autorange: false,

                                fixedrange: true,

                                gridcolor: "#edf0f3",

                                automargin: true,
                            },

                            paper_bgcolor: "#ffffff",
                            plot_bgcolor: "#ffffff",
                        }}

                        config={{
                            responsive: true,

                            scrollZoom: true,

                            doubleClick: "reset",

                            displaylogo: false,

                            modeBarButtonsToRemove: [
                                "select2d",
                                "lasso2d",
                                "autoScale2d",
                                "toggleSpikelines",
                                "hoverClosestCartesian",
                                "hoverCompareCartesian",
                            ],

                            showLink: false,
                        }}

                        style={{
                            width: "100%",
                        }}

                        useResizeHandler
                    />
                </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default WaveformPlot;