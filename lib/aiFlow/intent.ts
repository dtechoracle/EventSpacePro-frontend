import type { LocalIntentResult } from './types';

export interface AiAsset {
  id?: string;
  name?: string;
  category?: string;
  src?: string;
  tags?: string[];
}

const SPACE_DIMENSION_QUESTIONS: Record<string, string> = {
  custom: 'Great choice! What are the dimensions of your custom space? Please provide the width and height in meters, millimeters, or feet.',
  'grassy field': 'Great choice! What are the dimensions of the grassy field space you want to use? Please provide the width and height in meters, millimeters, or feet.',
  'parking lot': 'Great choice! What are the dimensions of the parking lot space you want to use? Please provide the width and height in meters, millimeters, or feet.',
  beach: 'Great choice! What are the dimensions of the beach space you want to use? Please provide the width and height in meters, millimeters, or feet.',
};

export function detectLocalIntent(
  normalizedCommand: string,
  assetList: AiAsset[]
): LocalIntentResult | null {
  const cmd = String(normalizedCommand || '').trim();

  const isNewLayoutIntent =
    cmd === 'i want to create a new layout' ||
    cmd === 'create a new layout' ||
    cmd === 'new layout' ||
    cmd === 'start a new layout' ||
    cmd === 'create layout' ||
    cmd === 'start a plan' ||
    cmd === 'create a space' ||
    cmd === 'design an event';

  if (isNewLayoutIntent) {
    return {
      payload: {
        followUp: 'Would you like to use one of our event location and space options?',
        choices: ['Custom', 'Marquee', 'Grassy field', 'Parking lot', 'Beach', 'Preloaded venues'],
      },
      reset: true,
      intent: 'new-layout',
    };
  }

  if (cmd === 'custom') {
    return {
      payload: { followUp: SPACE_DIMENSION_QUESTIONS.custom },
      intent: 'space-type',
      slots: { spaceType: 'custom' },
    };
  }

  if (cmd === 'grassy field' || cmd === 'grassy' || cmd === 'field') {
    return {
      payload: { followUp: SPACE_DIMENSION_QUESTIONS['grassy field'] },
      intent: 'space-type',
      slots: { spaceType: 'grassy field' },
    };
  }

  if (cmd === 'parking lot' || cmd === 'parking' || cmd === 'car park' || cmd === 'park') {
    return {
      payload: { followUp: SPACE_DIMENSION_QUESTIONS['parking lot'] },
      intent: 'space-type',
      slots: { spaceType: 'parking lot' },
    };
  }

  if (cmd === 'beach') {
    return {
      payload: { followUp: SPACE_DIMENSION_QUESTIONS.beach },
      intent: 'space-type',
      slots: { spaceType: 'beach' },
    };
  }

  if (cmd === 'marquee' || cmd === 'tent') {
    const marqueeOptions = assetList.filter((a) => a.category === 'Marquee');
    return {
      payload: {
        assetSelection: {
          category: 'marquee',
          message: 'Excellent! Which marquee would you like to use for your event?',
          options: marqueeOptions,
        },
      },
      intent: 'space-type',
      slots: { spaceType: 'marquee' },
    };
  }

  if (cmd === 'preloaded venues' || cmd === 'preloaded venue' || cmd === 'preloaded' || cmd === 'venue' || cmd === 'venues') {
    const venueOptions = assetList.filter((a) => a.category === 'Venue');
    return {
      payload: {
        assetSelection: {
          category: 'venue',
          message: 'Excellent! Which preloaded venue would you like to use for your event?',
          options: venueOptions,
        },
      },
      intent: 'space-type',
      slots: { spaceType: 'preloaded venues' as any },
    };
  }

  return null;
}
