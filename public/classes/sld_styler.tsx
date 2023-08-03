/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import React, { useState } from 'react';
import uuid from 'uuid';
import {
  Style,
  Rule,
  Symbolizer,
  MarkSymbolizer,
  FillSymbolizer,
  TextSymbolizer,
  Filter,
  CombinationOperator,
  ComparisonOperator,
  ComparisonFilter,
} from 'geostyler-style';
import { ToolbarButton } from '@kbn/kibana-react-plugin/public';

import {
  EuiButton,
  EuiComboBox,
  EuiFlexGroup,
  EuiFlexItem,
  EuiFormRow,
  EuiPanel,
  EuiIcon,
  EuiFieldText,
} from '@elastic/eui';
import { ColorPicker } from './components/color_picker';
import { getConfig } from '../config';
import { WFSColumns } from './acecard_ems_editor';

const WELL_KNOWN_NAMES = ['circle', 'square', 'triangle', 'star', 'cross', 'x'];
const CUSTOM_SYMBOLS = [
  'wkt://POLYGON((-0.15 -0.25, -0.15 0.25, 0.15 0.25, 0.15 -0.25, 0.25 -0.25, 0.25 0.35, -0.25 0.35, -0.25 -0.25, -0.25 -0.25, -0.15 -0.25))',
  'wkt://POLYGON((-0.15 -0.25, 0 0.25,0.15 -0.25,0.25 -0.25,0.0 0.45,-0.25 -0.25,-0.15 -0.25))',
  'wkt://POLYGON((-0.15 0.25, -0.15 -0.25, 0.15 -0.25,0.15 0.25,0.25 0.25, 0.25 -0.35,-0.25 -0.35,-0.25 0.25,-0.25 0.25))',
  'wkt://MULTILINESTRING((-0.25 0.25, -0.25 -0.25, 0.25 -0.25,0.25 0.25), (-0.20 0.30,0.2 0.30))', // FIXME change me to a multi polygon because the fill on line strings creates undesired shape
  'wkt://POLYGON((-0.15 0.15, -0.15 -0.25, 0.15 -0.25,0.15 0.25,0.25 0.25, 0.25 -0.35,-0.25 -0.35,-0.25 0.25,0.15 0.25,0.15 0.15,-0.15 0.15))',
];

interface Props {
  setStyle: (style: any) => void;
  layerName: string;
  columns: WFSColumns[];
}

interface State {
  style: Style;
}

const TextRender = ({
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
const FillRender = ({
  symbol,
  onChange,
  columns,
}: {
  symbol: FillSymbolizer;
  onChange: (symbol: FillSymbolizer) => void;
  columns: WFSColumns[];
}) => {
  return (
    <div>
      <ColorPicker
        label={'Polygon Fill Color'}
        color={(symbol.color as string) || '#FF0000'}
        opacity={(symbol.fillOpacity as number) || 1}
        onChange={({ color, opacity }) => {
          onChange({ ...symbol, color, fillOpacity: opacity });
        }}
      />
      <ColorPicker
        label={'Polygon Outline Color'}
        color={(symbol.outlineColor as string) || '#FF0000'}
        opacity={(symbol.outlineOpacity as number) || 1}
        onChange={({ color, opacity }) => {
          onChange({ ...symbol, outlineColor: color, outlineOpacity: opacity });
        }}
      />
    </div>
  );
};
const SingleFilter = ({
  filter,
  onChange,
  columns,
}: {
  filter: any[];
  onChange: (filter: Filter) => void;
  columns: WFSColumns[];
}) => {
  const columnOptions = columns.map((col) => ({ label: col.name, value: col.name }));
  const comparisonOperators = ['==', '*=', '!=', '<', '<=', '>', '>='];
  const operationOptions = [
    { label: 'Equal To', value: '==' },
    { label: 'Not Equal To', value: '!=' },
    { label: 'Like', value: '*=' },
    { label: '<', value: '<' },
    { label: '<=', value: '<=' },
    { label: '>', value: '>' },
    { label: '>=', value: '>=' },
  ];

  return (
    <>
      <EuiFlexGroup gutterSize="none">
        <EuiFlexItem grow={true}>
          <EuiComboBox
            placeholder={'Column'}
            singleSelection={true}
            options={columnOptions}
            isClearable={false}
            onChange={(e) => {
              const value = e.length ? e[0].value || '' : '';
              onChange([filter[0], value, filter[2]]);
            }}
            selectedOptions={[{ label: filter[1] as string, value: filter[1] as string }]}
          />
        </EuiFlexItem>
        <EuiFlexItem grow={true}>
          <EuiComboBox
            placeholder={'Operation'}
            singleSelection={true}
            options={operationOptions}
            isClearable={false}
            onChange={(e) => {
              const value = e.length ? e[0].value || '' : '';
              if (comparisonOperators.includes(value)) {
                onChange([value as ComparisonOperator, filter[1], filter[2]]);
              }
            }}
            selectedOptions={[{ label: filter[0] as string, value: filter[0] as string }]}
          />
        </EuiFlexItem>
      </EuiFlexGroup>
      <EuiFieldText
        value={filter[2]}
        onChange={(e) => {
          const value = e.target.value;
          onChange([filter[0], filter[1], value]);
        }}
      />
    </>
  );
};
const FilterEditor = ({
  filter,
  onChange,
  columns,
}: {
  filter: Filter | undefined;
  onChange: (filter: Filter) => void;
  columns: WFSColumns[];
}) => {
  const column = columns.find((c) => c.localType === 'string' || c.localType === 'number');
  const firstColumn = column ? column.name : false;
  let filters;
  const operators = ['||', '&&'];
  const operatorNames = ['AND', 'OR'];
  if (filter) {
    const filterArray = filter as any[];
    const operator = filterArray[0];
    if (operators.includes(operator)) {
      filters = filterArray.slice(1);
    } else {
      filters = [filterArray];
    }
  }
  const [state, setState] = useState<{ filters: ComparisonFilter[] | any[]; operator: number }>({
    filters: [],
    operator: 0,
  });
  const ouputFilter = () => {
    if (state.filters.length === 1) {
      onChange(state.filters[0]);
    }
    if (state.filters.length > 1) {
      onChange([operators[state.operator] as CombinationOperator, ...state.filters]);
    }
  };
  // s.rules[0].filter = [ '||', ['==', 'id', 'value'],['==', 'id', 'test']]
  return (
    <EuiPanel>
      <EuiButton
        disabled={!firstColumn} // If we don't have a column we cant add a filter
        onClick={() => {
          const newFilters = [...state.filters, ['==', firstColumn, 'value']];
          setState({ ...state, filters: newFilters });
          ouputFilter();
        }}
      >
        Add Style Condition
      </EuiButton>
      <EuiButton
        onClick={() => {
          setState({ ...state, operator: state.operator === 0 ? 1 : 0 });
          ouputFilter();
        }}
      >
        {operatorNames[state.operator]}
      </EuiButton>
      {state.filters.map((f, i) => {
        return (
          <SingleFilter
            filter={f}
            columns={columns}
            onChange={(newFilter) => {
              state.filters[i] = newFilter;
              setState({ ...state });
              ouputFilter();
            }}
          />
        );
      })}
    </EuiPanel>
  );
};
const MarkRender = ({
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
const RuleRender = ({
  rule,
  onChange,
  columns,
  title,
}: {
  rule: Rule;
  onChange: any;
  columns: WFSColumns[];
  title: string;
}) => {
  return (
    <EuiFormRow label={title}>
      <EuiPanel color="primary">
        <EuiFlexGroup>
          <EuiFlexItem grow={true}>
            <ToolbarButton
              fontWeight="normal"
              color="primary"
              onClick={() => {
                rule.symbolizers.push({
                  kind: 'Text',
                  color: '#FFFFFF',
                  opacity: 1,
                  haloColor: '#000000',
                  haloOpacity: 1,
                });
                onChange(rule);
              }}
              title={'Add Text'}
              hasArrow={false}
              isDisabled={rule.symbolizers.findIndex((s) => s.kind === 'Text') !== -1}
            >
              <EuiIcon color="primary" type={'visText'} />
            </ToolbarButton>
          </EuiFlexItem>

          <EuiFlexItem grow={true}>
            <ToolbarButton
              fontWeight="normal"
              color="primary"
              title="Point Style"
              hasArrow={false}
              isDisabled={rule.symbolizers.findIndex((s) => s.kind === 'Mark') !== -1}
              onClick={() => {
                rule.symbolizers.push({
                  kind: 'Mark',
                  wellKnownName: 'circle',
                  color: '#FF0000',
                  opacity: 1,
                });
                onChange(rule);
              }}
            >
              <EuiIcon color="primary" type={'pin'} />
            </ToolbarButton>
          </EuiFlexItem>
          <EuiFlexItem grow={true}>
            <ToolbarButton
              color="primary"
              title="Polygon Style"
              hasArrow={false}
              isDisabled={rule.symbolizers.findIndex((s) => s.kind === 'Fill') !== -1}
              onClick={() => {
                rule.symbolizers.push({
                  kind: 'Fill',
                  color: '#FF0000',
                  fillOpacity: 1,
                  outlineColor: '#FF0000',
                  outlineOpacity: 1,
                });
                onChange(rule);
              }}
            >
              <EuiIcon color="primary" type={'container'} />
            </ToolbarButton>
          </EuiFlexItem>
        </EuiFlexGroup>

        {rule.symbolizers.map((symbol, i) => {
          if (symbol.kind === 'Mark') {
            return (
              <EuiPanel>
                <MarkRender
                  columns={columns}
                  symbol={symbol}
                  onChange={(newSymbol: Symbolizer) => {
                    rule.symbolizers[i] = newSymbol;
                    onChange(rule);
                  }}
                />
              </EuiPanel>
            );
          } else if (symbol.kind === 'Fill') {
            return (
              <EuiPanel>
                <FillRender
                  columns={columns}
                  symbol={symbol}
                  onChange={(newSymbol: Symbolizer) => {
                    rule.symbolizers[i] = newSymbol;
                    onChange(rule);
                  }}
                />
              </EuiPanel>
            );
          } else if (symbol.kind === 'Text') {
            return (
              <EuiPanel>
                <TextRender
                  columns={columns}
                  symbol={symbol}
                  onChange={(newSymbol: Symbolizer) => {
                    rule.symbolizers[i] = newSymbol;
                    onChange(rule);
                  }}
                />
              </EuiPanel>
            );
          }
        })}
        {rule.symbolizers.length ? ( // Only show conditionals if there are style rules
          <FilterEditor
            filter={rule.filter}
            columns={columns}
            onChange={(filter) => {
              rule.filter = filter;
              onChange(rule);
            }}
          />
        ) : null}
      </EuiPanel>
    </EuiFormRow>
  );
};
export const SldStyleEditor: React.FC<Props> = ({
  setStyle,
  layerName,
  columns,
}: Props): JSX.Element => {
  const [state, setState] = useState<State>({ style: { name: layerName, rules: [] } });
  return (
    <div>
      <EuiButton
        onClick={() => {
          state.style.rules.push({
            name: 'Rule_' + uuid.v4(),
            symbolizers: [],
          });
          setState({ style: { ...state.style, rules: [...state.style.rules] } });
        }}
      >
        Add Custom Style Rule
      </EuiButton>
      {state.style.rules.map((rule, i) => (
        <RuleRender
          columns={columns}
          rule={rule}
          title={`Style Rule #${i + 1}`}
          onChange={(newRule: Rule) => {
            const rules = [...state.style.rules];
            rules[i] = newRule;
            setStyle({ ...state.style, rules: [...rules] });
            setState({ style: { ...state.style, rules: [...rules] } });
          }}
        />
      ))}
    </div>
  );
};
