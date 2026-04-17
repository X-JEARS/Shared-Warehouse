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

### 3. 配置环境变量

复制后端环境变量模板并修改：

```bash
cd server
cp .env.example .env
# 编辑 .env 文件，填入数据库连接信息
```

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

- **多仓库管理**: 用户可以加入多个仓库，查看不同仓库中的物品；加入仓库需管理员审批
- **二维码扫描**: 扫描物品二维码取走物品，扫描盒子二维码进入盒子详情；物品可在人与人、人与仓库之间自由流动；支持手电筒照明，高清视频流提升小二维码识别率
- **盒子详情**: 扫描盒子码直接进入盒子详情页，可查看盒子信息和物品列表，支持连续扫描放入物品
- **物品管理**: 添加物品时扫描物品二维码，支持设置标签和备注名，存放位置默认选择第一个盒子
- **盒子管理**: 添加盒子需扫描或输入二维码（以 box. 开头）并填写名称；删除盒子时若有物品需选择移动目标
- **仓库物品展示**: 物品以自适应网格卡片形式展示，窗口越宽列数越多。在库物品按当前所在盒子分组，离库物品统一显示在"不在库中"分组；支持按盒子/标签筛选
- **物品在库状态**: 物品卡片显示在库（绿色）/离库（红色）/外来物品（绿色）状态，外来物品指属于其他仓库但存放在本仓库的物品；离库物品显示"正在：用户名"提示
- **位置显示**: 物品在用户个人盒子时，位置显示为用户名而非"未知仓库"
- **跨仓库标签管理**: 物品在不同仓库可设置不同标签，互不影响；基于 `item_room_tag_map` 表实现
- **我手中的**: 查看当前用户个人盒子中的所有物品，支持搜索功能
- **我的物品**: 查看所有归属自己的物品列表，支持操作功能（编辑名称、转让、删除），显示物品当前位置和应归还到信息
- **个人中心**: 支持修改用户昵称和头像，头像支持裁剪上传并压缩存储
- **购物车批量预约**: 将物品加入购物车，统一设置预约时间，批量提交预约，购物车以弹窗形式展示；设置时间后自动检测预约冲突并提示冲突时间段
- **预约订单管理**: 仓库预约页面显示仓库所有预约订单，我的预约页面显示个人预约，支持取消单个物品预约或整个订单
- **标签管理**: 每个仓库可独立管理标签，物品可在不同仓库设置不同标签；标签以堆砌排列展示，支持批量选择删除
- **物品备注名**: 为物品添加仓库内通用的备注名，减少歧义
- **简洁界面**: 仓库页面右上角添加物品，设置按钮使用齿轮图标，购物车仅在有物品时显示，创建/加入仓库入口在仓库下拉菜单中
- **响应式布局**: 移动端底部导航栏，桌面端（≥768px）自动切换为左侧边栏，物品网格自适应窗口宽度
- **PWA 支持**: 可添加到 iOS 主屏幕，已适配 iOS 安全区域和状态栏
- **记住仓库**: 自动记住用户上次访问的仓库，下次登录或打开应用时自动进入

## 项目结构

```
warehouse/
├── server/                 # 后端代码
│   ├── src/
│   │   ├── controllers/   # 控制器
│   │   ├── routes/        # 路由定义
│   │   ├── middlewares/   # 中间件
│   │   └── app.ts         # 应用入口
│   └── package.json
│
├── client/                 # 前端代码
│   ├── src/
│   │   ├── pages/         # 页面组件
│   │   ├── components/    # UI 组件
│   │   ├── stores/        # 状态管理
│   │   └── services/      # API 服务
│   └── package.json
│
└── sql/
    └── init.sql           # 数据库初始化脚本
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

### 物品
- `GET /api/items` - 获取物品列表
- `GET /api/items/in-hand` - 获取用户个人盒子中的物品
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
- `DELETE /api/reservations/tags/:id` - 删除标签

### 扫描
- `POST /api/scan` - 扫描二维码（返回物品或盒子信息）
- `POST /api/scan/borrow` - 取走物品（移至用户个人盒子）
- `POST /api/scan/return` - 放回物品（移至指定盒子）

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

### 通知
- `GET /api/notifications` - 获取通知列表
- `PUT /api/notifications/:id/read` - 标记为已读
- `PUT /api/notifications/read-all` - 全部标记为已读

### 用户
- `GET /api/users/search` - 搜索用户（按昵称）
- `PUT /api/users/profile` - 修改用户信息（昵称、电话）
- `PUT /api/users/password` - 修改密码
- `POST /api/upload/avatar` - 上传头像（multipart/form-data）
- `POST /api/upload/items/:id/image` - 上传物品图片（multipart/form-data，仅物品主人可操作）

## 开发说明

### 后端开发
```bash
cd server
npm run dev    # 开发模式（热重载）
npm run build  # 编译 TypeScript
npm start      # 生产模式运行
```

### 前端开发
```bash
cd client
npm run dev     # 开发模式
npm run build   # 构建生产版本
npm run preview # 预览生产版本
```

## License

MIT
