import { getUpdateStatus } from '../../utils/gitUpdate'

export default defineEventHandler(async () => {
  return await getUpdateStatus()
})
