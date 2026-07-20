import { useState } from "react";
import Plot from "react-plotly.js";

function WaveformPlot({
  waveformData,
  activeTraces,
  amplitudeScale = 1,
  normalize = false,
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

  const normalizationFactor = waveformData.traces.reduce(
    (max, trace) => {
      for (const value of trace.amplitude) {
        max = Math.max(max, Math.abs(value));
      }
      return max;
    },
    0
  );

  return (
    <div className="waveform-list">
      {visibleTraces.map((trace, index) => {
        const traceId = getTraceId(trace);
        const startTime = trace.time[0];
        const endTime = trace.time[trace.time.length - 1];
        
        let displayAmplitude = trace.amplitude;
        
        if (normalize && normalizationFactor > 0) {
          displayAmplitude = trace.amplitude.map(
            (value) => value / normalizationFactor
          );
        }

        // Cari minimum dan maximum amplitude
        // Menggunakan loop agar aman untuk waveform besar
        let minAmplitude = Infinity;
        let maxAmplitude = -Infinity;

        for (const value of displayAmplitude) {
          if (value < minAmplitude) {
            minAmplitude = value;
          }

          if (value > maxAmplitude) {
            maxAmplitude = value;
          }
        }

        let yAxisRange;
        if (normalize) {
          const normalizedHalfRange = 1 / amplitudeScale;

          yAxisRange = [
            -normalizedHalfRange,
            normalizedHalfRange ,
          ];
        } else {
          const centerAmplitude =
            (minAmplitude + maxAmplitude) / 2;

          const originalHalfRange =
            (maxAmplitude - minAmplitude) / 2 || 1;

          const scaledHalfRange =
            originalHalfRange / amplitudeScale;

          yAxisRange = [
            centerAmplitude - scaledHalfRange ,
            centerAmplitude + scaledHalfRange ,
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
                        data={[
                            {
                                x: trace.time,
                                y: displayAmplitude,
                                type: "scatter",
                                mode: "lines",
                                name: traceId,

                                line: {
                                    width: 1,
                                },

                                hovertemplate:
                                    `<b>${traceId}</b><br>` +
                                    "Time: %{x}<br>" +
                                    "Amplitude: %{y}<extra></extra>",
                            },
                        ]}

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