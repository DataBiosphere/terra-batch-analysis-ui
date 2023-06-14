import _ from 'lodash/fp'
import { useState } from 'react'
import { div, h } from 'react-hyperscript-helpers'
import { AutoSizer } from 'react-virtualized'
import { ButtonPrimary, Link } from 'src/components/common'
import Modal from 'src/components/Modal'
import {
  inputsMissingRequiredAttributes,
  InputSourceSelect, inputsWithIncorrectValues,
  ParameterValueTextInput,
  RecordLookupSelect,
  requiredInputsWithoutSource,
  StructBuilderLink,
  WithWarnings
} from 'src/components/submission-common'
import { FlexTable, HeaderCell, InputsButtonRow, TextCell } from 'src/components/table'
import * as Utils from 'src/libs/utils'
import { isInputOptional } from 'src/libs/utils'


const buildStructTypePath = indexPath => _.join('.', _.map(row => `fields.${row}.field_type`, indexPath))
const buildStructSourcePath = indexPath => _.join('.', _.map(row => `fields.${row}.source`, indexPath))
const buildStructTypeNamePath = indexPath => _.replace(/\.field_type$/, '.field_name', buildStructTypePath(indexPath))
const buildStructSourceNamePath = indexPath => _.replace(/\.source$/, '.name', buildStructSourcePath(indexPath))

export const buildStructBreadcrumbs = (indexPath, structType) => _.map(
  // map slices of the indexPath (e.g. [0, 1, 2] -> [0], [0, 1], [0, 1, 2])
  // onto their corresponding field_names within structType, via buildStructTypeNamePath
  end => _.get(buildStructTypeNamePath(_.slice(0, end + 1, indexPath)), structType),
  _.range(0, indexPath.length)
)

export const StructBuilder = props => {
  const {
    structName,
    structType,
    structSource,
    setStructSource,
    dataTableAttributes,
    structIndexPath,
    setStructIndexPath
  } = props

  const [includeOptionalInputs, setIncludeOptionalInputs] = useState(true)
  const [searchFilter, setSearchFilter] = useState('')
  const [prevStructIndex, setPrevStructIndex] = useState(structIndexPath)

  if (structIndexPath !== prevStructIndex) {
    setSearchFilter('')
    setIncludeOptionalInputs(true)
    setPrevStructIndex(structIndexPath)
  }

  const structTypePath = buildStructTypePath(structIndexPath)
  const structSourcePath = buildStructSourcePath(structIndexPath)
  const structTypeNamePath = buildStructTypeNamePath(structIndexPath)

  const currentStructType = structTypePath ? _.get(structTypePath, structType) : structType
  const currentStructSource = structSourcePath ? _.get(structSourcePath, structSource) : structSource
  const currentStructName = structTypeNamePath ? _.get(structTypeNamePath, structType) : structName

  const setCurrentStructSource = structSourcePath ? source => setStructSource(_.set(structSourcePath, source, structSource)) : setStructSource

  const structInputDefinition = _.map(([source, type]) => _.merge(source, type), _.zip(currentStructSource.fields, currentStructType.fields))
  const currentStructBreadcrumbs = buildStructBreadcrumbs(structIndexPath, structType)

  const missingExpectedAttributes = _.map(i => i.field_name, inputsMissingRequiredAttributes(structInputDefinition, dataTableAttributes))
  const missingRequiredInputs = _.map(i => i.field_name, requiredInputsWithoutSource(structInputDefinition))
  const inputsWithInvalidValues = _.map(i => i.field_name, inputsWithIncorrectValues(structInputDefinition))

  const inputTableData = _.flow(
    _.entries,
    _.map(([index, row]) => {
      return _.flow([
        _.set('inputTypeStr', Utils.renderTypeText(row.field_type)),
        _.set('configurationIndex', parseInt(index)),
        _.set('optional', Utils.isInputOptional(row.field_type))
      ])(row)
    }),
    _.orderBy([({ field_name: name }) => _.lowerCase(name)], ['asc']),
    _.filter(_.overEvery([
      ({ optional }) => includeOptionalInputs || !optional,
      ({ field_name: name }) => name.includes(searchFilter)
    ]))
  )(structInputDefinition)

  const breadcrumbsHeight = 35
  return h(div, { style: { height: 500 } }, [
    h(div, {
      'aria-label': 'struct-breadcrumbs',
      style: {
        height: breadcrumbsHeight,
        fontSize: 15,
        display: 'flex',
        alignItems: 'center'
      }
    }, [
      h(TextCell, {}, [
        ..._.map(([i, name]) => h(Link, {
          onClick: () => setStructIndexPath(_.slice(0, i, structIndexPath))
        }, `${name} / `), _.toPairs(_.initial([structName, ...currentStructBreadcrumbs]))),
        currentStructName
      ])
    ]),
    h(InputsButtonRow, {
      optionalButtonProps: {
        includeOptionalInputs, setIncludeOptionalInputs
      },
      searchProps: {
        searchFilter, setSearchFilter
      }
    }),
    h(AutoSizer, [({ width, height }) => {
      return h(div, {}, [
        h(FlexTable, {
          'aria-label': 'struct-table',
          rowCount: inputTableData.length,
          readOnly: false,
          height: ((!includeOptionalInputs || _.some(row => row.field_type.type === 'optional', currentStructType.fields)) ? height * 0.92 : height) - breadcrumbsHeight,
          width,
          columns: [
            {
              size: { basis: 250, grow: 0 },
              field: 'struct',
              headerRenderer: () => h(HeaderCell, ['Struct']),
              cellRenderer: () => {
                return h(TextCell, { style: { fontWeight: 500 } }, [currentStructName])
              }
            },
            {
              size: { basis: 160, grow: 0 },
              field: 'field',
              headerRenderer: () => h(HeaderCell, ['Variable']),
              cellRenderer: ({ rowIndex }) => {
                return h(TextCell, { style: Utils.inputTypeStyle(inputTableData[rowIndex].field_type) }, [inputTableData[rowIndex].field_name])
              }
            },
            {
              size: { basis: 160, grow: 0 },
              field: 'type',
              headerRenderer: () => h(HeaderCell, ['Type']),
              cellRenderer: ({ rowIndex }) => {
                return h(TextCell, { style: Utils.inputTypeStyle(inputTableData[rowIndex].field_type) }, [inputTableData[rowIndex].inputTypeStr])
              }
            },
            {
              size: { basis: 350, grow: 0 },
              headerRenderer: () => h(HeaderCell, ['Input sources']),
              cellRenderer: ({ rowIndex }) => {
                const configurationIndex = inputTableData[rowIndex].configurationIndex
                const typePath = buildStructTypePath([configurationIndex])
                const typeNamePath = buildStructTypeNamePath([configurationIndex])
                const sourcePath = buildStructSourcePath([configurationIndex])
                const sourceNamePath = buildStructSourceNamePath([configurationIndex])
                return InputSourceSelect({
                  source: _.get(sourcePath, currentStructSource),
                  setSource: source => {
                    const newSource = _.flow([
                      _.set(sourceNamePath, _.get(sourceNamePath, currentStructSource) || _.get(typeNamePath, currentStructType)),
                      _.set(sourcePath, source)
                    ])(currentStructSource)
                    setCurrentStructSource(newSource)
                  },
                  inputType: _.get(typePath, currentStructType)
                })
              }
            },
            {
              headerRenderer: () => h(HeaderCell, ['Attribute']),
              cellRenderer: ({ rowIndex }) => {
                const configurationIndex = inputTableData[rowIndex].configurationIndex
                const typeNamePath = buildStructTypeNamePath([configurationIndex])
                const sourcePath = buildStructSourcePath([configurationIndex])
                const sourceNamePath = buildStructSourceNamePath([configurationIndex])
                const innerStructSource = _.get(sourcePath, currentStructSource)
                const setInnerStructSource = source => {
                  const newSource = _.flow([
                    _.set(sourceNamePath, _.get(sourceNamePath, currentStructSource) || _.get(typeNamePath, currentStructType)),
                    _.set(sourcePath, source)
                  ])(currentStructSource)
                  setCurrentStructSource(newSource)
                }
                return Utils.switchCase(innerStructSource ? innerStructSource.type : 'none',
                  ['literal',
                    () => {
                      const selectedInputName = inputTableData[rowIndex].field_name
                      const warningMessage = Utils.cond(
                        [missingRequiredInputs.includes(selectedInputName), () => 'This attribute is required'],
                        [inputsWithInvalidValues.includes(selectedInputName), () => 'Value is either empty or doesn\'t match expected input type'],
                        () => ''
                      )
                      return WithWarnings({
                        baseComponent: ParameterValueTextInput({
                          id: `structbuilder-table-attribute-select-${rowIndex}`,
                          inputType: inputTableData[rowIndex].field_type,
                          source: innerStructSource,
                          setSource: setInnerStructSource
                        }),
                        warningMessage
                      })
                    }],
                  ['record_lookup',
                    () => WithWarnings({
                      baseComponent: RecordLookupSelect({
                        source: innerStructSource,
                        setSource: setInnerStructSource,
                        dataTableAttributes
                      }),
                      warningMessage: missingExpectedAttributes.includes(inputTableData[rowIndex].field_name) ? 'This attribute doesn\'t exist in the data table' : ''
                    })],
                  ['object_builder',
                    () => {
                      const selectedInputName = inputTableData[rowIndex].field_name
                      const warningMessage = missingRequiredInputs.includes(selectedInputName) || missingExpectedAttributes.includes(selectedInputName) || inputsWithInvalidValues.includes(selectedInputName) ? 'One of this struct\'s inputs has an invalid configuration' : ''

                      return WithWarnings({
                        baseComponent: StructBuilderLink({
                          onClick: () => {
                            setStructIndexPath([...structIndexPath, inputTableData[rowIndex].configurationIndex])
                          }
                        }),
                        warningMessage
                      })
                    }],
                  ['none', () => WithWarnings({
                    baseComponent: h(TextCell,
                      { style: Utils.inputTypeStyle(inputTableData[rowIndex].field_type) },
                      [isInputOptional(inputTableData[rowIndex].field_type) ? 'Optional' : 'This input is required']
                    ),
                    warningMessage: missingRequiredInputs.includes(inputTableData[rowIndex].field_name) ? 'This attribute is required' : ''
                  })]
                )
              }
            }
          ]
        })
      ])
    }])
  ])
}

export const StructBuilderModal = ({ onDismiss, ...props }) => {
  const [structIndexPath, setStructIndexPath] = useState([])
  const topLevel = structIndexPath.length === 0

  return h(Modal,
    {
      title: 'Struct Builder',
      onDismiss,
      showCancel: false,
      showX: true,
      okButton: h(ButtonPrimary, { onClick: topLevel ? onDismiss : () => setStructIndexPath(_.initial(structIndexPath)) }, topLevel ? 'Done' : 'Back'),
      width: '90%'
    }, [
      h(StructBuilder, { structIndexPath, setStructIndexPath, ...props }, [])
    ]
  )
}
