import '@testing-library/jest-dom'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { h } from 'react-hyperscript-helpers'
import { Ajax } from 'src/libs/ajax'
import { notify } from 'src/libs/notifications'
import { notificationStore } from 'src/libs/state'
import { PreviousRuns } from 'src/pages/PreviousRuns'

// Necessary to mock the AJAX module.
jest.mock('src/libs/ajax')

jest.mock('src/libs/notifications.js')

jest.mock('src/libs/config', () => ({
  ...jest.requireActual('src/libs/config'),
  getConfig: jest.fn().mockReturnValue({})
}))

describe('Previous Runs page', () => {
  // PreviousRuns component uses AutoSizer to determine the right size for table to be displayed. As a result we need to
  // mock out the height and width so that when AutoSizer asks for the width and height of "browser" it can use the mocked
  // values and render the component properly. Without this the tests will be break.
  // (see https://github.com/bvaughn/react-virtualized/issues/493 and https://stackoverflow.com/a/62214834)
  const originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
  const originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');

  const runsData = {
    runs: [
      {
        run_id: 'ea001565-1cd6-4e43-b446-932ac1918081',
        state: 'Submitted',
        submission_date: '2022-01-27T22:27:15.591Z',
        workflow_url: 'https://abc.wdl',
        workflow_params: '[{"parameter_name":"workflow_input_foo","parameter_type":"String","source":{"type":"literal","entity_attribute":"helloworld"}},{"parameter_name":"workflow_input_foo_rating","parameter_type":"Int","source":{"type":"entity_lookup","entity_attribute":"entity_field_foo_rating"}}]'
      },
      {
        run_id: 'b7234aae-6f43-405e-bb3a-71f924e09825',
        state: 'Failed',
        submission_date: '2022-07-14T22:22:15.591Z',
        workflow_url: 'https://xyz.wdl',
        workflow_params: '[{"parameter_name":"workflow_input_foo","parameter_type":"String","source":{"type":"literal","entity_attribute":"helloworld"}},{"parameter_name":"workflow_input_foo_rating","parameter_type":"Int","source":{"type":"entity_lookup","entity_attribute":"entity_field_foo_rating"}}]'
      }
    ]
  }

  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 1000 });
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 800 });
  });

  beforeEach(() => {
    const getRunsMethod = jest.fn(() => Promise.resolve(runsData))
    Ajax.mockImplementation(() => {
      return {
        Cbas: {
          runs: {
            get: getRunsMethod
          }
        }
      }
    })
  });

  afterEach(() => {
    jest.clearAllMocks()
  });

  afterAll(() => {
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalOffsetHeight);
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originalOffsetWidth);
  });

  it('should display no content message when there are no previous runs', async () => {
    // Arrange
    const getRunsMethod = jest.fn(() => Promise.resolve([]))
    Ajax.mockImplementation(() => {
      return {
        Cbas : {
          runs: {
            get: getRunsMethod
          }
        }
      }
    })

    // Act
    render(h(PreviousRuns))

    // Assert
    await screen.findByText('Nothing here yet! Your previously run workflows will be displayed here.')

    expect(getRunsMethod).toBeCalledTimes(1)

    const table = screen.getByRole('table')
    expect(table).toHaveAttribute('aria-colcount', "4")
    expect(table).toHaveAttribute('aria-rowcount', "1")
  })

  it('should correctly display previous 2 runs', async () => {
    // Act
    await act(async () => {
      await render(h(PreviousRuns))
    });

    const table = screen.getByRole('table')

    // Assert
    expect(table).toHaveAttribute('aria-colcount', "4")
    expect(table).toHaveAttribute('aria-rowcount', "3")

    const rows = within(table).queryAllByRole('row')
    expect(rows.length).toBe(3)

    const headers = within(rows[0]).queryAllByRole('columnheader')
    expect(headers.length).toBe(4)
    within(headers[0]).getByText('Run ID')
    within(headers[1]).getByText('Status')
    within(headers[2]).getByText('Inputs')
    within(headers[3]).getByText('Submitted')

    // check data rows are rendered as expected
    const cellsFromDataRow1 = within(rows[1]).queryAllByRole('cell')
    expect(cellsFromDataRow1.length).toBe(4)
    within(cellsFromDataRow1[0]).getByText('b7234aae-6f43-405e-bb3a-71f924e09825')
    within(cellsFromDataRow1[1]).getByText('Failed')
    within(cellsFromDataRow1[3]).getByText('Jul 14, 2022, 6:22 PM')

    const cellsFromDataRow2 = within(rows[2]).queryAllByRole('cell')
    expect(cellsFromDataRow2.length).toBe(4)
    within(cellsFromDataRow2[0]).getByText('ea001565-1cd6-4e43-b446-932ac1918081')
    within(cellsFromDataRow2[1]).getByText('Submitted')
    within(cellsFromDataRow2[3]).getByText('Jan 27, 2022, 5:27 PM')
  })

  it('should sort columns properly', async () => {
    // Act - click on sort button on Submitted column to sort submission timestamp by ascending order
    await act(async () => {
      await render(h(PreviousRuns))
    });

    const table = screen.getByRole('table')
    const rows = within(table).queryAllByRole('row')
    expect(rows.length).toBe(3)

    const headers = within(rows[0]).queryAllByRole('columnheader')
    expect(headers.length).toBe(4)

    await act(async () => {
      await fireEvent.click(within(headers[3]).getByRole('button'))
    });

    // Assert - rows are now sorted by submission timestamp in ascending order
    const cellsFromUpdatedDataRow1 = within(rows[1]).queryAllByRole('cell')
    expect(cellsFromUpdatedDataRow1.length).toBe(4)
    within(cellsFromUpdatedDataRow1[0]).getByText('ea001565-1cd6-4e43-b446-932ac1918081')
    within(cellsFromUpdatedDataRow1[1]).getByText('Submitted')
    within(cellsFromUpdatedDataRow1[3]).getByText('Jan 27, 2022, 5:27 PM')

    const cellsFromUpdatedDataRow2 = within(rows[2]).queryAllByRole('cell')
    expect(cellsFromUpdatedDataRow2.length).toBe(4)
    within(cellsFromUpdatedDataRow2[0]).getByText('b7234aae-6f43-405e-bb3a-71f924e09825')
    within(cellsFromUpdatedDataRow2[1]).getByText('Failed')
    within(cellsFromUpdatedDataRow2[3]).getByText('Jul 14, 2022, 6:22 PM')

    // Act - click on sort button on Status column
    await act(async () => {
      await fireEvent.click(within(headers[1]).getByRole('button'))
    });

    // Assert that sort by Status worked
    const updatedDataRow1Cells = within(rows[1]).queryAllByRole('cell')
    expect(updatedDataRow1Cells.length).toBe(4)
    within(updatedDataRow1Cells[0]).getByText('b7234aae-6f43-405e-bb3a-71f924e09825')
    within(updatedDataRow1Cells[1]).getByText('Failed')
    within(updatedDataRow1Cells[3]).getByText('Jul 14, 2022, 6:22 PM')

    const updatedDataRow2Cells = within(rows[2]).queryAllByRole('cell')
    expect(updatedDataRow2Cells.length).toBe(4)
    within(updatedDataRow2Cells[0]).getByText('ea001565-1cd6-4e43-b446-932ac1918081')
    within(updatedDataRow2Cells[1]).getByText('Submitted')
    within(updatedDataRow2Cells[3]).getByText('Jan 27, 2022, 5:27 PM')
  })
})
