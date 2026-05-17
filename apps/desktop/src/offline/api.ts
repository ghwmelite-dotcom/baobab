import { OfflineClient } from '@baobab/cloud-client'
import { client } from '~/auth/api'
export const offlineClient = new OfflineClient(client)
