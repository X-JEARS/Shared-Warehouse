# 系统设置页面实现计划

## 概述
在"我的"页面添加"系统设置"菜单项，点击进入系统设置页面，包含系统语言（仅入口）和系统主题切换功能。

## 实现步骤

### 1. 创建主题 Store (`client/src/stores/themeStore.ts`)
- 使用 Zustand + persist 中间件，持久化主题选择到 localStorage
- 支持三种主题模式：`light`（浅色）、`dark`（深色）、`system`（跟随系统）
- 提供 `setTheme` action 和 `effectiveTheme` 计算属性（system 模式下根据 `prefers-color-scheme` 媒体查询决定实际主题）
- 监听系统主题变化（`matchMedia` + `change` 事件），自动响应系统主题切换
- 初始化时根据存储的主题立即应用 CSS 变量

### 2. 创建全局主题 CSS (`client/src/styles/theme.css`)
- 定义浅色主题和深色主题的 CSS 自定义属性，覆盖 Ant Design Mobile 的 `--adm-*` 变量和应用自身的颜色变量
- 浅色主题：基于 antd-mobile 默认值
- 深色主题：基于 antd-mobile `theme-dark.css`，同时补充应用级别的变量（`--app-color-bg`、`--app-color-surface` 等）
- 通过 `html[data-theme='light']` 和 `html[data-theme='dark']` 选择器控制

### 3. 创建系统设置页面 (`client/src/pages/SystemSettings.tsx`)
- 使用统一子页面 Header 模式（← 返回按钮 + 标题"系统设置"）
- **系统语言**：显示当前语言"简体中文"，带 `>` 箭头，点击弹出 Toast 提示"暂未开放"
- **系统主题**：
  - 三个选项：浅色模式 / 深色模式 / 跟随系统
  - 当前选中项右侧显示 ✓ 勾选标记
  - 点击切换主题，立即生效
  - 在"跟随系统"选项右侧显示当前系统主题状态（如"当前：浅色"）

### 4. 更新 Profile 页面 (`client/src/pages/Profile.tsx`)
- 在"我的预约"下方添加"系统设置"菜单项，使用 `SetOutline` 图标
- 点击导航到 `/system-settings`

### 5. 注册路由 (`client/src/App.tsx`)
- 添加 `/system-settings` 路由，使用 PrivateRoute 保护

### 6. 在 main.tsx 中引入主题 CSS
- 在 global.css 之前引入 `theme.css`
- 初始化主题 Store 以在应用启动时立即应用主题

### 7. 更新 global.css
- 将硬编码的 `background-color: #f5f5f5` 改为 CSS 变量 `var(--app-color-bg, #f5f5f5)`

## 主题变量体系
```
--app-color-primary     主色
--app-color-bg          页面背景（#f5f5f5 / #111）
--app-color-surface     卡片/面板背景（#fff / #1a1a1a）
--app-color-text        主文本色（#333 / #e6e6e6）
--app-color-text-secondary 次要文本（#999 / #808080）
--app-color-border      边框色（#f0f0f0 / #2b2b2b）
--app-color-hover       悬停/按压背景（#f9f9f9 / #222）
```

## 文件变更清单
| 操作 | 文件 |
|------|------|
| 新建 | `client/src/stores/themeStore.ts` |
| 新建 | `client/src/styles/theme.css` |
| 新建 | `client/src/pages/SystemSettings.tsx` |
| 修改 | `client/src/pages/Profile.tsx` |
| 修改 | `client/src/App.tsx` |
| 修改 | `client/src/main.tsx` |
| 修改 | `client/src/styles/global.css` |
