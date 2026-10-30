// @ts-check

// The one place that decides the business day. Calendar day in Bogotá for now (see CLAUDE.md).
const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Bogota',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * @param {Date} date
 * @returns {string} 'YYYY-MM-DD' in America/Bogota
 */
export function businessDay(date) {
  return dayFormatter.format(date);
}
