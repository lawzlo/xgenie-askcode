import type { Project } from '../types'

export function safeProject(project: Project) {
  return {
    ...project,
    credentials: project.credentials ? { hasToken: true } : undefined
  }
}

export function safeProjects(projects: Project[]) {
  return projects.map(safeProject)
}
