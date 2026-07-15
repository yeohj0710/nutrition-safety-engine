function hasBatchim(character: string) {
  const code = character.charCodeAt(0);
  return code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0;
}

const sentenceEnd = "(?=[.!?…]|$)";

export function toHaeyoStyle(value: string) {
  return value
    .replace(/이량은/g, "이 양은")
    .replace(new RegExp(`것입니다${sentenceEnd}`, "g"), "거예요")
    .replace(new RegExp(`아닙니다${sentenceEnd}`, "g"), "아니에요")
    .replace(new RegExp(`되었습니다${sentenceEnd}`, "g"), "됐어요")
    .replace(new RegExp(`하였습니다${sentenceEnd}`, "g"), "했어요")
    .replace(new RegExp(`보여주었습니다${sentenceEnd}`, "g"), "보여줬어요")
    .replace(new RegExp(`이었습니다${sentenceEnd}`, "g"), "이었어요")
    .replace(new RegExp(`였습니다${sentenceEnd}`, "g"), "였어요")
    .replace(new RegExp(`했습니다${sentenceEnd}`, "g"), "했어요")
    .replace(new RegExp(`켰습니다${sentenceEnd}`, "g"), "켰어요")
    .replace(new RegExp(`났습니다${sentenceEnd}`, "g"), "났어요")
    .replace(new RegExp(`졌습니다${sentenceEnd}`, "g"), "졌어요")
    .replace(new RegExp(`었습니다${sentenceEnd}`, "g"), "었어요")
    .replace(new RegExp(`았습니다${sentenceEnd}`, "g"), "았어요")
    .replace(new RegExp(`있습니다${sentenceEnd}`, "g"), "있어요")
    .replace(new RegExp(`없습니다${sentenceEnd}`, "g"), "없어요")
    .replace(new RegExp(`않습니다${sentenceEnd}`, "g"), "않아요")
    .replace(new RegExp(`모릅니다${sentenceEnd}`, "g"), "몰라요")
    .replace(new RegExp(`다릅니다${sentenceEnd}`, "g"), "달라요")
    .replace(new RegExp(`어렵습니다${sentenceEnd}`, "g"), "어려워요")
    .replace(new RegExp(`같습니다${sentenceEnd}`, "g"), "같아요")
    .replace(new RegExp(`낫습니다${sentenceEnd}`, "g"), "나아요")
    .replace(new RegExp(`보입니다${sentenceEnd}`, "g"), "보여요")
    .replace(new RegExp(`높습니다${sentenceEnd}`, "g"), "높아요")
    .replace(new RegExp(`낮습니다${sentenceEnd}`, "g"), "낮아요")
    .replace(new RegExp(`큽니다${sentenceEnd}`, "g"), "커요")
    .replace(new RegExp(`높입니다${sentenceEnd}`, "g"), "높여요")
    .replace(new RegExp(`줄입니다${sentenceEnd}`, "g"), "줄여요")
    .replace(new RegExp(`늘립니다${sentenceEnd}`, "g"), "늘려요")
    .replace(new RegExp(`가집니다${sentenceEnd}`, "g"), "가져요")
    .replace(new RegExp(`봅니다${sentenceEnd}`, "g"), "봐요")
    .replace(new RegExp(`집니다${sentenceEnd}`, "g"), "져요")
    .replace(new RegExp(`보여줍니다${sentenceEnd}`, "g"), "보여줘요")
    .replace(new RegExp(`나타냅니다${sentenceEnd}`, "g"), "나타내요")
    .replace(new RegExp(`시킵니다${sentenceEnd}`, "g"), "시켜요")
    .replace(new RegExp(`됩니다${sentenceEnd}`, "g"), "돼요")
    .replace(new RegExp(`합니다${sentenceEnd}`, "g"), "해요")
    .replace(
      new RegExp(`([가-힣])입니다${sentenceEnd}`, "g"),
      (_, lastCharacter: string) =>
        `${lastCharacter}${hasBatchim(lastCharacter) ? "이에요" : "예요"}`,
    )
    .replace(new RegExp(`입니다${sentenceEnd}`, "g"), "이에요");
}
