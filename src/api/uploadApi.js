import axios from "axios";

const API_URL = "http://127.0.0.1:8000";

export async function uploadMiniSeed(file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await axios.post(
    `${API_URL}/api/upload/miniseed`,
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
    }
  );

  return response.data;
}

export async function uploadStationXML(file, sessionId) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("session_id", sessionId);

  const response = await axios.post(
    `${API_URL}/api/upload/stationxml`,
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
    }
  );

  return response.data;
}

export async function validateStationXML(sessionId) {
  const response = await axios.get(
    `${API_URL}/api/upload/stationxml/${sessionId}/validation`
  );

  return response.data;
}

export async function deleteUploadSession(sessionId) {
  await axios.delete(`${API_URL}/api/upload/${sessionId}`);
}

export async function getUploadWaveform(sessionId, maxPoints) {
  const params = maxPoints != null ? { max_points: maxPoints } : {};
  const response = await axios.get(
    `${API_URL}/api/upload/${sessionId}/waveform`,
    { params }
  );
  return response.data;
}
