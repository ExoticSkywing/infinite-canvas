import { optimizeImageForVision } from "@/app/(user)/canvas/utils/canvas-image-data";
import { getActiveReversePromptTemplate } from "@/app/(user)/canvas/utils/canvas-reverse-prompt-templates";
import { requestImageQuestion } from "@/services/api/image";
import { imageToDataUrl } from "@/services/image-storage";
import type { AiConfig } from "@/stores/use-config-store";

export const DEFAULT_ASSET_CATEGORIES = [
    { label: "人物写真", value: "人物写真" },
    { label: "潮流时装摄影", value: "潮流时装摄影" },
    { label: "概念艺术", value: "概念艺术" },
    { label: "风格探索", value: "风格探索" },
    { label: "电影海报", value: "电影海报" },
    { label: "商业摄影", value: "商业摄影" },
    { label: "二次元动漫", value: "二次元动漫" },
    { label: "超现实艺术", value: "超现实艺术" },
    { label: "科幻未来", value: "科幻未来" },
    { label: "潮玩手办", value: "潮玩手办" },
];

export const DELTA_KEYWORDS = [
    "腿型", "粗", "细", "好看", "难看", "换个", "改下", "修改", "去掉", "添加", "微调", "重新设计",
    "调整", "修长", "把", "不要", "参考图片", "说实话", "感觉", "有点", "@[node:", "图1", "图2", "图片1", "图片2"
];

export function checkProcessOrDeltaPrompt(prompt: string): { isDelta: boolean; matchedKeyword?: string } {
    if (!prompt) return { isDelta: true, matchedKeyword: "内容为空" };
    const trimmed = prompt.trim();
    if (trimmed.length < 35) return { isDelta: true, matchedKeyword: "字数较短" };
    const lower = trimmed.toLowerCase();
    for (const kw of DELTA_KEYWORDS) {
        if (lower.includes(kw.toLowerCase())) {
            return { isDelta: true, matchedKeyword: kw };
        }
    }
    return { isDelta: false };
}

export function normalizeCategory(rawCat: string): string {
    if (!rawCat) return "人物写真";
    const clean = rawCat.replace(/[\[\]【】\s*`]/g, "").trim();
    if (!clean) return "人物写真";
    for (const opt of DEFAULT_ASSET_CATEGORIES) {
        if (opt.value === clean || opt.label.includes(clean)) {
            return opt.value;
        }
    }
    return clean.slice(0, 12);
}

export function normalizeTags(rawTags: string, rawText: string): string[] {
    let list: string[] = [];
    if (rawTags) {
        list = rawTags
            .split(/[,，、\n]+/)
            .map((t) => t.replace(/[\[\]"'\s]/g, "").trim())
            .filter((t) => t.length > 0 && t.length <= 15);
    }
    if (list.length === 0) {
        const candidateTags: string[] = ["AI绘画", "7维解剖"];
        if (rawText.includes("棚拍") || rawText.includes("影棚")) candidateTags.push("商业棚拍");
        if (rawText.includes("机能")) candidateTags.push("机能风");
        if (rawText.includes("胶片")) candidateTags.push("胶片质感");
        if (rawText.includes("女性") || rawText.includes("少女")) candidateTags.push("女性写真");
        if (rawText.includes("85mm")) candidateTags.push("85mm长焦");
        if (rawText.includes("赛博朋克")) candidateTags.push("赛博朋克");
        if (rawText.includes("超现实")) candidateTags.push("超现实");
        list = candidateTags;
    }
    return Array.from(new Set(list)).slice(0, 5);
}

export function cleanPromptText(text: string): string {
    if (!text) return "";
    let s = text.trim();
    s = s.replace(/^[#*_~`\s]*(?:master\s*prompt|positive\s*prompt|prompt|正向提示词|英文提示词)[#*_~`\s]*[:：]?[ \t*`_~]*(?:\n|$)/i, "");
    s = s.replace(/^[#*_~`\s]*(?:master\s*prompt|positive\s*prompt|prompt|正向提示词|英文提示词)[#*_~`\s]*[:：]?[ \t*`_~]*/i, "");
    s = s.replace(/^```[a-zA-Z0-9_-]*\s*\n?/i, "");
    s = s.replace(/\n?```\s*$/i, "");
    s = s.replace(/^>\s*/gm, "");
    s = s.replace(/```[a-zA-Z0-9_-]*\s*\n?/gi, "");
    s = s.replace(/\n?```/gi, "");
    s = s.replace(/^[*_~`]+/, "");
    s = s.replace(/[*_~`]+$/, "");
    return s.trim();
}

export function extractStep2Prompts(rawText: string): string {
    const step2Match = rawText.match(/###\s*第二步[^\n]*\n([\s\S]*?)(?=(?:###\s*第三步|---\s*\n\s*###\s*第三步|\n\n-\s*【推荐分类】|$))/i);
    const step2Block = step2Match ? step2Match[1] : rawText;

    let posText = "";
    let negText = "";

    const negSplitRegex = /(?:(?:\*{1,2}\s*)?(?:Negative\s*Prompt|负向提示词|反向提示词|禁止项)(?:\s*\*{1,2})?[:：]?)/i;
    const parts = step2Block.split(negSplitRegex);

    if (parts.length > 1) {
        posText = parts[0];
        negText = parts.slice(1).join("\n");
    } else {
        const promptMatch = step2Block.match(/(?:####\s*Prompt:?|Prompt:?)\s*\n*>?\s*([\s\S]*?)(?=(?:####\s*Negative Prompt|Negative Prompt|$))/i);
        const negativeMatch = step2Block.match(/(?:####\s*Negative Prompt:?|Negative Prompt:?)\s*\n*>?\s*([\s\S]*?)$/i);
        if (promptMatch && promptMatch[1]) {
            posText = promptMatch[1];
            negText = negativeMatch?.[1] || "";
        } else {
            posText = step2Block;
        }
    }

    const cleanPositive = cleanPromptText(posText);
    const cleanNegative = cleanPromptText(negText);

    if (cleanNegative) {
        return `${cleanPositive}\n\nNegative Prompt:\n${cleanNegative}`;
    }
    return cleanPositive || rawText.trim();
}

export function extractGalleryPromptAndTitle(rawText: string, fallbackTitle: string) {
    const cleanPrompt = extractStep2Prompts(rawText);
    let extractedTitle = fallbackTitle;

    const lines = rawText.split("\n");
    let rawTitle = "";
    let rawCategory = "";
    let rawTags = "";

    const titleLineRegex = /^[\s\-*#_~`]*?(?:【?\s*(?:作品|画廊|精选|推荐)?(?:标题|Title)\s*】?|\bTitle\b)[\s*_~`]*?[:：]\s*(.+)$/i;
    const catLineRegex = /^[\s\-*#_~`]*?(?:【?\s*(?:推荐|所属)?分类\s*】?|\bCategory\b)[\s*_~`]*?[:：]\s*(.+)$/i;
    const tagLineRegex = /^[\s\-*#_~`]*?(?:【?\s*(?:精选|推荐)?标签\s*】?|\bTags?\b)[\s*_~`]*?[:：]\s*(.+)$/i;

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (/^#{1,6}\s+.*(?:第[一二三四五六七八九十\d]+步|步骤|元数据|Metadata)/i.test(line)) continue;

        if (!rawTitle) {
            const m = line.match(titleLineRegex);
            if (m) rawTitle = m[1].replace(/^[[\[【\s*`]+|[\]】\s*`]+$/g, "").trim();
        }
        if (!rawCategory) {
            const m = line.match(catLineRegex);
            if (m) rawCategory = m[1].replace(/^[[\[【\s*`]+|[\]】\s*`]+$/g, "").trim();
        }
        if (!rawTags) {
            const m = line.match(tagLineRegex);
            if (m) rawTags = m[1].replace(/^[[\[【\s*`]+|[\]】\s*`]+$/g, "").trim();
        }
    }

    if (!rawTitle) {
        const inlineTitle = rawText.match(/(?:(?:作品|画廊|推荐)?标题|Title)[^\n：:]*?[:：]\s*([^\n；。]+)/i);
        if (inlineTitle) rawTitle = inlineTitle[1].replace(/^[[\[【\s*`]+|[\]】\s*`]+$/g, "").trim();
    }
    if (!rawCategory) {
        const inlineCat = rawText.match(/(?:(?:推荐|所属)?分类|Category)[^\n：:]*?[:：]\s*([^\n；。]+)/i);
        if (inlineCat) rawCategory = inlineCat[1].replace(/^[[\[【\s*`]+|[\]】\s*`]+$/g, "").trim();
    }
    if (!rawTags) {
        const inlineTags = rawText.match(/(?:(?:精选|推荐)?标签|Tags?)[^\n：:]*?[:：]\s*([^\n；。]+)/i);
        if (inlineTags) rawTags = inlineTags[1].replace(/^[[\[【\s*`]+|[\]】\s*`]+$/g, "").trim();
    }

    const category = normalizeCategory(rawCategory);
    const tags = normalizeTags(rawTags, rawText);

    if (rawTitle && rawTitle.length >= 3) {
        extractedTitle = rawTitle.slice(0, 30);
    } else if (tags.length >= 2) {
        extractedTitle = `${tags[0]}${tags[1]}写真大片`;
    } else if (tags.length === 1) {
        extractedTitle = `${tags[0]}${category}视觉`;
    } else {
        const isDelta = checkProcessOrDeltaPrompt(fallbackTitle).isDelta;
        extractedTitle = fallbackTitle && !isDelta ? fallbackTitle : `${category}视觉大片`;
    }

    return {
        cleanPrompt: cleanPrompt || rawText.trim(),
        fullReport: rawText.trim(),
        title: extractedTitle,
        category,
        tags,
    };
}

export type ExtractedAssetMeta = {
    cleanPrompt: string;
    fullReport: string;
    title: string;
    category: string;
    tags: string[];
};

export async function extractAssetMetaFromImage(
    imageUrl: string,
    effectiveConfig: AiConfig,
    fallbackTitle = "未命名素材",
    onProgress?: (streamedText: string) => void,
): Promise<ExtractedAssetMeta> {
    const template = getActiveReversePromptTemplate();
    const textConfig = {
        ...effectiveConfig,
        model: effectiveConfig.textModel || effectiveConfig.model || "gpt-5.5",
    };

    let optimizedUrl = await optimizeImageForVision(imageUrl);
    if (!optimizedUrl || !optimizedUrl.startsWith("data:")) {
        optimizedUrl = await imageToDataUrl({ url: imageUrl, dataUrl: imageUrl });
    }

    const extractionInstruction = `${template.prompt}

---
### 第三步：画廊元数据提取（必须输出）
- 【作品标题】：[提炼一个高度契合画面视觉意境与题材的画廊作品标题，8到18字，如：猫耳头盔亚文化时尚大片、未来机能风清冷少女特写、极简影棚光影视觉大片，严禁直接拼接标签]
- 【推荐分类】：[提炼 2 到 6 个字最切合画面主题的分类名称，无需拘泥固定词，只要贴切精准即可，如：潮流时装摄影、人物写真、概念艺术、潮玩手办、电影海报等]
- 【精选标签】：[提炼 3 到 5 个高精度具象视觉标签，用逗号分隔，如：机能风, 商业棚拍, 85mm长焦, 东亚女性, 清冷感]`;

    const chatMessages = [
        {
            role: "user" as const,
            content: [
                { type: "text" as const, text: extractionInstruction },
                { type: "image_url" as const, image_url: { url: optimizedUrl } },
            ],
        },
    ];

    let streamed = "";
    await requestImageQuestion(textConfig, chatMessages, (chunk) => {
        streamed = chunk;
        if (onProgress) onProgress(chunk);
    });

    return extractGalleryPromptAndTitle(streamed, fallbackTitle);
}
