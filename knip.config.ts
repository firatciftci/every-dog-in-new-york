import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: ["src/lib/components/ui/**/index.ts"],
  ignoreDependencies: ["cloudflare"],
  treatConfigHintsAsErrors: true,
};

export default config;
