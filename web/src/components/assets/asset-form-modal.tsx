"use client";

import { ChevronDown, Copy, Sparkles, Upload } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { App, AutoComplete, Button, Form, Input, Modal, Select, Space, Tag, Typography } from "antd";
import { useEffectiveConfig } from "@/stores/use-config-store";
import { extractAssetMetaFromImage, DEFAULT_ASSET_CATEGORIES } from "@/services/ai-asset-extractor";

import { formatBytes, readFileAsDataUrl } from "@/lib/image-utils";
import { uploadAssetMediaFile } from "@/services/file-storage";
import { uploadImage } from "@/services/image-storage";
import { useAssetStore, type Asset, type AssetKind, type AudioAsset, type ImageAsset, type VideoAsset } from "@/stores/use-asset-store";

type AssetFormValues = {
    kind: AssetKind;
    title: string;
    coverUrl: string;
    tags: string[];
    category?: string;
    source?: string;
    content?: string;
    prompt?: string;
};

type ImageDraft = ImageAsset["data"] | null;
type MediaDraft = VideoAsset["data"] | AudioAsset["data"] | null;

type AssetFormModalProps = {
    open: boolean;
    asset?: Asset | null;
    onClose: () => void;
};

export function AssetFormModal({ open, asset = null, onClose }: AssetFormModalProps) {
    const { message } = App.useApp();
    const effectiveConfig = useEffectiveConfig();
    const [form] = Form.useForm<AssetFormValues>();
    const coverInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const mediaInputRef = useRef<HTMLInputElement>(null);
    const assets = useAssetStore((state) => state.assets);
    const addAsset = useAssetStore((state) => state.addAsset);
    const updateAsset = useAssetStore((state) => state.updateAsset);
    const [formKind, setFormKind] = useState<AssetKind>("text");
    const [extracting, setExtracting] = useState(false);
    const [imageDraft, setImageDraft] = useState<ImageDraft>(null);
    const [mediaDraft, setMediaDraft] = useState<MediaDraft>(null);
    const coverUrl = Form.useWatch("coverUrl", form) || "";
    const title = Form.useWatch("title", form) || "";
    const tags = Form.useWatch("tags", form) || [];
    const category = Form.useWatch("category", form) || "";
    const content = Form.useWatch("content", form) || "";
    const prompt = Form.useWatch("prompt", form) || "";

    useLayoutEffect(() => {
        if (!open) return;
        setFormKind(asset?.kind || "text");
        setImageDraft(asset?.kind === "image" ? asset.data : null);
        setMediaDraft(asset?.kind === "video" || asset?.kind === "audio" ? asset.data : null);
        const initialPrompt = (typeof asset?.metadata?.prompt === "string" ? asset.metadata.prompt : "") || (asset?.kind === "text" ? asset.data.content : "");
        form.setFieldsValue(asset ? {
            kind: asset.kind,
            title: asset.title,
            coverUrl: asset.coverUrl,
            tags: asset.tags || [],
            category: asset.category,
            source: asset.source,
            content: asset.kind === "text" ? asset.data.content : asset.kind === "image" ? asset.data.dataUrl : asset.data.url,
            prompt: initialPrompt,
        } : { kind: "text", title: "", coverUrl: "", tags: [], category: "", source: "手动添加", content: "", prompt: "" });
    }, [asset, form, open]);

    const saveAsset = async () => {
        const values = await form.validateFields();
        const base = {
            title: values.title.trim(),
            coverUrl: values.coverUrl?.trim() || (values.kind === "image" && imageDraft ? imageDraft.dataUrl : ""),
            tags: values.tags || [],
            category: values.category?.trim(),
            source: values.source?.trim(),
            metadata: {
                ...(asset?.metadata || {}),
                source: values.source?.trim() || asset?.metadata?.source || "manual",
                prompt: values.prompt?.trim() || (typeof asset?.metadata?.prompt === "string" ? asset.metadata.prompt : ""),
            },
        };

        if (values.kind === "text") {
            const nextAsset = { ...base, kind: "text" as const, data: { content: (values.content || "").trim() } };
            asset ? updateAsset(asset.id, nextAsset) : addAsset(nextAsset);
        } else if (values.kind === "image") {
            const url = (values.content || "").trim();
            if (!imageDraft && !url) {
                message.error("请选择图片文件或填写图片 URL");
                return;
            }
            let data = imageDraft || { dataUrl: url, width: 0, height: 0, bytes: 0, mimeType: "image/*" };
            if (!imageDraft) {
                try {
                    const blob = await (await fetch(url)).blob();
                    const bitmap = await createImageBitmap(blob);
                    data = { dataUrl: url, width: bitmap.width, height: bitmap.height, bytes: blob.size, mimeType: blob.type || "image/*" };
                    bitmap.close();
                } catch {}
            }
            const nextAsset = { ...base, coverUrl: base.coverUrl || data.dataUrl, kind: "image" as const, data };
            asset ? updateAsset(asset.id, nextAsset) : addAsset(nextAsset);
        } else if (values.kind === "video") {
            const url = (values.content || "").trim();
            if (!mediaDraft && !url) {
                message.error("请选择视频文件或填写视频 URL");
                return;
            }
            const data = (mediaDraft as VideoAsset["data"] | null) || { url, width: 0, height: 0, bytes: 0, mimeType: "video/mp4" };
            const nextAsset = { ...base, kind: "video" as const, data };
            asset ? updateAsset(asset.id, nextAsset) : addAsset(nextAsset);
        } else {
            const url = (values.content || "").trim();
            if (!mediaDraft && !url) {
                message.error("请选择音频文件或填写音频 URL");
                return;
            }
            const data = (mediaDraft as AudioAsset["data"] | null) || { url, mimeType: "audio/mpeg" };
            const nextAsset = { ...base, kind: "audio" as const, data };
            asset ? updateAsset(asset.id, nextAsset) : addAsset(nextAsset);
        }

        message.success(asset ? "素材已更新" : "素材已保存");
        onClose();
    };

    const readCoverFile = async (file?: File) => {
        if (!file) return;
        const dataUrl = await readFileAsDataUrl(file);
        form.setFieldValue("coverUrl", dataUrl);
    };

    const readImageFile = async (file?: File) => {
        if (!file || !file.type.startsWith("image/")) return;
        const image = await uploadImage(file);
        const draft = { dataUrl: image.url, storageKey: image.storageKey, width: image.width, height: image.height, bytes: image.bytes, mimeType: image.mimeType };
        setImageDraft(draft);
        form.setFieldValue("content", draft.dataUrl);
        if (!form.getFieldValue("coverUrl")) form.setFieldValue("coverUrl", draft.dataUrl);
        if (!form.getFieldValue("title")) form.setFieldValue("title", file.name);
    };

    const readMediaFile = async (file?: File) => {
        if (!file) return;
        if (formKind === "video" && !file.type.startsWith("video/")) return;
        if (formKind === "audio" && !file.type.startsWith("audio/") && !/\.(mp3|wav)$/i.test(file.name)) return;
        const media = await uploadAssetMediaFile(file, formKind === "audio" ? "asset-audio" : "asset-video");
        const draft = formKind === "audio" ? { url: media.url, storageKey: media.storageKey, bytes: media.bytes, mimeType: media.mimeType } : { url: media.url, storageKey: media.storageKey, width: media.width || 0, height: media.height || 0, bytes: media.bytes, mimeType: media.mimeType };
        setMediaDraft(draft);
        form.setFieldValue("content", media.url);
        if (!form.getFieldValue("title")) form.setFieldValue("title", file.name);
    };

    const handleAutoExtract = async () => {
        const imgSource = coverUrl || (formKind === "image" ? (imageDraft?.dataUrl || content) : "");
        if (!imgSource) {
            message.warning("请先选择图片或填写图片 URL，再使用 AI 智能归纳");
            return;
        }
        try {
            setExtracting(true);
            message.loading({ content: "AI 正在对图片进行 7 维视觉解剖与智能归纳...", key: "asset-ai-extract" });
            const currentTitle = form.getFieldValue("title") || asset?.title || "";
            const parsed = await extractAssetMetaFromImage(imgSource, effectiveConfig, currentTitle);
            form.setFieldsValue({
                title: parsed.title,
                category: parsed.category,
                tags: parsed.tags,
                prompt: parsed.cleanPrompt,
            });
            if (!form.getFieldValue("coverUrl") && imgSource.startsWith("http")) {
                form.setFieldValue("coverUrl", imgSource);
            }
            message.success({ content: "✨ AI 归纳完毕！标题、分类、标签与提示词已自动填充", key: "asset-ai-extract" });
        } catch (err) {
            message.error({ content: err instanceof Error ? err.message : "AI 归纳失败", key: "asset-ai-extract" });
        } finally {
            setExtracting(false);
        }
    };

    return (
            <Modal title={asset ? "编辑素材" : "新增素材"} open={open} width={980} onCancel={onClose} onOk={() => void saveAsset()} okText="保存" cancelText="取消" destroyOnHidden>
                <div className="grid gap-6 pt-1 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <Form form={form} layout="vertical" requiredMark={false} initialValues={{ kind: "text", tags: [] }}>
                        <Form.Item name="kind" label="类型">
                            <Select
                                options={[
                                    { label: "文本", value: "text" },
                                    { label: "图片", value: "image" },
                                    { label: "视频", value: "video" },
                                    { label: "音频", value: "audio" },
                                ]}
                                onChange={(value) => {
                                    setFormKind(value);
                                    setImageDraft(null);
                                    setMediaDraft(null);
                                    form.setFieldValue("content", "");
                                }}
                            />
                        </Form.Item>
                        <Form.Item name="title" label="标题" rules={[{ required: true, message: "请输入标题" }]}>
                            <Input size="large" placeholder="给素材起一个容易检索的名字" />
                        </Form.Item>
                        <Form.Item name="coverUrl" label="封面 URL">
                            <Space.Compact className="w-full">
                                <Input placeholder="可粘贴图片 URL，也可以上传本地封面" />
                                <Button icon={<Upload className="size-3.5" />} onClick={() => coverInputRef.current?.click()}>
                                    上传
                                </Button>
                            </Space.Compact>
                        </Form.Item>
                        <Form.Item name="tags" label="标签">
                            <Select mode="tags" tokenSeparators={[",", "，"]} placeholder="输入标签后回车" />
                        </Form.Item>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Form.Item name="category" label="分类">
                                <AutoComplete
                                    allowClear
                                    suffixIcon={<ChevronDown className="size-3.5" />}
                                    options={Array.from(new Set([...DEFAULT_ASSET_CATEGORIES.map(c => c.value), ...assets.flatMap((item) => item.category ? [item.category] : [])])).map((value) => ({ value }))}
                                    placeholder="选择或输入分类"
                                />
                            </Form.Item>
                            <Form.Item name="source" label="来源">
                                <Input placeholder="手动添加 / 画布 / 素材库" />
                            </Form.Item>
                        </div>
                        <Form.Item
                            name="prompt"
                            label={
                                <div className="flex w-full items-center justify-between">
                                    <span className="font-medium text-stone-700 dark:text-stone-300">生成提示词 / Prompt</span>
                                    <Space size="middle">
                                        {(formKind === "image" || coverUrl) ? (
                                            <Button
                                                type="link"
                                                size="small"
                                                loading={extracting}
                                                icon={<Sparkles className="size-3.5 text-amber-500" />}
                                                onClick={handleAutoExtract}
                                                className="!px-0 text-xs text-amber-600 hover:text-amber-500 dark:text-amber-400"
                                            >
                                                ✨ AI 智能归纳 (自动填标题/分类/标签/Prompt)
                                            </Button>
                                        ) : null}
                                        {prompt ? (
                                            <Button
                                                type="link"
                                                size="small"
                                                icon={<Copy className="size-3 text-stone-400" />}
                                                onClick={() => {
                                                    navigator.clipboard.writeText(prompt);
                                                    message.success("已复制提示词");
                                                }}
                                                className="!px-0 text-xs text-stone-500 hover:text-stone-700 dark:text-stone-400"
                                            >
                                                复制
                                            </Button>
                                        ) : null}
                                    </Space>
                                </div>
                            }
                        >
                            <Input.TextArea
                                rows={4}
                                placeholder="该素材关联的生图提示词、风格设定或视觉描述（支持点击上方 AI 一键反推提取）"
                            />
                        </Form.Item>
                        {formKind === "text" ? (
                            <Form.Item name="content" label="文本内容" rules={[{ required: true, message: "请输入文本内容" }]}>
                                <Input.TextArea rows={8} placeholder="保存提示词、说明文案、参考描述等文本素材" />
                            </Form.Item>
                        ) : (
                            <Form.Item name="content" label={formKind === "image" ? "图片内容" : formKind === "video" ? "视频内容" : "音频内容"} required>
                                <div className="rounded-lg border border-dashed border-stone-300 p-4 dark:border-stone-700">
                                    <Space.Compact className="w-full">
                                        <Input placeholder={formKind === "image" ? "填写图片 URL，或选择本地图片文件" : formKind === "video" ? "填写视频 URL，或选择本地视频文件" : "填写音频 URL，或选择本地音频文件"} />
                                        <Button icon={<Upload className="size-4" />} onClick={() => (formKind === "image" ? imageInputRef.current?.click() : mediaInputRef.current?.click())}>
                                            上传
                                        </Button>
                                    </Space.Compact>
                                    <div className="mt-2">
                                        {formKind === "image" && imageDraft ? (
                                            <Typography.Text type="secondary" className="text-xs">
                                                {imageDraft.width}x{imageDraft.height} · {formatBytes(imageDraft.bytes)}
                                            </Typography.Text>
                                        ) : (formKind === "video" || formKind === "audio") && mediaDraft ? (
                                            <Typography.Text type="secondary" className="text-xs">
                                                {"width" in mediaDraft ? `${mediaDraft.width}x${mediaDraft.height} · ` : ""}{typeof mediaDraft.bytes === "number" ? formatBytes(mediaDraft.bytes) : ""} · {mediaDraft.mimeType}
                                            </Typography.Text>
                                        ) : (
                                            <Typography.Text type="secondary" className="text-xs">
                                                未选择文件
                                            </Typography.Text>
                                        )}
                                    </div>
                                </div>
                            </Form.Item>
                        )}
                    </Form>
                    <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 dark:border-stone-800 dark:bg-stone-950">
                        <Typography.Text strong>预览</Typography.Text>
                        <div className="mt-3 overflow-hidden rounded-lg border border-stone-200 bg-background dark:border-stone-800">
                            {coverUrl || imageDraft?.dataUrl ? (
                                <img src={coverUrl || imageDraft?.dataUrl} alt="" className="aspect-[4/3] w-full object-cover" />
                            ) : formKind === "video" && (mediaDraft?.url || content) ? (
                                <video src={mediaDraft?.url || content} className="aspect-[4/3] w-full bg-black object-contain" controls />
                            ) : formKind === "audio" && (mediaDraft?.url || content) ? (
                                <div className="flex aspect-[4/3] items-center justify-center bg-stone-100 p-5 dark:bg-stone-900"><audio src={mediaDraft?.url || content} controls className="w-full" /></div>
                            ) : (
                                <div className="flex aspect-[4/3] items-center justify-center bg-stone-100 p-5 text-center text-sm text-stone-500 dark:bg-stone-900">{content || "暂无封面"}</div>
                            )}
                            <div className="p-4">
                                {category ? (
                                    <Tag color="purple" className="mb-2">
                                        {category}
                                    </Tag>
                                ) : null}
                                <Typography.Text strong ellipsis className="block text-sm">
                                    {title || "未命名素材"}
                                </Typography.Text>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                    {tags.length ? (
                                        tags.map((tag) => (
                                            <Tag key={tag} className="m-0 text-xs">
                                                {tag}
                                            </Tag>
                                        ))
                                    ) : (
                                        <Tag className="m-0 text-xs">未打标签</Tag>
                                    )}
                                </div>
                                {prompt ? (
                                    <div className="mt-3 rounded-lg border border-stone-200/80 bg-stone-100/80 p-2.5 dark:border-stone-800 dark:bg-stone-900/60">
                                        <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-stone-500 dark:text-stone-400">
                                            <span>提示词 (Prompt)</span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(prompt);
                                                    message.success("已复制提示词");
                                                }}
                                                className="flex items-center gap-1 hover:text-stone-900 dark:hover:text-stone-200"
                                            >
                                                <Copy className="size-3" />
                                                <span>复制</span>
                                            </button>
                                        </div>
                                        <div className="max-h-24 overflow-y-auto text-xs font-mono leading-relaxed text-stone-700 select-all dark:text-stone-300 whitespace-pre-wrap">
                                            {prompt}
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </div>
                <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                        void readCoverFile(event.target.files?.[0]);
                        event.target.value = "";
                    }}
                />
                <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                        void readImageFile(event.target.files?.[0]);
                        event.target.value = "";
                    }}
                />
                <input
                    ref={mediaInputRef}
                    type="file"
                    accept={formKind === "audio" ? "audio/mpeg,audio/wav,audio/x-wav,.mp3,.wav" : "video/*"}
                    className="hidden"
                    onChange={(event) => {
                        void readMediaFile(event.target.files?.[0]);
                        event.target.value = "";
                    }}
                />
            </Modal>

    );
}
