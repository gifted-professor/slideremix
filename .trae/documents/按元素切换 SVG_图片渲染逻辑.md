## 目标

* 初始生成“全量 SVG”版本（文本与形状均以 SVG 渲染，图片元素以 SVG 占位渲染）。

* 用户可对任一元素切换为“图片渲染”，生成并替换该元素为位图图片。

* 无 API Key 时使用原图裁剪生成位图；有 API Key 时提供“AI 重绘图片”选项。

## 用户体验与流程

* 上传后直接看到 SVG 复刻画布（当前已有的矢量/文本 + 图片元素的占位框）。

* 悬浮或选中元素时显示工具条：

  * 切换渲染模式：`SVG ↔ 图片`

  * 在图片模式下：`来源选择`（裁剪原图 / AI 重绘，若有 Key）。

* 右侧 JSON 与预览联动展示当前模式与效果，导出 PPTX 时图片元素嵌入位图。

## 数据与状态

* 新增（UI 层）状态：`elementRenderModeMap: Record<string, 'svg' | 'image'>`，默认全部为 `svg`。

* 新增（UI 层）缓存：`imageByElementId: Record<string, { url: string; base64?: string }>` 存放生成的位图结果。

* 在 `App.tsx` 保存 `base64Original`（来自 `fileToGenerativePart`）与原图 `naturalWidth/naturalHeight` 以便裁剪。

* 坐标映射：以 1000×562.5 为基准，换算到原图像素：`pxX = x * (naturalWidth / 1000)`，`pxY = y * (naturalHeight / 562.5)`，宽高同理。

## 图像生成策略

* 裁剪原图（无 Key 或默认）：

  * 新增 `services/imageCrop.ts`：使用 `HTMLImageElement` + `Canvas` 在客户端裁剪，输出 `blob URL` 与可选 `base64`。

* AI 重绘（有 Key）：

  * 在 `services/geminiService.ts` 新增 `remixElementImage(element, base64Original, apiKey)`：

    * 传入元素语义 `semantic_desc`、风格 `style`、裁剪区域的图像（作为参考），请求图像生成模型（如支持的图像生成端点），返回 `image/png` base64。

  * 若生成失败，回退到裁剪原图。

## 组件改造

* `App.tsx`

  * 保存 `base64Original` 与原图尺寸（加载 `file` 得到 `naturalWidth/Height`）。

  * 维护 `elementRenderModeMap` 与 `imageByElementId`；将这些作为 props 传给 `SlideRenderer`。

  * 导出 PPTX：

    * 当元素为图片模式且有缓存图片：使用 `slide.addImage({ data: base64, x, y, w, h })`；否则维持现有 SVG/文本逻辑。

* `components/SlideRenderer.tsx`

  * 仍以 SVG 渲染文本和几何形状。

  * 对于图片模式的元素：在相同坐标位置渲染 `<img>`（`absolute` 叠放或 `<foreignObject>`，前者更简单稳定），尺寸按同一缩放规则。

  * 元素工具条：提供切换与来源选择，触发裁剪/AI 重绘并写入缓存。

* `components/Sidebar.tsx`

  * 可选新增全局设置：默认渲染策略（全部 SVG / 自动识别），仅影响初值。

## 类型与协议

* 保持现有 `SlideData` 与 `SlideElement` 结构不变（不改服务端/模型协议），渲染模式作为 UI 层状态管理。

* 如需持久化用户选择，可在本地 `localStorage` 记录 `elementRenderModeMap`。

## 错误处理与降级

* 无 API Key：禁用 AI 重绘按钮，仅显示裁剪选项。

* 生成失败：提示并回退到 SVG 或已缓存的图片版本。

* 坐标越界或裁剪空白：显示占位提示并保留 SVG。

## 变更清单（文件级）

1. 新增 `services/imageCrop.ts`：裁剪并返回 `blob URL` 与 base64。
2. 修改 `App.tsx`：引入新状态与 PPTX 导出图片分支。
3. 修改 `components/SlideRenderer.tsx`：添加元素工具条与图片渲染分支。
4. 修改 `services/geminiService.ts`：新增 `remixElementImage`（仅当启用 AI 重绘）。
5. （可选）修改 `components/Sidebar.tsx`：默认渲染策略设置。

## 验证

* 上传一张含图片与形状的幻灯片截图：初始显示全量 SVG。

* 切换某图片元素为“图片渲染”，选择“裁剪原图”，应立即替换为位图。

* 在填入有效 API Key 后，选择“AI 重绘”，应生成新图片并替换元素。

* 导出 PPTX，确认图片元素作为位图嵌入，其余仍为矢量文本/形状。

