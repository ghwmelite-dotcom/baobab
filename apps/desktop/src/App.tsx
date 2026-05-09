import { ThemeProvider } from '@baobab/ui'
import { strings } from '@baobab/brand'

export function App() {
  return (
    <ThemeProvider theme="dark">
      <main style={{ padding: 24 }}>
        <h1>{strings.appName}</h1>
        <p>{strings.tagline}</p>
      </main>
    </ThemeProvider>
  )
}
