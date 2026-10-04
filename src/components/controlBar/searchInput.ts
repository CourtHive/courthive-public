/**
 * Participant search box used by the Events (draw) and Schedule surfaces.
 *
 * TMX gets this from `controlBar({ items: [{ search: true }] })`, which owns a
 * whole bar layout. Both public surfaces already have their own header — the
 * Events block is a flex row of dropdowns, the Schedule header a date selector
 * — so this is just the input, styled to sit in either.
 *
 * Fires on every keystroke (the filter is in-memory and cheap) and on the clear
 * button; the caller receives the raw value and decides what an empty string
 * means.
 *
 * courthive-components exports `wrapSearchWithClear` (present in the published
 * 4.0.0 this repo pins), which is the same clear-button behaviour with inline
 * styles sized for a controlBar slot (`flex: 1`, absolutely-positioned icon).
 * It was deliberately not used here: this control is a rounded pill sitting in a
 * row of `.button` dropdowns, styled from `--chc-*` tokens for both themes, and
 * adopting the toolbar variant would mean overriding most of what it sets. If
 * the two ever need to look identical, converge by moving THIS styling into the
 * component rather than by wrapping there and re-styling here.
 */

export interface SearchInputParams {
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel?: string;
  value?: string;
  id?: string;
}

export function searchInput({ onChange, placeholder, ariaLabel, value, id }: SearchInputParams): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'chp-search';
  if (id) wrapper.id = id;

  const input = document.createElement('input');
  input.type = 'search';
  input.className = 'chp-search__input';
  input.placeholder = placeholder;
  input.setAttribute('aria-label', ariaLabel ?? placeholder);
  input.value = value ?? '';

  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'chp-search__clear';
  clear.textContent = '×';
  clear.title = 'Clear search';
  clear.setAttribute('aria-label', 'Clear search');

  const syncClearVisibility = () => {
    clear.style.visibility = input.value ? 'visible' : 'hidden';
  };
  syncClearVisibility();

  input.addEventListener('input', () => {
    syncClearVisibility();
    onChange(input.value);
  });

  clear.addEventListener('click', () => {
    input.value = '';
    syncClearVisibility();
    onChange('');
    input.focus();
  });

  wrapper.append(input, clear);
  return wrapper;
}
