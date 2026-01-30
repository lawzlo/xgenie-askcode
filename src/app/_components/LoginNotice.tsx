'use client'

type LoginNoticeProps = {
  onLogin: () => void
  onSignup: () => void
}

export function LoginNotice({ onLogin, onSignup }: LoginNoticeProps) {
  return (
    <div className="landing">
      <div className="landing-hero">
        <h1>Ask your code. Get real answers.</h1>
        <p className="landing-tagline">
          Stop guessing how your software works. Ask directly.
          AskCode lets anyone—support teams, product managers, or end users—get
          accurate answers from the source code, no technical skills required.
        </p>
        <div className="landing-cta">
          <button type="button" className="cta-btn primary" onClick={onSignup}>
            Get Started
          </button>
          <button type="button" className="cta-btn" onClick={onLogin}>
            Login
          </button>
        </div>
      </div>

      <div className="landing-features">
        <div className="feature">
          <div className="feature-title">Just Ask</div>
          <div className="feature-desc">
            &quot;How does login work?&quot; &quot;What happens when a user cancels?&quot;
            No code knowledge needed. Ask like you&apos;re talking to a teammate.
          </div>
        </div>
        <div className="feature">
          <div className="feature-title">Always Accurate</div>
          <div className="feature-desc">
            Documentation gets outdated. Code doesn&apos;t lie.
            Get answers that reflect how your software actually works, not how it was supposed to work.
          </div>
        </div>
        <div className="feature">
          <div className="feature-title">For Your Whole Team</div>
          <div className="feature-desc">
            Support can answer customers faster. Product can verify features.
            New hires can onboard themselves. Everyone gets unblocked.
          </div>
        </div>
      </div>
    </div>
  )
}
