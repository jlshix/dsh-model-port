/**
 * Host half of the model-provider configuration portability bundle.
 *
 * The feature is entirely a Client-side settings extension: it reads and writes
 * the existing `llm-pi-ai` and credentials remotes. The Host row only carries
 * the package so the Client module system can discover its `dsh.client` half.
 */
export function apply() {}
