import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: ["src/lib/components/ui/**/index.ts"],
  treatConfigHintsAsErrors: true,
};

export default config;
