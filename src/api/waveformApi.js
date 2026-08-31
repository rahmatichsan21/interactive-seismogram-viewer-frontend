import axios from "axios";

const API_URL = "http://127.0.0.1:8000";

// Time Bucket decimation target: jumlah bucket untuk
// temporal-order min/max. Setiap bucket menghasilkan hingga
// 2 titik output (argmin + argmax), sehingga total output
// ≈ 2 × MAX_POINTS titik. Dikirim untuk GET /api/waveform
// dan POST /process — backend menerapkannya hanya sebagai
// langkah PALING AKHIR setelah pemrosesan.
// MAX_DISPLAY_POINTS = 150000 → MAX_POINTS = 150000 // 2.
export const MAX_POINTS = 75000;

export async function getChannels({
  network,
  station,
  startTime,
  endTime,
}) {
  const response = await axios.get(
    `${API_URL}/api/channels`,
    {
      params: {
        network,
        station,
        start_time: startTime,
        end_time: endTime,
      },
    }
  );

  return response.data.channels;
}

export async function getWaveform({
  network,
  station,
  channel,
  location,
  startTime,
  timeMode,
  duration,
  endTime,
  maxPoints = MAX_POINTS,
}) {
  const finalEndTime = resolveEndTime(
    startTime,
    timeMode,
    duration,
    endTime
  );

  try {
    const response = await axios.get(
      `${API_URL}/api/waveform`,
      {
        params: {
          network,
          station,
          location,
          channel,
          start_time: startTime,
          end_time: finalEndTime,
          ...(maxPoints != null && { max_points: maxPoints }),
        },
      }
    );

    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.detail ||
      error.response?.data?.message ||
      "Failed to load waveform.";

    const waveformError = new Error(message);

    waveformError.status =
      error.response?.status;

    throw waveformError;
  }
}

export async function checkWaveformCache({
  network,
  station,
  channel,
  location,
  startTime,
  timeMode,
  duration,
  endTime,
}) {
  const finalEndTime = resolveEndTime(
    startTime,
    timeMode,
    duration,
    endTime
  );

  const response = await axios.get(
    `${API_URL}/api/waveform/status`,
    {
      params: {
        network,
        station,
        location,
        channel,
        start_time: startTime,
        end_time: finalEndTime,
      },
    }
  );

  return response.data;
}

export async function downloadWaveform({
  network,
  station,
  channel,
  location,
  startTime,
  timeMode,
  duration,
  endTime,
}) {
  const finalEndTime = resolveEndTime(
    startTime,
    timeMode,
    duration,
    endTime
  );

  try {
    const response = await axios.post(
      `${API_URL}/api/waveform/download`,
      null,
      {
        params: {
          network,
          station,
          location,
          channel,
          start_time: startTime,
          end_time: finalEndTime,
        },
      }
    );

    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.detail ||
      error.response?.data?.message ||
      "Failed to download waveform.";

    const downloadError = new Error(message);

    downloadError.status = error.response?.status;

    throw downloadError;
  }
}

function resolveEndTime(startTime, timeMode, duration, endTime) {
  if (timeMode === "duration") {
    const startDate = new Date(startTime);

    startDate.setMinutes(
      startDate.getMinutes() + Number(duration)
    );

    const pad = (value) =>
      String(value).padStart(2, "0");

    return (
      `${startDate.getFullYear()}-` +
      `${pad(startDate.getMonth() + 1)}-` +
      `${pad(startDate.getDate())}T` +
      `${pad(startDate.getHours())}:` +
      `${pad(startDate.getMinutes())}`
    );
  }

  return endTime;
}

export async function postProcess(payload) {
  try {
    const response = await axios.post(
      `${API_URL}/process`,
      {
        ...payload,
        max_points: payload.max_points ?? MAX_POINTS,
      }
    );

    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.detail ||
      error.response?.data?.message ||
      "Failed to process waveform.";

    const processingError = new Error(message);

    processingError.status = error.response?.status;

    throw processingError;
  }
}

export async function getSpectrogram(params) {
  const response = await axios.get(
    `${API_URL}/api/spectrogram`,
    { params }
  );
  return response.data;
}

export async function getPSD(params) {
  const response = await axios.get(
    `${API_URL}/api/psd`,
    { params }
  );
  return response.data;
}

export async function downloadMiniSeed(payload) {
  const response = await axios.post(
    `${API_URL}/api/download/miniseed`,
    payload,
    { responseType: "blob" }
  );

  const contentDisposition = response.headers["content-disposition"];
  const filenameMatch = contentDisposition?.match(
    /filename="?([^";]+)"?/i
  );
  const filename = filenameMatch?.[1] || "waveform.mseed";
  const url = URL.createObjectURL(response.data);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
