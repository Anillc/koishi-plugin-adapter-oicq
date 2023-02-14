import { Bot, Context, Fragment, Logger, Schema, SendOptions } from 'koishi'
import { Client, createClient } from 'oicq'
import { QrcodeResult } from 'oicq/lib/core'
import { resolve } from 'path'
import OICQService from './frontend'
import { OICQMessenger } from './message'
import { dispatchSession } from './utils'

export const logger = new Logger('oicq')

export class OICQBot extends Bot {
  client: Client
  internal = {}
  constructor (ctx: Context, config: OICQBot.Config) {
    super(ctx, config)
    ctx.plugin(OICQService, this)
    this.client = createClient(config.uin, {
      data_dir: config.data || resolve(process.env.PWD + '/data'),
      ffmpeg_path: config.ffmpeg,
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
    this.client.on('message', event => {
      dispatchSession(this, event)
    })
    this.client.login()
  }

  async stop() {
    return this.client?.logout()
  }

  async sendMessage(channelId: string, content: Fragment, guildId?: string, options?: SendOptions) {
    return await new OICQMessenger(this, channelId, guildId, options).send(content)
  }

  async sendPrivateMessage(userId: string, content: Fragment, options?: SendOptions) {
    return await new OICQMessenger(this, `private:${userId}`, null, options).send(content)
  }
}

export namespace OICQBot {
  export interface Config extends Bot.Config {
    uin: number
    data: string
    ffmpeg: string
  }

  export const Config = Schema.object({
    uin: Schema.natural().required().description('机器人的账号。'),
    data: Schema.string().description('数据存放地址。(默认为 PWD)'),
    ffmpeg: Schema.string().description('ffmpeg 可执行文件地址。'),
  })
}

OICQBot.prototype.platform = 'oicq'