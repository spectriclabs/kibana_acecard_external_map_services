/* eslint-disable @kbn/eslint/require-license-header */
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
    customSymbolLabels: true,
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
