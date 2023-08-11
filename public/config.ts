/* eslint-disable @kbn/eslint/require-license-header */

import { CoreStart } from '@kbn/core/public';
import { AcecardEMSConfig } from '../common/config';
import { AcecardExternalMapsSourcePluginStart, TooltipHandler } from './types';

let config: AcecardEMSConfig;
let pluginsStart: AcecardExternalMapsSourcePluginStart;
export const tooltipHandlers: TooltipHandler[] = [];
let coreStart: CoreStart;

export function setStartServices(core: CoreStart, plugins: AcecardExternalMapsSourcePluginStart) {
  coreStart = core;
  pluginsStart = plugins;
}
export const getTheme = () => coreStart.theme;
export const getIsDarkMode = () => coreStart.uiSettings.get('theme:darkMode', false);
export const setConfig = (settings: AcecardEMSConfig) => {
  config = settings;
};
export const getConfig = () => config;
export const registerTootipHandler = (handler: TooltipHandler) => {
  tooltipHandlers.push(handler);
};
