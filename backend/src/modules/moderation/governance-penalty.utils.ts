export type GovernancePenaltyLevel = 'NORMAL' | 'SEVERE';

export function normalizeGovernancePenaltyLevel(value?: string | null): GovernancePenaltyLevel {
  return value === 'SEVERE' ? 'SEVERE' : 'NORMAL';
}

export function requiresBanForPenalty(level: GovernancePenaltyLevel) {
  return level === 'SEVERE';
}
