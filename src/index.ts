import { Client, Message } from 'oicq'
import { OICQBot } from './bot'

declare module '@satorijs/satori' {
  interface Session {
      oicq: Message & { client: Client }
  }
}

export default OICQBot
