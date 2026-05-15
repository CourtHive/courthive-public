import './renderRegistrationProfile.css';

interface LogisticsOption {
  name: string;
  description?: string;
  address?: string;
  phone?: string;
  email?: string;
  url?: string;
  priceRange?: string;
  notes?: string;
}

interface LogisticsSection {
  options?: LogisticsOption[];
  notes?: string;
}

interface SocialEvent {
  name: string;
  date?: string;
  time?: string;
  location?: string;
  description?: string;
}

interface Sponsor {
  name: string;
  tier?: string;
  logoUrl?: string;
  websiteUrl?: string;
}

interface DocumentLink {
  name: string;
  url?: string;
  description?: string;
}

interface EntryFee {
  amount: number;
  currencyCode: string;
  category?: string;
  eventType?: string;
}

export interface RegistrationProfile {
  entriesOpen?: string;
  entriesClose?: string;
  withdrawalDeadline?: string;
  entryFees?: EntryFee[];
  entryMethod?: string;
  entryUrl?: string;
  eligibilityNotes?: string;
  accommodation?: LogisticsSection;
  transportation?: LogisticsSection;
  hospitality?: LogisticsSection;
  medicalInfo?: LogisticsSection;
  dressCode?: string;
  contingencyPlan?: string;
  drawCeremonyDate?: string;
  awardsCeremonyDate?: string;
  awardsDescription?: string;
  socialEvents?: SocialEvent[];
  regulations?: DocumentLink[];
  codeOfConduct?: DocumentLink;
  sponsors?: Sponsor[];
}

type Translate = (key: string) => any;

const CLASS_NOTES = 'regprofile-notes';
const CLASS_ITEM = 'regprofile-item';
const CLASS_ITEM_NAME = 'regprofile-item-name';
const CLASS_ITEM_DETAIL = 'regprofile-item-detail';
const CLASS_LIST = 'regprofile-list';
const CLASS_FIELDS = 'regprofile-fields';

const T = (t: Translate, key: string, fallback: string): string => {
  const result = t(key);
  return result === key ? fallback : String(result);
};

function formatDate(value: string | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const hasTime = /T\d{2}:\d{2}/.test(value);
  return hasTime ? d.toLocaleString() : d.toLocaleDateString();
}

function formatFee(fee: EntryFee): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: fee.currencyCode }).format(fee.amount);
  } catch {
    return `${fee.amount} ${fee.currencyCode}`;
  }
}

function field(label: string, value: string | HTMLElement): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'regprofile-field';

  const l = document.createElement('span');
  l.className = 'regprofile-field-label';
  l.textContent = label;
  wrap.appendChild(l);

  const v = document.createElement('span');
  v.className = 'regprofile-field-value';
  if (typeof value === 'string') v.textContent = value;
  else v.appendChild(value);
  wrap.appendChild(v);

  return wrap;
}

function linkValue(name: string, url?: string): HTMLElement {
  if (!url) {
    const span = document.createElement('span');
    span.textContent = name;
    return span;
  }
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.textContent = name;
  return a;
}

function section(title: string): HTMLElement {
  const sec = document.createElement('section');
  sec.className = 'regprofile-section';
  const h = document.createElement('h3');
  h.className = 'regprofile-section-title';
  h.textContent = title;
  sec.appendChild(h);
  return sec;
}

function fieldsContainer(): HTMLElement {
  const div = document.createElement('div');
  div.className = CLASS_FIELDS;
  return div;
}

function htmlNotes(html: string): HTMLElement {
  const div = document.createElement('div');
  div.className = CLASS_NOTES;
  div.innerHTML = html;
  return div;
}

function renderEntryInfo(p: RegistrationProfile, t: Translate): HTMLElement | null {
  const hasAny =
    p.entriesOpen ||
    p.entriesClose ||
    p.withdrawalDeadline ||
    p.entryMethod ||
    p.entryUrl ||
    p.eligibilityNotes ||
    (p.entryFees && p.entryFees.length);
  if (!hasAny) return null;

  const sec = section(T(t, 'registrationProfile.entry', 'Entry & Eligibility'));
  const grid = fieldsContainer();

  if (p.entriesOpen) grid.appendChild(field(T(t, 'registrationProfile.entriesOpen', 'Entries open'), formatDate(p.entriesOpen)));
  if (p.entriesClose) grid.appendChild(field(T(t, 'registrationProfile.entriesClose', 'Entries close'), formatDate(p.entriesClose)));
  if (p.withdrawalDeadline)
    grid.appendChild(field(T(t, 'registrationProfile.withdrawalDeadline', 'Withdrawal deadline'), formatDate(p.withdrawalDeadline)));
  if (p.entryMethod) grid.appendChild(field(T(t, 'registrationProfile.entryMethod', 'Entry method'), p.entryMethod));
  if (p.entryUrl) grid.appendChild(field(T(t, 'registrationProfile.entryUrl', 'Entry URL'), linkValue(p.entryUrl, p.entryUrl)));
  sec.appendChild(grid);

  if (p.entryFees && p.entryFees.length) {
    const feesWrap = document.createElement('div');
    feesWrap.className = CLASS_FIELDS;
    for (const fee of p.entryFees) {
      const label = fee.eventType
        ? `${T(t, 'registrationProfile.entryFee', 'Fee')} — ${fee.eventType}`
        : T(t, 'registrationProfile.entryFee', 'Fee');
      feesWrap.appendChild(field(label, formatFee(fee)));
    }
    sec.appendChild(feesWrap);
  }

  if (p.eligibilityNotes) {
    const notes = document.createElement('div');
    notes.className = CLASS_NOTES;
    notes.textContent = p.eligibilityNotes;
    sec.appendChild(notes);
  }

  return sec;
}

function renderLogisticsOption(opt: LogisticsOption): HTMLElement {
  const li = document.createElement('li');
  li.className = CLASS_ITEM;

  const name = document.createElement('div');
  name.className = CLASS_ITEM_NAME;
  name.textContent = opt.name;
  li.appendChild(name);

  const details: string[] = [];
  if (opt.description) details.push(opt.description);
  if (opt.address) details.push(opt.address);
  if (opt.priceRange) details.push(opt.priceRange);

  for (const d of details) {
    const detail = document.createElement('div');
    detail.className = CLASS_ITEM_DETAIL;
    detail.textContent = d;
    li.appendChild(detail);
  }

  const contacts = document.createElement('div');
  contacts.className = CLASS_ITEM_DETAIL;
  if (opt.phone) contacts.appendChild(document.createTextNode(opt.phone));
  if (opt.email) {
    if (contacts.childNodes.length) contacts.appendChild(document.createTextNode(' · '));
    const mailto = document.createElement('a');
    mailto.href = `mailto:${opt.email}`;
    mailto.textContent = opt.email;
    contacts.appendChild(mailto);
  }
  if (opt.url) {
    if (contacts.childNodes.length) contacts.appendChild(document.createTextNode(' · '));
    contacts.appendChild(linkValue(opt.url, opt.url));
  }
  if (contacts.childNodes.length) li.appendChild(contacts);

  if (opt.notes) {
    const notes = document.createElement('div');
    notes.className = CLASS_ITEM_DETAIL;
    notes.textContent = opt.notes;
    li.appendChild(notes);
  }

  return li;
}

function renderLogisticsSection(data: LogisticsSection | undefined, title: string): HTMLElement | null {
  if (!data) return null;
  const hasOptions = data.options && data.options.length;
  const hasNotes = !!data.notes;
  if (!hasOptions && !hasNotes) return null;

  const sec = section(title);

  if (hasOptions) {
    const list = document.createElement('ul');
    list.className = CLASS_LIST;
    for (const opt of data.options!) list.appendChild(renderLogisticsOption(opt));
    sec.appendChild(list);
  }
  if (hasNotes) sec.appendChild(htmlNotes(data.notes!));

  return sec;
}

function renderCeremonies(p: RegistrationProfile, t: Translate): HTMLElement | null {
  const hasAny =
    p.drawCeremonyDate || p.awardsCeremonyDate || p.awardsDescription || (p.socialEvents && p.socialEvents.length);
  if (!hasAny) return null;

  const sec = section(T(t, 'registrationProfile.ceremonies', 'Ceremonies & Social Events'));
  const grid = fieldsContainer();

  if (p.drawCeremonyDate)
    grid.appendChild(field(T(t, 'registrationProfile.drawCeremony', 'Draw ceremony'), formatDate(p.drawCeremonyDate)));
  if (p.awardsCeremonyDate)
    grid.appendChild(field(T(t, 'registrationProfile.awardsCeremony', 'Awards ceremony'), formatDate(p.awardsCeremonyDate)));
  if (grid.childNodes.length) sec.appendChild(grid);

  if (p.awardsDescription) {
    const desc = document.createElement('div');
    desc.className = CLASS_NOTES;
    desc.textContent = p.awardsDescription;
    sec.appendChild(desc);
  }

  if (p.socialEvents && p.socialEvents.length) {
    const list = document.createElement('ul');
    list.className = CLASS_LIST;
    for (const ev of p.socialEvents) {
      const li = document.createElement('li');
      li.className = CLASS_ITEM;
      const name = document.createElement('div');
      name.className = CLASS_ITEM_NAME;
      name.textContent = ev.name;
      li.appendChild(name);

      const when = [ev.date && formatDate(ev.date), ev.time].filter(Boolean).join(' · ');
      if (when) {
        const w = document.createElement('div');
        w.className = CLASS_ITEM_DETAIL;
        w.textContent = when;
        li.appendChild(w);
      }
      if (ev.location) {
        const l = document.createElement('div');
        l.className = CLASS_ITEM_DETAIL;
        l.textContent = ev.location;
        li.appendChild(l);
      }
      if (ev.description) {
        const d = document.createElement('div');
        d.className = CLASS_ITEM_DETAIL;
        d.textContent = ev.description;
        li.appendChild(d);
      }
      list.appendChild(li);
    }
    sec.appendChild(list);
  }

  return sec;
}

function renderRegulations(p: RegistrationProfile, t: Translate): HTMLElement | null {
  const hasRegs = p.regulations && p.regulations.length;
  const hasCode = !!p.codeOfConduct;
  if (!hasRegs && !hasCode) return null;

  const sec = section(T(t, 'registrationProfile.regulations', 'Regulations'));
  const list = document.createElement('ul');
  list.className = CLASS_LIST;

  if (hasCode) {
    const li = document.createElement('li');
    li.className = CLASS_ITEM;
    const name = document.createElement('div');
    name.className = CLASS_ITEM_NAME;
    name.appendChild(linkValue(p.codeOfConduct!.name, p.codeOfConduct!.url));
    li.appendChild(name);
    if (p.codeOfConduct!.description) {
      const d = document.createElement('div');
      d.className = CLASS_ITEM_DETAIL;
      d.textContent = p.codeOfConduct!.description;
      li.appendChild(d);
    }
    list.appendChild(li);
  }

  if (hasRegs) {
    for (const reg of p.regulations!) {
      const li = document.createElement('li');
      li.className = CLASS_ITEM;
      const name = document.createElement('div');
      name.className = CLASS_ITEM_NAME;
      name.appendChild(linkValue(reg.name, reg.url));
      li.appendChild(name);
      if (reg.description) {
        const d = document.createElement('div');
        d.className = CLASS_ITEM_DETAIL;
        d.textContent = reg.description;
        li.appendChild(d);
      }
      list.appendChild(li);
    }
  }

  sec.appendChild(list);
  return sec;
}

function renderSponsors(p: RegistrationProfile, t: Translate): HTMLElement | null {
  if (!p.sponsors || !p.sponsors.length) return null;

  const sec = section(T(t, 'registrationProfile.sponsors', 'Sponsors'));
  const wrap = document.createElement('div');
  wrap.className = 'regprofile-sponsors';

  for (const sponsor of p.sponsors) {
    const node = sponsor.websiteUrl ? document.createElement('a') : document.createElement('div');
    node.className = 'regprofile-sponsor';
    if (node instanceof HTMLAnchorElement) {
      node.href = sponsor.websiteUrl!;
      node.target = '_blank';
      node.rel = 'noopener noreferrer';
    }

    if (sponsor.logoUrl) {
      const img = document.createElement('img');
      img.className = 'regprofile-sponsor-logo';
      img.src = sponsor.logoUrl;
      img.alt = sponsor.name;
      node.appendChild(img);
    }

    const name = document.createElement('div');
    name.className = 'regprofile-sponsor-name';
    name.textContent = sponsor.name;
    node.appendChild(name);

    if (sponsor.tier) {
      const tier = document.createElement('div');
      tier.className = 'regprofile-sponsor-tier';
      tier.textContent = sponsor.tier;
      node.appendChild(tier);
    }

    wrap.appendChild(node);
  }

  sec.appendChild(wrap);
  return sec;
}

function renderAdditional(p: RegistrationProfile, t: Translate): HTMLElement | null {
  if (!p.dressCode && !p.contingencyPlan) return null;

  const sec = section(T(t, 'registrationProfile.additional', 'Additional Information'));
  const grid = fieldsContainer();
  if (p.dressCode) grid.appendChild(field(T(t, 'registrationProfile.dressCode', 'Dress code'), p.dressCode));
  if (p.contingencyPlan)
    grid.appendChild(field(T(t, 'registrationProfile.contingencyPlan', 'Weather contingency'), p.contingencyPlan));
  sec.appendChild(grid);
  return sec;
}

export function renderRegistrationProfile(
  profile: RegistrationProfile | undefined,
  t: Translate,
): HTMLElement | null {
  if (!profile) return null;

  const root = document.createElement('div');
  root.className = 'regprofile';

  const sections = [
    renderEntryInfo(profile, t),
    renderLogisticsSection(profile.accommodation, T(t, 'registrationProfile.accommodation', 'Accommodation')),
    renderLogisticsSection(profile.transportation, T(t, 'registrationProfile.transportation', 'Transportation')),
    renderLogisticsSection(profile.hospitality, T(t, 'registrationProfile.hospitality', 'Hospitality')),
    renderLogisticsSection(profile.medicalInfo, T(t, 'registrationProfile.medical', 'Medical Information')),
    renderCeremonies(profile, t),
    renderRegulations(profile, t),
    renderSponsors(profile, t),
    renderAdditional(profile, t),
  ];

  for (const s of sections) if (s) root.appendChild(s);

  return root.children.length ? root : null;
}

export const __test__ = { formatDate, formatFee, T };
