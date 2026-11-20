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

// Release defaults from Hollywood Animal Steam build 26402049.
// Group weights are in the order baseline, artistic, commercial.
const releaseGroupWeights = {
  TM: [0.15, 0.05, 0.20],
  TF: [0.15, 0.05, 0.20],
  YM: [0.30, 0.40, 0.25],
  YF: [0.30, 0.30, 0.25],
  AM: [0.05, 0.10, 0.10],
  AF: [0.05, 0.10, 0.10]
}
const adReachByWeek = [0.25, 0.45, 0.60, 0.70, 0.80, 0.90, 0.95, 1, 1, 0.95, 0.90, 0.85, 0.75, 0.60, 0.30, 0.10]
const adEfficiencyByLevel = [0.15, 0.30, 0.50]
const adFadeAfterCampaign = [0.95, 0.85, 0.70, 0.20]
const openingWeekReachIndex = 8
const defaultAudienceFractions = [0.10, 0.05, 0.05]
const releaseMarket = 30_000_000
const viewersPerScreening = 400

function estimateScreenings(selection, commercial, artistic, owned, plan) {
  const agency = plan?.agencies[0]
  const preRelease = plan?.duration[0] ?? 0
  const campaignLength = plan?.duration.reduce((sum, weeks) => sum + weeks, 0) ?? 0
  const art = artistic / 10
  const com = commercial / 10
  // The final scores are available, so use their mean as a proxy for the in-game baseline.
  const baseline = (art + com) / 2
  const audienceShares = [baseline * 0.55, art * 0.15, com * 0.30]
  const retentionModifiers = [
    1 - Math.max(0, art - com),
    1 - Math.max(0, com - art),
    1 - Math.max(0, art - com)
  ]
  const groups = audienceAffinities(selection).map(({ id, score }) => ({
    retention: score,
    shares: releaseGroupWeights[id].map((weight, index) => weight * audienceShares[index]),
    adScoreTypes: agency?.adAudiences[id] ?? []
  }))

  return Array.from({ length: 8 }, (_, week) => {
    const visibility = adReachByWeek[openingWeekReachIndex + week]
    const campaignWeek = preRelease + week
    const activeReach = adReachByWeek[Math.min(campaignWeek, campaignLength)] ?? 0
    const fade = campaignWeek < campaignLength ? 1 : (adFadeAfterCampaign[campaignWeek - campaignLength] ?? 0)
    const adBoost = agency ? adEfficiencyByLevel[agency.level - 1] * activeReach * fade : 0
    const share = groups.reduce((sum, { retention, shares, adScoreTypes }) =>
      sum + shares.reduce((subtotal, share, index) => {
        const reach = defaultAudienceFractions[index] * visibility + (adScoreTypes.includes(index) ? adBoost : 0)
        return subtotal + share * reach * (retention * retentionModifiers[index]) ** week
      }, 0), 0)
    const demand = releaseMarket * share
    const target = Math.max(0, Math.ceil(demand / viewersPerScreening - 1e-9))
    return { target, toRent: Math.max(0, target - owned) }
  })
}
