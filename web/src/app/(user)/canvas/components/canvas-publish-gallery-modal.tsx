"use client";

import { useEffect, useState, useMemo } from "react";
import { App, Button, Form, Input, Modal, Select, Space, Segmented, Tag } from "antd";
import { ExternalLink, Sparkles, UploadCloud, Tag as TagIcon, Layers } from "lucide-react";
import { saveAdminPrompt } from "@/services/api/admin";
import { useUserStore } from "@/stores/use-user-store";
import { useEffectiveConfig } from "@/stores/use-config-store";
import { getActiveReversePromptTemplate } from "../utils/canvas-reverse-prompt-templates";
import { requestImageQuestion } from "@/services/api/image";
import { optimizeImageForVision } from "../utils/canvas-image-data";

export type PublishGalleryData = {
    title: string;
    coverUrl: string;
    prompt: string;
    category?: string;
    tags?: string[];
};

const DEFAULT_CATEGORIES = [
    { label: "人物写真", value: "人物写真" },
    { label: "潮流时装摄影", value: "潮流时装摄影" },
    { label: "商业摄影", value: "商业摄影" },
    { label: "电影海报", value: "电影海报" },
    { label: "风格探索", value: "风格探索" },
    { label: "二次元动漫", value: "二次元动漫" },
    { label: "科幻未来", value: "科幻未来" },
    { label: "超现实艺术", value: "超现实艺术" },
];

const DELTA_KEYWORDS = [
    "腿型", "粗", "细", "好看", "难看", "换个", "改下", "修改", "去掉", "添加", "微调", "重新设计",
    "调整", "修长", "把", "不要", "参考图片", "说实话", "感觉", "有点", "@[node:", "图1", "图2", "图片1", "图片2"
];

function checkProcessOrDeltaPrompt(prompt: string): { isDelta: boolean; matchedKeyword?: string } {
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

function normalizeCategory(rawCat: string): string {
    if (!rawCat) return "人物写真";
    const clean = rawCat.replace(/[\[\]【】\s*`]/g, "").trim();
    if (!clean) return "人物写真";
    for (const opt of DEFAULT_CATEGORIES) {
        if (opt.value === clean || opt.label.includes(clean)) {
            return opt.value;
        }
    }
    // 灵活保留 AI 给出的贴切分类名（限制在 12 字内），不再强行收缩为固定几个预置类
    return clean.slice(0, 12);
}

function normalizeTags(rawTags: string, rawText: string): string[] {
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

function cleanPromptText(text: string): string {
    if (!text) return "";
    let s = text.trim();
    // 剔除开头的 Prompt 标题整行或前缀（如 " Master Prompt:**\n", "**Master Prompt:**\n", "**Prompt:** " 等）
    s = s.replace(/^[#*_~`\s]*(?:master\s*prompt|positive\s*prompt|prompt|正向提示词|英文提示词)[#*_~`\s]*[:：]?[ \t*`_~]*(?:\n|$)/i, "");
    s = s.replace(/^[#*_~`\s]*(?:master\s*prompt|positive\s*prompt|prompt|正向提示词|英文提示词)[#*_~`\s]*[:：]?[ \t*`_~]*/i, "");
    // 剔除代码块围栏
    s = s.replace(/^```[a-zA-Z0-9_-]*\s*\n?/i, "");
    s = s.replace(/\n?```\s*$/i, "");
    // 剔除引用符 >
    s = s.replace(/^>\s*/gm, "");
    // 剔除可能残留的内部代码块
    s = s.replace(/```[a-zA-Z0-9_-]*\s*\n?/gi, "");
    s = s.replace(/\n?```/gi, "");
    // 剔除头尾多余 markdown 修饰
    s = s.replace(/^[*_~`]+/, "");
    s = s.replace(/[*_~`]+$/, "");
    return s.trim();
}

function extractStep2Prompts(rawText: string): string {
    // 1. 优先定位第二步区间
    const step2Match = rawText.match(/###\s*第二步[^\n]*\n([\s\S]*?)(?=(?:###\s*第三步|---\s*\n\s*###\s*第三步|\n\n-\s*【推荐分类】|$))/i);
    const step2Block = step2Match ? step2Match[1] : rawText;

    let posText = "";
    let negText = "";

    // 寻找负向词分隔符
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

function extractGalleryPromptAndTitle(rawText: string, fallbackTitle: string) {
    let cleanPrompt = "";
    let extractedTitle = fallbackTitle;

    // 1. 精确提取第二步工业级英文提示词（兼容代码块 ```text、Markdown 加粗与普通文本格式）
    cleanPrompt = extractStep2Prompts(rawText);

    // 2. 提取 AI 智能推荐的作品标题、分类与标签
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

    // 格式化作品标题：优先采用 AI 提炼的高级画廊标题；若无则自然顺畅组合为具有艺术感的主题标题
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

export function CanvasPublishGalleryModal({
    open,
    onClose,
    initialData,
    onSuccess,
}: {
    open: boolean;
    onClose: () => void;
    initialData?: PublishGalleryData | null;
    onSuccess?: () => void;
}) {
    const { message, notification } = App.useApp();
    const token = useUserStore((state) => state.token);
    const effectiveConfig = useEffectiveConfig();
    const [form] = Form.useForm<PublishGalleryData>();
    const [submitting, setSubmitting] = useState(false);
    const [extracting, setExtracting] = useState(false);
    const [extractedVersions, setExtractedVersions] = useState<{ clean: string; full: string } | null>(null);
    const [promptMode, setPromptMode] = useState<"clean" | "full">("clean");
    const [aiTagged, setAiTagged] = useState(false);
    const [categories, setCategories] = useState(DEFAULT_CATEGORIES);

    useEffect(() => {
        if (!open) return;
        setExtractedVersions(null);
        setPromptMode("clean");
        setAiTagged(false);
        if (initialData) {
            form.setFieldsValue({
                title: initialData.title || "未命名作品",
                coverUrl: initialData.coverUrl || "",
                prompt: initialData.prompt || "",
                category: initialData.category || "人物写真",
                tags: initialData.tags || ["AI绘画", "无限画布"],
            });
        }
    }, [open, initialData, form]);

    const watchedPrompt = Form.useWatch("prompt", form) || "";
    const deltaCheck = useMemo(() => checkProcessOrDeltaPrompt(watchedPrompt), [watchedPrompt]);

    const handleAutoExtractPrompt = async () => {
        const currentCover = form.getFieldValue("coverUrl") || initialData?.coverUrl;
        if (!currentCover) {
            message.warning("缺少封面图片，无法进行视觉解剖反推");
            return;
        }

        try {
            setExtracting(true);
            const template = getActiveReversePromptTemplate();
            const textConfig = {
                ...effectiveConfig,
                model: effectiveConfig.textModel || effectiveConfig.model || "gpt-5.5",
            };

            // 无论来源是云存储还是本地URL，统一转换为轻量安全 Base64 Data URI
            let optimizedUrl = await optimizeImageForVision(currentCover);
            if (!optimizedUrl || !optimizedUrl.startsWith("data:")) {
                const { imageToDataUrl } = await import("@/services/image-storage");
                optimizedUrl = await imageToDataUrl({ url: currentCover, dataUrl: currentCover });
            }

            // 附加强制提取画廊标题、分类与标签的指令
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
                form.setFieldValue("prompt", chunk);
            });

            const currentTitle = form.getFieldValue("title") || initialData?.title || "";
            const parsed = extractGalleryPromptAndTitle(streamed, currentTitle);
            setExtractedVersions({
                clean: parsed.cleanPrompt,
                full: parsed.fullReport,
            });
            setPromptMode("clean");

            // 若提取到的分类不在初始列表中，动态注入
            if (!categories.some((c) => c.value === parsed.category)) {
                setCategories((prev) => [{ label: parsed.category, value: parsed.category }, ...prev]);
            }

            form.setFieldsValue({
                prompt: parsed.cleanPrompt,
                title: parsed.title,
                category: parsed.category,
                tags: parsed.tags,
            });
            setAiTagged(true);
            message.success("✨ 已成功提纯提示词，并由 AI 自动完成分类与打标！");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "视觉提纯失败，请检查网络或模型配置");
        } finally {
            setExtracting(false);
        }
    };

    const handlePromptModeChange = (mode: "clean" | "full") => {
        setPromptMode(mode);
        if (extractedVersions) {
            form.setFieldValue("prompt", mode === "clean" ? extractedVersions.clean : extractedVersions.full);
        }
    };

    const handlePublish = async () => {
        try {
            const values = await form.validateFields();
            if (!token) {
                message.error("请先登录管理员账号");
                return;
            }
            if (!values.coverUrl) {
                message.error("作品必须包含有效的封面图片");
                return;
            }
            setSubmitting(true);
            await saveAdminPrompt(token, {
                title: values.title.trim(),
                coverUrl: values.coverUrl.trim(),
                prompt: (values.prompt || "").trim(),
                category: values.category || "人物写真",
                tags: values.tags || [],
            });
            message.success("作品已成功发布到画廊！");
            notification.success({
                message: "发布成功",
                description: (
                    <div className="flex flex-col gap-2">
                        <span>《{values.title}》已同步上线至公共画廊，访客可浏览并经由社群引流解锁。</span>
                        <Button
                            type="link"
                            size="small"
                            className="!p-0 !h-auto flex items-center gap-1 font-semibold"
                            onClick={() => window.open("/prompts", "_blank")}
                        >
                            <span>前往画廊查看</span>
                            <ExternalLink className="size-3" />
                        </Button>
                    </div>
                ),
                duration: 6,
            });
            onSuccess?.();
            onClose();
        } catch (error) {
            if (error instanceof Error) {
                message.error(error.message);
            }
        } finally {
            setSubmitting(false);
        }
    };

    const coverUrl = Form.useWatch("coverUrl", form) || initialData?.coverUrl || "";

    return (
        <Modal
            open={open}
            onCancel={onClose}
            title={
                <div className="flex items-center gap-2 text-base font-semibold">
                    <Sparkles className="size-5 text-amber-500" />
                    <span>一键发布作品到画廊</span>
                </div>
            }
            width={680}
            footer={
                <div className="flex items-center justify-between">
                    <span className="text-xs text-stone-400">发布后将立即在公共画廊展示</span>
                    <Space>
                        <Button onClick={onClose} disabled={submitting}>取消</Button>
                        <Button type="primary" onClick={handlePublish} loading={submitting} icon={<Sparkles className="size-3.5" />}>
                            立即发布
                        </Button>
                    </Space>
                </div>
            }
            destroyOnHidden
        >
            <Form form={form} layout="vertical" className="mt-3">
                {coverUrl ? (
                    <div className="mb-4 flex items-center gap-3.5 rounded-xl border border-stone-200/80 bg-stone-50/80 p-3 dark:border-stone-800 dark:bg-stone-900/60">
                        <img
                            src={coverUrl}
                            alt="封面预览"
                            className="size-16 rounded-lg object-cover shadow-sm border border-stone-200 dark:border-stone-700"
                        />
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                <UploadCloud className="size-3.5" />
                                <span>已绑定 MinIO 云端持久化存储</span>
                            </div>
                            <div className="mt-0.5 truncate text-[11px] text-stone-400 font-mono">
                                {coverUrl}
                            </div>
                        </div>
                    </div>
                ) : null}

                {/* 智能检测：提示词为修改意见时的提醒横幅与醒目直达按钮 */}
                {deltaCheck.isDelta && !extracting ? (
                    <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-300/90 bg-amber-50/90 p-3.5 shadow-sm dark:border-amber-800/80 dark:bg-amber-950/60">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                            <Sparkles className="mt-0.5 size-4 shrink-0 text-amber-500 animate-pulse" />
                            <div>
                                <div className="text-xs font-semibold text-amber-950 dark:text-amber-200">
                                    当前提示词为过程微调指令（命中：“{deltaCheck.matchedKeyword}”）
                                </div>
                                <p className="mt-0.5 text-[11px] text-amber-800/80 dark:text-amber-300/80">
                                    过程意见直接发布无法独立复现。点击右侧按钮，后台将自动调用 7 维视觉解剖模型提纯。
                                </p>
                            </div>
                        </div>
                        <Button
                            type="primary"
                            size="middle"
                            loading={extracting}
                            icon={<Sparkles className="size-4" />}
                            onClick={handleAutoExtractPrompt}
                            className="shrink-0 !border-none !bg-amber-500 font-semibold !text-stone-950 shadow-sm hover:!bg-amber-400 dark:!bg-amber-400 dark:hover:!bg-amber-300 transition"
                        >
                            立即一键提纯
                        </Button>
                    </div>
                ) : null}

                <Form.Item name="coverUrl" hidden>
                    <Input />
                </Form.Item>

                <Form.Item
                    name="title"
                    label="作品标题"
                    rules={[{ required: true, message: "请输入作品标题" }]}
                >
                    <Input placeholder="例如：7维解剖 · 清冷未来主义机能少女" maxLength={80} showCount />
                </Form.Item>

                <div className="grid grid-cols-2 gap-3">
                    <Form.Item
                        name="category"
                        label={
                            <div className="flex items-center gap-1.5">
                                <span>所属分类</span>
                                {aiTagged ? (
                                    <Tag color="cyan" className="m-0 text-[10px] leading-4 border-0">
                                        ✨ AI识别推荐
                                    </Tag>
                                ) : null}
                            </div>
                        }
                        rules={[{ required: true, message: "请选择或输入分类" }]}
                    >
                        <Select
                            placeholder="选择或输入分类"
                            options={categories}
                        />
                    </Form.Item>

                    <Form.Item
                        name="tags"
                        label={
                            <div className="flex items-center gap-1.5">
                                <span>标签</span>
                                {aiTagged ? (
                                    <Tag color="cyan" className="m-0 text-[10px] leading-4 border-0">
                                        ✨ AI自动提炼
                                    </Tag>
                                ) : null}
                            </div>
                        }
                    >
                        <Select
                            mode="tags"
                            placeholder="输入标签后回车（如：机能风）"
                            maxTagCount={5}
                        />
                    </Form.Item>
                </div>

                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-stone-900 dark:text-stone-100">
                                <span className="text-red-500 mr-1">*</span>生成提示词 (Prompt)
                            </span>
                            {extractedVersions ? (
                                <Segmented
                                    size="small"
                                    value={promptMode}
                                    onChange={(val) => handlePromptModeChange(val as "clean" | "full")}
                                    options={[
                                        { label: "纯文生图 Prompt", value: "clean" },
                                        { label: "完整7维拆解报告", value: "full" },
                                    ]}
                                />
                            ) : null}
                        </div>
                        <Button
                            size="small"
                            loading={extracting}
                            icon={<Sparkles className="size-3.5 text-amber-600 dark:text-amber-400" />}
                            onClick={handleAutoExtractPrompt}
                            className="flex items-center gap-1.5 border border-amber-300/90 bg-amber-50/90 px-3 py-1 font-medium text-amber-700 shadow-sm hover:border-amber-400 hover:bg-amber-100 hover:text-amber-800 dark:border-amber-700/80 dark:bg-amber-950/70 dark:text-amber-300 dark:hover:bg-amber-900 transition"
                        >
                            {extracting ? "正在 7 维解构画面中..." : "✨ 智能提取工业级 Prompt"}
                        </Button>
                    </div>
                    <Form.Item
                        name="prompt"
                        rules={[{ required: true, message: "请输入提示词" }]}
                        extra="提示词将自动受到 Telegram 社群毛玻璃遮罩保护，引导访客入群解锁"
                        className="mb-0"
                    >
                        <Input.TextArea
                            rows={7}
                            placeholder="输入适用于 Midjourney / SD / DALL-E / Flux 的完整生成提示词..."
                            className="font-mono text-xs leading-relaxed"
                        />
                    </Form.Item>
                </div>
            </Form>
        </Modal>
    );
}
