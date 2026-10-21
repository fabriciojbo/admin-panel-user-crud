import type { UserLoginEvent } from '@netlify/functions'
import { identityAccess } from '../../db/rbac'

export default {
  async userLogin(event: UserLoginEvent) {
    const access = await identityAccess(event.user.id)
    if (!access) return event.deny()
    return {
      user: {
        ...event.user,
        appMetadata: {
          ...event.user.appMetadata,
          roles: access.roles.map((role) => role.name),
          permissions: access.permissions,
        },
      },
    }
  },
}
