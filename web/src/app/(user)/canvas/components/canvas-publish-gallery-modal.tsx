"use client";

import { useEffect, useState, useMemo } from "react";
import { App, Button, Form, Input, Modal, Select, Space, Segmented, Tag } from "antd";
import { ExternalLink, Sparkles, UploadCloud, Tag as TagIcon, Layers } from "lucide-react";
import { saveAdminPrompt } from "@/services/api/admin";
import { useUserStore } from "@/stores/use-user-store";
import { useEffectiveConfig } from "@/stores/use-config-store";
import {
    checkProcessOrDeltaPrompt,
    DEFAULT_ASSET_CATEGORIES,
    extractAssetMetaFromImage,
} from "@/services/ai-asset-extractor";

export type PublishGalleryData = {
    title: string;
    coverUrl: string;
    prompt: string;
    category?: string;
    tags?: string[];
};

const DEFAULT_CATEGORIES = DEFAULT_ASSET_CATEGORIES;

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
            const currentTitle = form.getFieldValue("title") || initialData?.title || "";
            const parsed = await extractAssetMetaFromImage(
                currentCover,
                effectiveConfig,
                currentTitle,
                (streamed) => {
                    form.setFieldValue("prompt", streamed);
                },
            );

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
