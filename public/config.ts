/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { AcecardEMSConfig } from '../common/config';
import { TooltipHandler } from './types';

let config: AcecardEMSConfig;
export const tooltipHandlers: TooltipHandler[] = [];
export const setConfig = (settings: AcecardEMSConfig) => {
  config = settings;
};
export const getConfig = () => config;
export const registerTootipHandler = (handler: TooltipHandler) => {
  tooltipHandlers.push(handler);
};
