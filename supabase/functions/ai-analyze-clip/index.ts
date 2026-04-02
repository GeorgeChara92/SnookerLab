// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini";

type AnalysisRow = {
  id: string;
  user_id: string;
  video_path: string;
  analysis_type: string;
  context_tags: string[] | null;
  user_notes: string | null;
};

type StructuredReport = {
  summary: string;
  positives: string[];
  improvements: string[];
  possible_causes: string[];
  not_assessable: string[];
  coaching_tip: string;
};

const buildPrompt = (analysis: AnalysisRow, signedVideoUrl?: string) => {
  const tags = (analysis.context_tags ?? []).join(", ") || "none";
  const notes = analysis.user_notes?.trim() || "none";
  const clipReference = signedVideoUrl ?? analysis.video_path;

  return [
    "You are a professional snooker coach analyzing a user-submitted clip.",
    "Return strict JSON only.",
    `Analysis type: ${analysis.analysis_type}`,
    `Context tags: ${tags}`,
    `User notes: ${notes}`,
    `Clip reference: ${clipReference}`,
    "Core rules:",
    "- Base primary feedback only on clearly visible evidence in the clip.",
    "- Do not guess or fabricate details.",
    "- If something is not visible, do not present it as fact.",
    "Controlled coaching insight:",
    "- You may suggest likely causes only when tied to a visible outcome.",
    "- Label these exactly as: Possible cause (not fully visible).",
    "- Never present possible causes as certain facts.",
    "Feedback style:",
    "- Balanced, realistic, and evidence-based.",
    "- Highlight genuine positives and key improvements.",
    "- Avoid overpraise and avoid exaggerated faults.",
    "Output schema:",
    '{"summary":"string","positives":["string"],"improvements":["string"],"possible_causes":["string"],"not_assessable":["string"],"coaching_tip":"string"}',
    "Rules:",
    "- summary: one short factual paragraph",
    "- positives: 1-4 bullets, visible evidence only",
    "- improvements: 1-4 bullets, observed issues only",
    "- possible_causes: 0-3 bullets and each starts with 'Possible cause (not fully visible):'",
    "- not_assessable: 1-4 bullets for what cannot be judged from this clip",
    "- coaching_tip: one practical action",
  ].join("\n");
};

const parseLLMResponse = (payload: any): { report_json: StructuredReport; feedback: string; recommendations: string[] } => {
  const outputText = typeof payload?.output_text === "string" ? payload.output_text : "";

  const nestedText = Array.isArray(payload?.output)
    ? payload.output
        .flatMap((item: any) => (Array.isArray(item?.content) ? item.content : []))
        .map((content: any) => {
          if (typeof content?.text === "string") return content.text;
          if (typeof content?.output_text === "string") return content.output_text;
          return "";
        })
        .find((value: string) => !!value.trim()) ?? ""
    : "";

  const legacyChoicesText = Array.isArray(payload?.choices)
    ? payload.choices
        .map((choice: any) => choice?.message?.content)
        .find((value: unknown) => typeof value === "string" && !!value.trim()) ?? ""
    : "";

  const rawText = outputText || nestedText || legacyChoicesText;
  if (typeof rawText !== "string" || !rawText.trim()) {
    const summary = JSON.stringify(
      {
        id: payload?.id,
        model: payload?.model,
        status: payload?.status,
        output_len: Array.isArray(payload?.output) ? payload.output.length : 0,
      },
      null,
      0
    );
    throw new Error(`LLM returned no text output (${summary})`);
  }

  let parsed: any;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    const firstBrace = rawText.indexOf("{");
    const lastBrace = rawText.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error("LLM output was not valid JSON");
    }
    parsed = JSON.parse(rawText.slice(firstBrace, lastBrace + 1));
  }

  const report_json: StructuredReport = {
    summary: typeof parsed.summary === "string" ? parsed.summary.trim() : "",
    positives: Array.isArray(parsed.positives)
      ? parsed.positives.filter((item: unknown) => typeof item === "string").map((item: string) => item.trim()).filter(Boolean)
      : [],
    improvements: Array.isArray(parsed.improvements)
      ? parsed.improvements.filter((item: unknown) => typeof item === "string").map((item: string) => item.trim()).filter(Boolean)
      : [],
    possible_causes: Array.isArray(parsed.possible_causes)
      ? parsed.possible_causes.filter((item: unknown) => typeof item === "string").map((item: string) => item.trim()).filter(Boolean)
      : [],
    not_assessable: Array.isArray(parsed.not_assessable)
      ? parsed.not_assessable.filter((item: unknown) => typeof item === "string").map((item: string) => item.trim()).filter(Boolean)
      : [],
    coaching_tip: typeof parsed.coaching_tip === "string" ? parsed.coaching_tip.trim() : "",
  };

  if (!report_json.summary || report_json.positives.length === 0 || report_json.improvements.length === 0 || !report_json.coaching_tip) {
    throw new Error("LLM output missing required structured fields");
  }

  const recommendations = report_json.improvements.slice(0, 2).concat(report_json.coaching_tip).slice(0, 3);
  while (recommendations.length < 3) {
    recommendations.push("Capture another clip from a clearer angle and reassess.");
  }

  const possibleCausesText = report_json.possible_causes.length
    ? report_json.possible_causes.map((item) => `- ${item}`).join("\n")
    : "- None identified from this clip.";
  const notAssessableText = report_json.not_assessable.length
    ? report_json.not_assessable.map((item) => `- ${item}`).join("\n")
    : "- None.";

  const feedback = [
    "1) Summary",
    report_json.summary,
    "",
    "2) What Was Done Well",
    report_json.positives.map((item) => `- ${item}`).join("\n"),
    "",
    "3) Areas to Improve (Observed)",
    report_json.improvements.map((item) => `- ${item}`).join("\n"),
    "",
    "4) Possible Causes (If Applicable)",
    possibleCausesText,
    "",
    "5) What Cannot Be Assessed",
    notAssessableText,
    "",
    "6) Coaching Tip",
    report_json.coaching_tip,
    "",
    "This feedback is based on a short clip and may not fully represent overall technique.",
  ].join("\n");

  return { report_json, feedback, recommendations };
};

const safeErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message.slice(0, 300);
  return "Unknown error";
};

Deno.serve(async (req) => {
  let analysisId = "";

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error("Supabase env vars missing for Edge Function");
    }
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is missing");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ ok: false, error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid auth token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    analysisId = typeof body?.analysis_id === "string" ? body.analysis_id : "";
    if (!analysisId) {
      return new Response(JSON.stringify({ ok: false, error: "analysis_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: analysis, error: analysisError } = await userClient
      .from("ai_analyses")
      .select("id,user_id,video_path,analysis_type,context_tags,user_notes")
      .eq("id", analysisId)
      .eq("user_id", user.id)
      .single<AnalysisRow>();

    if (analysisError || !analysis) {
      return new Response(JSON.stringify({ ok: false, error: "Analysis not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let signedVideoUrl: string | undefined;
    if (!analysis.video_path.startsWith("demo://")) {
      const { data: signed, error: signedError } = await userClient.storage
        .from("ai-videos")
        .createSignedUrl(analysis.video_path, 60 * 10);
      if (signedError) throw signedError;
      signedVideoUrl = signed.signedUrl;
    }

    const prompt = buildPrompt(analysis, signedVideoUrl);

    const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        text: {
          format: {
            type: "json_schema",
            name: "snooker_coach_report",
                schema: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    summary: { type: "string" },
                    positives: {
                      type: "array",
                      minItems: 1,
                      maxItems: 4,
                      items: { type: "string" },
                    },
                    improvements: {
                      type: "array",
                      minItems: 1,
                      maxItems: 4,
                      items: { type: "string" },
                    },
                    possible_causes: {
                      type: "array",
                      minItems: 0,
                      maxItems: 3,
                      items: { type: "string" },
                    },
                    not_assessable: {
                      type: "array",
                      minItems: 1,
                      maxItems: 4,
                      items: { type: "string" },
                    },
                    coaching_tip: {
                      type: "string",
                    },
                  },
                  required: ["summary", "positives", "improvements", "possible_causes", "not_assessable", "coaching_tip"],
                },
              },
            },
        input: [
          {
            role: "user",
            content: [{ type: "input_text", text: prompt }],
          },
        ],
      }),
    });

    if (!openAiResponse.ok) {
      const errorText = (await openAiResponse.text()).slice(0, 500);
      throw new Error(`OpenAI error (${openAiResponse.status}): ${errorText}`);
    }

    const llmPayload = await openAiResponse.json();
    const { report_json, feedback, recommendations } = parseLLMResponse(llmPayload);

    const completedAt = new Date().toISOString();
    const { error: updateError } = await userClient
      .from("ai_analyses")
      .update({
        status: "completed",
        report_json,
        feedback,
        recommendations,
        error_message: null,
        updated_at: completedAt,
      })
      .eq("id", analysis.id)
      .eq("user_id", user.id);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ ok: true, model: OPENAI_MODEL, analysis_id: analysis.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = safeErrorMessage(error);

    try {
      const authHeader = req.headers.get("Authorization");
      if (analysisId && authHeader && SUPABASE_URL && SUPABASE_ANON_KEY) {
        const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          global: { headers: { Authorization: authHeader } },
        });
        await userClient
          .from("ai_analyses")
          .update({ status: "failed", error_message: message, updated_at: new Date().toISOString() })
          .eq("id", analysisId);
      }
    } catch {
      // Do nothing in nested failure path.
    }

    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
