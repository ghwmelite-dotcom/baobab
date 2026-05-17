import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { SearchApp } from './search/SearchApp'

const root = document.getElementById('root')
if (!root) throw new Error('#root not found')

createRoot(root).render(
  <StrictMode>
    <SearchApp />
  </StrictMode>,
)
