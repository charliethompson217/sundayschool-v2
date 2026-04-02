import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { Box } from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import {
  DataGrid,
  useGridApiRef,
  type GridColDef,
  type GridColumnVisibilityModel,
  type GridPaginationModel,
  type GridRowId,
  type GridRowSelectionModel,
} from '@mui/x-data-grid';
import { Checkbox, Group, Paper, Stack, Text, Title, useComputedColorScheme } from '@mantine/core';
import { IconGripVertical } from '@tabler/icons-react';

// ── localStorage helpers ──────────────────────────────────────────────────────

const STORAGE_KEY_COL_VISIBILITY = 'generic-table-col-visibility';
const STORAGE_KEY_COL_ORDER = 'generic-table-col-order';

function loadColumnVisibility(tableId: string): GridColumnVisibilityModel | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_COL_VISIBILITY}:${tableId}`);
    return raw ? (JSON.parse(raw) as GridColumnVisibilityModel) : null;
  } catch {
    return null;
  }
}

function saveColumnVisibility(tableId: string, model: GridColumnVisibilityModel): void {
  try {
    localStorage.setItem(`${STORAGE_KEY_COL_VISIBILITY}:${tableId}`, JSON.stringify(model));
  } catch {
    // silently ignore quota / private-browsing errors
  }
}

function loadColumnOrder(tableId: string): string[] | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_COL_ORDER}:${tableId}`);
    return raw ? (JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

function saveColumnOrder(tableId: string, fields: string[]): void {
  try {
    localStorage.setItem(`${STORAGE_KEY_COL_ORDER}:${tableId}`, JSON.stringify(fields));
  } catch {
    // silently ignore quota / private-browsing errors
  }
}

// ── Column-management context ─────────────────────────────────────────────────
// Shared between GenericTable and the columnsManagement slot component so that
// column order and visibility state flow through both the toolbar panel and the
// column-header "Manage columns" panel.

interface TableManagementContextValue {
  columnOrder: string[];
  updateColumnOrder: (fields: string[]) => void;
  columnVisibilityModel: GridColumnVisibilityModel;
  updateColumnVisibility: (model: GridColumnVisibilityModel) => void;
  managedColumns: { field: string; headerName?: string }[];
}

const TableManagementContext = createContext<TableManagementContextValue | null>(null);

function useTableManagement() {
  const ctx = useContext(TableManagementContext);
  if (!ctx) throw new Error('useTableManagement must be used within a GenericTable');
  return ctx;
}

// ── Custom columnsManagement slot ─────────────────────────────────────────────
// This component replaces the built-in GridColumnsManagement panel.  It is
// rendered both when the user clicks the toolbar "Columns" button AND when they
// click "Manage columns" from a column header menu — giving drag-and-drop
// reordering in both places.

function CustomColumnsManagement() {
  const { columnOrder, updateColumnOrder, columnVisibilityModel, updateColumnVisibility, managedColumns } =
    useTableManagement();

  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragSourceIndex, setDragSourceIndex] = useState<number | null>(null);
  const dragIndexRef = useRef<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const panelRows = columnOrder
    .map((field) => {
      const col = managedColumns.find((c) => c.field === field);
      if (!col) return null;
      return {
        field,
        headerName: col.headerName ?? field,
        visible: columnVisibilityModel[field] !== false,
      };
    })
    .filter((r): r is { field: string; headerName: string; visible: boolean } => r !== null);

  function handleDragStart(e: React.DragEvent, index: number) {
    dragIndexRef.current = index;
    setDragSourceIndex(index);
    e.dataTransfer.effectAllowed = 'move';

    const ghost = document.createElement('div');
    ghost.textContent = panelRows[index].headerName;
    Object.assign(ghost.style, {
      position: 'fixed',
      top: '-9999px',
      left: '-9999px',
      padding: '5px 12px',
      background: 'rgba(59, 130, 246, 0.92)',
      color: 'white',
      borderRadius: '6px',
      fontSize: '13px',
      fontWeight: '600',
      pointerEvents: 'none',
      whiteSpace: 'nowrap',
      boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
    });
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, ghost.offsetWidth / 2, 14);
    setTimeout(() => document.body.removeChild(ghost), 0);
  }

  function handleDragEnter(index: number) {
    if (dragIndexRef.current !== null && dragIndexRef.current !== index) {
      setDragOverIndex(index);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function handleContainerDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const container = scrollContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const SCROLL_ZONE = 52;
    const MAX_SPEED = 10;
    const y = e.clientY;
    const distFromTop = y - rect.top;
    const distFromBottom = rect.bottom - y;

    if (distFromTop < SCROLL_ZONE && distFromTop >= 0) {
      container.scrollTop -= MAX_SPEED * (1 - distFromTop / SCROLL_ZONE);
    } else if (distFromBottom < SCROLL_ZONE && distFromBottom >= 0) {
      container.scrollTop += MAX_SPEED * (1 - distFromBottom / SCROLL_ZONE);
    }
  }

  function handleDrop(e: React.DragEvent, targetIndex: number) {
    e.preventDefault();
    const from = dragIndexRef.current;
    if (from === null || from === targetIndex) {
      setDragOverIndex(null);
      setDragSourceIndex(null);
      return;
    }
    const next = [...panelRows];
    const [moved] = next.splice(from, 1);
    next.splice(targetIndex, 0, moved);
    updateColumnOrder(next.map((r) => r.field));
    dragIndexRef.current = null;
    setDragOverIndex(null);
    setDragSourceIndex(null);
  }

  function handleDragEnd() {
    dragIndexRef.current = null;
    setDragOverIndex(null);
    setDragSourceIndex(null);
  }

  return (
    <Stack
      ref={scrollContainerRef}
      gap={0}
      style={{
        minWidth: 240,
        maxHeight: 'min(640px, calc(100vh - 140px))',
        overflowY: 'auto',
        padding: '6px 0',
        paddingRight: 12,
      }}
      onDragOver={handleContainerDragOver}
    >
      {panelRows.map((row, i) => (
        <Group
          key={row.field}
          gap={6}
          px="sm"
          py={6}
          wrap="nowrap"
          draggable
          onDragStart={(e) => handleDragStart(e, i)}
          onDragEnter={() => handleDragEnter(i)}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, i)}
          onDragEnd={handleDragEnd}
          style={{
            cursor: dragSourceIndex === i ? 'grabbing' : 'grab',
            userSelect: 'none',
            opacity: dragSourceIndex === i ? 0.35 : 1,
            borderTop: dragOverIndex === i ? '2px solid var(--mantine-color-blue-5)' : '2px solid transparent',
            transition: 'border-color 0.1s, opacity 0.1s',
          }}
        >
          <IconGripVertical size={14} style={{ color: 'var(--mantine-color-dimmed)', flexShrink: 0 }} />
          <Text
            size="sm"
            style={{
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {row.headerName}
          </Text>
          <Checkbox
            checked={row.visible}
            size="xs"
            onChange={() => updateColumnVisibility({ ...columnVisibilityModel, [row.field]: !row.visible })}
          />
        </Group>
      ))}
    </Stack>
  );
}

// ── Public types ──────────────────────────────────────────────────────────────

export interface RowAction<TRow extends object> {
  /** Render the action element(s) for a given row. */
  renderCell: (row: TRow) => ReactNode;
  width?: number;
  headerName?: string;
}

export interface GenericTableProps<TRow extends object> {
  // ── Identity ───────────────────────────────────────────────────────────────
  /** Unique key used to persist column visibility and order in localStorage. */
  tableId: string;

  // ── Data ──────────────────────────────────────────────────────────────────
  rows: TRow[];
  columns: GridColDef<TRow>[];
  getRowId?: (row: TRow) => GridRowId;
  loading?: boolean;

  // ── Header ────────────────────────────────────────────────────────────────
  title?: string;
  description?: string;
  /**
   * Content rendered on the right side of the header bar (badges, query
   * controls, action buttons, etc.).  The query-input controls for ESPN games
   * live here so the generic table itself stays free of domain logic.
   */
  headerRight?: ReactNode;

  // ── Column visibility ─────────────────────────────────────────────────────
  /**
   * Initial visibility model.  Columns absent from this map default to
   * visible.  Any previously saved user preference in localStorage takes
   * precedence over this default.
   */
  defaultColumnVisibility?: GridColumnVisibilityModel;

  // ── Row dimensions ────────────────────────────────────────────────────────
  rowHeight?: number;
  columnHeaderHeight?: number;

  // ── Pagination ────────────────────────────────────────────────────────────
  pageSizeOptions?: number[];
  defaultPageSize?: number;
  /**
   * Increment this value to reset the grid back to page 0.  Useful when
   * external filters change and the current page may be out of range.
   */
  resetPageKey?: number;

  // ── Sorting ───────────────────────────────────────────────────────────────
  initialSort?: { field: string; sort: 'asc' | 'desc' };

  // ── Row selection ─────────────────────────────────────────────────────────
  checkboxSelection?: boolean;
  rowSelectionModel?: GridRowSelectionModel;
  onRowSelectionModelChange?: (model: GridRowSelectionModel) => void;

  // ── Export ────────────────────────────────────────────────────────────────
  csvFileName?: string;

  // ── Row actions ───────────────────────────────────────────────────────────
  /** When provided, appends a non-sortable Actions column to the right. */
  rowActions?: RowAction<TRow>;
}

// ── Shared DataGrid sx (static, defined once outside any render) ──────────────

const DATA_GRID_SX = {
  border: 0,
  height: '100%',
  color: 'var(--mantine-color-text)',
  backgroundColor: 'var(--app-admin-table-surface)',
  '& .MuiDataGrid-toolbarContainer': {
    gap: 1,
    px: 2,
    py: 1.5,
    borderBottom: '1px solid',
    borderColor: 'var(--app-admin-table-border)',
    backgroundColor: 'var(--app-admin-table-toolbar-bg)',
  },
  '& .MuiDataGrid-topContainer': {
    backgroundColor: 'var(--app-admin-table-header-bg)',
  },
  '& .MuiDataGrid-columnHeaders': {
    position: 'sticky',
    top: 0,
    zIndex: 5,
    backgroundColor: 'var(--app-admin-table-header-bg)',
  },
  '& .MuiDataGrid-columnHeaderRow': {
    backgroundColor: 'var(--app-admin-table-header-bg)',
  },
  '& .MuiDataGrid-columnHeader': {
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--app-admin-table-header-text)',
    backgroundColor: 'var(--app-admin-table-header-bg)',
  },
  '& .MuiDataGrid-row': {
    backgroundColor: 'var(--app-admin-table-surface)',
  },
  '& .MuiDataGrid-row:hover': {
    backgroundColor: 'var(--app-admin-table-hover-bg)',
  },
  '& .MuiDataGrid-cell': {
    borderColor: 'var(--app-admin-table-border)',
    alignItems: 'center',
  },
  '& .MuiDataGrid-withBorderColor': {
    borderColor: 'var(--app-admin-table-border)',
  },
  '& .MuiDataGrid-columnSeparator': {
    color: 'var(--app-admin-table-border)',
  },
  '& .MuiDataGrid-scrollbarFiller': {
    backgroundColor: 'var(--app-admin-table-header-bg)',
  },
  '& .MuiDataGrid-overlay': {
    backgroundColor: 'var(--app-admin-table-surface)',
  },
  '& .MuiDataGrid-menuIconButton, & .MuiDataGrid-sortIcon, & .MuiDataGrid-iconButtonContainer': {
    color: 'var(--app-admin-table-header-text)',
  },
  '& .MuiDataGrid-toolbarContainer .MuiInputBase-root': {
    color: 'var(--mantine-color-text)',
  },
  '& .MuiDataGrid-toolbarContainer .MuiInputBase-input::placeholder': {
    color: 'var(--app-admin-table-muted-text)',
    opacity: 1,
  },
  '& .MuiDataGrid-footerContainer': {
    borderTop: '1px solid',
    borderColor: 'var(--app-admin-table-border)',
    backgroundColor: 'var(--app-admin-table-footer-bg)',
  },
  '& .MuiDataGrid-toolbarContainer .MuiButtonBase-root': {
    color: 'var(--mantine-color-text)',
  },
  '& .MuiDataGrid-toolbarContainer svg': {
    color: 'var(--mantine-color-text)',
  },
  '& .MuiTablePagination-root': {
    color: 'var(--mantine-color-text)',
  },
  '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
    color: 'var(--mantine-color-text)',
  },
  '& .MuiTablePagination-select, & .MuiSelect-select': {
    color: 'var(--mantine-color-text)',
  },
  '& .MuiTablePagination-selectIcon': {
    color: 'var(--mantine-color-text)',
  },
  '& .MuiTablePagination-root .MuiIconButton-root': {
    color: 'var(--mantine-color-text)',
  },
  '& .MuiTablePagination-root .MuiIconButton-root.Mui-disabled': {
    color: 'var(--app-admin-table-muted-text)',
  },
  '& .MuiCheckbox-root': {
    color: 'var(--app-admin-table-muted-text)',
  },
  '& .MuiCheckbox-root.Mui-checked, & .MuiCheckbox-root.MuiCheckbox-indeterminate': {
    color: 'var(--app-admin-table-summary-selected-bg)',
  },
  '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within': {
    outline: 'none',
  },
  '& .MuiDataGrid-columnHeader:focus, & .MuiDataGrid-columnHeader:focus-within': {
    outline: 'none',
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function GenericTable<TRow extends object>({
  tableId,
  rows,
  columns,
  getRowId,
  loading,
  title,
  description,
  headerRight,
  defaultColumnVisibility = {},
  rowHeight = 56,
  columnHeaderHeight = 56,
  pageSizeOptions = [10, 25, 50],
  defaultPageSize = 25,
  resetPageKey,
  initialSort,
  checkboxSelection,
  rowSelectionModel,
  onRowSelectionModelChange,
  csvFileName,
  rowActions,
}: GenericTableProps<TRow>) {
  const colorScheme = useComputedColorScheme('light');
  const muiTheme = useMemo(
    () => createTheme({ palette: { mode: colorScheme === 'dark' ? 'dark' : 'light' } }),
    [colorScheme],
  );

  const apiRef = useGridApiRef();

  // ── Pagination ──────────────────────────────────────────────────────────────

  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: defaultPageSize,
  });

  useEffect(() => {
    if (resetPageKey !== undefined) {
      // eslint-disable-next-line @eslint-react/hooks-extra/no-direct-set-state-in-use-effect
      setPaginationModel((m) => ({ ...m, page: 0 }));
    }
  }, [resetPageKey]);

  // ── Column visibility ───────────────────────────────────────────────────────

  const [columnVisibilityModel, setColumnVisibilityModel] = useState<GridColumnVisibilityModel>(
    () => loadColumnVisibility(tableId) ?? defaultColumnVisibility,
  );

  function handleColumnVisibilityChange(model: GridColumnVisibilityModel) {
    setColumnVisibilityModel(model);
    saveColumnVisibility(tableId, model);
  }

  // ── Actions column ──────────────────────────────────────────────────────────

  const resolvedColumns = useMemo<GridColDef<TRow>[]>(() => {
    if (!rowActions) return columns;
    const actionsCol: GridColDef<TRow> = {
      field: '__actions__',
      headerName: rowActions.headerName ?? 'Actions',
      width: rowActions.width ?? 120,
      sortable: false,
      filterable: false,
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>{rowActions.renderCell(row)}</Box>
      ),
    };
    return [...columns, actionsCol];
  }, [columns, rowActions]);

  // ── Column order ────────────────────────────────────────────────────────────
  // Managed as controlled state so both header-drag and the custom panel work.
  // Special __ columns (actions, checkbox) are always appended and excluded from
  // user-facing order management.

  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    const saved = loadColumnOrder(tableId);
    if (saved) return saved;
    return columns.map((c) => c.field).filter((f) => !f.startsWith('__'));
  });

  // Sync when columns definition changes: keep existing order, append new fields.
  useEffect(() => {
    const currentFields = resolvedColumns.map((c) => c.field).filter((f) => !f.startsWith('__'));
    // eslint-disable-next-line @eslint-react/hooks-extra/no-direct-set-state-in-use-effect
    setColumnOrder((prev) => {
      const kept = prev.filter((f) => currentFields.includes(f));
      const added = currentFields.filter((f) => !prev.includes(f));
      if (kept.length === prev.length && added.length === 0) return prev;
      return [...kept, ...added];
    });
  }, [resolvedColumns]);

  function updateColumnOrder(fields: string[]) {
    setColumnOrder(fields);
    saveColumnOrder(tableId, fields);
  }

  // Called when the user drags a column header inside the DataGrid.
  function handleNativeColumnOrderChange() {
    if (!apiRef.current) return;
    const fields = apiRef.current
      .getAllColumns()
      .map((col) => col.field)
      .filter((f) => !f.startsWith('__'));
    updateColumnOrder(fields);
  }

  // ── Ordered columns (what the DataGrid actually receives) ───────────────────

  const orderedColumns = useMemo<GridColDef<TRow>[]>(() => {
    const special = resolvedColumns.filter((c) => c.field.startsWith('__'));
    const regular = resolvedColumns.filter((c) => !c.field.startsWith('__'));
    const sorted = columnOrder
      .map((field) => regular.find((c) => c.field === field))
      .filter((c): c is GridColDef<TRow> => c !== undefined);
    // Safety: append any regular cols not yet tracked in columnOrder
    const inSorted = new Set(sorted.map((c) => c.field));
    const extra = regular.filter((c) => !inSorted.has(c.field));
    return [...sorted, ...extra, ...special];
  }, [resolvedColumns, columnOrder]);

  // ── Managed columns list for the panel ─────────────────────────────────────

  const managedColumns = useMemo(
    () =>
      resolvedColumns
        .filter((c) => !c.field.startsWith('__'))
        .map((c) => ({ field: c.field, headerName: c.headerName as string | undefined })),
    [resolvedColumns],
  );

  // ── Context value ───────────────────────────────────────────────────────────

  const contextValue = useMemo<TableManagementContextValue>(
    () => ({
      columnOrder,
      updateColumnOrder,
      columnVisibilityModel,
      updateColumnVisibility: handleColumnVisibilityChange,
      managedColumns,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columnOrder, columnVisibilityModel, managedColumns],
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  const hasHeader = Boolean(title ?? description ?? headerRight);

  return (
    <div
      style={{
        marginRight: '16px',
        height: 'calc(100vh - 200px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {hasHeader && (
        <Group justify="space-between" align="flex-end" mb="md" wrap="wrap" style={{ flexShrink: 0 }}>
          {(title ?? description) && (
            <div>
              {title && (
                <Title order={5} fw={700}>
                  {title}
                </Title>
              )}
              {description && (
                <Text size="sm" c="dimmed">
                  {description}
                </Text>
              )}
            </div>
          )}
          {headerRight && <div>{headerRight}</div>}
        </Group>
      )}

      <Paper
        radius={16}
        withBorder
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 50px var(--app-admin-table-shadow)',
          backgroundColor: 'var(--app-admin-table-surface)',
          backgroundImage: 'linear-gradient(180deg, var(--app-admin-table-gradient-start), rgba(255, 255, 255, 0))',
          borderColor: 'var(--app-admin-table-border)',
        }}
      >
        <TableManagementContext.Provider value={contextValue}>
          <ThemeProvider theme={muiTheme}>
            <DataGrid
              apiRef={apiRef}
              rows={rows}
              getRowId={getRowId}
              columns={orderedColumns}
              loading={loading}
              checkboxSelection={checkboxSelection}
              disableRowSelectionOnClick={checkboxSelection}
              showToolbar
              slots={{ columnsManagement: CustomColumnsManagement }}
              rowHeight={rowHeight}
              columnHeaderHeight={columnHeaderHeight}
              pageSizeOptions={pageSizeOptions}
              paginationModel={paginationModel}
              onPaginationModelChange={setPaginationModel}
              columnVisibilityModel={columnVisibilityModel}
              onColumnVisibilityModelChange={handleColumnVisibilityChange}
              onColumnOrderChange={handleNativeColumnOrderChange}
              rowSelectionModel={rowSelectionModel}
              onRowSelectionModelChange={onRowSelectionModelChange}
              initialState={{
                sorting: initialSort ? { sortModel: [initialSort] } : undefined,
              }}
              slotProps={{
                toolbar: {
                  showQuickFilter: true,
                  quickFilterProps: { debounceMs: 250 },
                  csvOptions: csvFileName ? { fileName: csvFileName, utf8WithBom: true } : undefined,
                  printOptions: { disableToolbarButton: true },
                },
              }}
              sx={DATA_GRID_SX}
            />
          </ThemeProvider>
        </TableManagementContext.Provider>
      </Paper>
    </div>
  );
}
