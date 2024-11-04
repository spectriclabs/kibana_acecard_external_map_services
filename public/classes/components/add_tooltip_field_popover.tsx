
/* eslint-disable @typescript-eslint/consistent-type-definitions */

import React, { Component, Fragment } from 'react';
import {
    EuiPopover,
    EuiPopoverFooter,
    EuiPopoverTitle,
    EuiButtonEmpty,
    EuiSelectable,
    EuiSelectableOption,
    EuiButton,
    EuiSpacer,
    EuiTextAlign,
    EuiText,
    EuiButtonIcon
} from '@elastic/eui';
import { FormattedMessage } from '@kbn/i18n-react';
import { i18n } from '@kbn/i18n';
import { FieldIcon } from '@kbn/react-field';
import { WFSColumns } from '../acecard_ems_editor';
import { AcecardEMSSourceDescriptor } from "../acecard_ems_source"
import { OnSourceChangeArgs } from '@kbn/maps-plugin/public/classes/sources/source';

export type FieldProps = {
    label: string;
    type: string;
    name: string;
};

type FieldOption = EuiSelectableOption<{ value: string }>;

function sortByLabel(a: EuiSelectableOption, b: EuiSelectableOption): number {
    return a.label.localeCompare(b.label);
}

function getOptions(fields: FieldProps[], selectedFields: FieldProps[]): EuiSelectableOption[] {
    if (!fields) {
        return [];
    }

    return fields
        .filter((field) => {
            // remove selected fields
            const isFieldSelected = !!selectedFields.find((selectedField) => {
                return field.name === selectedField.name;
            });
            return !isFieldSelected;
        })
        .map((field) => {
            return {
                value: field.name,
                prepend:
                    'type' in field ? (
                        <FieldIcon className="eui-alignMiddle" type={field.type} fill="none" />
                    ) : null,
                label: field.label,
            };
        })
        .sort(sortByLabel);
}

interface Props {
    onChange(...args: OnSourceChangeArgs[]): void;
    descriptor: AcecardEMSSourceDescriptor;
}

interface State {
    isPopoverOpen: boolean;
    checkedFields: string[];
    options?: FieldOption[];
    prevFields?: FieldProps[];
    prevSelectedFields?: FieldProps[];
    fields: FieldProps[];
}

export class AddTooltipFieldPopover extends Component<Props, State> {
    state: State = {
        isPopoverOpen: false,
        checkedFields: [],
        fields: []
    };

    _togglePopover = () => {
        this.setState((prevState) => ({
            isPopoverOpen: !prevState.isPopoverOpen,
        }));
    };

    _closePopover = () => {
        this.setState({
            isPopoverOpen: false,
        });
    };

    _onSelect = (options: FieldOption[]) => {
        const checkedFields: string[] = options
            .filter((option) => {
                return option.checked === 'on';
            })
            .map((option) => {
                return option.value;
            });

        this.setState({
            checkedFields,
            options,
        });
    };

    _onAdd = () => {
        this.props.onChange({ propName: 'tooltipProperties', value:  this.state.checkedFields});
        this.setState({ checkedFields: [] });
        this._closePopover();
    };

    _renderAddButton() {
        return (
            <EuiButtonEmpty
                onClick={this._togglePopover}
                size="xs"
                iconType="plusInCircleFilled"
                isDisabled={!this.props.descriptor.wfsColumns}
            >
                <FormattedMessage id="xpack.maps.tooltipSelector.togglePopoverLabel" defaultMessage="Add" />
            </EuiButtonEmpty>
        );
    }

    _renderContent() {
        const addLabel =
            this.state.checkedFields.length === 0
                ? i18n.translate('xpack.maps.tooltipSelector.addLabelWithoutCount', {
                    defaultMessage: 'Add',
                })
                : i18n.translate('xpack.maps.tooltipSelector.addLabelWithCount', {
                    defaultMessage: 'Add {count}',
                    values: { count: this.state.checkedFields.length },
                });
        let columns = this.props.descriptor.wfsColumns || []
        
        return (
            <Fragment>
                <EuiSelectable<FieldOption>
                    searchable
                    searchProps={{ compressed: true }}
                    options={columns.map(column => ({
                        value: column.name,
                        type: column.localType,
                        name: column.name,
                        label: column.name,
                        checked:(this.props.descriptor.tooltipProperties||[])?.includes(column.name)?'on':undefined
                    }))}
                    onChange={this._onSelect}
                >
                    {(list, search) => (
                        <div style={{ width: '300px' }}>
                            <EuiPopoverTitle paddingSize="s">{search}</EuiPopoverTitle>
                            {list}
                        </div>
                    )}
                </EuiSelectable>

                <EuiSpacer size="xs" />
                <EuiPopoverFooter paddingSize="s">
                    <EuiTextAlign textAlign="right">
                        <EuiButton
                            fill
                            isDisabled={this.state.checkedFields.length === 0}
                            onClick={this._onAdd}
                            size="s"
                        >
                            {addLabel}
                        </EuiButton>
                    </EuiTextAlign>
                </EuiPopoverFooter>
            </Fragment>
        );
    }

    render() {
        return (<>
                {(this.props.descriptor.tooltipProperties||[])
                .map((column,i)=>{
                    return (<>
                                          <EuiText size="s">
                        {column}
                      </EuiText>
                      <div className="mapTooltipSelector__propertyIcons">
                        <EuiButtonIcon
                          iconType="trash"
                          color="danger"
                          onClick={()=>{
                            this.props.descriptor.tooltipProperties?.splice(i,1)
                            this.props.onChange({ propName: 'tooltipProperties', value:  this.props.descriptor.tooltipProperties})
                          }}
                          title={i18n.translate('xpack.maps.tooltipSelector.trashButtonTitle', {
                            defaultMessage: 'Remove property',
                          })}
                          aria-label={i18n.translate(
                            'xpack.maps.tooltipSelector.trashButtonAriaLabel',
                            {
                              defaultMessage: 'Remove property',
                            }
                          )}
                        />
                        </div>
                    </>)
                })}
                <EuiSpacer size="s" />
                <EuiTextAlign textAlign="center">
                    <EuiPopover
                        id="addTooltipFieldPopover"
                        anchorPosition="leftCenter"
                        button={this._renderAddButton()}
                        isOpen={this.state.isPopoverOpen}
                        closePopover={this._closePopover}
                        panelPaddingSize="none"
                        ownFocus
                    >
                        {this._renderContent()}
                    </EuiPopover>
                </EuiTextAlign>
            </>
        );
    }
}
