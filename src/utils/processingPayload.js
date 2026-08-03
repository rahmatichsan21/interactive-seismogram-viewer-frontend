function toBackendOperation(operation) {
  switch (operation.type) {
    case "trim":
      return {
        type: "trim",
        start_time: operation.params.startTime,
        end_time: operation.params.endTime,
      };

    case "filter":
      // Konversi ke Number() sengaja dilakukan di sini, tepat
      // sebelum payload dikirim ke backend, sebagai jaring
      // pengaman terakhir. Selama diedit di UI, nilai-nilai ini
      // disimpan sebagai teks mentah lewat NumberField supaya
      // field boleh kosong / tidak dipaksa jadi 0.
      return {
          type: "filter",
          filter_type: operation.params.filterType,

          freq: Number(operation.params.freq),
          freqmin: Number(operation.params.freqMin),
          freqmax: Number(operation.params.freqMax),

          corners: Number(operation.params.corners),
          zerophase: operation.params.zerophase,
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