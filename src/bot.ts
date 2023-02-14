import { Bot, Context, Logger, Schema } from 'koishi'
import { Client, createClient } from 'oicq'
import { QrcodeResult } from 'oicq/lib/core'
import OICQService from './frontend'

export const logger = new Logger('oicq')

export class OICQBot extends Bot {
  client: Client
  constructor (ctx: Context, config: OICQBot.Config) {
    super(ctx, config)
    ctx.plugin(OICQService, this)
    this.client = createClient(config.uin, {
      data_dir: process.env.PWD + '/data',
    })
    this.selfId = `${config.uin}`
    this.userId = this.selfId
    let timer: NodeJS.Timer
    this.client.on('system.online', () => {
      ctx.emit('oicq/loggedin')
      this.online()
      if (timer) clearInterval(timer)
    })
    this.client.on('system.login.qrcode', ({ image }) => {
      ctx.emit('oicq/qrcode', image)
      if (!timer) {
        timer = setInterval(async () => {
          const { retcode, t106, t16a, t318, tgtgt } = await this.client.queryQrcodeResult()
          if (retcode === QrcodeResult.WaitingForScan 
            || retcode === QrcodeResult.WaitingForConfirm) return
          if (retcode === 0 && t106 && t16a && t318 && tgtgt) {
            this.client.qrcodeLogin()
          } else {
            logger.warn(`QrcodeResult: ${retcode}`)
            this.client.fetchQrcode()
          }
        }, 5000)
      }
    })
    this.client.login()
  }

  async stop() {
    return this.client?.logout()
  }
}

export namespace OICQBot {
  export interface Config extends Bot.Config {
    uin: number
  }

  export const Config = Schema.object({
    uin: Schema.natural().required().description('机器人的账号。'),
  })
}

OICQBot.prototype.platform = 'oicq'