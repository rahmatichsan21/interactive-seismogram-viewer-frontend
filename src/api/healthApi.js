import axios from "axios";
import API_URL from "./apiConfig";

export async function getHealth() {
  const response = await axios.get(
    `${API_URL}/health`
  );

  return response.data;
}