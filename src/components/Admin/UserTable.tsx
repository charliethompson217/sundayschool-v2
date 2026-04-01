import { useMemo, useState } from 'react';

import { Avatar, Box, Chip, Stack, Typography } from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { DataGrid, type GridColDef, type GridPaginationModel, type GridRowSelectionModel } from '@mui/x-data-grid';
import { Alert, Badge, Group, Paper, Text, Title, useComputedColorScheme } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';

import { getUsers } from '@/app/API/adminFunctions';
import type { User } from '@/types/users';

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getInitials(user: User): string {
  return `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase();
}

const GRID_ROW_HEIGHT = 74;
const GRID_HEADER_HEIGHT = 56;

export default function UserTable() {
  const colorScheme = useComputedColorScheme('light');
  const muiTheme = useMemo(
    () => createTheme({ palette: { mode: colorScheme === 'dark' ? 'dark' : 'light' } }),
    [colorScheme],
  );

  const [rowSelectionModel, setRowSelectionModel] = useState<GridRowSelectionModel>(() => ({
    type: 'include',
    ids: new Set(),
  }));
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 10,
  });

  const {
    data: users = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: getUsers,
  });

  const columns = useMemo<GridColDef<User>[]>(
    () => [
      {
        field: 'fullName',
        headerName: 'User',
        minWidth: 240,
        flex: 1.3,
        sortable: true,
        filterable: false,
        valueGetter: (_value, row) => `${row.firstName} ${row.lastName}`,
        renderCell: ({ row }) => (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', width: '100%', py: 0.5 }}>
            <Stack direction="row" spacing={1.25} alignItems="center">
              <Avatar
                sx={{
                  width: 36,
                  height: 36,
                  bgcolor: row.isAdmin
                    ? 'var(--app-admin-table-admin-avatar-bg)'
                    : 'var(--app-admin-table-member-avatar-bg)',
                  color: 'var(--mantine-color-white)',
                }}
              >
                {getInitials(row)}
              </Avatar>
              <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 0.15 }}>
                <Typography variant="body2" fontWeight={700} lineHeight={1.15}>
                  {row.firstName} {row.lastName}
                </Typography>
                <Typography variant="caption" sx={{ color: 'var(--app-admin-table-muted-text)' }} lineHeight={1.15}>
                  {row.phone}
                </Typography>
              </Box>
            </Stack>
          </Box>
        ),
      },
      {
        field: 'username',
        headerName: 'Username',
        minWidth: 150,
        flex: 0.8,
      },
      {
        field: 'email',
        headerName: 'Email',
        minWidth: 220,
        flex: 1.2,
      },
      {
        field: 'role',
        headerName: 'Role',
        minWidth: 130,
        flex: 0.7,
        valueGetter: (_value, row) => (row.isAdmin ? 'Admin' : 'Member'),
        renderCell: ({ row }) => (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', width: '100%' }}>
            <Chip
              label={row.isAdmin ? 'Admin' : 'Member'}
              size="small"
              variant={row.isAdmin ? 'filled' : 'outlined'}
              sx={{
                fontWeight: 600,
                bgcolor: row.isAdmin ? 'var(--app-admin-table-admin-role-bg)' : 'transparent',
                color: row.isAdmin
                  ? 'var(--app-admin-table-admin-role-text)'
                  : 'var(--app-admin-table-member-role-text)',
                borderColor: row.isAdmin
                  ? 'var(--app-admin-table-admin-role-border)'
                  : 'var(--app-admin-table-member-role-border)',
              }}
            />
          </Box>
        ),
      },
      {
        field: 'status',
        headerName: 'Status',
        minWidth: 220,
        flex: 1,
        sortable: false,
        valueGetter: (_value, row) =>
          [row.isActive ? 'Active' : 'Inactive', row.isVerified ? 'Verified' : 'Pending verification'].join(' '),
        renderCell: ({ row }) => (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', width: '100%' }}>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
              <Chip
                label={row.isActive ? 'Active' : 'Inactive'}
                size="small"
                variant="outlined"
                sx={{
                  fontWeight: 600,
                  color: row.isActive ? 'var(--app-admin-table-active-text)' : 'var(--app-admin-table-inactive-text)',
                  borderColor: row.isActive
                    ? 'var(--app-admin-table-active-border)'
                    : 'var(--app-admin-table-inactive-border)',
                  bgcolor: row.isActive ? 'var(--app-admin-table-active-bg)' : 'var(--app-admin-table-inactive-bg)',
                }}
              />
              <Chip
                label={row.isVerified ? 'Verified' : 'Pending'}
                size="small"
                variant="outlined"
                sx={{
                  fontWeight: 600,
                  color: row.isVerified
                    ? 'var(--app-admin-table-verified-text)'
                    : 'var(--app-admin-table-pending-text)',
                  borderColor: row.isVerified
                    ? 'var(--app-admin-table-verified-border)'
                    : 'var(--app-admin-table-pending-border)',
                  bgcolor: row.isVerified ? 'var(--app-admin-table-verified-bg)' : 'var(--app-admin-table-pending-bg)',
                }}
              />
            </Stack>
          </Box>
        ),
      },
      {
        field: 'createdAt',
        headerName: 'Created',
        type: 'dateTime',
        minWidth: 160,
        flex: 0.8,
        valueGetter: (_value, row) => new Date(row.createdAt),
        renderCell: ({ row }) => (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', width: '100%' }}>
            <Typography variant="body2">{formatDate(row.createdAt)}</Typography>
          </Box>
        ),
      },
      {
        field: 'updatedAt',
        headerName: 'Last Updated',
        type: 'dateTime',
        minWidth: 160,
        flex: 0.9,
        valueGetter: (_value, row) => new Date(row.updatedAt),
        renderCell: ({ row }) => (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', width: '100%' }}>
            <Typography variant="body2">{formatDate(row.updatedAt)}</Typography>
          </Box>
        ),
      },
    ],
    [],
  );

  if (isError) {
    return (
      <Alert color="red" title="Error">
        Failed to load users. Please try again.
      </Alert>
    );
  }

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
      <Group justify="space-between" align="flex-start" mb="md" wrap="wrap" style={{ flexShrink: 0 }}>
        <div>
          <Title order={5} fw={700}>
            Users
          </Title>
          <Text size="sm" c="dimmed">
            Search, sort, select, and export the admin user list.
          </Text>
        </div>
        <Group gap="xs">
          <Badge
            variant="outline"
            style={{
              background: 'var(--app-admin-table-summary-chip-bg)',
              color: 'var(--app-admin-table-summary-chip-text)',
              borderColor: 'var(--app-admin-table-summary-chip-border)',
              fontWeight: 600,
            }}
          >
            {users.length} users
          </Badge>
          <Badge
            variant={rowSelectionModel.ids.size ? 'filled' : 'outline'}
            style={{
              background: rowSelectionModel.ids.size ? 'var(--app-admin-table-summary-selected-bg)' : 'transparent',
              color: rowSelectionModel.ids.size
                ? 'var(--app-admin-table-summary-selected-text)'
                : 'var(--app-admin-table-member-role-text)',
              borderColor: rowSelectionModel.ids.size
                ? 'var(--app-admin-table-summary-selected-border)'
                : 'var(--app-admin-table-member-role-border)',
              fontWeight: 600,
            }}
          >
            {rowSelectionModel.ids.size ? `${rowSelectionModel.ids.size} selected` : 'No rows selected'}
          </Badge>
        </Group>
      </Group>

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
        <ThemeProvider theme={muiTheme}>
          <DataGrid
            rows={users}
            columns={columns}
            loading={isLoading}
            checkboxSelection
            disableRowSelectionOnClick
            showToolbar
            rowHeight={GRID_ROW_HEIGHT}
            columnHeaderHeight={GRID_HEADER_HEIGHT}
            pageSizeOptions={[5, 10, 25]}
            paginationModel={paginationModel}
            onPaginationModelChange={setPaginationModel}
            rowSelectionModel={rowSelectionModel}
            onRowSelectionModelChange={(nextSelection) => setRowSelectionModel(nextSelection)}
            initialState={{
              sorting: { sortModel: [{ field: 'createdAt', sort: 'desc' }] },
            }}
            slotProps={{
              toolbar: {
                showQuickFilter: true,
                quickFilterProps: { debounceMs: 250 },
                csvOptions: { fileName: 'admin-users', utf8WithBom: true },
                printOptions: { disableToolbarButton: true },
              },
            }}
            sx={{
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
              // Toolbar buttons (Columns, Filters, Export)
              '& .MuiDataGrid-toolbarContainer .MuiButtonBase-root': {
                color: 'var(--mantine-color-text)',
              },
              '& .MuiDataGrid-toolbarContainer svg': {
                color: 'var(--mantine-color-text)',
              },
              // Footer pagination text and select
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
              // Footer and toolbar icon buttons
              '& .MuiTablePagination-root .MuiIconButton-root': {
                color: 'var(--mantine-color-text)',
              },
              '& .MuiTablePagination-root .MuiIconButton-root.Mui-disabled': {
                color: 'var(--app-admin-table-muted-text)',
              },
              // Row checkboxes
              '& .MuiCheckbox-root': {
                color: 'var(--app-admin-table-muted-text)',
              },
              '& .MuiCheckbox-root.Mui-checked, & .MuiCheckbox-root.MuiCheckbox-indeterminate': {
                color: 'var(--app-admin-table-summary-selected-bg)',
              },
              // Remove cell/header focus outlines
              '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within': {
                outline: 'none',
              },
              '& .MuiDataGrid-columnHeader:focus, & .MuiDataGrid-columnHeader:focus-within': {
                outline: 'none',
              },
            }}
          />
        </ThemeProvider>
      </Paper>
    </div>
  );
}
