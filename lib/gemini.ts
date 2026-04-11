// Gemini API 호출 유틸리티 (공식 @google/generative-ai SDK 사용)

import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { ResponseSchema } from "@google/generative-ai";
import { BirthInfo, SajuFullResult } from "./types";
import { validateSajuResult, getValidationErrorMessage } from "./validation";
import { getKSTToday, getKSTTomorrow, getKSTCurrentMonth, getKSTCurrentYear } from "./date-utils";

const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const sajuPeriodSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    summary: { type: SchemaType.STRING },
    caution: { type: SchemaType.STRING },
    oneLineTip: { type: SchemaType.STRING },
  },
  required: ["summary", "caution", "oneLineTip"],
};

const sajuResponseSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    today: sajuPeriodSchema,
    tomorrow: sajuPeriodSchema,
    month: sajuPeriodSchema,
    year: sajuPeriodSchema,
  },
  required: ["today", "tomorrow", "month", "year"],
};

/**
 * Gemini API 클라이언트 초기화
 */
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }
  return new GoogleGenerativeAI(apiKey);
}

function getGeminiModel(genAI: GoogleGenerativeAI) {
  return genAI.getGenerativeModel({
    model: DEFAULT_GEMINI_MODEL,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: sajuResponseSchema,
      temperature: 0.7,
    },
  });
}

function extractJsonText(text: string): string {
  const cleanedText = text.replace(/```json\s*|\s*```/g, "").trim();

  if (cleanedText.startsWith("{") && cleanedText.endsWith("}")) {
    return cleanedText;
  }

  const firstBrace = cleanedText.indexOf("{");
  const lastBrace = cleanedText.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
    return cleanedText.slice(firstBrace, lastBrace + 1);
  }

  return cleanedText;
}

/**
 * 사주 분석 프롬프트 생성
 */
function createSajuPrompt(birthInfo: BirthInfo): string {
  const today = getKSTToday();
  const tomorrow = getKSTTomorrow();
  const currentMonth = getKSTCurrentMonth();
  const currentYear = getKSTCurrentYear();

  const birthTimeStr = `${String(birthInfo.birthHour).padStart(2, '0')}:${String(birthInfo.birthMinute).padStart(2, '0')}`;

  return `당신은 전문 사주명리 상담가입니다.

다음 사주 정보를 바탕으로 오늘, 내일, 이번 달, 올해의 운세를 분석해주세요.

【 사주 정보 】
- 생년월일: ${birthInfo.birthDate}
- 출생시간: ${birthTimeStr}

【 분석 기준 날짜 (Asia/Seoul) 】
- 오늘: ${today}
- 내일: ${tomorrow}
- 이번 달: ${currentMonth.start} ~ ${currentMonth.end}
- 올해: ${currentYear.start} ~ ${currentYear.end}

【 출력 형식 】
반드시 아래 JSON 형식으로만 응답해주세요. 다른 설명이나 마크다운은 포함하지 마세요.

{
  "today": {
    "summary": "오늘 하루의 전체적인 흐름 (2-4문장, 120-250자)",
    "caution": "오늘 주의할 점 (1-2문장, 60-120자)",
    "oneLineTip": "오늘의 한 줄 조언 (20-60자)"
  },
  "tomorrow": {
    "summary": "내일 하루의 전체적인 흐름 (2-4문장, 120-250자)",
    "caution": "내일 주의할 점 (1-2문장, 60-120자)",
    "oneLineTip": "내일의 한 줄 조언 (20-60자)"
  },
  "month": {
    "summary": "이번 달 전체 흐름 (2-4문장, 120-250자)",
    "caution": "이번 달 주의할 점 (1-2문장, 60-120자)",
    "oneLineTip": "이번 달 한 줄 조언 (20-60자)"
  },
  "year": {
    "summary": "올해 전체 흐름 (2-4문장, 120-250자)",
    "caution": "올해 주의할 점 (1-2문장, 60-120자)",
    "oneLineTip": "올해 한 줄 조언 (20-60자)"
  }
}

【 작성 가이드 】
- summary: 해당 기간의 전반적인 운세를 구체적이고 긍정적으로 설명
- caution: 해당 기간에 특별히 주의해야 할 사항을 명확히 제시
- oneLineTip: 해당 기간을 잘 보내기 위한 핵심 조언을 간결하게 전달

반드시 순수 JSON만 출력하세요. 마크다운 코드 블록(\`\`\`json)이나 다른 텍스트는 포함하지 마세요.`;
}

/**
 * Gemini API를 호출하여 사주 결과 생성
 */
export async function generateSajuResult(birthInfo: BirthInfo): Promise<SajuFullResult> {
  try {
    const genAI = getGeminiClient();
    const model = getGeminiModel(genAI);

    const prompt = createSajuPrompt(birthInfo);
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // JSON 파싱 시도
    let parsedData: unknown;
    try {
      const cleanedText = extractJsonText(text);
      parsedData = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("[Gemini] JSON parsing failed:", parseError);
      console.error("[Gemini] Model:", DEFAULT_GEMINI_MODEL);
      console.error("[Gemini] Raw response:", text);
      throw new Error("Failed to parse Gemini response as JSON");
    }

    // 응답 형식 검증
    if (!validateSajuResult(parsedData)) {
      const errorMsg = getValidationErrorMessage(parsedData);
      console.error("[Gemini] Validation failed:", errorMsg);
      console.error("[Gemini] Model:", DEFAULT_GEMINI_MODEL);
      console.error("[Gemini] Parsed data:", parsedData);
      throw new Error(`Invalid response format: ${errorMsg}`);
    }

    return parsedData;
  } catch (error) {
    console.error("[Gemini] Model:", DEFAULT_GEMINI_MODEL);
    console.error("[Gemini] API call failed:", error);
    throw error;
  }
}

/**
 * 채팅 응답 생성 (사주 결과 컨텍스트 기반)
 */
export async function generateChatResponse(
  sajuContext: SajuFullResult,
  chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  userMessage: string
): Promise<string> {
  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: DEFAULT_GEMINI_MODEL });

    // 컨텍스트 프롬프트
    const contextPrompt = `당신은 친절한 사주명리 상담가입니다.

사용자의 오늘 사주 분석 결과를 바탕으로 추가 질문에 답변해주세요.

【 사주 분석 결과 】
[오늘]
- 총평: ${sajuContext.today.summary}
- 주의점: ${sajuContext.today.caution}
- 조언: ${sajuContext.today.oneLineTip}

[내일]
- 총평: ${sajuContext.tomorrow.summary}
- 주의점: ${sajuContext.tomorrow.caution}
- 조언: ${sajuContext.tomorrow.oneLineTip}

[이번 달]
- 총평: ${sajuContext.month.summary}
- 주의점: ${sajuContext.month.caution}
- 조언: ${sajuContext.month.oneLineTip}

[올해]
- 총평: ${sajuContext.year.summary}
- 주의점: ${sajuContext.year.caution}
- 조언: ${sajuContext.year.oneLineTip}

위 사주 분석 결과를 참고하여, 사용자의 질문에 따뜻하고 구체적으로 답변해주세요.
답변은 2-4문장 정도로 간결하게 작성하되, 사용자에게 도움이 되는 실질적인 조언을 제공하세요.`;

    // 대화 히스토리 구성
    let fullPrompt = contextPrompt + "\n\n";

    for (const msg of chatHistory) {
      if (msg.role === 'user') {
        fullPrompt += `사용자: ${msg.content}\n`;
      } else {
        fullPrompt += `상담가: ${msg.content}\n`;
      }
    }

    fullPrompt += `\n사용자: ${userMessage}\n상담가:`;

    const result = await model.generateContent(fullPrompt);
    const response = result.response;
    return response.text();
  } catch (error) {
    console.error("[Gemini] Model:", DEFAULT_GEMINI_MODEL);
    console.error("[Gemini] Chat API call failed:", error);
    throw error;
  }
}
