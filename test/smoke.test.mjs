import assert from 'node:assert/strict';

/**
 * The client module is a script that registers itself with the browser module
 * loader. Capture that definition, then materialize the factory with a minimal
 * React stub: the pure helpers exported through `__test` never render.
 */
const captured = [];
globalThis.window = {
  __ModuleLoader__: {
    load(definition) {
      captured.push(definition);
    },
  },
};

await import('../client.js');
assert.equal(captured.length, 1, 'client.js registers exactly one module');
const definition = captured[0];
assert.equal(definition.id, 'dsh-model-port');

const reactStub = {
  createElement() {
    return null;
  },
  useState() {
    return [undefined, () => {}];
  },
  useEffect() {},
  useMemo(factory) {
    return factory();
  },
  useSyncExternalStore() {
    return undefined;
  },
  useId() {
    return ':test:';
  },
  useRef(initial) {
    return { current: initial };
  },
};
const mod = definition.factory((request) => {
  if (request === 'react') return reactStub;
  throw new Error('unexpected require: ' + request);
});
assert.equal(typeof mod.apply, 'function');
assert.deepEqual(mod.inject, [
  'slots',
  'locale',
  'remote',
  'remote.llm',
  'remote.settings',
  'remote.credentials',
  'configForms',
]);

const {
  VERSION,
  PROTOCOLS,
  REASONING_LEVELS,
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
} = mod.__test;

function expectCode(fn, code) {
  try {
    fn();
  } catch (error) {
    assert.equal(error instanceof UserError, true, 'expected a UserError for ' + code);
    assert.equal(error.code, code, 'expected code ' + code + ', got ' + error.code);
    return;
  }
  assert.fail('expected ' + code + ' to be thrown');
}

function validConfig(overrides = {}) {
  return {
    version: 1,
    provider: 'acme-gateway',
    name: 'Acme Gateway',
    baseURL: 'https://gateway.example/v1',
    api: 'openai-completions',
    models: [
      {
        id: 'acme-think',
        name: 'Acme Think',
        contextWindow: 262144,
        maxTokens: 32768,
        input: ['text', 'image'],
        reasoningEfforts: { off: null, low: 'low', high: 'high' },
        compat: { thinkingFormat: 'deepseek' },
      },
    ],
    ...overrides,
  };
}

function parse(value) {
  return parseImportConfig(JSON.stringify(value));
}

// ---------------------------------------------------------------- locale parity
assert.deepEqual(
  Object.keys(en).sort(),
  Object.keys(zh).sort(),
  'English and Chinese dictionaries must expose the same keys',
);
for (const code of [
  'errorEmpty',
  'errorInvalidJson',
  'errorObject',
  'errorVersion',
  'errorUnknownField',
  'errorProviderPattern',
  'errorBaseUrlScheme',
  'errorApi',
  'errorModels',
  'errorModelDuplicate',
  'errorModelReasoningNeedsLevel',
  'errorCatalogProvider',
  'errorRegisteredProvider',
  'errorAmbiguousName',
  'errorConflict',
  'errorWrite',
  'errorKeyRequired',
  'keyBlank',
  'keyIllegalCharacters',
  'tabsLabel',
  'apiKeyHintUnknown',
  'importWillCreateKeyRequired',
  'importWillOverwriteKeyOptional',
  'collapse',
]) {
  assert.equal(typeof en[code], 'string', 'missing English copy for ' + code);
  assert.equal(typeof zh[code], 'string', 'missing Chinese copy for ' + code);
}

// ---------------------------------------------------------------- constants
assert.equal(VERSION, 1);
assert.deepEqual(PROTOCOLS, ['openai-completions', 'openai-responses', 'anthropic-messages']);
assert.deepEqual(REASONING_LEVELS, ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']);
assert.equal(slugify(' Acme Gateway '), 'acme-gateway');
assert.equal(slugify('你好'), '');
assert.equal(deriveKeyRef('acme-gateway'), 'ACME_GATEWAY_API_KEY');
assert.equal(deriveKeyRef('a1'), 'A1_API_KEY');
assert.equal(isCustomEntry({
  provider: 'acme-gateway',
  declared: true,
  settingsPath: ['providers', 'acme-gateway'],
}), true);
assert.equal(isCustomEntry({
  provider: 'openai',
  declared: false,
  settingsPath: ['providers', 'openai'],
}), false);

// ---------------------------------------------------------------- api key
assert.equal(apiKeyFailure(''), undefined);
assert.equal(apiKeyFailure('   '), 'keyBlank');
assert.equal(apiKeyFailure('sk-abc_123'), undefined);
assert.equal(apiKeyFailure('ABC=def'), 'keyIllegalCharacters');
assert.equal(apiKeyFailure('"sk-abc"'), 'keyIllegalCharacters');
assert.equal(apiKeyFailure('ключ'), 'keyIllegalCharacters');

// ---------------------------------------------------------------- buildExport
const exportEntry = {
  provider: 'acme-gateway',
  displayName: 'Acme Gateway',
  declared: true,
  settingsPath: ['providers', 'acme-gateway'],
};
const exportProfile = {
  displayName: 'Acme Gateway',
  api: 'openai-completions',
  baseURL: 'https://gateway.example/v1',
  apiKeyEnv: 'ACME_GATEWAY_API_KEY',
  headers: { Authorization: 'secret' },
  retryPolicy: { mode: 'normal' },
  models: [
    {
      id: 'acme-think',
      name: 'Acme Think',
      contextWindow: 262144,
      maxTokens: 32768,
      input: ['text', 'image'],
      reasoningEfforts: { off: null, low: 'low', high: 'high' },
      compat: { thinkingFormat: 'deepseek' },
      unknownInternalField: 'drop me',
    },
    {
      id: 'acme-mini',
      reasoningEfforts: false,
    },
  ],
};
const exported = buildExport(exportEntry, exportProfile);
assert.equal(exported.version, 1);
assert.equal(exported.provider, 'acme-gateway');
assert.equal(exported.name, 'Acme Gateway');
assert.equal(exported.baseURL, 'https://gateway.example/v1');
assert.equal(exported.api, 'openai-completions');
assert.equal(exported.models.length, 2);
assert.deepEqual(exported.models[0], {
  id: 'acme-think',
  name: 'Acme Think',
  contextWindow: 262144,
  maxTokens: 32768,
  input: ['text', 'image'],
  reasoningEfforts: { off: null, low: 'low', high: 'high' },
  compat: { thinkingFormat: 'deepseek' },
});
assert.deepEqual(exported.models[1], { id: 'acme-mini', reasoningEfforts: false });
assert.equal(JSON.stringify(exported).includes('secret'), false);
assert.equal(JSON.stringify(exported).includes('apiKey'), false);
assert.equal(JSON.stringify(exported).includes('headers'), false);

expectCode(() => buildExport(exportEntry, { ...exportProfile, models: [] }), 'errorProviderIncomplete');
expectCode(() => buildExport(exportEntry, { ...exportProfile, baseURL: '' }), 'errorProviderIncomplete');
expectCode(() => buildExport(exportEntry, { ...exportProfile, api: '' }), 'errorProviderIncomplete');

// ---------------------------------------------------------------- parseImportConfig
assert.deepEqual(parse(validConfig()), {
  provider: 'acme-gateway',
  name: 'Acme Gateway',
  baseURL: 'https://gateway.example/v1',
  api: 'openai-completions',
  models: [{
    id: 'acme-think',
    name: 'Acme Think',
    contextWindow: 262144,
    maxTokens: 32768,
    input: ['text', 'image'],
    reasoningEfforts: { off: null, low: 'low', high: 'high' },
    compat: { thinkingFormat: 'deepseek' },
  }],
});
assert.equal(parse({ ...validConfig(), version: undefined }).provider, 'acme-gateway');
assert.equal(parse({ provider: undefined, name: 'Acme Gateway', baseURL: 'https://x.example', api: 'openai-completions', models: [{ id: 'm' }] }).name, 'Acme Gateway');

expectCode(() => parseImportConfig(''), 'errorEmpty');
expectCode(() => parseImportConfig('{'), 'errorInvalidJson');
expectCode(() => parseImportConfig('[]'), 'errorObject');
expectCode(() => parseImportConfig('x'.repeat(1024 * 1024 + 1)), 'errorOversize');
expectCode(() => parse({ ...validConfig(), extra: true }), 'errorUnknownField');
expectCode(() => parse({ ...validConfig(), apiKey: 'sk-test' }), 'errorApiKeyInJson');
expectCode(() => parse({ ...validConfig(), version: 2 }), 'errorVersion');
expectCode(() => parse({ ...validConfig(), provider: 'Acme' }), 'errorProviderPattern');
expectCode(() => parse({ ...validConfig(), provider: '' }), 'errorProvider');
expectCode(() => parse({ ...validConfig(), name: '' }), 'errorName');
expectCode(() => parse({ provider: undefined, name: undefined }), 'errorProviderRequired');
expectCode(() => parse({ ...validConfig(), baseURL: 'ftp://gateway.example' }), 'errorBaseUrlScheme');
expectCode(() => parse({ ...validConfig(), baseURL: '' }), 'errorBaseUrl');
expectCode(() => parse({ ...validConfig(), api: 'openai' }), 'errorApi');
expectCode(() => parse({ ...validConfig(), models: [] }), 'errorModels');
expectCode(() => parse({
  ...validConfig(),
  models: [{ id: 'same' }, { id: 'same' }],
}), 'errorModelDuplicate');
expectCode(() => parse({ ...validConfig(), models: [{ id: '' }] }), 'errorModelId');
expectCode(() => parse({ ...validConfig(), models: [{ id: 'm', contextWindow: 0 }] }), 'errorModelContext');
expectCode(() => parse({ ...validConfig(), models: [{ id: 'm', maxTokens: 1.5 }] }), 'errorModelMaxTokens');
expectCode(() => parse({ ...validConfig(), models: [{ id: 'm', input: ['audio'] }] }), 'errorModelInput');
expectCode(() => parse({ ...validConfig(), models: [{ id: 'm', reasoningEfforts: { ultra: 'ultra' } }] }), 'errorModelReasoningLevel');
expectCode(() => parse({ ...validConfig(), models: [{ id: 'm', reasoningEfforts: { high: '' } }] }), 'errorModelReasoningValue');
expectCode(() => parse({ ...validConfig(), models: [{ id: 'm', reasoningEfforts: { off: null } }] }), 'errorModelReasoningNeedsLevel');
expectCode(() => parse({ ...validConfig(), models: [{ id: 'm', compat: [] }] }), 'errorModelCompat');
expectCode(() => parse({ ...validConfig(), models: [{ id: 'm', extra: 1 }] }), 'errorModelUnknownField');

// ---------------------------------------------------------------- resolveTarget
const catalogEntry = {
  provider: 'openai',
  displayName: 'OpenAI',
  declared: false,
  settingsPath: ['providers', 'openai'],
  profile: { api: 'openai-responses', models: [{ id: 'gpt' }] },
};
const customEntry = {
  provider: 'acme-gateway',
  displayName: 'Acme Gateway',
  declared: true,
  settingsNs: 'llm-pi-ai',
  settingsPath: ['providers', 'acme-gateway'],
  profile: { displayName: 'Acme Gateway', models: [{ id: 'acme-think' }] },
  userProfile: { displayName: 'Acme Gateway' },
};
const otherCustomEntry = {
  provider: 'other-gateway',
  displayName: 'Acme Gateway',
  declared: true,
  settingsPath: ['providers', 'other-gateway'],
  profile: { displayName: 'Acme Gateway', models: [{ id: 'other' }] },
  userProfile: {},
};
const directory = [catalogEntry, customEntry];

assert.deepEqual(
  resolveTarget({ provider: 'acme-gateway' }, directory, []),
  { action: 'overwrite', route: 'acme-gateway', entry: customEntry },
);
expectCode(() => resolveTarget({ provider: 'openai' }, directory, []), 'errorCatalogProvider');
expectCode(() => resolveTarget({ provider: 'deepseek-official' }, directory, [{ id: 'deepseek-official' }]), 'errorRegisteredProvider');
assert.deepEqual(
  resolveTarget({ provider: 'new-gateway' }, directory, []),
  { action: 'create', route: 'new-gateway', entry: undefined },
);
assert.deepEqual(
  resolveTarget({ name: 'Acme Gateway' }, directory, []),
  { action: 'overwrite', route: 'acme-gateway', entry: customEntry },
);
assert.deepEqual(
  resolveTarget({ name: 'Brand New Gateway' }, directory, []),
  { action: 'create', route: 'brand-new-gateway', entry: undefined },
);
expectCode(() => resolveTarget({ name: 'Acme Gateway' }, [catalogEntry, customEntry, otherCustomEntry], []), 'errorAmbiguousName');
expectCode(() => resolveTarget({ name: '你好' }, directory, []), 'errorProviderRequired');
expectCode(() => resolveTarget({ name: 'Brand New Gateway' }, directory, [{ id: 'brand-new-gateway' }]), 'errorRegisteredProvider');

// ---------------------------------------------------------------- buildImportPlan
const parsed = parse(validConfig());
const createTarget = { action: 'create', route: 'acme-gateway', entry: undefined };
expectCode(() => buildImportPlan(createTarget, parsed, ''), 'errorKeyRequired');
const createPlan = buildImportPlan(createTarget, parsed, 'sk-test-123');
assert.equal(createPlan.action, 'create');
assert.equal(createPlan.credentialRef, 'ACME_GATEWAY_API_KEY');
assert.equal(createPlan.credentialValue, 'sk-test-123');
assert.deepEqual(createPlan.ops, [{
  op: 'set',
  path: ['providers', 'acme-gateway'],
  value: {
    displayName: 'Acme Gateway',
    apiKeyEnv: 'ACME_GATEWAY_API_KEY',
    api: 'openai-completions',
    baseURL: 'https://gateway.example/v1',
    models: parsed.models,
  },
}]);

const overwriteTarget = {
  action: 'overwrite',
  route: 'acme-gateway',
  entry: {
    ...customEntry,
    profile: { displayName: 'Acme Gateway', apiKeyEnv: 'ACME_GATEWAY_API_KEY' },
    userProfile: { displayName: 'Acme Gateway', apiKeyEnv: 'ACME_GATEWAY_API_KEY' },
  },
};
const overwriteWithoutKey = buildImportPlan(overwriteTarget, parsed, '');
assert.equal(overwriteWithoutKey.credentialValue, undefined);
assert.equal(overwriteWithoutKey.ops.some((op) => op.path[2] === 'apiKeyEnv'), false);
assert.equal(overwriteWithoutKey.ops.some((op) => op.path[2] === 'models'), true);

const overwriteWithKey = buildImportPlan(overwriteTarget, parsed, 'sk-test-123');
assert.equal(overwriteWithKey.credentialRef, 'ACME_GATEWAY_API_KEY');
assert.equal(overwriteWithKey.credentialValue, 'sk-test-123');
assert.equal(overwriteWithKey.ops.some((op) => op.path[2] === 'apiKeyEnv'), false);
assert.equal(JSON.stringify(overwriteWithKey.ops).includes('sk-test-123'), false);

const overwriteNoRef = buildImportPlan({
  action: 'overwrite',
  route: 'acme-gateway',
  entry: { ...customEntry, profile: { displayName: 'Acme Gateway' }, userProfile: { displayName: 'Acme Gateway' } },
}, parsed, 'sk-test-123');
assert.equal(overwriteNoRef.credentialRef, 'ACME_GATEWAY_API_KEY');
assert.deepEqual(
  overwriteNoRef.ops.find((op) => op.path[2] === 'apiKeyEnv'),
  { op: 'set', path: ['providers', 'acme-gateway', 'apiKeyEnv'], value: 'ACME_GATEWAY_API_KEY' },
);

const overridesTarget = {
  action: 'overwrite',
  route: 'acme-gateway',
  entry: {
    ...customEntry,
    profile: { displayName: 'Acme Gateway', modelOverrides: {} },
    userProfile: { displayName: 'Acme Gateway', modelOverrides: {} },
  },
};
assert.equal(
  buildImportPlan(overridesTarget, parsed, '').ops.some((op) => op.op === 'unset' && op.path[2] === 'modelOverrides'),
  true,
);
expectCode(() => buildImportPlan({
  action: 'overwrite',
  route: 'acme-gateway',
  entry: {
    ...customEntry,
    profile: { displayName: 'Acme Gateway', modelOverrides: {} },
    userProfile: { displayName: 'Acme Gateway' },
  },
}, parsed, ''), 'errorInheritedOverrides');

// ---------------------------------------------------------------- directory joins
const view = {
  writable: true,
  namespaces: [{
    ns: 'llm-pi-ai',
    value: { providers: { 'acme-gateway': { displayName: 'Acme Gateway', baseURL: 'https://gateway.example/v1' } } },
    user: { providers: { 'acme-gateway': { displayName: 'Acme Gateway' } } },
    revision: 3,
  }],
};
const joined = joinDirectory([{
  provider: 'acme-gateway',
  displayName: 'Acme Gateway',
  declared: true,
  settingsNs: 'llm-pi-ai',
  settingsPath: ['providers', 'acme-gateway'],
}], view);
assert.equal(joined.length, 1);
assert.equal(joined[0].profile.baseURL, 'https://gateway.example/v1');
assert.equal(joined[0].userProfile.displayName, 'Acme Gateway');
assert.equal(getPath({ a: { b: 1 } }, ['a', 'b']), 1);
assert.equal(getPath({ a: { b: 1 } }, ['a', 'missing']), undefined);
assert.equal(importTargetName({ action: 'create', route: 'acme-gateway' }, { name: 'Acme Gateway' }), 'Acme Gateway');
assert.equal(importTargetName({ action: 'overwrite', route: 'acme-gateway', entry: customEntry }, { baseURL: 'https://x.example' }), 'Acme Gateway');
assert.equal(importTargetName({ action: 'create', route: 'acme-gateway' }, {}), 'acme-gateway');

// ---------------------------------------------------------------- registration
const registrations = [];
const subscriptions = [];
const effects = [];
const mirrorStub = {
  getSnapshot: () => ({ status: 'idle', view: undefined, error: null }),
  subscribe: () => () => {},
  ensure: () => Promise.resolve(),
  load: () => Promise.resolve(),
  acceptView: () => {},
};
const ctx = {
  locale: {
    bind: () => (key) => key,
    register: (ns, dicts) => {
      registrations.push({ kind: 'locale', ns, dicts });
      return () => {};
    },
  },
  configForms: {
    describe: () => mirrorStub,
  },
  remote: {
    $on: (event, callback) => {
      subscriptions.push({ event, callback });
      return () => {};
    },
    llm: {},
    settings: {},
    credentials: {},
  },
  on: (event, callback) => {
    subscriptions.push({ event, callback });
    return () => {};
  },
  effect: (callback) => {
    const dispose = callback();
    effects.push(dispose);
    return dispose;
  },
  slots: {
    inject: (key, callback) => callback(),
    register: (options, component) => {
      registrations.push({ kind: 'slot', options, component });
      return () => {};
    },
  },
};
mod.apply(ctx);
assert.equal(
  registrations.some((entry) => entry.kind === 'locale' && entry.ns === 'settings.modelPort'),
  true,
  'apply registers the locale dictionaries',
);
assert.equal(
  registrations.some((entry) => entry.kind === 'slot' && entry.options.name === 'settings.models.footer'),
  true,
  'apply registers the models footer slot',
);
assert.equal(
  registrations.find((entry) => entry.kind === 'slot' && entry.options.name === 'settings.models.footer').options.locale,
  'settings.modelPort',
);
assert.equal(
  subscriptions.some((entry) => entry.event === 'llm/adapters-updated'),
  true,
  'apply subscribes to provider topology changes',
);
assert.equal(
  subscriptions.some((entry) => entry.event === 'connection/reset'),
  true,
  'apply subscribes to connection resets',
);

// ---------------------------------------------------------------- first render
const renderMirror = {
  getSnapshot: () => ({
    status: 'ready',
    view: {
      writable: true,
      namespaces: [{
        ns: 'llm-pi-ai',
        value: {
          providers: {
            'acme-gateway': {
              displayName: 'Acme Gateway',
              api: 'openai-completions',
              baseURL: 'https://gateway.example/v1',
              models: [{ id: 'acme-think' }],
            },
          },
        },
        user: { providers: {} },
        revision: 1,
      }],
    },
    error: null,
  }),
  subscribe: () => () => {},
  ensure: () => Promise.resolve(),
  load: () => Promise.resolve(),
  acceptView: () => {},
};
const stateValues = [
  { status: 'ready', configurable: [customEntry], registered: [], error: null },
  'acme-gateway',
  null,
  null,
  '',
  null,
  '',
  false,
  null,
  false,
  'export',
  { status: 'empty' },
  true,
];
let stateIndex = 0;
const renderReact = {
  createElement(type, props, children) {
    return { type, props: props || {}, children };
  },
  useId: () => ':render:',
  useState(initial) {
    const value = stateValues[stateIndex++];
    if (value !== undefined) return [value, () => {}];
    return [typeof initial === 'function' ? initial() : initial, () => {}];
  },
  useEffect() {},
  useMemo(factory) {
    return factory();
  },
  useSyncExternalStore(subscribe, getSnapshot) {
    return getSnapshot();
  },
  useRef(initial) {
    return { current: initial };
  },
};
const renderFactory = definition.factory((request) => {
  if (request === 'react') return renderReact;
  throw new Error('unexpected require: ' + request);
});
let renderedComponent;
const renderCtx = {
  locale: { bind: () => (key) => key, register: () => () => {} },
  configForms: { describe: () => renderMirror },
  remote: { $on: () => () => {}, llm: {}, settings: {}, credentials: {} },
  on: () => () => {},
  effect: (callback) => callback(),
  slots: {
    inject: (key, callback) => callback(),
    register: (options, component) => {
      renderedComponent = component;
      return () => {};
    },
  },
};
renderFactory.apply(renderCtx);
assert.equal(typeof renderedComponent, 'function');
const tree = renderedComponent({ t: (key) => key });
assert.equal(tree.type, 'section');
assert.equal(tree.props.className, 'dsh-mcp-card');
assert.equal(Array.isArray(tree.children), true);
assert.equal(tree.children.length >= 4, true);
assert.equal(JSON.stringify(tree.children).includes('title'), true);

function findTabs(node, out = []) {
  if (!node || typeof node !== 'object') return out;
  if (node.props && node.props.role === 'tab') out.push(node);
  if (Array.isArray(node.children)) for (const child of node.children) findTabs(child, out);
  return out;
}

function findTabList(node) {
  if (!node || typeof node !== 'object') return undefined;
  if (node.props && node.props.role === 'tablist') return node;
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      const found = findTabList(child);
      if (found) return found;
    }
  }
  return undefined;
}

const tabList = findTabList(tree);
assert.ok(tabList, 'rendered tree exposes the tablist');
assert.equal(tabList.props['aria-label'], 'tabsLabel');
assert.equal(tabList.props.className, 'dsh-mcp-segmented');
assert.equal(tabList.props.style['--dsh-segment-count'], '2');
assert.equal(tabList.props.style['--dsh-segment-index'], '0');
const tabs = findTabs(tree);
assert.equal(tabs.length, 2);
assert.equal(tabs[0].props['aria-selected'], true);
assert.equal(tabs[1].props['aria-selected'], false);
assert.equal(tabs[0].props.tabIndex, 0);
assert.equal(tabs[1].props.tabIndex, -1);
assert.equal(tabs[0].props['aria-controls'], ':render:-export-panel');
assert.equal(tabs[1].props['aria-controls'], ':render:-import-panel');
assert.equal(tabs[0].children, 'exportTitle');
assert.equal(tabs[1].children, 'importTitle');
tabs[1].props.onClick();
tabs[0].props.onKeyDown({ key: 'ArrowRight', preventDefault() {} });
tabs[0].props.onKeyDown({ key: 'End', preventDefault() {} });
tabs[0].props.onKeyDown({ key: 'Tab', preventDefault() {} });

function findButton(node, label) {
  if (!node || typeof node !== 'object') return undefined;
  if (node.type === 'button' && (node.children === label || (Array.isArray(node.children) && node.children.includes(label)))) return node;
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      const found = findButton(child, label);
      if (found) return found;
    }
  }
  return undefined;
}

const exportButton = findButton(tree, 'export');
assert.ok(exportButton, 'rendered tree exposes the export button');
await exportButton.props.onClick();
const importButton = findButton(tree, 'import');
assert.ok(importButton, 'rendered tree exposes the import button');
await importButton.props.onClick();

// The footer defaults to the collapsed Add-provider-style trigger.
const collapsedReact = {
  ...renderReact,
  useState(initial) {
    return [typeof initial === 'function' ? initial() : initial, () => {}];
  },
};
const collapsedFactory = definition.factory((request) => {
  if (request === 'react') return collapsedReact;
  throw new Error('unexpected require: ' + request);
});
collapsedFactory.apply(renderCtx);
const collapsedTree = renderedComponent({ t: (key) => key });
assert.equal(collapsedTree.type, 'div');
assert.equal(collapsedTree.props.className, 'dsh-mcp-collapsed');
const trigger = collapsedTree.children;
assert.equal(trigger.type, 'button');
assert.equal(trigger.props.className, 'dsh-mcp-trigger');
assert.equal(trigger.props['aria-expanded'], false);
assert.equal(trigger.children[1].children, 'title');
trigger.props.onClick();

console.log('smoke tests passed');
