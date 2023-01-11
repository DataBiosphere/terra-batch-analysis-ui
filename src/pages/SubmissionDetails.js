import { filter, isEmpty, map, merge, orderBy } from 'lodash/fp'
import { useMemo, useState } from 'react'
import { div, h, h2, h3 } from 'react-hyperscript-helpers'
import ReactJson from 'react-json-view'
import { AutoSizer } from 'react-virtualized'
import { ButtonPrimary, Link, Navbar, Select } from 'src/components/common'
import { HeaderSection, statusType, SubmitNewWorkflowButton } from 'src/components/job-common'
import Modal from 'src/components/Modal'
import { makeStatusLine } from 'src/components/submission-common'
import { FlexTable, paginator, Sortable, tableHeight, TextCell } from 'src/components/table'
import { Ajax } from 'src/libs/ajax'
import colors from 'src/libs/colors'
import { goToPath } from 'src/libs/nav'
import { notify } from 'src/libs/notifications'
import { useCancellation, useOnMount } from 'src/libs/react-utils'
import { customFormatDuration, differenceFromDatesInSeconds, differenceFromNowInSeconds, makeCompleteDate } from 'src/libs/utils'


export const SubmissionDetails = ({ submissionId }) => {
  // State
  const [sort, setSort] = useState({ field: 'submission_date', direction: 'desc' })
  const [pageNumber, setPageNumber] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)
  const [viewInputsId, setViewInputsId] = useState()
  const [viewOutputsId, setViewOutputsId] = useState()
  const [viewErrorsId, setViewErrorsId] = useState()
  const [runsData, setRunsData] = useState()

  const [runSetData, setRunSetData] = useState()
  const [methodsData, setMethodsData] = useState()
  const [filterOption, setFilterOption] = useState(null)

  const signal = useCancellation()

  const terminalStates = ['ERROR', 'COMPLETE', 'CANCELED']

  const duration = ({
    state,
    submission_timestamp: submitted,
    last_modified_timestamp: modified
  }) => {
    return terminalStates.includes(state) ?
      differenceFromDatesInSeconds(submitted, modified) :
      differenceFromNowInSeconds(submitted)
  }

  const getFilter = filterOption => {
    let filterStatement
    switch (filterOption) {
      case 'Error':
        filterStatement = filter(r => errorStates.includes(r.state))
        break
      case 'Succeeded':
        filterStatement = filter(r => r.state === 'COMPLETE')
        break
      default:
        filterStatement = data => data
    }
    return filterStatement
  }

  const state = state => {
    switch (state) {
      case 'SYSTEM_ERROR':
      case 'EXECUTOR_ERROR':
        return statusType.failed
      case 'COMPLETE':
        return statusType.succeeded
      case 'INITIALIZING':
        return statusType.initializing
      case 'QUEUED':
        return statusType.queued
      case 'RUNNING':
        return statusType.running
      case 'PAUSED':
        return statusType.paused
      case 'CANCELED':
        return statusType.canceled
      case 'CANCELING':
        return statusType.canceling
      default:
        return statusType.unknown
    }
  }

  useOnMount(() => {
    const loadRunsData = async () => {
      try {
        const runs = await Ajax(signal).Cbas.runs.get(submissionId)
        setRunsData(runs?.runs)
      } catch (error) {
        notify('error', 'Error loading previous runs', { detail: await (error instanceof Response ? error.text() : error) })
      }
    }

    const loadRunSetData = async () => {
      try {
        const getRunSets = await Ajax(signal).Cbas.runSets.get()
        const allRunSets = getRunSets.run_sets
        const annotatedWithDurations = map(r => merge(r, { duration: duration(r) }), allRunSets)
        setRunSetData(annotatedWithDurations)
        return annotatedWithDurations
      } catch (error) {
        notify('error', 'Error getting run set data', { detail: await (error instanceof Response ? error.text() : error) })
      }
    }

    const loadMethodsData = async methodVersionId => {
      try {
        const methodsResponse = await Ajax(signal).Cbas.methods.getByMethodVersionId(methodVersionId)
        const allMethods = methodsResponse.methods
        setMethodsData(allMethods)
      } catch (error) {
        notify('error', 'Error loading methods data', { detail: await (error instanceof Response ? error.text() : error) })
      }
    }

    loadRunsData()
      .then(() => loadRunSetData())
      .then(runSet => runSet && loadMethodsData(runSet.method_version_id))
  })

  const specifyRunSet = filter(r => r.run_set_id === submissionId, runSetData)
  const methodId = specifyRunSet[0]?.method_id
  const getSpecificMethod = filter(m => m.method_id === methodId, methodsData)

  const errorStates = ['SYSTEM_ERROR', 'EXECUTOR_ERROR']
  const filteredPreviousRuns = filterOption ? getFilter(filterOption)(runsData) : runsData
  const sortedPreviousRuns = orderBy(sort.field, sort.direction, filteredPreviousRuns)
  const filterOptions = ['Error', 'None', 'Succeeded']

  const firstPageIndex = (pageNumber - 1) * itemsPerPage
  const lastPageIndex = firstPageIndex + itemsPerPage
  const paginatedPreviousRuns = sortedPreviousRuns.slice(firstPageIndex, lastPageIndex)

  const header = useMemo(() => {
    const breadcrumbPathObjects = [
      {
        label: 'Submission History',
        path: 'submission-history'
      },
      {
        label: `Submission ${submissionId}`
      }
    ]
    return h(HeaderSection, { breadcrumbPathObjects, title: 'Submission Details', button: SubmitNewWorkflowButton })
  }, [submissionId])

  const rowWidth = 100
  const rowHeight = 50
  return div({ id: 'submission-details-page' }, [
    Navbar('SUBMIT WORKFLOWS WITH CROMWELL'),
    div({
      style: {
        borderBottom: '2px solid rgb(116, 174, 67)',
        boxShadow: 'rgb(0 0 0 / 26%) 0px 2px 5px 0px, rgb(0 0 0 / 16%) 0px 2px 10px 0px',
        position: 'relative'
      }
    }, [
      div({ style: { marginLeft: '4em', lineHeight: 1.25 } }, [
        header,
        h2(['Submission name: ', specifyRunSet[0]?.run_set_name]),
        h3(['Workflow name: ', getSpecificMethod[0]?.name]),
        h3(['Submission date: ', specifyRunSet[0] && makeCompleteDate(specifyRunSet[0].submission_timestamp)]),
        h3(['Duration: ', specifyRunSet[0] && customFormatDuration(duration(specifyRunSet[0]))])
      ])
    ]),
    div({
      style: {
        backgroundColor: 'rgb(235, 236, 238)',
        display: 'flex',
        flex: '1 1 auto',
        flexDirection: 'column',
        padding: '1rem 3rem'
      }
    }, [
      div({
        style: {
          marginTop: '1em', height: tableHeight({ actualRows: paginatedPreviousRuns.length, maxRows: 12.5, heightPerRow: 250 }), minHeight: '10em'
        }
      }, [
        div([h2(['Workflows'])]),
        div([h3(['Filter by: '])]),
        h(Select, {
          isDisabled: false,
          'aria-label': 'Filter selection',
          isClearable: false,
          value: filterOption,
          placeholder: 'None selected',
          onChange: ({ value }) => {
            setFilterOption(value)
          },
          styles: { container: old => ({ ...old, display: 'inline-block', width: 200, marginBottom: '1.5rem' }) },
          options: filterOptions
        }),
        h(AutoSizer, [
          ({ width, height }) => h(FlexTable, {
            'aria-label': 'previous runs',
            width, height, sort,
            rowCount: paginatedPreviousRuns.length,
            noContentMessage: 'Nothing here yet! Your previously run workflows will be displayed here.',
            hoverHighlight: true,
            rowHeight,
            rowWidth,
            columns: [
              {
                size: { basis: 350 },
                field: 'record_id',
                headerRenderer: () => h(Sortable, { sort, field: 'record_id', onSort: setSort }, [' ID']),
                cellRenderer: ({ rowIndex }) => {
                  return h(TextCell, [paginatedPreviousRuns[rowIndex].record_id])
                }
              },
              {
                size: { basis: 600, grow: 0 },
                field: 'state',
                headerRenderer: () => h(Sortable, { sort, field: 'state', onSort: setSort }, ['Status']),
                cellRenderer: ({ rowIndex }) => {
                  const status = state(paginatedPreviousRuns[rowIndex].state)
                  const failureStates = ['SYSTEM_ERROR', 'EXECUTOR_ERROR']
                  if (failureStates.includes(paginatedPreviousRuns[rowIndex].state)) {
                    return div({ style: { width: '100%', textAlign: 'center' } }, [
                      h(Link, { key: 'error link', style: { fontWeight: 'bold' }, onClick: () => setViewErrorsId(rowIndex) },
                        [makeStatusLine(style => status.icon(style), status.label(paginatedPreviousRuns[rowIndex].state),
                          { textAlign: 'center' })])
                    ])
                  } else {
                    return h(TextCell, { style: { fontWeight: 'bold' } }, [makeStatusLine(style => status.icon(style),
                      status.label(paginatedPreviousRuns[rowIndex].state), { textAlign: 'center' })])
                  }
                }
              },
              {
                size: { basis: 500, grow: 0 },
                field: 'duration',
                headerRenderer: () => h(Sortable, { sort, field: 'duration', onSort: setSort }, ['Duration']),
                cellRenderer: ({ rowIndex }) => {
                  const terminalStates = ['COMPLETE', 'CANCELED', 'SYSTEM_ERROR', 'ABORTED', 'EXECUTOR_ERROR']
                  let durationSeconds
                  if (terminalStates.includes(paginatedPreviousRuns[rowIndex].state)) {
                    durationSeconds = differenceFromDatesInSeconds(
                      paginatedPreviousRuns[rowIndex].submission_date,
                      paginatedPreviousRuns[rowIndex].last_modified_timestamp
                    )
                  } else {
                    durationSeconds = differenceFromNowInSeconds(paginatedPreviousRuns[rowIndex].submission_date)
                  }
                  return h(TextCell, [customFormatDuration(durationSeconds)])
                }
              },
              {
                size: { basis: 550, grow: 0 },
                field: 'run_id',
                headerRenderer: () => h(Sortable, { sort, field: 'run_id', onSort: setSort }, ['Run ID']),
                cellRenderer: ({ rowIndex }) => {
                  return div({ style: { width: '100%', textAlign: 'left' } }, [
                    h(Link, { onClick: () => { goToPath('run-details', { submissionId, workflowId: paginatedPreviousRuns[rowIndex].engine_id }) }, style: { fontWeight: 'bold' } },
                      [paginatedPreviousRuns[rowIndex].run_id])
                  ])
                }
              }
            ],
            styleCell: ({ rowIndex }) => {
              return rowIndex % 2 && { backgroundColor: colors.light(0.2) }
            }
          })
        ])
      ]),
      !isEmpty(sortedPreviousRuns) && div({ style: { bottom: 0, position: 'absolute', marginBottom: '1.5rem', right: '4rem' } }, [
        paginator({
          filteredDataLength: sortedPreviousRuns.length,
          unfilteredDataLength: sortedPreviousRuns.length,
          pageNumber,
          setPageNumber,
          itemsPerPage,
          setItemsPerPage: v => {
            setPageNumber(1)
            setItemsPerPage(v)
          },
          itemsPerPageOptions: [10, 25, 50, 100]
        })
      ]),
      (viewInputsId !== undefined) && h(Modal, {
        title: 'TODO',
        width: 600,
        onDismiss: () => setViewInputsId(undefined),
        showCancel: false,
        okButton:
          h(ButtonPrimary, {
            disabled: false,
            onClick: () => setViewInputsId(undefined)
          }, ['OK'])
      }, [
        h(TextCell, {
          style: { whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
          name: false,
          collapsed: 4,
          enableClipboard: true,
          displayDataTypes: false,
          displayObjectSize: false,
          src: 'Link to workflow details!'//_.isEmpty(paginatedPreviousRuns[viewInputsId].workflow_params) ? {} : JSON.parse(paginatedPreviousRuns[viewInputsId].workflow_params)
        }, ['Link to workflow details!'])
      ]),
      (viewOutputsId !== undefined) && h(Modal, {
        title: 'Outputs Definition JSON',
        width: 600,
        onDismiss: () => setViewOutputsId(undefined),
        showCancel: false,
        okButton:
          h(ButtonPrimary, {
            disabled: false,
            onClick: () => setViewOutputsId(undefined)
          }, ['OK'])
      }, [
        h(ReactJson, {
          style: { whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
          name: false,
          collapsed: 4,
          enableClipboard: true,
          displayDataTypes: false,
          displayObjectSize: false,
          src: isEmpty(paginatedPreviousRuns[viewOutputsId].workflow_outputs) ?
            {} :
            JSON.parse(paginatedPreviousRuns[viewOutputsId].workflow_outputs)
        })
      ]),
      (viewErrorsId !== undefined) && h(Modal, {
        title: 'Error Messages',
        width: 600,
        onDismiss: () => setViewErrorsId(undefined),
        showCancel: false,
        okButton:
          h(ButtonPrimary, {
            disabled: false,
            onClick: () => setViewErrorsId(undefined)
          }, ['OK'])
      }, [
        h(TextCell, {
          style: { textAlign: 'center', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: '3rem', marginBottom: '1rem' }
        }, [paginatedPreviousRuns[viewErrorsId]?.error_messages])
      ])
    ])
  ])
}

export const navPaths = [
  {
    name: 'submission-details',
    path: '/submission-history/:submissionId',
    component: SubmissionDetails,
    public: true
  }
]
