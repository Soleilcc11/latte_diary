# ☕ 拉花日记本 Cloud

云端版拉花日记本，支持多人共享笔记本，密码保护访问。

## 部署指南

### 第一步：创建 Supabase 项目

1. 打开 [supabase.com](https://supabase.com)，注册/登录
2. 点击 **New Project**，填写项目名（如 `latte-diary`），设置数据库密码，选择区域
3. 等待项目创建完成（约 1 分钟）

### 第二步：初始化数据库

1. 在 Supabase Dashboard 左侧点击 **SQL Editor**
2. 点击 **New query**
3. 将 `supabase-schema.sql` 文件的全部内容粘贴进去
4. 点击 **Run** 执行

### 第三步：创建图片存储桶

1. 在左侧点击 **Storage**
2. 点击 **New bucket**
3. 名称填 `photos`
4. 勾选 **Public bucket**（允许公开访问图片）
5. 点击 **Create bucket**
6. 点击刚创建的 `photos` 桶 → **Policies** → **New Policy**
7. 选择 **For full customization** → 勾选 **INSERT**
8. Policy name: `Allow uploads`，Target roles: 选 `anon`
9. 保存。再创建一条 **SELECT** 的 policy（同样选 anon），允许公开读取

### 第四步：获取 API 密钥

1. 点击左侧 **Project Settings** → **API**
2. 记下以下信息：
  - **Project URL**：形如 `https://xxxxx.supabase.co`
  - **anon / public key**：`eyJhbGciOi...` 开头的长字符串
  - **service_role key**：另一个 `eyJhbGciOi...` 开头的字符串（注意保密）

### 第五步：部署到 Vercel

1. 将本 `cloud/` 文件夹推送到 GitHub 仓库
2. 打开 [vercel.com](https://vercel.com)，登录后点击 **Add New → Project**
3. 导入你的 GitHub 仓库
4. 在 **Environment Variables** 中添加 3 个变量：

  | 变量名                             | 值                |
  | ------------------------------- | ---------------- |
  | `NEXT_PUBLIC_SUPABASE_URL`      | 你的 Project URL   |
  | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key         |
  | `SUPABASE_SERVICE_ROLE_KEY`     | service_role key |

5. 点击 **Deploy**，等待部署完成
6. 完成！访问 Vercel 给你的域名即可使用

### 本地开发（可选）

```bash
cd cloud
npm install
cp .env.local.example .env.local
# 编辑 .env.local 填入你的 Supabase 密钥
npm run dev
# 打开 http://localhost:3000
```

## 使用方式

1. 打开网站首页，点击「创建新笔记本」
2. 输入名称、选图标、设密码（可选）
3. 创建后获得 6 位分享码，把链接发给朋友
4. 朋友打开链接或输入分享码即可一起记录

## 项目结构

```
cloud/
├── app/
│   ├── layout.js          # 根布局
│   ├── page.js            # 首页（创建/加入笔记本）
│   ├── globals.css        # 全局样式
│   ├── nb/[code]/page.js  # 笔记本主页面
│   └── api/               # API 路由
│       ├── notebooks/     # 笔记本 CRUD
│       ├── upload/        # 图片上传
│       └── ...
├── lib/
│   ├── supabase.js        # Supabase 客户端
│   └── password.js        # 密码工具
├── supabase-schema.sql    # 数据库建表脚本
└── package.json
```

