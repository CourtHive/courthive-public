/**
 * Read-only team scorecard viewer for courthive-public.
 * Opens a modal with the scorecard rendered by courthive-components.
 */
import { renderScorecard, resolvePublishedComposition, cModal } from 'courthive-components';

export function openScorecard({ matchUp, display }: { matchUp: any; display?: any }): void {
  if (!matchUp?.tieFormat?.collectionDefinitions?.length) return;

  const composition = resolvePublishedComposition(display || {});

  const content = (elem: HTMLElement) => {
    const scorecard = renderScorecard({ matchUp, composition });
    elem.appendChild(scorecard);
  };

  cModal.open({
    title: '',
    content,
    buttons: [{ label: 'Close', intent: 'none', close: true }],
    config: { maxWidth: 800, padding: '0' },
  });
}
