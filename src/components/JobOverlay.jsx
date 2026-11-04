/** Progress for long exports (video, variants), with Cancel. Blocks the UI while running. */
export default function JobOverlay({ job }) {
  if (!job) return null
  const pct = Math.round((job.progress ?? 0) * 100)
  return (
    <div className="job-overlay" role="dialog" aria-modal="true" aria-label={job.title}>
      <div className="job-card">
        <p className="job-title">{job.title}</p>
        <div className="job-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <div className={`job-fill${job.indeterminate ? ' job-fill--busy' : ''}`} style={job.indeterminate ? undefined : { transform: `scaleX(${pct / 100})` }} />
        </div>
        <p className="job-detail">{job.detail}</p>
        {job.cancel && (
          <button type="button" className="btn-ghost" onClick={job.cancel} disabled={job.cancelling}>
            {job.cancelling ? 'Cancelling…' : 'Cancel'}
          </button>
        )}
      </div>
    </div>
  )
}
