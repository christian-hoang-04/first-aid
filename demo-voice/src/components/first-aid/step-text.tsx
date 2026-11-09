import { stepLines } from "@/lib/first-aid/guides"
import { cn } from "@/lib/utils"

/** Nội dung bước, giữ nguyên các dòng gạch đầu dòng của dữ liệu gốc. */
export function StepText({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1 leading-relaxed text-zinc-300", className)}>
      {stepLines(text).map((line, index) =>
        line.bullet ? (
          <p key={index} className="flex gap-2 pl-1">
            <span aria-hidden="true" className="text-rose-400">
              •
            </span>
            {line.text}
          </p>
        ) : (
          <p key={index}>{line.text}</p>
        ),
      )}
    </div>
  )
}
