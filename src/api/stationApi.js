import axios from "axios";

const API_URL = "http://127.0.0.1:8000";

export async function getStations() {
  const response = await axios.get(`${API_URL}/api/stations`);
  return response.data;
}

export async function getNetworks() {
  const stations = await getStations();

  return [...new Set(stations.map((s) => s.net))];
}

export async function getStationsByNetwork(network) {
  const stations = await getStations();

  return stations.filter(
    (station) => station.net === network
  );
}