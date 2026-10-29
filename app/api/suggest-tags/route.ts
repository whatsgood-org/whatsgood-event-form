import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { stripHtml } from "@/lib/text";

// ---------------------------------------------------------------------------
// Rate limiting — 5 requests per IP per hour (in-memory, resets on cold start)
// ---------------------------------------------------------------------------
const RATE_LIMIT = 5;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

const ipBucket = new Map<string, { count: number; windowStart: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipBucket.get(ip);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    ipBucket.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
// Created on first use, not at import: `new OpenAI()` throws without a key, and
// `next build` imports this route, so a module-level client fails any build
// that lacks OPENAI_API_KEY (e.g. Vercel preview builds).
let openai: OpenAI | null = null;

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  let body: { title?: string; description?: string; tags?: { id: number; name: string }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { title, description, tags } = body;

  // Description now arrives as rich-text HTML — feed the model plain text only.
  const plainDescription = stripHtml(description ?? "");

  if (!title?.trim() && !plainDescription) {
    return NextResponse.json(
      { error: "Provide a title or description first." },
      { status: 400 }
    );
  }

  if (!tags?.length) {
    return NextResponse.json({ error: "No tags available." }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "Tag suggestions are unavailable." }, { status: 503 });
  }
  openai ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const tagList = tags.map(t => `${t.id}: ${t.name}`).join("\n");

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    max_tokens: 60,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are a local events tagging assistant. Given an event title and description, select between 2 and 7 tags from the list below that best describe the event. Return ONLY a JSON object with a single key "tag_ids" containing an array of integers (the tag IDs you selected).

Available tags:
${tagList}`,
      },
      {
        role: "user",
        content: `Title: ${title || "(none)"}
Description: ${plainDescription || "(none)"}`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let tagIds: number[] = [];
  try {
    const parsed = JSON.parse(raw);
    const ids = parsed.tag_ids;
    if (Array.isArray(ids)) {
      // Validate all returned IDs actually exist in the provided list
      const validIds = new Set(tags.map(t => t.id));
      tagIds = ids.filter((id: unknown) => typeof id === "number" && validIds.has(id)).slice(0, 7);
    }
  } catch {
    return NextResponse.json({ error: "AI returned an unexpected response." }, { status: 500 });
  }

  if (tagIds.length < 2) {
    return NextResponse.json({ error: "AI couldn't find enough matching tags." }, { status: 500 });
  }

  return NextResponse.json({ tag_ids: tagIds });
}
