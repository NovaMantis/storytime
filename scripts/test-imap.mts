import { syncInbox, formatImapError } from '../server/utils/imap.ts'

syncInbox()
  .then((result) => {
    console.log('OK', JSON.stringify(result))
  })
  .catch((e) => {
    console.error('ERR', formatImapError(e))
    if (e && typeof e === 'object' && 'responseText' in e) {
      console.error('responseText', (e as { responseText?: string }).responseText)
    }
    process.exit(1)
  })
