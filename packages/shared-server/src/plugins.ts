import { PluginManager } from "@karakeep/shared/plugins";

let pluginsLoaded = false;
export async function loadAllPlugins() {
  if (pluginsLoaded) {
    return;
  }
  // Load plugins here. Order of plugin loading matter.
  await import("@karakeep/plugins-search-meilisearch");
  await import("@karakeep/plugins-search-sqlite");
  PluginManager.logAllPlugins();
  pluginsLoaded = true;
}
