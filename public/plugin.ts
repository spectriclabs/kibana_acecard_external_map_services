/* eslint-disable @kbn/eslint/require-license-header */

import { AppNavLinkStatus, CoreSetup, CoreStart, NotificationsSetup, Plugin, PluginInitializerContext } from '@kbn/core/public';
import {
  AcecardExternalMapsSetupApi,
  AcecardExternalMapsSourcePluginSetup,
  AcecardExternalMapsSourcePluginStart,
} from './types';
import { AcecardEMSSource } from './classes/acecard_ems_source';
import { acecardEMSLayerWizard } from './classes/acecard_ems_layer_wizard';
import { PLUGIN_ID, PLUGIN_NAME } from '../common';
import { AcecardEMSConfig } from '../common/config';
import { registerTootipHandler, setConfig, setStartServices } from './config';
var notificationService:NotificationsSetup|undefined;
export const  getNotifications = ()=>{
  return notificationService
}
export class AcecardExternalMapsSourcePlugin
  implements
    Plugin<void, void, AcecardExternalMapsSourcePluginSetup, AcecardExternalMapsSourcePluginStart>
{
  readonly _initializerContext: PluginInitializerContext<AcecardEMSConfig>;
  constructor(initializerContext: PluginInitializerContext<AcecardEMSConfig>) {
    this._initializerContext = initializerContext;
  }
  public setup(
    core: CoreSetup<AcecardExternalMapsSourcePluginStart>,
    { maps: mapsSetup }: AcecardExternalMapsSourcePluginSetup
  ): AcecardExternalMapsSetupApi {
    // Register the Custom raster layer wizard with the Maps application
    notificationService=core.notifications
    mapsSetup.registerSource({
      type: AcecardEMSSource.type,
      ConstructorFunction: AcecardEMSSource,
    });
    mapsSetup.registerLayerWizard(acecardEMSLayerWizard);

    // Register an application into the side navigation menu
    core.application.register({
      id: PLUGIN_ID,
      title: PLUGIN_NAME,
      navLinkStatus: "hidden",
      visibleIn: [],
      mount: ({ history }) => {
        (async () => {
          const [coreStart] = await core.getStartServices();
          // if it's a regular navigation, open a new map
          if (history.action === 'PUSH') {
            coreStart.application.navigateToApp('maps', { path: 'map' });
          } else {
            coreStart.application.navigateToApp('developerExamples');
          }
        })();
        return () => {};
      },
    });
    return { registerTootipHandler };
  }

  public start(core: CoreStart, plugins: AcecardExternalMapsSourcePluginStart) {
    const config = this._initializerContext.config.get<AcecardEMSConfig>();
    setStartServices(core, plugins);
    setConfig(config);
  }

  public stop() {}
}
