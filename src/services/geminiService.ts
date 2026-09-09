import { GoogleGenAI, Type } from "@google/genai";

export const AVAILABLE_MODELS = [
  {
    id: "gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash-Lite",
    badge: "Sabse Lite • Max Quota (~1,000 RPD)",
    description: "Lowest token consumption, highest daily free requests, fastest latency. Best for saving quota."
  },
  {
    id: "gemini-3.1-flash-lite",
    name: "Gemini 3.1 Flash-Lite",
    badge: "Next-Gen Flash-Lite",
    description: "Next-generation lightweight model with high efficiency."
  },
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    badge: "Standard Flash",
    description: "Standard model with balanced reasoning and quota."
  }
];

export const DEFAULT_MODEL = "gemini-2.5-flash-lite";

function getClient(customApiKey?: string): GoogleGenAI {
  const key = customApiKey?.trim() || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("No Gemini API Key provided. Please add your Gemini API Key in the top bar to run audits.");
  }
  return new GoogleGenAI({ 
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

export async function validateApiKey(keyToTest: string, model: string = DEFAULT_MODEL): Promise<boolean> {
  try {
    const testAi = new GoogleGenAI({ apiKey: keyToTest.trim() });
    const res = await testAi.models.generateContent({
      model,
      contents: "Hi",
    });
    return !!res.text;
  } catch (err) {
    console.error("API Key validation error with lite model, trying fallback:", err);
    try {
      const testAi2 = new GoogleGenAI({ apiKey: keyToTest.trim() });
      const res2 = await testAi2.models.generateContent({
        model: "gemini-2.5-flash",
        contents: "Hi",
      });
      return !!res2.text;
    } catch {
      return false;
    }
  }
}

export interface AuditResult {
  cleanSolution: string;
  myAnswerStatus: 'correct' | 'wrong';
  solutionShouldBeChanged: string;
  questionShouldBeChanged: string;
  auditSummary: string;
  correctedQuestion: string;
  hindiQuestion: string;
  hindiSolution: string;
  isAbsurd: string;
  markedAnswer: string;
  topic: string;
  subtopic: string;
}

const SYSTEM_INSTRUCTION = `You are a world-class Quant Content Developer and Expert for Banking Exams (like IBPS, SBI PO, RBI Grade B). 
Your task is to audit a quantitative aptitude question and its solution in a specific process.

The input contains BOTH the question and its solution.

### AUDIT PROCESS:
1. **Mathematical Soundness**: Determine if the question is mathematically sound and if the provided solution correctly answers the question. Identify specific errors if discrepancies exist.
2. **Language Evaluation**: Evaluate if the language used in the question is clear and appropriate for banking exam aspirants. 
3. **Clarity & Comprehensiveness**: Assess if the provided solution is comprehensive and easy for students to understand.

### STRICT OUTPUT REQUIREMENTS:
You must provide the following in the exact format requested:

1. **QUESTION TEXT FORMAT ("correctedQuestion" and "hindiQuestion")**:
   - MANDATORY CRITICAL RULE: In BOTH "correctedQuestion" and "hindiQuestion", output ONLY the question problem statement itself.
   - STRICTLY DO NOT INCLUDE MULTIPLE-CHOICE OPTIONS (e.g. "Options:", "विकल्प:", "A) ...", "B) ...", "C) ...", etc.) in either "correctedQuestion" or "hindiQuestion".
   - Even if the input provided options, STRIP OUT all options completely so that the question fields contain strictly the pure question statement.

2. **CLEAN SOLUTION FORMAT ("cleanSolution" and "hindiSolution")**:
   - Provide the solution in a strict line-by-line format. Do NOT use paragraph form.
   
   - CRITICAL MATHEMATICAL NOTATION & SYMBOL RULES:
     * STRICT MULTIPLICATION SYMBOL RULE:
       NEVER use the asterisk '*' symbol for multiplication under ANY circumstance!
       ALWAYS use the proper mathematical multiplication symbol '×' (e.g., 2 × 3 = 6, 12 × 15, P × R × T / 100, 25 × 4, (x + 5) × (x - 2)).
     * STRICT POWER / EXPONENT NOTATION RULE:
       NEVER use the caret symbol '^' for powers (e.g., do NOT write x^2, r^2, 10^3, 2^4, etc.).
       ALWAYS write real mathematical powers using proper unicode superscript characters:
       - Square: '²' (e.g., x², r², 12², cm², m², 15²)
       - Cube: '³' (e.g., x³, 10³, m³, cm³)
       - Other powers: '⁴', '⁵', '⁶', '⁷', '⁸', '⁹', '⁰', 'ⁿ' (e.g., 2⁴, 10⁵, aⁿ, x⁻¹).
   
   - STRUCTURE AND SECTIONS:
     Structure the solution strictly into these sections:
     1) "Given Information:" (Hindi: "दिए गए तथ्य:")
     2) "Calculation:" (Hindi: "गणना:")
     3) The final conclusion line: "Hence, option ([Option]) is correct." (Hindi: "अतः, विकल्प ([Option]) सही है।") or direct answer line "Therefore, the required answer is [value]." (Hindi: "अतः, अभीष्ट उत्तर [value] है।")
     Do NOT wrap these headings or lines in markdown asterisks (**). Output pure, clean plain text without markdown asterisks (**).
   
   - CRITICAL RULES FOR THE FINAL ANSWER CONCLUSION LINE:
     * CASE A: IF MULTIPLE-CHOICE OPTIONS (A, B, C, D, E) WERE PROVIDED IN THE INPUT:
       Identify which option matches the mathematically calculated answer.
       Conclude the solution with:
       English: "Hence, option ([Option]) is correct." (e.g., "Hence, option (B) is correct.")
       Hindi: "अतः, विकल्प ([Option]) सही है।" (e.g., "अतः, विकल्प (B) सही है।")
       The option letter MUST ALWAYS BE UPPERCASE (e.g., (A), (B), (C), (D), (E)). Never use lowercase letters like (a) or leave parentheses empty ().
     
     * CASE B: IF NO OPTIONS WERE PROVIDED IN THE INPUT (the input only has question and solution, without A/B/C/D options):
       STRICTLY DO NOT WRITE "Hence, option () is correct" or "अतः, विकल्प () सही है"! Do not invent dummy options!
       Instead, conclude directly with the final calculated value:
       English: "Therefore, the required answer is [final calculated value]."
       Hindi: "अतः, अभीष्ट उत्तर [final calculated value] है।"

   - CRITICAL CONTINUOUS SPACING RULE (NO BLANK LINES):
     Do NOT include ANY blank or empty lines in the solution!
     "Calculation:" MUST immediately follow the last bullet point of "Given Information:" on the very next line without any blank line in between.
     The final conclusion line MUST also immediately follow the last calculation line on the very next line without any blank line.
     All lines must be contiguous, strictly one line directly after another ("sab ek sath", no empty line gaps).

   - For English solutions:
     Given Information:
     • [Point 1]
     • [Point 2]
     Calculation:
     [Step-by-step math, each on a new line. Do NOT use numbering or bullet points for these steps.]
     [Final conclusion line as specified above in CASE A or CASE B]

     *(Note: For Approximation questions, format strictly as: Given Information: -> • Given expression: [expression] -> Taking approximate values: -> [term] ≈ [approx] -> Approximate Calculation: -> [calc lines] -> [Final line]. For Number Series questions, format as: Given Information: -> • Given series: [series] -> Pattern: -> [steps] -> Logic behind Pattern: -> [explanation in simple words] -> [Conclusion sentence] -> [Final line]. For Data Sufficiency questions, solve each statement individually, clearly explain why individual statements are not sufficient ("Not sufficient" reason), and then provide the complete solution ending with [Final line]).*
     
   - For Hindi solutions:
     दिए गए तथ्य:
     • [Point 1]
     • [Point 2]
     गणना:
     [Step-by-step math, each on a new line. Do NOT use numbering or bullet points for these steps.]
     [Final conclusion line as specified above in CASE A or CASE B]

     *(लगभग/Approximation और संख्या श्रृंखला/Number Series प्रश्नों के लिए अपने पूर्व निर्धारित विशेष फॉर्मेट का पालन करें। डेटा पर्याप्तता/Data Sufficiency प्रश्नों के लिए प्रत्येक कथन को अलग-अलग हल करके दिखाएं, यह स्पष्ट करें कि क्यों कोई कथन पर्याप्त नहीं है ("Not sufficient"), और उसके बाद संपूर्ण पूर्ण समाधान प्रदान करें)*

3. **AUDIT FIELDS**:
   - **isAbsurd**: "Yes" or "No". Indicate "Yes" if the answer or logic provided in the original content is absurd, nonsensical, or "uttpatang".
   - **markedAnswer**: The specific option or final answer that appears to be marked or selected by the user in the input (e.g., "Option B", "250", etc.). If no options are present in the input, state the calculated final value or marked value.
   - **solutionShouldBeChanged**: "Yes" or "No". Be lenient: if the solution is understandable and works for a mock test, say "No". Only say "Yes" if there is a major error, calculation mistake, or it is very confusing.
   - **questionShouldBeChanged**: "Yes" or "No". Only say "Yes" if the language is actually wrong or data is missing.
   - **auditSummary**: Specific changes the user should do. If the solution is "Chal jayega" (acceptable for mock), do not suggest unnecessary changes.
   - **myAnswerStatus**: "correct" or "wrong" based on the user's marked option in the input.
   - **correctedQuestion**: The full corrected text of the question (PURE question statement ONLY, NO options).
   - **hindiQuestion**: The full translation of the corrected question in Hindi (PURE question statement ONLY, NO options).
   - **hindiSolution**: The full translation of the clean solution in Hindi, maintaining the same step-by-step formatting and CASE A / CASE B conclusion rule.

Return the response as a JSON object with the following fields:
- cleanSolution: The formatted solution as described above.
- myAnswerStatus: "correct" or "wrong".
- solutionShouldBeChanged: Feedback on whether the solution needs major changes.
- questionShouldBeChanged: Feedback on whether the question needs major changes.
- auditSummary: Summary of required changes (only for major issues).
- correctedQuestion: The full corrected text of the question without options.
- hindiQuestion: The Hindi translation of the question without options.
- hindiSolution: The Hindi translation of the solution.
- isAbsurd: "Yes" or "No" for absurd/weird logic.
- markedAnswer: The specific answer marked in input.

Focus on clarity and stick strictly to the provided format. Use a professional and helpful tone.`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    cleanSolution: { type: Type.STRING },
    myAnswerStatus: { type: Type.STRING, enum: ["correct", "wrong"] },
    solutionShouldBeChanged: { type: Type.STRING },
    questionShouldBeChanged: { type: Type.STRING },
    auditSummary: { type: Type.STRING },
    correctedQuestion: { type: Type.STRING },
    hindiQuestion: { type: Type.STRING },
    hindiSolution: { type: Type.STRING },
    isAbsurd: { type: Type.STRING },
    markedAnswer: { type: Type.STRING },
    topic: { type: Type.STRING },
    subtopic: { type: Type.STRING }
  },
  required: [
    "cleanSolution", 
    "myAnswerStatus", 
    "solutionShouldBeChanged", 
    "questionShouldBeChanged", 
    "auditSummary", 
    "correctedQuestion",
    "hindiQuestion",
    "hindiSolution",
    "isAbsurd",
    "markedAnswer",
    "topic",
    "subtopic"
  ]
};

export function stripOptionsFromQuestion(text: string): string {
  if (!text) return "";
  let cleaned = text.trim();

  // Pattern 1: Explicit options block header e.g. "Options:", "OPTIONS:", "विकल्प:", etc.
  cleaned = cleaned.replace(/\n+\s*(?:Options?|OPTIONS?|विकल्प|वैकल्पिक)\s*:?[\s\S]*$/i, '');

  // Pattern 2: Trailing option list starting on a newline like:
  // (A) ... \n (B) ... or A) ... \n B) ... or A. ... \n B. ... or [A] ...
  cleaned = cleaned.replace(/\n+\s*(?:\(?[A-Ea-e1-5]\)?[.:]|\(?[क-ङ]\)?[.:])\s+[\s\S]*$/, '');

  // Pattern 3: Trailing inline Options keyword
  cleaned = cleaned.replace(/\s*(?:Options?|OPTIONS?|विकल्प)\s*:?\s*(?:\(?[A-Ea-e1-5]\)?[.:]).*$/i, '');

  return cleaned.trim();
}

export function detectHasOptions(text: string): boolean {
  if (!text) return false;
  const optionKeyword = /\boptions?\b/i.test(text) || /\bविकल्प\b/i.test(text);
  const letterOptions = /(?:\n|^)\s*(?:\([A-E]\)|[A-E]\)|\(?[A-E]\.)\s+/i.test(text);
  const markedOption = /\boption\s+[A-E]\b/i.test(text);
  return optionKeyword || letterOptions || markedOption;
}

export function stripAllMarkdownAsterisks(text: string): string {
  if (!text) return "";
  return text.replace(/\*\*/g, '').trim();
}

export function removeBlankLinesFromSolution(text: string): string {
  if (!text) return "";
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n');
}

/**
 * Normalizes mathematical symbols across solutions and questions:
 * 1. Converts caret powers (^2, ^3, ^10, etc.) to proper unicode superscripts (², ³, ¹⁰, etc.)
 * 2. Replaces all asterisk multiplication '*' with the proper multiplication sign '×'
 * 3. Converts starting asterisks in bullet lines to proper bullets '•'
 */
export function normalizeMathSymbols(text: string): string {
  if (!text) return "";

  const superscriptMap: Record<string, string> = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
    'n': 'ⁿ', 'i': 'ⁱ', 'x': 'ˣ', 'y': 'ʸ'
  };

  let res = text;

  // Convert leading bullet asterisk (* item) into proper bullet point (• item)
  res = res.replace(/^(\s*)\*\s+/gm, '$1• ');

  // Convert caret powers: e.g. x^2 -> x², r^3 -> r³, 10^5 -> 10⁵, 2^(n-1) -> 2ⁿ⁻¹, cm^2 -> cm², m^3 -> m³
  res = res.replace(/\^\(?([0-9nixy\+\-]+)\)?/g, (_, exp) => {
    return exp.split('').map((char: string) => superscriptMap[char] || char).join('');
  });

  // Convert all multiplication '*' to '×' (U+00D7)
  // e.g., "2 * 3", "2*3", "P * R * T", "(a + b) * (c + d)", "5*x", "r*r"
  res = res.replace(/([0-9a-zA-Z\)\%])\s*\*\s*([0-9a-zA-Z\(\%])/g, '$1 × $2');
  res = res.replace(/\s+\*\s+/g, ' × ');
  res = res.replace(/([0-9a-zA-Z\)])\s*\*/g, '$1 × ');
  res = res.replace(/\*\s*([0-9a-zA-Z\(])/g, ' × $1');
  // Catch any remaining standalone asterisk
  res = res.replace(/\*/g, '×');

  return res;
}

export function sanitizeAuditResult(result: AuditResult, hasOptions?: boolean): AuditResult {
  if (!result) return result;

  // 1. Strip options from question fields unconditionally
  if (result.correctedQuestion) {
    result.correctedQuestion = stripOptionsFromQuestion(result.correctedQuestion);
  }
  if (result.hindiQuestion) {
    result.hindiQuestion = stripOptionsFromQuestion(result.hindiQuestion);
  }

  // 2. Clean empty option brackets e.g. "Hence, option () is correct." or "अतः, विकल्प () सही है।"
  if (result.cleanSolution) {
    result.cleanSolution = result.cleanSolution.replace(
      /\n*\s*(?:\*\*)?\s*Hence,?\s*options?\s*\(\s*\)\s*is\s*correct\.?\s*(?:\*\*)?/gi,
      ''
    ).trim();
  }
  if (result.hindiSolution) {
    result.hindiSolution = result.hindiSolution.replace(
      /\n*\s*(?:\*\*)?\s*अतः,?\s*विकल्प\s*\(\s*\)\s*सही\s*है\.?\s*(?:\*\*)?/gi,
      ''
    ).trim();
  }

  // 3. If no options were provided in the input, ensure no stray "Hence, option (...) is correct" remains
  if (hasOptions === false) {
    if (result.cleanSolution) {
      result.cleanSolution = result.cleanSolution.replace(
        /\n*\s*(?:\*\*)?\s*Hence,?\s*options?\s*(?:\([A-Za-z0-9\s]*\)|[A-Za-z0-9]+)?\s*is\s*correct\.?\s*(?:\*\*)?/gi,
        ''
      ).trim();
    }
    if (result.hindiSolution) {
      result.hindiSolution = result.hindiSolution.replace(
        /\n*\s*(?:\*\*)?\s*अतः,?\s*विकल्प\s*(?:\([A-Za-z0-9क-ङ\s]*\)|[A-Za-z0-9क-ङ]+)?\s*सही\s*है\.?\s*(?:\*\*)?/gi,
        ''
      ).trim();
    }
    if (result.markedAnswer && /^(?:option\s*[A-E]?|\(\s*\)|none)$/i.test(result.markedAnswer.trim())) {
      result.markedAnswer = "No options provided in input";
    }
  }

  // 4. Strip all raw markdown asterisks (**) and remove blank lines so everything is contiguous ("sab ek sath")
  if (result.cleanSolution) {
    result.cleanSolution = removeBlankLinesFromSolution(stripAllMarkdownAsterisks(result.cleanSolution));
  }
  if (result.hindiSolution) {
    result.hindiSolution = removeBlankLinesFromSolution(stripAllMarkdownAsterisks(result.hindiSolution));
  }

  // 5. Enforce mathematical symbol conventions: '×' for multiplication and unicode powers (², ³, etc.)
  if (result.cleanSolution) {
    result.cleanSolution = normalizeMathSymbols(result.cleanSolution);
  }
  if (result.hindiSolution) {
    result.hindiSolution = normalizeMathSymbols(result.hindiSolution);
  }
  if (result.correctedQuestion) {
    result.correctedQuestion = normalizeMathSymbols(result.correctedQuestion);
  }
  if (result.hindiQuestion) {
    result.hindiQuestion = normalizeMathSymbols(result.hindiQuestion);
  }

  return result;
}

export async function auditSingleQuantContent(
  image: string, 
  customApiKey?: string,
  modelId: string = DEFAULT_MODEL
): Promise<AuditResult> {
  const client = getClient(customApiKey);
  const model = modelId || DEFAULT_MODEL;

  const imagePrompt = "Question & Solution Image:\n[INPUT INSTRUCTION: If multiple-choice options (A, B, C, D) are visible in the image, conclude clean solutions with 'Hence, option ([Option]) is correct.' and 'अतः, विकल्प ([Option]) सही है।'. If NO options are visible in the image, conclude directly with 'Therefore, the required answer is [value].' and 'अतः, अभीष्ट उत्तर [value] है।' (STRICTLY DO NOT WRITE 'Hence, option (...) is correct'). In all cases, do NOT include options in correctedQuestion or hindiQuestion.]";

  try {
    const response = await client.models.generateContent({
      model,
      contents: [
        {
          parts: [
            { text: imagePrompt },
            { inlineData: { mimeType: "image/png", data: image } }
          ]
        }
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA
      }
    });

    const text = response.text || "{}";
    const trimmedText = text.trim();
    if (!trimmedText) {
      console.warn("Gemini returned empty response, returning empty object.");
      return {} as AuditResult;
    }
    const parsed = JSON.parse(trimmedText) as AuditResult;
    return sanitizeAuditResult(parsed);
  } catch (error: any) {
    console.warn(`Attempt with ${model} failed, attempting fallback:`, error);
    // Automatic fallback if lite model needs backup
    if (model !== "gemini-2.5-flash") {
      try {
        const fallbackResponse = await client.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [
            {
              parts: [
                { text: imagePrompt },
                { inlineData: { mimeType: "image/png", data: image } }
              ]
            }
          ],
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA
          }
        });
        const text = fallbackResponse.text || "{}";
        const parsed = JSON.parse(text.trim()) as AuditResult;
        return sanitizeAuditResult(parsed);
      } catch (fallbackError: any) {
        console.error("Fallback also failed:", fallbackError);
        throw new Error(fallbackError?.message || error?.message || "Failed to analyze content.");
      }
    }
    throw new Error(error?.message || "Failed to analyze content. Please try again.");
  }
}

export async function auditSingleTextContent(
  text: string, 
  customApiKey?: string,
  modelId: string = DEFAULT_MODEL
): Promise<AuditResult> {
  const client = getClient(customApiKey);
  const model = modelId || DEFAULT_MODEL;
  const hasOptions = detectHasOptions(text);

  const contextDirective = hasOptions 
    ? "\n[INPUT NOTE: Multiple-choice options ARE present in this input. Conclude the clean solution with 'Hence, option ([Option]) is correct.' and 'अतः, विकल्प ([Option]) सही है।'. Do NOT include any options in correctedQuestion or hindiQuestion.]"
    : "\n[INPUT NOTE: Multiple-choice options ARE NOT present in this input. Conclude the solution directly with 'Therefore, the required answer is [calculated value].' and 'अतः, अभीष्ट उत्तर [calculated value] है।'. STRICTLY DO NOT WRITE 'Hence, option (...) is correct' or 'अतः, विकल्प (...) सही है'. Do NOT include options in correctedQuestion or hindiQuestion.]";

  try {
    const response = await client.models.generateContent({
      model,
      contents: [
        {
          parts: [
            { text: `Question & Solution Text:\n${text}${contextDirective}` }
          ]
        }
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA
      }
    });

    const textResponse = response.text || "{}";
    const trimmedText = textResponse.trim();
    if (!trimmedText) {
      console.warn("Gemini returned empty response, returning empty object.");
      return {} as AuditResult;
    }
    const parsed = JSON.parse(trimmedText) as AuditResult;
    return sanitizeAuditResult(parsed, hasOptions);
  } catch (error: any) {
    console.warn(`Attempt with ${model} failed, attempting fallback:`, error);
    if (model !== "gemini-2.5-flash") {
      try {
        const fallbackResponse = await client.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [
            {
              parts: [
                { text: `Question & Solution Text:\n${text}${contextDirective}` }
              ]
            }
          ],
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA
          }
        });
        const fallbackText = fallbackResponse.text || "{}";
        const parsed = JSON.parse(fallbackText.trim()) as AuditResult;
        return sanitizeAuditResult(parsed, hasOptions);
      } catch (fallbackError: any) {
        console.error("Fallback also failed:", fallbackError);
        throw new Error(fallbackError?.message || error?.message || "Failed to analyze content.");
      }
    }
    throw new Error(error?.message || "Failed to analyze content. Please try again.");
  }
}
