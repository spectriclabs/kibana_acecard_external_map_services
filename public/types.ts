/* eslint-disable @kbn/eslint/require-license-header */

import { NotificationsSetup } from '@kbn/core/public';
import type { Map as MapboxMap } from '@kbn/mapbox-gl';
import { MapsPluginSetup, MapsPluginStart } from '@kbn/maps-plugin/public/plugin';
import { ReactElement } from 'react';

export interface AcecardExternalMapsSourcePluginSetup {
  maps: MapsPluginSetup;
  notifications: NotificationsSetup
}
export interface AcecardExternalMapsSourcePluginStart {
  maps: MapsPluginStart;
}
export interface KeyPair {
  0: string;
  1: string;
}
export type TooltipHandler = (
  wmsBase: string,
  layer: string,
  keypair: KeyPair[],
  map: MapboxMap
) => ReactElement<any> | null;
export interface AcecardExternalMapsSetupApi {
  registerTootipHandler(tooltipHandler: TooltipHandler): void;
}
