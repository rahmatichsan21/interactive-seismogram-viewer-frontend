import axios from "axios";

export async function getHealth() {
  const response = await axios.get("http://127.0.0.1:8000/health");
  return response.data;
}