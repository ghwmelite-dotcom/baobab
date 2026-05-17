import { HistoryClient } from '@baobab/cloud-client'
import { client } from '~/auth/api'
export const historyClient = new HistoryClient(client)
