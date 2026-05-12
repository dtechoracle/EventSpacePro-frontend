import type { NextApiRequest, NextApiResponse } from 'next';
import { getCompactAssetList, findAssetByName, searchAssetsByTags } from '@/lib/aiAssetLibrary';
import { WALL_TYPES, findWallType, TOOLBAR_OPERATIONS, LAYOUT_OPERATIONS } from '@/lib/aiOperations';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

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
        /(^|\b)(?:no|nah|nope|none|nothing|without|skip)\b/.test(text) ||
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
    const selectedExactAsset = findAssetByName(exactCommandText);
    const selectedMentionedAsset =
      selectedExactAsset ||
      assetList.find((asset) => normalizedCommand.includes(asset.name.toLowerCase())) ||
      assetList.find((asset) => commandCanonical.includes(canonicalize(asset.name))) ||
      null;
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
    const roomDimMatch = userHistoryText.match(/(\d+(?:\.\d+)?)\s*(mm|m)?\s*(?:x|by)\s*(\d+(?:\.\d+)?)\s*(mm|m)?/i);
    const toMm = (value?: string, unit?: string) => {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return null;
      return (unit || '').toLowerCase() === 'm' ? numeric * 1000 : numeric;
    };
    const roomWidthMm = roomDimMatch ? toMm(roomDimMatch[1], roomDimMatch[2]) : null;
    const roomHeightMm = roomDimMatch ? toMm(roomDimMatch[3], roomDimMatch[4] || roomDimMatch[2]) : null;
    const extractGuestCount = (text: string) => {
      const directMatch = String(text || '').match(/(?:about\s+)?(\d+)\s*[a-z]*\s*(?:guest|guests|attendee|attendees|people|persons)/i);
      if (!directMatch) return null;
      const value = Number(directMatch[1]);
      return Number.isFinite(value) ? value : null;
    };
    const guestCount = extractGuestCount(userHistoryText);
    const parseArrangementIntent = (text: string): string | null => {
      const lower = String(text || '').toLowerCase();
      const compact = canonicalize(lower);
      if (
        lower.includes('u-shape') ||
        lower.includes('u shape') ||
        lower.includes('u shaped') ||
        compact.includes('ushape') ||
        compact.includes('ushaped')
      ) return 'u-shape';
      if (lower.includes('boardroom') || compact.includes('boardroom') || hasNearToken(['boardroom'], 2)) return 'boardroom';
      if (lower.includes('classroom') || compact.includes('classroom') || hasNearToken(['classroom'], 2)) return 'classroom';
      if (lower.includes('chevron') || compact.includes('chevron') || hasNearToken(['chevron'], 2)) return 'chevron';
      if (lower.includes('perimeter') || compact.includes('perimeter') || hasNearToken(['perimeter'], 2)) return 'perimeter';
      if (
        lower.includes('circular') ||
        lower.includes('circle') ||
        lower.includes('round arrangement') ||
        compact.includes('circular') ||
        compact.includes('rounded') ||
        hasNearToken(['circular', 'circle', 'round'], 2)
      ) return 'circular';
      if (lower.includes('linear') || lower.includes('line') || compact.includes('linear') || hasNearToken(['linear', 'line'], 2)) return 'linear';
      if (lower.includes('grid') || compact.includes('grid') || hasNearToken(['grid'], 1)) return 'grid';
      return null;
    };
    const arrangementTypeFromHistory = parseArrangementIntent(lowerUserHistoryText);
    const arrangementTypeFromCurrentInput = parseArrangementIntent(exactCommandText);
    const arrangementAlreadyKnown = Boolean(arrangementTypeFromHistory || arrangementTypeFromCurrentInput);
    const arrangementType = arrangementTypeFromCurrentInput || arrangementTypeFromHistory || 'grid';
    const customConversation =
      lowerUserHistoryText.includes('\ncustom') ||
      lowerUserHistoryText.includes('custom\n') ||
      lowerUserHistoryText.includes('custom space') ||
      lowerUserHistoryText.includes('custom');
    const tableAssets = assetList.filter(
      (asset) => asset.category === 'Furniture' && asset.name.toLowerCase().includes('table')
    );
    const stageAssets = assetList.filter(
      (asset) => asset.name.toLowerCase().includes('stage')
    );
    const selectedTableFromHistory =
      tableAssets
        .sort((a, b) => b.name.length - a.name.length)
        .find((asset) => lowerUserHistoryText.includes(asset.name.toLowerCase())) || null;
    const selectedStageFromHistory =
      stageAssets
        .sort((a, b) => b.name.length - a.name.length)
        .find((asset) => lowerUserHistoryText.includes(asset.name.toLowerCase()) || lowerUserHistoryText.includes(canonicalize(asset.name))) || null;
    const tableChoiceKnown = Boolean(selectedTableFromHistory);
    const stageChoiceKnown = Boolean(selectedStageFromHistory);
    const stageMentioned = /\bstage\b|\bno stage\b/.test(lowerUserHistoryText);
    const extrasMentioned = /\bdance floor\b|\bentrance door\b|\bdoor\b|\bvip\b|\bbuffet\b|\bbar\b|\bpresentation\b|\bnone\b|\bno extras\b|\bnothing else\b/.test(lowerUserHistoryText);
    const arrangementReply = Boolean(arrangementTypeFromCurrentInput);
    const lastAssistantPromptType = (() => {
      for (let i = assistantHistory.length - 1; i >= 0; i--) {
        const content = String(assistantHistory[i]?.content || '');
        if (/would you like to include any additional features/i.test(content)) return 'extras';
        if (/where should i place the stage|where would you like the stage/i.test(content)) return 'stage-placement';
        if (/what size would you like for the stage|select a stage/i.test(content)) return 'stage-size';
        if (/would you like to add a stage/i.test(content)) return 'stage-yes-no';
        if (/how many guests|number of guests|guest count|how many people|how many attendees|capacity|roughly how many guests/i.test(content)) return 'guest-count';
        if (/what type of seating|what type of tables|what table|round tables|rectangular tables|select a table|select seating/i.test(content)) return 'table-choice';
        if (/how would you like them arranged|arrangement/i.test(content)) return 'arrangement';
        if (/would you like to proceed with generating|generate the layout now|generate now|ready to proceed|should i generate/i.test(content)) return 'generate';
      }
      return null;
    })();
    const assistantAskedForGuestCount = lastAssistantPromptType === 'guest-count';
    const assistantAskedForStage = lastAssistantPromptType === 'stage-yes-no';
    const assistantAskedForStageSize = lastAssistantPromptType === 'stage-size';
    const assistantAskedForStagePlacement = lastAssistantPromptType === 'stage-placement';
    const assistantAskedForExtras = lastAssistantPromptType === 'extras';
    const assistantAskedForGeneration = lastAssistantPromptType === 'generate';
    const parsedGuestCountFromCurrentReply = (() => {
      if (!assistantAskedForGuestCount) return null;
      const match = exactCommandText.match(/(\d{1,5})/);
      if (!match) return null;
      const value = Number(match[1]);
      return Number.isFinite(value) ? value : null;
    })();
    const effectiveGuestCount = guestCount || parsedGuestCountFromCurrentReply;
    const noStageReply =
      assistantAskedForStage &&
      isNegativeIntent(normalizedIntentText);
    const yesStageReply =
      assistantAskedForStage &&
      !isNegativeIntent(normalizedIntentText) &&
      (isAffirmativeIntent(normalizedIntentText) || normalizedIntentText.includes('stage'));
    const noExtrasReply =
      assistantAskedForExtras &&
      isNegativeIntent(normalizedIntentText);
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
    const stageDimMatch = exactCommandText.match(/(\d+(?:\.\d+)?)\s*(mm|m|ft)?\s*(?:x|by)\s*(\d+(?:\.\d+)?)\s*(mm|m|ft)?/i);
    const findClosestStageAsset = (widthMm: number, heightMm: number) => {
      const candidates = [...stageAssets];
      if (candidates.length === 0) return null;
      return candidates
        .map((asset) => {
          const assetW = Number(asset.width || 1000);
          const assetH = Number(asset.height || 1000);
          const dw = Math.abs(assetW - widthMm);
          const dh = Math.abs(assetH - heightMm);
          return { asset, score: dw + dh };
        })
        .sort((a, b) => a.score - b.score)[0]?.asset || null;
    };
    const resolveStageChoiceFromText = (text: string) => {
      const exactStage = findAssetByName(text);
      if (exactStage && exactStage.name.toLowerCase().includes('stage')) return exactStage;
      const canonicalText = canonicalize(text);
      const fuzzyStage = stageAssets.find((asset) => canonicalText.includes(canonicalize(asset.name)));
      if (fuzzyStage) return fuzzyStage;
      const match = text.match(/(\d+(?:\.\d+)?)\s*(mm|m|ft)?\s*(?:x|by)\s*(\d+(?:\.\d+)?)\s*(mm|m|ft)?/i);
      if (!match) return null;
      const widthMm = parseMeasureToMm(match[1], match[2]);
      const heightMm = parseMeasureToMm(match[3], match[4] || match[2]);
      if (!widthMm || !heightMm) return null;
      return findClosestStageAsset(widthMm, heightMm);
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
    const selectedStageForFlow = stageChoiceFromCurrentInput || selectedStageFromHistory || stageChoiceFromSizingHistory;
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
    const stagePlacementFromHistory = /inside u|open end|opening|center|top|bottom|left|right/i.test(lowerUserHistoryText)
      ? resolveStagePlacement(lowerUserHistoryText)
      : null;
    const selectedStagePlacement = stagePlacementFromCurrentInput || stagePlacementFromHistory;
    const buildCustomTablePreview = (assetName: string, stageAsset?: any | null, stagePlacement?: string | null) => {
      const assetNameLower = assetName.toLowerCase();
      const seatCountMatch = assetNameLower.match(/(\d+)\s*seater/i);
      const seatCount = seatCountMatch ? Number(seatCountMatch[1]) : null;
      const inferredTableCount = effectiveGuestCount && seatCount ? Math.max(1, Math.ceil(effectiveGuestCount / seatCount)) : 1;
      const preview: any = {
        walls: [{ widthMm: roomWidthMm, heightMm: roomHeightMm, wallType: 'enclosure-150' }],
        assets: [
          {
            assetName,
            count: inferredTableCount,
            chairCount: seatCount || undefined,
            strokeWidth: 0.6,
          },
        ],
        tableArrangement: { type: arrangementType },
      };
      if (stageAsset) {
        const stageWidth = Number(stageAsset.width || 1000);
        const stageHeight = Number(stageAsset.height || 1000);
        const placement = stagePlacement || (arrangementType === 'circular' ? 'center' : arrangementType === 'u-shape' ? 'open-end' : 'top');
        const centerX = (roomWidthMm || stageWidth) / 2;
        const centerY = (roomHeightMm || stageHeight) / 2;
        let stageX = centerX;
        let stageY = Math.max(stageHeight / 2 + 500, 1200);
        if (placement === 'center') {
          stageX = centerX;
          stageY = centerY;
        } else if (placement === 'bottom' || placement === 'open-end') {
          stageX = centerX;
          stageY = Math.max(stageHeight / 2 + 500, (roomHeightMm || stageHeight) - stageHeight / 2 - 500);
        } else if (placement === 'left') {
          stageX = stageWidth / 2 + 500;
          stageY = centerY;
        } else if (placement === 'right') {
          stageX = Math.max(stageWidth / 2 + 500, (roomWidthMm || stageWidth) - stageWidth / 2 - 500);
          stageY = centerY;
        }
        preview.assets.push({
          assetName: stageAsset.name,
          xMm: stageX,
          yMm: stageY,
          widthMm: stageWidth,
          heightMm: stageHeight,
          strokeWidth: 0.6,
        });
      }
      return preview;
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
        choices: ['Marquee', 'Grassy', 'Field', 'Park', 'Beach', 'Custom'],
      });
    }

    if (normalizedCommand === 'custom') {
      return res.status(200).json({
        followUp: 'Great choice! What are the dimensions of your custom space? Please provide the width and height in meters or millimeters.',
      });
    }

    if (
      roomWidthMm &&
      roomHeightMm &&
      customConversation &&
      !selectedMentionedAsset &&
      !effectiveGuestCount
    ) {
      return res.status(200).json({
        followUp: `I've drafted a ${roomWidthMm / 1000}m x ${roomHeightMm / 1000}m empty space for you. What kind of setup do you want here, and roughly how many guests should I plan for?`,
        preview: {
          walls: [{ widthMm: roomWidthMm, heightMm: roomHeightMm, wallType: 'enclosure-150' }],
        },
      });
    }

    if (
      roomWidthMm &&
      roomHeightMm &&
      customConversation &&
      effectiveGuestCount &&
      !tableChoiceKnown &&
      !selectedMentionedAsset
    ) {
      return res.status(200).json({
        followUp: `For ${effectiveGuestCount} guests, what table or seating setup would you like to use?`,
        assetSelection: {
          category: 'furniture',
          message: 'Select furniture',
          options: assetList.filter((a) => a.category === 'Furniture'),
        },
        preview: {
          walls: [{ widthMm: roomWidthMm, heightMm: roomHeightMm, wallType: 'enclosure-150' }],
        },
      });
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

    if (selectedMentionedAsset && selectedMentionedAsset.category === 'Marquee') {
      return res.status(200).json({
        followUp: `Great choice. I have your ${selectedMentionedAsset.name} ready. What tables, chairs, or other furniture would you like to add inside it?`,
        assetSelection: {
          category: 'furniture',
          message: 'Select furniture to add',
          options: assetList.filter((a) => a.category === 'Furniture'),
        },
        preview: {
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

    if (tableAssetSelected && (assistantAskedForTableChoice || roomWidthMm || roomHeightMm)) {
      const assetNameLower = selectedMentionedAsset.name.toLowerCase();
      const seatCountMatch = assetNameLower.match(/(\d+)\s*seater/i);
      const seatCount = seatCountMatch ? Number(seatCountMatch[1]) : null;
      const inferredTableCount = effectiveGuestCount && seatCount ? Math.max(1, Math.ceil(effectiveGuestCount / seatCount)) : null;
      const preview: any = roomWidthMm && roomHeightMm
        ? {
            walls: [{ widthMm: roomWidthMm, heightMm: roomHeightMm, wallType: 'enclosure-150' }],
            assets: [
              {
                assetName: selectedMentionedAsset.name,
                count: inferredTableCount || 1,
                chairCount: seatCount || undefined,
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

      if (!effectiveGuestCount) {
        return res.status(200).json({
          followUp: `How many guests should I plan for with the ${selectedMentionedAsset.name}?`,
          preview,
        });
      }

      if (!arrangementAlreadyKnown) {
        return res.status(200).json({
          followUp: `Great choice! With ${selectedMentionedAsset.name}, I’ll use ${inferredTableCount || 1} table${(inferredTableCount || 1) > 1 ? 's' : ''} for ${effectiveGuestCount} guests. How would you like them arranged?`,
          choices: ["Grid", "Linear", "Circular", "Perimeter", "U-Shape", "Boardroom", "Classroom", "Chevron"],
          preview,
        });
      }

      if (!stageMentioned) {
        return res.status(200).json({
          followUp: 'Would you like to add a stage to your layout?',
          choices: ['Yes, add a stage', 'No stage'],
          preview: {
            ...preview,
            tableArrangement: { type: arrangementType },
          },
        });
      }

      if (!extrasDecisionKnown) {
        return res.status(200).json({
          followUp: 'Would you like to include any additional features like a dance floor, entrance doors, or a VIP area before I generate the layout?',
          preview: {
            ...preview,
            tableArrangement: { type: arrangementType },
          },
        });
      }
    }

    if (
      roomWidthMm &&
      roomHeightMm &&
      customConversation &&
      effectiveGuestCount &&
      tableChoiceKnown &&
      arrangementReply
    ) {
      const assetNameLower = selectedTableFromHistory!.name.toLowerCase();
      const seatCountMatch = assetNameLower.match(/(\d+)\s*seater/i);
      const seatCount = seatCountMatch ? Number(seatCountMatch[1]) : null;
      const inferredTableCount = effectiveGuestCount && seatCount ? Math.max(1, Math.ceil(effectiveGuestCount / seatCount)) : 1;
      return res.status(200).json({
        followUp: 'Would you like to add a stage to your layout?',
        choices: ['Yes, add a stage', 'No stage'],
        preview: {
          ...buildCustomTablePreview(selectedTableFromHistory!.name),
        },
      });
    }

    if (
      roomWidthMm &&
      roomHeightMm &&
      customConversation &&
      effectiveGuestCount &&
      tableChoiceKnown &&
      arrangementAlreadyKnown &&
      assistantAskedForStage &&
      yesStageReply
    ) {
      return res.status(200).json({
        followUp: 'Select a stage size or type the stage you want.',
        assetSelection: {
          category: 'stage',
          message: 'Select a stage',
          options: stageAssets,
        },
        preview: buildCustomTablePreview(selectedTableFromHistory!.name),
      });
    }

    if (
      roomWidthMm &&
      roomHeightMm &&
      customConversation &&
      effectiveGuestCount &&
      tableChoiceKnown &&
      arrangementAlreadyKnown &&
      assistantAskedForStageSize &&
      stageChoiceFromCurrentInput
    ) {
      return res.status(200).json({
        followUp: 'Where should I place the stage in relation to the arrangement?',
        choices: getStagePositionChoices(),
        preview: buildCustomTablePreview(selectedTableFromHistory!.name, stageChoiceFromCurrentInput),
      });
    }

    if (
      roomWidthMm &&
      roomHeightMm &&
      customConversation &&
      effectiveGuestCount &&
      tableChoiceKnown &&
      arrangementAlreadyKnown &&
      assistantAskedForStagePlacement &&
      selectedStageForFlow
    ) {
      return res.status(200).json({
        followUp: 'Would you like to include any additional features like a dance floor, entrance doors, or a VIP area before I generate the layout?',
        preview: buildCustomTablePreview(selectedTableFromHistory!.name, selectedStageForFlow, selectedStagePlacement),
      });
    }

    if (
      roomWidthMm &&
      roomHeightMm &&
      customConversation &&
      effectiveGuestCount &&
      tableChoiceKnown &&
      arrangementAlreadyKnown &&
      assistantAskedForStage &&
      noStageReply
    ) {
      return res.status(200).json({
        followUp: 'Would you like to include any additional features like a dance floor, entrance doors, or a VIP area before I generate the layout?',
        preview: buildCustomTablePreview(selectedTableFromHistory!.name),
      });
    }

    if (
      roomWidthMm &&
      roomHeightMm &&
      customConversation &&
      effectiveGuestCount &&
      tableChoiceKnown &&
      arrangementAlreadyKnown &&
      assistantAskedForExtras &&
      noExtrasReply
    ) {
      return res.status(200).json({
        plan: buildCustomTablePreview(selectedTableFromHistory!.name, selectedStageForFlow, selectedStagePlacement),
      });
    }

    if (
      roomWidthMm &&
      roomHeightMm &&
      customConversation &&
      effectiveGuestCount &&
      tableChoiceKnown &&
      arrangementAlreadyKnown &&
      assistantAskedForGeneration &&
      proceedReply
    ) {
      return res.status(200).json({
        plan: buildCustomTablePreview(selectedTableFromHistory!.name, selectedStageForFlow, selectedStagePlacement),
      });
    }


    if (!OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });

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
    - **INITIAL FLOW**: If a user asks to "start a plan", "create a space", or "design an event", YOU MUST ASK: "Would you like to use one of our event location and space options?" and provide choices: ["Marquee", "Grassy", "Field", "Park", "Beach", "Custom"].
    - **PRELOADED SPACES**: If a user selects one:
        - **Marquee**: DO NOT return a plan or grass background immediately. Instead, use "assetSelection": { "category": "marquee", "message": "Excellent! Which marquee would you like to use for your event?" }.
        - **Grassy**: Use "fillTexture": "grass-01" for the background.
        - **Field**: Use "fillTexture": "grass-02" for the background.
        - **Park**: Use "fillTexture": "grass-03" or "road-01" for the background.
        - **Beach**: Use "fillTexture": "sand-01" or "sand-02" for a large background rectangle.
    - **STANDALONE STRUCTURES**: Marquees (and tents) are standalone. DO NOT add walls or rooms around them unless the user explicitly asks for a "room inside a marquee".
    - **PREVIEW DURING SELECTION**: Whenever an asset category or specific asset is selected, ALWAYS include it in the "preview" object so the user can see it in the chat bubble while you continue the conversation.
    - ALWAYS ask for dimensions (e.g., "What are the dimensions of your space?") if the user hasn't provided them yet, EXCEPT when they are selecting a standalone marquee/tent asset, because the marquee itself defines the space footprint.
    - For banquet / table-based layouts, once you know the room size or marquee size, guest count, and table type, ASK for arrangement preference before final generation unless the user already gave one.
    - Arrangement choices to offer: ["Grid", "Linear", "Circular", "Perimeter", "U-Shape", "Boardroom", "Classroom", "Chevron"].
    - Also ask whether they want a stage if they have not mentioned one yet. Stage choices: ["Yes, add a stage", "No stage"].
    - Ask about at least one more planning detail before final generation if it has not been mentioned yet: center aisle, dance floor, entrance doors, VIP area, buffet/bar area, or presentation space.
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
  "followUp": "I've drafted a 15m x 10m empty space for you. What kind of setup do you want here, and roughly how many guests should I plan for?",
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
  chairsAround?: {
    centerX: number; centerY: number; radiusMm: number; count: number;
    chairAsset?: string; chairSizePx?: number;
    tableAsset?: string; tableSizePx?: number;
    fillColor?: string; strokeColor?: string; strokeWidth?: number;
  }[];
  seatingLayout?: {
    type: 'theater' | 'classroom' | 'banquet' | 'u-shape' | 'boardroom';
    count: number;
    assetName: string;
    rows?: number;
    columns?: number;
    rowSpacingMm?: number;
    colSpacingMm?: number;
    centerX?: number; // relative to room origin
    centerY?: number; // relative to room origin
    orientation?: 'horizontal' | 'vertical'; // direction chairs face
  }[];
  shapes?: {
    type: 'rectangle' | 'ellipse' | 'circle' | 'line' | 'polygon' | 'arc';
    x: number; y: number; width?: number; height?: number;
    fillColor?: string; strokeColor?: string; strokeWidth?: number; rotation?: number;
  }[];
  annotations?: {
    type: 'text' | 'label' | 'arrow' | 'dimension';
    x: number; y: number; text?: string; fontSize?: number;
    targetX?: number; targetY?: number;
  }[];
  modifications?: {
    assetId?: string;      // asset or shape ID
    wallId?: string;       // wall ID
    xMm?: number; yMm?: number;
    widthMm?: number; heightMm?: number;
    rotation?: number; scale?: number;
    fillColor?: string; strokeColor?: string; strokeWidth?: number;
    opacity?: number; lineType?: string;
    zIndex?: number; bringToFront?: boolean; sendToBack?: boolean;
    bringForward?: boolean; sendBackward?: boolean;
    fillType?: string; fillGradientStart?: string; fillGradientEnd?: string; gradientAngle?: number;
    hatchPattern?: string; hatchColor?: string; hatchSpacing?: number;
    // Wall only:
    wallThickness?: number; wallType?: string; wallWidth?: number; wallHeight?: number;
    wallFillColor?: string; wallStrokeColor?: string;
    visible?: boolean; locked?: boolean;
  }[];
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

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
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

      if (parsed.followUp && !parsed.assetSelection) {
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
        if (['chair', 'seat', 'stool', 'sofa', 'sitting'].some(t => cat.includes(t))) {
          tags = ['chair', 'seating', 'stool', 'seat', 'sofa', 'sitting', 'furniture'];
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
      parsed.assetSelection.options = options.slice(0, 50);
    }

    return res.status(200).json(parsed);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'AI error' });
  }
}
