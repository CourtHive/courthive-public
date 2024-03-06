const sum = (values) => values.reduce((total, value) => total + parseFloat(value), 0);
const avg = (values) => parseFloat((sum(values) / values.length).toFixed(2));

export function mapParticipantResults(params) {
  const { participantResult, drawPosition, participantId, participantMap } = params;
  const setsResult = `${participantResult?.setsWon || 0}/${participantResult?.setsLost || 0}`;
  const gamesResult = `${participantResult?.gamesWon || 0}/${participantResult?.gamesLost || 0}`;
  const order = participantResult?.groupOrder || participantResult?.provisionalOrder;
  const averagePressure = participantResult ? avg(participantResult.pressureScores ?? []) : 0;
  const averageVariation = participantResult ? avg(participantResult.ratingVariation ?? []) : 0;
  const participant = participantMap[participantId];

  return {
    participantName: participant.participantName,
    groupName: participant.groupName,
    ...participantResult,
    averageVariation,
    averagePressure,
    participantId,
    drawPosition,
    participant,
    gamesResult,
    setsResult,
    order
  };
}