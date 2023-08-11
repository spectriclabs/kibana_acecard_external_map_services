/* eslint-disable @kbn/eslint/require-license-header */

import { EuiComboBox, EuiFormRow } from '@elastic/eui';
import React from 'react';
import { MarkSymbolizer } from 'geostyler-style';
import { WFSColumns } from '../acecard_ems_editor';
import { getConfig } from '../../config';
import { ColorPicker } from '../components/color_picker';
const WELL_KNOWN_NAMES = ['circle', 'square', 'triangle', 'star', 'cross', 'x'];
const CUSTOM_SYMBOLS = [
  'wkt://POLYGON((-0.15 -0.25, -0.15 0.25, 0.15 0.25, 0.15 -0.25, 0.25 -0.25, 0.25 0.35, -0.25 0.35, -0.25 -0.25, -0.25 -0.25, -0.15 -0.25))',
  'wkt://POLYGON((-0.15 -0.25, 0 0.25,0.15 -0.25,0.25 -0.25,0.0 0.45,-0.25 -0.25,-0.15 -0.25))',
  'wkt://POLYGON((-0.15 0.25, -0.15 -0.25, 0.15 -0.25,0.15 0.25,0.25 0.25, 0.25 -0.35,-0.25 -0.35,-0.25 0.25,-0.25 0.25))',
  'wkt://MULTILINESTRING((-0.25 0.25, -0.25 -0.25, 0.25 -0.25,0.25 0.25), (-0.20 0.30,0.2 0.30))', // FIXME change me to a multi polygon because the fill on line strings creates undesired shape
  'wkt://POLYGON((-0.15 0.15, -0.15 -0.25, 0.15 -0.25,0.15 0.25,0.25 0.25, 0.25 -0.35,-0.25 -0.35,-0.25 0.25,0.15 0.25,0.15 0.15,-0.15 0.15))',
];

export const MarkRender = ({
  symbol,
  onChange,
  columns,
}: {
  symbol: MarkSymbolizer;
  onChange: any;
  columns: WFSColumns[];
}) => {
  const pointOptions = [
    ...WELL_KNOWN_NAMES.map((v) => ({ value: v, label: v })),
    ...CUSTOM_SYMBOLS.map((s, i) => ({ value: s, label: getConfig().customSymbolLabels[i] })),
  ];
  const selectedOption = pointOptions.find((option) => option.value === symbol.wellKnownName);
  const selectedOptions = selectedOption ? [selectedOption] : [];
  return (
    <div>
      <EuiFormRow label={'Point Type'}>
        <EuiComboBox
          placeholder={'Point Symbol'}
          singleSelection={true}
          options={pointOptions}
          onChange={(e) => {
            const value = e.length ? e[0].value || '' : '';
            if (value !== '') {
              onChange({ ...symbol, wellKnownName: value });
            }
          }}
          selectedOptions={selectedOptions}
        />
      </EuiFormRow>
      <ColorPicker
        label={'Point  Color'}
        color={(symbol.color as string) || '#FF0000'}
        opacity={(symbol.opacity as number) || 1}
        onChange={({ color, opacity }) => {
          onChange({ ...symbol, color, opacity });
        }}
      />
    </div>
  );
};
