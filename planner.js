// SPDX-License-Identifier: GPL-3.0-only
// Recommendation rules adapted from CallOn84's v2.18.0 script.js. See README.md.

const AGENCY_TYPES = ['Universal', 'Artistic', 'Commercial']
const tagsById = new Map(GUIDE.tags.map(tag => [tag.id, tag]))

function planCampaign(selection, commercial, artistic) {
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
  const audiences = audienceIds.map((id, index) => {
    const score = Math.min(1, adjusted[index] / sum * 3)
    return { id, name: GUIDE.audiences[id], score, high: score >= 0.67 }
  }).filter(row => row.score > 0.33).sort((a, b) => b.score - a.score)

  let lean = 0
  if (artistic > commercial + 0.1) lean = 1
  if (commercial > artistic + 0.1) lean = 2

  const agencies = GUIDE.agencies.map(agency => {
    const matches = audiences.filter(audience => agency.targets.includes(audience.id))
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

// Distribution estimate adapted upstream from aalbertinib's Hollywood Animal Master.
function estimateScreenings(commercial, owned) {
  const weeks = [Math.max(0, commercial * 2 * 1000 - owned), Math.max(0, commercial * 1000 - owned)]
  while (weeks.length < 8) weeks.push(weeks.at(-1) * 0.8)
  return weeks.map((value, index) => index < 4 ? Math.ceil(value) : Math.floor(value))
}
