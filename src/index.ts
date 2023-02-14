import { OICQBot } from './bot'

declare module '@satorijs/satori' {
  interface Session {
      oicq
  }
}

export default OICQBot
