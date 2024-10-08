import { RIGHT } from 'src/common/constants/baseConstants';
import { isFunction } from 'src/functions/typeof';

const FONT_MEDIUM = 'font-medium';

type DropDownButton = {
  stateChange?: () => void;
  target?: HTMLElement;
  button: any;
};

export function dropDownButton(params: DropDownButton) {
  const { target, button, stateChange } = params;
  let i = 0;
  const genericItem = () => {
    i += 1;
    return `Item${i}`;
  };

  const elem = document.createElement('div');
  if (button.class) elem.classList.add(button.class);
  elem.classList.add('dropdown');
  if (button.id) elem.id = button.id;

  if (button.align === RIGHT) {
    elem.classList.add('is-right');
    elem.style.marginLeft = '1em';
  } else {
    elem.style.marginRight = '1em';
  }
  const isActive = (e) => e.classList.contains('is-active');
  const closeDropDown = () => {
    if (isActive(elem)) {
      elem.classList.remove('is-active');
    }
  };
  const activeState = (e: Element) => {
    if (isActive(e)) {
      e.classList.remove('is-active');
    } else {
      e.classList.add('is-active');
    }
  };
  elem.onmouseleave = closeDropDown;
  elem.onclick = () => activeState(elem);

  const trigger = document.createElement('div');
  trigger.classList.add('dropdown-trigger');
  const ddButton = document.createElement('button');
  ddButton.className = 'button font-medium';
  if (button.intent) ddButton.classList.add(button.intent);
  ddButton.setAttribute('aria-haspopup', 'true');
  const label = document.createElement('span');
  if (isFunction(button.onClick)) label.onclick = button.onClick;
  label.style.marginRight = `1em`;
  label.innerHTML = button.label;
  ddButton.appendChild(label);
  const icon = document.createElement('span');
  if (isFunction(button.onClick)) icon.onclick = button.onClick;
  icon.innerHTML = `
      <span class="icon is-small font-medium">
        ⌄
      </span>
  `;
  icon.style.height = '2em';
  ddButton.appendChild(icon);
  trigger.appendChild(ddButton);
  elem.appendChild(trigger);

  const menu = document.createElement('div');
  menu.classList.add('dropdown-menu');
  menu.style.zIndex = '99998';
  const content = document.createElement('div');
  content.classList.add('dropdown-content');

  const clearActive = () => {
    const items = menu.querySelectorAll('.dropdown-item');
    for (const item of Array.from(items)) {
      item.classList.remove('is-active');
    }
  };

  const createAnchor = (option) => {
    const anchor = document.createElement('a');
    anchor.className = FONT_MEDIUM;
    const opacity = option.disabled ? '0.4' : '1';
    anchor.style.textDecoration = `none`;
    anchor.style.opacity = opacity;
    if (option.color) anchor.style.color = option.color;
    anchor.classList.add('dropdown-item');
    if (option.isActive) anchor.classList.add('is-active');
    if (option.value) anchor.setAttribute('value', option.value);
    if (option.class) {
      anchor.classList.add(option.class);
    }

    anchor.onclick = (e) => {
      if (option.disabled) return;
      if (option.value) {
        ddButton.value = option.value;
        elem.setAttribute('value', option.value);
      }
      e.stopPropagation();
      if (isFunction(option.onClick)) {
        if (isFunction(stateChange)) stateChange();
        option.onClick(e);
      }
      if (option.close) closeDropDown();
      const active = isActive(anchor);
      clearActive();
      if (!active) {
        if (button.selection) activeState(anchor);
        if (button.modifyLabel && option.modifyLabel !== false) {
          label.innerHTML = `${button.append ? button.label + ': ' : ''}${option?.label || genericItem()}`;
        }
      } else {
        label.innerHTML = button.label;
      }
    };
    anchor.innerHTML = option?.label || genericItem();
    return anchor;
  };

  for (const option of button.options || []) {
    if (option.heading) {
      const heading = document.createElement('div');
      heading.style.fontWeight = 'bold';
      heading.classList.add('dropdown-item');
      heading.classList.add(FONT_MEDIUM);
      heading.innerHTML = option.heading;
      content.appendChild(heading);
    } else if (option.divider) {
      const item = document.createElement('hr');
      item.classList.add('dropdown-divider');
      item.classList.add(FONT_MEDIUM);
      content.appendChild(item);
    } else {
      if (!option.hide) content.appendChild(createAnchor(option));
    }
  }

  if (button.options?.length) {
    if (button.options[0].value) elem.setAttribute('value', button.options[0].value);
    menu.appendChild(content);
  }
  elem.appendChild(menu);

  if (target) target.appendChild(elem);

  return elem;
}
