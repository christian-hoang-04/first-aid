import type { GuideId } from "../guides"
import type { GuideSceneDefinition } from "./engine"
import { epBungScene } from "./ep-bung"
import { gayXuongDuiScene } from "./gay-xuong-dui"
import { xucThiaScene } from "./xuc-thia"

export const GUIDE_SCENES: Record<GuideId, GuideSceneDefinition> = {
  "ep-bung": epBungScene,
  "gay-xuong-dui": gayXuongDuiScene,
  "xuc-thia": xucThiaScene,
}

export { createGuidePlayer, type GuidePlayer, type Insets } from "./engine"
