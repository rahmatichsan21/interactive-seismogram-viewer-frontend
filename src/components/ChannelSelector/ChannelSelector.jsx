function ChannelSelector({
  channelPattern,
  setChannelPattern,
}) {
  const suggestions = [
    "*",
    "BH",
    "BH*",
    "HH",
    "HH*",
    "SH",
    "SH*",
    "EH",
    "EH*",
    "HN",
    "HN*",
    "EN",
    "EN*",
    "BHZ",
    "BHN",
    "BHE",
  ];

  function handleChange(event) {
    setChannelPattern(event.target.value.toUpperCase());
  }

  return (
    <div>
      <label>Channel</label>
      <br />

      <input
        list="channel-pattern-options"
        value={channelPattern}
        onChange={handleChange}
        placeholder="*, BH, BH*, SHZ"
      />

      <datalist id="channel-pattern-options">
        {suggestions.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>


    </div>
  );
}

export default ChannelSelector;