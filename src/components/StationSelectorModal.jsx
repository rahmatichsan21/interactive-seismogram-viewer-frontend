import { useEffect, useMemo, useState } from "react";

function StationSelectorModal({
  isOpen,
  stations,
  selectedStations,
  onClose,
  onApply,
}) {
  const [search, setSearch] = useState("");
  const [tempSelected, setTempSelected] = useState([]);

  useEffect(() => {
    if (isOpen) {
      setTempSelected(selectedStations);
      setSearch("");
    }
  }, [isOpen, selectedStations]);

  const filteredStations = useMemo(() => {
    return stations.filter((station) => {
      const stationCode =
        typeof station === "string"
          ? station
          : station.kode_stasiun;

      return stationCode
        .toLowerCase()
        .includes(search.toLowerCase());
    });
  }, [stations, search]);

  if (!isOpen) {
    return null;
  }

  const getStationCode = (station) => {
    return typeof station === "string"
      ? station
      : station.kode_stasiun;
  };

  const handleToggleStation = (stationCode) => {
    setTempSelected((current) => {
      if (current.includes(stationCode)) {
        return current.filter(
          (code) => code !== stationCode
        );
      }

      return [...current, stationCode];
    });
  };

  const handleSelectAll = () => {
    const allVisibleStations = filteredStations.map(
      getStationCode
    );

    setTempSelected((current) => [
      ...new Set([
        ...current,
        ...allVisibleStations,
      ]),
    ]);
  };

  const handleClear = () => {
    setTempSelected([]);
  };

  const handleApply = () => {
    onApply(tempSelected);
    onClose();
  };

  return (
    <div className="station-modal-overlay">
      <div className="station-modal">
        <div className="station-modal-header">
          <div>
            <h2>Select Stations</h2>
            <p>
              {tempSelected.length} station selected
            </p>
          </div>

          <button
            type="button"
            className="station-modal-close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <input
          type="text"
          className="station-modal-search"
          placeholder="Search station..."
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
        />

        <div className="station-modal-actions-top">
          <button
            type="button"
            onClick={handleSelectAll}
          >
            Select Visible
          </button>

          <button
            type="button"
            onClick={handleClear}
          >
            Clear
          </button>
        </div>

        <div className="station-modal-list">
          {filteredStations.map((station) => {
            const stationCode =
              getStationCode(station);

            return (
              <label
                key={stationCode}
                className="station-modal-item"
              >
                <input
                  type="checkbox"
                  checked={tempSelected.includes(
                    stationCode
                  )}
                  onChange={() =>
                    handleToggleStation(
                      stationCode
                    )
                  }
                />

                <span>{stationCode}</span>
              </label>
            );
          })}
        </div>

        <div className="station-modal-footer">
          <button
            type="button"
            className="station-modal-cancel"
            onClick={onClose}
          >
            Cancel
          </button>

          <button
            type="button"
            className="station-modal-apply"
            onClick={handleApply}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

export default StationSelectorModal;