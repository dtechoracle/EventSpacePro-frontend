import type { NextApiRequest, NextApiResponse } from 'next';
import { getCompactAssetList, findAssetByName, searchAssetsByTags } from '@/lib/aiAssetLibrary';
import { WALL_TYPES, findWallType, TOOLBAR_OPERATIONS, LAYOUT_OPERATIONS } from '@/lib/aiOperations';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;

type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };
type Canvas = { width?: number; height?: number };
type SelectedAsset = {
  id: string;
  type?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { prompt, messages, canvas, selectedAssets, obstacles } = (req.body || {}) as {
      prompt?: string;
      messages?: ChatMessage[];
      canvas?: Canvas;
      selectedAssets?: SelectedAsset[];
      obstacles?: SelectedAsset[];
    };

    // ─── Build asset list ──────────────────────────────────────────────────────
    const assetList = getCompactAssetList();

    const commandText =
      prompt ||
      (Array.isArray(messages) && messages.length > 0
        ? messages[messages.length - 1]?.content
        : '');

    const normalizedCommand = String(commandText || '').trim().toLowerCase();
    const exactCommandText = String(commandText || '').trim();
    const normalizeIntentText = (value: string) =>
      String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s']/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const normalizedIntentText = normalizeIntentText(exactCommandText);
    const canonicalize = (value: string) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const commandCanonical = canonicalize(exactCommandText);
    const collapseRepeats = (value: string) => value.replace(/(.)\1{2,}/g, '$1');
    const intentTokens = normalizeIntentText(exactCommandText)
      .split(' ')
      .map((token) => collapseRepeats(token.trim()))
      .filter(Boolean);
    const isNearWord = (token: string, target: string, maxDistance = 1) => {
      if (!token || !target) return false;
      if (token === target) return true;
      if (Math.abs(token.length - target.length) > maxDistance) return false;
      const dp = Array.from({ length: token.length + 1 }, () => new Array(target.length + 1).fill(0));
      for (let i = 0; i <= token.length; i++) dp[i][0] = i;
      for (let j = 0; j <= target.length; j++) dp[0][j] = j;
      for (let i = 1; i <= token.length; i++) {
        let rowMin = Number.POSITIVE_INFINITY;
        for (let j = 1; j <= target.length; j++) {
          const cost = token[i - 1] === target[j - 1] ? 0 : 1;
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1,
            dp[i][j - 1] + 1,
            dp[i - 1][j - 1] + cost
          );
          rowMin = Math.min(rowMin, dp[i][j]);
        }
        if (rowMin > maxDistance) return false;
      }
      return dp[token.length][target.length] <= maxDistance;
    };
    const hasNearToken = (targets: string[], maxDistance = 1) =>
      intentTokens.some((token) => targets.some((target) => isNearWord(token, target, maxDistance)));
    const hasAnyPhrase = (text: string, phrases: string[]) => phrases.some((phrase) => text.includes(phrase));
    const isNegativeIntent = (text: string) => {
      if (!text) return false;
      return (
        /(^|\b)(?:no+|nah+|nope|none|nothing|without|skip)\b/.test(text) ||
        hasNearToken(['no', 'nah', 'nope', 'none', 'nothing', 'without', 'skip', 'dont', 'not'], 1) ||
        hasAnyPhrase(text, [
          "not at all",
          "not really",
          "no need",
          "no thanks",
          "don't add",
          "dont add",
          "do not add",
          "don't include",
          "dont include",
          "do not include",
          "don't need",
          "dont need",
          "do not need",
          "don't want",
          "dont want",
          "do not want",
          'no extras',
          'no additional feature',
          'no additional features',
          'nothing else',
          'none of that',
          'without a stage',
        ])
      );
    };
    const isAffirmativeIntent = (text: string) => {
      if (!text) return false;
      return (
        /(^|\b)(?:yes|yeah|yep|sure|okay|ok|alright|proceed|continue)\b/.test(text) ||
        hasNearToken(['yes', 'yeah', 'yep', 'sure', 'okay', 'ok', 'alright', 'proceed', 'continue'], 1) ||
        hasAnyPhrase(text, [
          'go ahead',
          'sounds good',
          'that works',
          'please do',
          'add it',
          'add one',
          'include one',
          'i want one',
          'i need one',
        ])
      );
    };
    const resolveLayoutScaleMode = (text: string) => {
      const lower = normalizeIntentText(text || '');
      if (!lower) return null;
      if (
        hasAnyPhrase(lower, [
          'fit to space',
          'fit the space',
          'fill the space',
          'use more of the space',
          'scale to fit',
          'make it bigger',
          'spread it out',
          'fit to room',
          'fit to wall',
          'fit to plan',
          'fill more of the room',
        ])
      ) return 'fit-space';
      if (
        hasAnyPhrase(lower, [
          'default size',
          'keep default',
          'keep it default',
          'original size',
          'actual size',
          'real size',
          'keep it as is',
          'leave it as is',
        ]) ||
        isNegativeIntent(lower)
      ) return 'default-size';
      return null;
    };
    const stripVariantSuffix = (name: string) => name.replace(/ \d{2}$/, '').trim();
    const userTokensMatchAsset = (userText: string, assetName: string) => {
      if (!/\b\d+\s*seater\b/i.test(userText)) return false;
      const coreName = stripVariantSuffix(assetName.toLowerCase());
      const assetTokens = coreName.split(/\s+/).filter(t => t.length > 1);
      if (assetTokens.length === 0) return false;
      const lower = userText.toLowerCase();
      const anchorMatch = lower.match(/\b(\d+)\s*seater\s*(?:\w+\s+)*?table\b/i) || lower.match(/\b(\d+)\s*seater\b/i);
      if (!anchorMatch) return false;
      const rawTokens = anchorMatch[0].split(/\s+/).filter(t => t.length > 1);
      if (rawTokens.length < 2) return false;
      const userTokens = rawTokens.filter((t, i) => {
        if (!/^\d+(?:\.\d+)?$/.test(t)) return true;
        return rawTokens[i + 1] === 'seater' || rawTokens[i + 1] === 'seat';
      });
      if (userTokens.length < 2) return false;
      const assetSet = new Set(assetTokens);
      const tokenInAsset = (token: string) =>
        assetSet.has(token) ||
        assetSet.has(token.replace(/s$/, '')) ||
        coreName.includes(token) ||
        coreName.includes(token.replace(/s$/, ''));
      return userTokens.every(t => tokenInAsset(t));
    };
    const selectedExactAsset = findAssetByName(exactCommandText) || (
      /^i want to use the\s+/i.test(exactCommandText)
        ? findAssetByName(exactCommandText.replace(/^i want to use the\s+/i, ''))
        : null
    );
    const matchingTableCandidates = (() => {
      const hasExactVariant = assetList.some(a =>
        / \d{2}$/.test(a.name) && normalizedCommand.includes(a.name.toLowerCase())
      );
      if (hasExactVariant) return [];
      const matches = assetList.filter((a) => {
        if (a.category !== 'Furniture' || !a.name.toLowerCase().includes('table')) return false;
        return normalizedCommand.includes(a.name.toLowerCase()) ||
               normalizedCommand.includes(stripVariantSuffix(a.name.toLowerCase())) ||
               commandCanonical.includes(canonicalize(a.name)) ||
               userTokensMatchAsset(normalizedCommand, a.name);
      });
      return matches.length > 1 ? matches : [];
    })();
    const selectedMentionedAsset = (() => {
      if (matchingTableCandidates.length > 0) return null;
      return (
        selectedExactAsset ||
        assetList.find((asset) => normalizedCommand.includes(asset.name.toLowerCase())) ||
        assetList.find((asset) => normalizedCommand.includes(stripVariantSuffix(asset.name.toLowerCase()))) ||
        assetList.find((asset) => commandCanonical.includes(canonicalize(asset.name))) ||
        assetList.find((asset) => userTokensMatchAsset(normalizedCommand, asset.name)) ||
        null
      );
    })();
    const conversationHistory = Array.isArray(messages)
      ? messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role, content: m.content }))
      : [];
    const userHistory = conversationHistory.filter((m) => m.role === 'user');
    const assistantHistory = conversationHistory.filter((m) => m.role === 'assistant');
    const combinedHistoryText = `${conversationHistory.map((m) => m.content || '').join('\n')}\n${commandText || ''}`;
    const userHistoryText = `${userHistory.map((m) => m.content || '').join('\n')}\n${commandText || ''}`;
    const lowerHistoryText = combinedHistoryText.toLowerCase();
    const lowerUserHistoryText = userHistoryText.toLowerCase();
    const parseDimensionPair = (text: string) => {
      const raw = String(text || '');
      const patterns = [
        /(\d+(?:\.\d+)?)\s*(mm|m|ft)?\s*(?:x|by)\s*(\d+(?:\.\d+)?)\s*(mm|m|ft)?/i,
        /(?:about|roughly|around)?\s*(\d+(?:\.\d+)?)\s*(mm|m|ft)\s*(?:wide|width)?\s*(?:and|,)\s*(\d+(?:\.\d+)?)\s*(mm|m|ft)\s*(?:long|length|deep|height)?/i,
        /(?:about|roughly|around)?\s*(\d+(?:\.\d+)?)\s*(mm|m|ft)\s*(?:long|length|deep|height)\s*(?:and|,)\s*(\d+(?:\.\d+)?)\s*(mm|m|ft)\s*(?:wide|width)?/i,
      ];

      for (const pattern of patterns) {
        const match = raw.match(pattern);
        if (match) {
          return {
            widthValue: match[1],
            widthUnit: match[2],
            heightValue: match[3],
            heightUnit: match[4] || match[2],
          };
        }
      }
      return null;
    };
    const roomDimMatch = parseDimensionPair(userHistoryText);
    const toMm = (value?: string, unit?: string) => {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return null;
      const normalizedUnit = (unit || '').toLowerCase();
      if (normalizedUnit === 'm') return numeric * 1000;
      if (normalizedUnit === 'ft') return numeric * 304.8;
      return numeric;
    };
    const roomWidthMm = roomDimMatch ? toMm(roomDimMatch.widthValue, roomDimMatch.widthUnit) : null;
    const roomHeightMm = roomDimMatch ? toMm(roomDimMatch.heightValue, roomDimMatch.heightUnit) : null;
    const extractGuestCount = (text: string) => {
      const directMatch = String(text || '').match(/(?:about\s+)?(\d+)\s*[a-z]*\s*(?:guest|guests|attendee|attendees|people|persons)/i);
      if (!directMatch) return null;
      const value = Number(directMatch[1]);
      return Number.isFinite(value) ? value : null;
    };
    const extractTableCountAndCapacity = (text: string): { tableCount: number; seatCapacity: number } | null => {
      const lower = String(text || '').toLowerCase();
      const match = lower.match(/\b(\d+)\s+(\d+)\s*seater\s*(?:\w+\s+)*?tables?\b/i);
      if (!match) return null;
      const tableCount = Number(match[1]);
      const seatCapacity = Number(match[2]);
      if (!Number.isFinite(tableCount) || !Number.isFinite(seatCapacity)) return null;
      return { tableCount, seatCapacity };
    };
    const inferredTableCountAndCapacity = extractTableCountAndCapacity(userHistoryText);
    const explicitTableCount = inferredTableCountAndCapacity?.tableCount ?? null;
    const inferredGuestCount = inferredTableCountAndCapacity
      ? inferredTableCountAndCapacity.tableCount * inferredTableCountAndCapacity.seatCapacity
      : null;
    const guestCount = extractGuestCount(userHistoryText);
    const parseArrangementIntent = (text: string): string | null => {
      const lower = String(text || '').toLowerCase();
      const compact = canonicalize(lower);
      if (
        lower.includes('u-shape') ||
        lower.includes('u shape') ||
        lower.includes('u shaped') ||
        lower.includes('horseshoe') ||
        lower.includes('horse shoe') ||
        compact.includes('ushape') ||
        compact.includes('ushaped') ||
        compact.includes('horseshoe')
      ) return 'u-shape';
      if (lower.includes('boardroom') || compact.includes('boardroom') || hasNearToken(['boardroom'], 2)) return 'boardroom';
      if (
        lower.includes('classroom') ||
        lower.includes('lecture style') ||
        lower.includes('seminar style') ||
        lower.includes('rows facing front') ||
        compact.includes('classroom') ||
        hasNearToken(['classroom', 'lecture', 'seminar'], 2)
      ) return 'classroom';
      if (
        lower.includes('chevron') ||
        lower.includes('zig zag') ||
        lower.includes('zig-zag') ||
        lower.includes('zigzag') ||
        lower.includes('staggered') ||
        lower.includes('angled rows') ||
        compact.includes('chevron') ||
        compact.includes('zigzag') ||
        hasNearToken(['chevron', 'zigzag', 'staggered'], 2)
      ) return 'chevron';
      if (
        lower.includes('perimeter') ||
        lower.includes('around the wall') ||
        lower.includes('around the edge') ||
        lower.includes('by the edges') ||
        lower.includes('around the room') ||
        compact.includes('perimeter') ||
        hasNearToken(['perimeter', 'edge'], 2)
      ) return 'perimeter';
      if (
        lower.includes('circular') ||
        lower.includes('circle') ||
        lower.includes('round arrangement') ||
        lower.includes('semi circle') ||
        lower.includes('semi-circle') ||
        lower.includes('arc arrangement') ||
        lower.includes('around the center') ||
        compact.includes('circular') ||
        compact.includes('rounded') ||
        compact.includes('semicircle') ||
        hasNearToken(['circular', 'circle', 'round', 'arc'], 2)
      ) return 'circular';
      if (
        lower.includes('linear') ||
        lower.includes('single row') ||
        lower.includes('single file') ||
        lower.includes('in a line') ||
        lower.includes('straight line') ||
        compact.includes('linear') ||
        hasNearToken(['linear', 'line', 'row'], 2)
      ) return 'linear';
      if (
        lower.includes('grid') ||
        lower.includes('matrix') ||
        lower.includes('even rows and columns') ||
        lower.includes('balanced rows') ||
        compact.includes('grid') ||
        compact.includes('matrix') ||
        hasNearToken(['grid', 'matrix'], 1)
      ) return 'grid';
      return null;
    };
    const inferSpaceChoice = (text: string) => {
      const lower = String(text || '').toLowerCase();
      if (lower.includes('parking lot') || lower.includes('car park')) return 'parking lot';
      if (lower.includes('grassy field')) return 'grassy field';
      if (lower.includes('marquee')) return 'marquee';
      if (lower.includes('beach')) return 'beach';
      if (
        lower.includes('\ncustom') ||
        lower.includes('custom\n') ||
        lower.includes('custom space') ||
        lower.includes('custom')
      ) return 'custom';
      return null;
    };
    const selectedSpaceChoice = inferSpaceChoice(lowerUserHistoryText);
    const roomBasedConversation =
      selectedSpaceChoice === 'custom' ||
      selectedSpaceChoice === 'grassy field' ||
      selectedSpaceChoice === 'parking lot' ||
      selectedSpaceChoice === 'beach';
    const marqueeAssets = assetList.filter((asset) => asset.category === 'Marquee');
    const selectedMarqueeFromHistory =
      marqueeAssets
        .sort((a, b) => b.name.length - a.name.length)
        .find((asset) => lowerUserHistoryText.includes(asset.name.toLowerCase()) || lowerUserHistoryText.includes(canonicalize(asset.name))) || null;
    const selectedMarqueeForFlow =
      ((selectedMentionedAsset && selectedMentionedAsset.category === 'Marquee') ? selectedMentionedAsset : null) ||
      selectedMarqueeFromHistory ||
      null;
    const latestDimensionUserMessageIndex = (() => {
      for (let i = userHistory.length - 1; i >= 0; i--) {
        if (parseDimensionPair(userHistory[i]?.content || '')) return i;
      }
      return -1;
    })();
    const userRepliesAfterDimensions =
      latestDimensionUserMessageIndex >= 0
        ? userHistory
            .slice(latestDimensionUserMessageIndex + 1)
            .map((m) => String(m.content || '').trim())
            .filter(Boolean)
        : [];
    const storedLayoutBriefFromHistory = (() => {
      for (let i = 0; i < conversationHistory.length - 1; i++) {
        const current = conversationHistory[i];
        const next = conversationHistory[i + 1];
        if (
          current?.role === 'assistant' &&
          /in plain language, tell me what you want for this event layout|describe what you want for this event layout|describe the event layout you want/i.test(current.content || '') &&
          next?.role === 'user'
        ) {
          return String(next.content || '').trim();
        }
      }
      return '';
    })();
    const activeSpaceWidthMm =
      roomWidthMm ||
      (selectedMarqueeForFlow ? Number(selectedMarqueeForFlow.width || 0) : null) ||
      null;
    const activeSpaceHeightMm =
      roomHeightMm ||
      (selectedMarqueeForFlow ? Number(selectedMarqueeForFlow.height || 0) : null) ||
      null;
    const structuredSpaceConversation =
      roomBasedConversation ||
      (selectedSpaceChoice === 'marquee' && Boolean(selectedMarqueeForFlow)) ||
      Boolean(activeSpaceWidthMm && activeSpaceHeightMm);
    const draftedSpaceLabel =
      selectedSpaceChoice === 'marquee'
        ? `${selectedMarqueeForFlow?.name || 'marquee'} space`
        :
      selectedSpaceChoice === 'grassy field'
        ? 'grassy field space'
        : selectedSpaceChoice === 'parking lot'
          ? 'parking lot space'
          : selectedSpaceChoice === 'beach'
            ? 'beach space'
            : 'empty space';
    const roomDraftLabel =
      activeSpaceWidthMm && activeSpaceHeightMm
        ? `${activeSpaceWidthMm / 1000}m x ${activeSpaceHeightMm / 1000}m ${draftedSpaceLabel}`
        : draftedSpaceLabel;
    const roomSummaryPrompt =
      `I've drafted a ${roomDraftLabel} for you. In plain language, tell me what you want for this event layout. For example: "40 guests on the left side, a table with 2 chairs on the right, and a stage at the top."`;
    const currentPromptIsDimensionPair = Boolean(parseDimensionPair(exactCommandText));
    const latestAssistantPromptContent = String(assistantHistory[assistantHistory.length - 1]?.content || '');
    const currentPromptAlreadyInBriefHistory =
      storedLayoutBriefFromHistory.length > 0 &&
      normalizeIntentText(storedLayoutBriefFromHistory) === normalizedIntentText;
    const currentMessageHasLayoutContent = roomDimMatch && exactCommandText && (
      matchingTableCandidates.length > 0 ||
      /\bstage\b/.test(exactCommandText) ||
      extractGuestCount(exactCommandText) ||
      /\bseater\b|\btable\b|\bchairs?\b/.test(exactCommandText)
    );
    const layoutBriefText = /in plain language, tell me what you want for this event layout|describe what you want for this event layout|describe the event layout you want/i.test(latestAssistantPromptContent) && exactCommandText && !currentPromptIsDimensionPair
      ? exactCommandText
      : (storedLayoutBriefFromHistory || userRepliesAfterDimensions[0] || (currentMessageHasLayoutContent ? exactCommandText : '') || '');
    const normalizedLayoutBriefText = normalizeIntentText(layoutBriefText);
    const hasLayoutBrief = normalizedLayoutBriefText.length > 0;
    const parsePlanShare = (text: string) => {
      const fraction = String(text || '').match(/(\d+)\s*\/\s*(\d+)\s+of (?:the )?(?:entire )?(?:plan|space|room|layout)/i);
      if (fraction) {
        const numerator = Number(fraction[1]);
        const denominator = Number(fraction[2]);
        if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator > 0) {
          return Math.max(0.2, Math.min(0.95, numerator / denominator));
        }
      }
      if (/\bhalf\b|\bone half\b|50\s*%/i.test(text)) return 0.5;
      if (/\bthird\b|\bone third\b/i.test(text)) return 1 / 3;
      if (/\btwo thirds\b/i.test(text)) return 2 / 3;
      if (/\bquarter\b|\bone quarter\b|25\s*%/i.test(text)) return 0.25;
      if (/\bthree quarters\b|75\s*%/i.test(text)) return 0.75;
      return null;
    };
    const detectBriefSide = (text: string) => {
      const lower = String(text || '').toLowerCase();
      if (/\bleft\b/.test(lower)) return 'left';
      if (/\bright\b/.test(lower)) return 'right';
      if (/\btop\b/.test(lower)) return 'top';
      if (/\bbottom\b/.test(lower)) return 'bottom';
      if (/\bcenter\b|\bcentre\b|\bmiddle\b/.test(lower)) return 'center';
      return null;
    };
    const detectNamedZoneLabel = (text: string) => {
      const lower = String(text || '').toLowerCase();
      if (/\bjudges?\b/.test(lower)) return 'judges';
      if (/\bpanel\b/.test(lower)) return 'panel';
      if (/\bvips?\b/.test(lower)) return 'VIP';
      if (/\bspeakers?\b/.test(lower)) return 'speakers';
      if (/\bcouple(?:\s+table)?\b/.test(lower)) return 'couple';
      return null;
    };
    const guestZoneFromBrief = (() => {
      const share = parsePlanShare(layoutBriefText);
      const onlyChairs =
        /(\d+)\s*(?:chairs?|seats?|stools?)\s+(?:only|just)\b/i.test(layoutBriefText) ||
        /\b(?:with\s+)?only\s+(?:chairs?|seats?|stools?)\b/i.test(layoutBriefText) ||
        /\b(?:chairs?|seats?|stools?)\s+only\b/i.test(layoutBriefText) ||
        /\bjust\s+(?:chairs?|seats?|stools?)\b/i.test(layoutBriefText) ||
        /\b(?:chairs?|seats?|stools?)\s+(?:and\s+)?no\s+tables?\b/i.test(layoutBriefText) ||
        /\bno\s+tables?\b.{0,30}\b(?:chairs?|seats?|stools?)\b/i.test(layoutBriefText);
      const direct = layoutBriefText.match(/(\d+)\s*(?:guests?|people|attendees?).{0,50}?\b(left|right|top|bottom|center|centre|middle)\b/i);
      if (direct) {
        return { count: Number(direct[1]), side: detectBriefSide(direct[0]), share, onlyChairs };
      }
      const reverse = layoutBriefText.match(/\b(left|right|top|bottom|center|centre|middle)\b.{0,50}?(\d+)\s*(?:guests?|people|attendees?)/i);
      if (reverse) {
        return { count: Number(reverse[2]), side: detectBriefSide(reverse[0]), share, onlyChairs };
      }
      const chairsOnlyDirect = layoutBriefText.match(/(\d+)\s*(?:chairs?\b|seats?\b|stools?\b).{0,50}?\b(left|right|top|bottom|center|centre|middle)\b/i);
      if (chairsOnlyDirect) {
        return { count: Number(chairsOnlyDirect[1]), side: detectBriefSide(chairsOnlyDirect[0]), share, onlyChairs: true };
      }
      const chairsOnlyReverse = layoutBriefText.match(/\b(left|right|top|bottom|center|centre|middle)\b.{0,50}?(\d+)\s*(?:chairs?\b|seats?\b|stools?\b)/i);
      if (chairsOnlyReverse) {
        return { count: Number(chairsOnlyReverse[2]), side: detectBriefSide(chairsOnlyReverse[0]), share, onlyChairs: true };
      }
      const genericGuests = layoutBriefText.match(/(\d+)\s*(?:guests?|people|attendees?)/i);
      if (genericGuests) {
        let inferredSide: string | null = null;
        if (/\bright\b.{0,80}\btable\b/i.test(layoutBriefText) || /\bremaining\b.{0,80}\bright\b/i.test(layoutBriefText)) {
          inferredSide = 'left';
        } else if (/\bleft\b.{0,80}\btable\b/i.test(layoutBriefText) || /\bremaining\b.{0,80}\bleft\b/i.test(layoutBriefText)) {
          inferredSide = 'right';
        }
        return { count: Number(genericGuests[1]), side: inferredSide, share, onlyChairs };
      }
      return null;
    })();
    const stageBetweenTableAndDirection = (match: RegExpMatchArray) =>
      /\bstage\b/i.test(match[0]);

    const secondaryTableZoneFromBrief = (() => {
      const direct = layoutBriefText.match(/table(?:(?:\s+\w+){0,12}?\s+(?:with|and|plus|just)\s+(\d+)\s+chairs?)?.{0,50}?\b(left|right|top|bottom|center|centre|middle)\b/i);
      if (direct && !stageBetweenTableAndDirection(direct)) {
        return {
          chairCount: direct[1] ? Number(direct[1]) : null,
          side: detectBriefSide(direct[0]),
          zoneLabel: detectNamedZoneLabel(direct[0]),
          zoneCount: null,
          requiresSeating: Boolean(direct[1]),
        };
      }
      const reverse = layoutBriefText.match(/\b(left|right|top|bottom|center|centre|middle)\b.{0,50}?table(?:(?:\s+\w+){0,12}?\s+(?:with|and|plus|just)\s+(\d+)\s+chairs?)?/i);
      if (reverse && !stageBetweenTableAndDirection(reverse)) {
        return {
          chairCount: reverse[2] ? Number(reverse[2]) : null,
          side: detectBriefSide(reverse[0]),
          zoneLabel: detectNamedZoneLabel(reverse[0]),
          zoneCount: null,
          requiresSeating: Boolean(reverse[2]),
        };
      }
      const namedZoneMatch = layoutBriefText.match(/(\d+)\s*(judges?|panel|vips?|speakers?|couple)(?:\s+\w+){0,8}?\b(left|right|top|bottom|center|centre|middle)\b(?:\s+\w+){0,12}?\btable\b/i);
      if (namedZoneMatch) {
        return {
          chairCount: null,
          side: detectBriefSide(namedZoneMatch[0]),
          zoneLabel: detectNamedZoneLabel(namedZoneMatch[2]),
          zoneCount: Number(namedZoneMatch[1]),
          requiresSeating: true,
        };
      }
      const namedZoneReverse = layoutBriefText.match(/\b(left|right|top|bottom|center|centre|middle)\b(?:\s+\w+){0,10}?(\d+)\s*(judges?|panel|vips?|speakers?|couple)(?:\s+\w+){0,12}?\btable\b/i);
      if (namedZoneReverse) {
        return {
          chairCount: null,
          side: detectBriefSide(namedZoneReverse[0]),
          zoneLabel: detectNamedZoneLabel(namedZoneReverse[3]),
          zoneCount: Number(namedZoneReverse[2]),
          requiresSeating: true,
        };
      }
      return null;
    })();
    const briefMentionsDirectionalZones = /\b(left|right|top|bottom|center|centre|middle|front|back)\b/i.test(layoutBriefText);
    const briefMentionsMultipleZones =
      ((/\bleft\b/i.test(layoutBriefText) ? 1 : 0) +
        (/\bright\b/i.test(layoutBriefText) ? 1 : 0) +
        (/\btop\b/i.test(layoutBriefText) ? 1 : 0) +
        (/\bbottom\b/i.test(layoutBriefText) ? 1 : 0) +
        (/\bcenter\b|\bcentre\b|\bmiddle\b/i.test(layoutBriefText) ? 1 : 0)) >= 2;
    const tableAssets = assetList.filter(
      (asset) => asset.category === 'Furniture' && asset.name.toLowerCase().includes('table')
    );
    const guestSetupAssets = assetList.filter((asset) => {
      if (asset.category !== 'Furniture') return false;
      const lower = asset.name.toLowerCase();
      if (lower.includes('chair') || lower.includes('stool') || lower.includes('sofa')) return false;
      if (lower.includes('table')) return true;
      return /\b\d+\s*seater\b/i.test(lower);
    });
    const chairAssets = assetList.filter((asset) => {
      const label = asset.name.toLowerCase();
      return (
        asset.category === 'Furniture' &&
        !label.includes('table') &&
        !label.includes('sofa') &&
        (label.includes('chair') || label.includes('stool'))
      );
    });
    const stageAssets = assetList.filter(
      (asset) => asset.name.toLowerCase().includes('stage')
    );
    const STAGE_MODULE_MM = 500;
    const buildStageSpec = (widthMm: number, heightMm: number, name?: string) => ({
      name: name || `${Math.max(1, Math.round(widthMm / STAGE_MODULE_MM))} x ${Math.max(1, Math.round(heightMm / STAGE_MODULE_MM))} Modular Stage`,
      width: Math.max(STAGE_MODULE_MM, Math.round(widthMm)),
      height: Math.max(STAGE_MODULE_MM, Math.round(heightMm)),
    });
    const resolveMentionedFurnitureAsset = (
      text: string,
      predicate: (asset: typeof assetList[number]) => boolean
    ) => {
      const exact = findAssetByName(text);
      if (exact && predicate(exact as any)) return exact as any;
      const normalized = String(text || '').toLowerCase();
      const canonical = canonicalize(text);
      return (
        assetList
          .filter(predicate)
          .sort((a, b) => b.name.length - a.name.length)
          .find(
            (asset) =>
              normalized.includes(asset.name.toLowerCase()) ||
              canonical.includes(canonicalize(asset.name))
          ) || null
      );
    };
    const selectedTableFromHistory =
      tableAssets
        .sort((a, b) => b.name.length - a.name.length)
        .find((asset) => lowerUserHistoryText.includes(asset.name.toLowerCase())) || null;
    const selectedStageFromHistory =
      stageAssets
        .sort((a, b) => b.name.length - a.name.length)
        .find((asset) => lowerUserHistoryText.includes(asset.name.toLowerCase()) || lowerUserHistoryText.includes(canonicalize(asset.name))) || null;
    const selectedChairFromHistory =
      chairAssets
        .sort((a, b) => b.name.length - a.name.length)
        .find((asset) => lowerUserHistoryText.includes(asset.name.toLowerCase()) || lowerUserHistoryText.includes(canonicalize(asset.name))) || null;
    const mainGuestTableFromHistory = (() => {
      for (let i = 0; i < conversationHistory.length - 1; i++) {
        const current = conversationHistory[i];
        const next = conversationHistory[i + 1];
        if (
          current?.role === 'assistant' &&
          /what table or seating setup should i use first|what table would you like me to pair it with|what table or seating setup would you like to use(?: first)?/i.test(current.content || '') &&
          next?.role === 'user'
        ) {
          return resolveMentionedFurnitureAsset(next.content || '', (asset) =>
            asset.category === 'Furniture' && asset.name.toLowerCase().includes('table')
          );
        }
      }
      return null;
    })();
    const mainGuestChairFromHistory = (() => {
      for (let i = 0; i < conversationHistory.length - 1; i++) {
        const current = conversationHistory[i];
        const next = conversationHistory[i + 1];
        if (
          current?.role === 'assistant' &&
          /what chair or stool would you like me to use for the .* seats|what chair should i use for the .* guest area|select seating for the guest area/i.test(current.content || '') &&
          next?.role === 'user'
        ) {
          return resolveMentionedFurnitureAsset(next.content || '', (asset) => {
            const label = asset.name.toLowerCase();
            return asset.category === 'Furniture' && !label.includes('table') && !label.includes('sofa') && (label.includes('chair') || label.includes('stool'));
          });
        }
      }
      return null;
    })();
    const stageChoiceKnown = Boolean(selectedStageFromHistory);
    const stageMentioned = /\bstage\b|\bno stage\b/.test(lowerUserHistoryText);
    const extrasMentioned = /\bdance floor\b|\bentrance door\b|\bdoor\b|\bvip\b|\bbuffet\b|\bbar\b|\bpresentation\b|\bnone\b|\bno extras\b|\bnothing else\b/.test(lowerUserHistoryText);
    const lastAssistantPromptType = (() => {
      for (let i = assistantHistory.length - 1; i >= 0; i--) {
        const content = String(assistantHistory[i]?.content || '');
        if (/in plain language, tell me what you want for this event layout|describe what you want for this event layout|describe the event layout you want/i.test(content)) return 'layout-summary';
        if (/what table should i use on the .* side for that smaller table area|what table should i use for the .* side table area|what table should i use there/i.test(content)) return 'secondary-zone-table';
        if (/what chair should i pair with that .* side table|what seating should i use for that .* side table|what chair should i pair with the .* table area|what chair would you like to pair with the .* (?:right|left|top|bottom) side|would you like to add any specific chairs around the .* table.*select the chair type|which chair would you like around the .* table|which chair would you like to use(?: for| with)? the .* right side|what chair would you like to use(?: for| with)? the .* right side/i.test(content)) return 'secondary-zone-chair';
        if (/would you like to include any additional features/i.test(content)) return 'extras';
        if (/would you like me to scale the layout to use more of the available space|keep it at default size|fit to space|keep default size/i.test(content)) return 'layout-scale';
        if (/where should i place the stage|where would you like the stage/i.test(content)) return 'stage-placement';
        if (/what size would you like for the stage|select a stage/i.test(content)) return 'stage-size';
        if (/would you like to add a stage/i.test(content)) return 'stage-yes-no';
        if (/what chair would you like to pair|select a chair|select seating for this table|what seating would you like to pair/i.test(content)) return 'chair-choice';
        if (/how many chairs should i place around each table|how many seats should i place around each table|chairs per table/i.test(content)) return 'chairs-per-table';
        if (/how many guests|number of guests|guest count|how many people|how many attendees|capacity|roughly how many guests/i.test(content)) return 'guest-count';
        if (/what type of seating|what type of tables|what table|round tables|rectangular tables|select a table|select seating/i.test(content)) return 'table-choice';
        if (/how would you like those .* arranged|how would you like them arranged|arrangement/i.test(content)) return 'arrangement';
        if (/would you like to proceed with generating|generate the layout now|generate now|ready to proceed|should i generate/i.test(content)) return 'generate';
        if (/landscape or portrait|portrait or landscape/i.test(content)) return 'orientation';
      }
      return null;
    })();
    const assistantAskedForOrientation = lastAssistantPromptType === 'orientation';
    const orientationReply = (() => {
      if (!assistantAskedForOrientation) return null;
      const lower = exactCommandText.toLowerCase();
      if (/\bportrait\b/.test(lower)) return 'portrait';
      if (/\blandscape\b/.test(lower)) return 'landscape';
      return null;
    })();
    const orientationFromHistory = (() => {
      for (let i = 0; i < conversationHistory.length - 1; i++) {
        const current = conversationHistory[i];
        const next = conversationHistory[i + 1];
        if (current?.role === 'assistant' && /landscape or portrait|portrait or landscape/i.test(current.content || '') && next?.role === 'user') {
          const lower = String(next.content || '').toLowerCase();
          if (/\bportrait\b/.test(lower)) return 'portrait';
          if (/\blandscape\b/.test(lower)) return 'landscape';
        }
      }
      return null;
    })();
    const orientationValue = orientationReply || orientationFromHistory || null;
    const orientationKnown = orientationValue === 'landscape' || orientationValue === 'portrait';
    const assistantAskedForLayoutSummary = lastAssistantPromptType === 'layout-summary';
    const assistantAskedForSecondaryZoneTable = lastAssistantPromptType === 'secondary-zone-table';
    const assistantAskedForSecondaryZoneChair = lastAssistantPromptType === 'secondary-zone-chair';
    const assistantAskedForGuestCount = lastAssistantPromptType === 'guest-count';
    const assistantAskedForStage = lastAssistantPromptType === 'stage-yes-no';
    const assistantAskedForStageSize = lastAssistantPromptType === 'stage-size';
    const assistantAskedForStagePlacement = lastAssistantPromptType === 'stage-placement';
    const assistantAskedForChairChoice = lastAssistantPromptType === 'chair-choice';
    const assistantAskedForChairsPerTable = lastAssistantPromptType === 'chairs-per-table';
    const assistantAskedForArrangement = lastAssistantPromptType === 'arrangement';
    const assistantAskedForLayoutScale = lastAssistantPromptType === 'layout-scale';
    const assistantAskedForExtras = lastAssistantPromptType === 'extras';
    const assistantAskedForGeneration = lastAssistantPromptType === 'generate';
    const arrangementTypeFromHistory = (() => {
      for (let i = 0; i < conversationHistory.length - 1; i++) {
        const current = conversationHistory[i];
        const next = conversationHistory[i + 1];
        if (
          current?.role === 'assistant' &&
          /how would you like those .* arranged|how would you like them arranged|what arrangement would you like/i.test(current.content || '') &&
          next?.role === 'user'
        ) {
          const parsed = parseArrangementIntent(next.content || '');
          if (parsed) return parsed;
        }
      }
      return null;
    })();
    const arrangementTypeFromCurrentInput = assistantAskedForArrangement
      ? parseArrangementIntent(exactCommandText)
      : null;
    const arrangementAlreadyKnown = Boolean(arrangementTypeFromHistory || arrangementTypeFromCurrentInput);
    const arrangementType = arrangementTypeFromCurrentInput || arrangementTypeFromHistory || 'grid';
    const arrangementReply = Boolean(arrangementTypeFromCurrentInput);
    const parsedGuestCountFromCurrentReply = (() => {
      if (!assistantAskedForGuestCount) return null;
      const match = exactCommandText.match(/(\d{1,5})/);
      if (!match) return null;
      const value = Number(match[1]);
      return Number.isFinite(value) ? value : null;
    })();
    const guestCountFromPromptHistory = (() => {
      for (let i = conversationHistory.length - 2; i >= 0; i--) {
        const current = conversationHistory[i];
        const next = conversationHistory[i + 1];
        if (
          current?.role === 'assistant' &&
          /how many guests|number of guests|guest count|how many people|how many attendees|capacity|roughly how many guests/i.test(current.content || '') &&
          next?.role === 'user'
        ) {
          const explicit = extractGuestCount(next.content || '');
          if (explicit) return explicit;
          const numeric = String(next.content || '').match(/(\d{1,5})/);
          if (numeric) {
            const value = Number(numeric[1]);
            if (Number.isFinite(value)) return value;
          }
        }
      }
      return null;
    })();
    const effectiveGuestCount =
      guestCount ||
      parsedGuestCountFromCurrentReply ||
      guestCountFromPromptHistory ||
      guestZoneFromBrief?.count ||
      inferredGuestCount ||
      null;
    const noStageReply =
      assistantAskedForStage &&
      isNegativeIntent(normalizedIntentText);
    const yesStageReply =
      assistantAskedForStage &&
      !isNegativeIntent(normalizedIntentText) &&
      (isAffirmativeIntent(normalizedIntentText) || normalizedIntentText.includes('stage'));
    const stageDecisionFromHistory = (() => {
      for (let i = conversationHistory.length - 2; i >= 0; i--) {
        const current = conversationHistory[i];
        const next = conversationHistory[i + 1];
        if (
          current?.role === 'assistant' &&
          /would you like to add a stage/i.test(current.content || '') &&
          next?.role === 'user'
        ) {
          const reply = normalizeIntentText(next.content || '');
          if (isNegativeIntent(reply)) return 'declined';
          if (isAffirmativeIntent(reply) || reply.includes('stage')) return 'accepted';
        }
      }
      return null;
    })();
    const stageDeclinedForFlow = noStageReply || stageDecisionFromHistory === 'declined';
    const stageAcceptedForFlow = yesStageReply || stageDecisionFromHistory === 'accepted';
    const stageDecisionKnown = stageDeclinedForFlow || stageAcceptedForFlow || stageMentioned;
    const stageStillRequested = (stageMentioned || stageAcceptedForFlow) && !stageDeclinedForFlow;
    const noExtrasReply =
      assistantAskedForExtras &&
      isNegativeIntent(normalizedIntentText);
    const layoutScaleModeFromHistory = (() => {
      for (let i = conversationHistory.length - 2; i >= 0; i--) {
        const current = conversationHistory[i];
        const next = conversationHistory[i + 1];
        if (
          current?.role === 'assistant' &&
          /would you like me to scale the layout to use more of the available space|keep it at default size|fit to space|keep default size/i.test(current.content || '') &&
          next?.role === 'user'
        ) {
          return resolveLayoutScaleMode(next.content || '');
        }
      }
      return null;
    })();
    const layoutScaleModeForFlow =
      (assistantAskedForLayoutScale
        ? (
            resolveLayoutScaleMode(exactCommandText) ||
            (isAffirmativeIntent(normalizedIntentText) ? 'fit-space' : null) ||
            (isNegativeIntent(normalizedIntentText) ? 'default-size' : null)
          )
        : null) ||
      layoutScaleModeFromHistory ||
      null;
    const layoutScaleKnown = Boolean(layoutScaleModeForFlow);
    const extrasDecisionKnown =
      extrasMentioned ||
      noExtrasReply ||
      (
        assistantAskedForExtras &&
        (
          isAffirmativeIntent(normalizedIntentText) ||
          hasAnyPhrase(normalizedIntentText, [
            'dance floor',
            'entrance door',
            'doors',
            'vip',
            'buffet',
            'bar',
            'presentation',
          ])
        )
      );
    const proceedReply =
      assistantAskedForGeneration &&
      (
        isAffirmativeIntent(normalizedIntentText) ||
        hasAnyPhrase(normalizedIntentText, [
          'generate',
          'generate now',
          'go ahead',
          'go on',
          'do it',
          'finish it',
          'proceed now',
        ])
      );
    const parseMeasureToMm = (value?: string, unit?: string) => {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return null;
      const normalizedUnit = String(unit || '').toLowerCase();
      if (normalizedUnit === 'm') return numeric * 1000;
      if (normalizedUnit === 'ft') return numeric * 304.8;
      return numeric;
    };
    const stageDimMatch = parseDimensionPair(exactCommandText);
    const parseStageDimensionPair = (text: string) => {
      const stageIndex = String(text || '').toLowerCase().indexOf('stage');
      if (stageIndex < 0) return null;
      const around = String(text || '').slice(Math.max(0, stageIndex - 20), stageIndex + 60);
      return parseDimensionPair(around);
    };
    const resolveStageChoiceFromText = (text: string) => {
      const lower = String(text || '').toLowerCase();
      const exactStage = findAssetByName(text);
      if (exactStage && exactStage.name.toLowerCase().includes('stage')) {
        return buildStageSpec(Number((exactStage as any).width || 1000), Number((exactStage as any).height || 1000), exactStage.name);
      }
      const canonicalText = canonicalize(text);
      const fuzzyStage = stageAssets.find((asset) => canonicalText.includes(canonicalize(asset.name)));
      if (fuzzyStage) {
        return buildStageSpec(Number(fuzzyStage.width || 1000), Number(fuzzyStage.height || 1000), fuzzyStage.name);
      }
      if (/\bsmall\b/.test(lower)) return buildStageSpec(2000, 1500, 'Small Modular Stage');
      if (/\bmedium\b/.test(lower)) return buildStageSpec(3000, 2000, 'Medium Modular Stage');
      if (/\blarge\b/.test(lower)) return buildStageSpec(4000, 2500, 'Large Modular Stage');
      const match = parseStageDimensionPair(text) || parseDimensionPair(text);
      if (!match) return null;
      const widthMm = parseMeasureToMm(match.widthValue, match.widthUnit);
      const heightMm = parseMeasureToMm(match.heightValue, match.heightUnit);
      if (!widthMm || !heightMm) return null;
      const snappedWidth = Math.max(STAGE_MODULE_MM, Math.round(widthMm / STAGE_MODULE_MM) * STAGE_MODULE_MM);
      const snappedHeight = Math.max(STAGE_MODULE_MM, Math.round(heightMm / STAGE_MODULE_MM) * STAGE_MODULE_MM);
      return buildStageSpec(snappedWidth, snappedHeight);
    };
    const stageChoiceFromCurrentInput =
      assistantAskedForStageSize || normalizedCommand.includes('stage')
        ? resolveStageChoiceFromText(exactCommandText)
        : null;
    const latestStageSizingReply = (() => {
      for (let i = 0; i < conversationHistory.length - 1; i++) {
        const current = conversationHistory[i];
        const next = conversationHistory[i + 1];
        if (
          current?.role === 'assistant' &&
          /what size would you like for the stage|select a stage/i.test(current.content || '') &&
          next?.role === 'user'
        ) {
          return next.content || '';
        }
      }
      return '';
    })();
    const stageChoiceFromSizingHistory = latestStageSizingReply
      ? resolveStageChoiceFromText(latestStageSizingReply)
      : null;
    const stageChoiceFromHistoryFallback = (() => {
      for (const userMsg of userHistory) {
        const text = userMsg.content || '';
        if (/\bstage\b/i.test(text)) {
          const choice = resolveStageChoiceFromText(text);
          if (choice) return choice;
        }
      }
      return null;
    })();
    const selectedStageForFlow = stageChoiceFromCurrentInput || stageChoiceFromHistoryFallback || selectedStageFromHistory || stageChoiceFromSizingHistory;
    const getStagePositionChoices = () => {
      if (arrangementType === 'circular') {
        return ['Center', 'Top', 'Bottom', 'Left', 'Right'];
      }
      if (arrangementType === 'u-shape') {
        return ['Inside U opening', 'Top center', 'Bottom center', 'Left', 'Right'];
      }
      return ['Top center', 'Bottom center', 'Left', 'Right', 'Center'];
    };
    const resolveStagePlacement = (text: string) => {
      const lower = String(text || '').toLowerCase();
      if (lower.includes('top center') || lower.includes('top-centre') || lower.includes('top centre')) return 'top';
      if (lower.includes('bottom center') || lower.includes('bottom-centre') || lower.includes('bottom centre')) return 'bottom';
      if (lower.includes('inside u') || lower.includes('open end') || lower.includes('opening')) return 'open-end';
      if (/\btop\b/.test(lower)) return 'top';
      if (/\bbottom\b/.test(lower)) return 'bottom';
      if (/\bleft\b/.test(lower)) return 'left';
      if (/\bright\b/.test(lower)) return 'right';
      if (lower.includes('center')) return 'center';
      if (arrangementType === 'circular') return 'center';
      if (arrangementType === 'u-shape') return 'open-end';
      return 'top';
    };
    const stagePlacementFromCurrentInput = assistantAskedForStagePlacement
      ? resolveStagePlacement(exactCommandText)
      : null;
    const stagePlacementFromHistory = (() => {
      for (let i = 0; i < conversationHistory.length - 1; i++) {
        const current = conversationHistory[i];
        const next = conversationHistory[i + 1];
        if (
          current?.role === 'assistant' &&
          /where should i place the stage|where would you like the stage/i.test(current.content || '') &&
          next?.role === 'user'
        ) {
          return resolveStagePlacement(next.content || '');
        }
      }
      return null;
    })();
    const stagePlacementFromBriefText = (() => {
      if (stagePlacementFromHistory) return null;
      if (!stageMentioned) return null;
      const lastIdx = lowerUserHistoryText.lastIndexOf('stage');
      if (lastIdx < 0) return null;
      const around = lowerUserHistoryText.slice(Math.max(0, lastIdx - 40), lastIdx + 20);
      if (/\b(top|bottom|left|right|center)\b/.test(around)) return resolveStagePlacement(around);
      return null;
    })();
    const selectedStagePlacement = stagePlacementFromCurrentInput || stagePlacementFromHistory || stagePlacementFromBriefText;
    const tableNeedsLooseChairs = (tableName: string) => {
      const lower = String(tableName || '').toLowerCase();
      return !/\b\d+\s*seater\b/i.test(lower);
    };
    const getSuggestedChairCountForTable = (tableName: string) => {
      const lower = String(tableName || '').toLowerCase();
      if (lower.includes('coffee table')) return 2;
      if (lower.includes('cocktail')) return 4;
      if (lower.includes('rectangular')) return 6;
      if (lower.includes('round')) return 4;
      return 4;
    };
    const secondaryZoneTableFromHistory = (() => {
      for (let i = 0; i < conversationHistory.length - 1; i++) {
        const current = conversationHistory[i];
        const next = conversationHistory[i + 1];
        if (
          current?.role === 'assistant' &&
          /what table should i use on the .* side for that smaller table area|what table should i use for the .* side table area|what table should i use there/i.test(current.content || '') &&
          next?.role === 'user'
        ) {
          return resolveMentionedFurnitureAsset(next.content || '', (asset) =>
            asset.category === 'Furniture' && asset.name.toLowerCase().includes('table')
          );
        }
      }
      if (guestZoneFromBrief?.onlyChairs && secondaryTableZoneFromBrief) {
        for (let i = conversationHistory.length - 1; i >= 0; i--) {
          const entry = conversationHistory[i];
          if (entry?.role !== 'user') continue;
          const resolved = resolveMentionedFurnitureAsset(entry.content || '', (asset) =>
            asset.category === 'Furniture' && asset.name.toLowerCase().includes('table')
          );
          if (resolved) return resolved;
        }
      }
      return null;
    })();
    const secondaryZoneChairFromHistory = (() => {
      for (let i = 0; i < conversationHistory.length - 1; i++) {
        const current = conversationHistory[i];
        const next = conversationHistory[i + 1];
        if (
          current?.role === 'assistant' &&
          /what chair should i pair with that .* side table|what seating should i use for that .* side table|what chair should i pair with the .* table area|what chair would you like to pair with the .* (?:right|left|top|bottom) side|would you like to add any specific chairs around the .* table.*select the chair type|which chair would you like around the .* table|which chair would you like to use(?: for| with)? the .* right side|what chair would you like to use(?: for| with)? the .* right side/i.test(current.content || '') &&
          next?.role === 'user'
        ) {
          return resolveMentionedFurnitureAsset(next.content || '', (asset) => {
            const label = asset.name.toLowerCase();
            return asset.category === 'Furniture' && !label.includes('table') && (label.includes('chair') || label.includes('stool'));
          });
        }
      }
      return null;
    })();
    const selectedSecondaryZoneTableForFlow =
      ((assistantAskedForSecondaryZoneTable || (guestZoneFromBrief?.onlyChairs && secondaryTableZoneFromBrief && !mainGuestTableFromHistory)) && selectedMentionedAsset && selectedMentionedAsset.category === 'Furniture' && selectedMentionedAsset.name.toLowerCase().includes('table')
        ? selectedMentionedAsset
        : null) ||
      secondaryZoneTableFromHistory ||
      null;
    const secondaryZoneLabelForPrompt = secondaryTableZoneFromBrief?.zoneLabel
      ? `${secondaryTableZoneFromBrief.zoneLabel} ${secondaryTableZoneFromBrief.side || 'secondary'} side table area`
      : `${secondaryTableZoneFromBrief?.side || 'secondary'} side table area`;
    const currentSelectedChair =
      (
        selectedMentionedAsset &&
        selectedMentionedAsset.category === 'Furniture' &&
        !selectedMentionedAsset.name.toLowerCase().includes('table') &&
        !selectedMentionedAsset.name.toLowerCase().includes('sofa') &&
        (
          selectedMentionedAsset.name.toLowerCase().includes('chair') ||
          selectedMentionedAsset.name.toLowerCase().includes('stool')
        )
          ? selectedMentionedAsset
          : null
      ) ||
      null;
    const secondaryZoneChairPromptContext =
      assistantAskedForSecondaryZoneChair ||
      Boolean(
        assistantAskedForChairChoice &&
        arrangementAlreadyKnown &&
        secondaryTableZoneFromBrief?.requiresSeating &&
        selectedSecondaryZoneTableForFlow
      );
    const currentChairShouldBelongToSecondaryZone = Boolean(
      currentSelectedChair &&
      secondaryTableZoneFromBrief?.requiresSeating &&
      selectedSecondaryZoneTableForFlow &&
      secondaryZoneChairPromptContext
    );
    const selectedSecondaryZoneChairForFlow =
      ((secondaryZoneChairPromptContext || currentChairShouldBelongToSecondaryZone) && currentSelectedChair
        ? currentSelectedChair
        : null) ||
      secondaryZoneChairFromHistory ||
      null;
    const inferredSecondaryZoneChairCount =
      secondaryTableZoneFromBrief?.chairCount || secondaryTableZoneFromBrief?.zoneCount || null;
    const secondaryZoneNeedsChairCount =
      Boolean(secondaryTableZoneFromBrief && secondaryTableZoneFromBrief.requiresSeating && selectedSecondaryZoneTableForFlow && tableNeedsLooseChairs(selectedSecondaryZoneTableForFlow.name) && !inferredSecondaryZoneChairCount);
    const secondaryZoneNeedsChairSelection =
      Boolean(secondaryTableZoneFromBrief && secondaryTableZoneFromBrief.requiresSeating && selectedSecondaryZoneTableForFlow && tableNeedsLooseChairs(selectedSecondaryZoneTableForFlow.name) && inferredSecondaryZoneChairCount && !selectedSecondaryZoneChairForFlow);
    const secondaryZoneNeedsTableSelection =
      Boolean(secondaryTableZoneFromBrief && !selectedSecondaryZoneTableForFlow);
    const secondaryZoneIsPresentationStyle =
      Boolean(secondaryTableZoneFromBrief?.zoneLabel && ['judges', 'panel', 'speakers', 'vip', 'couple'].includes(String(secondaryTableZoneFromBrief.zoneLabel).toLowerCase()));
    const secondaryZoneNeedsOneSideWarning =
      Boolean(
        secondaryZoneIsPresentationStyle &&
        selectedSecondaryZoneTableForFlow &&
        inferredSecondaryZoneChairCount &&
        inferredSecondaryZoneChairCount > 4 &&
        tableNeedsLooseChairs(selectedSecondaryZoneTableForFlow.name)
      );
    const getSecondaryZoneSeatingGuidance = () => {
      if (!secondaryZoneNeedsOneSideWarning || !selectedSecondaryZoneTableForFlow) return '';
      const lower = selectedSecondaryZoneTableForFlow.name.toLowerCase();
      if (lower.includes('round') || lower.includes('circular')) {
        return ` You mentioned ${inferredSecondaryZoneChairCount} panel seats. On a circular table, that may work better as a curved/front arc or a distributed round-table setup; if you want everyone on one speaking side, you may want a larger table or a second table.`;
      }
      return ` You mentioned ${inferredSecondaryZoneChairCount} panel seats. On one speaking side of a single rectangular table, that may get tight; if needed I may fall back to a more standard around-table layout unless you switch to a larger/circular table or add another table.`;
    };
    const selectedChairForFlow =
      (!secondaryZoneChairPromptContext && !currentChairShouldBelongToSecondaryZone ? currentSelectedChair : null) ||
      mainGuestChairFromHistory ||
      (!hasLayoutBrief && ((!guestZoneFromBrief?.onlyChairs || !secondaryTableZoneFromBrief) ? selectedChairFromHistory : null)) ||
      null;
    const selectedTableForFlow =
      (
        selectedMentionedAsset &&
        selectedMentionedAsset.category === 'Furniture' &&
        selectedMentionedAsset.name.toLowerCase().includes('table') &&
        !(guestZoneFromBrief?.onlyChairs && secondaryTableZoneFromBrief)
          ? selectedMentionedAsset
          : null
      ) ||
      mainGuestTableFromHistory ||
      (!guestZoneFromBrief?.onlyChairs ? selectedTableFromHistory : null) ||
      null;
    const tableChoiceKnown = Boolean(selectedTableForFlow);
    const comprehensiveBrief = hasLayoutBrief && stageMentioned && !!selectedTableForFlow;
    const parseChairsPerTable = (text: string) => {
      const raw = String(text || '');
      const explicit = raw.match(/(\d{1,2})\s*(?:chairs?|seats?|stools?)\s*(?:per|around each|on each)/i);
      if (explicit) {
        const value = Number(explicit[1]);
        return Number.isFinite(value) ? value : null;
      }
      if (assistantAskedForChairsPerTable) {
        const numeric = raw.match(/(\d{1,2})/);
        if (numeric) {
          const value = Number(numeric[1]);
          return Number.isFinite(value) ? value : null;
        }
      }
      return null;
    };
    const chairsPerTableFromHistory = (() => {
      for (let i = conversationHistory.length - 2; i >= 0; i--) {
        const current = conversationHistory[i];
        const next = conversationHistory[i + 1];
        if (
          current?.role === 'assistant' &&
          /how many chairs should i place around each table|how many seats should i place around each table|chairs per table/i.test(current.content || '') &&
          next?.role === 'user'
        ) {
          const explicit = parseChairsPerTable(next.content || '');
          if (explicit) return explicit;
          const numeric = String(next.content || '').match(/(\d{1,2})/);
          if (numeric) {
            const value = Number(numeric[1]);
            if (Number.isFinite(value)) return value;
          }
        }
      }
      return null;
    })();
    const chairsPerTableForFlow = parseChairsPerTable(exactCommandText) || chairsPerTableFromHistory;
    const arrangementChoices = ["Grid", "Linear", "Circular", "Perimeter", "U-Shape", "Boardroom", "Classroom", "Chevron"];
    const getSpaceSurfaceShape = () => {
      if (!activeSpaceWidthMm || !activeSpaceHeightMm) return null;
      if (selectedSpaceChoice === 'custom' || !selectedSpaceChoice) return null;
      if (selectedSpaceChoice === 'marquee') return null;
      const fillTexture =
        selectedSpaceChoice === 'grassy field'
          ? 'grass-01'
          : selectedSpaceChoice === 'parking lot'
            ? 'parking-lot'
            : selectedSpaceChoice === 'beach'
              ? 'sand-01'
              : null;
      if (!fillTexture) return null;
      return {
        id: `space-surface-${selectedSpaceChoice.replace(/\s+/g, '-')}`,
        type: 'rectangle',
        previewLayer: 'background',
        x: activeSpaceWidthMm / 2,
        y: activeSpaceHeightMm / 2,
        width: activeSpaceWidthMm,
        height: activeSpaceHeightMm,
        fillType: 'texture',
        fillTexture,
        fillTextureScale: 4,
        fillTextureThickness: 1,
        fill: 'transparent',
        stroke: 'transparent',
        strokeWidth: 0,
      };
    };
    const buildRoomShellPreview = () => {
      const preview: any =
        selectedSpaceChoice === 'marquee' && selectedMarqueeForFlow
          ? {
              walls: [],
              assets: [
                {
                  assetName: selectedMarqueeForFlow.name,
                  xMm: (activeSpaceWidthMm || Number(selectedMarqueeForFlow.width || 1000)) / 2,
                  yMm: (activeSpaceHeightMm || Number(selectedMarqueeForFlow.height || 1000)) / 2,
                  widthMm: Number(selectedMarqueeForFlow.width || 1000),
                  heightMm: Number(selectedMarqueeForFlow.height || 1000),
                  strokeWidth: 0.6,
                },
              ],
            }
          : {
              walls: [{ widthMm: activeSpaceWidthMm, heightMm: activeSpaceHeightMm, wallType: 'enclosure-150' }],
            };
      const surfaceShape = getSpaceSurfaceShape();
      if (surfaceShape) preview.shapes = [surfaceShape];
      return preview;
    };
    const buildStageShapeBundle = (stageSpec: { name: string; width: number; height: number }, placement?: string | null) => {
      const stageWidth = Number(stageSpec.width || 1000);
      const stageHeight = Number(stageSpec.height || 1000);
      const resolvedPlacement = placement || (arrangementType === 'circular' ? 'center' : arrangementType === 'u-shape' ? 'open-end' : 'top');
      const centerX = (activeSpaceWidthMm || stageWidth) / 2;
      const centerY = (activeSpaceHeightMm || stageHeight) / 2;
      let stageX = centerX;
      let stageY = Math.max(stageHeight / 2 + 500, 1200);
      if (resolvedPlacement === 'center') {
        stageX = centerX;
        stageY = centerY;
      } else if (resolvedPlacement === 'bottom' || resolvedPlacement === 'open-end') {
        stageX = centerX;
        stageY = Math.max(stageHeight / 2 + 500, (activeSpaceHeightMm || stageHeight) - stageHeight / 2 - 500);
      } else if (resolvedPlacement === 'left') {
        stageX = stageWidth / 2 + 500;
        stageY = centerY;
      } else if (resolvedPlacement === 'right') {
        stageX = Math.max(stageWidth / 2 + 500, (activeSpaceWidthMm || stageWidth) - stageWidth / 2 - 500);
        stageY = centerY;
      }

      const shapes: any[] = [
        {
          id: 'ai-stage-base',
          type: 'rectangle',
          xMm: stageX,
          yMm: stageY,
          widthMm: stageWidth,
          heightMm: stageHeight,
          fill: 'transparent',
          fillColor: 'transparent',
          stroke: '#475569',
          strokeColor: '#475569',
          strokeWidth: 2,
        },
      ];

      const cols = Math.max(1, Math.round(stageWidth / STAGE_MODULE_MM));
      const rows = Math.max(1, Math.round(stageHeight / STAGE_MODULE_MM));
      const left = stageX - stageWidth / 2;
      const top = stageY - stageHeight / 2;

      for (let c = 1; c < cols; c++) {
        const x = left + c * STAGE_MODULE_MM;
        shapes.push({
          id: `ai-stage-grid-v-${c}`,
          type: 'line',
          xMm: x,
          yMm: stageY,
          widthMm: stageHeight,
          heightMm: 1,
          stroke: '#94a3b8',
          strokeColor: '#94a3b8',
          strokeWidth: 1,
          opacity: 0.45,
          rotation: 90,
        });
      }
      for (let r = 1; r < rows; r++) {
        const y = top + r * STAGE_MODULE_MM;
        shapes.push({
          id: `ai-stage-grid-h-${r}`,
          type: 'line',
          xMm: stageX,
          yMm: y,
          widthMm: stageWidth,
          heightMm: 1,
          stroke: '#94a3b8',
          strokeColor: '#94a3b8',
          strokeWidth: 1,
          opacity: 0.45,
        });
      }

      const textAnnotations = [
        {
          id: 'ai-stage-label',
          text: stageSpec.name || 'Stage',
          xMm: stageX,
          yMm: stageY,
          fontSize: 320,
          color: '#334155',
        },
      ];

      return { shapes, textAnnotations };
    };
    const getZoneRect = (side?: string | null, share?: number | null) => {
      const roomW = activeSpaceWidthMm || 10000;
      const roomH = activeSpaceHeightMm || 10000;
      const fraction = Math.max(0.2, Math.min(0.95, share || ((side === 'left' || side === 'right' || side === 'top' || side === 'bottom') ? 0.5 : 1)));

      if (side === 'left') {
        return { xMm: 0, yMm: 0, widthMm: roomW * fraction, heightMm: roomH };
      }
      if (side === 'right') {
        return { xMm: roomW * (1 - fraction), yMm: 0, widthMm: roomW * fraction, heightMm: roomH };
      }
      if (side === 'top') {
        return { xMm: 0, yMm: 0, widthMm: roomW, heightMm: roomH * fraction };
      }
      if (side === 'bottom') {
        return { xMm: 0, yMm: roomH * (1 - fraction), widthMm: roomW, heightMm: roomH * fraction };
      }
      if (side === 'center') {
        return {
          xMm: roomW * ((1 - fraction) / 2),
          yMm: roomH * ((1 - fraction) / 2),
          widthMm: roomW * fraction,
          heightMm: roomH * fraction,
        };
      }
      return { xMm: 0, yMm: 0, widthMm: roomW, heightMm: roomH };
    };
    const getZoneCenter = (side?: string | null) => {
      const rect = getZoneRect(side, guestZoneFromBrief?.share);
      return {
        x: rect.xMm + rect.widthMm / 2,
        y: rect.yMm + rect.heightMm / 2,
      };
    };
    const getFacingRotationForSide = (side?: string | null) => {
      if (side === 'left') return 270;
      if (side === 'right') return 90;
      return 0;
    };
    const getChairFacingSide = (side?: string | null) => {
      if (side === 'left') return 'right';
      if (side === 'right') return 'left';
      if (side === 'top') return 'bottom';
      if (side === 'bottom') return 'top';
      return null;
    };
    const getSideZoneTableRotation = (side?: string | null) => {
      if (side === 'left' || side === 'right') return 90;
      return 0;
    };
    const applyLayoutScalePreference = (preview: any) => {
      if (!preview) return preview;
      return {
        ...preview,
        layoutPreferences: {
          ...(preview.layoutPreferences || {}),
          scaleMode: layoutScaleModeForFlow || 'default-size',
        },
      };
    };
    const buildSecondaryZoneAsset = () => {
      if (!secondaryTableZoneFromBrief || !selectedSecondaryZoneTableForFlow) return null;
      const anchor = getZoneCenter(secondaryTableZoneFromBrief.side);
      return {
        assetName: selectedSecondaryZoneTableForFlow.name,
        xMm: anchor.x,
        yMm: anchor.y,
        widthMm: selectedSecondaryZoneTableForFlow.width || undefined,
        heightMm: selectedSecondaryZoneTableForFlow.height || undefined,
        chairCount: inferredSecondaryZoneChairCount || undefined,
        chairAsset: selectedSecondaryZoneChairForFlow?.name || undefined,
        guestCount: inferredSecondaryZoneChairCount || undefined,
        rotation: getSideZoneTableRotation(secondaryTableZoneFromBrief.side),
        chairFacingSide: getChairFacingSide(secondaryTableZoneFromBrief.side),
        chairWorldSide: secondaryTableZoneFromBrief.side || undefined,
        strokeWidth: 0.6,
      };
    };
    const buildCustomTablePreview = (assetName: string, stageAsset?: any | null, stagePlacement?: string | null, chairCountOverride?: number | null, chairAssetName?: string | null) => {
      const assetNameLower = assetName.toLowerCase();
      const seatCountMatch = assetNameLower.match(/(\d+)\s*seater/i);
      const seatCount = chairCountOverride || (seatCountMatch ? Number(seatCountMatch[1]) : null);
      const inferredTableCount = explicitTableCount || (effectiveGuestCount && seatCount ? Math.max(1, Math.ceil(effectiveGuestCount / seatCount)) : 1);
      const mainZoneAnchor = getZoneCenter(guestZoneFromBrief?.side);
      const preview: any = {
        ...buildRoomShellPreview(),
        assets: [
          {
            assetName,
            count: inferredTableCount,
            chairCount: seatCount || undefined,
            chairAsset: chairAssetName || undefined,
            guestCount: effectiveGuestCount || undefined,
            strokeWidth: 0.6,
          },
        ],
        tableArrangement: {
          type: arrangementType,
          centerX: mainZoneAnchor.x,
          centerY: mainZoneAnchor.y,
          zone: getZoneRect(guestZoneFromBrief?.side, guestZoneFromBrief?.share),
          rotationDegrees: 0,
          chairFacingSide: getChairFacingSide(guestZoneFromBrief?.side),
        },
      };
      const secondaryZoneAsset = buildSecondaryZoneAsset();
      if (secondaryZoneAsset) preview.assets.push(secondaryZoneAsset);
      if (stageAsset) {
        const stageBundle = buildStageShapeBundle(stageAsset, stagePlacement);
        preview.shapes = [...(preview.shapes || []), ...stageBundle.shapes];
        preview.textAnnotations = [...(preview.textAnnotations || []), ...stageBundle.textAnnotations];
      }
      return applyLayoutScalePreference(preview);
    };
    const buildChairOnlyZonePreview = (chairAssetName: string, stageAsset?: any | null, stagePlacement?: string | null) => {
      const zoneRect = getZoneRect(guestZoneFromBrief?.side, guestZoneFromBrief?.share);
      const preview: any = {
        ...buildRoomShellPreview(),
        seatingLayout: [
          {
            type: arrangementType === 'u-shape' || arrangementType === 'boardroom' || arrangementType === 'classroom'
              ? arrangementType
              : 'theater',
            count: guestZoneFromBrief?.count || effectiveGuestCount || 1,
            assetName: chairAssetName,
            centerX: zoneRect.xMm + zoneRect.widthMm / 2,
            centerY: zoneRect.yMm + zoneRect.heightMm / 2,
            zone: zoneRect,
            rotationDegrees: getFacingRotationForSide(guestZoneFromBrief?.side),
            chairFacingSide: getChairFacingSide(guestZoneFromBrief?.side),
            columns: undefined,
            rows: undefined,
          },
        ],
      };
      const secondaryZoneAsset = buildSecondaryZoneAsset();
      if (secondaryZoneAsset) {
        preview.assets = [...(preview.assets || []), secondaryZoneAsset];
      }
      if (stageAsset) {
        const stageBundle = buildStageShapeBundle(stageAsset, stagePlacement);
        preview.shapes = [...(preview.shapes || []), ...stageBundle.shapes];
        preview.textAnnotations = [...(preview.textAnnotations || []), ...stageBundle.textAnnotations];
      }
      return applyLayoutScalePreference(preview);
    };
    const getSeatCountForFlowTable = (tableName: string) => {
      const seatCountMatch = tableName.toLowerCase().match(/(\d+)\s*seater/i);
      return chairsPerTableForFlow || (seatCountMatch ? Number(seatCountMatch[1]) : null);
    };
    const getChairAssetNameForFlow = () => selectedChairForFlow?.name || undefined;
    const isWeakAssistantFallback = (text: string) => {
      const lower = String(text || '').toLowerCase().trim();
      if (!lower) return true;
      return (
        lower === 'done' ||
        lower === 'done!' ||
        lower === 'ok' ||
        lower === 'okay' ||
        lower === 'alright' ||
        lower.includes('i did not understand') ||
        lower.includes('could you rephrase') ||
        lower.includes('please rephrase')
      );
    };
    const buildContextualRecovery = () => {
      if (activeSpaceWidthMm && activeSpaceHeightMm && structuredSpaceConversation && !hasLayoutBrief) {
        return {
          followUp: roomSummaryPrompt,
          preview: buildRoomShellPreview(),
        };
      }

      if (activeSpaceWidthMm && activeSpaceHeightMm && structuredSpaceConversation && hasLayoutBrief) {
        return (
          buildStructuredFlowResponse() || {
            preview: buildStructuredZonePreview(),
            followUp: 'I’m with you. What would you like to set up next inside this layout?',
          }
        );
      }

      if (assistantAskedForGuestCount && !effectiveGuestCount) {
        return {
          followUp: selectedTableForFlow
            ? `About how many guests should I plan for with the ${selectedTableForFlow.name}?`
            : 'About how many guests should I plan for here?',
          preview: activeSpaceWidthMm && activeSpaceHeightMm
            ? buildRoomShellPreview()
            : undefined,
        };
      }

      if (guestZoneFromBrief?.onlyChairs && selectedChairForFlow && !arrangementAlreadyKnown) {
        return {
          followUp: `How would you like those ${guestZoneFromBrief.count || effectiveGuestCount} ${selectedChairForFlow.name} seats arranged on the ${guestZoneFromBrief.side || 'main'} side?`,
          choices: arrangementChoices,
          preview: buildChairOnlyZonePreview(selectedChairForFlow.name, selectedStageForFlow, selectedStagePlacement),
        };
      }

      if (guestZoneFromBrief?.onlyChairs && selectedChairForFlow && arrangementAlreadyKnown && secondaryZoneNeedsTableSelection) {
        return {
          followUp: `You also mentioned the ${secondaryZoneLabelForPrompt}. What table should I use there?`,
          assetSelection: {
            category: 'table',
            message: 'Select a table for the smaller area',
            options: tableAssets,
          },
          preview: buildChairOnlyZonePreview(selectedChairForFlow.name, selectedStageForFlow, selectedStagePlacement),
        };
      }

      if (guestZoneFromBrief?.onlyChairs && selectedChairForFlow && arrangementAlreadyKnown && secondaryZoneNeedsChairSelection) {
        return {
          followUp: `What chair should I pair with the ${secondaryZoneLabelForPrompt}?`,
          assetSelection: {
            category: 'chair',
            message: 'Select seating for the smaller area',
            options: chairAssets,
          },
          preview: buildChairOnlyZonePreview(selectedChairForFlow.name, selectedStageForFlow, selectedStagePlacement),
        };
      }

      if (guestZoneFromBrief?.onlyChairs && selectedChairForFlow && arrangementAlreadyKnown && secondaryZoneNeedsChairCount) {
        return {
          followUp: `How many chairs should I place around the ${secondaryZoneLabelForPrompt}?`,
          preview: buildChairOnlyZonePreview(selectedChairForFlow.name, selectedStageForFlow, selectedStagePlacement),
        };
      }

      if (guestZoneFromBrief?.onlyChairs && selectedChairForFlow && arrangementAlreadyKnown && assistantAskedForStage) {
        if (yesStageReply) {
          return {
            followUp: 'What size would you like for the stage? You can reply like 3000mm x 2000mm, 3m x 2m, or 10ft x 8ft.',
            preview: buildChairOnlyZonePreview(selectedChairForFlow.name),
          };
        }
        if (noStageReply) {
          return {
            followUp: 'Would you like to include any additional features like a dance floor, entrance doors, or a VIP area before I generate the layout?',
            preview: buildChairOnlyZonePreview(selectedChairForFlow.name),
          };
        }
      }

      if (guestZoneFromBrief?.onlyChairs && selectedChairForFlow && arrangementAlreadyKnown && assistantAskedForExtras && noExtrasReply) {
        return {
          plan: buildChairOnlyZonePreview(selectedChairForFlow.name, selectedStageForFlow, selectedStagePlacement),
        };
      }

      if ((assistantAskedForTableChoice || (activeSpaceWidthMm && activeSpaceHeightMm && effectiveGuestCount)) && !selectedTableForFlow) {
        return {
          followUp: effectiveGuestCount
            ? `For ${effectiveGuestCount} guests, what table or seating setup would you like to use?`
            : 'What table or seating setup would you like to use?',
          assetSelection: {
            category: 'table',
            message: 'Select a table',
            options: guestSetupAssets,
          },
          preview: activeSpaceWidthMm && activeSpaceHeightMm
            ? buildRoomShellPreview()
            : undefined,
        };
      }

      if (selectedTableForFlow && effectiveGuestCount && !arrangementAlreadyKnown) {
        const standaloneTableNeedsChairs = tableNeedsLooseChairs(selectedTableForFlow.name);
        if (standaloneTableNeedsChairs && !selectedChairForFlow) {
          return {
            followUp: `What chair would you like to pair with the ${selectedTableForFlow.name}?`,
            assetSelection: {
              category: 'chair',
              message: 'Select seating',
              options: chairAssets,
            },
            preview: activeSpaceWidthMm && activeSpaceHeightMm
              ? buildCustomTablePreview(selectedTableForFlow.name)
              : undefined,
          };
        }
        if (standaloneTableNeedsChairs && !chairsPerTableForFlow) {
          const suggestedChairCount = getSuggestedChairCountForTable(selectedTableForFlow.name);
          return {
            followUp: `How many chairs should I place around each table? I can suggest ${suggestedChairCount} for the ${selectedTableForFlow.name} unless you want a different number.`,
            preview: activeSpaceWidthMm && activeSpaceHeightMm
              ? buildCustomTablePreview(selectedTableForFlow.name, undefined, undefined, suggestedChairCount, selectedChairForFlow?.name || undefined)
              : undefined,
          };
        }
        const assetNameLower = selectedTableForFlow.name.toLowerCase();
        const seatCountMatch = assetNameLower.match(/(\d+)\s*seater/i);
        const seatCount = chairsPerTableForFlow || (seatCountMatch ? Number(seatCountMatch[1]) : null);
        const inferredTableCount = explicitTableCount || (effectiveGuestCount && seatCount ? Math.max(1, Math.ceil(effectiveGuestCount / seatCount)) : 1);
        return {
          followUp: `Great choice! With ${selectedTableForFlow.name}, I’ll use ${inferredTableCount} table${inferredTableCount > 1 ? 's' : ''} for ${effectiveGuestCount} guests. How would you like them arranged?`,
          choices: arrangementChoices,
          preview: activeSpaceWidthMm && activeSpaceHeightMm
            ? buildCustomTablePreview(selectedTableForFlow.name, undefined, undefined, seatCount, selectedChairForFlow?.name || undefined)
            : {
                assets: [
                  {
                    assetName: selectedTableForFlow.name,
                    xMm: (selectedTableForFlow.width || 1000) / 2,
                    yMm: (selectedTableForFlow.height || 1000) / 2,
                    widthMm: selectedTableForFlow.width || 1000,
                    heightMm: selectedTableForFlow.height || 1000,
                    strokeWidth: 0.6,
                  },
                ],
              },
        };
      }

      if (selectedTableForFlow && effectiveGuestCount && arrangementAlreadyKnown) {
        if (secondaryZoneNeedsTableSelection) {
          return {
            followUp: `You also mentioned the ${secondaryZoneLabelForPrompt}. What table should I use there?`,
            assetSelection: {
              category: 'table',
              message: 'Select a table for the smaller area',
              options: tableAssets,
            },
            preview: buildCustomTablePreview(selectedTableForFlow.name, selectedStageForFlow, selectedStagePlacement, getSeatCountForFlowTable(selectedTableForFlow.name), getChairAssetNameForFlow()),
          };
        }
        if (secondaryZoneNeedsChairSelection) {
          return {
            followUp: `What chair should I pair with the ${secondaryZoneLabelForPrompt}?`,
            assetSelection: {
              category: 'chair',
              message: 'Select seating for the smaller area',
              options: chairAssets,
            },
            preview: buildCustomTablePreview(selectedTableForFlow.name, selectedStageForFlow, selectedStagePlacement, getSeatCountForFlowTable(selectedTableForFlow.name), getChairAssetNameForFlow()),
          };
        }
        if (secondaryZoneNeedsChairCount) {
          return {
            followUp: `How many chairs should I place around the ${secondaryZoneLabelForPrompt}?`,
            preview: buildCustomTablePreview(selectedTableForFlow.name, selectedStageForFlow, selectedStagePlacement, getSeatCountForFlowTable(selectedTableForFlow.name), getChairAssetNameForFlow()),
          };
        }
      }

      if (selectedTableForFlow && effectiveGuestCount && arrangementAlreadyKnown && assistantAskedForStage) {
        if (yesStageReply) {
          return {
            followUp: 'What size would you like for the stage? You can reply like 3000mm x 2000mm, 3m x 2m, or 10ft x 8ft.',
            preview: buildCustomTablePreview(selectedTableForFlow.name),
          };
        }
        if (noStageReply) {
          return {
            followUp: 'Would you like to include any additional features like a dance floor, entrance doors, or a VIP area before I generate the layout?',
            preview: buildCustomTablePreview(selectedTableForFlow.name),
          };
        }
        return {
          followUp: 'Would you like to add a stage to your layout?',
          choices: ['Yes, add a stage', 'No stage'],
          preview: buildCustomTablePreview(selectedTableForFlow.name),
        };
      }

      if (selectedTableForFlow && effectiveGuestCount && arrangementAlreadyKnown && assistantAskedForStageSize) {
        if (selectedStageForFlow) {
          if (selectedStagePlacement) {
            return {
              followUp: 'Would you like to include any additional features like a dance floor, entrance doors, or a VIP area before I generate the layout?',
              preview: buildCustomTablePreview(selectedTableForFlow.name, selectedStageForFlow, selectedStagePlacement),
            };
          }
          return {
            followUp: 'Where should I place the stage in relation to the arrangement?',
            choices: getStagePositionChoices(),
            preview: buildCustomTablePreview(selectedTableForFlow.name, selectedStageForFlow),
          };
        }
        return {
          followUp: 'What size would you like for the stage? You can reply like 3000mm x 2000mm, 3m x 2m, or 10ft x 8ft.',
          preview: buildCustomTablePreview(selectedTableForFlow.name),
        };
      }

      if (selectedTableForFlow && effectiveGuestCount && arrangementAlreadyKnown && assistantAskedForStagePlacement) {
        if (selectedStageForFlow && selectedStagePlacement) {
          return {
            followUp: 'Would you like to include any additional features like a dance floor, entrance doors, or a VIP area before I generate the layout?',
            preview: buildCustomTablePreview(selectedTableForFlow.name, selectedStageForFlow, selectedStagePlacement),
          };
        }
        return {
          followUp: 'Where should I place the stage in relation to the arrangement?',
          choices: getStagePositionChoices(),
          preview: buildCustomTablePreview(selectedTableForFlow.name, selectedStageForFlow),
        };
      }

      if (selectedTableForFlow && effectiveGuestCount && arrangementAlreadyKnown && assistantAskedForExtras) {
        if (noExtrasReply) {
          return {
            plan: buildCustomTablePreview(selectedTableForFlow.name, selectedStageForFlow, selectedStagePlacement),
          };
        }
        if (extrasDecisionKnown) {
          return {
            followUp: 'What extra feature would you like to add first?',
            preview: buildCustomTablePreview(selectedTableForFlow.name, selectedStageForFlow, selectedStagePlacement),
          };
        }
        return {
          followUp: 'Would you like to include any additional features like a dance floor, entrance doors, or a VIP area before I generate the layout?',
          preview: buildCustomTablePreview(selectedTableForFlow.name, selectedStageForFlow, selectedStagePlacement),
        };
      }

      if (selectedTableForFlow && effectiveGuestCount && arrangementAlreadyKnown && assistantAskedForGeneration) {
        if (proceedReply) {
          return {
            plan: buildCustomTablePreview(selectedTableForFlow.name, selectedStageForFlow, selectedStagePlacement),
          };
        }
        return {
          followUp: 'Would you like me to generate the layout now?',
          choices: ['Generate now', 'Add more details'],
          preview: buildCustomTablePreview(selectedTableForFlow.name, selectedStageForFlow, selectedStagePlacement),
        };
      }

      if (selectedSpaceChoice === 'marquee' && !selectedMarqueeForFlow) {
        return {
          assetSelection: {
            category: 'marquee',
            message: 'Excellent! Which marquee would you like to use for your event?',
            options: assetList.filter((a) => a.category === 'Marquee'),
          },
        };
      }

      // Fallthrough: arrangement is known but none of the assistant flag conditions matched.
      // This happens on the turn after the user picks an arrangement when stage/extras/generation
      // questions haven't been asked yet. If stage was mentioned, ask about size; otherwise
      // proceed directly to the plan since the original brief already included elements.
      if (selectedTableForFlow && effectiveGuestCount && arrangementAlreadyKnown) {
        if (stageStillRequested && !selectedStageForFlow && !stageChoiceFromCurrentInput) {
          return {
            followUp: 'What size would you like for the stage? You can reply like 3000mm x 2000mm, 3m x 2m, or 10ft x 8ft.',
            preview: buildCustomTablePreview(selectedTableForFlow.name),
          };
        }
        if (selectedStageForFlow && stageMentioned && !selectedStagePlacement && !stagePlacementFromCurrentInput && !stagePlacementFromHistory) {
          return {
            followUp: 'Where should I place the stage in relation to the arrangement?',
            choices: getStagePositionChoices(),
            preview: buildCustomTablePreview(selectedTableForFlow.name, selectedStageForFlow),
          };
        }
        return {
          plan: buildCustomTablePreview(selectedTableForFlow.name, selectedStageForFlow, selectedStagePlacement),
        };
      }

      return {
        followUp: 'I’m with you. What would you like to set up next: the space, the guest count, the furniture, or the extras?',
      };
    };
    const isNewLayoutIntent =
      normalizedCommand === 'i want to create a new layout' ||
      normalizedCommand === 'create a new layout' ||
      normalizedCommand === 'new layout' ||
      normalizedCommand === 'start a new layout' ||
      normalizedCommand === 'create layout' ||
      normalizedCommand === 'start a plan' ||
      normalizedCommand === 'create a space' ||
      normalizedCommand === 'design an event';

    if (isNewLayoutIntent) {
      return res.status(200).json({
        followUp: 'Would you like to use one of our event location and space options?',
        choices: ['Marquee', 'Grassy field', 'Parking lot', 'Beach', 'Custom'],
      });
    }

    if (normalizedCommand === 'custom') {
      return res.status(200).json({
        followUp: 'Great choice! What are the dimensions of your custom space? Please provide the width and height in meters, millimeters, or feet.',
      });
    }

    if (
      normalizedCommand === 'grassy field' ||
      normalizedCommand === 'grassy' ||
      normalizedCommand === 'field'
    ) {
      return res.status(200).json({
        followUp: 'Great choice! What are the dimensions of the grassy field space you want to use? Please provide the width and height in meters, millimeters, or feet.',
      });
    }

    if (
      normalizedCommand === 'parking lot' ||
      normalizedCommand === 'parking' ||
      normalizedCommand === 'car park' ||
      normalizedCommand === 'park'
    ) {
      return res.status(200).json({
        followUp: 'Great choice! What are the dimensions of the parking lot space you want to use? Please provide the width and height in meters, millimeters, or feet.',
      });
    }

    if (normalizedCommand === 'beach') {
      return res.status(200).json({
        followUp: 'Great choice! What are the dimensions of the beach space you want to use? Please provide the width and height in meters, millimeters, or feet.',
      });
    }

    if (
      activeSpaceWidthMm &&
      activeSpaceHeightMm &&
      structuredSpaceConversation &&
      !hasLayoutBrief
    ) {
      return res.status(200).json({
        followUp: roomSummaryPrompt,
        preview: buildRoomShellPreview(),
      });
    }

    function buildStructuredZonePreview() {
      if (guestZoneFromBrief?.onlyChairs && selectedChairForFlow) {
        return buildChairOnlyZonePreview(
          selectedChairForFlow.name,
          stageDeclinedForFlow ? undefined : selectedStageForFlow,
          stageDeclinedForFlow ? undefined : selectedStagePlacement
        );
      }

      if (selectedTableForFlow) {
        return buildCustomTablePreview(
          selectedTableForFlow.name,
          stageDeclinedForFlow ? undefined : selectedStageForFlow,
          stageDeclinedForFlow ? undefined : selectedStagePlacement,
          getSeatCountForFlowTable(selectedTableForFlow.name),
          getChairAssetNameForFlow()
        );
      }

      const preview: any = buildRoomShellPreview();
      const secondaryZoneAsset = buildSecondaryZoneAsset();
      if (secondaryZoneAsset) {
        preview.assets = [...(preview.assets || []), secondaryZoneAsset];
      }
      if (!stageDeclinedForFlow && selectedStageForFlow) {
        const stageBundle = buildStageShapeBundle(selectedStageForFlow, selectedStagePlacement);
        preview.shapes = [...(preview.shapes || []), ...stageBundle.shapes];
        preview.textAnnotations = [...(preview.textAnnotations || []), ...stageBundle.textAnnotations];
      }
      return preview;
    }

    function buildStructuredFlowResponse(previewOverride?: any) {
      if (!(activeSpaceWidthMm && activeSpaceHeightMm && structuredSpaceConversation && hasLayoutBrief)) {
        return null;
      }

      const structuredPreview = previewOverride || buildStructuredZonePreview();
      const mainZoneIsChairOnly = Boolean(guestZoneFromBrief?.onlyChairs);
      const mainZoneNeedsSetup = !mainZoneIsChairOnly && !selectedTableForFlow;
      const mainZoneNeedsChairChoice =
        mainZoneIsChairOnly
          ? !selectedChairForFlow
          : Boolean(selectedTableForFlow && tableNeedsLooseChairs(selectedTableForFlow.name) && !selectedChairForFlow);
      const mainZoneNeedsChairCount =
        !mainZoneIsChairOnly &&
        Boolean(selectedTableForFlow && tableNeedsLooseChairs(selectedTableForFlow.name) && !chairsPerTableForFlow);
      const mainZoneNeedsArrangement =
        mainZoneIsChairOnly
          ? Boolean(selectedChairForFlow && !arrangementAlreadyKnown)
          : Boolean(
              selectedTableForFlow &&
              (!tableNeedsLooseChairs(selectedTableForFlow.name) || (selectedChairForFlow && chairsPerTableForFlow)) &&
              !arrangementAlreadyKnown
            );
      const secondaryZoneNeedsChairType =
        Boolean(
          secondaryTableZoneFromBrief &&
          secondaryTableZoneFromBrief.requiresSeating &&
          selectedSecondaryZoneTableForFlow &&
          tableNeedsLooseChairs(selectedSecondaryZoneTableForFlow.name) &&
          !selectedSecondaryZoneChairForFlow
        );
      const secondaryZoneResolved =
        !secondaryTableZoneFromBrief ||
        (
          !!selectedSecondaryZoneTableForFlow &&
          (
            !secondaryTableZoneFromBrief.requiresSeating ||
            !tableNeedsLooseChairs(selectedSecondaryZoneTableForFlow.name) ||
            (!!selectedSecondaryZoneChairForFlow && !!inferredSecondaryZoneChairCount)
          )
        );
      const stageResolved =
        !stageStillRequested ||
        stageDeclinedForFlow ||
        Boolean(selectedStageForFlow);
      const extrasResolved = assistantAskedForExtras && noExtrasReply;
      const comprehensiveBrief = hasLayoutBrief && stageMentioned && !!selectedTableForFlow;
      const allMainResolved =
        !mainZoneNeedsSetup &&
        !mainZoneNeedsChairChoice &&
        !mainZoneNeedsChairCount &&
        !mainZoneNeedsArrangement &&
        secondaryZoneResolved &&
        stageResolved;

      if (
        assistantAskedForLayoutSummary &&
        !effectiveGuestCount &&
        !guestZoneFromBrief?.count &&
        !secondaryTableZoneFromBrief?.zoneCount
      ) {
        return {
          followUp: briefMentionsMultipleZones || briefMentionsDirectionalZones
            ? 'I understand the overall layout idea. Roughly how many guests should I plan for in total?'
            : 'Thanks, that helps. Roughly how many guests should I plan for in total?',
          preview: buildRoomShellPreview(),
        };
      }

      const currentTargetsStage = /\bstage\b/.test(normalizedCommand) && !stageResolved;
      const currentTargetsChair = /\bchair\b|\bstool\b/.test(normalizedCommand) && !selectedChairForFlow;
      const currentTargetsTable = /\btable\b/.test(normalizedCommand) && mainZoneNeedsSetup && !currentTargetsStage;

      if (!currentTargetsStage && mainZoneNeedsSetup && matchingTableCandidates.length > 0) {
        return {
          followUp: `I found a few tables matching what you described — which one did you want?`,
          assetSelection: {
            category: 'table',
            message: 'Select the table variant you want',
            options: matchingTableCandidates,
          },
          preview: structuredPreview,
        };
      }

      if (!currentTargetsStage && mainZoneNeedsSetup) {
        if (!effectiveGuestCount) {
          return {
            followUp: briefMentionsMultipleZones || briefMentionsDirectionalZones
              ? 'I understand the overall layout idea. Roughly how many guests should I plan for in total?'
              : 'Thanks, that helps. Roughly how many guests should I plan for in total?',
            preview: buildRoomShellPreview(),
          };
        }
        return {
          followUp: briefMentionsMultipleZones
            ? `I understand you want multiple zones in the layout. What table or seating setup should I use first for the ${guestZoneFromBrief?.side || 'main'} side guest area for ${effectiveGuestCount} guests?`
            : `For ${effectiveGuestCount} guests, what table or seating setup would you like to use?`,
          assetSelection: {
            category: 'table',
            message: 'Select a table or seating setup',
            options: guestSetupAssets,
          },
          preview: structuredPreview,
        };
      }

      if (!currentTargetsStage && !currentTargetsTable && !currentTargetsChair && mainZoneNeedsChairChoice) {
        const followUp = mainZoneIsChairOnly
          ? `For the ${guestZoneFromBrief?.side || 'main'} side guest area, what chair or stool would you like me to use for the ${effectiveGuestCount || 'your'} seats?`
          : `What chair would you like to pair with the ${selectedTableForFlow!.name}?`;
        return {
          followUp,
          assetSelection: {
            category: 'chair',
            message: mainZoneIsChairOnly ? 'Select seating for the guest area' : 'Select a chair or stool',
            options: chairAssets,
          },
          preview: structuredPreview,
        };
      }

      if (!currentTargetsStage && mainZoneNeedsChairCount) {
        return {
          followUp: `How many chairs should I place around each ${selectedTableForFlow!.name}? I can suggest ${getSuggestedChairCountForTable(selectedTableForFlow!.name)} unless you want a different number.`,
          preview: structuredPreview,
        };
      }

      if (!currentTargetsStage && mainZoneNeedsArrangement) {
        const arrangementSubject = mainZoneIsChairOnly
          ? `${guestZoneFromBrief?.count || effectiveGuestCount} ${selectedChairForFlow!.name} seats`
          : `${explicitTableCount || Math.max(1, Math.ceil((guestZoneFromBrief?.count || effectiveGuestCount || 1) / Math.max(1, getSeatCountForFlowTable(selectedTableForFlow!.name) || 1)))} table${(explicitTableCount || Math.max(1, Math.ceil((guestZoneFromBrief?.count || effectiveGuestCount || 1) / Math.max(1, getSeatCountForFlowTable(selectedTableForFlow!.name) || 1)))) > 1 ? 's' : ''} using ${selectedTableForFlow!.name}`;
        return {
          followUp: `How would you like those ${arrangementSubject} arranged on the ${guestZoneFromBrief?.side || 'main'} side?`,
          choices: arrangementChoices,
          preview: structuredPreview,
        };
      }

      if (!currentTargetsStage && secondaryZoneNeedsTableSelection) {
        return {
          followUp: `You also mentioned the ${secondaryZoneLabelForPrompt}. What table should I use there?`,
          assetSelection: {
            category: 'table',
            message: 'Select a table for the smaller area',
            options: tableAssets,
          },
          preview: structuredPreview,
        };
      }

      if (!currentTargetsStage && secondaryZoneNeedsChairType) {
        return {
          followUp: `What chair would you like to pair with the ${selectedSecondaryZoneTableForFlow!.name} on the ${secondaryTableZoneFromBrief?.side || 'secondary'} side?${getSecondaryZoneSeatingGuidance()}`,
          assetSelection: {
            category: 'chair',
            message: 'Select seating for the smaller area',
            options: chairAssets,
          },
          preview: structuredPreview,
        };
      }

      if (!currentTargetsStage && secondaryZoneNeedsChairCount) {
        return {
          followUp: `How many chairs should I place around the ${secondaryZoneLabelForPrompt}?`,
          preview: structuredPreview,
        };
      }

      if (!stageResolved) {
        if (!stageDecisionKnown) {
          return {
            followUp: selectedStagePlacement
              ? `Would you like to add a stage at the ${selectedStagePlacement === 'top' ? 'top' : selectedStagePlacement} of the layout?`
              : 'Would you like to add a stage to your layout?',
            choices: ['Yes, add a stage', 'No stage'],
            preview: structuredPreview,
          };
        }

        if (!selectedStageForFlow) {
          return {
            followUp: 'What size would you like for the stage? You can reply like 3000mm x 2000mm, 3m x 2m, or 10ft x 8ft.',
            preview: structuredPreview,
          };
        }

        if (!selectedStagePlacement) {
          return {
            followUp: 'Where should I place the stage in relation to the arrangement?',
            choices: getStagePositionChoices(),
            preview: structuredPreview,
          };
        }
      }

      if (assistantAskedForExtras && noExtrasReply) {
        return {
          plan: structuredPreview,
        };
      }

      if (!extrasDecisionKnown && !comprehensiveBrief) {
        return {
          followUp: 'Would you like to include any additional features like a dance floor, entrance doors, or a VIP area before I generate the layout?',
          preview: structuredPreview,
        };
      }

      if (!assistantAskedForExtras && !extrasResolved && !comprehensiveBrief && !hasAnyPhrase(normalizedIntentText, ['dance floor', 'entrance door', 'doors', 'vip', 'buffet', 'bar', 'presentation'])) {
        return {
          followUp: 'Would you like to include any additional features like a dance floor, entrance doors, or a VIP area before I generate the layout?',
          preview: structuredPreview,
        };
      }

      if (allMainResolved) {
        const aspectRatio = (activeSpaceWidthMm || 1) / (activeSpaceHeightMm || 1);
        if (Math.abs(aspectRatio - 1) > 0.15) {
          // Auto-apply portrait: rotate the entire plan 90° CW
          const oldW = activeSpaceWidthMm!;
          const oldH = activeSpaceHeightMm!;
          const portraitPreview = JSON.parse(JSON.stringify(structuredPreview));
          const rotatePos = (v: any) => {
            if (!v) return v;
            const ox = typeof v.xMm === 'number' ? v.xMm : typeof v.centerX === 'number' ? v.centerX : undefined;
            const oy = typeof v.yMm === 'number' ? v.yMm : typeof v.centerY === 'number' ? v.centerY : undefined;
            if (ox != null && oy != null) {
              const nx = oldH - oy;
              const ny = ox;
              if (typeof v.xMm === 'number') v.xMm = nx;
              if (typeof v.yMm === 'number') v.yMm = ny;
              if (typeof v.centerX === 'number') v.centerX = nx;
              if (typeof v.centerY === 'number') v.centerY = ny;
            }
            if (v.type !== 'line') {
              const ow = typeof v.widthMm === 'number' ? v.widthMm : 0;
              const oh = typeof v.heightMm === 'number' ? v.heightMm : 0;
              if (ow && oh) { v.widthMm = oh; v.heightMm = ow; }
            }
            if (typeof v.rotation === 'number') v.rotation = (v.rotation + 90) % 360;
            return v;
          };
          if (Array.isArray(portraitPreview.walls)) {
            portraitPreview.walls = portraitPreview.walls.map((w: any) => {
              const nw = { ...w, widthMm: oldH, heightMm: oldW };
              if (typeof nw.rotation === 'number') nw.rotation = (nw.rotation + 90) % 360;
              return nw;
            });
          }
          if (Array.isArray(portraitPreview.assets)) portraitPreview.assets = portraitPreview.assets.map(rotatePos);
          if (Array.isArray(portraitPreview.shapes)) portraitPreview.shapes = portraitPreview.shapes.map(rotatePos);
          if (portraitPreview.tableArrangement) rotatePos(portraitPreview.tableArrangement);
          if (Array.isArray(portraitPreview.seatingLayout)) portraitPreview.seatingLayout = portraitPreview.seatingLayout.map(rotatePos);
          if (Array.isArray(portraitPreview.chairsAround)) {
            portraitPreview.chairsAround = portraitPreview.chairsAround.map((g: any) => {
              const ox = g.centerX, oy = g.centerY;
              const nx = oldH - oy;
              const ny = ox;
              return { ...g, centerX: nx, centerY: ny, rotation: ((g.rotation || 0) + 90) % 360 };
            });
          }
          return { plan: portraitPreview };
        }
        return { plan: structuredPreview };
      }

      return null;
    }

    if (activeSpaceWidthMm && activeSpaceHeightMm && structuredSpaceConversation && hasLayoutBrief) {
      const structuredResponse = buildStructuredFlowResponse();
      if (structuredResponse) {
        return res.status(200).json(structuredResponse);
      }
    }

    if (normalizedCommand === 'marquee') {
      const marqueeOptions = assetList.filter((a) => a.category === 'Marquee');
      return res.status(200).json({
        assetSelection: {
          category: 'marquee',
          message: 'Excellent! Which marquee would you like to use for your event?',
          options: marqueeOptions,
        },
      });
    }

    const tableAssetSelected =
      selectedMentionedAsset &&
      selectedMentionedAsset.category === 'Furniture' &&
      selectedMentionedAsset.name.toLowerCase().includes('table');
    const assistantAskedForTableChoice = conversationHistory
      .slice(-6)
      .some((m) =>
        m.role === 'assistant' &&
        /what type of seating|what type of tables|what table|round tables|rectangular tables|select a table|select seating/i.test(m.content || '')
      );

    if (
      tableAssetSelected &&
      !structuredSpaceConversation &&
      (assistantAskedForTableChoice || activeSpaceWidthMm || activeSpaceHeightMm) &&
      !(
        guestZoneFromBrief?.onlyChairs &&
        secondaryTableZoneFromBrief &&
        selectedMentionedAsset &&
        selectedSecondaryZoneTableForFlow &&
        selectedMentionedAsset.name === selectedSecondaryZoneTableForFlow.name
      )
    ) {
      const assetNameLower = selectedMentionedAsset.name.toLowerCase();
      const isCoffeeTable = assetNameLower.includes('coffee table');
      const seatCountMatch = assetNameLower.match(/(\d+)\s*seater/i);
      const standaloneTableNeedsChairs = tableNeedsLooseChairs(selectedMentionedAsset.name);
      const seatCount = chairsPerTableForFlow || (seatCountMatch ? Number(seatCountMatch[1]) : null);
      const inferredTableCount = explicitTableCount || (effectiveGuestCount && seatCount ? Math.max(1, Math.ceil(effectiveGuestCount / seatCount)) : null);
      const preview: any = activeSpaceWidthMm && activeSpaceHeightMm
        ? {
            ...buildRoomShellPreview(),
            assets: [
              {
                assetName: selectedMentionedAsset.name,
                count: inferredTableCount || 1,
                chairCount: seatCount || undefined,
                chairAsset: selectedChairForFlow?.name || undefined,
                guestCount: effectiveGuestCount || undefined,
                strokeWidth: 0.6,
              },
            ],
          }
        : {
            assets: [
              {
                assetName: selectedMentionedAsset.name,
                xMm: (selectedMentionedAsset.width || 1000) / 2,
                yMm: (selectedMentionedAsset.height || 1000) / 2,
                widthMm: selectedMentionedAsset.width || 1000,
                heightMm: selectedMentionedAsset.height || 1000,
                strokeWidth: 0.6,
              },
            ],
          };

      if (effectiveGuestCount && isCoffeeTable && effectiveGuestCount > 8 && !selectedChairForFlow) {
        return res.status(200).json({
          followUp: `The ${selectedMentionedAsset.name} reads more like a lounge or side table than a main guest dining table for ${effectiveGuestCount} guests. Do you want to use it for the smaller side zone instead, or would you like to choose a larger main guest table first?`,
          assetSelection: {
            category: 'table',
            message: 'Select a larger main guest table',
            options: guestSetupAssets.filter((asset) => !asset.name.toLowerCase().includes('coffee table')),
          },
          preview,
        });
      }

      if (!effectiveGuestCount) {
        return res.status(200).json({
          followUp: `How many guests should I plan for with the ${selectedMentionedAsset.name}?`,
          preview,
        });
      }

      if (standaloneTableNeedsChairs && !selectedChairForFlow) {
        return res.status(200).json({
          followUp: `What chair would you like to pair with the ${selectedMentionedAsset.name}?`,
          assetSelection: {
            category: 'chair',
            message: 'Select seating',
            options: chairAssets,
          },
          preview,
        });
      }

      if (standaloneTableNeedsChairs && !chairsPerTableForFlow) {
        const suggestedChairCount = getSuggestedChairCountForTable(selectedMentionedAsset.name);
        return res.status(200).json({
          followUp: `How many chairs should I place around each table? I can suggest ${suggestedChairCount} for the ${selectedMentionedAsset.name} unless you want a different number.`,
          preview: activeSpaceWidthMm && activeSpaceHeightMm
            ? {
                ...buildRoomShellPreview(),
                assets: [
                  {
                    assetName: selectedMentionedAsset.name,
                    count: Math.max(1, Math.ceil(effectiveGuestCount / suggestedChairCount)),
                    chairCount: suggestedChairCount,
                    chairAsset: selectedChairForFlow?.name || undefined,
                    guestCount: effectiveGuestCount || undefined,
                    strokeWidth: 0.6,
                  },
                ],
              }
            : preview,
        });
      }

      if (!arrangementAlreadyKnown) {
        return res.status(200).json({
          followUp: `Great choice! With ${selectedMentionedAsset.name}, I’ll use ${inferredTableCount || 1} table${(inferredTableCount || 1) > 1 ? 's' : ''} for ${effectiveGuestCount} guests. How would you like them arranged?`,
          choices: ["Grid", "Linear", "Circular", "Perimeter", "U-Shape", "Boardroom", "Classroom", "Chevron"],
          preview,
        });
      }

      if (secondaryZoneNeedsTableSelection) {
        return res.status(200).json({
          followUp: `You also mentioned the ${secondaryZoneLabelForPrompt}. What table should I use there?`,
          assetSelection: {
            category: 'table',
            message: 'Select a table for the smaller area',
            options: tableAssets,
          },
          preview: {
            ...preview,
            tableArrangement: { type: arrangementType, centerX: getZoneCenter(guestZoneFromBrief?.side).x, centerY: getZoneCenter(guestZoneFromBrief?.side).y },
          },
        });
      }

      if (secondaryZoneNeedsChairSelection) {
        return res.status(200).json({
          followUp: `What chair should I pair with the ${secondaryZoneLabelForPrompt}?`,
          assetSelection: {
            category: 'chair',
            message: 'Select seating for the smaller area',
            options: chairAssets,
          },
          preview: {
            ...preview,
            tableArrangement: { type: arrangementType, centerX: getZoneCenter(guestZoneFromBrief?.side).x, centerY: getZoneCenter(guestZoneFromBrief?.side).y },
          },
        });
      }

      if (secondaryZoneNeedsChairCount) {
        return res.status(200).json({
          followUp: `How many chairs should I place around the ${secondaryZoneLabelForPrompt}?`,
          preview: {
            ...preview,
            tableArrangement: { type: arrangementType, centerX: getZoneCenter(guestZoneFromBrief?.side).x, centerY: getZoneCenter(guestZoneFromBrief?.side).y },
          },
        });
      }

      if (stageStillRequested && !selectedStageForFlow) {
        return res.status(200).json({
          followUp: 'You mentioned a stage. What size would you like it to be? You can reply like 3000mm x 2000mm, 3m x 2m, or 10ft x 8ft.',
          preview: {
            ...preview,
            tableArrangement: { type: arrangementType },
          },
        });
      }

      if (!stageDecisionKnown) {
        return res.status(200).json({
          followUp: 'Would you like to add a stage to your layout?',
          choices: ['Yes, add a stage', 'No stage'],
          preview: {
            ...preview,
            tableArrangement: { type: arrangementType },
          },
        });
      }

      if (!extrasDecisionKnown && !comprehensiveBrief) {
        return res.status(200).json({
          followUp: 'Would you like to include any additional features like a dance floor, entrance doors, or a VIP area before I generate the layout?',
          preview: {
            ...preview,
            tableArrangement: { type: arrangementType },
          },
        });
      }
    }

    if (matchingTableCandidates.length > 0 && (activeSpaceWidthMm || activeSpaceHeightMm || normalizedCommand.includes('table'))) {
      return res.status(200).json({
        followUp: `I found a few tables matching what you described — which one did you want?`,
        assetSelection: {
          category: 'table',
          message: 'Select the table variant you want',
          options: matchingTableCandidates,
        },
        preview: activeSpaceWidthMm && activeSpaceHeightMm ? buildRoomShellPreview() : undefined,
      });
    }

    if (!DEEPSEEK_API_KEY) return res.status(500).json({ error: 'DEEPSEEK_API_KEY not configured' });

    const assetContext = assetList.map(a => `"${a.name}" (${a.category})`).join(', ');

    const canvasW = canvas?.width ?? 10000;
    const canvasH = canvas?.height ?? 10000;
    const canvasCX = canvasW / 2;
    const canvasCY = canvasH / 2;

    const selectedContext = selectedAssets && selectedAssets.length > 0
      ? `\nCURRENTLY SELECTED ASSETS:\n${JSON.stringify(selectedAssets, null, 2)}\n`
      : '';

    const obstaclesContext = obstacles && obstacles.length > 0
      ? `\nEXISTING OBSTACLES ON CANVAS (DO NOT OVERLAP):\n${JSON.stringify(obstacles.map(o => ({ type: o.type, x: o.x, y: o.y, w: o.width, h: o.height })), null, 2)}\n`
      : '';

    const system = `You are the helpful and conversational AI assistant embedded in EventSpacePro, a professional 2-D event-space layout editor.
Your goal is to guide the user through creating their event space by being interactive and precise.

══════════════════════════════════════════════════════════════
  CORE DIRECTIVES
══════════════════════════════════════════════════════════════
1.  **CONSULTATIVE PHASE (MANDATORY)**:
    - NEVER return a 'plan' object on the first turn unless the user explicitly says "Generate the plan now" or the request is extremely specific.
    - NEVER respond with "I did not understand", "Could you rephrase", or similar dead-end fallback text if the user's message is even partially understandable. Infer the most likely intent from context, continue the guided flow, and if something is still missing ask the narrowest next clarifying question.
    - **INITIAL FLOW**: If a user asks to "start a plan", "create a space", or "design an event", YOU MUST ASK: "Would you like to use one of our event location and space options?" and provide choices: ["Marquee", "Grassy field", "Parking lot", "Beach", "Custom"].
    - **PRELOADED SPACES**: If a user selects one:
        - **Marquee**: DO NOT return a plan or grass background immediately. Instead, use "assetSelection": { "category": "marquee", "message": "Excellent! Which marquee would you like to use for your event?" }.
        - **Grassy field**: Use "fillTexture": "grass-01" or "grass-02" for the background.
        - **Parking lot**: Use "fillTexture": "road-01" or another paved/parking-style background for the space.
        - **Beach**: Use "fillTexture": "sand-01" or "sand-02" for a large background rectangle.
    - **STANDALONE STRUCTURES**: Marquees (and tents) are standalone. DO NOT add walls or rooms around them unless the user explicitly asks for a "room inside a marquee".
    - **PREVIEW DURING SELECTION**: Whenever an asset category or specific asset is selected, ALWAYS include it in the "preview" object so the user can see it in the chat bubble while you continue the conversation.
    - ALWAYS ask for dimensions (e.g., "What are the dimensions of your space?") if the user hasn't provided them yet, EXCEPT when they are selecting a standalone marquee/tent asset, because the marquee itself defines the space footprint.
    - AFTER the user provides room dimensions for a room-based space, ask them for a plain-language event summary before you start the detailed planning questions. Example: "Tell me in plain language what you want for this event layout."
    - Use that summary to extract key zones, guest counts, stage intent, and major furniture needs, then ask only the missing follow-up questions one by one.
    - For banquet / table-based layouts, once you know the room size or marquee size, guest count, and table type, ASK for arrangement preference before final generation unless the user already gave one.
    - Arrangement choices to offer: ["Grid", "Linear", "Circular", "Perimeter", "U-Shape", "Boardroom", "Classroom", "Chevron"].
    - Also ask whether they want a stage if they have not mentioned one yet. Stage choices: ["Yes, add a stage", "No stage"].
    - Stages are NEVER stage assets. Stages are ALWAYS rectangles added via the "shapes" array, never "assets".
    - Default stage size is 500mm x 500mm (1 module = 500mm). If user asks for e.g. 1m, that is 1000mm = 2 modules (1000mm × 1000mm rectangle).
    - Every stage rectangle MUST contain faint module grid lines inside it showing each 500mm x 500mm segment.
    - If the user provides stage dimensions in their prompt, use them directly — do not re-ask for stage size.
    - If the user mentions a stage POSITION (e.g., "on the right", "left side", "top center", "bottom"), extract that and place the stage accordingly. Use the 'shapes[].xMm' and 'shapes[].yMm' to position it. For "right", place near the right edge; for "left", near the left edge; for "top", near the top; for "bottom", near the bottom; for "center", at the center.
    - If the user gives a comprehensive one-shot prompt (e.g., room dimensions + table type/count + stage + placement all in one message), generate the plan directly instead of asking follow-up questions. Only ask if something is genuinely ambiguous.
    - If the user says "surprise me" or "best arrangement", choose the arrangement type that fits the room best and explain it briefly in the follow-up.
    - If the user replies with "none", "no extras", "nothing else", or "none of that" after you ask about optional extras, treat that as confirmation to proceed with generation if enough planning details are already known.
    - During consultative follow-ups, if you already know the room size, guest count, and table type, ALWAYS include a preview that shows the repeated table asset count, not just the room walls.
2.  **TABLE NUMBERING (STRICT)**:
    - Whenever you generate tables (banquet, round, etc.), YOU MUST assign a sequential 'tableName' to each one.
    - **RULE**: Use ONLY the raw number (e.g., "1", "2", "3").
    - **CRITICAL**: DO NOT include the word "Table" or any other prefix. The user ONLY wants the digit.
    - This applies to both 'plan.assets' and 'plan.chairsAround'.
3.  **GUEST COUNT MATH (STRICT)**:
    - If a user specifies a GUEST COUNT (e.g., "500 guests") and a TABLE TYPE (e.g., "round table of 10"), YOU MUST DO THE MATH.
    - Calculation: Total Guests / Capacity per Table = Total Tables.
    - Example: 500 guests / 10 per table = 50 tables.
    - YOU MUST add all 50 tables (or chairsAround groups) to the plan. DO NOT skip items for large numbers.
    - For repeated banquet tables, PREFER one asset object with "count" plus "tableArrangement" instead of one explicit xMm/yMm table object.
    - When asking the user to select a TABLE, show only table assets.
    - When asking the user to select a CHAIR or STOOL, do NOT offer sofas.
    - When you generate loose chairs or stools, preserve at least 600mm spacing between seating elements.
    - If "count" is greater than 1, DO NOT provide the same xMm/yMm for the repeated table asset unless the user explicitly asked for a fixed anchor point.
4.  **CAPACITY VS ROOM SIZE (STRICT)**:
    - If the requested room dimensions are obviously too small for the requested guest count / table count, DO NOT quietly generate a cramped plan.
    - Instead, return a "followUp" explaining the room is too small and ask whether to increase the room size or reduce the guest count.
    - Example: 20 banquet tables inside a 3000mm x 3000mm room is impossible and must trigger a follow-up.
5.  **CONFIRMATION BEFORE EXECUTION**:
    - Only return the JSON 'plan' when the user confirms the details.
6.  **INTERACTIVE PLANNING**: 
    - NEVER assume dimensions. If missing, use 'followUp' to ask.
7.  **SPATIAL MATH**: All coordinates/sizes are in MILLIMETRES (mm).
8.  **AESTHETICS**: 
    - Set strokeWidth: 0.6 by default for all new assets unless the user specifies otherwise.
    - Use lighter preview-friendly defaults that match the editor, not thick outlines.
    - Use realistic dimensions from the library.
9.  **COMBINED SEATING ASSETS**:
    - Assets named like "8 seater round table", "10 seater rectangular table", "VIP table", "curve sofa", etc. already include their seating/chairs in the asset artwork.
    - DO NOT ask for separate chairs for those assets.
    - DO NOT add extra chairsAround or separate chair assets around them unless the user explicitly asks for additional loose chairs.
10.  **JSON RESPONSE**: Always include 'choices' array if you are asking a multi-option question like the preloaded spaces prompt.
11.  **DOORS/WINDOWS**: Depth must match wall thickness (150mm).
    - If a door or window is attached to the TOP wall, use rotation 0.
    - If attached to the RIGHT wall, use rotation 90.
    - If attached to the BOTTOM wall, use rotation 180.
    - If attached to the LEFT wall, use rotation 270.
    - Apply this to both single and double doors.

══════════════════════════════════════════════════════════════
  STRICT JSON RESPONSE FORMAT
══════════════════════════════════════════════════════════════
Reply with ONE of these shapes. No prose, no markdown fences, pure JSON.

{ "followUp": "Question?", "choices": ["Option 1", "Option 2"], "preview": { ... } }

{ "message": "Answer." }

{ "assetSelection": { "category": "all", "message": "Select:" } }
IMPORTANT: Use 'assetSelection' ONLY during the initial planning phase when the user needs to pick a table/chair/asset type. NEVER use 'assetSelection' for follow-up questions about windows, doors, or other extras after a plan has already been generated.

{ "plan": { 
    "walls": [...], 
    "assets": [{ "assetName": "...", "xMm": 0, "yMm": 0, "tableName": "1" }, ...], 
    "tableArrangement": { "type": "grid" },
    "shapes": [{ "type": "rectangle", "fillType": "texture", "fillTexture": "sand-01", ... }],
    "annotations": [...]
  } 
}

{ "operation": { ... } }

══════════════════════════════════════════════════════════════
  PLATFORM KNOWLEDGE
══════════════════════════════════════════════════════════════
Canvas: ${canvasW} × ${canvasH} mm. All coordinates are MILLIMETRES. Asset positions are their CENTRE (x, y).
Canvas centre: (${canvasCX}, ${canvasCY}). Top-left: (0, 0). Bottom-right: (${canvasW}, ${canvasH}).
CRITICAL COORDINATE SYSTEM FOR ASSETS:
Whenever you provide explicit 'xMm' and 'yMm' coordinates for assets or tables, they MUST be relative to the TOP-LEFT corner of the room walls!
- Top-Left corner of the interior space (inside the walls) is ALWAYS (0, 0).
- Center of the room is ALWAYS (roomWidth / 2, roomHeight / 2).
- Bottom-Right corner of the room is ALWAYS (roomWidth, roomHeight).
DO NOT guess absolute canvas coordinates. DO NOT use negative numbers. Just plot them inside your own room dimensions (from 0 to W, 0 to H).
- ALIGNMENT: To center a row of items, calculate the total width and subtract it from the room width, then divide by 2 for the starting X offset.

AVAILABLE ASSETS (${assetList.length} total): ${assetContext}

WALL TYPES: ${WALL_TYPES.map(w => w.label + ' (' + w.thickness + 'mm thick)').join(', ')}

SHAPE TYPES: rectangle, ellipse (circle), polygon, line, arrow, arc, text

FILL OPTIONS: solid color | gradient (linear/radial) | hatch pattern (horizontal/vertical/diagonal-right/diagonal-left/cross/diagonal-cross/dots) | texture (requires fillTexture ID) | none
TEXTURES (for fillTexture): grid, bricks-01, bricks-02, concrete-01, concrete-02, concrete-03, concrete-04, dots-01, dots-02, grass-01, grass-02, grass-03, gravel-01, gravel-02, marble-01, marble-02, marble-03, paving-01, paving-02, porous-cement-wall, road-01, road-02, road-03, sand-01, sand-02, sand-03, soil-01, stone-01, tile-01, tile-02, water-01, water-02, white-grunge, wood-grain-01, wood-grain-02, wood-grain-03

LINE STYLES: solid | dashed | dotted | double

ALL ITEM PROPERTIES YOU CAN SET OR MODIFY:
  x, y        — position in mm (centre)
  width, height — size in mm
  scale       — multiplier
  rotation    — degrees clockwise
  fill        — hex color (e.g. "#ef4444") or "transparent"
  stroke      — hex color (border/outline)
  strokeWidth — mm
  opacity     — 0–1
  lineType    — "solid" | "dashed" | "dotted" | "double"
  fillType    — "color" | "gradient" | "hatch"
  gradientStart / gradientEnd — hex colors
  gradientAngle — degrees
  hatchPattern / hatchColor / hatchSpacing
  zIndex      — layer order
  visible, locked — booleans
  backgroundColor - hex color

IMPORTANT FOR SCALING & SIZING:
- NATURAL SIZES: By default, use the asset's base "width" and "height" provided in the asset list. You do NOT have to scale assets up just because a room is large. Only resize if the user asks (e.g., "make it twice as big", "resize to 2000x1000").
- BASE DIMENSIONS: Every asset in the library has a base "width" and "height". You receive these in the asset list.
- RELATIVE SCALING: If the user says "make it 2x bigger", multiply the base width and height by 2 and return them as "widthMm" and "heightMm".
- EXPLICIT DIMENSIONS: Always prefer returning explicit "widthMm" and "heightMm" instead of a "scale" property to ensure maximum precision.
- DOORS: Doors are special. Their "thickness" (width or height depending on rotation) MUST ALWAYS match the wall thickness (default 150mm). Their length should remain realistic (900mm-1200mm).
- STROKE WIDTH: Use "strokeWidth": 0.6 for assets and "strokeWidth": 2 for walls/shapes by default unless the user specifies otherwise.

DYNAMIC SPACING STANDARDS:
Because assets scale dynamically with the room, space them out proportionately! If you make chairs 10x bigger for a huge room (e.g., 5000mm chair), also make the distance between tables 10x larger.
  Standard ratios to base off of (when chairs are 500mm):
  Minimum gap between items: 1x chair size (500 mm)
  Dining tables (banquet): 4x chair size (2000 mm between centres)
  Round tables (wedding): 5x chair size (2500 mm between centres)
  Cocktail tables: 3x chair size (1500 mm between centres)

DOORS AND WINDOWS:
Doors MUST fit perfectly into the wall. You MUST constrain the depth/thickness (heightMm/widthMm depending on rotation) of the door to match the wall thickness exactly (usually 150mm). Ensure door widths remain proportional to human scale (e.g., 900mm-1200mm), even if the room is very large, so they always look like realistic openings rather than massive oversized blocks.
When a door/window is assigned to a wall side, rotations are strict:
- top = 0
- right = 90
- bottom = 180
- left = 270

══════════════════════════════════════════════════════════════
  NATURAL LANGUAGE — SYNONYM MAPPINGS
══════════════════════════════════════════════════════════════
All of these mean the same thing — understand them freely:

COLOR / FILL SYNONYMS:
  "make it red" / "paint it red" / "fill with red" / "colour red" / "turn it red" → fill: "#ef4444"
  "change background to blue" / "blue fill" / "shade blue" → fill: "#3b82f6"
  "no fill" / "clear fill" / "transparent background" / "empty fill" → fill: "transparent"
  "gradient from X to Y" / "fade from X to Y" / "blend X to Y" → fillType: "gradient"
  "hatched" / "hatching" / "crosshatch" / "striped fill" → fillType: "hatch"
  "remove color" / "no color" → fill: "transparent"

BORDER / STROKE SYNONYMS:
  "border" / "outline" / "stroke" / "edge" / "ring" / "frame" → stroke property
  "thick border" / "heavier outline" / "fatter stroke" → increase strokeWidth
  "thin border" / "hairline" / "fine outline" → strokeWidth: 1 or 2
  "no border" / "remove outline" / "borderless" → strokeWidth: 0
  "dashed border" / "dotted line" / "broken border" → lineType: "dashed" or "dotted"

SIZE / SCALE SYNONYMS:
  "bigger" / "larger" / "enlarge" / "grow" / "expand" → scaleFactor > 1
  "smaller" / "shrink" / "reduce" / "compact" / "miniaturize" → scaleFactor < 1
  "double" / "twice as big" / "2x" → scaleFactor: 2
  "half" / "50%" / "shrink by half" → scaleFactor: 0.5
  "resize to WxH" / "make it W mm wide and H mm tall" / "W by H" → widthMm + heightMm

POSITION / MOVEMENT SYNONYMS:
  "center it" / "put in the middle" / "centre on canvas" → x: canvasCX, y: canvasCY
  "move left" / "shift left" / "go left" / "push left" → dx: negative
  "nudge" / "slightly" / "a bit" / "a little" → 50–100 mm
  "a lot" / "way" / "far" → 500–2000 mm
  "move to top" / "push to top edge" → y near 0
  "move to bottom" / "push to bottom" → y near canvasH
  "move to right side" / "push right" → x near canvasW
  "move to left side" / "push to left edge" → x near 0
  "stagger" / "offset in a zigzag" → alternate x or y positions

ROTATION SYNONYMS:
  "rotate 90" / "turn 90 degrees" / "quarter turn" → deltaRotation: 90
  "upside down" / "flip 180" → rotation: 180
  "tilt slightly" / "angled a bit" → deltaRotation: 15
  "horizontal" → rotation: 0 or 90 depending on current

LAYER SYNONYMS:
  "bring to front" / "on top" / "above everything" / "top layer" → zIndex: 99999, bringToFront: true
  "send to back" / "behind everything" / "bottom layer" → zIndex: 0, sendToBack: true
  "move forward" / "bring up" / "step up" → bringForward: true
  "move backward" / "send back" / "step down" → sendBackward: true

VISIBILITY & LOCKING:
  "hide this" / "invisible" / "make it vanish" → visible: false
  "show this" / "make visible" → visible: true
  "lock it" / "freeze this" / "don't let me move it" / "secure" → locked: true
  "unlock" / "free it" → locked: false

OPACITY:
  "faded" / "see-through" / "transparent" / "translucent" / "X% opacity" → opacity: 0-1

LINE STYLES:
  "dashed line" / "dotted border" / "dashed stroke" → lineType: "dashed" or "dotted"
  "solid line" / "continuous stroke" → lineType: "solid"
  "double line" / "parallel stroke" → lineType: "double"

FILL TYPES (Property Bar):
  "wood texture" / "brick texture" / "metal texture" → fillType: "texture", fillTexture: "wood-grain" | "brick" | "metal"
  "striped pattern" / "dots pattern" → fillType: "hatch", hatchPattern: "horizontal" | "dots"
  "gradient" / "fade" → fillType: "gradient"

ARRANGEMENT & LAYOUT SYNONYMS:
  "evenly spaced" / "equal gaps" / "distribute evenly" → distribute operation
  "in a row" / "horizontal row" / "side by side" → row layout
  "in a column" / "vertical column" / "stacked" → column layout
  "grid" / "matrix" / "X by Y" / "X columns, Y rows" → grid layout
  "in a circle" / "around the table" / "ring formation" / "circular" → chairsAround
  "circular arrangement" / "tables in a circle" → tableArrangement.type = "circular"
  "linear arrangement" / "single row" / "single column" → tableArrangement.type = "linear"
  "perimeter arrangement" / "around the wall" / "edge arrangement" → tableArrangement.type = "perimeter"
  "u-shape arrangement" / "horseshoe" → tableArrangement.type = "u-shape"
  "zig zag" / "zig-zag" / "zigzag" / "staggered rows" → tableArrangement.type = "chevron"
  "semi-circle" / "semi circle" / "arc" / "around the center" → tableArrangement.type = "circular"
  "boardroom arrangement" / "boardroom style" / "conference row" → tableArrangement.type = "boardroom"
  "classroom arrangement" / "training room style" / "rows facing front" → tableArrangement.type = "classroom"
  "chevron arrangement" / "staggered rows" / "zigzag rows" → tableArrangement.type = "chevron"
  "theater" / "auditorium" / "stadium" / "seating block" / "rows" → seatingLayout
  "classroom style" / "seminar" / "lecture" → seatingLayout (type: "classroom")
  "line up" / "align left/right/top/bottom/center" → align operation
  "cluster" / "group together" → group items near each other

USE THE AVAILABLE ASSETS LIST TO FULFILL ALL REQUESTS.
 
 ══════════════════════════════════════════════════════════════
   SEATING LAYOUT INSTRUCTIONS
 ══════════════════════════════════════════════════════════════
 Use 'seatingLayout' for LARGE numbers of standalone chairs (50+).
 - type: "theater" (rows of chairs) | "classroom" (rows of chairs with implied tables)
 - count: total number of chairs
 - assetName: usually "normal-chair" or "event-chair"
 - rowSpacingMm: default 1000 for theater, 1500 for classroom
 - colSpacingMm: default 700 for theater
 - orientation: "horizontal" (face the top/bottom) or "vertical" (face the sides)
 DO NOT list individual chairs in 'plan.assets' if they are in a grid/block; use 'seatingLayout' instead.
 For LARGE repeated tables/assets, DO NOT emit hundreds of duplicate asset objects.
 Instead emit ONE asset object with "count" and use gridLayout, for example:
 { "assetName": "10 seater round table 01", "count": 40, "chairCount": 10, "startTableNumber": 1 }
 The app will expand and place the repeated items automatically.

══════════════════════════════════════════════════════════════
  DEFAULT SPACING STANDARDS
══════════════════════════════════════════════════════════════
  Minimum gap between items: 500 mm
  Dining tables: 2000-2500 mm between centres

══════════════════════════════════════════════════════════════
  WHAT YOU CAN DO (FULL CAPABILITY REFERENCE)
══════════════════════════════════════════════════════════════

1. GENERATE COMPLETE LAYOUTS
   → Return plan with walls + assets + chairsAround + shapes

2. ADD INDIVIDUAL ITEMS
   → Return plan with assets or shapes containing 1 or more items

3. MODIFY SELECTED ASSETS (selectedAssets array is provided)
   → Return plan.modifications for positional/property changes
   → OR return operation for structural changes (align, distribute, etc.)

4. REARRANGE / REDISTRIBUTE ITEMS
   → Calculate new xMm/yMm for each assetId in modifications
   → For grids: evenly space over available canvas area

5. ALIGN ITEMS
   → operation: { type: "align", alignment: "left"|"right"|"center"|"top"|"bottom"|"middle", assetIds: [...] }

6. DISTRIBUTE ITEMS
   → operation: { type: "distribute", direction: "horizontal"|"vertical", assetIds: [...] }

7. DUPLICATE ITEMS
   → operation: { type: "duplicate", count: N, offsetX: mm, offsetY: mm, assetIds: [...] }

8. DELETE ITEMS
   → operation: { type: "delete", deleteSelected: true }
   → OR: operation: { type: "delete", assetIds: [...] }
   → OR: operation: { type: "delete", deleteAll: true }

9. SELECT ITEMS BY CRITERIA
   → operation: { type: "select", criteria: { assetType: "table" } }
   → OR: operation: { type: "select", selectAll: true }

10. ADD SHAPES
    → plan.shapes: [{ type: "rectangle"|"ellipse"|"line"|"polygon", x, y, width, height, fillColor, strokeColor, strokeWidth }]

11. ADD ANNOTATIONS / TEXT
    → plan.annotations: [{ type: "text"|"label"|"arrow", x, y, text, fontSize }]

12. CIRCULAR / RADIAL ARRANGEMENTS
    → plan.chairsAround: [{ centerX, centerY, radiusMm, count, chairAsset, tableAsset, chairSizePx, tableSizePx, fillColor, strokeColor, strokeWidth }]

13. WALLS / ROOMS
    → plan.walls: [{ widthMm, heightMm, centerX?, centerY?, wallType? }]

14. STYLING (for generated items)
   → Use fillColor, strokeColor, strokeWidth, rotation on any asset/shape

══════════════════════════════════════════════════════════════
  COLOUR PALETTE (map common words to hex)
══════════════════════════════════════════════════════════════
red:#ef4444 darkred:#dc2626 orange:#f97316 amber:#f59e0b yellow:#eab308
lime:#84cc16 green:#22c55e emerald:#10b981 teal:#14b8a6 cyan:#06b6d4
sky:#0ea5e9 blue:#3b82f6 indigo:#6366f1 violet:#8b5cf6 purple:#a855f7
fuchsia:#d946ef pink:#ec4899 rose:#f43f5e white:#ffffff black:#000000
gray:#6b7280 lightgray:#d1d5db darkgray:#374151 navy:#1e3a5f
brown:#92400e gold:#ca8a04 silver:#9ca3af beige:#d4b896 cream:#fffdd0

══════════════════════════════════════════════════════════════
  POSITIONING MATH
══════════════════════════════════════════════════════════════
When asked to arrange N items in a grid inside a room:
  room bounds (relative) → minX=0, maxX=room width (same for y)
  available width = room width − (2 × padding), typically padding = 500 mm
  col spacing = availableWidth / (cols + 1)
  row spacing = availableHeight / (rows + 1)
  item x = minX + padding + col × colSpacing (for col 0…cols−1)
  item y = minY + padding + row × rowSpacing

"3 per vertical row" = 3 rows per column → columns = ceil(N / 3), rows = 3
"4 columns" = 4 items wide → rows = ceil(N / 4)
When in doubt, assume a square-ish grid: cols = ceil(sqrt(N))

══════════════════════════════════════════════════════════════
  JSON EXAMPLE (Proportional Planning):
══════════════════════════════════════════════════════════════
User: "Make a plan for a 10m x 10m room with 4 tables in a grid, label them Table 1 to Table 4."
{
  "plan": {
    "walls": [{ "widthMm": 10000, "heightMm": 10000, "wallType": "enclosure-150" }],
    "assets": [
      { "assetName": "6 seater rectangular table 6", "count": 4, "chairCount": 6, "startTableNumber": 1, "strokeWidth": 0.6 }
    ],
    "tableArrangement": { "type": "grid" },
    "annotations": [
      { "type": "label", "text": "Total Capacity: 24 Guests", "x": 9000, "y": 9500 }
    ]
  }
}

User: "Create a 15m x 10m room for me."
{
  "followUp": "I've drafted a 15m x 10m empty space for you. In plain language, tell me what you want for this event layout. For example: \"40 guests on the left side, a table with 2 chairs on the right, and a stage at the top.\"",
  "preview": {
    "walls": [{ "widthMm": 15000, "heightMm": 10000, "wallType": "enclosure-150" }]
  }
}

User: "I want a 20m x 20m room with round tables for 80 guests. Add a small stage too."
{
  "followUp": "Great! I have a 20x20m room with round tables for 80 guests and a stage ready. Would you also like to add any doors, windows, or a dance floor before I generate the layout?",
  "preview": {
    "walls": [{ "widthMm": 20000, "heightMm": 20000, "wallType": "enclosure-150" }],
    "assets": [{ "assetName": "1m x 1m Modular Stage 2", "xMm": 10000, "yMm": 2000, "widthMm": 4000, "heightMm": 2000 }]
  }
}

User: "No, just generate it."
{
  "plan": {
    "walls": [{ "widthMm": 20000, "heightMm": 20000, "wallType": "enclosure-150" }],
    "assets": [
      { "assetName": "1m x 1m Modular Stage 2", "xMm": 10000, "yMm": 2000, "widthMm": 4000, "heightMm": 2000 },
      { "assetName": "8 seater round table", "count": 10, "chairCount": 8, "startTableNumber": 1 }
    ]
  }
}

══════════════════════════════════════════════════════════════
  STRICT JSON RESPONSE FORMAT
══════════════════════════════════════════════════════════════
Reply with ONE of these shapes. No prose, no markdown fences, pure JSON.

{ "followUp": "<one question if truly ambiguous>" }

{ "message": "<answer to a how-to question>" }

{ "plan": { <Plan object> } }

{ "operation": { <Operation object> } }

type Plan = {
  walls?: { widthMm: number; heightMm: number; centerX?: number; centerY?: number; wallType?: string; thicknessPx?: number }[];
  assets?: {
    assetName: string;      // MUST match an asset name from the available list
    xMm?: number;           // omit to auto-calculate
    yMm?: number;
    widthMm?: number;
    heightMm?: number;
    count?: number;         // use for repeated identical assets in auto-grid layouts
    startTableNumber?: number; // optional starting number when count > 1
    rotation?: number;
    fillColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
  }[];
  tableArrangement?: {
    type?: 'grid' | 'linear' | 'circular' | 'perimeter' | 'u-shape' | 'boardroom' | 'classroom' | 'chevron';
    direction?: 'horizontal' | 'vertical';
    centerX?: number;
    centerY?: number;
    radiusMm?: number;
  };
  gridLayout?: { columns: number; rows: number };  // include when assets use grid auto-placement
};

type Operation = {
  type: 'delete' | 'align' | 'distribute' | 'duplicate' | 'group' | 'ungroup' | 'select';
  assetIds?: string[];
  wallIds?: string[];
  deleteAll?: boolean;
  deleteSelected?: boolean;
  alignment?: 'left' | 'right' | 'center' | 'top' | 'bottom' | 'middle';
  direction?: 'horizontal' | 'vertical';
  spacing?: number;
  count?: number; offsetX?: number; offsetY?: number;
  criteria?: { assetType?: string; color?: string; minSize?: number; maxSize?: number };
  selectAll?: boolean; deselectAll?: boolean;
};

══════════════════════════════════════════════════════════════
  OPERATIONAL RULES
══════════════════════════════════════════════════════════════
1. Use EXACT asset names from the library.
2. If this is the START of a session (no message history), and the user asks for a new layout/room, prioritize that NEW request over any existing obstacles on the canvas.
3. INTERACTIVE BALANCE: If the user provides both room and content details, execute in a "plan" response. If they ONLY provide room details, use a "followUp" to ask for the setup type and approximate guest count before generating a plan.
4. COORDINATES: When returning plan.assets, remember xMm and yMm are relative to the (0,0) corner of the room you just generated or that already exists.

${selectedContext}
${obstaclesContext}`;

    const history = Array.isArray(messages)
      ? messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role, content: m.content }))
      : [];

    const isNewSession = !history.some(m => m.role === 'assistant');
    const sessionContext = isNewSession
      ? "\n[IMPORTANT: BRAND NEW SESSION. If the user asks for a layout, draft it as a FRESH START. Ignore pre-existing obstacles on the canvas unless the user explicitly mentions them. Do not carry over furniture count or specific details from previous conversation turns.]\n"
      : "";

    const userContent = commandText || 'Help me create an event layout.';
    console.log(`[AI PLAN] Session Status: ${isNewSession ? 'NEW' : 'CONTINUING'}, History Length: ${history.length}`);
    const finalSystemPrompt = system + sessionContext + selectedContext + obstaclesContext;

    const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: finalSystemPrompt },
          ...history,
          { role: 'user', content: userContent },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
    });

    const json = await r.json();
    let content = json?.choices?.[0]?.message?.content || '{}';
    content = content.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');

    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch (e) { console.error('JSON parse error', e, content); }

    const recoveryNeeded =
      !parsed ||
      Object.keys(parsed).length === 0 ||
      (parsed.followUp && isWeakAssistantFallback(parsed.followUp)) ||
      (parsed.message && isWeakAssistantFallback(parsed.message) && !parsed.plan && !parsed.followUp && !parsed.operation && !parsed.assetSelection);

    if (recoveryNeeded) {
      parsed = buildContextualRecovery();
    }

    // Validate and resolve asset names
    if (parsed.plan?.assets) {
      parsed.plan.assets = parsed.plan.assets.map((asset: any) => {
        const foundAsset = findAssetByName(asset.assetName);
        if (foundAsset) {
          let finalWidth = asset.widthMm || foundAsset.width;
          let finalHeight = asset.heightMm || foundAsset.height;

          // Enforce realistic bounds for doors if they lack explicit sizes from AI (preventing massive SVGs from breaking the layout)
          if (foundAsset.id.includes('door')) {
            if (!asset.widthMm && !asset.heightMm) {
              finalWidth = foundAsset.id.includes('double') ? 1800 : 900; // standard width
              finalHeight = 150; // standard wall depth
            } else {
              // If AI incorrectly tries to scale doors up proportionally like tables, override it to human scale
              if (finalWidth > 3000) finalWidth = foundAsset.id.includes('double') ? 1800 : 900;
              if (finalHeight > 3000) finalHeight = 150;

              // Ensure one of the dimensions is exactly wall thickness (150) so it fits
              if (finalWidth > finalHeight) {
                finalHeight = 150;
              } else {
                finalWidth = 150;
              }
            }
          }

          return {
            strokeWidth: asset.strokeWidth ?? 0.6,
            ...asset,
            assetType: foundAsset.id,
            assetName: foundAsset.label,
            widthMm: finalWidth,
            heightMm: finalHeight
          };
        }
        console.warn(`Asset not found: ${asset.assetName}`);
        return asset;
      });
    }

    // Validate chairsAround assets
    if (parsed.plan?.chairsAround) {
      parsed.plan.chairsAround = parsed.plan.chairsAround.map((group: any) => {
        if (group.chairAsset) {
          const foundChair = findAssetByName(group.chairAsset);
          if (foundChair) {
            group.chairAsset = foundChair.id;
            group.chairSizePx = group.chairSizePx || 500; // Use 500mm standard event chair size as fallback
          }
        }
        if (group.tableAsset) {
          const foundTable = findAssetByName(group.tableAsset);
          if (foundTable) {
            group.tableAsset = foundTable.id;
            // Use AI requested size, or standard event scale (raw SVG size often > 1500)
            group.tableSizePx = group.tableSizePx || (foundTable.width && foundTable.width < 1500 ? Math.max(foundTable.width, foundTable.height!) : 1000);
          }
        }
        return group;
      });
    }

    // Validate wall types
    if (parsed.plan?.walls) {
      parsed.plan.walls = parsed.plan.walls.map((wall: any) => {
        if (wall.wallType) {
          const wallType = findWallType(wall.wallType);
          if (wallType) wall.thicknessPx = wallType.thickness;
        }
        return wall;
      });
    }

    if (parsed.message && !parsed.plan && !parsed.followUp && !parsed.operation && !parsed.assetSelection) {
      return res.status(200).json({ message: parsed.message });
    }

      if (parsed.followUp && !parsed.assetSelection && !structuredSpaceConversation) {
        const followUpLower = String(parsed.followUp).toLowerCase();
        const combinedUserText = `${history.filter((m) => m.role === 'user').map((m) => m.content).join('\n')}\n${userContent}`.toLowerCase();
        const marqueeConversation =
          combinedUserText.includes('marquee') || combinedUserText.includes('tent');
        const arrangementQuestion =
          followUpLower.includes('arrangement') ||
          followUpLower.includes('u-shape') ||
          followUpLower.includes('grid') ||
          followUpLower.includes('boardroom') ||
          followUpLower.includes('classroom') ||
          followUpLower.includes('chevron');
        const tableAlreadyChosen =
          assetList.some((asset) =>
            asset.category === 'Furniture' &&
            asset.name.toLowerCase().includes('table') &&
            combinedUserText.includes(asset.name.toLowerCase())
          );
        const asksForGuestCount =
          followUpLower.includes('how many guests') ||
          followUpLower.includes('number of guests') ||
          followUpLower.includes('guest count') ||
          followUpLower.includes('how many people') ||
          followUpLower.includes('how many attendees') ||
          followUpLower.includes('capacity');

        if (followUpLower.includes('which marquee') || followUpLower.includes('which tent')) {
          parsed.assetSelection = { category: 'marquee', message: 'Select a marquee' };
        } else if (
          marqueeConversation &&
          !asksForGuestCount &&
          (
            followUpLower.includes('what would you like to add') ||
            followUpLower.includes('select furniture') ||
            followUpLower.includes('choose furniture') ||
            followUpLower.includes('select a table') ||
            followUpLower.includes('choose a table') ||
            followUpLower.includes('select seating') ||
            followUpLower.includes('choose seating')
          )
        ) {
          parsed.assetSelection = { category: 'furniture', message: 'Select furniture to add' };
        } else if (!asksForGuestCount && (followUpLower.includes('round tables') || followUpLower.includes('rectangular tables') || followUpLower.includes('type of tables'))) {
          parsed.assetSelection = { category: 'table', message: 'Select a table' };
        } else if (arrangementQuestion && !tableAlreadyChosen) {
          parsed.followUp = 'What table would you like to use for this layout?';
          parsed.assetSelection = { category: 'table', message: 'Select a table' };
        } else if (!asksForGuestCount && followUpLower.includes('chair') && followUpLower.includes('table')) {
          parsed.assetSelection = { category: 'furniture', message: 'Select furniture' };
        } else if (!asksForGuestCount && (followUpLower.includes('chair') || followUpLower.includes('seating'))) {
          parsed.assetSelection = { category: 'chair', message: 'Select seating' };
        }
      }

      if (parsed.followUp) {
        const followUpLower = String(parsed.followUp).toLowerCase();
        if (
          followUpLower.includes('how many guests') ||
          followUpLower.includes('number of guests') ||
          followUpLower.includes('guest count') ||
          followUpLower.includes('how many people') ||
          followUpLower.includes('how many attendees') ||
          followUpLower.includes('capacity')
        ) {
          delete parsed.assetSelection;
        }
      }

    // Enrich asset selection if present
    if (parsed.assetSelection) {
      const category = parsed.assetSelection.category?.toLowerCase() || 'all';

      let options = assetList;
      if (category !== 'all') {
        const cat = category.toLowerCase().trim();
        // Simple plural normalization (chairs -> chair)
        const singularCat = cat.endsWith('s') ? cat.slice(0, -1) : cat;
        let tags = [cat, singularCat];

        // Map common synonyms to tags with broader scope
        if (['chair', 'seat', 'stool', 'sitting'].some(t => cat.includes(t))) {
          tags = ['chair', 'seating', 'stool', 'seat', 'sitting', 'furniture'];
        } else if (['table', 'desk', 'surface', 'banquet'].some(t => cat.includes(t))) {
          tags = ['table', 'furniture', 'surface', 'desk', 'tables'];
        } else if (['marquee', 'tent', 'structure', 'cover'].some(t => cat.includes(t))) {
          tags = ['marquee', 'tent', 'canopy'];
        } else if (['stage', 'platform'].some(t => cat.includes(t))) {
          tags = ['stage', 'platform', 'layout'];
        }

        const filteredKnowledge = searchAssetsByTags(tags);
        options = assetList.filter(a => filteredKnowledge.some(k => k.id === a.id));

        // Fallback for very specific queries or missing tags
        if (options.length === 0) {
          const searchVal = singularCat;
          options = assetList.filter(a =>
            a.name.toLowerCase().includes(searchVal) ||
            a.category.toLowerCase().includes(searchVal) ||
            a.id.toLowerCase().includes(searchVal)
          );
        }
      }

      // Safety limits: max 40 items if 'all' to avoid breaking the UI grid, but still show a comprehensive list
      if (category.includes('chair') || category.includes('seat') || category.includes('stool')) {
        options = options.filter((asset) => {
          const label = asset.name.toLowerCase();
          return (
            (label.includes('chair') || label.includes('stool')) &&
            !label.includes('sofa') &&
            !label.includes('table')
          );
        });
      }
      if (category.includes('table')) {
        options = options.filter((asset) => asset.name.toLowerCase().includes('table'));
      }

      parsed.assetSelection.options = options.slice(0, 50);
    }

    // Auto-portrait: rotate the entire plan 90° CW for non-square rooms
    if (parsed.plan && activeSpaceWidthMm && activeSpaceHeightMm) {
      const aspectRatio = activeSpaceWidthMm / activeSpaceHeightMm;
      if (Math.abs(aspectRatio - 1) > 0.15) {
        const oldW = activeSpaceWidthMm;
        const oldH = activeSpaceHeightMm;
        const rotatePos = (v: any) => {
          if (!v) return v;
          const ox = typeof v.xMm === 'number' ? v.xMm : typeof v.centerX === 'number' ? v.centerX : undefined;
          const oy = typeof v.yMm === 'number' ? v.yMm : typeof v.centerY === 'number' ? v.centerY : undefined;
          if (ox != null && oy != null) {
            const nx = oldH - oy;
            const ny = ox;
            if (typeof v.xMm === 'number') v.xMm = nx;
            if (typeof v.yMm === 'number') v.yMm = ny;
            if (typeof v.centerX === 'number') v.centerX = nx;
            if (typeof v.centerY === 'number') v.centerY = ny;
          }
          if (v.type !== 'line') {
            const ow = typeof v.widthMm === 'number' ? v.widthMm : 0;
            const oh = typeof v.heightMm === 'number' ? v.heightMm : 0;
            if (ow && oh) { v.widthMm = oh; v.heightMm = ow; }
          }
          if (typeof v.rotation === 'number') v.rotation = (v.rotation + 90) % 360;
          return v;
        };
        if (Array.isArray(parsed.plan.walls)) {
          parsed.plan.walls = parsed.plan.walls.map((w: any) => {
            const nw = { ...w, widthMm: oldH, heightMm: oldW };
            if (typeof nw.rotation === 'number') nw.rotation = (nw.rotation + 90) % 360;
            return nw;
          });
        }
        if (Array.isArray(parsed.plan.assets)) parsed.plan.assets = parsed.plan.assets.map(rotatePos);
        if (Array.isArray(parsed.plan.shapes)) parsed.plan.shapes = parsed.plan.shapes.map(rotatePos);
        if (parsed.plan.tableArrangement) rotatePos(parsed.plan.tableArrangement);
        if (Array.isArray(parsed.plan.seatingLayout)) parsed.plan.seatingLayout = parsed.plan.seatingLayout.map(rotatePos);
        if (Array.isArray(parsed.plan.chairsAround)) {
          parsed.plan.chairsAround = parsed.plan.chairsAround.map((g: any) => {
            const ox = g.centerX, oy = g.centerY;
            const nx = oldH - oy;
            const ny = ox;
            return { ...g, centerX: nx, centerY: ny, rotation: ((g.rotation || 0) + 90) % 360 };
          });
        }
      }
    }

    return res.status(200).json(parsed);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'AI error' });
  }
}
