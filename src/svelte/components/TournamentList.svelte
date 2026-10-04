<script lang="ts">
  import { context } from 'src/common/context';
  import { TOURNAMENT } from 'src/common/constants/routerConstants';
  import { createOnlineSearchController } from 'src/services/search/onlineSearchController';
  import { searchHitToEntry, searchTournaments } from 'src/services/api/tournamentSearchApi';

  type TournamentEntry = {
    tournamentId: string;
    searchText?: string;
    tournament: {
      tournamentName?: string;
      tournamentImageURL?: string;
      onlineResources?: { name: string; resourceType: string; identifier: string }[];
      startDate?: string;
      endDate?: string;
    };
  };

  let {
    tournaments = [],
    providerId,
    truncated = false,
  }: { tournaments: TournamentEntry[]; providerId?: string; truncated?: boolean } = $props();

  let searchTerm = $state('');

  /**
   * SERVER results, when a search is in flight or answered. The loaded array is only ever a page
   * of the provider's calendar; filtering it and reporting the result as the answer is how this
   * site served 500 of ALTA's 967 tournaments on 2026-09-17.
   */
  let serverEntries: TournamentEntry[] | undefined = $state(undefined);
  let serverTotal = $state(0);
  let searchFailed = $state(false);

  const controller = providerId
    ? createOnlineSearchController({
        search: (query) => searchTournaments({ q: query, providerId }),
        onResults: (result) => {
          searchFailed = false;
          serverTotal = result.total;
          serverEntries = result.tournaments.map(searchHitToEntry);
        },
        onLocal: () => {
          searchFailed = false;
          serverEntries = undefined;
        },
        onError: () => {
          // Say the search failed rather than rendering the loaded subset as if it were the answer.
          searchFailed = true;
          serverEntries = undefined;
        },
      })
    : undefined;

  const sorted = $derived(
    [...tournaments].sort(
      (a, b) => new Date(b.tournament.startDate ?? '').getTime() - new Date(a.tournament.startDate ?? '').getTime(),
    ),
  );

  // With server results on screen the query has ALREADY been applied, across the whole published
  // corpus. Re-filtering locally would narrow the server's answer against a haystack that cannot
  // see why each row matched.
  const filtered = $derived(
    serverEntries ??
      (searchTerm
        ? sorted.filter((e) => (e.searchText ?? e.tournament.tournamentName?.toLowerCase() ?? '').includes(searchTerm))
        : sorted),
  );

  function imageUrl(t: TournamentEntry['tournament']): string | undefined {
    return (
      t.tournamentImageURL ||
      t.onlineResources?.find(({ name, resourceType }) => name === 'tournamentImage' && resourceType === 'URL')
        ?.identifier
    );
  }

  function openTournament(tournamentId: string) {
    context.router.navigate(`/${TOURNAMENT}/${tournamentId}`);
  }
</script>

<div class="tournament-search">
  <span class="tournament-search__icon"><i class="fa-solid fa-magnifying-glass"></i></span>
  <input
    class="tournament-search__input"
    type="search"
    autocomplete="off"
    placeholder="Search tournaments"
    oninput={(e) => {
      searchTerm = (e.target as HTMLInputElement).value.toLowerCase();
      controller?.setQuery(searchTerm);
    }}
  />
  {#if searchTerm}
    <span
      class="tournament-search__clear"
      role="button"
      tabindex="0"
      onclick={() => {
        searchTerm = '';
        controller?.setQuery('');
        const input = document.querySelector('.tournament-search__input') as HTMLInputElement;
        if (input) input.value = '';
      }}
      onkeydown={(e) => {
        if (e.key !== 'Enter') return;
        searchTerm = '';
        controller?.setQuery('');
      }}
    >
      <i class="fa-solid fa-circle-xmark"></i>
    </span>
  {/if}
</div>

{#if searchFailed}
  <div class="tournament-list__notice">
    Tournament search is unavailable right now — showing only the tournaments already loaded.
  </div>
{:else if serverEntries}
  <div class="tournament-list__notice">
    {serverTotal}
    {serverTotal === 1 ? 'tournament matches' : 'tournaments match'} across this organisation's published calendar.
  </div>
{:else if truncated}
  <div class="tournament-list__notice">
    Showing the first {tournaments.length} tournaments. Search to look through all of them.
  </div>
{/if}

<div class="tournament-card-list">
  {#each filtered as entry (entry.tournamentId)}
    {@const img = imageUrl(entry.tournament)}
    <div
      class="tournament-card"
      role="button"
      tabindex="0"
      onclick={() => openTournament(entry.tournamentId)}
      onkeydown={(e) => e.key === 'Enter' && openTournament(entry.tournamentId)}
    >
      <div class="tournament-card__row">
        {#if img}
          <img
            class="tournament-card__image"
            src={img}
            alt=""
            onerror={(e) => {
              const el = e.currentTarget as HTMLImageElement;
              el.style.display = 'none';
              el.nextElementSibling?.classList.remove('tournament-card__fallback--hidden');
            }}
          />
          <div class="tournament-card__image tournament-card__placeholder tournament-card__fallback--hidden"></div>
        {:else}
          <div class="tournament-card__image tournament-card__placeholder"></div>
        {/if}
        <div class="tournament-card__info">
          <div class="tournament-card__name">{entry.tournament.tournamentName ?? ''}</div>
          <div class="tournament-card__dates">{entry.tournament.startDate ?? ''} / {entry.tournament.endDate ?? ''}</div>
        </div>
      </div>
    </div>
  {:else}
    <div class="tournament-card__empty">No tournaments</div>
  {/each}
</div>

<style>
  .tournament-list__notice {
    max-width: 600px;
    margin: 0 auto;
    padding: 0 0.75rem 0.5rem;
    width: 100%;
    font-size: 0.85rem;
    opacity: 0.75;
  }

  .tournament-card-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0 0.75rem 1rem;
    width: 100%;
    max-width: 600px;
    margin: 0 auto;
    overflow-y: auto;
    flex: 1;
    min-height: 0;
    box-sizing: border-box;
  }
</style>
