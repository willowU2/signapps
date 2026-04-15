/**
 * Plugin system — sandboxed extension architecture
 */

export interface Plugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  enabled: boolean;
  hooks: Record<string, string>;
  permissions: string[];
}

export interface PluginHook {
  name: string;
  callback: (...args: unknown[]) => unknown;
}

class PluginRegistry {
  private plugins: Map<string, Plugin> = new Map();
  private hooks: Map<string, PluginHook[]> = new Map();

  register(plugin: Plugin) {
    this.plugins.set(plugin.id, plugin);
  }

  unregister(pluginId: string) {
    this.plugins.delete(pluginId);
    this.hooks.forEach((hooks, name) => {
      this.hooks.set(
        name,
        hooks.filter((h) => !h.name.startsWith(pluginId)),
      );
    });
  }

  addHook(
    hookName: string,
    pluginId: string,
    callback: (...args: unknown[]) => unknown,
  ) {
    if (!this.hooks.has(hookName)) this.hooks.set(hookName, []);
    this.hooks
      .get(hookName)!
      .push({ name: `${pluginId}:${hookName}`, callback });
  }

  async executeHook(hookName: string, ...args: unknown[]): Promise<unknown[]> {
    const hooks = this.hooks.get(hookName) || [];
    const results: unknown[] = [];
    for (const hook of hooks) {
      try {
        results.push(await hook.callback(...args));
      } catch (e) {
        console.error(`Plugin hook error [${hook.name}]:`, e);
      }
    }
    return results;
  }

  getPlugins(): Plugin[] {
    return [...this.plugins.values()];
  }

  getPlugin(id: string): Plugin | undefined {
    return this.plugins.get(id);
  }
}

export const pluginRegistry = new PluginRegistry();
