export function formatDateTimeLocal(date) {
  const pad = (value) => String(value).padStart(2, "0");

  return (
    `${date.getFullYear()}-` +
    `${pad(date.getMonth() + 1)}-` +
    `${pad(date.getDate())}T` +
    `${pad(date.getHours())}:` +
    `${pad(date.getMinutes())}`
  );
}

export function getDefaultWaveformTimeRange() {
  const start = new Date();
  start.setDate(start.getDate() - 1);
  start.setSeconds(0, 0);

  const end = new Date(start);
  end.setMinutes(end.getMinutes() + 5);

  return {
    startTime: formatDateTimeLocal(start),
    endTime: formatDateTimeLocal(end),
  };
}

export function addMinutesToDateTimeLocal(value, minutes) {
  const [datePart, timePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);

  const date = new Date(
    year,
    month - 1,
    day,
    hour,
    minute + minutes
  );

  return formatDateTimeLocal(date);
}
