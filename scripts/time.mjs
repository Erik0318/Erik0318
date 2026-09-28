export const TIME_ZONE = 'America/Los_Angeles';

const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short',
});

function parts(value) {
  return Object.fromEntries(formatter.formatToParts(new Date(value)).map(part => [part.type, part.value]));
}

export function pacificDate(value) {
  const { year, month, day } = parts(value);
  return `${year}-${month}-${day}`;
}

export function pacificTimestamp(value) {
  const { year, month, day, hour, minute, timeZoneName } = parts(value);
  return `${year}-${month}-${day} ${hour}:${minute} ${timeZoneName}`;
}
