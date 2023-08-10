
import {

    Rule,
    Symbolizer
  } from 'geostyler-style';
  import { ToolbarButton } from '@kbn/kibana-react-plugin/public';
  
  import {

    EuiFlexGroup,
    EuiFlexItem,
    EuiFormRow,
    EuiPanel,
    EuiIcon,

  } from '@elastic/eui';
  import { MarkRender, FillRender,TextRender,FilterEditor } from "./"
  import { WFSColumns } from '../acecard_ems_editor';
import React from 'react';

export const RuleRender = ({
    rule,
    onChange,
    columns,
  }: {
    rule: Rule;
    onChange: any;
    columns: WFSColumns[];
  }) => {
    return (
      <EuiFormRow>
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