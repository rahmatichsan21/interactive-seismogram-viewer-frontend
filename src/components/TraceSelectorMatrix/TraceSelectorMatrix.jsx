import { useEffect, useMemo, useRef, useState } from "react";
import "./TraceSelectorMatrix.css";

const COMPONENTS = ["N", "E", "Z"];

function getPrefix(trace) {
  const channel = String(trace.channel || "").trim().toUpperCase();
  return channel.length >= 2 ? channel.slice(0, 2) : channel;
}

function getComponent(trace) {
  const component = String(trace.channel || "").trim().slice(-1).toUpperCase();
  return COMPONENTS.includes(component) ? component : null;
}

// A station group includes network and location so stations with the same
// station code but different network/location remain independently selectable.
function getStationKey(trace) {
  return [
    trace.network || "",
    trace.station || "",
    trace.location || "",
  ].join(".");
}

function buildStationGroups(traces) {
  const byKey = new Map();

  for (const trace of traces) {
    if (!trace || trace.traceId == null) continue;

    const key = getStationKey(trace);
    if (!byKey.has(key)) {
      byKey.set(key, {
        key,
        network: trace.network || "",
        station: trace.station || "Unknown Station",
        location: trace.location || "",
        traces: [],
      });
    }

    byKey.get(key).traces.push(trace);
  }

  return [...byKey.values()].sort((a, b) => {
    const stationCompare = a.station.localeCompare(b.station);
    if (stationCompare !== 0) return stationCompare;
    const networkCompare = a.network.localeCompare(b.network);
    if (networkCompare !== 0) return networkCompare;
    return a.location.localeCompare(b.location);
  }).map((group) => {
    const prefixes = [...new Set(group.traces.map(getPrefix).filter(Boolean))].sort();
    const availableComponents = COMPONENTS.filter((component) =>
      group.traces.some((trace) => getComponent(trace) === component)
    );

    return {
      ...group,
      prefixes,
      availableComponents,
      traceIds: group.traces.map((trace) => trace.traceId),
    };
  });
}

function buildAllSelections(groups) {
  const prefixesByStation = {};
  const componentsByStation = {};

  for (const group of groups) {
    prefixesByStation[group.key] = Object.fromEntries(
      group.prefixes.map((prefix) => [prefix, true])
    );
    componentsByStation[group.key] = Object.fromEntries(
      COMPONENTS.map((component) => [
        component,
        group.availableComponents.includes(component),
      ])
    );
  }

  return { prefixesByStation, componentsByStation };
}

function buildSelectionsFromIds(groups, selectedTraceIds) {
  const selected = new Set(selectedTraceIds || []);
  const prefixesByStation = {};
  const componentsByStation = {};

  for (const group of groups) {
    prefixesByStation[group.key] = {};
    componentsByStation[group.key] = {};

    for (const prefix of group.prefixes) {
      const prefixTraces = group.traces.filter(
        (trace) => getPrefix(trace) === prefix
      );
      prefixesByStation[group.key][prefix] =
        prefixTraces.length > 0 &&
        prefixTraces.every((trace) => selected.has(trace.traceId));
    }

    for (const component of COMPONENTS) {
      const componentTraces = group.traces.filter(
        (trace) => getComponent(trace) === component
      );
      componentsByStation[group.key][component] =
        componentTraces.length > 0 &&
        componentTraces.every((trace) => selected.has(trace.traceId));
    }
  }

  return { prefixesByStation, componentsByStation };
}

function calculateSelectedIds(groups, prefixesByStation, componentsByStation) {
  const selectedIds = [];

  for (const group of groups) {
    const selectedPrefixes = prefixesByStation[group.key] || {};
    const selectedComponents = componentsByStation[group.key] || {};

    for (const trace of group.traces) {
      const prefix = getPrefix(trace);
      if (!selectedPrefixes[prefix]) continue;

      const component = getComponent(trace);
      // N/E/Z are controlled by their component checkbox. Channels with
      // another orientation suffix remain selectable through their prefix.
      if (component && !selectedComponents[component]) continue;

      selectedIds.push(trace.traceId);
    }
  }

  return selectedIds;
}

function getCheckState(ids, selectedSet) {
  if (!ids.length) return { checked: false, indeterminate: false };

  const count = ids.reduce(
    (total, id) => total + (selectedSet.has(id) ? 1 : 0),
    0
  );

  return {
    checked: count === ids.length,
    indeterminate: count > 0 && count < ids.length,
  };
}

function SelectionCheckbox({ label, checked, indeterminate = false, disabled = false, onChange }) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <label className={`trace-selector-checkbox${disabled ? " is-disabled" : ""}`}>
      <input
        ref={inputRef}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
      />
      <span>{label}</span>
    </label>
  );
}

function TraceSelectorMatrix({
  traces = [],
  selectedTraceIds = [],
  onSelectionChange,
  resetKey = null,
}) {
  const availableTraces = (traces || []).filter(
    (trace) => trace && trace.traceId != null
  );
  const stationGroups = useMemo(
    () => buildStationGroups(availableTraces),
    [availableTraces]
  );
  const allTraceIds = stationGroups.flatMap((group) => group.traceIds);
  const traceSignature = JSON.stringify(
    stationGroups.map((group) => ({
      key: group.key,
      traces: group.traces.map((trace) => [trace.traceId, trace.channel]),
    }))
  );
  const selectedSet = new Set(selectedTraceIds || []);

  const initialSelections = buildSelectionsFromIds(stationGroups, selectedTraceIds);
  const [prefixesByStation, setPrefixesByStation] = useState(
    initialSelections.prefixesByStation
  );
  const [componentsByStation, setComponentsByStation] = useState(
    initialSelections.componentsByStation
  );
  const previousResetSignatureRef = useRef(null);
  const resetSignature = `${resetKey ?? ""}::${traceSignature}`;

  useEffect(() => {
    if (previousResetSignatureRef.current === null) {
      previousResetSignatureRef.current = resetSignature;
      return;
    }

    if (previousResetSignatureRef.current === resetSignature) return;
    previousResetSignatureRef.current = resetSignature;

    const next = buildAllSelections(stationGroups);
    setPrefixesByStation(next.prefixesByStation);
    setComponentsByStation(next.componentsByStation);

    // A newly loaded dataset/trace set starts with every available trace selected.
    if (onSelectionChange) {
      onSelectionChange(allTraceIds);
    }
  }, [resetSignature]);

  if (availableTraces.length === 0) {
    return <div className="trace-selector-empty">No traces available.</div>;
  }

  function applySelection(nextPrefixes, nextComponents) {
    setPrefixesByStation(nextPrefixes);
    setComponentsByStation(nextComponents);
    onSelectionChange?.(
      calculateSelectedIds(stationGroups, nextPrefixes, nextComponents)
    );
  }

  function toggleAll() {
    const allSelected = allTraceIds.every((id) => selectedSet.has(id));

    if (allSelected) {
      const emptyPrefixes = Object.fromEntries(
        stationGroups.map((group) => [
          group.key,
          Object.fromEntries(group.prefixes.map((prefix) => [prefix, false])),
        ])
      );
      const emptyComponents = Object.fromEntries(
        stationGroups.map((group) => [
          group.key,
          Object.fromEntries(COMPONENTS.map((component) => [component, false])),
        ])
      );
      applySelection(emptyPrefixes, emptyComponents);
      return;
    }

    const next = buildAllSelections(stationGroups);
    applySelection(next.prefixesByStation, next.componentsByStation);
  }

  function toggleStation(group) {
    const stationState = getCheckState(group.traceIds, selectedSet);
    const shouldSelectAll = !stationState.checked;
    const nextPrefixes = {
      ...prefixesByStation,
      [group.key]: Object.fromEntries(
        group.prefixes.map((prefix) => [prefix, shouldSelectAll])
      ),
    };
    const nextComponents = {
      ...componentsByStation,
      [group.key]: Object.fromEntries(
        COMPONENTS.map((component) => [
          component,
          shouldSelectAll && group.availableComponents.includes(component),
        ])
      ),
    };

    applySelection(nextPrefixes, nextComponents);
  }

  function togglePrefix(group, prefix) {
    const current = Boolean(prefixesByStation[group.key]?.[prefix]);
    const nextPrefixes = {
      ...prefixesByStation,
      [group.key]: {
        ...(prefixesByStation[group.key] || {}),
        [prefix]: !current,
      },
    };
    applySelection(nextPrefixes, componentsByStation);
  }

  function toggleComponent(group, component) {
    const current = Boolean(componentsByStation[group.key]?.[component]);
    const nextComponents = {
      ...componentsByStation,
      [group.key]: {
        ...(componentsByStation[group.key] || {}),
        [component]: !current,
      },
    };
    applySelection(prefixesByStation, nextComponents);
  }

  const allState = getCheckState(allTraceIds, selectedSet);

  return (
    <div className="trace-selector">
      <div className="trace-selector-heading">
        <strong>Trace selection</strong>
        <span>
          {allTraceIds.filter((id) => selectedSet.has(id)).length} / {allTraceIds.length} traces selected
        </span>
      </div>

      <SelectionCheckbox
        label="Select All"
        checked={allState.checked}
        indeterminate={allState.indeterminate}
        onChange={toggleAll}
      />

      <div className="trace-selector-stations">
        {stationGroups.map((group) => {
          const stationState = getCheckState(group.traceIds, selectedSet);
          const networkLocation = [
            group.network ? `Network ${group.network}` : null,
            `Location ${group.location || "--"}`,
          ].filter(Boolean).join(" · ");

          return (
            <section className="trace-selector-station" key={group.key}>
              <div className="trace-selector-station-heading">
                <SelectionCheckbox
                  label={group.station}
                  checked={stationState.checked}
                  indeterminate={stationState.indeterminate}
                  onChange={() => toggleStation(group)}
                />
                <span className="trace-selector-station-meta">
                  {networkLocation}
                </span>
              </div>

              <div className="trace-selector-options">
                <div className="trace-selector-option-group">
                  <strong>Prefix</strong>
                  <div className="trace-selector-option-list">
                    {group.prefixes.map((prefix) => (
                      <SelectionCheckbox
                        key={prefix}
                        label={prefix}
                        checked={Boolean(prefixesByStation[group.key]?.[prefix])}
                        onChange={() => togglePrefix(group, prefix)}
                      />
                    ))}
                  </div>
                </div>

                <div className="trace-selector-option-group">
                  <strong>Components</strong>
                  <div className="trace-selector-option-list trace-selector-components">
                    {COMPONENTS.map((component) => (
                      <SelectionCheckbox
                        key={component}
                        label={component}
                        checked={Boolean(componentsByStation[group.key]?.[component])}
                        disabled={!group.availableComponents.includes(component)}
                        onChange={() => toggleComponent(group, component)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

export default TraceSelectorMatrix;
