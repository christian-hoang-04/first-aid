import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const reportPath = path.resolve(process.cwd(), "..", "live-voice-open-source-survey.md");
    const report = await readFile(reportPath, "utf8");
    return new Response(report, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("Survey report is not available in this local checkout.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
