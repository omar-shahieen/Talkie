import React, { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Button,
  Checkbox,
  Divider,
  FormControl,
  FormLabel,
  HStack,
  Input,
  Link,
  Spinner,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
} from '@chakra-ui/react';
import {
  createRole,
  deleteRole,
  fetchRoles,
  updateRole,
  RoleRecord,
} from '../../app/services/roles.service';
import {
  resolveAppAccess,
  resolveServerAccess,
} from '../../app/services/access-control.service';
import {
  fetchCurrentUser,
  UserPayload,
} from '../../app/services/user.service';

const PERMISSIONS: Array<{ key: string; value: number }> = [
  { key: 'ViewChannel', value: Math.pow(2, 0) },
  { key: 'SendMessages', value: Math.pow(2, 1) },
  { key: 'ManageMessages', value: Math.pow(2, 2) },
  { key: 'ManageChannels', value: Math.pow(2, 3) },
  { key: 'ManageRoles', value: Math.pow(2, 4) },
  { key: 'KickMembers', value: Math.pow(2, 5) },
  { key: 'BanMembers', value: Math.pow(2, 6) },
  { key: 'Administrator', value: Math.pow(2, 7) },
];

function toPermissionString(keys: string[]) {
  return keys
    .reduce((acc, key) => {
      const found = PERMISSIONS.find((item) => item.key === key);
      return found ? acc | found.value : acc;
    }, 0)
    .toString();
}

function fromPermissionString(value?: string) {
  let bits = 0;

  try {
    bits = Number(value || '0');
  } catch {
    bits = 0;
  }

  return PERMISSIONS.filter((item) => (bits & item.value) === item.value).map(
    (item) => item.key,
  );
}

export default function AdminManagementView() {
  const [currentUser, setCurrentUser] = useState<UserPayload | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [isLoadingRoles, setIsLoadingRoles] = useState(false);
  const [rolesError, setRolesError] = useState('');

  const [serverId, setServerId] = useState('');
  const [roleName, setRoleName] = useState('');
  const [rolePosition, setRolePosition] = useState('0');
  const [isEveryone, setIsEveryone] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  const [editingRoleId, setEditingRoleId] = useState('');
  const [editName, setEditName] = useState('');
  const [editPosition, setEditPosition] = useState('0');
  const [editPermissions, setEditPermissions] = useState<string[]>([]);

  const [statusMessage, setStatusMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [resolveUserId, setResolveUserId] = useState('');
  const [resolveServerId, setResolveServerId] = useState('');
  const [accessCheckResult, setAccessCheckResult] = useState('');
  const [isCheckingAccess, setIsCheckingAccess] = useState(false);

  const canAccessAdmin = useMemo(
    () => currentUser?.appRole === 'admin',
    [currentUser?.appRole],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadCurrentUser() {
      try {
        setIsLoadingUser(true);
        const user = await fetchCurrentUser();
        if (isMounted) {
          setCurrentUser(user);
        }
      } catch {
        if (isMounted) {
          setCurrentUser(null);
        }
      } finally {
        if (isMounted) {
          setIsLoadingUser(false);
        }
      }
    }

    void loadCurrentUser();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!canAccessAdmin) {
      return;
    }

    void loadRoles();
  }, [canAccessAdmin]);

  async function loadRoles() {
    try {
      setIsLoadingRoles(true);
      setRolesError('');
      const data = await fetchRoles();
      setRoles(data);
    } catch (error) {
      setRolesError(
        error instanceof Error ? error.message : 'Unable to load roles.',
      );
    } finally {
      setIsLoadingRoles(false);
    }
  }

  async function submitRoleCreate() {
    if (!serverId || !roleName.trim()) {
      setStatusMessage('Server id and role name are required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setStatusMessage('');

      await createRole({
        serverId: serverId.trim(),
        name: roleName.trim(),
        position: Number(rolePosition || 0),
        isEveryone,
        permissions: toPermissionString(selectedPermissions),
      });

      setRoleName('');
      setRolePosition('0');
      setIsEveryone(false);
      setSelectedPermissions([]);
      setStatusMessage('Role created successfully.');
      await loadRoles();
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : 'Unable to create role.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function startEditingRole(role: RoleRecord) {
    setEditingRoleId(role.id);
    setEditName(role.name);
    setEditPosition(String(role.position ?? 0));
    setEditPermissions(fromPermissionString(role.permissions));
  }

  async function submitRoleUpdate(roleId: string) {
    try {
      setIsSubmitting(true);
      setStatusMessage('');

      await updateRole(roleId, {
        name: editName.trim(),
        position: Number(editPosition || 0),
        permissions: toPermissionString(editPermissions),
      });

      setEditingRoleId('');
      setStatusMessage('Role updated successfully.');
      await loadRoles();
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : 'Unable to update role.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitRoleDelete(roleId: string) {
    try {
      setIsSubmitting(true);
      setStatusMessage('');
      await deleteRole(roleId);
      setStatusMessage('Role deleted successfully.');
      await loadRoles();
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : 'Unable to delete role.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function checkAppAccess() {
    try {
      setIsCheckingAccess(true);
      const data = await resolveAppAccess();
      setAccessCheckResult(data?.message || 'App access resolved.');
    } catch (error) {
      setAccessCheckResult(
        error instanceof Error ? error.message : 'Unable to resolve app access.',
      );
    } finally {
      setIsCheckingAccess(false);
    }
  }

  async function checkServerAccess() {
    if (!resolveUserId || !resolveServerId) {
      setAccessCheckResult('User id and server id are required.');
      return;
    }

    try {
      setIsCheckingAccess(true);
      const data = await resolveServerAccess(
        resolveUserId.trim(),
        resolveServerId.trim(),
      );
      setAccessCheckResult(data?.message || 'Server access resolved.');
    } catch (error) {
      setAccessCheckResult(
        error instanceof Error
          ? error.message
          : 'Unable to resolve server access.',
      );
    } finally {
      setIsCheckingAccess(false);
    }
  }

  if (isLoadingUser) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minH="200px">
        <Spinner />
      </Box>
    );
  }

  if (!canAccessAdmin) {
    return (
      <Box>
        <Text fontSize="2xl" fontWeight="bold" marginBottom="12px">
          Admin Management
        </Text>
        <Text color="red.300" marginBottom="10px">
          This page is available for admin users only.
        </Text>
        <Link as={RouterLink} to="/settings" color="blue.300">
          Back to settings
        </Link>
      </Box>
    );
  }

  return (
    <Box>
      <Text fontSize="2xl" fontWeight="bold" marginBottom="8px">
        Admin Management
      </Text>
      <Text color="whiteAlpha.700" marginBottom="20px">
        Manage roles, permissions, and access-control checks.
      </Text>

      <Box marginBottom="24px" padding="14px" border="1px solid #3d3d3d" borderRadius="10px">
        <Text fontSize="lg" fontWeight="bold" marginBottom="10px">
          Roles & Permissions
        </Text>

        <VStack align="stretch" spacing="10px" marginBottom="16px">
          <FormControl>
            <FormLabel>Server ID</FormLabel>
            <Input
              value={serverId}
              onChange={(event) => setServerId(event.target.value)}
              placeholder="Server id"
            />
          </FormControl>
          <FormControl>
            <FormLabel>Role Name</FormLabel>
            <Input
              value={roleName}
              onChange={(event) => setRoleName(event.target.value)}
              placeholder="Moderator"
            />
          </FormControl>
          <HStack spacing="10px">
            <FormControl>
              <FormLabel>Position</FormLabel>
              <Input
                value={rolePosition}
                onChange={(event) => setRolePosition(event.target.value)}
                placeholder="0"
                type="number"
              />
            </FormControl>
            <FormControl display="flex" alignItems="center" marginTop="30px">
              <Checkbox
                isChecked={isEveryone}
                onChange={(event) => setIsEveryone(event.target.checked)}
              >
                Everyone role
              </Checkbox>
            </FormControl>
          </HStack>

          <Box>
            <Text fontSize="sm" marginBottom="6px">
              Permissions
            </Text>
            <HStack wrap="wrap" spacing="10px">
              {PERMISSIONS.map((permission) => (
                <Checkbox
                  key={permission.key}
                  isChecked={selectedPermissions.includes(permission.key)}
                  onChange={(event) => {
                    setSelectedPermissions((current) =>
                      event.target.checked
                        ? [...current, permission.key]
                        : current.filter((item) => item !== permission.key),
                    );
                  }}
                >
                  {permission.key}
                </Checkbox>
              ))}
            </HStack>
          </Box>

          <Button
            width="fit-content"
            colorScheme="blue"
            onClick={submitRoleCreate}
            isLoading={isSubmitting}
          >
            Create Role
          </Button>
        </VStack>

        {statusMessage ? (
          <Text marginBottom="10px" color="yellow.300">
            {statusMessage}
          </Text>
        ) : null}

        {rolesError ? (
          <Text marginBottom="10px" color="red.300">
            {rolesError}
          </Text>
        ) : null}

        {isLoadingRoles ? (
          <Spinner size="sm" />
        ) : (
          <Table size="sm" variant="simple">
            <Thead>
              <Tr>
                <Th color="gray.300">Name</Th>
                <Th color="gray.300">Server</Th>
                <Th color="gray.300">Position</Th>
                <Th color="gray.300">Permissions</Th>
                <Th color="gray.300">Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {roles.map((role) => {
                const isEditing = editingRoleId === role.id;

                return (
                  <Tr key={role.id}>
                    <Td>
                      {isEditing ? (
                        <Input
                          value={editName}
                          onChange={(event) => setEditName(event.target.value)}
                          size="sm"
                        />
                      ) : (
                        role.name
                      )}
                    </Td>
                    <Td>{role.serverId}</Td>
                    <Td>
                      {isEditing ? (
                        <Input
                          value={editPosition}
                          onChange={(event) => setEditPosition(event.target.value)}
                          size="sm"
                          type="number"
                          maxW="90px"
                        />
                      ) : (
                        role.position
                      )}
                    </Td>
                    <Td>
                      {isEditing ? (
                        <VStack align="start" spacing="2px">
                          {PERMISSIONS.map((permission) => (
                            <Checkbox
                              key={`${role.id}-${permission.key}`}
                              size="sm"
                              isChecked={editPermissions.includes(permission.key)}
                              onChange={(event) => {
                                setEditPermissions((current) =>
                                  event.target.checked
                                    ? [...current, permission.key]
                                    : current.filter(
                                        (item) => item !== permission.key,
                                      ),
                                );
                              }}
                            >
                              {permission.key}
                            </Checkbox>
                          ))}
                        </VStack>
                      ) : (
                        fromPermissionString(role.permissions).join(', ') || 'None'
                      )}
                    </Td>
                    <Td>
                      <HStack spacing="6px">
                        {isEditing ? (
                          <>
                            <Button
                              size="xs"
                              colorScheme="green"
                              onClick={() => void submitRoleUpdate(role.id)}
                              isLoading={isSubmitting}
                            >
                              Save
                            </Button>
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() => setEditingRoleId('')}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="xs"
                            onClick={() => startEditingRole(role)}
                            variant="outline"
                          >
                            Edit
                          </Button>
                        )}
                        <Button
                          size="xs"
                          colorScheme="red"
                          variant="outline"
                          onClick={() => void submitRoleDelete(role.id)}
                          isLoading={isSubmitting}
                        >
                          Delete
                        </Button>
                      </HStack>
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        )}
      </Box>

      <Divider marginY="18px" />

      <Box padding="14px" border="1px solid #3d3d3d" borderRadius="10px">
        <Text fontSize="lg" fontWeight="bold" marginBottom="10px">
          Access Control Checks
        </Text>
        <HStack spacing="10px" marginBottom="10px">
          <Button
            onClick={checkAppAccess}
            isLoading={isCheckingAccess}
            colorScheme="blue"
            variant="outline"
          >
            Check App Access
          </Button>
        </HStack>

        <HStack spacing="8px" marginBottom="10px" align="end">
          <FormControl>
            <FormLabel>User ID</FormLabel>
            <Input
              value={resolveUserId}
              onChange={(event) => setResolveUserId(event.target.value)}
              placeholder="User id"
            />
          </FormControl>
          <FormControl>
            <FormLabel>Server ID</FormLabel>
            <Input
              value={resolveServerId}
              onChange={(event) => setResolveServerId(event.target.value)}
              placeholder="Server id"
            />
          </FormControl>
          <Button
            onClick={checkServerAccess}
            isLoading={isCheckingAccess}
            colorScheme="blue"
          >
            Check Server Access
          </Button>
        </HStack>

        {accessCheckResult ? (
          <Text color="yellow.300">{accessCheckResult}</Text>
        ) : (
          <Text color="whiteAlpha.600">Run a check to see access response.</Text>
        )}
      </Box>
    </Box>
  );
}
