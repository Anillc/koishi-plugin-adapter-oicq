import { Dict, Messenger, segment, Universal } from 'koishi'
import { segment as oseg, Sendable } from 'oicq'
import { OICQBot } from './bot'
import { CQCode } from './cqcode'

class State {
  author: Partial<Universal.Author> = {}
  children: [Sendable, Dict<string>][] = []

  constructor(public type: 'message' | 'forward' | 'reply') {}
}

export class OICQMessenger extends Messenger<OICQBot> {
  stack: State[] = [new State('message')]
  children: CQCode[] = []

  async forward() {
    if (!this.stack[0].children.length) return
    const session = this.bot.session(this.session)
    const message = await this.bot.client.makeForwardMsg(this.stack[0].children.map(([message, data]) => ({
      user_id: +data.uin,
      message: message,
      nickname: data.name
    })))
    session.messageId = this.guildId
      ? '' + await this.bot.client.sendGroupMsg(+this.guildId, message)
      : '' + await this.bot.client.sendPrivateMsg(+this.channelId.slice(8), message)
    session.app.emit(session, 'send', session)
    this.results.push(session)
  }

  async flush() {
    // trim start
    while (true) {
      const first = this.children[0]
      if (first?.type !== 'text') break
      first.data.content = first.data.content.trimStart()
      if (first.data.content) break
      this.children.shift()
    }

    // trim end
    while (true) {
      const last = this.children[this.children.length - 1]
      if (last?.type !== 'text') break
      last.data.content = last.data.content.trimEnd()
      if (last.data.content) break
      this.children.pop()
    }

    // flush
    if (!this.children.length) return
    const { type, author } = this.stack[0]
    if (type === 'forward') {
      const message = oseg.fromCqcode(this.children.reduce((acc, x) => acc + CQCode(x.type, x.data), ''))
      this.stack[1].children.push([message, {
        name: author.nickname || author.username || this.bot.nickname || this.bot.username,
        uin: author.userId || this.bot.userId,
      }])
      this.children = []
      return
    }

    const session = this.bot.session(this.session)
    const message = oseg.fromCqcode(this.children.reduce((acc, x) => acc + CQCode(x.type, x.data), ''))
    session.messageId = this.guildId
        ? '' + await this.bot.client.sendGroupMsg(+this.guildId, message)
        : '' + await this.bot.client.sendPrivateMsg(+this.channelId.slice(8), message)
    session.app.emit(session, 'send', session)
    this.results.push(session)
    this.children = []
  }

  private text(text: string) {
    this.children.push({ type: 'text', data: { content: text } })
  }

  async visit(element: segment) {
    let { type, attrs, children } = element
    if (type === 'text') {
      this.text(attrs.content)
    } else if (type === 'p') {
      await this.render(children)
      this.text('\n')
    } else if (type === 'at') {
      if (attrs.type === 'all') {
        this.children.push({ type: 'at', data: { qq: 'all' } })
      } else {
        this.children.push({ type: 'at', data: { qq: attrs.id, name: attrs.name } })
      }
    } else if (type === 'sharp') {
      if (attrs.id) this.text(attrs.id)
    } else if (type === 'face') {
      if (attrs.platform && attrs.platform !== this.bot.platform) {
        await this.render(children)
      } else {
        this.children.push({ type: 'face', data: { id: attrs.id } })
      }
    } else if (type === 'a') {
      await this.render(children)
      if (attrs.href) this.text(` (${attrs.href}) `)
    } else if (['video', 'audio', 'image'].includes(type)) {
      if (type === 'audio') type = 'record'
      attrs = { ...attrs }
      attrs.file = attrs.url
      delete attrs.url
      const cap = /^data:([\w/-]+);base64,/.exec(attrs.file)
      if (cap) attrs.file = 'base64://' + attrs.file.slice(cap[0].length)
      this.children.push({ type, data: attrs })
    } else if (type === 'onebot:music') {
      await this.flush()
      this.children.push({ type: 'music', data: attrs })
    } else if (type === 'onebot:tts') {
      await this.flush()
      this.children.push({ type: 'tts', data: attrs })
    } else if (type === 'onebot:poke') {
      await this.flush()
      this.children.push({ type: 'poke', data: attrs })
    } else if (type === 'onebot:gift') {
      await this.flush()
      this.children.push({ type: 'gift', data: attrs })
    } else if (type === 'author') {
      Object.assign(this.stack[0].author, attrs)
    } else if (type === 'figure') {
      await this.flush()
      this.stack.unshift(new State('forward'))
      await this.render(children)
      await this.flush()
      this.stack.shift()
      await this.forward()
    } else if (type === 'quote') {
      await this.flush()
      this.children.push({ type: 'reply', data: attrs })
    } else if (type === 'message') {
      await this.flush()
      // qqguild does not support forward messages
      if ('forward' in attrs) {
        this.stack.unshift(new State('forward'))
        await this.render(children)
        await this.flush()
        this.stack.shift()
        await this.forward()
      }
    } else {
      await this.render(children)
    }
  }
}
