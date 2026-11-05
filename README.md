# dsh-model-port

Export/import detailed third-party model API configurations for DeepSeek Harness.

在 **设置 → 模型** 页面最下方增加一个可折叠区域。默认收起为与「添加模型提供商」一致的虚线按钮，点击展开；展开后的卡片使用相同的 segmented tab 样式，**导出**和**导入**分列两个 tab，右上角可再次收起。

## 功能

- 默认收起；点击虚线触发按钮展开，展开后右上角箭头可收起。触发按钮高度、虚线边框、圆角和配色与「添加模型提供商」按钮对齐。
- 导出自定义模型 API 配置：提供商名称、路由 ID、API 地址、协议，以及模型列表中每个模型的详细字段。
- 导出 tab 默认选中，并自动展示第一个自定义提供商的配置；切换提供商时自动展示其配置，无需先点按钮。
- 导出或复制成功/失败的结果显示在导出区底部的状态行；剪贴板不可用时提示手动复制。
- 导入时粘贴 JSON 后自动解析并判断目标，在粘贴框下方用一行提示合并显示：将创建/覆盖哪个提供商，以及 API 密钥是否必填。新增且密钥为空时导入按钮禁用。
- 导入时按 `provider` 路由 ID 精确覆盖已有自定义提供商；没有 `provider` 时可按 `name` 匹配，或由名称生成新的路由 ID。
- 覆盖只修改名称、地址、协议和模型列表；已有的 `apiKeyEnv`、`headers`、`retryPolicy` 等高级字段保持不变。
- **API 密钥不参与导出**。导入卡片提供独立的密码输入框：
  - 新增提供商：API 密钥必填。
  - 覆盖提供商：API 密钥可选；留空保留原密钥，填写则更新密钥。
- 中英文界面，跟随 Harness 主题。

## 位置

`设置 → 模型` 的提供商列表和「添加模型提供商」控件之后，即 `settings.models.footer` 槽位。

## 安装

插件以标准 Harness bundle 发布到 npm，包名 `dsh-model-port`，仓库根目录即包目录。从 registry 安装（推荐）：

```bash
dsh plugin --profile web add dsh-model-port
```

或在 Harness 的 Plugin Manager 里用同样的 spec：

```text
plugin_manager.action = install_bundle
target = dsh-model-port
```

装好后 profile 的 `package.json` 记录 registry 依赖（`dsh-model-port: ^1.0.0`），并加入 `dsh.profile.bundles`，之后启动时自动加载。npm 装的 bundle 有版本语义：Web 插件页会列出 registry 上的新版本，可以直接在页面内升级，装前也会用目标版本的 `engines.dsh` 校验宿主兼容性。本包声明支持 `>=0.2.0 <0.3.0`（预发布版本参与匹配），范围外的宿主会在下载前被拒绝。

Git 安装仍然可用，适合还没有对应 npm 版本的旧提交：

```text
target = github:jlshix/dsh-model-port
# GitHub HTTPS 不可达时：target = git+ssh://git@github.com/jlshix/dsh-model-port.git
```

Git 依赖没有版本语义，插件页也不会提示更新。**从 Git 切到 npm 必须先移除再安装**，否则 profile 会留着旧的 Git spec：

```bash
dsh plugin --profile web remove dsh-model-port
dsh plugin --profile web add dsh-model-port
```

修改 `client.js` 后通常刷新页面即可生效；Host 半或 `cordis.patch.yml` 改动需要重启，按 Plugin Manager 的结果处理。

## JSON 格式（v1）

```json
{
  "version": 1,
  "provider": "acme-gateway",
  "name": "Acme Gateway",
  "baseURL": "https://gateway.acme.example/v1",
  "api": "openai-completions",
  "models": [
    {
      "id": "acme-think",
      "name": "Acme Think",
      "contextWindow": 262144,
      "maxTokens": 32768,
      "input": ["text", "image"],
      "reasoningEfforts": { "off": null, "low": "low", "high": "high" },
      "compat": { "thinkingFormat": "deepseek" }
    }
  ]
}
```

- `version` 可省略；当前只支持版本 1。
- `provider` 是路由 ID，格式为 `^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$`。
- `name` 是显示名称；省略时覆盖会保留原显示名称，新增时默认使用路由 ID。
- `baseURL` 必须是 `http`/`https` 地址。
- `api` 只支持 `openai-completions`、`openai-responses`、`anthropic-messages`。
- `models` 至少 1 项，最多 500 项；模型 `id` 必须唯一。
- `reasoningEfforts` 的键只能是 `off`、`minimal`、`low`、`medium`、`high`、`xhigh`、`max`；非 `off` 档位必须有非空字符串值；至少需要一个非 `off` 档位。
- 未知顶层字段或模型字段会报错。API 密钥请填写在导入卡片的输入框中，不要写进 JSON。

## 覆盖规则

1. 有 `provider`：按路由 ID 查找。
   - 已存在的自定义提供商 → 覆盖。
   - 内置目录提供商（如 `openai`）→ 拒绝。
   - 已被其他适配器注册的路由 → 拒绝。
   - 不存在 → 新增。
2. 无 `provider` 但有 `name`：在自定义提供商中唯一匹配显示名称/路由 ID → 覆盖；多处同名 → 拒绝；无匹配 → 由名称生成路由 ID 后新增。
3. 覆盖写入使用字段级路径操作，不重建整个 provider；新建时写入 `apiKeyEnv` 引用和模型配置。

## 密钥存储

- 新增：使用 `<ROUTE>_API_KEY` 作为凭据引用（例如 `acme-gateway` → `ACME_GATEWAY_API_KEY`），通过 `ctx.remote.credentials.set` 保存密钥。
- 覆盖：profile 已有 `apiKeyEnv` 时沿用；没有时使用派生引用并在 profile 中补充 `apiKeyEnv`；密钥留空则完全不调用 credentials 写入。
- 密钥不会写入 JSON、日志、错误消息或剪贴板。

## 作用范围与限制

- 只处理模型页「自定义模型 API」创建的 `llm-pi-ai` `declared` 路由。OpenAI、Anthropic 等内置目录提供商和 DeepSeek 官方/账户提供商不参与导出，也不能被导入覆盖。
- 一次只处理一个提供商；不支持 JSON 数组批量导入。
- 不导出 `apiKeyEnv`、`headers`、`retryPolicy`、provider 级 `compat` 等高级字段；覆盖时保留它们。
- 新增提供商的密钥必填；如果希望使用环境变量或原生认证，请在模型页的提供商卡片中继续编辑。
- 如果 profile 写入成功但密钥写入失败，页面会显示部分成功警告，provider 已创建/覆盖但密钥需要到模型页重新填写。

## 开发与验证

```bash
node --check client.js
node --check index.js
node test/smoke.test.mjs
```

测试覆盖纯逻辑：JSON 解析/校验、导出字段裁剪、目标解析、覆盖/新增路径操作、密钥必填与引用派生、导入目标名称、中英文键集一致性。测试不会写入真实的 settings 或凭据。

## 发布

包不打构建产物，`files` 白名单直接发布源码。发版三步：

```bash
npm version minor          # 或 patch / major，同时打 vX.Y.Z tag
git push --follow-tags
# tag 触发 .github/workflows/publish.yml：校验 tag 与 package.json 一致、跑测试、npm publish --provenance
```

首次发布前在 npmjs.com 配好该仓库的 trusted publishing（workflow 文件为 `publish.yml`），不需要在仓库里存 token。本地手动发布时用 `npm publish`；`prepublishOnly` 会先跑测试，`npm pack --dry-run` 可查看实际入包文件。

## 图标

插件图标使用 Google Material Symbols 的 `swap_vert` 字形（Apache License 2.0），置于自有圆角底板中；触发按钮内使用同一字形的内联版本。
