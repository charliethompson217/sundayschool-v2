import { useMemo, useState } from 'react';

import { Avatar, Box, Chip, Stack, Typography } from '@mui/material';
import type { GridColDef, GridRowSelectionModel } from '@mui/x-data-grid';
import { Alert, Badge, Group } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';

import { getUsers } from '@/app/API/adminFunctions';
import type { User } from '@/types/users';
import GenericTable from '@/components/shared/GenericTable';

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

export default function UserTable() {
  const [rowSelectionModel, setRowSelectionModel] = useState<GridRowSelectionModel>(() => ({
    type: 'include',
    ids: new Set(),
  }));

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

  const headerRight = (
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
  );

  return (
    <GenericTable
      tableId="admin-users"
      title="Users"
      description="Search, sort, select, and export the admin user list."
      rows={users}
      columns={columns}
      loading={isLoading}
      checkboxSelection
      rowSelectionModel={rowSelectionModel}
      onRowSelectionModelChange={setRowSelectionModel}
      rowHeight={74}
      defaultPageSize={10}
      pageSizeOptions={[5, 10, 25]}
      initialSort={{ field: 'createdAt', sort: 'desc' }}
      csvFileName="admin-users"
      headerRight={headerRight}
    />
  );
}
