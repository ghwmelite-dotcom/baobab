// Voice: confident, specific, no folksy or jargon.
// Loading states are sentences, not spinners alone (spec §6.4).

export const strings = {
  tagline: 'The browser that grew here.',
  appName: 'Baobab',
  loading: {
    aiThinking: 'Reaching across the continent…',
    savingOffline: 'Saving for the next quiet evening…',
    fetchingPage: 'Fetching the page…',
    summarizing: 'Reading carefully…',
  },
  residency: {
    home: 'Home',
    roaming: 'Roaming',
    sovereign: 'Sovereign',
    saved: 'Saved',
    agent: 'Agent',
  },
  tooltips: {
    home: 'Your data stays on the continent.',
    roaming: 'Served from outside Africa right now.',
    lowBandwidth: 'Low-bandwidth mode reduces images and uses a smaller AI model.',
  },
  errors: {
    networkOffline: "Looks like you're offline.",
    aiFailed: 'The model could not respond. Try again or switch model.',
  },
} as const

export type Strings = typeof strings
