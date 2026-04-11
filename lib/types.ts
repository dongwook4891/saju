// 사주 결과 타입 정의

export interface SajuPeriodResult {
  summary: string;
  caution: string;
  oneLineTip: string;
}

export interface SajuFullResult {
  today: SajuPeriodResult;
  tomorrow: SajuPeriodResult;
  month: SajuPeriodResult;
  year: SajuPeriodResult;
}

export interface BirthInfo {
  birthDate: string;  // YYYY-MM-DD
  birthHour: number;  // 0-23
  birthMinute: number; // 0-59
}

export interface SavedSajuResult {
  id: string;
  userId: string;
  resultDate: string;
  todaySummary: string;
  todayCaution: string;
  todayTip: string;
  tomorrowSummary: string;
  tomorrowCaution: string;
  tomorrowTip: string;
  monthSummary: string;
  monthCaution: string;
  monthTip: string;
  yearSummary: string;
  yearCaution: string;
  yearTip: string;
  generatedAt: string;
  regenerateCount: number;
  lastRegeneratedAt: string | null;
}

export interface ChatRoom {
  id: string;
  userId: string;
  roomDate: string;
  sajuResultId: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  chatRoomId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}
