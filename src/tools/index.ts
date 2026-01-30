import * as fs from 'fs/promises'
import * as path from 'path'
import { glob } from 'glob'

// Security: ensure path is within workspace
function securePath(workspacePath: string, filePath: string): string {
  const resolved = path.resolve(workspacePath, filePath)
  if (!resolved.startsWith(path.resolve(workspacePath))) {
    throw new Error('Path traversal attempt detected')
  }
  return resolved
}

export async function readFile(
  workspacePath: string,
  filePath: string
): Promise<string> {
  const fullPath = securePath(workspacePath, filePath)

  try {
    const stat = await fs.stat(fullPath)
    if (stat.size > 1024 * 1024) { // 1MB limit
      return `[File too large: ${stat.size} bytes. Showing first 10000 characters]\n` +
        (await fs.readFile(fullPath, 'utf-8')).slice(0, 10000)
    }
    return await fs.readFile(fullPath, 'utf-8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return `[File not found: ${filePath}]`
    }
    throw error
  }
}

export async function listDirectory(
  workspacePath: string,
  dirPath: string = '.'
): Promise<string[]> {
  const fullPath = securePath(workspacePath, dirPath)

  try {
    const entries = await fs.readdir(fullPath, { withFileTypes: true })
    return entries.map(e => e.isDirectory() ? `${e.name}/` : e.name)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }
    throw error
  }
}

export async function searchFiles(
  workspacePath: string,
  pattern: string
): Promise<string[]> {
  const results = await glob(pattern, {
    cwd: workspacePath,
    ignore: ['node_modules/**', '.git/**', 'dist/**', 'build/**', '*.lock'],
    nodir: true
  })
  return results.slice(0, 100) // Limit results
}

export async function grepContent(
  workspacePath: string,
  searchTerm: string,
  filePattern: string = '**/*'
): Promise<Array<{ file: string; line: number; content: string }>> {
  const files = await glob(filePattern, {
    cwd: workspacePath,
    ignore: ['node_modules/**', '.git/**', 'dist/**', 'build/**', '*.lock', '**/*.png', '**/*.jpg', '**/*.ico'],
    nodir: true
  })

  const results: Array<{ file: string; line: number; content: string }> = []
  const searchLower = searchTerm.toLowerCase()

  for (const file of files.slice(0, 500)) { // Limit files to search
    try {
      const fullPath = securePath(workspacePath, file)
      const content = await fs.readFile(fullPath, 'utf-8')
      const lines = content.split('\n')

      lines.forEach((line, index) => {
        if (line.toLowerCase().includes(searchLower)) {
          results.push({
            file,
            line: index + 1,
            content: line.trim().slice(0, 200)
          })
        }
      })

      if (results.length >= 50) break // Limit total results
    } catch {
      // Skip binary or unreadable files
    }
  }

  return results
}

// Tool definitions for Claude
export const toolDefinitions = [
  {
    name: 'read_file',
    description: 'Read the contents of a file in the codebase. Use this to understand what a specific file does.',
    input_schema: {
      type: 'object' as const,
      properties: {
        file_path: {
          type: 'string',
          description: 'The path to the file relative to the project root (e.g., "src/services/order.ts")'
        }
      },
      required: ['file_path']
    }
  },
  {
    name: 'list_directory',
    description: 'List files and directories in a given path. Use this to explore the project structure.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'The directory path relative to project root (e.g., "src/services"). Use "." for root.'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'search_files',
    description: 'Search for files matching a glob pattern. Use this to find files by name or extension.',
    input_schema: {
      type: 'object' as const,
      properties: {
        pattern: {
          type: 'string',
          description: 'Glob pattern to match (e.g., "**/*.ts", "**/order*.ts", "src/**/*.tsx")'
        }
      },
      required: ['pattern']
    }
  },
  {
    name: 'grep',
    description: 'Search for text content within files. Use this to find where specific functions, classes, or terms are used.',
    input_schema: {
      type: 'object' as const,
      properties: {
        search_term: {
          type: 'string',
          description: 'The text to search for (case-insensitive)'
        },
        file_pattern: {
          type: 'string',
          description: 'Optional glob pattern to limit search to specific files (e.g., "**/*.ts"). Defaults to all files.'
        }
      },
      required: ['search_term']
    }
  }
]
