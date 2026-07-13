import { useEffect, useState } from "react";
import { getStationsByNetwork } from "../../api/stationApi";

function StationSelector({
  selectedNetwork,
  selectedStations,
  setSelectedStations,
}) {
  const [stations, setStations] = useState([]);

  useEffect(() => {
    async function loadStations() {
      const data = await getStationsByNetwork(selectedNetwork);
      setStations(data);
    }

    loadStations();
  }, [selectedNetwork]);

  function handleChange(event) {
    setSelectedStations([event.target.value]);
  }

  return (
    <div>
      <label>Station</label>

      <br />

      <select
        value={selectedStations[0] || ""}
        onChange={handleChange}
      >
        <option value="">-- Select Station --</option>

        {stations.map((station) => (
          <option
            key={station.kode_stasiun}
            value={station.kode_stasiun}
          >
            {station.kode_stasiun}
          </option>
        ))}
      </select>
    </div>
  );
}

export default StationSelector;