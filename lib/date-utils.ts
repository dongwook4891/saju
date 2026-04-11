// Asia/Seoul 시간대 기준 날짜 계산 유틸리티

/**
 * 현재 Asia/Seoul 시간대 기준 날짜를 YYYY-MM-DD 형식으로 반환
 */
export function getKSTToday(): string {
  const now = new Date();
  const kstDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));

  const year = kstDate.getFullYear();
  const month = String(kstDate.getMonth() + 1).padStart(2, '0');
  const day = String(kstDate.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Asia/Seoul 시간대 기준 내일 날짜를 YYYY-MM-DD 형식으로 반환
 */
export function getKSTTomorrow(): string {
  const now = new Date();
  const kstDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  kstDate.setDate(kstDate.getDate() + 1);

  const year = kstDate.getFullYear();
  const month = String(kstDate.getMonth() + 1).padStart(2, '0');
  const day = String(kstDate.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Asia/Seoul 시간대 기준 현재 월의 시작일과 종료일 반환
 */
export function getKSTCurrentMonth(): { start: string; end: string } {
  const now = new Date();
  const kstDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));

  const year = kstDate.getFullYear();
  const month = kstDate.getMonth();

  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0);

  const startStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const endDay = String(endDate.getDate()).padStart(2, '0');
  const endStr = `${year}-${String(month + 1).padStart(2, '0')}-${endDay}`;

  return { start: startStr, end: endStr };
}

/**
 * Asia/Seoul 시간대 기준 현재 연도의 시작일과 종료일 반환
 */
export function getKSTCurrentYear(): { start: string; end: string } {
  const now = new Date();
  const kstDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));

  const year = kstDate.getFullYear();

  return {
    start: `${year}-01-01`,
    end: `${year}-12-31`,
  };
}

/**
 * 두 타임스탬프가 Asia/Seoul 기준 같은 날인지 확인
 */
export function isSameKSTDate(date1: string | Date, date2: string | Date): boolean {
  const d1 = new Date(date1);
  const d2 = new Date(date2);

  const kstDate1 = new Date(d1.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const kstDate2 = new Date(d2.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));

  return (
    kstDate1.getFullYear() === kstDate2.getFullYear() &&
    kstDate1.getMonth() === kstDate2.getMonth() &&
    kstDate1.getDate() === kstDate2.getDate()
  );
}
