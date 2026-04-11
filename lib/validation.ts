// Gemini 응답 검증 유틸리티

import { SajuFullResult, SajuPeriodResult } from './types';

/**
 * 기간별 결과 객체 검증
 */
function isValidPeriodResult(obj: unknown): obj is SajuPeriodResult {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const period = obj as Record<string, unknown>;

  return (
    typeof period.summary === 'string' &&
    typeof period.caution === 'string' &&
    typeof period.oneLineTip === 'string' &&
    period.summary.length > 0 &&
    period.caution.length > 0 &&
    period.oneLineTip.length > 0
  );
}

/**
 * Gemini 응답 JSON 구조 검증
 * 필수 필드가 모두 있고 형식이 올바른지 확인
 */
export function validateSajuResult(data: unknown): data is SajuFullResult {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const result = data as Record<string, unknown>;

  // 4개 기간이 모두 있는지 확인
  if (!result.today || !result.tomorrow || !result.month || !result.year) {
    return false;
  }

  // 각 기간의 필수 필드 검증
  return (
    isValidPeriodResult(result.today) &&
    isValidPeriodResult(result.tomorrow) &&
    isValidPeriodResult(result.month) &&
    isValidPeriodResult(result.year)
  );
}

/**
 * 검증 실패 시 상세 에러 메시지 반환
 */
export function getValidationErrorMessage(data: unknown): string {
  if (typeof data !== 'object' || data === null) {
    return 'Response is not a valid JSON object';
  }

  const result = data as Record<string, unknown>;
  const periods = ['today', 'tomorrow', 'month', 'year'];
  const missingPeriods = periods.filter(p => !result[p]);

  if (missingPeriods.length > 0) {
    return `Missing required periods: ${missingPeriods.join(', ')}`;
  }

  for (const period of periods) {
    const periodData = result[period];
    if (!isValidPeriodResult(periodData)) {
      if (typeof periodData !== 'object' || periodData === null) {
        return `Period '${period}' is not a valid object`;
      }
      const p = periodData as Record<string, unknown>;
      const fields = ['summary', 'caution', 'oneLineTip'];
      const missing = fields.filter(f => typeof p[f] !== 'string' || (p[f] as string).length === 0);
      if (missing.length > 0) {
        return `Period '${period}' missing or empty fields: ${missing.join(', ')}`;
      }
    }
  }

  return 'Unknown validation error';
}
