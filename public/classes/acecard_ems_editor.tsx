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
interface State {
  selected: string;
}

export class AcecardEMSEditor extends Component<RenderWizardArguments, State> {
  state = {
    selected: '',
  };
  updatePreview(selection: string): void {
    const config = getConfig();
    const index = config.titles.indexOf(selection);
    const baseUrl = config.urls[index];
    const layer = config.layers[index];
    const acecardEMSLayerDescriptor: LayerDescriptor = {
      id: htmlIdGenerator()(),
      type: LAYER_TYPE.RASTER_TILE,
      sourceDescriptor: AcecardEMSSource.createDescriptor(baseUrl, layer, selection),
      style: {
        type: 'RASTER',
      },
      alpha: 1,
    };
    this.props.previewLayers([acecardEMSLayerDescriptor]);
    this.setState({ selected: selection });
  }
  render() {
    const config = getConfig();
    const selectedOptions: Array<EuiComboBoxOptionOption<string>> = [];
    const { selected } = this.state;
    if (selected !== '') {
      selectedOptions.push({
        value: selected,
        label: selected,
      });
    }
    return (
      <EuiPanel>
        <EuiCallOut title="ACECARD EMS">
          <p>ACECARD External Map services</p>
          <EuiFormRow label={'Select Source'}>
            <EuiComboBox
              singleSelection={true}
              options={titlesToOptions(config.titles)}
              onChange={(e) => {
                const value = e.length ? e[0].value || '' : '';
                this.updatePreview(value);
              }}
              selectedOptions={selectedOptions}
            />
          </EuiFormRow>
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
    const parser = new DOMParser();
    const xml = parser.parseFromString(body, 'text/xml');
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
