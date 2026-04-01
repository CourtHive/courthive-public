<script lang="ts">
  import { context } from 'src/common/context';
  import { TOURNAMENT } from 'src/common/constants/routerConstants';

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

  let { tournaments = [] }: { tournaments: TournamentEntry[] } = $props();

  let searchTerm = $state('');

  const sorted = $derived(
    [...tournaments].sort(
      (a, b) => new Date(b.tournament.startDate ?? '').getTime() - new Date(a.tournament.startDate ?? '').getTime(),
    ),
  );

  const filtered = $derived(
    searchTerm
      ? sorted.filter((e) => (e.searchText ?? e.tournament.tournamentName?.toLowerCase() ?? '').includes(searchTerm))
      : sorted,
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
    oninput={(e) => (searchTerm = (e.target as HTMLInputElement).value.toLowerCase())}
  />
  {#if searchTerm}
    <span
      class="tournament-search__clear"
      role="button"
      tabindex="0"
      onclick={() => {
        searchTerm = '';
        const input = document.querySelector('.tournament-search__input') as HTMLInputElement;
        if (input) input.value = '';
      }}
      onkeydown={(e) => e.key === 'Enter' && (searchTerm = '')}
    >
      <i class="fa-solid fa-circle-xmark"></i>
    </span>
  {/if}
</div>

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
          <img class="tournament-card__image" src={img} alt="" />
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
