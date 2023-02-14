import { resolve } from 'path'
import { Context } from 'koishi'
import { DataService } from '@koishijs/plugin-console'
import { OICQBot } from './bot'

export const using = ['console']

declare module '@koishijs/plugin-console' {
  namespace Console {
    interface Services {
      oicq: OICQService
    }
  }
}

declare module 'koishi' {
  interface Events {
    'oicq/qrcode'(qrcode: Buffer): void
    'oicq/loggedin'(): void
  }
}

interface OICQData {
  qrcode?: string
}

export class OICQService extends DataService<OICQData> {
  data: OICQData = {}
  constructor(ctx: Context, bot: OICQBot) {
    super(ctx, 'oicq')
    ctx.console.addEntry({
      dev: resolve(__dirname, '../client/index.ts'),
      prod: resolve(__dirname, '../dist'),
    })
    ctx.on('oicq/qrcode', qrcode => {
      const base64 = qrcode.toString('base64')
      this.setQRCode(`data:image/png;base64,${base64}`)
    })
    ctx.on('oicq/loggedin', () => {
      this.setQRCode(null)
    })
  }

  async setQRCode(qrcode: string) {
    this.data.qrcode = qrcode
    await this.refresh()
  }

  async get() {
    return this.data
  }
}

export default OICQService