import fs from 'node:fs';
import path from 'node:path';
import { CreateProductDto } from './dto/create-product.dto';

const BLOCKED_TERMS_FILE_CANDIDATES = [
  path.resolve(process.cwd(), '../moderation/blocked-terms.txt'),
  path.resolve(process.cwd(), 'moderation/blocked-terms.txt'),
  path.resolve(__dirname, '../../../../moderation/blocked-terms.txt')
];

let cachedBlockedTerms: string[] | null = null;

export type ProductModerationResult =
  | {
      passed: true;
    }
  | {
      passed: false;
      fieldLabel: '标题' | '描述' | '标签';
      matchedTerm: string;
    };

export type TextModerationResult =
  | {
      passed: true;
    }
  | {
      passed: false;
      matchedTerm: string;
    };

function containsChineseCharacter(value: string) {
  return /[\u3400-\u9fff]/u.test(value);
}

function shouldKeepBlockedTerm(term: string, allowShortChineseTerm = false) {
  if (!term || /^[^a-z0-9\u3400-\u9fff]+$/iu.test(term)) {
    return false;
  }

  if (containsChineseCharacter(term)) {
    return term.length >= (allowShortChineseTerm ? 2 : 3);
  }

  const compactTerm = term.replace(/\s+/g, '');
  if (!compactTerm) {
    return false;
  }

  if (/^[a-z0-9]+$/i.test(compactTerm)) {
    return compactTerm.length >= 4;
  }

  return compactTerm.length >= 3;
}

function resolveBlockedTermsFile() {
  return BLOCKED_TERMS_FILE_CANDIDATES.find((candidate) => fs.existsSync(candidate));
}

function loadBlockedTerms(fallbackTerms: string[]) {
  if (cachedBlockedTerms) {
    return cachedBlockedTerms;
  }

  const terms = new Set<string>();
  const blockedTermsFile = resolveBlockedTermsFile();

  if (blockedTermsFile) {
    const content = fs.readFileSync(blockedTermsFile, 'utf8');
    content
      .split(/\r?\n/)
      .map((line) => line.trim().toLowerCase())
      .filter((term) => shouldKeepBlockedTerm(term))
      .forEach((term) => terms.add(term));
  }

  fallbackTerms
    .map((term) => term.trim().toLowerCase())
    .filter((term) => shouldKeepBlockedTerm(term, true))
    .forEach((term) => terms.add(term));

  cachedBlockedTerms = [...terms];
  return cachedBlockedTerms;
}

export function moderateProductPayload(
  payload: Pick<CreateProductDto, 'title' | 'description' | 'tags'>,
  fallbackTerms: string[]
): ProductModerationResult {
  const fields: Array<{ fieldLabel: '标题' | '描述' | '标签'; value: string }> = [
    {
      fieldLabel: '标题',
      value: payload.title ?? ''
    },
    {
      fieldLabel: '描述',
      value: payload.description ?? ''
    },
    {
      fieldLabel: '标签',
      value: (payload.tags ?? []).join(' ')
    }
  ];

  for (const field of fields) {
    const result = moderateText(field.value, fallbackTerms);
    if (!result.passed) {
      return {
        passed: false,
        fieldLabel: field.fieldLabel,
        matchedTerm: result.matchedTerm
      };
    }
  }

  return {
    passed: true
  };
}

export function moderateText(value: string, fallbackTerms: string[]): TextModerationResult {
  const normalizedValue = value.trim().toLowerCase();
  if (!normalizedValue) {
    return {
      passed: true
    };
  }

  const blockedTerms = loadBlockedTerms(fallbackTerms);
  const matchedTerm = blockedTerms.find((term) => normalizedValue.includes(term));
  if (matchedTerm) {
    return {
      passed: false,
      matchedTerm
    };
  }

  return {
    passed: true
  };
}

export function resetProductModerationCacheForTests() {
  cachedBlockedTerms = null;
}
