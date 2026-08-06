import Plot from "react-plotly.js";

// Kembalikan batas bawah/atas amplitudo SATU trace. Trace yang
// di-decimate (Time Bucket min/max) tidak punya field `amplitude`
// penuh - hanya `amplitude_min`/`amplitude_max` per bucket.
function getAmplitudeEnvelope(trace) {
  if (trace.decimated) {
    return {
      min: trace.amplitude_min ?? [],
      max: trace.amplitude_max ?? [],
    };
  }

  const amplitude = trace.amplitude ?? [];

  return {
    min: amplitude,
    max: amplitude,
  };
}

function WaveformPlot({
  waveformData,
  activeTraces,
  amplitudeScale = 1,
  normalizeEnabled = false,
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

  const commonScale = (() => {
    if (!normalizeEnabled || visibleTraces.length === 0) {
      return null;
    }

    let globalMin = Infinity;
    let globalMax = -Infinity;

    visibleTraces.forEach((trace) => {
      const { min, max } = getAmplitudeEnvelope(trace);

      if (min.length === 0 && max.length === 0) {
        return;
      }

      for (const value of min) {
        if (value < globalMin) {
          globalMin = value;
        }
      }

      for (const value of max) {
        if (value > globalMax) {
          globalMax = value;
        }
      }
    });

    if (
      globalMin === Infinity ||
      globalMax === -Infinity
    ) {
      return null;
    }

    return {
      min: globalMin,
      max: globalMax,
    };
  })();

  return (
    <div className="waveform-list">
      {visibleTraces.map((trace, index) => {
        const traceId = getTraceId(trace);
        const startTime = trace.time[0];
        const endTime = trace.time[trace.time.length - 1];

        // Cari minimum dan maximum amplitude dari envelope
        // (amplitude penuh, atau min/max bucket untuk trace yang
        // di-decimate). Menggunakan loop agar aman untuk
        // waveform besar.
        const { min, max } = getAmplitudeEnvelope(trace);

        let minAmplitude = Infinity;
        let maxAmplitude = -Infinity;

        for (const value of min) {
          if (value < minAmplitude) {
            minAmplitude = value;
          }
        }

        for (const value of max) {
          if (value > maxAmplitude) {
            maxAmplitude = value;
          }
        }

        const hovertemplate = `<b>${traceId}</b><br>` +
          "Time: %{x}<br>Amplitude: %{y}<extra></extra>";

        // Trace yang di-decimate dirender sebagai pita min/max:
        // garis `amplitude_min` dulu, lalu `amplitude_max` di
        // atasnya dengan fill: 'tonexty' (mengisi ke trace
        // sebelumnya) sehingga selang antara min dan max tampak
        // sebagai area terbayang.
        const plotData = trace.decimated
          ? [
              {
                x: trace.time,
                y: trace.amplitude_min,
                type: "scatter",
                mode: "lines",
                name: traceId,
                line: { width: 1 },
                hovertemplate,
              },
              {
                x: trace.time,
                y: trace.amplitude_max,
                type: "scatter",
                mode: "lines",
                name: traceId,
                fill: "tonexty",
                fillcolor: "rgba(31,119,180,0.15)",
                line: { width: 1 },
                hovertemplate,
              },
            ]
          : [
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

        if (normalizeEnabled && commonScale) {

          const centerAmplitude =
            (commonScale.min + commonScale.max) / 2;

          const originalHalfRange =
            (commonScale.max - commonScale.min) / 2 || 1;

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