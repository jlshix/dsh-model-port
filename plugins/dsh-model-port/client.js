window.__ModuleLoader__.load({
  id: '@local/dsh-model-port',
  factory(require) {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

    const React = require('react');
    const h = React.createElement;

    /** Locale namespace owned by this plugin. */
    const LOCALE_NS = 'settings.modelPort';
    /** The models-page footer slot this plugin occupies. */
    const SLOT = 'settings.models.footer';
    /** Settings namespace the Models page writes custom pi-ai routes into. */
    const PROVIDER_NS = 'llm-pi-ai';
    /** Exchange format version. */
    const VERSION = 1;
    /** Upper bounds that keep an accidental paste from freezing the page. */
    const MAX_INPUT_BYTES = 1024 * 1024;
    const MAX_MODELS = 500;
    const MAX_NAME_LENGTH = 200;
    /** A route id usable as a settings key and as the stem of a credential name. */
    const ROUTE_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
    /** The wire protocols the pi-ai adapter declares for hand-written routes. */
    const PROTOCOLS = ['openai-completions', 'openai-responses', 'anthropic-messages'];
    /** Reasoning levels the current adapter schema accepts as object keys. */
    const REASONING_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];
    const INPUT_TYPES = ['text', 'image'];
    const LEGAL_API_KEY = /^[\x21-\x7E]+$/;
    const ENV_LINE = /^[A-Z][A-Z0-9_]*=[^=]/;
    const TOP_KEYS = ['version', 'provider', 'name', 'baseURL', 'api', 'models'];
    const MODEL_KEYS = ['id', 'name', 'contextWindow', 'maxTokens', 'input', 'reasoningEfforts', 'compat'];
    const TOP_KEY_SET = new Set(TOP_KEYS);
    const MODEL_KEY_SET = new Set(MODEL_KEYS);
    /** Footer tab order, matching the Add model provider segmented control. */
    const TAB_VALUES = ['export', 'import'];

    /** A user-correctable failure whose message is localized by the caller. */
    class UserError extends Error {
      constructor(code, params) {
        super(code);
        this.name = 'UserError';
        this.code = code;
        this.params = params || {};
      }
    }

    function isPlainObject(value) {
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    }

    function nonEmpty(value) {
      return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
    }

    function positiveInt(value) {
      return typeof value === 'number' && Number.isInteger(value) && value > 0;
    }

    function cloneJson(value) {
      if (typeof structuredClone === 'function') return structuredClone(value);
      return JSON.parse(JSON.stringify(value));
    }

    function getPath(value, path) {
      let node = value;
      for (const key of path || []) {
        if (!isPlainObject(node) || !Object.prototype.hasOwnProperty.call(node, key)) return undefined;
        node = node[key];
      }
      return node;
    }

    function hasOwn(value, key) {
      return isPlainObject(value) && Object.prototype.hasOwnProperty.call(value, key);
    }

    function slugify(name) {
      return String(name == null ? '' : name)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }

    function deriveKeyRef(provider) {
      return provider.toUpperCase().replace(/[^A-Z0-9]+/g, '_') + '_API_KEY';
    }

    function isQuoted(value) {
      const first = value[0];
      if (first !== '"' && first !== "'" && first !== '`') return false;
      return value.length > 1 && value.endsWith(first);
    }

    /**
     * Judge a typed API key. An empty field is allowed here; the caller decides
     * whether it is required for the resolved target.
     */
    function apiKeyFailure(draft) {
      const text = typeof draft === 'string' ? draft : '';
      if (text.length === 0) return undefined;
      const value = text.trim();
      if (value.length === 0) return 'keyBlank';
      if (ENV_LINE.test(value) || isQuoted(value)) return 'keyIllegalCharacters';
      if (!LEGAL_API_KEY.test(value)) return 'keyIllegalCharacters';
      return undefined;
    }

    function isHttpUrl(value) {
      try {
        const protocol = new URL(value).protocol;
        return protocol === 'http:' || protocol === 'https:';
      } catch {
        return false;
      }
    }

    function utf8Bytes(text) {
      if (typeof TextEncoder === 'function') return new TextEncoder().encode(text).length;
      return text.length;
    }

    function fill(template, params) {
      let text = String(template);
      for (const key of Object.keys(params || {})) {
        text = text.split('{' + key + '}').join(String(params[key]));
      }
      return text;
    }

    function localizeError(translate, error) {
      if (error instanceof UserError) return fill(translate(error.code), error.params);
      if (error instanceof Error) return error.message;
      return String(error);
    }

    function isCustomEntry(entry) {
      return Boolean(entry)
        && entry.declared === true
        && Array.isArray(entry.settingsPath)
        && entry.settingsPath.length === 2
        && entry.settingsPath[0] === 'providers';
    }

    function joinDirectory(configurable, view) {
      const namespaces = new Map(
        (view && Array.isArray(view.namespaces) ? view.namespaces : []).map((ns) => [ns.ns, ns]),
      );
      return (Array.isArray(configurable) ? configurable : []).map((entry) => {
        const namespace = entry && typeof entry.settingsNs === 'string' ? namespaces.get(entry.settingsNs) : undefined;
        const path = entry && Array.isArray(entry.settingsPath) ? entry.settingsPath : [];
        return {
          ...entry,
          profile: namespace ? getPath(namespace.value, path) : undefined,
          userProfile: namespace ? getPath(namespace.user, path) : undefined,
        };
      });
    }

    function providerNamespace(view, configurable) {
      if (!view || !Array.isArray(view.namespaces)) return undefined;
      const preferred = (Array.isArray(configurable) ? configurable.find(isCustomEntry) : undefined);
      const names = [];
      if (preferred && typeof preferred.settingsNs === 'string' && preferred.settingsNs.length > 0) {
        names.push(preferred.settingsNs);
      }
      names.push(PROVIDER_NS);
      for (const name of names) {
        const found = view.namespaces.find((ns) => ns.ns === name);
        if (found !== undefined) return found;
      }
      return undefined;
    }

    function buildExportModel(model, provider) {
      if (!isPlainObject(model)) {
        throw new UserError('errorProviderIncomplete', { provider, field: 'models' });
      }
      const id = nonEmpty(model.id);
      if (id === undefined) {
        throw new UserError('errorProviderIncomplete', { provider, field: 'models' });
      }
      const output = { id };
      const name = nonEmpty(model.name);
      if (name !== undefined) output.name = name;
      if (positiveInt(model.contextWindow)) output.contextWindow = model.contextWindow;
      if (positiveInt(model.maxTokens)) output.maxTokens = model.maxTokens;
      if (Array.isArray(model.input)) output.input = model.input.slice();
      if (model.reasoningEfforts === false) {
        output.reasoningEfforts = false;
      } else if (isPlainObject(model.reasoningEfforts) && Object.keys(model.reasoningEfforts).length > 0) {
        output.reasoningEfforts = cloneJson(model.reasoningEfforts);
      }
      if (isPlainObject(model.compat) && Object.keys(model.compat).length > 0) {
        output.compat = cloneJson(model.compat);
      }
      return output;
    }

    /**
     * Build the v1 exchange object from one effective provider profile.
     * API keys and credential references deliberately do not enter this object.
     */
    function buildExport(entry, profile) {
      const provider = entry && typeof entry.provider === 'string' ? entry.provider : '';
      if (provider.length === 0) {
        throw new UserError('errorProviderIncomplete', { provider: '(unknown)', field: 'provider' });
      }
      if (!isPlainObject(profile)) {
        throw new UserError('errorProviderIncomplete', { provider, field: 'models' });
      }
      const baseURL = nonEmpty(profile.baseURL);
      if (baseURL === undefined) {
        throw new UserError('errorProviderIncomplete', { provider, field: 'baseURL' });
      }
      const api = nonEmpty(profile.api);
      if (api === undefined) {
        throw new UserError('errorProviderIncomplete', { provider, field: 'api' });
      }
      const models = profile.models;
      if (!Array.isArray(models) || models.length === 0) {
        throw new UserError('errorProviderIncomplete', { provider, field: 'models' });
      }
      const name = nonEmpty(profile.displayName) || nonEmpty(entry.displayName) || provider;
      return {
        version: VERSION,
        provider,
        name,
        baseURL,
        api,
        models: models.map((model) => buildExportModel(model, provider)),
      };
    }

    function parseImportModel(source, index, seen) {
      const position = index + 1;
      if (!isPlainObject(source)) {
        throw new UserError('errorModelObject', { index: position });
      }
      for (const key of Object.keys(source)) {
        if (!MODEL_KEY_SET.has(key)) {
          throw new UserError('errorModelUnknownField', { index: position, field: key });
        }
      }
      if (typeof source.id !== 'string') {
        throw new UserError('errorModelId', { index: position });
      }
      const id = source.id.trim();
      if (id.length === 0) {
        throw new UserError('errorModelId', { index: position });
      }
      if (seen.has(id)) {
        throw new UserError('errorModelDuplicate', { index: position, id });
      }
      seen.add(id);

      const model = { id };
      if (source.name !== undefined && source.name !== null) {
        if (typeof source.name !== 'string') {
          throw new UserError('errorModelName', { index: position });
        }
        const name = source.name.trim();
        if (name.length === 0) {
          throw new UserError('errorModelName', { index: position });
        }
        model.name = name;
      }
      if (source.contextWindow !== undefined && source.contextWindow !== null) {
        if (!positiveInt(source.contextWindow)) {
          throw new UserError('errorModelContext', { index: position });
        }
        model.contextWindow = source.contextWindow;
      }
      if (source.maxTokens !== undefined && source.maxTokens !== null) {
        if (!positiveInt(source.maxTokens)) {
          throw new UserError('errorModelMaxTokens', { index: position });
        }
        model.maxTokens = source.maxTokens;
      }
      if (source.input !== undefined && source.input !== null) {
        if (!Array.isArray(source.input)) {
          throw new UserError('errorModelInput', { index: position });
        }
        for (const input of source.input) {
          if (typeof input !== 'string' || !INPUT_TYPES.includes(input)) {
            throw new UserError('errorModelInput', { index: position });
          }
        }
        model.input = source.input.slice();
      }
      if (source.reasoningEfforts !== undefined && source.reasoningEfforts !== null) {
        if (source.reasoningEfforts === false) {
          model.reasoningEfforts = false;
        } else if (isPlainObject(source.reasoningEfforts)) {
          const efforts = {};
          let hasNonOff = false;
          for (const [level, wire] of Object.entries(source.reasoningEfforts)) {
            if (!REASONING_LEVELS.includes(level)) {
              throw new UserError('errorModelReasoningLevel', { index: position, level });
            }
            if (typeof wire === 'string') {
              if (wire.length === 0) {
                throw new UserError('errorModelReasoningValue', { index: position, level });
              }
              efforts[level] = wire;
            } else if (wire === null && level === 'off') {
              efforts[level] = null;
            } else {
              throw new UserError('errorModelReasoningValue', { index: position, level });
            }
            if (level !== 'off') hasNonOff = true;
          }
          if (!hasNonOff) {
            throw new UserError('errorModelReasoningNeedsLevel', { index: position });
          }
          model.reasoningEfforts = efforts;
        } else {
          throw new UserError('errorModelReasoning', { index: position });
        }
      }
      if (source.compat !== undefined && source.compat !== null) {
        if (!isPlainObject(source.compat)) {
          throw new UserError('errorModelCompat', { index: position });
        }
        model.compat = cloneJson(source.compat);
      }
      return model;
    }

    /**
     * Parse and normalize one pasted v1 configuration. Unknown fields are
     * rejected so a typo cannot silently produce a different provider.
     */
    function parseImportConfig(text) {
      const source = typeof text === 'string' ? text.trim() : '';
      if (source.length === 0) throw new UserError('errorEmpty');
      if (utf8Bytes(source) > MAX_INPUT_BYTES) {
        throw new UserError('errorOversize', { limit: '1 MiB' });
      }
      let parsed;
      try {
        parsed = JSON.parse(source);
      } catch (error) {
        throw new UserError('errorInvalidJson', {
          message: error instanceof Error ? error.message : String(error),
        });
      }
      if (!isPlainObject(parsed)) throw new UserError('errorObject');
      for (const key of Object.keys(parsed)) {
        if (!TOP_KEY_SET.has(key)) {
          if (key === 'apiKey') throw new UserError('errorApiKeyInJson');
          throw new UserError('errorUnknownField', { field: key });
        }
      }
      if (parsed.version !== undefined && parsed.version !== null && parsed.version !== VERSION) {
        throw new UserError('errorVersion');
      }

      let provider;
      if (parsed.provider !== undefined && parsed.provider !== null) {
        if (typeof parsed.provider !== 'string') throw new UserError('errorProvider');
        provider = parsed.provider.trim();
        if (provider.length === 0) throw new UserError('errorProvider');
        if (!ROUTE_PATTERN.test(provider)) {
          throw new UserError('errorProviderPattern', { provider });
        }
      }
      let name;
      if (parsed.name !== undefined && parsed.name !== null) {
        if (typeof parsed.name !== 'string') throw new UserError('errorName');
        name = parsed.name.trim();
        if (name.length === 0 || name.length > MAX_NAME_LENGTH) throw new UserError('errorName');
      }
      if (provider === undefined && name === undefined) throw new UserError('errorProviderRequired');

      if (typeof parsed.baseURL !== 'string' || parsed.baseURL.trim().length === 0) {
        throw new UserError('errorBaseUrl');
      }
      const baseURL = parsed.baseURL.trim();
      if (!isHttpUrl(baseURL)) throw new UserError('errorBaseUrlScheme');

      if (typeof parsed.api !== 'string' || !PROTOCOLS.includes(parsed.api)) {
        throw new UserError('errorApi', { protocols: PROTOCOLS.join(', ') });
      }
      const api = parsed.api;

      if (!Array.isArray(parsed.models) || parsed.models.length === 0 || parsed.models.length > MAX_MODELS) {
        throw new UserError('errorModels');
      }
      const seen = new Set();
      const models = parsed.models.map((model, index) => parseImportModel(model, index, seen));

      const normalized = { baseURL, api, models };
      if (provider !== undefined) normalized.provider = provider;
      if (name !== undefined) normalized.name = name;
      return normalized;
    }

    /**
     * Resolve the import target among declared custom routes. An explicit
     * `provider` is authoritative; `name` matching is the fallback for
     * hand-written configurations.
     */
    function resolveTarget(config, directory, registered) {
      const entries = Array.isArray(directory) ? directory : [];
      const registeredIds = new Set(
        (Array.isArray(registered) ? registered : [])
          .map((item) => (typeof item === 'string' ? item : item && item.id))
          .filter((id) => typeof id === 'string' && id.length > 0),
      );
      const byRoute = (route) => entries.find((entry) => entry && entry.provider === route);

      if (config.provider !== undefined) {
        const route = config.provider;
        const hit = byRoute(route);
        if (hit !== undefined) {
          if (!isCustomEntry(hit)) {
            throw new UserError('errorCatalogProvider', { provider: route });
          }
          return { action: 'overwrite', route, entry: hit };
        }
        if (registeredIds.has(route)) {
          throw new UserError('errorRegisteredProvider', { provider: route });
        }
        return { action: 'create', route, entry: undefined };
      }

      const name = config.name;
      if (name === undefined) throw new UserError('errorProviderRequired');
      const matched = [];
      const seen = new Set();
      for (const entry of entries) {
        if (!isCustomEntry(entry)) continue;
        const profile = entry.profile;
        const hit = entry.provider === name
          || entry.displayName === name
          || (isPlainObject(profile) && profile.displayName === name);
        if (hit && !seen.has(entry.provider)) {
          seen.add(entry.provider);
          matched.push(entry);
        }
      }
      if (matched.length > 1) throw new UserError('errorAmbiguousName', { name });
      if (matched.length === 1) {
        return { action: 'overwrite', route: matched[0].provider, entry: matched[0] };
      }

      const route = slugify(name);
      if (route.length === 0 || !ROUTE_PATTERN.test(route)) {
        throw new UserError('errorProviderRequired');
      }
      const slugHit = byRoute(route);
      if (slugHit !== undefined) {
        if (!isCustomEntry(slugHit)) {
          throw new UserError('errorCatalogProvider', { provider: route });
        }
        return { action: 'overwrite', route, entry: slugHit };
      }
      if (registeredIds.has(route)) {
        throw new UserError('errorRegisteredProvider', { provider: route });
      }
      return { action: 'create', route, entry: undefined };
    }

    /**
     * Build the profile mutation and the optional credential write for one
     * resolved target. A new provider requires a key; an overwrite may keep the
     * existing credential by leaving the key empty.
     */
    function buildImportPlan(target, config, keyDraft) {
      const keyFailure = apiKeyFailure(keyDraft);
      if (keyFailure !== undefined) throw new UserError(keyFailure);
      const keyValue = (typeof keyDraft === 'string' ? keyDraft : '').trim();
      if (target.action === 'create' && keyValue.length === 0) {
        throw new UserError('errorKeyRequired');
      }

      const profile = target.entry && isPlainObject(target.entry.profile) ? target.entry.profile : undefined;
      const existingRef = profile && typeof profile.apiKeyEnv === 'string' && profile.apiKeyEnv.trim().length > 0
        ? profile.apiKeyEnv.trim()
        : undefined;
      const ref = existingRef !== undefined ? existingRef : deriveKeyRef(target.route);
      const name = config.name !== undefined
        ? config.name
        : (nonEmpty(profile && profile.displayName) || nonEmpty(target.entry && target.entry.displayName) || target.route);

      if (target.action === 'create') {
        const value = {};
        if (config.name !== undefined) value.displayName = config.name;
        value.apiKeyEnv = ref;
        value.api = config.api;
        value.baseURL = config.baseURL;
        value.models = config.models;
        return {
          action: 'create',
          route: target.route,
          name,
          ops: [{ op: 'set', path: ['providers', target.route], value }],
          credentialRef: ref,
          credentialValue: keyValue,
        };
      }

      const ops = [
        { op: 'set', path: ['providers', target.route, 'api'], value: config.api },
        { op: 'set', path: ['providers', target.route, 'baseURL'], value: config.baseURL },
        { op: 'set', path: ['providers', target.route, 'models'], value: config.models },
      ];
      if (config.name !== undefined) {
        ops.push({ op: 'set', path: ['providers', target.route, 'displayName'], value: config.name });
      }
      if (keyValue.length > 0 && existingRef === undefined) {
        ops.push({ op: 'set', path: ['providers', target.route, 'apiKeyEnv'], value: ref });
      }

      const userProfile = target.entry && isPlainObject(target.entry.userProfile) ? target.entry.userProfile : undefined;
      const userHasOverrides = hasOwn(userProfile, 'modelOverrides');
      const effectiveHasOverrides = hasOwn(profile, 'modelOverrides');
      if (effectiveHasOverrides && !userHasOverrides) {
        throw new UserError('errorInheritedOverrides', { provider: target.route });
      }
      if (userHasOverrides) {
        ops.push({ op: 'unset', path: ['providers', target.route, 'modelOverrides'] });
      }

      const plan = { action: 'overwrite', route: target.route, name, ops };
      if (keyValue.length > 0) {
        plan.credentialRef = ref;
        plan.credentialValue = keyValue;
      }
      return plan;
    }

    const en = {
      title: 'Model API Config Import/Export',
      description: 'Export one custom model provider as JSON, or paste JSON to import it. API keys are never exported. A provider with the same identity is overwritten.',
      exportTitle: 'Export',
      exportDescription: 'Choose one custom model provider and copy its configuration.',
      tabsLabel: 'Export and import',
      provider: 'Provider',
      export: 'Export',
      exported: 'Exported configuration',
      copy: 'Copy',
      modelCount: '{count} models',
      noProviders: 'No custom model providers yet. Add one above, then export it here.',
      loading: 'Loading model provider settings…',
      loadFailed: 'Loading the model provider settings failed.',
      retry: 'Retry',
      readOnly: 'The settings document is read-only in this deployment. Import is disabled.',
      staleSettings: 'Could not refresh the latest settings; showing the last loaded values.',
      collapse: 'Collapse',
      importTitle: 'Import',
      importDescription: 'Paste a configuration exported from this page or another installation.',
      configJson: 'Configuration JSON',
      importPlaceholder: 'Paste the exported JSON here…',
      apiKey: 'API key',
      apiKeyPlaceholder: 'Enter API key',
      apiKeyHint: 'Required for a new provider. When overwriting, leave blank to keep the existing key. The key is never exported.',
      apiKeyHintUnknown: 'Paste a valid configuration to see whether an API key is required.',
      importWillCreateKeyRequired: 'Will create {provider}; an API key is required.',
      importWillOverwriteKeyOptional: 'Will overwrite {provider}; leave the key blank to keep the saved one.',
      apiKeyShow: 'Show API key',
      apiKeyHide: 'Hide API key',
      import: 'Import',
      importing: 'Importing…',
      exportCopied: 'Configuration copied to the clipboard.',
      exportManualCopy: 'Configuration generated. Copy it from the text box below.',
      copied: 'Copied to the clipboard.',
      copyFailed: 'Could not copy automatically. Select the text and copy it manually.',
      importedCreated: 'Created {provider} and saved the API key.',
      importedCreatedKeyFailed: 'Created {provider}, but the API key could not be saved: {message}. Enter the key again in the Models page.',
      importedOverwritten: 'Overwrote {provider}.',
      importedOverwrittenWithKey: 'Overwrote {provider} and updated the API key.',
      importedOverwrittenKeyFailed: 'Overwrote {provider}, but the API key could not be saved: {message}. Enter the key again in the Models page.',
      protocolOpenAiCompletions: 'OpenAI Chat Completions',
      protocolOpenAiResponses: 'OpenAI Responses',
      protocolAnthropicMessages: 'Anthropic Messages',
      protocolUnknown: 'Unknown protocol',
      errorNoProviders: 'No custom model provider is available to export.',
      errorProviderIncomplete: 'Provider "{provider}" has no exportable {field}.',
      errorEmpty: 'Paste a configuration first.',
      errorOversize: 'The configuration is too large (limit: {limit}).',
      errorInvalidJson: 'The configuration is not valid JSON: {message}',
      errorObject: 'The configuration must be a single JSON object.',
      errorVersion: 'Unsupported configuration version. This plugin supports version 1.',
      errorUnknownField: 'Unknown configuration field "{field}".',
      errorApiKeyInJson: 'Do not put the API key in the JSON. Enter it in the API key field below.',
      errorProvider: 'The provider field must be a non-empty string.',
      errorProviderPattern: 'Provider ID "{provider}" must start with a lowercase letter and contain only lowercase letters, digits, and hyphens.',
      errorProviderRequired: 'Provide a provider ID or a provider name that can be matched.',
      errorName: 'The provider name must be a non-empty string of at most 200 characters.',
      errorBaseUrl: 'The API address is required.',
      errorBaseUrlScheme: 'The API address must be a valid http or https URL.',
      errorApi: 'Unsupported protocol. Use one of: {protocols}.',
      errorModels: 'Provide between 1 and 500 models.',
      errorModelObject: 'Model {index} must be an object.',
      errorModelUnknownField: 'Model {index} has an unknown field "{field}".',
      errorModelId: 'Model {index} needs a non-empty model ID.',
      errorModelDuplicate: 'Model {index} repeats the model ID "{id}".',
      errorModelName: 'Model {index} has an invalid display name.',
      errorModelContext: 'Model {index} has an invalid context window.',
      errorModelMaxTokens: 'Model {index} has an invalid maximum output token count.',
      errorModelInput: 'Model {index} has an invalid input type list.',
      errorModelReasoning: 'Model {index} has invalid reasoning levels.',
      errorModelReasoningLevel: 'Model {index} uses an unknown reasoning level "{level}".',
      errorModelReasoningValue: 'Model {index} needs a non-empty value for reasoning level "{level}".',
      errorModelReasoningNeedsLevel: 'Model {index} needs at least one reasoning level other than off.',
      errorModelCompat: 'Model {index} has an invalid compatibility object.',
      errorCatalogProvider: '"{provider}" is a built-in catalog provider and cannot be overwritten by import.',
      errorRegisteredProvider: 'The provider ID "{provider}" is already registered by another adapter.',
      errorAmbiguousName: 'More than one custom provider is named "{name}". Add a provider field to choose one.',
      errorInheritedOverrides: 'Provider "{provider}" inherits modelOverrides, which conflicts with an imported model list. Remove it from the profile configuration first.',
      errorSettingsUnavailable: 'The model provider settings are not available.',
      errorNoNamespace: 'The model provider settings namespace is not available.',
      errorReadOnly: 'The settings document is read-only, so the import cannot be saved.',
      errorDirectoryUnavailable: 'The provider directory is unavailable, so the import cannot be validated.',
      errorDirectory: 'Loading the provider directory failed: {message}',
      errorConflict: 'The settings changed while importing. Read the latest values and try again.',
      errorWrite: 'Saving the provider configuration failed: {message}',
      errorKeyRequired: 'An API key is required when creating a new provider.',
      keyBlank: 'Enter an API key, or leave the field empty to keep the stored key.',
      keyIllegalCharacters: 'The API key has an invalid format. Check it and try again.',
    };

    const zh = {
      title: '模型 API 配置导入/导出',
      description: '导出单个自定义模型提供商的 JSON 配置，或粘贴 JSON 导入；API 密钥不会被导出，同名提供商会覆盖。',
      exportTitle: '导出',
      exportDescription: '选择一个自定义模型提供商，复制它的配置。',
      tabsLabel: '导出与导入',
      provider: '提供商',
      export: '导出',
      exported: '导出的配置',
      copy: '复制',
      modelCount: '{count} 个模型',
      noProviders: '还没有自定义模型提供商。请先在上方添加，再到这里导出。',
      loading: '正在加载模型提供商设置…',
      loadFailed: '加载模型提供商设置失败。',
      retry: '重试',
      readOnly: '当前部署的设置文档为只读，导入已禁用。',
      staleSettings: '无法刷新最新设置，正在显示上次加载的值。',
      collapse: '收起',
      importTitle: '导入',
      importDescription: '粘贴从本页或其他安装导出的配置。',
      configJson: '配置 JSON',
      importPlaceholder: '在此粘贴导出的 JSON…',
      apiKey: 'API 密钥',
      apiKeyPlaceholder: '输入 API 密钥',
      apiKeyHint: '新增提供商时必填；覆盖时可留空以保留原密钥。密钥不会被导出。',
      apiKeyHintUnknown: '粘贴有效配置后会自动判断是否需要填写 API 密钥。',
      importWillCreateKeyRequired: '将创建 {provider}；新增提供商必须填写 API 密钥。',
      importWillOverwriteKeyOptional: '将覆盖 {provider}；密钥可留空以保留已保存的密钥。',
      apiKeyShow: '显示 API 密钥',
      apiKeyHide: '隐藏 API 密钥',
      import: '导入',
      importing: '导入中…',
      exportCopied: '配置已复制到剪贴板。',
      exportManualCopy: '配置已生成，请在下方文本框中手动复制。',
      copied: '已复制到剪贴板。',
      copyFailed: '无法自动复制，请手动选择文本复制。',
      importedCreated: '已创建 {provider} 并保存 API 密钥。',
      importedCreatedKeyFailed: '已创建 {provider}，但 API 密钥保存失败：{message}。请在模型页重新填写密钥。',
      importedOverwritten: '已覆盖 {provider}。',
      importedOverwrittenWithKey: '已覆盖 {provider} 并更新 API 密钥。',
      importedOverwrittenKeyFailed: '已覆盖 {provider}，但 API 密钥保存失败：{message}。请在模型页重新填写密钥。',
      protocolOpenAiCompletions: 'OpenAI Chat Completions',
      protocolOpenAiResponses: 'OpenAI Responses',
      protocolAnthropicMessages: 'Anthropic Messages',
      protocolUnknown: '未知协议',
      errorNoProviders: '没有可导出的自定义模型提供商。',
      errorProviderIncomplete: '提供商“{provider}”缺少可导出的 {field}。',
      errorEmpty: '请先粘贴配置。',
      errorOversize: '配置内容过大（上限：{limit}）。',
      errorInvalidJson: '配置不是有效的 JSON：{message}',
      errorObject: '配置必须是单个 JSON 对象。',
      errorVersion: '不支持的配置版本。此插件支持版本 1。',
      errorUnknownField: '未知的配置字段“{field}”。',
      errorApiKeyInJson: '请不要把 API 密钥放进 JSON，请在下方 API 密钥输入框中填写。',
      errorProvider: 'provider 字段必须是非空字符串。',
      errorProviderPattern: '提供商 ID“{provider}”必须以小写字母开头，且只能包含小写字母、数字和短横线。',
      errorProviderRequired: '请提供 provider ID，或提供可匹配的提供商名称。',
      errorName: '提供商名称必须是非空字符串，且不超过 200 个字符。',
      errorBaseUrl: 'API 地址不能为空。',
      errorBaseUrlScheme: 'API 地址必须是有效的 http 或 https URL。',
      errorApi: '不支持的协议。请使用：{protocols}。',
      errorModels: '请提供 1 到 500 个模型。',
      errorModelObject: '模型 {index} 必须是对象。',
      errorModelUnknownField: '模型 {index} 含有未知字段“{field}”。',
      errorModelId: '模型 {index} 需要非空的模型 ID。',
      errorModelDuplicate: '模型 {index} 重复了模型 ID“{id}”。',
      errorModelName: '模型 {index} 的显示名称无效。',
      errorModelContext: '模型 {index} 的上下文窗口无效。',
      errorModelMaxTokens: '模型 {index} 的最大输出 token 数无效。',
      errorModelInput: '模型 {index} 的输入类型列表无效。',
      errorModelReasoning: '模型 {index} 的推理等级配置无效。',
      errorModelReasoningLevel: '模型 {index} 使用了未知的推理等级“{level}”。',
      errorModelReasoningValue: '模型 {index} 的推理等级“{level}”需要非空参数值。',
      errorModelReasoningNeedsLevel: '模型 {index} 至少需要一个 Off 以外的推理等级。',
      errorModelCompat: '模型 {index} 的兼容性配置无效。',
      errorCatalogProvider: '“{provider}”是内置目录提供商，不能通过导入覆盖。',
      errorRegisteredProvider: '提供商 ID“{provider}”已被其他适配器注册。',
      errorAmbiguousName: '有多个自定义提供商都叫“{name}”。请添加 provider 字段以指定目标。',
      errorInheritedOverrides: '提供商“{provider}”继承了 modelOverrides，与导入的模型列表冲突。请先从 profile 配置中移除。',
      errorSettingsUnavailable: '模型提供商设置不可用。',
      errorNoNamespace: '模型提供商设置命名空间不可用。',
      errorReadOnly: '设置文档为只读，导入无法保存。',
      errorDirectoryUnavailable: '提供商目录不可用，无法校验导入内容。',
      errorDirectory: '加载提供商目录失败：{message}',
      errorConflict: '导入期间设置已发生变化。请读取最新值后重试。',
      errorWrite: '保存提供商配置失败：{message}',
      errorKeyRequired: '新增提供商时必须填写 API 密钥。',
      keyBlank: '请输入 API 密钥；留空则保持已存储的密钥。',
      keyIllegalCharacters: '该 API 密钥格式错误，请检查。',
    };

    const CSS = [
      '.dsh-mcp-card{box-sizing:border-box;width:100%;display:flex;flex-direction:column;gap:12px;padding:14px 16px;border:0.5px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-size:14px;line-height:22px}',
      '.dsh-mcp-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}',
      '.dsh-mcp-headText{display:flex;flex-direction:column;gap:2px;min-width:0}',
      '.dsh-mcp-collapse{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;flex:none;border:none;border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}',
      '.dsh-mcp-collapse:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
      '.dsh-mcp-collapse:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));outline-offset:-2px}',
      '.dsh-mcp-collapsed{display:flex;width:100%}',
      '.dsh-mcp-trigger{box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:6px;width:100%;min-width:180px;height:44px;padding:0 14px;appearance:none;-webkit-appearance:none;border:1px dashed var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-lg);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:14px;line-height:22px;cursor:pointer}',
      '.dsh-mcp-trigger:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.dsh-mcp-trigger:focus-visible{box-shadow:0 0 0 2px var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));outline:none}',
      '.dsh-mcp-triggerIcon{display:inline-flex;flex:none}',
      '.dsh-mcp-triggerLabel{white-space:nowrap}',
      '.dsh-mcp-title{margin:0;font-size:14px;font-weight:500;line-height:22px}',
      '.dsh-mcp-desc{margin:0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}',
      '.dsh-mcp-tabs{display:flex;flex-direction:column;align-items:stretch;gap:8px;min-width:0}',
      '.dsh-mcp-segmented{position:relative;display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:2px;width:100%;padding:4px;border-radius:var(--dsw-radius-md);background:var(--dsw-alias-interactive-bg-hover)}',
      '.dsh-mcp-segmentedIndicator{position:absolute;top:4px;left:4px;width:calc((100% - 8px - 2px * (var(--dsh-segment-count) - 1)) / var(--dsh-segment-count));height:calc(100% - 8px);border:0;border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-layer-1);box-shadow:var(--dsw-elevation-soft);transform:translate(calc(var(--dsh-segment-index) * (100% + 2px)));transition:transform .16s ease;pointer-events:none}',
      '.dsh-mcp-segmentedTab{box-sizing:border-box;position:relative;z-index:1;height:28px;padding:0 16px;border:0;border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;line-height:20px;font-weight:500;white-space:nowrap;cursor:pointer;transition:color .12s ease}',
      '.dsh-mcp-segmentedTab:hover:not(:disabled),.dsh-mcp-segmentedTab[aria-selected=true]{color:var(--dsw-alias-label-primary)}',
      '.dsh-mcp-segmentedTab:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));outline-offset:-2px}',
      '.dsh-mcp-panel{display:flex;flex-direction:column;gap:10px;min-width:0}',
      '.dsh-mcp-panel[hidden]{display:none}',
      '@media (prefers-reduced-motion: reduce){.dsh-mcp-segmentedIndicator,.dsh-mcp-segmentedTab{transition:none}}',
      '.dsh-mcp-meta{margin:0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}',
      '.dsh-mcp-truncate{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dsh-mcp-field{display:flex;flex-direction:column;gap:6px;min-width:0}',
      '.dsh-mcp-label{color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:500;line-height:18px}',
      '.dsh-mcp-row{display:flex;align-items:center;gap:8px;min-width:0}',
      '.dsh-mcp-rowEnd{justify-content:flex-end}',
      '.dsh-mcp-select,.dsh-mcp-input{box-sizing:border-box;width:100%;height:32px;border:0.5px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit;font-size:14px;padding:0 10px}',
      '.dsh-mcp-select{flex:1;min-width:0}',
      '.dsh-mcp-input{flex:1;min-width:0}',
      '.dsh-mcp-keyRow{display:flex;align-items:center;gap:8px;min-width:0}',
      '.dsh-mcp-keyRow .dsh-mcp-button{flex:none}',
      '.dsh-mcp-textarea{box-sizing:border-box;width:100%;min-height:120px;resize:vertical;border:0.5px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;line-height:18px;padding:8px 10px}',
      '.dsh-mcp-textareaReadonly{background:var(--dsw-alias-bg-base)}',
      '.dsh-mcp-button{box-sizing:border-box;height:32px;padding:0 12px;border:0.5px solid var(--dsw-alias-border-l2);border-radius:6px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px;cursor:pointer;white-space:nowrap}',
      '.dsh-mcp-button:hover:not(:disabled){background:var(--dsw-alias-bg-overlay)}',
      '.dsh-mcp-buttonPrimary{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}',
      '.dsh-mcp-button:focus-visible,.dsh-mcp-select:focus-visible,.dsh-mcp-input:focus-visible,.dsh-mcp-textarea:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
      '.dsh-mcp-button:disabled,.dsh-mcp-select:disabled,.dsh-mcp-input:disabled,.dsh-mcp-textarea:disabled{opacity:.5;cursor:default}',
      '.dsh-mcp-empty{border:0.5px dashed var(--dsw-alias-border-l2);border-radius:8px;margin:0;padding:10px 12px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}',
      '.dsh-mcp-error{margin:0;color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px}',
      '.dsh-mcp-warn{margin:0;color:var(--dsw-alias-state-warn-primary);font-size:12px;line-height:18px}',
      '.dsh-mcp-status{margin:0;font-size:12px;line-height:18px}',
      '.dsh-mcp-status-ok{color:var(--dsw-alias-state-success-primary)}',
      '.dsh-mcp-status-warn{color:var(--dsw-alias-state-warn-primary)}',
      '.dsh-mcp-status-error{color:var(--dsw-alias-state-error-primary)}',
      '.dsh-mcp-errorBlock{display:flex;flex-direction:column;gap:8px}',
    ].join('\n');

    const inject = [
      'slots',
      'locale',
      'remote',
      'remote.llm',
      'remote.settings',
      'remote.credentials',
      'configForms',
    ];

    function protocolLabel(translate, api) {
      if (api === 'openai-completions') return translate('protocolOpenAiCompletions');
      if (api === 'openai-responses') return translate('protocolOpenAiResponses');
      if (api === 'anthropic-messages') return translate('protocolAnthropicMessages');
      return translate('protocolUnknown');
    }

    function formatProviderLabel(name, route) {
      const resolved = nonEmpty(name) || route;
      return resolved === route ? route : resolved + ' (' + route + ')';
    }

    function displayNameOf(provider) {
      return nonEmpty(provider.profile && provider.profile.displayName)
        || nonEmpty(provider.entry && provider.entry.displayName)
        || provider.entry.provider;
    }

    function importTargetName(target, config) {
      const entry = target && target.entry;
      if (config && config.name !== undefined) return config.name;
      return nonEmpty(entry && entry.profile && entry.profile.displayName)
        || nonEmpty(entry && entry.displayName)
        || (target && target.route)
        || '';
    }

    function providerSummary(provider, translate) {
      const profile = provider.profile;
      const api = profile && typeof profile.api === 'string' ? profile.api : undefined;
      const count = profile && Array.isArray(profile.models) ? profile.models.length : 0;
      const baseURL = profile && typeof profile.baseURL === 'string' ? profile.baseURL : '';
      const head = protocolLabel(translate, api) + ' · ' + fill(translate('modelCount'), { count });
      return baseURL.length > 0 ? head + ' · ' + baseURL : head;
    }

    function StatusLine(props) {
      if (!props.status) return null;
      return h('p', {
        className: 'dsh-mcp-status dsh-mcp-status-' + props.status.tone,
        role: props.status.tone === 'error' ? 'alert' : 'status',
      }, props.status.text);
    }

    /** swap_vert glyph from Google Material Symbols (Apache-2.0). */
    const SWAP_VERT_PATH = 'M8,13V5.82L5.43,8.4L4,7L9,2l5,5L12.58,8.4L10,5.82V13H8Zm7,9l-5-5l1.43-1.4L14,18.18V11h2v7.18l2.57-2.58L20,17l-5,5Z';

    function swapVertIcon(size) {
      return h('svg', {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'currentColor',
        'aria-hidden': 'true',
        focusable: 'false',
      }, h('path', { d: SWAP_VERT_PATH }));
    }

    function chevronUpIcon(size) {
      return h('svg', {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': 'true',
        focusable: 'false',
      }, h('path', { d: 'M6 14l6-6 6 6' }));
    }

    function apply(ctx) {
      const t = ctx.locale.bind(LOCALE_NS);
      ctx.effect(() => ctx.locale.register(LOCALE_NS, { en, zh }), 'dsh-model-port: copy');
      ctx.effect(() => {
        if (typeof document === 'undefined' || !document.head) return () => {};
        const tag = document.createElement('style');
        tag.dataset.plugin = '@local/dsh-model-port';
        tag.textContent = CSS;
        document.head.appendChild(tag);
        return () => {
          tag.remove();
        };
      }, 'dsh-model-port: styles');

      const mirror = ctx.configForms.describe();
      const subscribeMirror = (listener) => mirror.subscribe(listener);
      const getMirrorSnapshot = () => mirror.getSnapshot();

      const directoryState = { version: 0, listeners: new Set() };
      const bumpDirectory = () => {
        directoryState.version += 1;
        for (const listener of Array.from(directoryState.listeners)) listener();
      };
      ctx.effect(() => {
        const disposers = [
          ctx.remote.$on('llm/adapters-updated', bumpDirectory),
          ctx.on('connection/reset', bumpDirectory),
        ];
        return () => {
          for (const dispose of disposers) dispose();
        };
      }, 'dsh-model-port: invalidations');
      const subscribeDirectory = (listener) => {
        directoryState.listeners.add(listener);
        return () => {
          directoryState.listeners.delete(listener);
        };
      };
      const getDirectoryVersion = () => directoryState.version;

      async function readDirectoryData() {
        let declared;
        let registered;
        try {
          const answer = await Promise.all([
            ctx.remote.llm.listConfigurableProviders(),
            ctx.remote.llm.listProviders(),
          ]);
          declared = answer[0];
          registered = answer[1];
        } catch (error) {
          throw new UserError('errorDirectory', {
            message: error instanceof Error ? error.message : String(error),
          });
        }
        if (!declared || declared.ok !== true) {
          throw new UserError('errorDirectory', {
            message: declared && declared.error ? declared.error.message : 'unknown error',
          });
        }
        if (!registered || registered.ok !== true) {
          throw new UserError('errorDirectory', {
            message: registered && registered.error ? registered.error.message : 'unknown error',
          });
        }
        return {
          configurable: Array.isArray(declared.value) ? declared.value : [],
          registered: Array.isArray(registered.value) ? registered.value : [],
        };
      }

      async function writeOps(namespace, ops) {
        try {
          return await ctx.remote.settings.mutate(namespace.ns, ops, namespace.revision);
        } catch (error) {
          throw new UserError('errorWrite', {
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }

      async function executeImport(config, keyDraft) {
        let snapshot = mirror.getSnapshot();
        let view = snapshot.view;
        if (!view) throw new UserError('errorSettingsUnavailable');
        if (view.writable !== true) throw new UserError('errorReadOnly');

        let directory = await readDirectoryData();
        let namespace = providerNamespace(view, directory.configurable);
        if (!namespace) throw new UserError('errorNoNamespace');
        let joined = joinDirectory(directory.configurable, view);
        let target = resolveTarget(config, joined, directory.registered);
        let plan = buildImportPlan(target, config, keyDraft);
        let response = await writeOps(namespace, plan.ops);

        if (response && response.ok !== true && response.error && response.error.code === 'settings/conflict') {
          await mirror.load();
          snapshot = mirror.getSnapshot();
          view = snapshot.view;
          if (!view) throw new UserError('errorSettingsUnavailable');
          if (view.writable !== true) throw new UserError('errorReadOnly');
          directory = await readDirectoryData();
          namespace = providerNamespace(view, directory.configurable);
          if (!namespace) throw new UserError('errorNoNamespace');
          joined = joinDirectory(directory.configurable, view);
          target = resolveTarget(config, joined, directory.registered);
          plan = buildImportPlan(target, config, keyDraft);
          response = await writeOps(namespace, plan.ops);
          if (response && response.ok !== true && response.error && response.error.code === 'settings/conflict') {
            throw new UserError('errorConflict');
          }
        }

        if (!response || response.ok !== true) {
          throw new UserError('errorWrite', {
            message: response && response.error ? response.error.message : 'unknown error',
          });
        }

        if (response.value) mirror.acceptView(response.value);
        bumpDirectory();

        let keySaved = false;
        let keyError;
        if (plan.credentialValue !== undefined) {
          try {
            const stored = await ctx.remote.credentials.set(plan.credentialRef, plan.credentialValue);
            if (stored && stored.ok === true) keySaved = true;
            else keyError = stored && stored.error ? stored.error.message : 'unknown error';
          } catch (error) {
            keyError = error instanceof Error ? error.message : String(error);
          }
        }
        return {
          action: plan.action,
          route: plan.route,
          name: plan.name,
          keySaved,
          keyError,
        };
      }

      function Footer(props) {
        const translate = props && typeof props.t === 'function' ? props.t : t;
        const uid = typeof React.useId === 'function' ? React.useId() : 'dsh-mcp';

        const [directory, setDirectory] = React.useState({
          status: 'loading',
          configurable: [],
          registered: [],
          error: null,
        });
        const [selected, setSelected] = React.useState('');
        const [exported, setExported] = React.useState(null);
        const [exportStatus, setExportStatus] = React.useState(null);
        const [importText, setImportText] = React.useState('');
        const [importStatus, setImportStatus] = React.useState(null);
        const [keyDraft, setKeyDraft] = React.useState('');
        const [keyVisible, setKeyVisible] = React.useState(false);
        const [keyError, setKeyError] = React.useState(null);
        const [busy, setBusy] = React.useState(false);
        const [activeTab, setActiveTab] = React.useState('export');
        const [importTarget, setImportTarget] = React.useState({ status: 'empty' });
        const [expanded, setExpanded] = React.useState(false);
        const tabListRef = React.useRef(null);

        const mirrorSnapshot = React.useSyncExternalStore(subscribeMirror, getMirrorSnapshot);
        const directoryVersion = React.useSyncExternalStore(subscribeDirectory, getDirectoryVersion);
        const view = mirrorSnapshot.view;

        React.useEffect(() => {
          const list = tabListRef.current;
          if (!list || typeof document === 'undefined') return;
          if (!list.contains(document.activeElement)) return;
          const selectedTab = list.querySelector('[role="tab"][aria-selected="true"]');
          if (selectedTab && typeof selectedTab.focus === 'function') selectedTab.focus();
        }, [activeTab]);

        React.useEffect(() => {
          try {
            void mirror.ensure();
          } catch {
            /* the mirror publishes its own error through its snapshot */
          }
        }, []);

        React.useEffect(() => {
          let cancelled = false;
          setDirectory((previous) => ({ ...previous, status: 'loading', error: null }));
          readDirectoryData().then(
            (data) => {
              if (cancelled) return;
              setDirectory({
                status: 'ready',
                configurable: data.configurable,
                registered: data.registered,
                error: null,
              });
            },
            (error) => {
              if (cancelled) return;
              setDirectory((previous) => ({ ...previous, status: 'error', error }));
            },
          );
          return () => {
            cancelled = true;
          };
        }, [directoryVersion]);

        const joined = React.useMemo(
          () => joinDirectory(directory.configurable, view),
          [directory.configurable, view],
        );
        const providers = React.useMemo(() => joined
          .filter((entry) => isCustomEntry(entry) && isPlainObject(entry.profile))
          .map((entry) => ({ entry, profile: entry.profile }))
          .sort((left, right) => {
            const byName = displayNameOf(left).localeCompare(displayNameOf(right));
            return byName !== 0 ? byName : left.entry.provider.localeCompare(right.entry.provider);
          }), [joined]);

        React.useEffect(() => {
          if (directory.status === 'error') return;
          if (providers.some((provider) => provider.entry.provider === selected)) return;
          setSelected(providers.length > 0 ? providers[0].entry.provider : '');
          setExported(null);
          setExportStatus(null);
        }, [providers, selected, directory.status]);

        React.useEffect(() => {
          const text = importText.trim();
          if (text.length === 0) {
            setImportTarget({ status: 'empty' });
            return undefined;
          }
          let cancelled = false;
          const schedule = typeof window !== 'undefined' && typeof window.setTimeout === 'function'
            ? window.setTimeout.bind(window)
            : setTimeout;
          const timer = schedule(() => {
            if (cancelled) return;
            let config;
            try {
              config = parseImportConfig(importText);
            } catch (error) {
              setImportTarget({ status: 'unparsed', error });
              return;
            }
            try {
              const target = resolveTarget(config, joined, directory.registered);
              setImportTarget({ status: 'ready', config, target });
            } catch (error) {
              setImportTarget({ status: 'unresolved', config, error });
            }
          }, 180);
          return () => {
            cancelled = true;
            if (typeof window !== 'undefined' && typeof window.clearTimeout === 'function') {
              window.clearTimeout(timer);
            } else {
              clearTimeout(timer);
            }
          };
        }, [importText, joined, directory.registered]);

        const selectedProvider = providers.find((provider) => provider.entry.provider === selected) || null;

        React.useEffect(() => {
          if (!selectedProvider) return;
          try {
            const config = buildExport(selectedProvider.entry, selectedProvider.profile);
            setExported({ text: JSON.stringify(config, null, 2) });
          } catch {
            setExported(null);
          }
        }, [selectedProvider]);
        const namespace = view ? providerNamespace(view, directory.configurable) : undefined;
        const writable = Boolean(view && view.writable === true);
        const readOnly = Boolean(view && view.writable === false);

        const directoryError = directory.status === 'error' ? directory.error : null;
        const mirrorMissing = !view;
        const mirrorLoading = mirrorMissing && (mirrorSnapshot.status === 'idle' || mirrorSnapshot.status === 'loading');
        const mirrorError = mirrorMissing && mirrorSnapshot.status === 'error'
          ? (mirrorSnapshot.error || new Error(translate('loadFailed')))
          : null;
        const noNamespace = Boolean(view) && !namespace;
        let fatalError = directoryError || mirrorError || (noNamespace ? new UserError('errorNoNamespace') : null);
        if (!fatalError && !mirrorLoading && mirrorMissing) {
          fatalError = new UserError('errorSettingsUnavailable');
        }
        const loading = !fatalError && (mirrorLoading || (directory.status === 'loading' && directory.configurable.length === 0));
        const staleWarning = Boolean(view && mirrorSnapshot.error);

        const importTargetReady = importTarget.status === 'ready';
        const importTargetCreate = importTargetReady && importTarget.target.action === 'create';
        const importTargetOverwrite = importTargetReady && importTarget.target.action === 'overwrite';
        const importTargetLabel = importTargetReady
          ? formatProviderLabel(importTargetName(importTarget.target, importTarget.config), importTarget.target.route)
          : '';
        const keyRequiredNow = importTargetCreate;
        let importGuidance;
        if (importTarget.status === 'unresolved') {
          importGuidance = { tone: 'error', text: localizeError(translate, importTarget.error) };
        } else if (importTargetCreate) {
          importGuidance = {
            tone: 'warn',
            text: fill(translate('importWillCreateKeyRequired'), { provider: importTargetLabel }),
          };
        } else if (importTargetOverwrite) {
          importGuidance = {
            tone: 'meta',
            text: fill(translate('importWillOverwriteKeyOptional'), { provider: importTargetLabel }),
          };
        } else if (importTarget.status === 'unparsed' || importTarget.status === 'pending') {
          importGuidance = { tone: 'meta', text: translate('apiKeyHintUnknown') };
        } else {
          importGuidance = { tone: 'meta', text: translate('apiKeyHint') };
        }

        function onRetry() {
          setExportStatus(null);
          setImportStatus(null);
          try {
            void mirror.load();
          } catch {
            /* the mirror publishes its own error through its snapshot */
          }
          bumpDirectory();
        }

        function onProviderChange(event) {
          setSelected(event.target.value);
          setExported(null);
          setExportStatus(null);
        }

        function onTabKeyDown(event) {
          const key = event.key;
          if (key !== 'ArrowLeft' && key !== 'ArrowRight' && key !== 'ArrowUp' && key !== 'ArrowDown' && key !== 'Home' && key !== 'End') {
            return;
          }
          event.preventDefault();
          const current = TAB_VALUES.indexOf(activeTab);
          let next;
          if (key === 'Home') next = 0;
          else if (key === 'End') next = TAB_VALUES.length - 1;
          else {
            const delta = key === 'ArrowRight' || key === 'ArrowDown' ? 1 : -1;
            next = (current + delta + TAB_VALUES.length) % TAB_VALUES.length;
          }
          setActiveTab(TAB_VALUES[next]);
        }

        async function onExport() {
          if (!selectedProvider) {
            setExportStatus({ tone: 'error', text: translate('errorNoProviders') });
            return;
          }
          setExportStatus(null);
          let config;
          try {
            config = buildExport(selectedProvider.entry, selectedProvider.profile);
          } catch (error) {
            setExported(null);
            setExportStatus({ tone: 'error', text: localizeError(translate, error) });
            return;
          }
          const text = JSON.stringify(config, null, 2);
          let copied = false;
          try {
            if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
              await navigator.clipboard.writeText(text);
              copied = true;
            }
          } catch {
            copied = false;
          }
          setExported({ text });
          setExportStatus({
            tone: copied ? 'ok' : 'warn',
            text: translate(copied ? 'exportCopied' : 'exportManualCopy'),
          });
        }

        async function onCopy() {
          if (!exported) return;
          try {
            if (typeof navigator === 'undefined' || !navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
              throw new Error('clipboard unavailable');
            }
            await navigator.clipboard.writeText(exported.text);
            setExportStatus({ tone: 'ok', text: translate('copied') });
          } catch {
            setExportStatus({ tone: 'warn', text: translate('copyFailed') });
          }
        }

        function onImportTextChange(event) {
          const value = event.target.value;
          setImportText(value);
          setImportStatus(null);
          setImportTarget(value.trim().length === 0 ? { status: 'empty' } : { status: 'pending' });
        }

        function onKeyChange(event) {
          setKeyDraft(event.target.value);
          setKeyError(null);
        }

        async function onImport() {
          if (busy) return;
          setImportStatus(null);
          setKeyError(null);
          let config;
          try {
            config = parseImportConfig(importText);
          } catch (error) {
            setImportStatus({ tone: 'error', text: localizeError(translate, error) });
            return;
          }
          const keyFailure = apiKeyFailure(keyDraft);
          if (keyFailure !== undefined) {
            setKeyError(translate(keyFailure));
            return;
          }
          setBusy(true);
          try {
            const result = await executeImport(config, keyDraft);
            const label = formatProviderLabel(result.name, result.route);
            if (result.action === 'create') {
              if (result.keyError) {
                setImportStatus({
                  tone: 'warn',
                  text: fill(translate('importedCreatedKeyFailed'), { provider: label, message: result.keyError }),
                });
              } else {
                setImportStatus({
                  tone: 'ok',
                  text: fill(translate('importedCreated'), { provider: label }),
                });
              }
            } else if (result.keyError) {
              setImportStatus({
                tone: 'warn',
                text: fill(translate('importedOverwrittenKeyFailed'), { provider: label, message: result.keyError }),
              });
            } else if (result.keySaved) {
              setImportStatus({
                tone: 'ok',
                text: fill(translate('importedOverwrittenWithKey'), { provider: label }),
              });
            } else {
              setImportStatus({
                tone: 'ok',
                text: fill(translate('importedOverwritten'), { provider: label }),
              });
            }
            setImportText('');
            setKeyDraft('');
            setKeyVisible(false);
          } catch (error) {
            if (error instanceof UserError
              && (error.code === 'errorKeyRequired' || error.code === 'keyBlank' || error.code === 'keyIllegalCharacters')) {
              setKeyError(localizeError(translate, error));
            } else {
              setImportStatus({ tone: 'error', text: localizeError(translate, error) });
            }
          } finally {
            setBusy(false);
          }
        }

        const children = [
          h('div', { key: 'head', className: 'dsh-mcp-head' }, [
            h('div', { key: 'text', className: 'dsh-mcp-headText' }, [
              h('h3', { key: 'title', id: uid + '-title', className: 'dsh-mcp-title' }, translate('title')),
              h('p', { key: 'desc', className: 'dsh-mcp-desc' }, translate('description')),
            ]),
            h('button', {
              key: 'collapse',
              type: 'button',
              className: 'dsh-mcp-collapse',
              'aria-label': translate('collapse'),
              title: translate('collapse'),
              onClick: () => {
                setExpanded(false);
              },
            }, chevronUpIcon(16)),
          ]),
        ];

        if (fatalError) {
          children.push(h('div', { key: 'fatal', className: 'dsh-mcp-errorBlock' }, [
            h('p', { key: 'message', className: 'dsh-mcp-error', role: 'alert' }, localizeError(translate, fatalError)),
            h('button', { key: 'retry', type: 'button', className: 'dsh-mcp-button', onClick: onRetry }, translate('retry')),
          ]));
        } else if (loading) {
          children.push(h('p', { key: 'loading', className: 'dsh-mcp-meta' }, translate('loading')));
        } else {
          if (readOnly) children.push(h('p', { key: 'readonly', className: 'dsh-mcp-warn' }, translate('readOnly')));
          if (staleWarning) children.push(h('p', { key: 'stale', className: 'dsh-mcp-warn' }, translate('staleSettings')));

          children.push(h('div', { key: 'tabs', className: 'dsh-mcp-tabs' }, [
            h('div', {
              key: 'tablist',
              ref: tabListRef,
              role: 'tablist',
              'aria-label': translate('tabsLabel'),
              className: 'dsh-mcp-segmented',
              style: {
                '--dsh-segment-count': String(TAB_VALUES.length),
                '--dsh-segment-index': String(TAB_VALUES.indexOf(activeTab)),
              },
            }, [
              h('span', { key: 'indicator', 'aria-hidden': true, className: 'dsh-mcp-segmentedIndicator' }),
              ...TAB_VALUES.map((value) => h('button', {
                key: value,
                id: uid + '-' + value + '-tab',
                type: 'button',
                role: 'tab',
                'aria-selected': activeTab === value,
                'aria-controls': uid + '-' + value + '-panel',
                tabIndex: activeTab === value ? 0 : -1,
                className: 'dsh-mcp-segmentedTab',
                onClick: () => {
                  setActiveTab(value);
                },
                onKeyDown: onTabKeyDown,
              }, translate(value === 'export' ? 'exportTitle' : 'importTitle'))),
            ]),
            h('p', { key: 'hint', className: 'dsh-mcp-meta' }, translate(activeTab === 'export' ? 'exportDescription' : 'importDescription')),
          ]));

          children.push(h('div', {
            key: 'export-panel',
            id: uid + '-export-panel',
            role: 'tabpanel',
            'aria-labelledby': uid + '-export-tab',
            hidden: activeTab !== 'export',
            className: 'dsh-mcp-panel',
          }, [
            providers.length === 0
              ? h('p', { key: 'empty', className: 'dsh-mcp-empty' }, translate('noProviders'))
              : h('div', { key: 'control', className: 'dsh-mcp-field' }, [
                  h('label', { key: 'label', htmlFor: uid + '-provider', className: 'dsh-mcp-label' }, translate('provider')),
                  h('div', { key: 'row', className: 'dsh-mcp-row' }, [
                    h('select', {
                      key: 'select',
                      id: uid + '-provider',
                      className: 'dsh-mcp-select',
                      value: selected,
                      disabled: busy,
                      onChange: onProviderChange,
                    }, providers.map((provider) => h('option', {
                      key: provider.entry.provider,
                      value: provider.entry.provider,
                    }, formatProviderLabel(displayNameOf(provider), provider.entry.provider)))),
                    h('button', {
                      key: 'button',
                      type: 'button',
                      className: 'dsh-mcp-button dsh-mcp-buttonPrimary',
                      disabled: busy || !selectedProvider,
                      onClick: onExport,
                    }, translate('export')),
                  ]),
                  selectedProvider
                    ? h('p', {
                        key: 'summary',
                        className: 'dsh-mcp-meta dsh-mcp-truncate',
                        title: selectedProvider.profile && typeof selectedProvider.profile.baseURL === 'string'
                          ? selectedProvider.profile.baseURL
                          : '',
                      }, providerSummary(selectedProvider, translate))
                    : null,
                ]),
            exported
              ? h('div', { key: 'result', className: 'dsh-mcp-field' }, [
                  h('label', { key: 'label', htmlFor: uid + '-exported', className: 'dsh-mcp-label' }, translate('exported')),
                  h('textarea', {
                    key: 'text',
                    id: uid + '-exported',
                    className: 'dsh-mcp-textarea dsh-mcp-textareaReadonly',
                    readOnly: true,
                    rows: 8,
                    value: exported.text,
                    spellCheck: false,
                    onFocus: (event) => {
                      event.currentTarget.select();
                    },
                  }),
                  h('div', { key: 'actions', className: 'dsh-mcp-row dsh-mcp-rowEnd' }, [
                    h('button', {
                      key: 'copy',
                      type: 'button',
                      className: 'dsh-mcp-button',
                      onClick: onCopy,
                    }, translate('copy')),
                  ]),
                ])
              : null,
            h(StatusLine, { key: 'status', status: exportStatus }),
          ]));

          children.push(h('div', {
            key: 'import-panel',
            id: uid + '-import-panel',
            role: 'tabpanel',
            'aria-labelledby': uid + '-import-tab',
            hidden: activeTab !== 'import',
            className: 'dsh-mcp-panel',
          }, [
            h('div', { key: 'json', className: 'dsh-mcp-field' }, [
              h('label', { key: 'label', htmlFor: uid + '-import', className: 'dsh-mcp-label' }, translate('configJson')),
              h('textarea', {
                key: 'text',
                id: uid + '-import',
                className: 'dsh-mcp-textarea',
                rows: 8,
                value: importText,
                placeholder: translate('importPlaceholder'),
                spellCheck: false,
                disabled: busy,
                onChange: onImportTextChange,
              }),
            ]),
            h('p', {
              key: 'guidance',
              id: uid + '-import-guidance',
              className: importGuidance.tone === 'error'
                ? 'dsh-mcp-error'
                : importGuidance.tone === 'warn'
                  ? 'dsh-mcp-warn'
                  : 'dsh-mcp-meta',
              role: importGuidance.tone === 'error' ? 'alert' : undefined,
            }, importGuidance.text),
            h('div', { key: 'key', className: 'dsh-mcp-field' }, [
              h('label', { key: 'label', htmlFor: uid + '-key', className: 'dsh-mcp-label' }, translate('apiKey')),
              h('div', { key: 'row', className: 'dsh-mcp-keyRow' }, [
                h('input', {
                  key: 'input',
                  id: uid + '-key',
                  className: 'dsh-mcp-input',
                  type: keyVisible ? 'text' : 'password',
                  value: keyDraft,
                  placeholder: translate('apiKeyPlaceholder'),
                  autoComplete: 'off',
                  spellCheck: false,
                  disabled: busy,
                  'aria-required': keyRequiredNow ? 'true' : undefined,
                  'aria-invalid': keyError ? 'true' : undefined,
                  'aria-describedby': uid + '-import-guidance' + (keyError ? ' ' + uid + '-key-error' : ''),
                  onChange: onKeyChange,
                }),
                h('button', {
                  key: 'toggle',
                  type: 'button',
                  className: 'dsh-mcp-button',
                  disabled: busy,
                  'aria-label': translate(keyVisible ? 'apiKeyHide' : 'apiKeyShow'),
                  onClick: () => {
                    setKeyVisible((value) => !value);
                  },
                }, translate(keyVisible ? 'apiKeyHide' : 'apiKeyShow')),
              ]),
              keyError
                ? h('p', { key: 'error', id: uid + '-key-error', className: 'dsh-mcp-error', role: 'alert' }, keyError)
                : null,
            ]),
            h('div', { key: 'actions', className: 'dsh-mcp-row dsh-mcp-rowEnd' }, [
              h('button', {
                key: 'import',
                type: 'button',
                className: 'dsh-mcp-button dsh-mcp-buttonPrimary',
                disabled: busy
                  || !writable
                  || importText.trim().length === 0
                  || importTarget.status === 'unresolved'
                  || (keyRequiredNow && keyDraft.trim().length === 0),
                onClick: onImport,
              }, busy ? translate('importing') : translate('import')),
            ]),
            h(StatusLine, { key: 'status', status: importStatus }),
          ]));
        }

        if (!expanded) {
          return h('div', { className: 'dsh-mcp-collapsed' },
            h('button', {
              type: 'button',
              className: 'dsh-mcp-trigger',
              'aria-expanded': false,
              onClick: () => {
                setExpanded(true);
              },
            }, [
              h('span', { key: 'icon', className: 'dsh-mcp-triggerIcon', 'aria-hidden': true }, swapVertIcon(16)),
              h('span', { key: 'label', className: 'dsh-mcp-triggerLabel' }, translate('title')),
            ]));
        }

        return h('section', {
          className: 'dsh-mcp-card',
          'aria-labelledby': uid + '-title',
        }, children);
      }

      ctx.slots.inject(SLOT, () => ctx.slots.register({
        name: SLOT,
        id: 'dsh-model-port',
        order: 10,
        locale: LOCALE_NS,
        label: () => t('title'),
      }, Footer));

      return undefined;
    }

    exports.apply = apply;
    exports.inject = inject;
    exports.__test = {
      VERSION,
      PROTOCOLS,
      REASONING_LEVELS,
      ROUTE_PATTERN,
      en,
      zh,
      UserError,
      buildExport,
      parseImportConfig,
      resolveTarget,
      buildImportPlan,
      deriveKeyRef,
      apiKeyFailure,
      slugify,
      joinDirectory,
      getPath,
      isCustomEntry,
      importTargetName,
    };
    return module.exports;
  },
});
