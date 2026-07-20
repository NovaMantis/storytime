import { listMediaItems } from '../../utils/mediaLibrary'

export default defineEventHandler(() => {
  return { items: listMediaItems() }
})
