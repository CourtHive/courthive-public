export function dateString({ startDate, endDate }) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
  ];
  const sameDay = start.getDate() === end.getDate();
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();
  const formattedDate = (date) => [date.getFullYear(), date.getMonth() + 1, date.getDate()].join('/');
  if (sameDay && sameYear && sameMonth) {
    return `${monthNames[start.getMonth()]} ${start.getDate()}, ${start.getFullYear()}`;
  } else if (sameYear && sameMonth) {
    return `${monthNames[start.getMonth()]} ${start.getDate()}-${end.getDate()}, ${start.getFullYear()}`;
  } else if (sameYear) {
    return `${monthNames[start.getMonth()]} ${start.getDate()} - ${monthNames[end.getMonth()]} ${end.getDate()}, ${start.getFullYear()}`;
  } else {
    return `${formattedDate(start)} - ${formattedDate(end)}`;
  }
}
