import { BookmarksClient } from '@baobab/cloud-client'
import { client } from '~/auth/api'
export const bookmarksClient = new BookmarksClient(client)
