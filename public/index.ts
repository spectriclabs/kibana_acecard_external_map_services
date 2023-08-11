/* eslint-disable @kbn/eslint/require-license-header */

import './index.scss';
import { PluginInitializerContext } from '@kbn/core/public';
import { AcecardExternalMapsSourcePlugin } from './plugin';
// This exports static code and TypeScript types,
// as well as, Kibana Platform `plugin()` initializer.
export function plugin(initializerContext: PluginInitializerContext) {
  return new AcecardExternalMapsSourcePlugin(initializerContext);
}
export type {
  AcecardExternalMapsSourcePluginSetup,
  AcecardExternalMapsSourcePluginStart,
  AcecardExternalMapsSetupApi,
} from './types';
