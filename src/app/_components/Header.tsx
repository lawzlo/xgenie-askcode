'use client'

import Link from 'next/link'
import type { Session, Team } from '../_types'

type HeaderProps = {
  session: Session | null
  teams: Team[]
  currentTeamId: string | null
  userAccessLevel: number
  onTeamSwitch: (teamId: string) => void
  onOpenAddProject: () => void
  onOpenProviders: () => void
  onOpenTeam: () => void
  onLogout: () => void
  onDeleteAccount: () => void
  onLogin: () => void
  onSignup: () => void
}

export function Header({
  session,
  teams,
  currentTeamId,
  userAccessLevel,
  onTeamSwitch,
  onOpenAddProject,
  onOpenProviders,
  onOpenTeam,
  onLogout,
  onDeleteAccount,
  onLogin,
  onSignup
}: HeaderProps) {
  const isFullAccess = userAccessLevel >= 100
  return (
    <div className="header">
      <div className="header-inner">
        <Link href="/" className="logo">
          A
        </Link>
        <b style={{ color: '#000' }}>AskCode</b>
        {session && isFullAccess ? (
          <div className="nav-links" style={{ display: 'flex' }}>
            <span>|</span>
            <button type="button" className="link-button" onClick={onOpenAddProject}>
              add project
            </button>
            <span>|</span>
            <button type="button" className="link-button" onClick={onOpenProviders}>
              providers
            </button>
          </div>
        ) : null}
        <div className="header-right">
          {session ? (
            <>
              {teams.length > 0 ? (
                <>
                  <select
                    value={currentTeamId || teams[0]?.id}
                    onChange={(event) => onTeamSwitch(event.target.value)}
                    style={{ fontSize: '10pt', border: 'none', background: '#ff6600', cursor: 'pointer' }}
                  >
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                  {isFullAccess && (
                    <>
                      <span>|</span>
                      <button type="button" className="link-button" onClick={onOpenTeam}>
                        team
                      </button>
                    </>
                  )}
                  <span>|</span>
                </>
              ) : null}
              <select
                defaultValue=""
                onChange={(event) => {
                  const action = event.target.value
                  event.target.value = ''
                  if (action === 'logout') onLogout()
                  if (action === 'delete') onDeleteAccount()
                }}
                style={{ fontSize: '10pt', border: 'none', background: '#ff6600', cursor: 'pointer' }}
              >
                <option value="" disabled>{session.user.email}</option>
                <option value="logout">logout</option>
                <option value="delete">delete account</option>
              </select>
            </>
          ) : (
            <>
              <button type="button" className="link-button" onClick={onLogin}>
                login
              </button>
              <span>|</span>
              <button type="button" className="link-button" onClick={onSignup}>
                signup
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
