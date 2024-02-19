import { dropDownButton } from 'src/components/dropDownButton';
import { getEventData } from 'src/services/api/tournamentsApi';
import { LEFT } from 'src/common/constants/tableConstants';

export function renderEvent({ tournamentId, eventId, header, flightDisplay }) {
  getEventData({ tournamentId, eventId }).then((eventData) => {
    const flightsData = eventData?.data?.drawsData;
    const renderFlight = (index) => {
      const flight = flightsData[index];
      flightDisplay.innerHTML = flight.drawName;
      console.log(flight);
    };
    if (flightsData?.length > 1) {
      const flightOptions = flightsData.map(({ drawName }, i) => ({
        onClick: () => renderFlight(i),
        label: drawName,
        close: true
      }));
      const flightButton = {
        label: flightsData[0].drawName,
        options: flightOptions,
        id: 'flightButton',
        modifyLabel: true,
        selection: true,
        location: LEFT
      };
      const elem = dropDownButton({ button: flightButton });
      header.appendChild(elem);
    }
    renderFlight(0);
  });
}
