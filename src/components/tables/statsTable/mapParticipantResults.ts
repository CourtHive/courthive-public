const sum = (values) => values.reduce((total, value) => total + parseFloat(value), 0);
const avg = (values) => parseFloat((sum(values) / values.length).toFixed(2));

export function mapParticipantResults(params) {
  const { participantResult, drawPosition, participantId, participantMap, withDraws } = params;
  const averageVariation = participantResult?.ratingVariation?.length ? avg(participantResult.ratingVariation) : 0;
  const averagePressure = participantResult?.pressureScores?.length ? avg(participantResult.pressureScores) : 0;
  const pointsResult = `${participantResult?.pointsWon || 0}/${participantResult?.pointsLost || 0}`;
  const gamesResult = `${participantResult?.gamesWon || 0}/${participantResult?.gamesLost || 0}`;
  const setsResult = `${participantResult?.setsWon || 0}/${participantResult?.setsLost || 0}`;
  const order = participantResult?.groupOrder || participantResult?.provisionalOrder;
  // A drawn result (16-16 of SET1-S:P32) is neither a win nor a loss: a table with one reads W/L/D (CA,
  // 2026-10-11); otherwise the factory's own W/L stands.
  const won = participantResult?.matchUpsWon || 0;
  const lost = participantResult?.matchUpsLost || 0;
  const drawnRecord = `${won}/${lost}/${participantResult?.matchUpsDrawn || 0}`;
  const participant = participantMap[participantId];

  return {
    participantName: participant.participantName,
    groupName: participant.groupName,
    ...participantResult,
    ...(withDraws ? { result: drawnRecord } : {}),
    averageVariation,
    averagePressure,
    participantId,
    pointsResult,
    drawPosition,
    participant,
    gamesResult,
    setsResult,
    order,
  };
}
