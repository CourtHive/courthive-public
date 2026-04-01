import { mount, unmount, type Component } from 'svelte';

const mountedComponents = new Map<string, { component: any; target: HTMLElement }>();

/**
 * Mount a Svelte component into a DOM target, replacing any previously mounted
 * component in that same target. This bridges the existing vanilla app shell
 * with Svelte components during incremental migration.
 */
export function mountSvelte<T extends Record<string, any>>(
  target: HTMLElement,
  component: Component<T>,
  props: T,
): any {
  const key = target.id || target.className;

  // Unmount any previously mounted component in this target
  const existing = mountedComponents.get(key);
  if (existing) {
    unmount(existing.component);
    mountedComponents.delete(key);
  }

  // Clear vanilla DOM content
  target.innerHTML = '';

  const instance = mount(component, { target, props });
  mountedComponents.set(key, { component: instance, target });
  return instance;
}
