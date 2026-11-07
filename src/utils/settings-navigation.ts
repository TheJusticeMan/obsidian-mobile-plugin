import type { App } from 'obsidian';

interface ObsidianSettingManager {
  open?: () => void;
  openTabById?: (tabId: string) => void;
}

type AppWithSettingManager = App & {
  setting?: ObsidianSettingManager;
};

/** Open the plugin's settings tab, with a generic-settings fallback. */
export function openPluginSettings(app: App, pluginId: string): void {
  const settingManager = (app as AppWithSettingManager).setting;

  if (
    typeof settingManager?.open === 'function' &&
    typeof settingManager.openTabById === 'function'
  ) {
    settingManager.open();
    settingManager.openTabById(pluginId);
    return;
  }

  app.commands?.executeCommandById?.('app:open-settings');
}
