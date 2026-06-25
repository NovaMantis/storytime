import { mkdirSync } from 'node:fs'
import { getDataDir } from '../utils/config'
import { reconcileProjectsFromDisk } from '../utils/projectFolders'
import { getDb } from '../utils/db'
import { initImageModel, initImagePrompt, initTextModel, initTextPrompt } from '../utils/settings'

export default defineNitroPlugin(() => {
  mkdirSync(getDataDir(), { recursive: true })
  mkdirSync(`${getDataDir()}/logs`, { recursive: true })
  mkdirSync(`${getDataDir()}/projects`, { recursive: true })
  getDb()
  initImagePrompt()
  initTextPrompt()
  initImageModel()
  initTextModel()
  reconcileProjectsFromDisk()
})
