/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

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
