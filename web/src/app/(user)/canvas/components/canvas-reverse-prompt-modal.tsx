"use client";

import { useEffect, useState } from "react";
import { App, Button, Input, Modal, Popconfirm, Space, Tag, Tooltip } from "antd";
import { Check, CheckCircle2, Copy, Plus, RotateCcw, Trash2 } from "lucide-react";
import { DEFAULT_REVERSE_PROMPT_TEMPLATES, getActiveReversePromptTemplateId, getStoredReversePromptTemplates, saveStoredReversePromptTemplates, setActiveReversePromptTemplateId, type ReversePromptTemplate } from "../utils/canvas-reverse-prompt-templates";

const { TextArea } = Input;

export function CanvasReversePromptModal({ open, onClose, onSelectAndRun }: { open: boolean; onClose: () => void; onSelectAndRun?: (template: ReversePromptTemplate) => void }) {
    const { message } = App.useApp();
    const [templates, setTemplates] = useState<ReversePromptTemplate[]>(DEFAULT_REVERSE_PROMPT_TEMPLATES);
    const [activeDefaultId, setActiveDefaultId] = useState<string>(DEFAULT_REVERSE_PROMPT_TEMPLATES[0].id);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>(DEFAULT_REVERSE_PROMPT_TEMPLATES[0].id);

    // Editing draft
    const [draftName, setDraftName] = useState("");
    const [draftDesc, setDraftDesc] = useState("");
    const [draftPrompt, setDraftPrompt] = useState("");

    useEffect(() => {
        if (!open) return;
        const loaded = getStoredReversePromptTemplates();
        const activeId = getActiveReversePromptTemplateId();
        setTemplates(loaded);
        setActiveDefaultId(activeId);
        const initialSelected = loaded.find((t) => t.id === activeId) || loaded[0];
        if (initialSelected) {
            setSelectedTemplateId(initialSelected.id);
            setDraftName(initialSelected.name);
            setDraftDesc(initialSelected.description || "");
            setDraftPrompt(initialSelected.prompt);
        }
    }, [open]);

    const handleSelectTemplate = (tpl: ReversePromptTemplate) => {
        // save current draft back into templates list before switching
        setTemplates((prev) => prev.map((item) => (item.id === selectedTemplateId ? { ...item, name: draftName.trim() || item.name, description: draftDesc.trim(), prompt: draftPrompt } : item)));
        setSelectedTemplateId(tpl.id);
        setDraftName(tpl.name);
        setDraftDesc(tpl.description || "");
        setDraftPrompt(tpl.prompt);
    };

    const handleSetDefault = (id: string) => {
        setActiveDefaultId(id);
        setActiveReversePromptTemplateId(id);
        message.success("已设为默认反推模板");
    };

    const handleAddTemplate = () => {
        const newId = `custom-${Date.now()}`;
        const newTpl: ReversePromptTemplate = {
            id: newId,
            name: `自定义模板 ${templates.length + 1}`,
            description: "用户自定义反推提示词模板",
            prompt: `请分析参考图片的核心要素并生成提示词：\n1. 主体与构图\n2. 风格与光影\n3. 细节材质`,
        };
        const next = [...templates, newTpl];
        setTemplates(next);
        saveStoredReversePromptTemplates(next);
        setSelectedTemplateId(newId);
        setDraftName(newTpl.name);
        setDraftDesc(newTpl.description || "");
        setDraftPrompt(newTpl.prompt);
        message.success("已新建模板");
    };

    const handleDeleteTemplate = (id: string) => {
        if (templates.length <= 1) {
            message.warning("至少保留一个反推模板");
            return;
        }
        const next = templates.filter((item) => item.id !== id);
        setTemplates(next);
        saveStoredReversePromptTemplates(next);
        if (activeDefaultId === id) {
            const nextDefault = next[0].id;
            setActiveDefaultId(nextDefault);
            setActiveReversePromptTemplateId(nextDefault);
        }
        if (selectedTemplateId === id) {
            const nextSelect = next[0];
            setSelectedTemplateId(nextSelect.id);
            setDraftName(nextSelect.name);
            setDraftDesc(nextSelect.description || "");
            setDraftPrompt(nextSelect.prompt);
        }
        message.success("已删除模板");
    };

    const handleResetDefaults = () => {
        setTemplates(DEFAULT_REVERSE_PROMPT_TEMPLATES);
        saveStoredReversePromptTemplates(DEFAULT_REVERSE_PROMPT_TEMPLATES);
        const defaultId = DEFAULT_REVERSE_PROMPT_TEMPLATES[0].id;
        setActiveDefaultId(defaultId);
        setActiveReversePromptTemplateId(defaultId);
        setSelectedTemplateId(defaultId);
        setDraftName(DEFAULT_REVERSE_PROMPT_TEMPLATES[0].name);
        setDraftDesc(DEFAULT_REVERSE_PROMPT_TEMPLATES[0].description || "");
        setDraftPrompt(DEFAULT_REVERSE_PROMPT_TEMPLATES[0].prompt);
        message.success("已恢复内置默认模板");
    };

    const handleSave = () => {
        const currentName = draftName.trim();
        if (!currentName) {
            message.error("模板名称不能为空");
            return;
        }
        if (!draftPrompt.trim()) {
            message.error("提示词内容不能为空");
            return;
        }

        const next = templates.map((item) => (item.id === selectedTemplateId ? { ...item, name: currentName, description: draftDesc.trim(), prompt: draftPrompt } : item));
        setTemplates(next);
        saveStoredReversePromptTemplates(next);
        setActiveReversePromptTemplateId(activeDefaultId);
        message.success("反推模板配置已保存");
        onClose();
    };

    const handleApplyAndRun = () => {
        const currentName = draftName.trim() || "反推提示词";
        const updatedTpl: ReversePromptTemplate = {
            id: selectedTemplateId,
            name: currentName,
            description: draftDesc.trim(),
            prompt: draftPrompt,
        };
        const next = templates.map((item) => (item.id === selectedTemplateId ? updatedTpl : item));
        setTemplates(next);
        saveStoredReversePromptTemplates(next);
        if (onSelectAndRun) {
            onSelectAndRun(updatedTpl);
        }
        onClose();
    };

    return (
        <Modal
            title={
                <div className="flex items-center justify-between pr-8">
                    <span className="font-semibold text-base">反推提示词模板管理</span>
                    <Button size="small" type="text" icon={<RotateCcw className="size-3.5" />} onClick={handleResetDefaults}>
                        恢复内置预设
                    </Button>
                </div>
            }
            open={open}
            onCancel={onClose}
            width={860}
            footer={
                <div className="flex items-center justify-between w-full">
                    <div className="text-xs text-neutral-400">支持灵活配置与切换多个反推提示词模板</div>
                    <Space>
                        <Button onClick={onClose}>取消</Button>
                        {onSelectAndRun ? (
                            <Button type="primary" ghost onClick={handleApplyAndRun}>
                                使用当前模板反推
                            </Button>
                        ) : null}
                        <Button type="primary" onClick={handleSave}>
                            保存并应用
                        </Button>
                    </Space>
                </div>
            }
        >
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 py-2" style={{ minHeight: "440px" }}>
                {/* Left Template List */}
                <div className="md:col-span-4 border-r border-neutral-200 dark:border-neutral-800 pr-3 flex flex-col justify-between">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-neutral-500">可用模板 ({templates.length})</span>
                            <Button size="small" type="dashed" icon={<Plus className="size-3" />} onClick={handleAddTemplate}>
                                新增模板
                            </Button>
                        </div>
                        <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
                            {templates.map((tpl) => {
                                const isSelected = tpl.id === selectedTemplateId;
                                const isDefault = tpl.id === activeDefaultId;
                                return (
                                    <div
                                        key={tpl.id}
                                        onClick={() => handleSelectTemplate(tpl)}
                                        className={`group relative flex flex-col p-2.5 rounded-lg cursor-pointer transition-all border ${
                                            isSelected ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400" : "border-transparent hover:bg-neutral-100 dark:hover:bg-neutral-800/60 text-neutral-700 dark:text-neutral-300"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-semibold truncate max-w-[150px]">{tpl.name}</span>
                                            {isDefault ? (
                                                <Tag color="green" className="m-0 text-[10px] leading-4 px-1.5 py-0 border-0">
                                                    默认
                                                </Tag>
                                            ) : null}
                                        </div>
                                        {tpl.description ? <span className="text-[11px] text-neutral-400 mt-1 line-clamp-1">{tpl.description}</span> : null}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Right Template Content Editor */}
                <div className="md:col-span-8 flex flex-col space-y-3 pl-1">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex-1">
                            <label className="text-xs text-neutral-400 block mb-1">模板名称</label>
                            <Input value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="输入模板名称，如：7维解剖拆解" maxLength={30} />
                        </div>
                        <div className="pt-5">
                            {selectedTemplateId === activeDefaultId ? (
                                <Tag icon={<CheckCircle2 className="inline size-3 mr-1" />} color="success" className="px-2 py-1 text-xs">
                                    当前默认模板
                                </Tag>
                            ) : (
                                <Button size="small" onClick={() => handleSetDefault(selectedTemplateId)}>
                                    设为默认
                                </Button>
                            )}
                            {templates.length > 1 && !DEFAULT_REVERSE_PROMPT_TEMPLATES.some((d) => d.id === selectedTemplateId) ? (
                                <Popconfirm title="确认删除该模板？" onConfirm={() => handleDeleteTemplate(selectedTemplateId)} okText="删除" cancelText="取消" okButtonProps={{ danger: true }}>
                                    <Button size="small" danger type="text" icon={<Trash2 className="size-3.5" />} className="ml-1" />
                                </Popconfirm>
                            ) : null}
                        </div>
                    </div>

                    <div>
                        <label className="text-xs text-neutral-400 block mb-1">简短说明</label>
                        <Input value={draftDesc} onChange={(e) => setDraftDesc(e.target.value)} placeholder="输入简要用途说明" maxLength={60} />
                    </div>

                    <div className="flex-1 flex flex-col">
                        <div className="flex items-center justify-between mb-1">
                            <label className="text-xs text-neutral-400">反推指令提示词正文</label>
                            <span className="text-[11px] text-neutral-400">{draftPrompt.length} 字</span>
                        </div>
                        <TextArea
                            value={draftPrompt}
                            onChange={(e) => setDraftPrompt(e.target.value)}
                            placeholder="输入反推提示词的具体任务要求与输出格式规范..."
                            rows={12}
                            className="font-mono text-xs leading-relaxed resize-none"
                            style={{ minHeight: "260px" }}
                        />
                    </div>
                </div>
            </div>
        </Modal>
    );
}
