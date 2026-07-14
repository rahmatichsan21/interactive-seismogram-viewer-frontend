import axios from "axios";

const API_URL = "http://127.0.0.1:8000";

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
}) {
  let finalEndTime;

  if (timeMode === "duration") {
    const startDate = new Date(startTime);

    startDate.setMinutes(
      startDate.getMinutes() + Number(duration)
    );

    const pad = (value) =>
      String(value).padStart(2, "0");

    finalEndTime =
      `${startDate.getFullYear()}-` +
      `${pad(startDate.getMonth() + 1)}-` +
      `${pad(startDate.getDate())}T` +
      `${pad(startDate.getHours())}:` +
      `${pad(startDate.getMinutes())}`;
  } else {
    finalEndTime = endTime;
  }

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