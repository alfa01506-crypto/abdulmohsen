import OpenAI from "openai";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return Response.json(
        { error: "OPENAI_API_KEY is missing." },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const audio = formData.get("audio");

    if (!(audio instanceof File)) {
      return Response.json(
        { error: "Audio file is missing." },
        { status: 400 }
      );
    }

    const openai = new OpenAI({ apiKey });

    const transcription = await openai.audio.transcriptions.create({
      file: audio,
      model: "gpt-4o-mini-transcribe",
    });

    return Response.json({
      text: transcription.text,
    });
  } catch (error) {
    console.error("Transcription API error:", error);

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Audio transcription failed.",
      },
      { status: 500 }
    );
  }
}
