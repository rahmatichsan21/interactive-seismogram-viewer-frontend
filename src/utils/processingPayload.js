function toBackendOperation(operation) {
  switch (operation.type) {
    case "trim":
      return {
        type: "trim",
        start_time: operation.params.startTime,
        end_time: operation.params.endTime,
      };

    case "filter":
    return {
        type: "filter",
        filter_type:
            operation.params.filterType,
        freq: operation.params.freq,
        freqmin: operation.params.freqMin,
        freqmax: operation.params.freqMax,
    };
    
    default:
      throw new Error(
        `Unsupported processing operation: ${operation.type}`
      );
  }
}

export function toProcessPayload(request, operations) {
  return {
    network: request.network,
    station: request.station,
    location: request.location,
    channel: request.channel,
    start_time: request.startTime,
    end_time: request.endTime,
    operations: operations
      .filter(
        (operation) =>
          operation.enabled &&
          operation.type !== "normalize"
      )
      .map((operation) => {
        if (operation.type === "trim") {
          validateTrimOperation(operation, request);
        }

        return toBackendOperation(operation);
      }),
  };
}

function validateTrimOperation(operation, request) {
  const { startTime, endTime } = operation.params;

  if (startTime > endTime) {
    throw new Error(
      "Trim start time must be before trim end time."
    );
  }

  if (
    startTime < request.startTime ||
    endTime > request.endTime
  ) {
    throw new Error(
      "Trim range must stay within the loaded waveform window."
    );
  }
}