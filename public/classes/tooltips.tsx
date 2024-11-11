/* eslint-disable @kbn/eslint/require-license-header */
/* eslint-disable react/no-multi-comp */
/* eslint-disable max-classes-per-file */
/* eslint-disable react/prefer-stateless-function */
import React, { Component, useEffect, useState } from 'react';
import type { MapMouseEvent, Popup, Map as MapboxMap } from 'maplibre-gl';
import { KibanaThemeProvider } from '@kbn/kibana-react-plugin/public';
import { EuiPanel, EuiRadioGroup } from '@elastic/eui';
import type { KeyPair } from '../types';
import { tooltipHandlers, getTheme } from '../config';
import { TooltipDescriptor } from './acecard_ems_source';

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
  tooltipProperties?:string[]
}
export class ExtraHandlers extends Component<ExtraHandlersProps> {
  render() {
    const { wmsBase, layer, keypair, map } = this.props;
    return <>{tooltipHandlers.map((handler) => handler(wmsBase, layer, keypair, map))}</>;
  }
}

export class Tooltip extends Component<ExtraHandlersProps> {
  render() {
    const { wmsBase, layer, keypair, map,tooltipProperties } = this.props;
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
        <EuiPanel className="acecard-tooltip-content">
          <KeyPairs pairs={keypair.filter(value=>{
            if(!tooltipProperties){
              return true
            }
            return tooltipProperties.includes(value[0])
            })} />
        </EuiPanel>
      </KibanaThemeProvider>
    ); // TODO Should we always render the keypairs returned by the geo server? maybe as an accordian
  }
}

export const MultiLayerToolTip = (
  props: React.PropsWithChildren<{
    promises: Array<Promise<TooltipDescriptor>>;
    click: MapMouseEvent & Record<string, unknown>;
    popup: Popup;
  }>
) => {
  const theme = getTheme();
  const [state, setState] = useState<{ layers: TooltipDescriptor[]; display: number }>({
    layers: [],
    display: 0,
  });
  useEffect(() => {
    setState({ ...state, layers: [] });
    const awaitPromises = async () => {
      const layers: TooltipDescriptor[] = [];
      props.promises.forEach(async (p) => {
        const element = await p;
        props.popup.addTo(props.click.target);
        layers.push(element);
        setState({ ...state, layers });
      });
    };
    awaitPromises();
  }, [props.promises]);
  const selection = Math.min(state.layers.length - 1, state.display);
  return (
    <KibanaThemeProvider theme$={theme.theme$}>
      <EuiPanel>
        {state.layers.length ? (
          <>
            {state.layers[selection].element}
            {state.layers.length > 1 ? (
              <EuiRadioGroup
                compressed={true}
                legend={{ children: 'Layer', compressed: true }}
                idSelected={String(selection)}
                onChange={(e) => setState({ ...state, display: parseInt(e, 10) })}
                options={state.layers.map((l, i) => ({ id: String(i), label: l.name }))}
              />
            ) : null}
          </>
        ) : null}
      </EuiPanel>
    </KibanaThemeProvider>
  );
};
