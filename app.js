// SPDX-License-Identifier: GPL-3.0-only

const byId = id => document.getElementById(id)
const search = byId('tag-search')
const tagPicker = byId('tag-picker')
const tagToggle = byId('tag-toggle')
const tagPopup = byId('tag-popup')
const tagOptions = byId('tag-options')
const tagMenuHeader = byId('tag-menu-header')
const tagMenuTitle = byId('tag-menu-title')
const tagBack = byId('tag-back')
const matches = byId('matches')
const tagEmpty = byId('tag-empty')
const quickBar = byId('quick-bar')
const commercial = byId('commercial')
const artistic = byId('artistic')
const owned = byId('owned')
const quickGenres = byId('quick-genres')
const sortedTags = [...GUIDE.tags].sort((a, b) => a.name.localeCompare(b.name)).map(tag => ({
  ...tag, searchText: (tag.name + ' ' + tag.id.replaceAll('_', ' ') + ' ' + tag.category).toLowerCase()
}))
const exampleIds = [
  'ROMANCE', 'MODERN_AMERICAN_CITY', 'PROTAGONIST_HOPELESS_ROMANTIC',
  'SUPPORTINGCHARACTER_LOVE_INTEREST', 'THEME_WINNING_THE_BELOVED',
  'THEME_UNREQUITED_LOVE', 'FINALE_COUPLE_GETS_MARRIED'
]
const selection = new Map()
const storageKey = 'hollywood-animal-advertisers-v1'
// Top-left positions of the 118 px logo views in the supplied 860 × 709 screenshot.
const agencyLogoPositions = {
  NBG: [29, 90],
  'Ross&Ross Bros.': [437, 90],
  'Vien Pascal': [29, 225],
  Spark: [437, 225],
  'Nate Sparrow Press': [29, 360],
  'Velvet Gloss': [437, 360],
  'Pierre Zola Company': [29, 495],
  'Spice Mice': [437, 495]
}
let showingExample = false
let showAll = false
let browseCategory = ''

function element(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function lucideIcon(name, style = 'size-4 shrink-0 text-brand') {
  const namespace = 'http://www.w3.org/2000/svg'
  const icon = document.createElementNS(namespace, 'svg')
  const attributes = {
    class: style, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true'
  }
  for (const [attribute, value] of Object.entries(attributes)) icon.setAttribute(attribute, value)
  const use = document.createElementNS(namespace, 'use')
  use.setAttribute('href', '#icon-' + name)
  icon.append(use)
  return icon
}

function agencyMark(name, frameSize = 'size-10') {
  const mark = element('span', 'agency-logo ' + frameSize)
  const [x, y] = agencyLogoPositions[name]
  mark.style.backgroundPosition = (x * 100 / (860 - 118)) + '% ' + (y * 100 / (709 - 118)) + '%'
  mark.dataset.agencyLogo = name
  mark.setAttribute('aria-hidden', 'true')
  return mark
}

function save() {
  try {
    localStorage.setItem(storageKey, JSON.stringify({
      selection: [...selection], commercial: commercial.value, artistic: artistic.value,
      owned: owned.value, showingExample
    }))
  } catch {
    // The planner remains usable in browsers that disable storage.
  }
}

function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey))
    if (!Array.isArray(saved?.selection)) return false
    for (const entry of saved.selection) {
      if (!Array.isArray(entry)) continue
      const [id, share] = entry
      if (tagsById.has(id) && Number.isInteger(share) && share >= 0 && share <= 100) {
        selection.set(id, share)
      }
    }
    commercial.value = saved.commercial ?? '5.0'
    artistic.value = saved.artistic ?? '5.0'
    owned.value = saved.owned ?? '3185'
    showingExample = saved.showingExample === true
    return true
  } catch {
    return false
  }
}

function setFilm(example) {
  selection.clear()
  if (example) exampleIds.forEach(id => selection.set(id, 100))
  commercial.value = example ? '6.3' : '5.0'
  artistic.value = example ? '5.4' : '5.0'
  search.value = ''
  showingExample = example
  showAll = false
  syncPrimarySteppers.forEach(sync => sync())
  refreshSelection()
}

function announce(message) {
  byId('status').textContent = message
}

function setTagSelected(id, selected) {
  if (selected) selection.set(id, selection.get(id) ?? 100)
  else selection.delete(id)
  showingExample = false
  renderSelection()
  refreshResults()
  announce(tagsById.get(id).name + (selected ? ' added.' : ' removed.'))
}

function closePicker() {
  browseCategory = ''
  tagPopup.inert = true
  tagPopup.hidden = true
  search.setAttribute('aria-expanded', 'false')
  tagToggle.setAttribute('aria-expanded', 'false')
  search.removeAttribute('aria-activedescendant')
}

function positionPicker() {
  if (tagPopup.hidden) return
  const viewport = window.visualViewport
  const top = viewport?.offsetTop ?? 0
  let bottom = top + (viewport?.height ?? window.innerHeight)
  if (quickBar.getClientRects().length) bottom = Math.min(bottom, quickBar.getBoundingClientRect().top)

  const anchor = tagPicker.getBoundingClientRect()
  const gap = 14
  const above = Math.max(0, anchor.top - top - gap)
  const below = Math.max(0, bottom - anchor.bottom - gap)
  const preferredHeight = Math.min(320, tagMenuHeader.offsetHeight + tagOptions.scrollHeight + 2)
  const placeAbove = below < preferredHeight && above > below
  tagPopup.dataset.placement = placeAbove ? 'above' : 'below'
  tagPopup.style.setProperty('--picker-height', Math.min(320, placeAbove ? above : below) + 'px')
}

function pickerOption(id, height = 'min-h-11') {
  const option = element('div', 'group/option flex cursor-pointer items-center gap-x-2.5 rounded px-2.5 py-1.5 text-sm hover:bg-tint data-active:bg-tint motion-safe:transition-colors motion-safe:duration-200 ' + height)
  option.id = id
  option.setAttribute('role', 'option')
  option.setAttribute('aria-selected', 'false')
  return option
}

function matchingTags(query) {
  const words = query.split(/\s+/)
  const choices = sortedTags.filter(tag =>
    (!browseCategory || tag.category === browseCategory) && words.every(word => tag.searchText.includes(word)))
  const exact = choices.findIndex(tag => tag.name.toLowerCase() === query)
  if (exact > 0) choices.unshift(...choices.splice(exact, 1))
  return choices.map(tag => {
    const option = pickerOption('tag-option-' + tag.id)
    option.dataset.tag = tag.id
    option.setAttribute('aria-label', tag.name + ', ' + tag.category)
    option.setAttribute('aria-selected', String(selection.has(tag.id)))
    const box = element('span', 'grid size-4 shrink-0 place-items-center rounded-sm border border-control group-aria-selected/option:border-brand group-aria-selected/option:bg-brand motion-safe:transition-colors motion-safe:duration-200')
    box.setAttribute('aria-hidden', 'true')
    box.append(lucideIcon('check', 'invisible size-3 text-on-brand group-aria-selected/option:visible'))
    const name = element('span', 'min-w-0 flex-1 wrap-anywhere', tag.name)
    option.append(box, name)
    if (!browseCategory) option.append(element('span', 'text-right text-xs text-muted', tag.category))
    return option
  })
}

function openPicker() {
  const query = search.value.trim().toLowerCase()
  const browsing = !query && !browseCategory
  const options = browsing ? GUIDE.categories.map((name, index) => {
    const option = pickerOption('tag-category-' + index, 'min-h-9')
    option.dataset.category = name
    option.append(element('span', 'flex-1', name), lucideIcon('chevron-down', 'size-3.5 shrink-0 -rotate-90 text-muted'))
    return option
  }) : matchingTags(query)
  tagPopup.toggleAttribute('data-categories', browsing)
  tagBack.hidden = !browseCategory
  tagMenuTitle.textContent = browseCategory || (browsing ? 'Browse by category' : 'Search results')
  if (browsing) matches.removeAttribute('aria-multiselectable')
  else matches.setAttribute('aria-multiselectable', 'true')
  matches.replaceChildren(...options)
  search.removeAttribute('aria-activedescendant')
  tagPopup.hidden = false
  tagPopup.inert = false
  tagOptions.scrollTop = 0
  search.setAttribute('aria-expanded', 'true')
  tagToggle.setAttribute('aria-expanded', 'true')
  tagEmpty.hidden = options.length > 0
  tagEmpty.textContent = options.length ? '' : 'No tags found. Try a different name.'
  positionPicker()
}

function choosePickerOption(option) {
  if (option.dataset.category) {
    browseCategory = option.dataset.category
    openPicker()
    return
  }
  const id = option.dataset.tag
  const selected = !selection.has(id)
  setTagSelected(id, selected)
  option.setAttribute('aria-selected', String(selected))
  positionPicker()
}

function movePickerFocus(options, direction) {
  const previous = byId(search.getAttribute('aria-activedescendant'))
  const index = previous ? options.indexOf(previous) + direction : direction > 0 ? 0 : options.length - 1
  const next = options[Math.max(0, Math.min(index, options.length - 1))]
  if (!next) return
  previous?.removeAttribute('data-active')
  next.setAttribute('data-active', '')
  search.setAttribute('aria-activedescendant', next.id)

  const menuBounds = tagOptions.getBoundingClientRect()
  const nextBounds = next.getBoundingClientRect()
  if (nextBounds.bottom > menuBounds.bottom) tagOptions.scrollTop += nextBounds.bottom - menuBounds.bottom + 4
  if (nextBounds.top < menuBounds.top) tagOptions.scrollTop -= menuBounds.top - nextBounds.top + 4
}

function renderSelection() {
  const list = byId('selection')
  list.replaceChildren()
  byId('selected-count').textContent = selection.size || ''
  byId('selected-tags').hidden = selection.size === 0
  quickGenres.hidden = selection.size > 0
  renderGenreMix()
  for (const id of selection.keys()) {
    const tag = tagsById.get(id)
    const isGenre = tag.category === 'Genre'
    const tone = isGenre ? 'border-brand/35 bg-brand/10 text-ink' : 'border-line bg-field'
    const row = element('li', 'inline-flex max-w-full items-center gap-1.5 rounded-md border py-0.5 pr-0.5 pl-2.5 text-sm ' + tone)
    row.title = tag.category
    row.append(element('span', 'min-w-0 wrap-anywhere font-medium', tag.name))
    const remove = element('button', "relative size-8 shrink-0 rounded-sm text-muted hover:bg-tint hover:text-ink before:absolute before:top-1/2 before:left-1/2 before:h-px before:w-2.5 before:-translate-1/2 before:rotate-45 before:bg-current before:content-[''] after:absolute after:top-1/2 after:left-1/2 after:h-px after:w-2.5 after:-translate-1/2 after:-rotate-45 after:bg-current after:content-['']")
    remove.type = 'button'
    remove.dataset.removeTag = ''
    remove.setAttribute('aria-label', 'Remove ' + tag.name)
    remove.addEventListener('click', () => {
      const nextId = row.nextElementSibling?.dataset.id ?? row.previousElementSibling?.dataset.id
      closePicker()
      setTagSelected(id, false)
      const next = [...list.children].find(item => item.dataset.id === nextId)
      if (next) next.querySelector('[data-remove-tag]').focus()
      else search.focus()
    })
    row.dataset.id = id
    row.append(remove)
    list.append(row)
  }
}

function mountNumberStepper(input, label, {
  width = '', increment = Number(input.step), read = () => input.valueAsNumber, adjust
} = {}) {
  const control = element('div', 'stepper-frame ' + width)
  const arrows = element('div', 'grid shrink-0 grid-rows-2 divide-y divide-control border-l border-control')
  const min = input.min === '' ? -Infinity : Number(input.min)
  const max = input.max === '' ? Infinity : Number(input.max)

  const sync = () => {
    const current = read()
    up.setAttribute('aria-disabled', String(current >= max))
    down.setAttribute('aria-disabled', String(current <= min))
  }
  const step = direction => {
    if (adjust) adjust(direction * increment)
    else {
      if (direction > 0) input.stepUp()
      else input.stepDown()
      input.dispatchEvent(new Event('input', { bubbles: true }))
      announce(label + ' ' + input.value + '.')
    }
    sync()
  }
  const arrow = (direction, action, iconStyle) => {
    const button = element('button', 'grid h-6 w-8 place-items-center text-muted hover:bg-tint hover:text-ink focus-visible:z-10 focus-visible:-outline-offset-2 aria-disabled:cursor-default aria-disabled:opacity-40')
    button.type = 'button'
    button.setAttribute('aria-label', action + ' ' + label + ' by ' + increment)
    button.append(lucideIcon('chevron-down', iconStyle))
    button.addEventListener('click', () => {
      if (button.getAttribute('aria-disabled') !== 'true') step(direction)
    })
    return button
  }
  const up = arrow(1, 'Increase', 'size-3.5 rotate-180')
  const down = arrow(-1, 'Decrease', 'size-3.5')
  arrows.append(up, down)
  input.classList.add('stepper-value')
  input.replaceWith(control)
  control.append(input, arrows)
  input.addEventListener('input', sync)
  if (adjust) input.addEventListener('keydown', event => {
    if (event.isComposing || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return
    event.preventDefault()
    step(event.key === 'ArrowUp' ? 1 : -1)
  })
  sync()
  return sync
}

function renderGenreMix() {
  const genres = [...selection].filter(([id]) => tagsById.get(id).category === 'Genre')
  const fields = byId('genre-weights')
  fields.replaceChildren()
  const showMix = genres.length > 1 || genres.some(([, weight]) => weight !== 100)
  byId('genre-mix').hidden = !showMix
  if (!showMix) return

  for (const [id, weight] of genres) {
    const name = tagsById.get(id).name
    const field = element('div', 'flex min-w-0 items-center justify-between gap-1 rounded-md border border-line bg-field px-1.5 text-sm font-medium')
    const label = element('label', 'min-w-0 wrap-anywhere', name)
    const input = element('input', 'px-1 text-center')
    Object.assign(input, { id: 'genre-weight-' + id, type: 'number', min: '0', max: '100', step: '1', value: weight, inputMode: 'numeric' })
    label.htmlFor = input.id
    input.setAttribute('aria-label', name + ' genre weight')

    const saveWeight = value => {
      if (selection.get(id) === value) return
      selection.set(id, value)
      showingExample = false
      refreshResults()
    }
    const adjustWeight = amount => {
      const current = selection.get(id)
      const next = Math.min(100, Math.max(0, current + amount))
      input.value = next
      input.setAttribute('aria-invalid', 'false')
      if (next === current) return
      saveWeight(next)
      announce(name + ' genre weight ' + next + '.')
    }
    input.addEventListener('input', () => {
      const valid = validNumber(input)
      input.setAttribute('aria-invalid', String(!valid))
      if (valid) saveWeight(input.valueAsNumber)
    })
    input.addEventListener('blur', () => {
      input.value = selection.get(id)
      input.setAttribute('aria-invalid', 'false')
    })
    field.append(label, input)
    fields.append(field)
    mountNumberStepper(input, name + ' genre weight', {
      width: 'my-1 w-19 shrink-0', increment: 5, read: () => selection.get(id), adjust: adjustWeight
    })
  }
}

function keyedValue(label, value, icon) {
  const block = element('div', icon
    ? 'flex min-w-0 items-baseline justify-between gap-x-2 min-[480px]:block'
    : 'border-t border-line py-2 tabular-nums')
  const term = element('dt', icon ? 'flex items-center gap-1.5 text-xs text-muted' : 'text-xs text-muted', label)
  if (icon) term.prepend(lucideIcon(icon, 'size-3.5 shrink-0 text-brand'))
  block.append(term, element('dd', 'wrap-anywhere text-sm font-semibold', value))
  return block
}

function renderAudienceGroups(list, audiences) {
  for (const [high, title] of [[true, 'High interest'], [false, 'Moderate interest']]) {
    const group = audiences.filter(audience => audience.high === high)
    if (!group.length) continue
    const row = element('li', 'rounded-md border border-line bg-field p-2.5')
    const heading = element('h4', high ? 'text-sm font-semibold text-brand' : 'text-sm font-semibold text-muted', title)
    const members = element('ul', 'mt-2 flex flex-wrap gap-1.5')
    for (const audience of group) {
      members.append(element('li', 'rounded border border-line px-2 py-1 text-xs font-medium', audience.name))
    }
    row.append(heading, members)
    list.append(row)
  }
}

function renderHolidays(list, holidays) {
  for (const holiday of holidays.slice(0, 4)) {
    const row = element('li', 'rounded-md border border-line bg-field p-2.5 first:border-brand/35')
    const bonuses = element('ul', 'mt-2 flex flex-wrap gap-x-3 gap-y-1.5')
    for (const { name, bonus } of holiday.bonuses) {
      const item = element('li', 'inline-flex items-baseline gap-1 text-xs')
      item.append(
        element('span', 'font-semibold tabular-nums text-brand', '+' + bonus + '%'),
        element('span', 'text-muted', name)
      )
      bonuses.append(item)
    }
    row.append(element('strong', 'block text-sm', holiday.name), bonuses)
    list.append(row)
  }
}

function renderCampaignDuration(list, timeline, durations) {
  const phases = [
    ['Pre-release', 'bg-brand'],
    ['At release', 'bg-brand/60'],
    ['Post-release', 'bg-brand/35']
  ]
  for (const [index, weeks] of durations.entries()) {
    const [label, tone] = phases[index]
    if (weeks > 0) {
      const segment = element('span', 'basis-0 rounded-full ' + tone)
      segment.style.flexGrow = weeks
      timeline.append(segment)
    }
    const phase = element('div', 'min-w-0')
    const term = element('dt', 'flex items-center gap-1.5 text-xs text-muted')
    const dot = element('span', 'size-2 shrink-0 rounded-full ' + (weeks ? tone : 'bg-control'))
    dot.setAttribute('aria-hidden', 'true')
    term.append(dot, element('span', 'wrap-anywhere', label))
    phase.append(term, element('dd', 'mt-1 text-sm font-semibold tabular-nums', weeks + ' weeks'))
    list.append(phase)
  }
}

function renderPlan(plan) {
  const top = byId('top-pick')
  const previousTopName = top.querySelector('strong')?.textContent
  const others = byId('other-picks')
  const audienceList = byId('audiences')
  const holidayList = byId('holidays')
  const duration = byId('duration')
  const timeline = byId('campaign-timeline')
  const brief = byId('brief')
  const more = byId('more')
  const lean = byId('lean')
  for (const node of [top, others, audienceList, holidayList, duration, timeline, brief]) node.replaceChildren()
  const hasMatch = Boolean(plan?.agencies.length)
  byId('result-message').hidden = hasMatch
  byId('top-label').hidden = !hasMatch
  byId('empty-guidance').hidden = selection.size > 0
  byId('result-message').textContent = plan ? 'No agencies match this audience and film focus.'
    : selection.size ? 'Fix the film scores to update your picks.' : 'Add a story tag to get started.'
  byId('audience-empty').hidden = Boolean(plan?.audiences.length)
  byId('holiday-empty').hidden = Boolean(plan?.holidays.length)
  lean.hidden = !plan
  brief.hidden = !plan
  top.hidden = !hasMatch
  byId('alternatives').hidden = !(plan?.agencies.length > 1)
  byId('breakdown').hidden = !plan
  const quickPicks = byId('quick-picks')
  quickPicks.hidden = !plan
  if (plan) byId('quick-picks-label').textContent = plan.agencies.length ? 'See picks (' + plan.agencies.length + ')' : 'See results'
  more.hidden = !(plan?.agencies.length > 4)
  more.setAttribute('aria-expanded', String(showAll && !more.hidden))
  if (!plan) return
  lean.textContent = ['Balanced', 'Artistic', 'Commercial'][plan.lean] + ' film'
  more.textContent = showAll ? 'Show top four' : 'Show all matches (' + plan.agencies.length + ')'

  for (const [index, agency] of plan.agencies.slice(0, showAll ? undefined : 4).entries()) {
    const featured = index === 0
    const row = element('li', featured
      ? 'flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-2 pt-1 motion-safe:data-new-match:animate-match-in'
      : 'grid min-w-0 grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-2 border-b border-line py-2.5')
    const name = element('div', 'min-w-0')
    name.append(
      element('strong', featured ? 'block wrap-anywhere text-2xl leading-tight font-semibold tracking-tight sm:text-[1.7rem]' : 'block text-sm font-semibold sm:text-base', agency.name),
      element('small', featured ? 'mt-1 block text-sm leading-snug text-muted' : 'block text-xs leading-snug text-muted sm:text-sm',
        agency.matches.map(match => match.name).join(', '))
    )
    const identity = element('div', featured ? 'flex min-w-0 items-center gap-3' : 'flex min-w-0 items-center gap-2')
    identity.append(featured ? agencyMark(agency.name, 'size-12') : agencyMark(agency.name), name)
    const type = element('span', featured
      ? 'shrink-0 rounded-sm border border-control px-2 py-1 text-xs text-muted'
      : 'text-right text-xs text-muted', AGENCY_TYPES[agency.type])
    if (!featured) {
      const rank = element('span', 'text-sm tabular-nums text-muted', String(index + 1).padStart(2, '0'))
      rank.setAttribute('aria-hidden', 'true')
      row.append(rank)
    }
    row.append(identity, type)
    if (featured) {
      row.toggleAttribute('data-new-match', agency.name !== previousTopName)
      top.append(row)
    } else others.append(row)
  }
  renderAudienceGroups(audienceList, plan.audiences)
  renderHolidays(holidayList, plan.holidays)
  renderCampaignDuration(duration, timeline, plan.duration)
  brief.append(
    keyedValue('Top audience', plan.audiences[0]?.name ?? 'No match', 'users'),
    keyedValue('Top holiday', plan.holidays[0]?.name ?? 'No match', 'calendar-days'),
    keyedValue('Ad schedule', plan.duration.reduce((sum, weeks) => sum + weeks, 0) + ' weeks total', 'clock')
  )
}

function validNumber(input) {
  return input.validity.valid && Number.isFinite(input.valueAsNumber)
}

function renderDistribution(weeks) {
  const grid = byId('weeks')
  grid.hidden = weeks.length === 0
  const peak = Math.max(1, ...weeks)
  for (const [index, value] of weeks.entries()) {
    let tile = grid.children[index]
    if (!tile) {
      tile = element('div', 'min-w-0 rounded-md border border-line bg-field px-1.5 py-2 first:border-brand/35 first:bg-brand/10 sm:px-2')
      const amount = element('span', 'block wrap-anywhere text-[.8125rem] leading-tight font-semibold tabular-nums min-[360px]:text-sm')
      amount.dataset.screenings = ''
      const bar = element('span', 'block h-full w-full origin-left scale-x-(--screening-ratio) rounded-full bg-brand/85 motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-ui')
      bar.dataset.screeningBar = ''
      const track = element('span', 'mt-2 block h-1 overflow-hidden rounded-full bg-control')
      track.setAttribute('aria-hidden', 'true')
      track.append(bar)
      const content = element('dd', 'mt-1')
      content.append(amount, track)
      tile.append(element('dt', 'text-xs text-muted', 'Week ' + (index + 1)), content)
      grid.append(tile)
    }
    tile.querySelector('[data-screenings]').textContent = value.toLocaleString('en-US')
    tile.querySelector('[data-screening-bar]').style.setProperty('--screening-ratio', String(value / peak))
  }
}

function refreshResults() {
  const commercialValid = validNumber(commercial)
  const artisticValid = validNumber(artistic)
  const ownedValid = validNumber(owned)
  const scoresValid = commercialValid && artisticValid
  const distributionValid = commercialValid && ownedValid
  const score = commercial.valueAsNumber
  const hasEdits = selection.size > 0 || score !== 5 || artistic.valueAsNumber !== 5
  byId('film-caption').hidden = !showingExample
  byId('example').hidden = hasEdits
  byId('reset').hidden = !hasEdits
  commercial.setAttribute('aria-invalid', String(!commercialValid))
  artistic.setAttribute('aria-invalid', String(!artisticValid))
  owned.setAttribute('aria-invalid', String(!ownedValid))
  const scoreError = byId('score-error')
  scoreError.hidden = scoresValid
  const fieldName = commercialValid ? 'the artistic score' : artisticValid ? 'the commercial score' : 'both scores'
  scoreError.textContent = scoresValid ? '' : 'Enter ' + fieldName + ' from 0 to 10 in steps of 0.1.'
  byId('distribution-error').hidden = distributionValid
  renderPlan(scoresValid && selection.size ? planCampaign(selection, score, artistic.valueAsNumber) : null)
  const weeks = distributionValid ? estimateScreenings(score, owned.valueAsNumber) : []
  renderDistribution(weeks)
  save()
}

function refreshSelection() {
  closePicker()
  renderSelection()
  refreshResults()
}

for (const agency of [...GUIDE.agencies].sort((a, b) => a.name.localeCompare(b.name))) {
  const row = element('tr')
  const name = element('th')
  name.scope = 'row'
  const identity = element('span', 'flex items-center gap-1.5')
  identity.append(agencyMark(agency.name, 'size-8'), element('span', '', agency.name))
  name.append(identity)
  row.append(name, element('td', '', AGENCY_TYPES[agency.type]),
    element('td', '', agency.targets.map(id => GUIDE.audiences[id]).join(', ')),
    element('td', '', agency.level))
  byId('directory-rows').append(row)
}

const genreIcons = { ACTION: 'zap', COMEDY: 'laugh', DRAMA: 'drama', ROMANCE: 'heart' }
for (const [id, icon] of Object.entries(genreIcons)) {
  const name = tagsById.get(id).name
  const button = element('button', 'outline-action inline-flex items-center justify-start gap-2 text-ink')
  button.append(lucideIcon(icon), element('span', '', name))
  button.type = 'button'
  button.setAttribute('aria-label', 'Add ' + name)
  button.addEventListener('click', () => {
    search.value = ''
    closePicker()
    setTagSelected(id, true)
    tagToggle.focus({ preventScroll: true })
  })
  quickGenres.append(button)
}
const syncPrimarySteppers = [
  mountNumberStepper(commercial, 'commercial score'),
  mountNumberStepper(artistic, 'artistic score'),
  mountNumberStepper(owned, 'owned screenings', { width: 'w-30' })
]
restore()
syncPrimarySteppers.forEach(sync => sync())
refreshSelection()
byId('example').addEventListener('click', () => {
  setFilm(true)
  byId('reset').focus()
  announce('Example film loaded.')
})
byId('reset').addEventListener('click', () => {
  setFilm(false)
  search.focus()
  announce('Film cleared.')
})
search.addEventListener('input', () => {
  browseCategory = ''
  openPicker()
})
search.addEventListener('focus', openPicker)
search.addEventListener('click', () => { if (tagPopup.hidden) openPicker() })
tagToggle.addEventListener('click', () => {
  if (tagPopup.hidden) openPicker()
  else closePicker()
})
tagBack.addEventListener('click', event => {
  browseCategory = ''
  if (event.detail === 0) search.focus({ preventScroll: true })
  else {
    tagToggle.focus({ preventScroll: true })
    openPicker()
  }
})
window.addEventListener('resize', positionPicker)
window.addEventListener('scroll', positionPicker, { passive: true })
window.visualViewport?.addEventListener('resize', positionPicker)
window.visualViewport?.addEventListener('scroll', positionPicker)
tagPicker.addEventListener('focusout', event => {
  if (event.relatedTarget && !tagPicker.contains(event.relatedTarget)) closePicker()
})
tagPicker.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || event.isComposing || tagPopup.hidden) return
  event.preventDefault()
  if (tagPopup.contains(document.activeElement)) tagToggle.focus({ preventScroll: true })
  closePicker()
})
document.addEventListener('pointerdown', event => {
  if (!tagPicker.contains(event.target)) closePicker()
})
search.addEventListener('keydown', event => {
  if (event.isComposing) return
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    if (tagPopup.hidden) openPicker()
    movePickerFocus([...matches.querySelectorAll('[role="option"]')], event.key === 'ArrowDown' ? 1 : -1)
    return
  }
  if (event.key !== 'Enter' || tagPopup.hidden) return
  const active = byId(search.getAttribute('aria-activedescendant'))
  const option = active ?? (search.value.trim() ? matches.querySelector('[role="option"]') : null)
  if (option) {
    event.preventDefault()
    choosePickerOption(option)
  }
})
matches.addEventListener('mousedown', event => {
  if (event.target.closest('[role="option"]')) event.preventDefault()
})
matches.addEventListener('click', event => {
  const option = event.target.closest('[role="option"]')
  if (option) choosePickerOption(option)
})
function openLinkedDetails() {
  const target = document.getElementById(location.hash.slice(1))
  if (target instanceof HTMLDetailsElement) target.open = true
}
window.addEventListener('hashchange', openLinkedDetails)
openLinkedDetails()
for (const input of [commercial, artistic]) {
  input.addEventListener('input', () => {
    showingExample = false
    refreshResults()
  })
}
owned.addEventListener('input', refreshResults)
byId('more').addEventListener('click', () => {
  showAll = !showAll
  refreshResults()
})
