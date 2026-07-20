import { mkdirSync } from 'node:fs'
import { getDataDir } from '../utils/config'
import { ensureMediaDirs } from '../utils/mediaLibrary'
import { reconcileProjectsFromDisk } from '../utils/projectFolders'
import { getDb } from '../utils/db'
import {
  initImageModel,
  initImagePrompt,
  initManuscriptDefaultFont,
  initTextModel,
  initTextPrompt
} from '../utils/settings'

export default defineNitroPlugin(() => {
  mkdirSync(getDataDir(), { recursive: true })
  mkdirSync(`${getDataDir()}/logs`, { recursive: true })
  mkdirSync(`${getDataDir()}/projects`, { recursive: true })
  mkdirSync(`${getDataDir()}/fonts`, { recursive: true })
  ensureMediaDirs()
  getDb()
  initImagePrompt()
  initTextPrompt()
  initImageModel()
  initTextModel()
  initManuscriptDefaultFont()
  reconcileProjectsFromDisk()
})
