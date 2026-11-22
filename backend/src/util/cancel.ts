// Cooperative cancellation of the running update. An admin cancels a run by marking it finished
// in the database (see cancelRun); the process running it notices this on its next heartbeat, or
// right away when the cancel request reaches the same process. Long loops call throwIfCancelled()
// between steps, and every Finlex request checks it, so even an endless listing loop stops.

export class UpdateCancelledError extends Error {
  constructor() {
    super('Update cancelled by admin')
    this.name = 'UpdateCancelledError'
  }
}

let cancelRequested = false

export const requestCancel = () => { cancelRequested = true }
export const resetCancel = () => { cancelRequested = false }
export const isCancelRequested = () => cancelRequested

export function throwIfCancelled(): void {
  if (cancelRequested) throw new UpdateCancelledError()
}
