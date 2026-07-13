import { useEffect, useState } from "react";
import { getNetworks } from "../../api/stationApi";

function NetworkSelector({ selectedNetwork, setSelectedNetwork }) {
  const [networks, setNetworks] = useState([]);

  useEffect(() => {
    async function loadNetworks() {
      const data = await getNetworks();
      setNetworks(data);
    }

    loadNetworks();
  }, []);

  return (
    <div>
      <label>Network</label>

      <br />

      <select
      value={selectedNetwork}
      onChange={(e) => setSelectedNetwork(e.target.value)}
    >
      {networks.map((network) => (
        <option key={network} value={network}>
          {network}
        </option>
      ))}
    </select>
    </div>
  );
}

export default NetworkSelector;