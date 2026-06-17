# 上游仓库合并分析报告

**日期**: 2026-06-17
**源仓库**: HBAI-Ltd/Toonflow-app (upstream/master)
**目标分支**: dev (基于 libbyyounh/Toonflow-app:master)
**版本变化**: 1.1.7 → 1.1.8

---

## 1. 合并冲突分析

### 1.1 已确认的冲突文件

#### README.md
**冲突位置**: Docker 使用说明部分（约第 283-293 行）

**冲突内容**:
```markdown
<<<<<<< .our
# 首次启动会自动将镜像内置的前端、skills、vendor 和模型配置同步到挂载的数据目录
# 此时可直接访问首页
# 例如 http://localhost:10588/
=======
# 此时在相应端口的 /index.html 路径即可访问页面
# 例如 http://localhost:10588/index.html
>>>>>>> .their
```

**冲突原因**:
- 你的 fork 保留了旧的说明（自动同步 bundled-data）
- 上游已移除 bundled-data 机制，改为直接访问 `/index.html`

**解决建议**: 采用上游版本，因为 bundled-data 机制已被移除

---

### 1.2 潜在冲突文件（需手动检查）

| 文件 | 风险等级 | 原因 |
|------|----------|------|
| `src/router.ts` | 🔴 高 | 路由配置大幅重构，行号变化大 |
| `data/vendor/deepseek.ts` | 🟡 中 | API 调用方式改变 |
| `data/vendor/grsai.ts` | 🟡 中 | 代码格式化 + 版本升级 |
| `data/vendor/toonflow.ts` | 🟡 中 | 大量代码变更（414 行） |
| `src/app.ts` | 🔴 高 | 服务器启动逻辑重构 |
| `Dockerfile` | 🔴 高 | 完全重写，移除多阶段构建 |
| `src/routes/setting/agentDeploy/deployAgentModel.ts` | 🟡 中 | 接口从单个改为批量 |
| `data/skills/*.md` | 🟢 低 | 提示词优化，通常可自动合并 |

---

## 2. 逻辑变更分析

### 2.1 核心架构变更

#### 2.1.1 Docker 部署方式重构
**变更前**:
- 多阶段构建（builder → runtime）
- 预编译 TypeScript 到 `server/app.js`
- 使用 bundled-data 机制同步数据
- 生产模式运行 (`NODE_ENV=prod`)

**变更后**:
- 单阶段构建
- 直接运行 `yarn dev`（开发模式）
- 移除 bundled-data 机制
- 简化 Dockerfile（从 49 行减到 22 行）

**影响**:
- ✅ 构建更快，镜像更简单
- ⚠️ 生产环境使用开发模式，可能影响性能
- ❌ 移除了 `build-and-export-image.sh` 构建脚本

**风险评估**: 如果你依赖旧的 Docker 构建流程，需要重新调整部署脚本

---

#### 2.1.2 图片处理系统增强
**新增功能**:
- `src/utils/image.ts`：基于 sharp 的图片缩放工具
- 动态缩略图 API：`/oss/path?size=200x300` 或 `?size=30%`
- 自动缓存到 `smallImage/` 目录

**技术细节**:
```typescript
// 支持两种尺寸格式
type ThumbnailSize =
  | { type: "dimensions"; width: number; height: number }
  | { type: "percentage"; value: number };
```

**影响**:
- ✅ 图片加载性能提升（自动缓存缩略图）
- ✅ 前端可灵活请求不同尺寸
- ⚠️ 需要安装 `sharp` 依赖（已包含在 package.json）

---

#### 2.1.3 AI 工作流简化
**变更前（6 阶段）**:
1. 导演规划（含衍生资产预划）→ 需要审核
2. 衍生资产分析
3. 衍生资产生成（可选）
4. 构建分镜表 → 需要审核
5. 分镜面板写入
6. 分镜图生成

**变更后（6 阶段，简化）**:
1. 导演规划 → **不需要审核**
2. 衍生资产分析
3. 衍生资产生成（可选）
4. 构建分镜表 → 需要审核
5. 分镜面板写入
6. 分镜图生成

**关键变更**:
- 移除"衍生资产预划"阶段
- 阶段1 不再需要审核
- 新增"缺资产不审核"规则：剧本中出现但 assets 无对应基础资产的元素，任何阶段不得作为问题提出

**影响**:
- ✅ 流程更精简，减少审核环节
- ✅ 避免因缺失基础资产导致的审核阻塞
- ⚠️ 需要更新前端审核逻辑（如果有的话）

---

### 2.2 供应商系统变更

#### 2.2.1 新增火山引擎 SD2 模型
**文件**: `data/vendor/volcengineSd2.ts`（843 行新代码）

**支持功能**:
- 文本模型
- 图片模型（文本生成、单图、多参考）
- 视频模型（多种模式）
- TTS 模型

**影响**: 如果你需要使用火山引擎的 SD2 模型，这是必需更新

---

#### 2.2.2 DeepSeek 供应商升级（v2.0 → v2.1）
**关键变更**:
```typescript
// 旧版本
return createDeepSeek({
  baseURL: vendor.inputValues.baseUrl,
  apiKey,
  extraBody,
}).chat(model.modelName);

// 新版本
return createOpenAICompatible({
  baseURL: vendor.inputValues.baseUrl,
  apiKey,
  fetch: async (url: string, options?: RequestInit) => {
    const rawBody = JSON.parse((options?.body as string) ?? "{}");
    const modifiedBody = { ...rawBody, ...extraBody };
    return await fetch(url, {
      ...options,
      body: JSON.stringify(modifiedBody),
    });
  },
}).chatModel(model.modelName);
```

**影响**:
- ✅ 更好的兼容性（使用 OpenAI 兼容接口）
- ⚠️ 如果你有自定义 DeepSeek 配置，需要验证兼容性

---

#### 2.2.3 Agent 配置接口变更
**变更前**: 单个配置更新
```typescript
// POST /deployAgentModel
{ id, name, model, modelName, vendorId, desc, temperature, maxOutputTokens }
```

**变更后**: 批量配置更新
```typescript
// POST /deployAgentModel
{
  items: [
    { id, name, model, modelName, vendorId, desc, temperature, maxOutputTokens },
    // ...更多配置
  ]
}
```

**新增接口**: `POST /updateAgentModel`（保留单个更新功能）

**影响**:
- ✅ 支持批量更新，效率更高
- ⚠️ 前端需要适配新的批量接口
- ✅ 保留了单个更新接口作为兼容

---

### 2.3 代码质量改进

#### 2.3.1 移除的文件
| 文件 | 原因 |
|------|------|
| `src/utils/bootstrapBundledData.ts` | bundled-data 机制移除 |
| `src/utils/bootstrapBundledData.test.ts` | 配套测试 |
| `src/utils/serverConfig.ts` | 配置简化 |
| `src/utils/serverConfig.test.ts` | 配套测试 |
| `src/routes/production/editImage/getImageFlow.test.ts` | 测试重构 |
| `src/routes/production/editImage/imageFlowPromptFallback.ts` | 功能移除 |
| `src/utils/oss.test.ts` | 测试重构 |
| `build-and-export-image.sh` | Docker 构建简化 |

**影响**: 如果你有自定义修改涉及这些文件，需要迁移逻辑

---

#### 2.3.2 代码风格统一
- 引号：单引号 → 双引号
- 分号：统一添加
- 格式化：Prettier 风格统一

**影响**: 纯代码风格变更，不影响逻辑，但会产生大量 diff

---

## 3. 合并前后逻辑对比

### 3.1 服务器启动流程对比

#### 合并前（当前版本）
```typescript
// src/app.ts
import { bootstrapBundledData } from "@/utils/bootstrapBundledData";
import { resolveListenPort } from "@/utils/serverConfig";

export default async function startServe(randomPort: Boolean = false) {
  // 1. 同步 bundled-data 到数据目录
  const dataDir = u.getPath();
  const syncedDirectories = bootstrapBundledData(dataDir);
  if (syncedDirectories.length > 0) {
    console.log("已同步内置数据目录:", syncedDirectories.join(", "));
  }

  // 2. 静态资源服务（简单模式）
  app.use("/oss", express.static(ossDir, { acceptRanges: false }));

  // 3. 端口解析（支持配置文件）
  const port = resolveListenPort(Boolean(randomPort));
}
```

**逻辑特点**:
- 启动时自动同步 bundled-data（前端、skills、vendor、模型配置）
- 静态资源服务简单直接
- 端口配置支持配置文件和环境变量

#### 合并后（上游版本）
```typescript
// src/app.ts
import { ensureThumbnail, ThumbnailSize } from "@/utils/image";

export default async function startServe(randomPort: Boolean = false) {
  // 1. 移除 bundled-data 同步（不再需要）

  // 2. 静态资源服务（增强模式）
  app.use(
    "/oss",
    (req, res, next) => {
      // 动态缩略图处理
      if (req.query.size) {
        const size = req.query.size as string;
        const smallImageBaseDir = path.join(ossDir, "smallImage");
        const originalPath = path.join(ossDir, req.path);

        // 解析尺寸参数
        let sizeSubDir: string;
        let sizeOpts: ThumbnailSize | undefined;

        // WIDTHxHEIGHT 格式：200x300
        const dimensMatch = size.match(/^(\d+)x(\d+)$/i);
        // 百分比格式：30 或 30%
        const percentMatch = size.match(/^(\d+(?:\.\d+)?)\s*%?$/);

        if (dimensMatch) {
          const w = parseInt(dimensMatch[1], 10);
          const h = parseInt(dimensMatch[2], 10);
          sizeSubDir = `${w}x${h}`;
          sizeOpts = { type: "dimensions", width: w, height: h };
        } else if (percentMatch) {
          const pct = parseFloat(percentMatch[1]);
          sizeSubDir = `${percentMatch[1]}p`;
          sizeOpts = { type: "percentage", value: pct };
        } else {
          // 无效参数，降级返回原图
          express.static(ossDir, { acceptRanges: false })(req, res, next);
          return;
        }

        // 生成缩略图路径
        const ext = path.extname(req.path);
        const base = path.basename(req.path, ext);
        const dir = path.dirname(req.path);
        const smallImagePath = path.join(
          smallImageBaseDir,
          dir,
          `${base}_${sizeSubDir}${ext}`
        );

        // 异步生成缩略图
        ensureThumbnail(originalPath, smallImagePath, sizeOpts).then(
          (thumbnailPath) => {
            if (thumbnailPath) {
              res.sendFile(thumbnailPath);
            } else {
              // 生成失败，降级返回原图
              express.static(ossDir, { acceptRanges: false })(req, res, next);
            }
          }
        );
        return;
      }
      next();
    },
    express.static(ossDir, { acceptRanges: false }),
  );

  // 3. 端口解析（简化）
  const port = randomPort ? 0 : 10588;
}
```

**逻辑特点**:
- 移除 bundled-data 同步机制
- 新增动态缩略图生成（支持尺寸和百分比）
- 自动缓存缩略图到 smallImage 目录
- 端口配置简化（硬编码 10588）

#### 关键差异
| 方面 | 合并前 | 合并后 |
|------|--------|--------|
| 数据同步 | bundled-data 自动同步 | 无（数据直接挂载） |
| 图片服务 | 静态文件服务 | 动态缩略图生成 |
| 端口配置 | 配置文件/环境变量 | 硬编码 10588 |
| 性能 | 无缓存 | 缩略图缓存 |

---

### 3.2 AI 工作流对比

#### 合并前（6阶段，双审核）
```
阶段1: 导演规划（含衍生资产预划）→ 需要审核 ✅
  ↓
阶段2: 衍生资产分析（依赖阶段1预划清单）
  ↓
阶段3: 衍生资产生成（可选）
  ↓
阶段4: 构建分镜表 → 需要审核 ✅
  ↓
阶段5: 分镜面板写入
  ↓
阶段6: 分镜图生成
```

**阶段1 详细逻辑**:
- 派发：执行层制定导演拍摄计划，并给出**衍生资产预划清单**
- 输出：导演拍摄计划（含衍生预划：资产名·需要的衍生状态·原因）
- 质量门：计划覆盖全部剧情、节奏合理、与资产匹配；衍生预划完整且每条标注用途
- 审核：**需要** → 执行完毕后自动派发监督层
- 约束：规划中引用的角色、道具、场景必须在资产列表中存在；衍生资产预划作为后续阶段2的硬约束

**阶段2 详细逻辑**:
- 派发：执行层依据**阶段1的衍生预划清单**，逐条分析并写入衍生资产信息
- 输入：阶段1产出的衍生预划清单
- 输出：衍生资产写入结果（或"预划清单为空，无需衍生"结论）

**阶段5 详细逻辑**:
- 模型参数 `多参` = 是：向用户询问使用 **"纯文本多参模式"** 还是 **"分镜图辅助多参模式"**
- 派发指令：必须明确携带写入模式（纯文本多参模式 / 分镜图辅助多参模式 / 首位帧模式）

**派发指令格式**:
```
你是执行层Agent，请执行【{任务类型}】任务。
目标：{一句话目标}
上下文：{必要数据摘要}
要求：
1. {具体步骤1}
2. {具体步骤2}
约束：{特殊约束条件}
```

#### 合并后（6阶段，单审核）
```
阶段1: 导演规划 → 不需要审核 ❌
  ↓
阶段2: 衍生资产分析（无预划清单约束）
  ↓
阶段3: 衍生资产生成（可选）
  ↓
阶段4: 构建分镜表 → 需要审核 ✅
  ↓
阶段5: 分镜面板写入
  ↓
阶段6: 分镜图生成
```

**阶段1 详细逻辑**:
- 派发：执行层制定导演拍摄计划
- 输出：导演拍摄计划；执行层同步到前端
- 审核：**不需要**
- 移除：衍生资产预划清单、质量门、阶段特有约束

**阶段2 详细逻辑**:
- 派发：逐条分析并写入衍生资产信息
- 输入：无（移除阶段1预划清单依赖）
- 输出：衍生资产写入结果（或"预划清单为空，无需衍生"结论）

**阶段5 详细逻辑**:
- 模型参数 `多参` = 是：**直接使用纯文本多参模式**（不再询问用户）
- 派发指令：必须明确携带写入模式（纯文本多参模式 / 首位帧模式）
- 移除：分镜图辅助多参模式选项

**派发指令格式（简化）**:
```
你是执行层Agent，请执行【{任务类型}】任务。
上下文：{必要数据摘要}
```

#### 关键差异
| 方面 | 合并前 | 合并后 |
|------|--------|--------|
| 阶段1审核 | 需要审核 | 不需要审核 |
| 衍生资产预划 | 阶段1产出，阶段2硬约束 | 移除预划阶段 |
| 多参模式选择 | 询问用户（3种模式） | 自动选择（2种模式） |
| 派发指令 | 包含目标、要求、约束 | 仅包含上下文 |
| 缺资产处理 | 可能阻塞审核 | 明确"缺资产不审核" |

---

### 3.3 Agent 配置接口对比

#### 合并前（单个更新）
```typescript
// POST /api/setting/agentDeploy/deployAgentModel
// 请求体
{
  id: number,
  name: string,
  model: string,
  modelName: string,
  vendorId: string | null,
  desc: string,
  temperature?: number,
  maxOutputTokens?: number
}

// 响应
{ message: "配置成功" }
```

**逻辑流程**:
1. 前端发送单个 Agent 配置
2. 后端验证字段（Zod schema）
3. 更新数据库单条记录
4. 返回成功响应

#### 合并后（批量更新 + 单个更新）
```typescript
// POST /api/setting/agentDeploy/deployAgentModel（批量）
// 请求体
{
  items: [
    {
      id: number,
      name: string,
      model: string,
      modelName: string,
      vendorId: string | null,
      desc: string,
      temperature?: number,
      maxOutputTokens?: number
    },
    // ...更多配置
  ]
}

// 响应
{ message: "批量配置成功" }

// POST /api/setting/agentDeploy/updateAgentModel（单个，兼容）
// 请求体（同合并前）
{
  id: number,
  name: string,
  model: string,
  modelName: string,
  vendorId: string | null,
  desc: string,
  temperature?: number,
  maxOutputTokens?: number
}

// 响应
{ message: "配置成功" }
```

**逻辑流程（批量）**:
1. 前端发送 Agent 配置数组
2. 后端验证数组结构（Zod schema）
3. 循环更新数据库多条记录
4. 返回成功响应

**逻辑流程（单个，兼容）**:
1. 前端发送单个 Agent 配置
2. 后端验证字段（Zod schema）
3. 更新数据库单条记录
4. 返回成功响应

#### 关键差异
| 方面 | 合并前 | 合并后 |
|------|--------|--------|
| 接口数量 | 1个 | 2个（批量 + 单个） |
| 更新方式 | 单个更新 | 批量更新为主 |
| 前端适配 | 直接调用 | 需要适配批量接口 |
| 性能 | N次请求 | 1次请求（批量） |

---

### 3.4 Docker 部署对比

#### 合并前（多阶段构建）
```dockerfile
# 阶段1: 构建
FROM node:24-bookworm-slim AS builder
WORKDIR /app
COPY package.json yarn.lock tsconfig.json ./
RUN yarn install --frozen-lockfile
COPY src ./src
COPY scripts ./scripts
COPY data ./data
RUN mkdir -p /app/bundled-data && \
    cp -R /app/data/modelPrompt /app/bundled-data/modelPrompt && \
    cp -R /app/data/models /app/bundled-data/models && \
    cp -R /app/data/skills /app/bundled-data/skills && \
    cp -R /app/data/vendor /app/bundled-data/vendor && \
    cp -R /app/data/web /app/bundled-data/web && \
    yarn build && \
    yarn cache clean

# 阶段2: 运行
FROM node:24-bookworm-slim AS runtime
WORKDIR /app
COPY --from=builder /app/package.json /app/yarn.lock ./
RUN yarn install --frozen-lockfile --production=true && \
    yarn cache clean && \
    mkdir -p /app/server /app/data
COPY --from=builder /app/data/serve/app.js /app/server/app.js
COPY --from=builder /app/bundled-data /app/bundled-data
ENV NODE_ENV=prod
ENV PORT=10588
ENV TOONFLOW_BUNDLED_DATA_DIR=/app/bundled-data
ENV TOONFLOW_FORCE_SYNC_DIRS=web
CMD ["node", "server/app.js"]
```

**构建流程**:
1. 安装所有依赖（包括 devDependencies）
2. 编译 TypeScript 到 JavaScript
3. 复制 bundled-data（前端、skills、vendor、模型配置）
4. 创建精简运行时镜像
5. 只安装生产依赖
6. 运行预编译的 app.js

**特点**:
- 镜像体积小（精简运行时）
- 启动快（预编译代码）
- 构建慢（多阶段编译）
- 支持 bundled-data 自动同步

#### 合并后（单阶段构建）
```dockerfile
FROM node:24-bookworm-slim
WORKDIR /app
RUN npm config set registry https://registry.npmmirror.com/ && \
    yarn config set registry https://registry.npmmirror.com/
COPY . .
RUN node -e "const fs=require('fs');const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));for(const section of ['dependencies','devDependencies']){if(!pkg[section]) continue;for(const name of ['custom-electron-titlebar','electron','electron-builder','electron-rebuild','electronmon']) delete pkg[section][name];}fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2)+'\n');" && \
    yarn install --frozen-lockfile && \
    yarn cache clean
ENV NODE_ENV=dev
ENV PORT=10588
EXPOSE 10588
CMD ["yarn", "dev"]
```

**构建流程**:
1. 复制所有文件
2. 移除 Electron 相关依赖
3. 安装所有依赖
4. 运行开发服务器

**特点**:
- 镜像体积大（包含所有依赖）
- 启动慢（开发模式）
- 构建快（单阶段）
- 不支持 bundled-data（数据直接挂载）

#### 关键差异
| 方面 | 合并前 | 合并后 |
|------|--------|--------|
| 构建阶段 | 2阶段 | 1阶段 |
| 运行模式 | 生产模式 | 开发模式 |
| 镜像体积 | 小 | 大 |
| 构建速度 | 慢 | 快 |
| 启动速度 | 快 | 慢 |
| bundled-data | 支持 | 不支持 |
| 环境变量 | TOONFLOW_BUNDLED_DATA_DIR | 无 |

---

### 3.5 供应商系统对比

#### 合并前（DeepSeek v2.0）
```typescript
// data/vendor/deepseek.ts
const textRequest = (model: TextModel, think: boolean, thinkLevel: 0 | 1 | 2 | 3) => {
  const extraBody: Record<string, any> = {};
  if (think) {
    extraBody.reasoning_effort = effortMap[thinkLevel];
  }

  return createDeepSeek({
    baseURL: vendor.inputValues.baseUrl,
    apiKey,
    extraBody,
  }).chat(model.modelName);
};
```

**调用方式**:
- 使用 `createDeepSeek` 专用客户端
- `extraBody` 直接传递给客户端
- 调用 `.chat()` 方法

#### 合并后（DeepSeek v2.1）
```typescript
// data/vendor/deepseek.ts
const textRequest = (model: TextModel, think: boolean, thinkLevel: 0 | 1 | 2 | 3) => {
  const extraBody: Record<string, any> = {};
  if (think) {
    extraBody.reasoning_effort = effortMap[thinkLevel];
  }

  return createOpenAICompatible({
    baseURL: vendor.inputValues.baseUrl,
    apiKey,
    fetch: async (url: string, options?: RequestInit) => {
      const rawBody = JSON.parse((options?.body as string) ?? "{}");
      const modifiedBody = {
        ...rawBody,
        ...extraBody
      };
      return await fetch(url, {
        ...options,
        body: JSON.stringify(modifiedBody),
      });
    },
  }).chatModel(model.modelName);
};
```

**调用方式**:
- 使用 `createOpenAICompatible` 通用客户端
- 自定义 `fetch` 函数注入 `extraBody`
- 调用 `.chatModel()` 方法

#### 关键差异
| 方面 | 合并前 | 合并后 |
|------|--------|--------|
| 客户端 | createDeepSeek（专用） | createOpenAICompatible（通用） |
| API 兼容性 | DeepSeek 专用 | OpenAI 兼容 |
| extraBody 注入 | 客户端参数 | 自定义 fetch |
| 方法调用 | .chat() | .chatModel() |
| 可维护性 | 低（专用） | 高（通用） |

---

### 3.6 图片处理对比

#### 合并前（简单静态服务）
```typescript
// src/app.ts
app.use("/oss", express.static(ossDir, { acceptRanges: false }));
```

**访问方式**:
```
GET /oss/images/photo.jpg → 返回原图
```

**特点**:
- 简单直接
- 无缓存
- 无缩略图
- 每次请求都读取原图

#### 合并后（动态缩略图服务）
```typescript
// src/app.ts
app.use(
  "/oss",
  (req, res, next) => {
    if (req.query.size) {
      // 解析 size 参数
      // 生成缩略图路径
      // 异步生成缩略图
      // 返回缩略图或降级返回原图
    }
    next();
  },
  express.static(ossDir, { acceptRanges: false }),
);
```

**访问方式**:
```
GET /oss/images/photo.jpg → 返回原图
GET /oss/images/photo.jpg?size=200x300 → 返回 200x300 缩略图
GET /oss/images/photo.jpg?size=30% → 返回 30% 缩略图
```

**缩略图存储**:
```
oss/
├── images/
│   └── photo.jpg
└── smallImage/
    └── images/
        ├── photo_200x300.jpg
        └── photo_30p.jpg
```

**特点**:
- 动态生成缩略图
- 自动缓存到 smallImage 目录
- 支持尺寸和百分比两种格式
- 生成失败自动降级返回原图
- 使用 sharp 库进行图片处理

#### 关键差异
| 方面 | 合并前 | 合并后 |
|------|--------|--------|
| 缩略图 | 不支持 | 支持（动态生成） |
| 缓存 | 无 | 有（smallImage 目录） |
| 尺寸控制 | 无 | 支持（WIDTHxHEIGHT 或百分比） |
| 性能 | 差（每次读原图） | 好（缓存缩略图） |
| 依赖 | 无 | sharp 库 |

---

### 3.7 路由配置对比

#### 合并前
```typescript
// src/router.ts
// @routes-hash d3a4d7955a8f63d5cc1c769612bd48c2
import route79 from "./routes/production/workbench/checkVideoStateList";
import route80 from "./routes/production/workbench/deleteTrack";
// ... 共 167 个路由
```

#### 合并后
```typescript
// src/router.ts
// @routes-hash b06914ce90c35a809cf607988f703a0f
import route79 from "./routes/production/workbench/checkVideoPrompt";  // 新增
import route80 from "./routes/production/workbench/checkVideoStateList";
import route81 from "./routes/production/workbench/deleteTrack";
// ... 共 169 个路由（新增 2 个）
```

**新增路由**:
1. `checkVideoPrompt` - 检查视频提示词
2. `updateAgentModel` - 更新 Agent 模型（单个）

#### 关键差异
| 方面 | 合并前 | 合并后 |
|------|--------|--------|
| 路由数量 | 167 | 169 |
| 新增路由 | 无 | checkVideoPrompt, updateAgentModel |
| 路由哈希 | d3a4d795... | b06914ce... |

---

### 3.8 数据库操作对比

#### 合并前（Agent 配置更新）
```typescript
// src/routes/setting/agentDeploy/deployAgentModel.ts
const { id, name, model, modelName, vendorId, desc, temperature, maxOutputTokens } = req.body;
await u.db("o_agentDeploy")
  .where({ id })
  .update({ id, name, model, modelName, vendorId, desc, temperature, maxOutputTokens });
```

**操作**: 单条 UPDATE 语句

#### 合并后（Agent 配置批量更新）
```typescript
// src/routes/setting/agentDeploy/deployAgentModel.ts
const { items } = req.body;
for (const item of items) {
  const { id, name, model, modelName, vendorId, desc, temperature, maxOutputTokens } = item;
  await u.db("o_agentDeploy")
    .where({ id })
    .update({ id, name, model, modelName, vendorId, desc, temperature, maxOutputTokens });
}
```

**操作**: 循环执行多条 UPDATE 语句

#### 关键差异
| 方面 | 合并前 | 合并后 |
|------|--------|--------|
| 更新方式 | 单条更新 | 批量更新（循环） |
| 事务处理 | 无 | 无（每条独立） |
| 性能 | N次请求 | 1次请求，N次数据库操作 |
| 错误处理 | 单条失败 | 某条失败不影响其他 |

---

## 4. 合并策略建议

### 3.1 推荐合并顺序

1. **先合并无冲突的文件**（skills、docs、data 目录）
2. **处理供应商文件**（vendor 目录）
3. **合并核心逻辑**（app.ts、router.ts）
4. **最后处理 Docker 相关**（Dockerfile）

### 3.2 冲突解决指南

#### README.md
```bash
# 采用上游版本
git checkout upstream/master -- README.md
```

#### src/router.ts
```bash
# 查看具体差异
git diff origin/master upstream/master -- src/router.ts

# 手动合并或采用上游版本
git checkout upstream/master -- src/router.ts
```

#### src/app.ts
```bash
# 重点检查以下变更：
# 1. 移除 bootstrapBundledData 导入
# 2. 新增 image.ts 导入
# 3. /oss 路由重构（支持动态缩略图）
```

#### Dockerfile
```bash
# 如果你依赖旧的多阶段构建，需要谨慎合并
# 建议：保留你的版本，手动应用需要的变更
```

### 3.3 验证清单

合并后需要验证：

- [ ] 服务器能正常启动 (`yarn dev`)
- [ ] 图片上传和显示正常
- [ ] 供应商配置能正常保存
- [ ] AI 工作流能正常执行
- [ ] Docker 构建能正常运行（如果使用）
- [ ] 前端能正常访问 `/index.html`

---

## 5. 风险评估

### 高风险项
1. **Docker 部署方式改变** - 如果你有生产环境部署脚本，需要重写
2. **bundled-data 机制移除** - 如果你依赖自动同步数据，需要调整
3. **Agent 配置接口变更** - 前端需要适配

### 中风险项
1. **DeepSeek API 调用方式改变** - 需要测试兼容性
2. **图片处理逻辑变更** - 需要验证缩略图功能
3. **AI 工作流审核规则变更** - 需要测试流程

### 低风险项
1. **代码风格统一** - 纯格式变更
2. **文档更新** - 不影响功能
3. **新增供应商** - 可选功能

---

## 6. 推荐操作

### 方案 A：完全合并（推荐）
```bash
git merge upstream/master
# 解决冲突
# 测试验证
```

**适用场景**: 你想要所有新功能，且愿意投入时间解决冲突

### 方案 B：选择性合并
```bash
# 只合并特定文件
git checkout upstream/master -- data/vendor/volcengineSd2.ts
git checkout upstream/master -- src/utils/image.ts
# ...其他需要的文件
```

**适用场景**: 你只想要部分功能，且有自定义修改需要保留

### 方案 C：暂不合并
**适用场景**: 当前版本稳定，没有迫切需求

---

## 7. 总结

**合并价值**: ⭐⭐⭐⭐ (4/5)

**主要收益**:
- 新增火山引擎 SD2 模型支持
- 动态缩略图功能
- Docker 构建简化
- AI 工作流优化

**主要风险**:
- Docker 部署方式改变
- 部分接口变更需要前端适配
- 移除了一些测试文件

**建议**: 如果你没有紧急需求，可以先在 dev 分支测试合并，验证无误后再合并到 master。

---

## 8. 合并执行记录

**执行时间**: 2026-06-17
**执行分支**: dev
**合并提交**: b154b0c

### 8.1 冲突解决结果

| 文件 | 冲突类型 | 解决方式 | 保留内容 |
|------|----------|----------|----------|
| README.md | Docker 说明 | 保留用户版本 | bundled-data 同步说明 |
| data/web/index.html | 前端代码 | 保留用户版本 | baseUrl 修复逻辑 |
| src/app.ts | 导入和逻辑 | 合并两者 | bundled-data + 缩略图功能 |
| src/utils/replaceUrl.ts | 路径处理 | 保留用户版本 | 更完善的前缀处理 |

### 8.2 保留的用户修改

✅ **Docker 构建**
- Dockerfile 多阶段构建（生产模式）
- build-image.yml（腾讯云 TCR 推送）
- bundled-data 同步机制

✅ **Bug 修复**
- index.html baseUrl 修复
- replaceUrl.ts 路径处理优化
- oss.ts buildPublicFileUrl 函数

✅ **新增功能**
- bootstrapBundledData.ts（数据同步）
- serverConfig.ts（端口配置）
- 相关测试文件

### 8.3 获得的上游更新

✅ **新增供应商**
- volcengineSd2.ts（火山引擎 SD2）
- deepseek.ts v2.1（OpenAI 兼容）
- grsai.ts v2.2
- toonflow.ts 更新
- volcengine.ts 更新

✅ **新增功能**
- src/utils/image.ts（动态缩略图）
- checkVideoPrompt.ts（视频提示词检查）
- updateAgentModel.ts（Agent 单个更新）

✅ **优化改进**
- AI 工作流简化（阶段1免审核）
- Agent 批量配置接口
- 代码格式化统一
- 文档和图标更新

### 8.4 验证清单

- [x] 冲突已解决
- [x] Dockerfile 保留多阶段构建
- [x] build-image.yml 保留
- [x] bundled-data 机制保留
- [x] 缩略图功能已集成
- [x] 新供应商已添加
- [ ] 服务器启动测试（待验证）
- [ ] Docker 构建测试（待验证）
- [ ] 功能测试（待验证）

### 8.5 后续建议

1. **测试服务器启动**
   ```bash
   yarn dev
   ```

2. **测试 Docker 构建**
   ```bash
   docker build -t toonflow .
   docker run -p 10588:10588 toonflow
   ```

3. **测试新功能**
   - 火山引擎 SD2 供应商配置
   - 动态缩略图：`/oss/images/test.jpg?size=200x300`
   - Agent 批量配置接口

4. **合并到 master**
   ```bash
   git checkout master
   git merge dev
   ```
