# 固定资产管理系统

一个基于 PWA 的固定资产管理系统，支持扫码借还物品、多仓库管理、预约系统等功能。

## 技术栈

### 后端
- Node.js + Express + TypeScript
- PostgreSQL 数据库
- JWT 认证

### 前端
- React + TypeScript + Vite
- Ant Design Mobile UI 组件库
- Zustand 状态管理
- i18next + react-i18next 国际化
- @zxing/library 二维码扫描
- PWA 支持

## 快速开始

### 1. 安装依赖

```bash
# 安装后端依赖
cd server
npm install

# 安装前端依赖
cd ../client
npm install
```

### 2. 配置数据库

创建 PostgreSQL 数据库并运行初始化脚本：

```bash
# 创建数据库
createdb warehouse

# 运行初始化脚本
psql -d warehouse -f ../sql/init.sql
```

已有数据库如果同时缺少 `room_admins` 和转移记录相关结构，使用合并升级脚本：

```bash
psql -v ON_ERROR_STOP=1 -d warehouse -f ../sql/upgrade_room_admins_and_transfer_records.sql
```

该脚本可重复执行，不会回填或修改已有业务数据。如果数据库已经有 `room_admins`，也可以继续使用单独的 `sql/migrations/002_transfer_records.sql`。

已有数据库还需要执行 JWT 令牌版本迁移，以支持改密后撤销旧令牌：

```bash
psql -v ON_ERROR_STOP=1 -d warehouse -f ../sql/migrations/add_token_version.sql
```

### 3. 配置环境变量

复制后端环境变量模板并修改：

```bash
cd server
cp .env.example .env
# 编辑 .env 文件，填入数据库连接信息
```

`JWT_SECRET` 为必填项。前后端同域部署时，API 会自动放行同源请求；如果前端单独部署，生产环境必须将 `ALLOWED_ORIGINS` 设置为前端的完整 Origin（包括协议和端口，不要填写路径），多个地址使用英文逗号分隔，例如 `https://warehouse.example.com`。

### 4. 启动服务

```bash
# 启动后端服务（在 server 目录）
npm run dev

# 启动前端开发服务器（在 client 目录，新终端）
npm run dev
```

### 5. 访问应用

打开浏览器访问 http://localhost:5173

## 功能特性

- **多仓库管理**: 用户可以加入多个仓库，查看不同仓库中的物品；加入仓库需管理员审批；支持多管理员（1 名主管理员 + 多名普通管理员），主管理员可转让身份
- **二维码扫描**: 底栏居中的突出绿色圆形扫码按钮（52px），两侧展开标签页：左侧为仓库、预约，右侧为我手中的、我的，扫码按钮上方有弧形装饰（ScanDome）；点击进入批量扫码页面；扫描物品二维码进入批量取走模式，扫描盒子二维码进入批量放入模式；物品可在人与人、人与仓库之间自由流动；支持手电筒照明，高清视频流提升小二维码识别率
- **批量取走/放入**: 扫码后物品自动加入两列待操作列表，支持连续扫描多个物品，一键批量确认取走或放入；物品去重防止重复扫描，已在手中的物品标记排除，超长物品名称省略显示且不会撑宽页面
- **转移清单与照片**: 每次成功取走或放入会生成一条转移清单，并关联本次成功转移的所有物品流水；扫码模式支持随清单上传一张 JPEG、PNG、GIF 或 WebP 原始照片（最大 20MB），系统不裁剪、不压缩、不重编码；操作栏保持单行，左侧为“上传照片”，右侧为“取消”和“取走/放入”
- **参考预约单取还**: 进入取物或归还模式后，可从 Ant Design Mobile 下拉栏选择当前仓库中该用户最近创建的 5 个未取消预约单（包含已结束和未来预约），或继续自由取还；预约物品以一行两个的核对清单显示，并根据手持、扫码、所在仓库等状态显示绿/蓝/黄/红圆点。预约清单不会自动加入操作队列，最终取还仍只提交实际扫码的物品；扫码页关闭该下拉栏动画以避免摄像头渲染导致卡顿
- **物品管理**: 添加物品时扫描物品二维码，支持设置标签和备注名（别名），存放位置默认选择第一个盒子
- **盒子管理**: 添加盒子需扫描或输入二维码（以 box. 开头）并填写名称；盒子以两列网格形式展示，点击盒子可修改名称；删除盒子时若有物品需选择移动目标
- **仓库物品展示**: 物品以自适应网格卡片形式展示，窗口越宽列数越多。在库物品按当前所在盒子分组，离库物品统一显示在"不在库中"分组；完整物品清单进入仓库时加载一次，盒子、标签和名称/备注搜索在前端本地筛选；盒子通过顶部横向切换栏筛选，也可在仓库内容区左右滑动按"全部 → 不在库 → 各盒子"循环切换，标签通过左下角胶囊按钮打开仓库内容区内的可滚动侧栏筛选；桌面端支持鼠标拖动和触控板横向手势，并拦截仓库区域的横向历史导航手势
- **物品在库状态**: 物品卡片显示在库（绿色）/离库（红色）/外来物品（绿色）状态，外来物品指属于其他仓库但存放在本仓库的物品；离库物品显示"正在：用户名"提示
- **位置显示**: 物品在用户个人盒子时，位置显示为用户名而非"未知仓库"
- **跨仓库标签管理**: 物品在不同仓库可设置不同标签，互不影响；基于 `item_room_tag_map` 表实现
- **我手中的**: 查看当前用户个人盒子中的所有物品，支持搜索功能；底栏图标显示浅绿色徽章标示手持物品数量
- **通知**: 通知入口在"我的"页面右上角铃铛图标，点击进入通知列表；未读通知数量以红色徽章显示在铃铛图标右上角；通知列表支持单条标记已读和全部标记已读
- **我的页面菜单**: 菜单项使用 antd-mobile-icons 线框图标，分为三组：我的资料（UserOutline）+ 我的物品（AppstoreOutline）+ 我的预约（CalendarOutline）+ 我的存取（UnorderedListOutline）为第一组，系统设置（SetOutline）为第二组（与第一组之间有空隙分隔），关于（InformationCircleOutline）为第三组
- **我的存取**: 按时间倒序分页查看当前用户的取走和放入清单，包括操作类型、物品列表、目标位置和可放大的转移照片
- **我的物品**: 查看所有归属自己的物品列表，支持操作功能（编辑名称、转让、删除），显示物品当前位置和应归还到信息；菜单图标为四宫格（`AppstoreOutline`）
- **我的资料**: 支持修改头像（裁剪上传并压缩存储）、昵称、手机号，查看登录名和注册时间，修改密码，退出登录；菜单图标为用户轮廓（`UserOutline`）
- **图片版本缓存**: 头像和物品图片每次更新都会生成新的随机文件名，数据库切换到新路径后删除旧文件；`/avatars` 和 `/images` 使用一年期 immutable 缓存，使未变化的图片命中浏览器缓存，同时保证更新后的新路径立即显示
- **系统设置**: 支持语言切换（简体中文/English/跟随系统）、配色模式切换（浅色/深色/跟随系统）和视觉风格切换（标准/圆润/紧凑），通过 CSS 变量体系实现全局主题适配，包括 Ant Design Mobile 组件颜色覆盖；语言切换即时生效，跟随系统模式自动识别用户系统语言
- **购物车批量预约**: 将物品加入购物车，统一设置预约时间，批量提交预约，购物车以弹窗形式展示；设置时间后自动检测预约冲突并提示冲突时间段；预约单标题可编辑，默认为"用户名+的预约单#+日期简写"格式（如`张三的预约单#0310`），点击编辑图标可修改标题
- **预约订单管理**: 仓库预约页面支持通过顶部下拉栏切换仓库查看不同仓库的预约订单，右侧搜索按钮可按预约标题筛选，取消搜索会清空关键词并隐藏搜索框；我的预约页面显示个人预约，支持取消单个物品预约或整个订单；预约卡片顶部显示订单标题与状态标签，分隔线下方为预约时间（加粗），再下方为物品数量；订单创建者可在详情页编辑订单标题（蓝色线框编辑按钮）和延长订单（选择新结束时间，所有还在预约状态中的物品自动延长）；订单详情页的预约物品列表支持卡片/清单两种视图切换，清单视图每行仅显示物品名和圆点（绿色=在手中，灰色=不在）
- **标签管理**: 每个仓库可独立管理标签，物品可在不同仓库设置不同标签；标签以堆砌排列展示，点击标签可修改名称，支持批量选择删除
- **物品别名与备注**: 为物品添加仓库内通用的别名（替代原名称显示），以及备注信息
- **简洁界面**: 仓库页面右上角添加物品，设置按钮使用齿轮图标（有待处理的加入申请时显示红色徽章），购物车仅在有物品时显示，底栏居中为突出的绿色圆形扫码按钮，两侧为常规导航图标
- **响应式布局**: 移动端底部导航栏，桌面端（≥768px）自动切换为左侧边栏，物品网格自适应窗口宽度
- **PWA 支持**: 可添加到 iOS 主屏幕，已适配 iOS 安全区域；iOS 和 Android 状态栏会随浅色/深色主题切换，不再使用固定品牌蓝色
- **记住仓库**: 自动记住用户上次访问的仓库，下次登录或打开应用时自动进入

## 项目结构

```
warehouse/
├── server/                 # 后端代码
│   ├── src/
│   │   ├── controllers/   # 控制器
│   │   ├── routes/        # 路由定义
│   │   ├── middlewares/   # 中间件
│   │   ├── tools/        # 管理工具
│   │   └── app.ts         # 应用入口
│   └── package.json
│
├── client/                 # 前端代码
│   ├── src/
│   │   ├── pages/         # 页面组件
│   │   ├── components/    # UI 组件
│   │   ├── stores/        # 状态管理（含 themeStore 主题与语言管理）
│   │   ├── styles/        # 全局样式（含 theme.css 主题变量）
│   │   ├── locales/       # 国际化翻译文件（zh-CN.json, en-US.json）
│   │   └── services/      # API 服务
│   └── package.json
│
└── sql/
    ├── init.sql           # 数据库初始化脚本
    ├── upgrade_room_admins_and_transfer_records.sql # 已有数据库合并升级脚本
    └── migrations/        # 现有数据库增量迁移脚本
```

## API 接口

### 认证
- `POST /api/auth/register` - 注册
- `POST /api/auth/login` - 登录
- `GET /api/auth/me` - 获取当前用户信息

### 仓库
- `GET /api/rooms` - 获取用户所在的所有仓库
- `POST /api/rooms` - 创建仓库
- `GET /api/rooms/:id` - 获取仓库详情
- `PUT /api/rooms/:id` - 修改仓库信息
- `POST /api/rooms/:id/join` - 加入仓库（直接加入，保留兼容）
- `POST /api/rooms/:id/request-join` - 申请加入仓库（需审批）
- `GET /api/rooms/:id/join-request-status` - 查询申请状态
- `GET /api/rooms/:id/join-requests` - 获取加入申请列表（管理员）
- `POST /api/rooms/:id/join-requests/:requestId/approve` - 同意申请
- `POST /api/rooms/:id/join-requests/:requestId/reject` - 拒绝申请
- `GET /api/rooms/:id/members` - 获取仓库成员
- `DELETE /api/rooms/:id/members/:memberId` - 移除成员（管理员）
- `POST /api/rooms/:id/admins` - 添加普通管理员（主管理员）
- `DELETE /api/rooms/:id/admins/:userId` - 移除普通管理员（主管理员）
- `POST /api/rooms/:id/transfer-admin` - 转让主管理员身份（主管理员，body: `userId`）

### 物品
- `GET /api/items` - 获取物品列表
- `GET /api/items/in-hand` - 获取用户个人盒子中的物品
- `GET /api/items/in-hand/count` - 获取用户个人盒子中的物品数量
- `GET /api/items/my` - 获取归属当前用户的物品列表
- `GET /api/items/:id` - 获取物品详情
- `GET /api/items/qrcode/:code` - 通过二维码获取物品
- `POST /api/items` - 创建物品
- `PUT /api/items/:id` - 修改物品信息
- `DELETE /api/items/:id` - 删除物品（仅所有者可操作，会删除所有关联数据）
- `POST /api/items/:id/transfer` - 转让物品（仅所有者可操作）
- `PUT /api/items/:id/tags` - 设置物品在仓库中的标签
- `PUT /api/items/:id/remark` - 设置物品在仓库中的备注
- `PUT /api/items/:id/belong-box` - 更改物品归属盒子
- `GET /api/items/:id/history` - 获取物品转移历史
- `GET /api/items/:id/comments` - 获取物品评论
- `POST /api/items/:id/comments` - 添加评论

### 盒子
- `GET /api/boxes/room/:roomId` - 获取仓库的所有盒子（含物品数量）
- `GET /api/boxes/:id` - 获取盒子详情（含物品列表）
- `POST /api/boxes/room/:roomId` - 创建盒子（需提供 qrcode 和 name）
- `PUT /api/boxes/:id` - 修改盒子信息
- `DELETE /api/boxes/:id` - 删除盒子（可选 targetBoxId 或 toUserHand 参数移动物品）

### 标签
- `GET /api/reservations/rooms/:roomId/tags` - 获取仓库的所有标签
- `POST /api/reservations/rooms/:roomId/tags` - 创建标签
- `PUT /api/reservations/tags/:id` - 修改标签名称
- `DELETE /api/reservations/tags/:id` - 删除标签

### 扫描
- `POST /api/scan` - 扫描二维码（返回物品或盒子信息）
- `POST /api/scan/borrow` - 取走单个物品（移至用户个人盒子）
- `POST /api/scan/borrow-batch` - 批量取走物品（支持部分成功；可使用 multipart/form-data 随请求提交可选 `image`）
- `POST /api/scan/return` - 将单个物品放入指定盒子（无需持有物品即可操作）
- `POST /api/scan/return-batch` - 批量将物品放入指定盒子（支持部分成功；可使用 multipart/form-data 随请求提交可选 `image`）

### 转移记录
- `GET /api/transfer-records?page=1&pageSize=20` - 分页获取当前登录用户的转移清单及物品明细
- 转移类型使用数值：`1` 表示取走，`2` 表示放入
- 照片以原始文件存放在服务端 `public/transfer-images/`，数据库保存 `/transfer-images/...` 访问路径
- 生产环境需确保服务进程对 `server/public/`（部署结构中的 `deploy/public/`）具有写权限；`transfer-images/` 不存在时会自动创建

### 预约
- `GET /api/reservations` - 获取我的预约列表
- `POST /api/reservations` - 创建单个预约
- `DELETE /api/reservations/:id` - 取消预约
- `GET /api/reservations/items/:id` - 获取物品的预约列表
- `POST /api/reservations/check-conflicts` - 批量检查物品预约冲突

### 预约订单
- `GET /api/reservations/orders` - 获取我的预约订单列表
- `GET /api/reservations/rooms/:roomId/orders` - 获取仓库所有预约订单列表
- `POST /api/reservations/orders` - 创建预约订单（批量预约）
- `GET /api/reservations/orders/:id` - 获取订单详情（创建者或仓库成员可查看）
- `DELETE /api/reservations/orders/:id` - 取消整个订单（仅创建者可操作）
- `PUT /api/reservations/orders/:id/title` - 修改订单标题（仅创建者可操作）
- `PUT /api/reservations/orders/:id/extend` - 延长订单结束时间（仅创建者可操作，自动检查时间冲突）

### 通知
- `GET /api/notifications` - 获取通知列表
- `GET /api/notifications/unread-count` - 获取未读通知数量
- `PUT /api/notifications/:id/read` - 标记为已读
- `PUT /api/notifications/read-all` - 全部标记为已读

### 用户
- `GET /api/users/search` - 搜索用户（按昵称）
- `PUT /api/users/profile` - 修改用户信息（昵称、电话）
- `PUT /api/users/password` - 修改密码
- `POST /api/upload/avatar` - 上传头像（multipart/form-data）
- `POST /api/upload/items/:id/image` - 上传物品图片（multipart/form-data，仅物品主人可操作）
- 两类上传均返回新生成的资源路径；客户端应直接保存和使用返回路径，不要额外拼接时间戳

### 上传目录与缓存
- 生产环境需确保服务进程对 `public/avatars/`、`public/images/` 和 `public/transfer-images/` 具有创建、写入和删除权限
- 如果由 Nginx、CDN 等直接提供 `/avatars` 或 `/images`，应保留等价的 `Cache-Control: public, max-age=31536000, immutable` 配置

## 开发说明

### 后端开发
```bash
cd server
npm run dev    # 开发模式（热重载）
npm run build  # 编译 TypeScript
npm start      # 生产模式运行
npm run admin  # 管理工具（搜索用户、修改昵称、重置密码）
```

### 前端开发
```bash
cd client
npm run dev     # 开发模式
npm run build   # 构建生产版本
npm run preview # 预览生产版本
```

## License

Copyright (C) 2026 X-JEARS.

本项目采用 [GNU Affero General Public License v3.0](LICENSE)（`AGPL-3.0-only`）授权。
允许使用、复制、修改、分发及商用；分发修改版本或通过网络向用户提供修改后的版本时，
必须按照 AGPL-3.0 提供对应源代码，并保留原作者的版权及署名声明。
