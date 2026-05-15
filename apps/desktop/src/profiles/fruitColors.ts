export type FruitColor =
  | 'mango' | 'baobab' | 'shea' | 'indigo'
  | 'hibiscus' | 'palm' | 'kola' | 'baobwhite'

export const FRUIT_HEX: Record<FruitColor, { from: string; to: string }> = {
  mango:    { from: '#ff8a5b', to: '#c44a1f' },
  baobab:   { from: '#ffd86f', to: '#c4881f' },
  shea:     { from: '#b8d96f', to: '#5a8a1f' },
  indigo:   { from: '#6fb2d9', to: '#1f5a8a' },
  hibiscus: { from: '#d96fb8', to: '#8a1f5a' },
  palm:     { from: '#afd9b8', to: '#4a8a5a' },
  kola:     { from: '#ffaf6f', to: '#c4661f' },
  baobwhite:{ from: '#e8ddc4', to: '#a8987a' },
}

export const FRUIT_COLOR_ORDER: FruitColor[] = [
  'mango', 'baobab', 'shea', 'indigo', 'hibiscus', 'palm', 'kola', 'baobwhite',
]
