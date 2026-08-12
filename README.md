# Reference HTML PPTX Skills

一组配套使用的 Codex Skills，用于根据背景图、设计参考图和页面文案生成 16:9 HTML 幻灯片，并导出结构化可编辑的 PowerPoint 文件。

当前 `reference-html-pptx` 设计工作流版本：**2.2.0**。

## 包含内容

- `reference-html-pptx/`：先完成结论提炼、语义关系建模、版式决策和线框构图，再设计单页或多页 HTML、标记可编辑结构并完成视觉验收。
- `export-editable-pptx/`：将 HTML 中的文字、标记形状、线条、箭头和连接器重建为 PowerPoint 原生对象；复杂视觉保留为背景。

## 2.1.0 更新

- 多页 HTML 使用独立预览壳、灰色网页画布、明确页间距、边界阴影和滚动吸附，连续浏览时不再粘连。
- 固定以 1600×900 作为设计与导出的统一坐标系，小屏幕只缩放整页，不改变内部字号和布局。
- 建立标题、正文、注释等字号下限，以及卡片内容利用率和页面内容占用率规范。
- 检查器会输出逐页截图与连续滚动截图，并自动拦截页面黏连、字号过小、文本溢出和极端空卡片。

## 2.2.0 更新

- 新增参考图驱动的视觉令牌：颜色角色、字体层级、圆角、边界、阴影、图标语言和间距节奏先统一再写 CSS。
- 新增强调预算与组件职责，避免所有对象同时变红、卡片化或叠加多重视觉效果。
- 新增 `visual-craft.md`，规范边界克制、阴影材料、图标一致性和文字微排版，同时允许参考图覆盖默认建议。
- 新增设计计划审计器，并在 HTML 检查中提示主焦点缺失、组件词汇过载和强调对象过多。

## 安装

将两个目录复制到 Codex Skills 目录：

```powershell
Copy-Item -Recurse -Force '.\reference-html-pptx' "$env:USERPROFILE\.codex\skills\reference-html-pptx"
Copy-Item -Recurse -Force '.\export-editable-pptx' "$env:USERPROFILE\.codex\skills\export-editable-pptx"
```

`export-editable-pptx` 在首次运行时会依据 `scripts/package.json` 安装所需 Node.js 依赖，仓库不提交 `node_modules`。

## 使用示例

```text
使用 $reference-html-pptx，根据我提供的无字背景图、页面设计参考图和多页文案，
在一个 index.html 中生成 16:9 幻灯片，并导出结构可编辑的 PPTX。
```

## 可编辑范围

- DOM 文字：原生 PowerPoint 文本框。
- 标记过的卡片、节点和徽章：原生 PowerPoint 形状。
- 标记过的线条、箭头和连接器：原生 PowerPoint 线对象。
- 渐变、蒙版、复杂阴影和插画：作为背景保留视觉效果。

详细约束分别见两个目录中的 `SKILL.md`。

当前 `reference-html-pptx` 设计工作流版本为 **2.0.0**。
