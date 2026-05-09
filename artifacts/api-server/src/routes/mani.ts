import { Router } from "express";
import { db } from "@workspace/db";
import { todosTable, alarmsTable, chatMessagesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { openai } from "../lib/openai";
import {
  TranscribeAudioBody,
  SendChatMessageBody,
  TextToSpeechBody,
  CreateTodoBody,
  UpdateTodoBody,
  UpdateTodoParams,
  DeleteTodoParams,
  CreateAlarmBody,
  UpdateAlarmBody,
  UpdateAlarmParams,
  DeleteAlarmParams,
} from "@workspace/api-zod";

const router = Router();

const MANI_SYSTEM_PROMPT = `You are Mani, a highly intelligent personal AI assistant. You are helpful, precise, and conversational.

When the user asks for code, format it in clean code blocks with the language specified, like:
\`\`\`javascript
// code here
\`\`\`

You can help with:
- Writing and explaining code in any language
- Answering technical and general questions
- Managing their to-do list and alarms (tell them to use the side panel)
- Giving step-by-step directions
- Problem solving and reasoning

Keep responses concise and clear. Be direct and personable. The user experiences your responses as natural spoken audio — avoid markdown formatting that doesn't translate well to speech, but DO use code blocks for code. When replying about code, briefly explain it before the code block.`;

// POST /api/mani/transcribe
router.post("/mani/transcribe", async (req, res) => {
  const parsed = TranscribeAudioBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  try {
    const { audio, format } = parsed.data;
    const audioBuffer = Buffer.from(audio, "base64");
    const audioFormat = (format as "webm" | "wav" | "mp4" | "m4a" | "ogg") || "webm";

    const audioFile = new File([audioBuffer], `audio.${audioFormat}`, {
      type: `audio/${audioFormat}`,
    });

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "gpt-4o-mini-transcribe",
      response_format: "json",
    });

    res.json({ text: transcription.text });
  } catch (err) {
    req.log.error({ err }, "Transcription error");
    res.status(500).json({ error: "Failed to transcribe audio" });
  }
});

// POST /api/mani/chat — SSE streaming
router.post("/mani/chat", async (req, res) => {
  const parsed = SendChatMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { message, history } = parsed.data;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    // Build messages array
    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: MANI_SYSTEM_PROMPT },
    ];

    if (history && history.length > 0) {
      for (const h of history) {
        messages.push({
          role: h.role as "user" | "assistant",
          content: h.content,
        });
      }
    }

    messages.push({ role: "user", content: message });

    // Save user message to DB
    await db.insert(chatMessagesTable).values({ role: "user", content: message });

    let fullResponse = "";
    const stream = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 8192,
      messages,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        fullResponse += content;
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    // Save assistant message to DB
    await db.insert(chatMessagesTable).values({ role: "assistant", content: fullResponse });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    req.log.error({ err }, "Chat error");
    res.write(`data: ${JSON.stringify({ error: "Failed to generate response" })}\n\n`);
    res.end();
  }
});

// POST /api/mani/tts — Inworld TTS
router.post("/mani/tts", async (req, res) => {
  const parsed = TextToSpeechBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { text } = parsed.data;

  if (!process.env.INWORLD_API_KEY) {
    res.status(500).json({ error: "Inworld API key not configured" });
    return;
  }

  try {
    const [keyId, keySecret] = process.env.INWORLD_API_KEY.split(":");
    const basicAuth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

    const inworldRes = await fetch(
      "https://studio.inworld.ai/v1/workspaces/-/characters/-:simpleSendText",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          config: {
            generateAudio: true,
          },
        }),
      }
    );

    if (!inworldRes.ok) {
      // Fallback to OpenAI TTS if Inworld fails
      req.log.warn({ status: inworldRes.status }, "Inworld TTS failed, falling back to OpenAI TTS");
      const mp3 = await openai.audio.speech.create({
        model: "tts-1-hd",
        voice: "nova",
        input: text,
        response_format: "mp3",
      });
      const buffer = Buffer.from(await mp3.arrayBuffer());
      res.json({ audio: buffer.toString("base64"), format: "mp3" });
      return;
    }

    const data = await inworldRes.json() as { audioChunk?: string; audio_content?: string };
    const audioBase64 = data.audioChunk || data.audio_content;

    if (!audioBase64) {
      // Fallback to OpenAI TTS
      req.log.warn("No audio in Inworld response, falling back to OpenAI TTS");
      const mp3 = await openai.audio.speech.create({
        model: "tts-1-hd",
        voice: "nova",
        input: text,
        response_format: "mp3",
      });
      const buffer = Buffer.from(await mp3.arrayBuffer());
      res.json({ audio: buffer.toString("base64"), format: "mp3" });
      return;
    }

    res.json({ audio: audioBase64, format: "wav" });
  } catch (err) {
    req.log.error({ err }, "TTS error, falling back to OpenAI");
    try {
      const mp3 = await openai.audio.speech.create({
        model: "tts-1-hd",
        voice: "nova",
        input: text,
        response_format: "mp3",
      });
      const buffer = Buffer.from(await mp3.arrayBuffer());
      res.json({ audio: buffer.toString("base64"), format: "mp3" });
    } catch (fallbackErr) {
      req.log.error({ err: fallbackErr }, "TTS fallback also failed");
      res.status(500).json({ error: "TTS failed" });
    }
  }
});

// GET /api/mani/todos
router.get("/mani/todos", async (req, res) => {
  const todos = await db.select().from(todosTable).orderBy(desc(todosTable.createdAt));
  res.json(todos);
});

// POST /api/mani/todos
router.post("/mani/todos", async (req, res) => {
  const parsed = CreateTodoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const [todo] = await db.insert(todosTable).values({ text: parsed.data.text }).returning();
  res.status(201).json(todo);
});

// PUT /api/mani/todos/:id
router.put("/mani/todos/:id", async (req, res) => {
  const paramsParsed = UpdateTodoParams.safeParse({ id: Number(req.params.id) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const bodyParsed = UpdateTodoBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const [todo] = await db
    .update(todosTable)
    .set(bodyParsed.data)
    .where(eq(todosTable.id, paramsParsed.data.id))
    .returning();
  if (!todo) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(todo);
});

// DELETE /api/mani/todos/:id
router.delete("/mani/todos/:id", async (req, res) => {
  const parsed = DeleteTodoParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.delete(todosTable).where(eq(todosTable.id, parsed.data.id));
  res.status(204).end();
});

// GET /api/mani/alarms
router.get("/mani/alarms", async (req, res) => {
  const alarms = await db.select().from(alarmsTable).orderBy(alarmsTable.time);
  res.json(alarms);
});

// POST /api/mani/alarms
router.post("/mani/alarms", async (req, res) => {
  const parsed = CreateAlarmBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const [alarm] = await db
    .insert(alarmsTable)
    .values({ label: parsed.data.label, time: parsed.data.time, days: parsed.data.days ?? [] })
    .returning();
  res.status(201).json(alarm);
});

// PUT /api/mani/alarms/:id
router.put("/mani/alarms/:id", async (req, res) => {
  const paramsParsed = UpdateAlarmParams.safeParse({ id: Number(req.params.id) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const bodyParsed = UpdateAlarmBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const [alarm] = await db
    .update(alarmsTable)
    .set(bodyParsed.data)
    .where(eq(alarmsTable.id, paramsParsed.data.id))
    .returning();
  if (!alarm) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(alarm);
});

// DELETE /api/mani/alarms/:id
router.delete("/mani/alarms/:id", async (req, res) => {
  const parsed = DeleteAlarmParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.delete(alarmsTable).where(eq(alarmsTable.id, parsed.data.id));
  res.status(204).end();
});

// GET /api/mani/history
router.get("/mani/history", async (req, res) => {
  const messages = await db
    .select()
    .from(chatMessagesTable)
    .orderBy(desc(chatMessagesTable.createdAt))
    .limit(50);
  res.json(messages.reverse());
});

// DELETE /api/mani/history
router.delete("/mani/history", async (req, res) => {
  await db.delete(chatMessagesTable);
  res.status(204).end();
});

export default router;
