// Auto-register the SQLite provider when this package is imported
import { PluginManager, PluginType } from "@karakeep/shared/plugins";

import { SQLiteSearchProvider } from "./src";

PluginManager.register({
  type: PluginType.Search,
  name: "SQLite",
  provider: new SQLiteSearchProvider(),
});
