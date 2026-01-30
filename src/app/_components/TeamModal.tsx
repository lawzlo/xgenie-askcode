'use client'

import type { FormEvent } from 'react'
import type { TeamInvite, TeamMember } from '../_types'

type TeamModalProps = {
  open: boolean
  teamNameInput: string
  onTeamNameChange: (value: string) => void
  onUpdateTeamName: () => void
  teamMembers: TeamMember[]
  teamInvites: TeamInvite[]
  isTeamOwner: boolean
  inviteEmail: string
  onInviteEmailChange: (value: string) => void
  onInviteMember: (event: FormEvent<HTMLFormElement>) => void
  onRemoveMember: (userId: string) => void
  onUpdateAccessLevel: (userId: string, level: number) => void
  onCancelInvite: (inviteId: string) => void
  onClose: () => void
}

function AccessLevelSlider({
  value,
  disabled,
  onChange
}: {
  value: number
  disabled?: boolean
  onChange?: (value: number) => void
}) {
  // Map value to slider position (0, 1, 2)
  const getPosition = (v: number) => (v >= 100 ? 2 : v >= 60 ? 1 : 0)
  const getValue = (pos: number) => (pos === 2 ? 100 : pos === 1 ? 60 : 30)
  const getLabel = (v: number) => (v >= 100 ? 'Full' : v >= 60 ? 'Internal' : 'External')

  const position = getPosition(value)

  return (
    <div className="access-slider-container">
      <input
        type="range"
        min={0}
        max={2}
        step={1}
        value={position}
        disabled={disabled}
        onChange={(e) => onChange?.(getValue(parseInt(e.target.value)))}
        className="access-slider"
      />
      <span className="access-label">{value}% {getLabel(value)}</span>
    </div>
  )
}

export function TeamModal({
  open,
  teamNameInput,
  onTeamNameChange,
  onUpdateTeamName,
  teamMembers,
  teamInvites,
  isTeamOwner,
  inviteEmail,
  onInviteEmailChange,
  onInviteMember,
  onRemoveMember,
  onUpdateAccessLevel,
  onCancelInvite,
  onClose
}: TeamModalProps) {
  if (!open) return null
  return (
    <div
      className="modal-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="modal-content" style={{ maxWidth: 450 }}>
        <div className="modal-title">Team Settings</div>

        <div style={{ marginBottom: 15 }}>
          <label style={{ fontSize: '9pt', color: '#828282' }}>Team Name</label>
          <div style={{ display: 'flex', gap: 5, marginTop: 5 }}>
            <input
              type="text"
              className="form-input"
              style={{ flex: 1 }}
              value={teamNameInput}
              onChange={(event) => onTeamNameChange(event.target.value)}
            />
            <button className="submit-btn" onClick={onUpdateTeamName}>
              save
            </button>
          </div>
        </div>

        <div style={{ marginBottom: 15 }}>
          <div style={{ fontWeight: 'bold', marginBottom: 10 }}>Members</div>
          <div style={{ maxHeight: 150, overflowY: 'auto' }}>
            {teamMembers.length === 0 ? (
              <div style={{ color: '#828282' }}>No members</div>
            ) : (
              teamMembers.map((member) => (
                <div key={member.user_id} className="team-member-item">
                  <div className="team-member-info">
                    <span className="team-member-email">{member.email}</span>
                    {member.role === 'owner' && <span className="team-member-role">owner</span>}
                  </div>
                  <div className="team-member-controls">
                    <AccessLevelSlider
                      value={member.access_level}
                      disabled={!isTeamOwner || member.role === 'owner'}
                      onChange={(level) => onUpdateAccessLevel(member.user_id, level)}
                    />
                    {isTeamOwner && member.role !== 'owner' && (
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => onRemoveMember(member.user_id)}
                        style={{ color: '#c00', marginLeft: 10 }}
                      >
                        remove
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {isTeamOwner ? (
          <div style={{ marginBottom: 15 }}>
            <div style={{ fontWeight: 'bold', marginBottom: 10 }}>Invite Member</div>
            <form onSubmit={onInviteMember} style={{ display: 'flex', gap: 5 }}>
              <input
                type="email"
                className="form-input"
                placeholder="email@example.com"
                style={{ flex: 1 }}
                value={inviteEmail}
                onChange={(event) => onInviteEmailChange(event.target.value)}
              />
              <button type="submit" className="submit-btn">
                invite
              </button>
            </form>
            <div style={{ marginTop: 10, maxHeight: 100, overflowY: 'auto' }}>
              {teamInvites.length === 0 ? (
                <div style={{ color: '#828282' }}>No pending invites</div>
              ) : (
                teamInvites.map((invite) => (
                  <div key={invite.id} className="team-invite-item">
                    <span>{invite.email}</span>
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => onCancelInvite(invite.id)}
                      style={{ color: '#c00' }}
                    >
                      cancel
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}

        <div style={{ marginTop: 20, textAlign: 'right' }}>
          <button className="submit-btn" onClick={onClose}>
            close
          </button>
        </div>
      </div>
    </div>
  )
}
