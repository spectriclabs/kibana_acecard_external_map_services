/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */
/* eslint-disable react/no-multi-comp */
/* eslint-disable max-classes-per-file */
/* eslint-disable react/prefer-stateless-function */
import React, { Component } from 'react';
import type { Map as MapboxMap } from '@kbn/mapbox-gl';
import { KibanaThemeProvider } from '@kbn/kibana-react-plugin/public';
import { EuiPanel } from '@elastic/eui';
import type { KeyPair } from '../types';
import { tooltipHandlers, getTheme } from '../config';
interface Props {
  pairs: KeyPair[];
}

export class KeyPairs extends Component<Props> {
  render() {
    const { pairs } = this.props;
    return (
      <div>
        {pairs.map((p, i) => {
          return (
            <div>
              <p>
                {p[0]} = {p[1]}
              </p>
            </div>
          );
        })}
      </div>
    );
  }
}

interface ExtraHandlersProps {
  wmsBase: string;
  layer: string;
  keypair: KeyPair[];
  map: MapboxMap;
}
export class ExtraHandlers extends Component<ExtraHandlersProps> {
  render() {
    const { wmsBase, layer, keypair, map } = this.props;
    return <>{tooltipHandlers.map((handler) => handler(wmsBase, layer, keypair, map))}</>;
  }
}

export class Tooltip extends Component<ExtraHandlersProps> {
  render() {
    const { wmsBase, layer, keypair, map } = this.props;
    const theme = getTheme();
    const handlers = tooltipHandlers
      .map((handler) => handler(wmsBase, layer, keypair, map))
      .filter((h) => h !== null);
    if (handlers.length) {
      return (
        <KibanaThemeProvider theme$={theme.theme$}>
          <EuiPanel>{handlers}</EuiPanel>
        </KibanaThemeProvider>
      );
    }
    return (
      <KibanaThemeProvider theme$={theme.theme$}>
        <EuiPanel>
          <KeyPairs pairs={keypair} />
        </EuiPanel>
      </KibanaThemeProvider>
    ); // TODO Should we always render the keypairs returned by the geo server? maybe as an accordian
  }
}
