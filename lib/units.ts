export type UnitSystem = 'metric-mm' | 'metric-m' | 'imperial-ft';

export const MM_TO_FT = 1 / 304.8;
export const FT_TO_MM = 304.8;

export const formatDisplayValue = (mmValue: number, unitSystem: UnitSystem): string => {
    switch (unitSystem) {
        case 'imperial-ft':
            return `${(mmValue * MM_TO_FT).toFixed(2)} ft`;
        case 'metric-m':
            return `${(mmValue / 1000).toFixed(2)} m`;
        case 'metric-mm':
        default:
            return `${Math.round(mmValue)} mm`;
    }
};

export const fromStoreValue = (mmValue: number, unitSystem: UnitSystem): number => {
    switch (unitSystem) {
        case 'imperial-ft':
            return mmValue * MM_TO_FT;
        case 'metric-m':
            return mmValue / 1000;
        case 'metric-mm':
        default:
            return mmValue;
    }
};

export const toStoreValue = (displayValue: number, unitSystem: UnitSystem): number => {
    switch (unitSystem) {
        case 'imperial-ft':
            return displayValue * FT_TO_MM;
        case 'metric-m':
            return displayValue * 1000;
        case 'metric-mm':
        default:
            return displayValue;
    }
};

export const getUnitLabel = (unitSystem: UnitSystem): string => {
    switch (unitSystem) {
        case 'imperial-ft':
            return 'ft';
        case 'metric-m':
            return 'm';
        case 'metric-mm':
        default:
            return 'mm';
    }
};
