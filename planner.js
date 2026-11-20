// SPDX-License-Identifier: GPL-3.0-only
// Recommendation rules adapted from CallOn84's v2.18.0 script.js. See README.md.

const AGENCY_TYPES = ['Universal', 'Artistic', 'Commercial']
const tagsById = new Map(GUIDE.tags.map(tag => [tag.id, tag]))

function audienceAffinities(selection) {
  const audienceIds = Object.keys(GUIDE.audiences)
  // Sort by the original form's category order before summing the weights.
  const entries = [...selection].sort(([a], [b]) =>
    GUIDE.categories.indexOf(tagsById.get(a).category) - GUIDE.categories.indexOf(tagsById.get(b).category))
  const genreTotal = entries.reduce((total, [id, share]) =>
    total + (tagsById.get(id).category === 'Genre' ? share : 0), 0)
  const raw = audienceIds.map(audience => entries.reduce((total, [id, share]) => {
    const tag = tagsById.get(id)
    const multiplier = tag.category === 'Genre' ? share / (genreTotal || 1) : 1
    return total + tag.weights[audience] * multiplier
  }, 0))
  const lift = Math.max(0, 1 - Math.min(...raw))
  const adjusted = raw.map(value => value + lift)
  const sum = adjusted.reduce((total, value) => total + value, 0)
  return audienceIds.map((id, index) => ({
    id, score: Math.min(1, adjusted[index] / sum * 3)
  }))
}

function planCampaign(selection, commercial, artistic) {
  const audienceIds = Object.keys(GUIDE.audiences)
  const audiences = audienceAffinities(selection)
    .filter(({ score }) => score > 0.33)
    .map(({ id, score }) => ({ id, name: GUIDE.audiences[id], score, high: score >= 0.67 }))
    .sort((a, b) => b.score - a.score)

  const scoreDifference = Math.round((artistic - commercial) * 100)
  let lean = 0
  if (scoreDifference > 10) lean = 1
  if (scoreDifference < -10) lean = 2

  const agencies = GUIDE.agencies.map(agency => {
    const matches = audiences.filter(audience => Object.hasOwn(agency.adAudiences, audience.id))
    const penalty = agency.type !== 0 && agency.type !== lean ? 10 : 0
    const score = matches.length * 5 + agency.level - penalty
    return { ...agency, matches, score }
  }).filter(row => row.matches.length && row.score > 0)
    .sort((a, b) => b.score - a.score || b.level - a.level || a.name.localeCompare(b.name))

  const high = audiences.filter(row => row.high)
  // The original holiday calculation preserves the source demographic order for tied bonuses.
  const targets = high.length ? audienceIds.filter(id => high.some(row => row.id === id))
    : audienceIds.filter(id => audiences.some(row => row.id === id))
  const holidays = GUIDE.holidays.map(holiday => {
    const bonuses = targets.map(id => ({ name: GUIDE.audiences[id], bonus: holiday.bonuses[id] }))
      .filter(row => row.bonus > 0)
      .sort((a, b) => b.bonus - a.bonus)
    return { name: holiday.name, bonuses, score: bonuses.reduce((total, row) => total + row.bonus, 0) }
  }).filter(row => row.score > 0).sort((a, b) => b.score - a.score)

  return { lean, audiences, agencies, holidays, duration: [6, 4, commercial >= 9 ? 4 : 0] }
}

// The release 2.18.0 distribution formula decays the Week 2 rental gap.
function estimateScreenings(commercial, owned) {
  const openingGap = Math.max(0, commercial * 2 * 1000 - owned)
  let rentalGap = Math.max(0, commercial * 1000 - owned)

  return Array.from({ length: 8 }, (_, week) => {
    if (week > 1) rentalGap *= 0.8
    const round = week < 4 ? Math.ceil : Math.floor
    return round(week === 0 ? openingGap : rentalGap)
  })
}
