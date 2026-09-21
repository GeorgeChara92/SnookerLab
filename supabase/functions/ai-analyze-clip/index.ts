// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * The AI Coach. Takes one uploaded clip, has Gemini watch it, and writes the coaching report
 * back to the analysis row.
 *
 * Gemini is given the video itself - every frame it samples, with the motion between them -
 * rather than a description of it, so the report is about what is actually on screen. Before
 * coaching, the model has to say whether the clip shows snooker being played at all; a clip it
 * cannot use is turned away with a reason rather than given an invented report.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.8-flash";
/**
 * Tried in turn when the first choice is overloaded or unavailable, which Gemini's newest
 * models often are at busy times. Set GEMINI_FALLBACK_MODELS (comma-separated) to change them.
 */
const GEMINI_MODELS = [
  GEMINI_MODEL,
  ...(Deno.env.get("GEMINI_FALLBACK_MODELS") ?? "gemini-3.7-flash,gemini-3.5-flash,gemini-3.5-flash-lite")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean),
].filter((model, index, all) => all.indexOf(model) === index);
const GEMINI_BASE = "https://generativelanguage.googleapis.com";

const MAX_USER_NOTES_CHARS = 1200;
/**
 * Small clips go in the request itself; bigger ones through the Files API. Base64 adds a third,
 * so 10MB keeps the whole request well under Gemini's limit for inline data.
 */
const INLINE_LIMIT_BYTES = 10 * 1024 * 1024;
/** Far beyond any 20-second clip from the app, and within what the function can hold. */
const MAX_VIDEO_BYTES = 150 * 1024 * 1024;
/**
 * Frames a second Gemini samples. The default is one, which misses most of a cue action: the
 * backswing, pause and delivery all happen inside a second. Five catches them for a 20-second
 * clip at about 26,000 tokens.
 */
const FRAMES_PER_SECOND = 5;
/**
 * How long to keep asking Gemini when its models are overloaded, which at busy times can last
 * a minute or two. The function is stopped at 150 seconds, so this leaves room for the video
 * download before and the save after.
 */
const GEMINI_BUDGET_MS = 115 * 1000;
/** No one request may hold on longer than this, so a slow refusal cannot use up the budget. */
const GEMINI_REQUEST_TIMEOUT_MS = 60 * 1000;
/** An analysis stuck in "processing" this long was abandoned and may be claimed again. */
const STALE_PROCESSING_MS = 5 * 60 * 1000;

type AnalysisRow = {
  id: string;
  user_id: string;
  video_path: string;
  analysis_type: string;
  context_tags: string[] | null;
  user_notes: string | null;
};

/** A message the player sees. Anything else that goes wrong is logged and replaced. */
class CoachError extends Error {
  constructor(message: string, readonly status = 422) {
    super(message);
  }
}

const FRIENDLY = {
  busy: "The coach is busy right now. Wait a minute or two, then tap Try again.",
  generic: "Something went wrong analysing this clip. Upload it again, and if it keeps happening, try a shorter clip.",
  tooBig: "This clip is too large to analyse. Record or trim a clip of 20 seconds or less.",
  blocked: "The coach could not review this clip. Upload a clip of a shot or practice at the table.",
};

// ---------------------------------------------------------------------------- the brief

/** What to look for, by the kind of analysis the player asked for. */
const FOCUS: Record<string, string> = {
  technique:
    "Cue action and delivery: stance and head position over the shot, bridge (length, firmness, height), grip pressure, the feathering, the pause at the back, straightness of the backswing and follow-through, whether the head and body stay still through the shot, and the finish.",
  shot:
    "The shot itself: the pot or positional intent if it can be inferred, contact on the object ball, cue ball reaction (screw, stun, follow, side), and where the cue ball finishes relative to what the next shot likely needed.",
  stance:
    "Set-up: feet placement and width, weight distribution, body angle to the line of aim, how the player gets down on the shot, chin height over the cue, and whether the set-up is repeatable between shots.",
  tactical:
    "Shot selection and safety: the choice between attacking and safety given the balls shown, weight of shot, where the cue ball and object ball are left, and what the opponent is left.",
  full_session:
    "Consistency across the shots shown: pre-shot routine, tempo, how the set-up and delivery hold up from shot to shot, and any pattern in the misses.",
};

const buildPrompt = (analysis: AnalysisRow) => {
  const tags = (analysis.context_tags ?? []).join(", ") || "none";
  const notes = analysis.user_notes?.trim() || "none";
  const focus = FOCUS[analysis.analysis_type] ?? FOCUS.technique;

  return `You are an experienced snooker coach reviewing a short video clip a player has sent you. You are watching the video itself.

Step 1 - check the clip. Decide honestly:
- Does it show snooker (or pool/billiards) being played or practised at a table?
- Can you see the player and/or the balls well enough to coach from it?
If the clip does not show play at a table, or is too dark, blurred, distant or brief to assess anything, set clip_check.usable to false, explain why in clip_check.reason in one plain sentence addressed to the player, and keep every other field minimal. Do not coach from a clip you cannot see.

Step 2 - coach, only if usable. The player asked for this focus:
${focus}

Player context (from the player, not verified): analysis type "${analysis.analysis_type}"; tags: ${tags}; notes: ${notes}

Rules:
- Every positive and every improvement must be something you can see in the video. Give the time it happens as m:ss in "at".
- Never invent details. If the camera angle hides something (for example the bridge hand, or the cue ball after contact), list it under not_assessable rather than guessing.
- possible_causes are allowed only when tied to a visible outcome, and must be phrased as possibilities.
- Be balanced and specific: real strengths, the one or two faults that matter most, no padding and no exaggeration.
- Write in UK English, plainly, speaking to the player as "you".
- summary: two or three sentences on what the clip shows and the main takeaway.
- coaching_tip: one concrete drill or change to take to the table.
- confidence: "high" if the view clearly shows what the focus needs, "medium" if partly, "low" if you could only see a little.`;
};

/** Gemini's structured output: the report, plus the check that comes before it. */
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    clip_check: {
      type: "object",
      properties: {
        usable: { type: "boolean" },
        reason: { type: "string" },
        camera_view: { type: "string", description: "Where the camera is, e.g. 'side-on, level with the cue'" },
      },
      required: ["usable", "reason", "camera_view"],
    },
    summary: { type: "string" },
    positives: {
      type: "array",
      maxItems: 4,
      items: {
        type: "object",
        properties: { at: { type: "string" }, point: { type: "string" } },
        required: ["at", "point"],
      },
    },
    improvements: {
      type: "array",
      maxItems: 4,
      items: {
        type: "object",
        properties: { at: { type: "string" }, point: { type: "string" } },
        required: ["at", "point"],
      },
    },
    possible_causes: { type: "array", maxItems: 3, items: { type: "string" } },
    not_assessable: { type: "array", maxItems: 4, items: { type: "string" } },
    coaching_tip: { type: "string" },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
  },
  required: [
    "clip_check",
    "summary",
    "positives",
    "improvements",
    "possible_causes",
    "not_assessable",
    "coaching_tip",
    "confidence",
  ],
};

// ---------------------------------------------------------------------------- Gemini

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Gemini's busy and hiccup responses, which are worth another go. */
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

const geminiFetch = async (url: string, init: RequestInit, attempts = 3) => {
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(url, {
      ...init,
      headers: { "x-goog-api-key": GEMINI_API_KEY, ...(init.headers ?? {}) },
    });
    // The last response is handed back unread, so the caller can see what went wrong.
    if (!RETRYABLE.has(response.status) || attempt >= attempts - 1) return response;
    await response.body?.cancel();
    await sleep(1500 * 2 ** attempt);
  }
};

const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
};

/** Uploads a larger clip through the Files API and waits until Gemini can read it. */
const uploadToGemini = async (bytes: Uint8Array, mimeType: string) => {
  const start = await geminiFetch(`${GEMINI_BASE}/upload/v1beta/files`, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(bytes.length),
      "X-Goog-Upload-Header-Content-Type": mimeType,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: "coach-clip" } }),
  });
  const uploadUrl = start.headers.get("x-goog-upload-url");
  if (!start.ok || !uploadUrl) throw new Error(`Gemini upload start failed (${start.status})`);

  const done = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(bytes.length),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: bytes,
  });
  if (!done.ok) throw new Error(`Gemini upload failed (${done.status}): ${(await done.text()).slice(0, 200)}`);
  const { file } = await done.json();

  // A video is processed before it can be used; a short clip takes a few seconds.
  for (let i = 0; i < 30; i += 1) {
    const check = await geminiFetch(`${GEMINI_BASE}/v1beta/${file.name}`, { method: "GET" });
    const state = (await check.json())?.state;
    if (state === "ACTIVE") return { name: file.name as string, uri: file.uri as string };
    if (state === "FAILED") throw new CoachError("This video could not be read. Try recording or exporting it again.");
    await sleep(2000);
  }
  throw new Error("Gemini file processing timed out");
};

const deleteFromGemini = (name: string) =>
  fetch(`${GEMINI_BASE}/v1beta/${name}`, {
    method: "DELETE",
    headers: { "x-goog-api-key": GEMINI_API_KEY },
  }).catch(() => undefined);

/** Gemini expects its own names for a few video types. */
const geminiMimeType = (storageType: string | undefined, path: string) => {
  const type = (storageType ?? "").toLowerCase();
  if (type === "video/quicktime" || /\.mov$/i.test(path)) return "video/mov";
  if (type === "video/x-m4v" || /\.m4v$/i.test(path)) return "video/mp4";
  if (type.startsWith("video/")) return type;
  return "video/mp4";
};

/** Statuses that mean "this model cannot take it right now" rather than "this request is wrong". */
const TRY_ANOTHER_MODEL = new Set([404, 429, 500, 502, 503, 504]);

/**
 * Asks each model in turn until one answers. Returns the parsed report and the model that
 * wrote it.
 */
const askGemini = async (videoPart: Record<string, unknown>, prompt: string) => {
  const request = JSON.stringify({
    contents: [
      {
        role: "user",
        parts: [{ ...videoPart, videoMetadata: { fps: FRAMES_PER_SECOND } }, { text: prompt }],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      // Low, so the same clip gets much the same report twice.
      temperature: 0.2,
    },
  });

  // Round the models, then round again after a pause, until one answers or time runs out.
  const deadline = Date.now() + GEMINI_BUDGET_MS;
  for (let round = 0; Date.now() < deadline; round += 1) {
    for (const model of GEMINI_MODELS) {
      const remaining = deadline - Date.now();
      if (remaining < 5000) break;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Math.min(GEMINI_REQUEST_TIMEOUT_MS, remaining));
      let response: Response;
      try {
        response = await fetch(`${GEMINI_BASE}/v1beta/models/${model}:generateContent`, {
          method: "POST",
          headers: { "x-goog-api-key": GEMINI_API_KEY, "Content-Type": "application/json" },
          body: request,
          signal: controller.signal,
        });
      } catch (error) {
        console.warn(`Gemini ${model} did not answer in time (round ${round + 1})`);
        continue;
      } finally {
        clearTimeout(timer);
      }

      if (TRY_ANOTHER_MODEL.has(response.status)) {
        console.warn(
          `Gemini ${model} unavailable (${response.status}, round ${round + 1}): ${(await response.text()).slice(0, 160)}`
        );
        continue;
      }
      if (!response.ok) {
        throw new Error(`Gemini ${model} error (${response.status}): ${(await response.text()).slice(0, 400)}`);
      }

      const payload = await response.json();
      if (payload?.promptFeedback?.blockReason) throw new CoachError(FRIENDLY.blocked);

      const candidate = payload?.candidates?.[0];
      const text = (candidate?.content?.parts ?? [])
        .map((part: any) => (typeof part?.text === "string" ? part.text : ""))
        .join("")
        .trim();
      if (!text) throw new Error(`Gemini ${model} returned no text (finishReason: ${candidate?.finishReason ?? "none"})`);
      if (round > 0 || model !== GEMINI_MODELS[0]) console.log(`Answered by ${model} on round ${round + 1}`);
      return { parsed: JSON.parse(text), model };
    }

    // Demand spikes pass; give it a moment before the next round.
    const pause = Math.min(5000 * (round + 1), 15000);
    if (Date.now() + pause > deadline - 5000) break;
    await sleep(pause);
  }

  // Every model was busy: nothing is wrong with the clip, so say so.
  throw new CoachError(FRIENDLY.busy, 503);
};

// ---------------------------------------------------------------------------- the report

const cleanList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .filter((item) => typeof item === "string")
        .map((item: string) => item.trim())
        .filter(Boolean)
    : [];

/** "0:04" plus the point becomes "0:04 · The bridge ...", so the app shows where to look. */
const cleanFindings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map((item: any) => {
          const point = typeof item?.point === "string" ? item.point.trim() : "";
          const at = typeof item?.at === "string" ? item.at.trim() : "";
          if (!point) return "";
          return /^\d{1,2}:\d{2}$/.test(at) ? `${at} · ${point}` : point;
        })
        .filter(Boolean)
    : [];

const buildReport = ({ parsed, model }: { parsed: any; model: string }) => {
  const check = parsed?.clip_check ?? {};
  if (check.usable === false) {
    const reason = typeof check.reason === "string" && check.reason.trim() ? check.reason.trim() : "";
    throw new CoachError(
      reason
        ? `${reason} Try a steady clip of a shot at the table.`
        : "The coach could not see enough of a shot in this clip. Try a steady clip of a shot at the table."
    );
  }

  const report_json = {
    summary: typeof parsed.summary === "string" ? parsed.summary.trim() : "",
    positives: cleanFindings(parsed.positives),
    improvements: cleanFindings(parsed.improvements),
    possible_causes: cleanList(parsed.possible_causes),
    not_assessable: cleanList(parsed.not_assessable),
    coaching_tip: typeof parsed.coaching_tip === "string" ? parsed.coaching_tip.trim() : "",
    confidence: ["high", "medium", "low"].includes(parsed.confidence) ? parsed.confidence : "medium",
    camera_view: typeof check.camera_view === "string" ? check.camera_view.trim() : "",
    model,
  };

  if (!report_json.summary || !report_json.coaching_tip || report_json.improvements.length === 0) {
    throw new Error("Report was missing required fields");
  }

  const recommendations = report_json.improvements
    .slice(0, 2)
    .map((item) => item.replace(/^\d{1,2}:\d{2} · /, ""))
    .concat(report_json.coaching_tip);

  // A plain-text copy for anything that reads `feedback` rather than the structured report.
  const feedback = [
    report_json.summary,
    "",
    "What went well:",
    ...report_json.positives.map((item) => `- ${item}`),
    "",
    "What to work on:",
    ...report_json.improvements.map((item) => `- ${item}`),
    "",
    `Take to the table: ${report_json.coaching_tip}`,
  ].join("\n");

  return { report_json, feedback, recommendations };
};

// ---------------------------------------------------------------------------- the request

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let analysisId = "";
  let userClient: any = null;
  let geminiFile: string | null = null;

  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error("Supabase env vars missing for Edge Function");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ ok: false, error: "Missing Authorization header" }, 401);

    userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) return json({ ok: false, error: "Invalid auth token" }, 401);

    const body = await req.json().catch(() => ({}));
    analysisId = typeof body?.analysis_id === "string" ? body.analysis_id : "";
    if (!analysisId) return json({ ok: false, error: "analysis_id is required" }, 400);

    // Claim the row in one statement, so a double tap cannot bill Gemini twice for one clip.
    // A row left "processing" by a run that died part-way can be claimed again after a while.
    const staleBefore = new Date(Date.now() - STALE_PROCESSING_MS).toISOString();
    const { data: analysis, error: analysisError } = await userClient
      .from("ai_analyses")
      .update({ status: "processing", error_message: null, updated_at: new Date().toISOString() })
      .eq("id", analysisId)
      .eq("user_id", user.id)
      .or(`status.eq.pending,status.eq.failed,and(status.eq.processing,updated_at.lt."${staleBefore}")`)
      .select("id,user_id,video_path,analysis_type,context_tags,user_notes")
      .maybeSingle<AnalysisRow>();

    if (analysisError) throw analysisError;
    if (!analysis) {
      // Already running or already done: not a failure, so the row is left alone.
      return json({ ok: false, error: "This clip is already being analysed.", code: "not_claimable" }, 409);
    }

    if (typeof analysis.user_notes === "string" && analysis.user_notes.length > MAX_USER_NOTES_CHARS) {
      analysis.user_notes = `${analysis.user_notes.slice(0, MAX_USER_NOTES_CHARS)}...`;
    }
    if (analysis.video_path.startsWith("demo://")) {
      throw new CoachError("This is a demo clip with no video to watch. Upload one of your own.");
    }

    const { data: blob, error: downloadError } = await userClient.storage.from("ai-videos").download(analysis.video_path);
    if (downloadError || !blob) {
      throw new CoachError("The video for this analysis could not be found. Upload the clip again.", 404);
    }
    if (blob.size > MAX_VIDEO_BYTES) throw new CoachError(FRIENDLY.tooBig, 413);

    const bytes = new Uint8Array(await blob.arrayBuffer());
    const mimeType = geminiMimeType(blob.type, analysis.video_path);

    let videoPart: Record<string, unknown>;
    if (bytes.length <= INLINE_LIMIT_BYTES) {
      videoPart = { inlineData: { mimeType, data: toBase64(bytes) } };
    } else {
      const uploaded = await uploadToGemini(bytes, mimeType);
      geminiFile = uploaded.name;
      videoPart = { fileData: { mimeType, fileUri: uploaded.uri } };
    }

    const prompt = buildPrompt(analysis);

    // A malformed answer is rare but not unheard of; one more try usually fixes it.
    let result: ReturnType<typeof buildReport>;
    const askedAt = Date.now();
    try {
      result = buildReport(await askGemini(videoPart, prompt));
    } catch (error) {
      // No second go if the first used most of the time the function has.
      if (error instanceof CoachError || Date.now() - askedAt > 45 * 1000) throw error;
      console.warn("First Gemini attempt failed, retrying:", error);
      result = buildReport(await askGemini(videoPart, prompt));
    }

    const { error: updateError } = await userClient
      .from("ai_analyses")
      .update({
        status: "completed",
        report_json: result.report_json,
        feedback: result.feedback,
        recommendations: result.recommendations,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", analysis.id)
      .eq("user_id", user.id);
    if (updateError) throw updateError;

    return json({ ok: true, model: result.report_json.model, analysis_id: analysis.id });
  } catch (error) {
    // The player sees a plain reason; the detail stays in the function logs.
    const friendly = error instanceof CoachError ? error.message : FRIENDLY.generic;
    if (!(error instanceof CoachError)) console.error("ai-analyze-clip failed:", error);

    if (analysisId && userClient) {
      await userClient
        .from("ai_analyses")
        .update({ status: "failed", error_message: friendly, updated_at: new Date().toISOString() })
        .eq("id", analysisId)
        .then(
          () => undefined,
          () => undefined
        );
    }

    return json({ ok: false, error: friendly }, error instanceof CoachError ? error.status : 500);
  } finally {
    if (geminiFile) await deleteFromGemini(geminiFile);
  }
});
