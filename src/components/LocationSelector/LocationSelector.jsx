function LocationSelector({
  locationPattern,
  setLocationPattern,
}) {
  const suggestions = [
    "*",
    "00",
    "10",
    "20",
  ];

  function handleChange(event) {
    setLocationPattern(
      event.target.value.toUpperCase()
    );
  }

  return (
    <div>
      <label>Location</label>
      <br />

      <input
        list="location-pattern-options"
        value={locationPattern}
        onChange={handleChange}
        placeholder="*, 00, 10"
      />

      <datalist id="location-pattern-options">
        {suggestions.map((item) => (
          <option
            key={item}
            value={item}
          />
        ))}
      </datalist>
    </div>
  );
}

export default LocationSelector;