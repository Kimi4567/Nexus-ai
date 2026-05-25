export interface QueueJob<T = any> {
  id: string
  type: string
  payload: T
  createdAt: number
}

const inMemoryQueue: QueueJob[] = []

export function enqueueJob<T>(job: QueueJob<T>) {
  if (process.env.REDIS_URL) {
    // Future Redis/BullMQ implementation placeholder.
    // Serialize job and push to Redis stream / queue.
    // Example: bullQueue.add(job.type, job.payload)
  } else {
    inMemoryQueue.push(job)
  }
}

export function getQueuedJobs() {
  if (process.env.REDIS_URL) {
    // Future Redis queue fetch implementation.
    return [] as QueueJob[]
  }
  return inMemoryQueue
}

export function clearQueuedJobs() {
  inMemoryQueue.length = 0
}
