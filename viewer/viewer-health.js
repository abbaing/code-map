export function scoreToHealthKey(score) {
  if (score >= 9.5) {
    return 'excellent'
  }
  if (score >= 8.5) {
    return 'very-good'
  }
  if (score >= 7.5) {
    return 'good'
  }
  if (score >= 6.5) {
    return 'fair'
  }
  if (score >= 5) {
    return 'low'
  }
  return 'critical'
}

export function healthPill(score) {
  const levels = [
    [9.5, 'Excellent', 'excellent', 'bg-emerald-50 text-emerald-700 border border-emerald-100'],
    [8.5, 'Very good', 'very-good', 'bg-emerald-50 text-emerald-700 border border-emerald-100'],
    [7.5, 'Good', 'good', 'bg-blue-50 text-blue-700 border border-blue-100'],
    [6.5, 'Fair', 'fair', 'bg-amber-50 text-amber-700 border border-amber-100'],
    [5, 'Low', 'low', 'bg-orange-50 text-orange-700 border border-orange-100']
  ]
  if (!score) {
    return healthResult('N/A', 'n/a', 'bg-gray-50 text-gray-600 border border-gray-100')
  }
  const level = levels.find(([minimum]) => score >= minimum)
  return level
    ? healthResult(level[1], level[2], level[3])
    : healthResult('Critical', 'critical', 'bg-red-50 text-red-700 border border-red-100')
}

export function healthDescription(key) {
  const descriptions = {
    excellent: 'Very strong score. The files are small, focused, and have few outside links.',
    'very-good': 'Strong score. The module looks clear and easy to change.',
    good: 'Good score. There may be small issues, but the module is mostly healthy.',
    fair: 'Medium score. Check this module before making big changes.',
    low: 'Low score. This module likely has too many links or mixed responsibilities.',
    critical: 'Very low score. Review this module carefully before changing it.',
    'n/a': 'No score is available for this module.'
  }
  return descriptions[key] ?? descriptions['n/a']
}

function healthResult(label, key, className) {
  return { label, className, description: healthDescription(key) }
}
