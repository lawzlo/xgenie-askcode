import { randomUUID } from 'crypto'
import { supabase } from '../lib/supabase'
import { processProjectJob, type ProjectJob } from '../services/project'

const WORKER_ID = process.env.WORKER_ID || `worker-${randomUUID()}`
const POLL_INTERVAL_MS = Number(process.env.JOB_POLL_INTERVAL_MS || 2000)
const IDLE_DELAY_MS = Number(process.env.JOB_IDLE_DELAY_MS || 4000)
const MAX_BACKOFF_MS = Number(process.env.JOB_MAX_BACKOFF_MS || 30000)

let shouldStop = false

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return 'Unknown error'
}

async function claimJob(): Promise<ProjectJob | null> {
  const { data, error } = await supabase.rpc('claim_project_job', { worker_id: WORKER_ID })
  if (error) {
    console.error('[worker] Failed to claim job:', error)
    return null
  }
  // Validate that we got a real job with required fields
  if (!data || !data.id || !data.project_id) {
    return null
  }
  return data as ProjectJob
}

async function updateJob(jobId: string, updates: Record<string, unknown>) {
  const payload = { ...updates, updated_at: new Date().toISOString() }
  const { error } = await supabase
    .from('project_jobs')
    .update(payload)
    .eq('id', jobId)

  if (error) {
    console.error('[worker] Failed to update job:', error)
  }
}

async function handleJob(job: ProjectJob) {
  try {
    console.log(`[worker] Processing job ${job.id} (${job.type}) for project ${job.project_id}`)
    await processProjectJob(job)
    await updateJob(job.id, {
      status: 'success',
      finished_at: new Date().toISOString(),
      error: null,
      locked_by: WORKER_ID
    })
    console.log(`[worker] Job ${job.id} completed`) 
  } catch (error) {
    const message = getErrorMessage(error)
    const shouldRetry = job.attempts < job.max_attempts
    const backoff = Math.min(MAX_BACKOFF_MS, POLL_INTERVAL_MS * job.attempts * 2)

    if (shouldRetry) {
      console.warn(`[worker] Job ${job.id} failed, retrying in ${backoff}ms: ${message}`)
      await updateJob(job.id, {
        status: 'queued',
        run_after: new Date(Date.now() + backoff).toISOString(),
        error: message,
        locked_by: null
      })
    } else {
      console.error(`[worker] Job ${job.id} failed permanently: ${message}`)
      await updateJob(job.id, {
        status: 'error',
        finished_at: new Date().toISOString(),
        error: message,
        locked_by: WORKER_ID
      })
    }
  }
}

async function loop() {
  console.log(`[worker] Starting with id ${WORKER_ID}`)
  while (!shouldStop) {
    const job = await claimJob()
    if (!job) {
      await sleep(IDLE_DELAY_MS)
      continue
    }

    await handleJob(job)
    await sleep(POLL_INTERVAL_MS)
  }
  console.log('[worker] Stopped')
}

process.on('SIGINT', () => {
  shouldStop = true
})

process.on('SIGTERM', () => {
  shouldStop = true
})

loop().catch((error) => {
  console.error('[worker] Fatal error:', error)
  process.exit(1)
})
