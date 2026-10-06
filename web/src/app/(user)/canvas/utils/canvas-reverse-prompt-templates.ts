export type ReversePromptTemplate = {
    id: string;
    name: string;
    description?: string;
    prompt: string;
    isDefault?: boolean;
};

export const DEFAULT_REVERSE_PROMPT_TEMPLATES: ReversePromptTemplate[] = [
    {
        id: "cot-7d-high-fidelity",
        name: "7维解剖拆解 (极致还原)",
        description: "先对机位、解剖、受力接触点、材质物理等做7维中文解构，再生成高还原度英文Prompt",
        prompt: `你是一位顶级 AI 图像逆向工程专家与资深视觉艺术总监。请对这张参考图进行「解剖级视觉逆向拆解」，并输出一份可直接在 Midjourney / FLUX / SD 达到极高还原度的英文纯文生图 Prompt。

请严格执行以下两步：

### 第一步：7 维底层视觉解构（中文输出）

1. 媒介与摄影机位：画幅比例（如 9:16）、画质媒介（如 35mm 胶片大片/80年代赛璐珞/油画）、景别与镜头视角（如 微仰拍、平视、特定焦段）。
2. 人物解剖与神态：性别年龄感、骨相五官、发型碎发走势、视线焦点（是否直视/半睁）、嘴唇与面部微表情。
3. 肢体动作与接触点（重中之重）：手部摆放位置、手指形态、指尖与面部/道具的精确触碰点与受力关系。
4. 服饰造型与材质物理：服装结构、布料光泽与透明度（如 欧根纱/乳胶/缎面/PVC）、立体头饰或配饰的结构形态与盘绕路径。
5. 空间构图与前后层级：前景遮挡物、中景主体、背景环境的层叠关系。
6. 色彩与光影系统：精准色彩名（拒绝笼统色，指明黄油黄/薄荷绿/群青/洋红等）、光源类型（大柔光箱/硬光/逆光）、高光与阴影落点（如 鼻尖与缎带边缘的硬反光）。
7. 画面文字排版（若有）：文字语言、排版层级、字体风格及遮挡关系。

### 第二步：工业级英文提示词组装（英文输出）

将上述所有细节组装为一段连续、具象、高信息密度的英文 Prompt：

- 严格遵循：[画幅/媒介/镜头] -> [主体人物/五官/神态] -> [手部精准动态与接触点] -> [服装配饰结构与微观材质] -> [环境/背景] -> [光影与高光细节] -> [画面质感与风格锚点]。
- 严禁空洞形容词（如 beautiful, stunning），全部用具象物理词汇（如 butter-yellow satin ribbons, translucent cream latex opera glove, porcelain glass-skin）。
- 附带针对性的 Negative Prompt（重点排除该风格最容易跑偏的 AI 缺陷）。

### 第三步：画廊元数据提取（中文输出）

- 【作品标题】：[生成一个专业、优美、切中画面核心主题的画廊作品标题，8到18字，严禁写机械标签，如：猫耳头盔亚文化时尚大片、未来机能风清冷少女特写、极简影棚光影视觉大片]
- 【推荐分类】：[提炼 2 到 6 个字最切合画面主题的分类名称，无需拘泥固定词，只要贴切精准即可，如：商业摄影、人物写真、概念艺术、潮玩手办、电影海报、二次元动漫等]
- 【精选标签】：[提炼 3-5 个高精度具象视觉标签，逗号分隔，如：亚文化时尚, 广角低机位, 漆皮厚底鞋, 猫耳头盔, 影棚光影]`,
        isDefault: true,
    },
    {
        id: "official-minimal",
        name: "官方通用生图 (快速出词)",
        description: "官方原版 3 条基本要求，输出简洁提示词，保留模型自由度",
        prompt: `请根据参考图片反推一段适合用于 AI 生图的提示词。

要求：
1. 只输出提示词正文，不要解释。
2. 覆盖主体、构图、风格、光线、色彩、材质、镜头和氛围。
3. 尽量写成可直接用于生图模型的完整提示词。`,
        isDefault: false,
    },
];

export const REVERSE_PROMPT_STORAGE_KEY = "infinite-canvas:reverse_prompt_templates";
export const REVERSE_PROMPT_ACTIVE_ID_KEY = "infinite-canvas:reverse_prompt_active_id";

export function getStoredReversePromptTemplates(): ReversePromptTemplate[] {
    if (typeof window === "undefined") return DEFAULT_REVERSE_PROMPT_TEMPLATES;
    try {
        const stored = window.localStorage.getItem(REVERSE_PROMPT_STORAGE_KEY);
        if (!stored) return DEFAULT_REVERSE_PROMPT_TEMPLATES;
        const parsed = JSON.parse(stored) as unknown;
        if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed as ReversePromptTemplate[];
        }
    } catch {
        // Fallback to default templates
    }
    return DEFAULT_REVERSE_PROMPT_TEMPLATES;
}

export function saveStoredReversePromptTemplates(templates: ReversePromptTemplate[]) {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(REVERSE_PROMPT_STORAGE_KEY, JSON.stringify(templates));
    } catch {
        // Ignore quota/permission errors
    }
}

export function getActiveReversePromptTemplateId(): string {
    if (typeof window === "undefined") return DEFAULT_REVERSE_PROMPT_TEMPLATES[0].id;
    try {
        const active = window.localStorage.getItem(REVERSE_PROMPT_ACTIVE_ID_KEY);
        if (active) return active;
    } catch {
        // Fallback
    }
    return DEFAULT_REVERSE_PROMPT_TEMPLATES[0].id;
}

export function setActiveReversePromptTemplateId(id: string) {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(REVERSE_PROMPT_ACTIVE_ID_KEY, id);
    } catch {
        // Ignore
    }
}

export function getActiveReversePromptTemplate(): ReversePromptTemplate {
    const templates = getStoredReversePromptTemplates();
    const activeId = getActiveReversePromptTemplateId();
    return templates.find((t) => t.id === activeId) || templates[0] || DEFAULT_REVERSE_PROMPT_TEMPLATES[0];
}
