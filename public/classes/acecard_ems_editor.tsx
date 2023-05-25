/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */
/* eslint-disable react/no-multi-comp */
/* eslint-disable max-classes-per-file */
import React, { Component } from 'react';
import { EuiCallOut, EuiFormRow, EuiPanel, htmlIdGenerator } from '@elastic/eui';
import { RenderWizardArguments } from '@kbn/maps-plugin/public';
import { LayerDescriptor, LAYER_TYPE } from '@kbn/maps-plugin/common';
import { EuiComboBox, EuiComboBoxOptionOption } from '@elastic/eui';
import { AcecardEMSSource, AcecardEMSSourceDescriptor } from './acecard_ems_source';
import { getConfig } from '../config';

function titlesToOptions(titles: string[]): Array<EuiComboBoxOptionOption<string>> {
  return titles.map((title) => {
    const option: EuiComboBoxOptionOption<string> = {
      value: title,
      label: title,
    };
    return option;
  });
}
function layersToOptions(layers: AcecardEMSLayers[]): Array<EuiComboBoxOptionOption<string>> {
  return layers.map((layer) => {
    const option: EuiComboBoxOptionOption<string> = {
      value: layer.layer,
      label: layer.title,
    };
    return option;
  });
}
interface AcecardEMSLayers {
  layer: string;
  wmsBaseURL: string;
  wfsBaseURL: string;
  title: string;
}
interface WMSService {
  title: string;
  capabilities: Document;
  baseURL: string;
}
interface State {
  selectedServer: string;
  selectedLayer: string;
  layers: AcecardEMSLayers[];
  services: WMSService[];
}
const XML_PARSER = new DOMParser();
export class AcecardEMSEditor extends Component<RenderWizardArguments, State> {
  state = {
    selectedServer: '',
    selectedLayer: '',
    layers: [] as AcecardEMSLayers[],
    services: [] as WMSService[],
  };
  async _fetchCapabilities(baseUrl: string, service: string) {
    const queryParams = {
      version: '1.3.1',
      request: 'GetCapabilities',
      service,
    };
    const params = new URLSearchParams(queryParams);
    const resp = await fetch(baseUrl + '?' + params);
    if (resp.status >= 400) {
      throw new Error(`Unable to access ${baseUrl}`);
    }
    const body = await resp.text();
    return XML_PARSER.parseFromString(body, 'text/xml');
    // return await parseXmlString(body);
  }
  async _fetchWMSLayers(serviceTitle: string) {
    const { services } = this.state;
    const service = services.find((s) => s.title === serviceTitle);
    if (!service) {
      throw Error("You somehow selected a service that doesn't exist. Good job!");
    }
    const { baseURL, capabilities } = service;
    const capability = capabilities.getElementsByTagNameNS(
      'http://www.opengis.net/wms',
      'Capability'
    )[0];
    const layers = capability.getElementsByTagNameNS('http://www.opengis.net/wms', 'Layer');
    const names = [...layers]
      .filter((l) => l.getElementsByTagNameNS('http://www.opengis.net/wms', 'Layer').length === 0)
      .map((l) => [...l.children].filter((c) => c.tagName === 'Name')[0]);
    // const names = capability.getElementsByTagNameNS('http://www.opengis.net/wms', 'Name');
    const wmsLayers = [...names].map((n) => n.textContent || '').filter((s) => s !== '');
    // now we try to find the WFS service url
    const wfsPath = (await this._getWFSPathForLayers(baseURL, wmsLayers[0])) || baseURL; // If the describelayer doesn't return a wfs url assume we are on OWS and both are provided at the same base url
    const allLayers: AcecardEMSLayers[] = names.map((n) => {
      const layer = n.textContent as string;
      let title = layer;
      if (n.parentElement) {
        title = [...n.parentElement.children].filter((c) => c.tagName === 'Title')[0]
          .textContent as string;
      }
      return {
        layer,
        wmsBaseURL: baseURL,
        wfsBaseURL: wfsPath as string,
        title,
      };
    });
    this.setState({ ...this.state, layers: allLayers });
  }
  async _getWFSPathForLayers(baseURL: string, layer: string) {
    const queryParams = {
      SERVICE: 'WMS',
      REQUEST: 'DescribeLayer',
      SLD_VERSION: '1.1.0',
      LAYERS: layer,
      VERSION: '1.1.1',
      height: '1', // height and width aren't used but are required by some geoservers
      width: '1',
    };
    const params = new URLSearchParams(queryParams);
    const resp = await fetch(baseURL + '?' + params);
    if (resp.status >= 400) {
      throw new Error(`Unable to access ${baseURL}`);
    }
    const body = await resp.text();
    const xml = XML_PARSER.parseFromString(body, 'text/xml');
    const layerDescriptions = [...xml.getElementsByTagName('LayerDescription')];
    return layerDescriptions[0].getAttribute('wfs');
  }
  updatePreview(selection: AcecardEMSLayers): void {
    const baseUrl = selection.wmsBaseURL;
    const layer = selection.layer;
    const acecardEMSLayerDescriptor: LayerDescriptor = {
      id: htmlIdGenerator()(),
      type: LAYER_TYPE.RASTER_TILE,
      sourceDescriptor: AcecardEMSSource.createDescriptor(baseUrl, layer, selection.title),
      style: {
        type: 'RASTER',
      },
      alpha: 1,
    };
    this.props.previewLayers([acecardEMSLayerDescriptor]);
  }
  async componentDidMount() {
    const config = getConfig();
    const services = [];
    for (const url of config.urls) {
      const capabilities: Document = await this._fetchCapabilities(url, 'WMS');
      const title = capabilities.getElementsByTagName('Service')[0].getElementsByTagName('Title')[0]
        .textContent as string;
      services.push({ title, capabilities, baseURL: url });
    }
    this.setState({ ...this.state, services });
  }
  render() {
    const config = getConfig();
    const selectedServerOptions: Array<EuiComboBoxOptionOption<string>> = [];
    const selectedLayerOptions: Array<EuiComboBoxOptionOption<string>> = [];
    const { selectedServer, layers, selectedLayer, services } = this.state;
    if (selectedServer !== '') {
      selectedServerOptions.push({
        value: selectedServer,
        label: selectedServer,
      });
    }
    if (selectedLayer !== '') {
      const layer = layers.find((l) => l.layer === selectedLayer);
      if (layer) {
        selectedLayerOptions.push({
          value: layer.layer,
          label: layer.title,
        });
      }
    }
    return (
      <EuiPanel>
        <EuiCallOut title="ACECARD EMS">
          <p>ACECARD External Map services</p>
          {services.length ? (
            <EuiFormRow label={'Select Source'}>
              <EuiComboBox
                singleSelection={true}
                options={titlesToOptions(services.map((s) => s.title))}
                onChange={(e) => {
                  const value = e.length ? e[0].value || '' : '';
                  this.setState({ selectedServer: value });
                  this._fetchWMSLayers(value);
                }}
                selectedOptions={selectedServerOptions}
              />
            </EuiFormRow>
          ) : null}
          {layers.length ? (
            <EuiFormRow label={'Select Layer'}>
              <EuiComboBox
                singleSelection={true}
                options={layersToOptions(layers)}
                onChange={(e) => {
                  const value = e.length ? e[0].value || '' : '';
                  this.setState({ selectedLayer: value });
                  const layer = layers.find((l) => l.layer === value);
                  if (layer) {
                    this.updatePreview(layer);
                  }
                }}
                selectedOptions={selectedLayerOptions}
              />
            </EuiFormRow>
          ) : null}
        </EuiCallOut>
      </EuiPanel>
    );
  }
}

interface Props {
  handlePropertyChange: (settings: Partial<AcecardEMSSourceDescriptor>) => void;
  layer: AcecardEMSSource;
  descriptor: AcecardEMSSourceDescriptor;
}
interface WFSColumns {
  name: string;
  type: string;
}

interface SettingsState {
  selected: string;
  columns: WFSColumns[];
}
const GEO_COLUMN_TYPES = [
  'PointPropertyType',
  'MultiCurvePropertyType',
  'MultiSurfacePropertyType',
];
export class AcecardEMSSettingsEditor extends Component<Props, SettingsState> {
  state = {
    selected: '',
    columns: [],
  };
  componentDidMount() {
    this._fetchWFSColumns();
  }
  // TODO move this into source creation? Is source a live source. Can it support geo queries?
  async _fetchWFSColumns(): Promise<void> {
    const queryParams = {
      version: '2.0.0',
      request: 'DescribeFeatureType',
      service: 'WFS',
      typeName: this.props.descriptor.layer,
    };
    const params = new URLSearchParams(queryParams);
    const resp = await fetch(this.props.descriptor.baseUrl + '?' + params);
    if (resp.status >= 400) {
      throw new Error(`Unable to access ${this.props.descriptor.baseUrl}`);
    }
    const body = await resp.text();
    const xml = XML_PARSER.parseFromString(body, 'text/xml');
    const elements = xml.getElementsByTagNameNS('http://www.w3.org/2001/XMLSchema', 'element');
    let columns = [...elements].map((e) =>
      Object.fromEntries([...e.attributes].map((a) => [a.name, a.value]))
    ) as unknown as WFSColumns[];
    columns = columns.map((c) => {
      c.type = c.type.replace('xsd:', '');
      c.type = c.type.replace('gml:', '');
      return c;
    });
    this.setState({ ...this.state, columns });
  }
  render() {
    const timeSelection =
      this.props.descriptor.timeColumn === ''
        ? []
        : [{ value: this.props.descriptor.timeColumn, label: this.props.descriptor.timeColumn }];
    const geoSelection =
      this.props.descriptor.geoColumn === ''
        ? []
        : [{ value: this.props.descriptor.geoColumn, label: this.props.descriptor.geoColumn }];
    return (
      <EuiPanel>
        <EuiFormRow label={'Time Column'}>
          <EuiComboBox
            placeholder={'Select Time Column To Utilize Time filters'}
            singleSelection={true}
            options={this.state.columns
              .filter((c: { type: string }) => c.type === 'dateTime')
              .map((c: { name: any }) => ({
                value: c.name,
                label: c.name,
              }))}
            onChange={(e) => {
              const value = e.length ? e[0].value || '' : '';
              this.props.handlePropertyChange({ timeColumn: value });
            }}
            selectedOptions={timeSelection}
          />
        </EuiFormRow>
        <EuiFormRow label={'Geo Spatial Column'}>
          <EuiComboBox
            placeholder={'Select Geo Column to Utilize Geo filters'}
            singleSelection={true}
            options={this.state.columns
              .filter((c: { type: string }) => GEO_COLUMN_TYPES.includes(c.type))
              .map((c: { name: any }) => ({
                value: c.name,
                label: c.name,
              }))}
            onChange={(e) => {
              const value = e.length ? e[0].value || '' : '';
              this.props.handlePropertyChange({ geoColumn: value });
            }}
            selectedOptions={geoSelection}
          />
        </EuiFormRow>
      </EuiPanel>
    );
  }
}
