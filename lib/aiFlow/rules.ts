import type { FlowState } from './types';

export interface RulesContext {
  guestMath: string;
  warnings: string[];
}

export function computeTableCount(
  guestCount?: number,
  seatCapacity?: number,
  explicitCount?: number
): number | null {
  if (explicitCount && explicitCount > 0) return explicitCount;
  if (!guestCount || !seatCapacity || seatCapacity <= 0) return null;
  return Math.ceil(guestCount / seatCapacity);
}

export function checkRoomCapacity(
  widthMm?: number,
  heightMm?: number,
  guestCount?: number
): string | null {
  if (!widthMm || !heightMm || !guestCount || guestCount <= 0) return null;
  const areaSqM = (widthMm / 1000) * (heightMm / 1000);
  const capacity = Math.floor(areaSqM / 1.5);
  if (guestCount > capacity) {
    return `Warning: ${guestCount} guests may exceed comfortable capacity for this space (~${capacity} guests at 1.5m² per guest). Consider reducing guest count or expanding the space.`;
  }
  return null;
}

export function getRulesContext(state: FlowState): string {
  const lines: string[] = [];
  const warnings: string[] = [];

  if (state.guestCount) {
    lines.push(`Guest count: ${state.guestCount} guests.`);
    if (state.tableType && state.chairsPerTable) {
      const tables = computeTableCount(state.guestCount, state.chairsPerTable);
      if (tables) lines.push(`${state.chairsPerTable} seats per table implies about ${tables} tables (${state.guestCount} / ${state.chairsPerTable} = ${tables}).`);
    } else if (state.chairType) {
      lines.push(`${state.guestCount} loose chairs needed (one per guest).`);
    }
  }

  const capacityWarning = checkRoomCapacity(state.widthMm, state.heightMm, state.guestCount);
  if (capacityWarning) warnings.push(capacityWarning);

  if (warnings.length > 0) {
    lines.push(warnings.join(' '));
  }

  return lines.join('\n');
}
