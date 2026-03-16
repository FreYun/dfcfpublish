import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { createStore } from "./src/store.js";
import { registerMessagingTools } from "./src/tools.js";

const plugin = {
  id: "agent-messaging",
  name: "Agent Messaging",
  description: "Unified inter-agent messaging with trace-based routing (Redis backend)",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    const store = createStore();
    registerMessagingTools(api, store);
    api.logger.info("agent-messaging: registered 6 messaging tools (Redis backend)");
  },
};

export default plugin;
