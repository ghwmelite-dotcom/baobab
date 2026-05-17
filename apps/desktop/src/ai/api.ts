import { AiClient } from '@baobab/cloud-client'
import { client } from '~/auth/api'

export const aiClient = new AiClient(client)
