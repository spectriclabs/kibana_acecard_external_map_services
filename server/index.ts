/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import {
  CoreSetup,
  PluginInitializerContext,
  Plugin,
  PluginConfigDescriptor,
} from '@kbn/core/server';
import { mapConfigSchema } from '../common/config';
import type { AcecardEMSConfig } from '../common/config';

export const config: PluginConfigDescriptor<AcecardEMSConfig> = {
  exposeToBrowser: {
    urls: true,
  },
  schema: mapConfigSchema,
};

export interface AcecardEMSPluginServerSetup {
  config: AcecardEMSConfig;
}

export class AcecardEMSPlugin implements Plugin<AcecardEMSPluginServerSetup> {
  readonly _initializerContext: PluginInitializerContext<AcecardEMSConfig>;

  constructor(initializerContext: PluginInitializerContext<AcecardEMSConfig>) {
    this._initializerContext = initializerContext;
  }

  public setup(core: CoreSetup) {
    const mapConfig = this._initializerContext.config.get();
    return {
      config: mapConfig,
    };
  }

  public start() {}
}

export const plugin = (initializerContext: PluginInitializerContext) =>
  new AcecardEMSPlugin(initializerContext);
