import { TextSymbolizer } from 'geostyler-style';
import { WFSColumns } from '../acecard_ems_editor';
import React from 'react';
import { EuiFormRow, EuiComboBox } from '@elastic/eui';
import { ColorPicker } from '../components/color_picker';


export const TextRender = ({
    symbol,
    onChange,
    columns,
  }: {
    symbol: TextSymbolizer;
    onChange: (symbol: TextSymbolizer) => void;
    columns: WFSColumns[];
  }) => {
    const columnOptions = columns.map((col) => ({ label: col.name, value: `{{${col.name}}}` }));
  
    return (
      <>
        <EuiFormRow label={'Text Label'}>
          <EuiComboBox
            placeholder={'Label'}
            singleSelection={true}
            options={columnOptions}
            onChange={(e) => {
              const value = e.length ? e[0].value || '' : '';
              onChange({ ...symbol, label: value });
            }}
            selectedOptions={
              symbol.label
                ? [{ label: symbol.label as string, value: `{{${symbol.label}}}` as string }]
                : []
            }
          />
        </EuiFormRow>
        <ColorPicker
          label={'Text Color'}
          color={(symbol.color as string) || '#FFFFFF'}
          opacity={(symbol.opacity as number) || 1}
          onChange={({ color, opacity }) => {
            onChange({ ...symbol, color, opacity });
          }}
        />
        <ColorPicker
          label={'Text Outline Color'}
          color={(symbol.haloColor as string) || '#000000'}
          opacity={(symbol.haloOpacity as number) || 1}
          onChange={({ color, opacity }) => {
            onChange({ ...symbol, haloColor: color, haloOpacity: opacity });
          }}
        />
      </>
    );
  };
  