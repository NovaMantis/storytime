import { deleteProject } from '../../../utils/projectFolders'
import { AppError, throwAppError } from '../../../utils/errors'

export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throwAppError(new AppError('INVALID_ID', 'Project id is required.', 400))
  }

  try {
    return deleteProject(id)
  } catch (err) {
    if (err instanceof AppError) {
      throwAppError(err)
    }
    throw err
  }
})
